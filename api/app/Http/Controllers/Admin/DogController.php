<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Dog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureInteractionColumnsAreJsonArray();

        $query = Dog::with(['user', 'vaccinationRecords'])
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->active !== null, function ($q) use ($request) {
                if ($request->boolean('active')) {
                    $q->where(fn($q2) => $q2->where('is_active', true)->orWhereNull('is_active'));
                } else {
                    $q->where('is_active', false);
                }
            })
            ->when($request->has('archived') && Schema::hasColumn('dogs', 'is_archived'), function ($q) use ($request) {
                if ($request->boolean('archived')) {
                    $q->where('is_archived', true);
                } else {
                    $q->where(fn($q2) => $q2->where('is_archived', false)->orWhereNull('is_archived'));
                }
            })
            ->when($request->breed, fn($q) => $q->where('breed', 'like', "%{$request->breed}%"))
            ->when($request->search, function ($q) use ($request) {
                $s = $request->search;
                $q->where(function ($q2) use ($s) {
                    $q2->where('name', 'like', "%{$s}%")
                       ->orWhere('breed', 'like', "%{$s}%")
                       ->orWhereHas('user', fn($q3) => $q3->where('name', 'like', "%{$s}%"));
                });
            })
            ->orderBy('name');

        return response()->json($query->paginate(50));
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAgeColumns();
        $this->ensureInteractionColumnsAreJsonArray();
        $data = $this->validated($request);
        if (!empty($data['age_estimate']) && empty($data['age_estimate_date'])) {
            $data['age_estimate_date'] = now()->toDateString();
        }
        $dog = Dog::create($data);

        return response()->json(['data' => $dog->load('vaccinationRecords')], 201);
    }

    public function show(Dog $dog): JsonResponse
    {
        $this->ensureInteractionColumnsAreJsonArray();
        return response()->json(['data' => $dog->load(['user', 'vaccinationRecords'])]);
    }

    public function update(Request $request, Dog $dog): JsonResponse
    {
        $this->ensureAgeColumns();
        $this->ensureInteractionColumnsAreJsonArray();
        $data = $this->validated($request);
        if (array_key_exists('age_estimate', $data) && $data['age_estimate'] != $dog->age_estimate) {
            $data['age_estimate_date'] = $data['age_estimate'] !== null ? now()->toDateString() : null;
        }
        $dog->update($data);

        return response()->json(['data' => $dog->fresh('vaccinationRecords')]);
    }

    public function uploadPhoto(Request $request, Dog $dog): JsonResponse
    {
        $request->validate([
            'photo' => 'required|file|image|max:10240',
        ]);

        // Delete old photo if exists
        if ($dog->photo_path) {
            Storage::disk('local')->delete($dog->photo_path);
        }

        $path = $request->file('photo')->store("dogs/{$dog->id}", 'local');
        $dog->update(['photo_path' => $path]);

        return response()->json(['data' => $dog->fresh(), 'message' => 'Photo uploaded.']);
    }

    public function servePhoto(Dog $dog): StreamedResponse
    {
        abort_unless($dog->photo_path && Storage::disk('local')->exists($dog->photo_path), 404);
        return Storage::disk('local')->response($dog->photo_path);
    }

    public function deletePhoto(Dog $dog): JsonResponse
    {
        if ($dog->photo_path) {
            Storage::disk('local')->delete($dog->photo_path);
            $dog->update(['photo_path' => null]);
        }
        return response()->json(['message' => 'Photo removed.']);
    }

    public function birthdays(): JsonResponse
    {
        $dogs = Dog::with('user')
            ->whereNotNull('date_of_birth')
            ->where('is_active', true)
            ->where(fn($q) => $q->where('is_archived', false)->orWhereNull('is_archived'))
            ->get()
            ->map(function ($dog) {
                $dob = \Carbon\Carbon::parse($dog->date_of_birth);
                $now = now()->setTimezone('America/Vancouver');

                // Next birthday this year or next
                $birthday = $dob->copy()->year($now->year);
                if ($birthday->lt($now->startOfDay())) {
                    $birthday->addYear();
                }
                $age = $birthday->year - $dob->year;

                return [
                    'id'             => $dog->id,
                    'name'           => $dog->name,
                    'date_of_birth'  => $dog->date_of_birth,
                    'next_birthday'  => $birthday->format('Y-m-d'),
                    'turning_age'    => $age,
                    'owner_name'     => $dog->user?->name,
                    'user_id'        => $dog->user_id,
                ];
            })
            ->sortBy('next_birthday')
            ->values();

        return response()->json(['data' => $dogs]);
    }

    private function ensureAgeColumns(): void
    {
        if (!Schema::hasColumn('dogs', 'age_estimate')) {
            DB::statement("ALTER TABLE `dogs` ADD COLUMN `age_estimate` DECIMAL(4,1) NULL AFTER `date_of_birth`");
        }
        if (!Schema::hasColumn('dogs', 'age_estimate_date')) {
            DB::statement("ALTER TABLE `dogs` ADD COLUMN `age_estimate_date` DATE NULL AFTER `age_estimate`");
        }
    }

    /**
     * interaction_strangers/interaction_children were originally single
     * VARCHAR values; converting to multi-select JSON arrays (matching
     * interaction_dogs) so a dog can have more than one descriptor.
     * Wraps any existing single value into a 1-element array before
     * changing the column type, so nobody's existing data is lost.
     */
    private function ensureInteractionColumnsAreJsonArray(): void
    {
        foreach (['interaction_strangers', 'interaction_children'] as $column) {
            $col = DB::selectOne("SHOW COLUMNS FROM dogs WHERE Field = '{$column}'");
            if (!$col || stripos($col->Type, 'json') !== false) {
                continue;
            }

            try {
                DB::statement("UPDATE dogs SET {$column} = NULL WHERE {$column} = ''");
                DB::statement("UPDATE dogs SET {$column} = CONCAT('[\"', {$column}, '\"]') WHERE {$column} IS NOT NULL");
                DB::statement("ALTER TABLE dogs MODIFY COLUMN {$column} JSON NULL");
            } catch (\Throwable $e) {
                try {
                    \App\Models\ErrorLog::create([
                        'type'       => 'SchemaHealFailed',
                        'message'    => $e->getMessage(),
                        'context'    => ['table' => 'dogs', 'column' => $column],
                        'created_at' => now(),
                    ]);
                } catch (\Throwable $logError) {}
            }
        }
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'user_id'            => 'required|exists:users,id',
            'name'               => 'required|string|max:100',
            'breed'              => 'nullable|string|max:100',
            'date_of_birth'      => 'nullable|date',
            'age_estimate'       => 'sometimes|nullable|numeric|min:0|max:99',
            'adoptaversary'      => 'nullable|date',
            'size'               => 'nullable|in:toy,small,medium,large,extra_large,xl',
            'sex'                => 'nullable|in:male,female',
            'weight_kg'          => 'nullable|numeric|min:0',
            'colour'             => 'nullable|string|max:100',
            'microchip_number'   => 'nullable|string|max:50',
            'spayed_neutered'    => 'sometimes|boolean',
            'bite_history'       => 'sometimes|boolean',
            'bite_history_notes' => 'nullable|string',
            'aggression_notes'   => 'nullable|string',
            'vet_name'           => 'nullable|string|max:255',
            'vet_phone'          => 'nullable|string|max:20',
            'vet_address'        => 'nullable|string|max:255',
            'medications'        => 'nullable|array',
            'medications.*.name'      => 'required|string',
            'medications.*.dosage'    => 'required|string',
            'medications.*.frequency' => 'required|string',
            'medications.*.notes'     => 'nullable|string',
            'special_instructions'   => 'nullable|string',
            'walking_notes'          => 'sometimes|nullable|string',
            'general_notes'          => 'sometimes|nullable|string',
            'petsitting_notes'       => 'sometimes|nullable|string',
            'is_active'          => 'sometimes|boolean',
            'is_archived'        => 'sometimes|boolean',
            'off_leash_approved' => 'sometimes|boolean',
            'media_consent'      => 'sometimes|boolean',
            'buddy_walks_ok'     => 'sometimes|boolean',

            // Intake-form-derived fields. Mirror the Client/DogController
            // rules so admin edits of the per-dog form save the same data.
            'personality_description'         => 'sometimes|nullable|string',
            'energy_level'                    => 'sometimes|nullable|string|max:50',
            'interaction_dogs'                => 'sometimes|nullable|array',
            'interaction_dogs.*'              => 'string|max:50',
            'interaction_strangers'           => 'sometimes|nullable|array',
            'interaction_strangers.*'         => 'string|max:50',
            'interaction_children'            => 'sometimes|nullable|array',
            'interaction_children.*'          => 'string|max:50',
            'triggers'                        => 'sometimes|nullable|string',
            'medical_conditions'              => 'sometimes|nullable|string',
            'allergies'                       => 'sometimes|nullable|string',
            'administer_medication_on_visits' => 'sometimes|nullable|boolean',
            'mobility_limitations'            => 'sometimes|nullable|boolean',
            'recent_surgeries'                => 'sometimes|nullable|string',
            'preferred_walk_style'            => 'sometimes|nullable|array',
            'preferred_gear'                  => 'sometimes|nullable|array',
            'treats_allowed'                  => 'sometimes|nullable|string|max:50',
            'treats_notes'                    => 'sometimes|nullable|string',
            'training_commands'               => 'sometimes|nullable|string',
            'avoid_on_walks'                  => 'sometimes|nullable|string',
        ]);
    }
}

<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Dog;
use App\Services\AdminNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DogController extends Controller
{
    public function __construct(private AdminNotificationService $adminNotifications) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->dogs()->with('vaccinationRecords')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        // New dogs from clients start as inactive pending admin review
        $data['user_id']   = $request->user()->id;
        $data['is_active'] = false;

        $dog = Dog::create($data);

        $this->adminNotifications->dogAdded($request->user(), $dog);

        return response()->json(['data' => $dog], 201);
    }

    public function update(Request $request, Dog $dog): JsonResponse
    {
        abort_unless($dog->user_id === $request->user()->id, 403);

        $oldData = $dog->toArray();
        $data    = $this->validated($request, required: false);
        $dog->update($data);

        $diff = $this->computeDiff($oldData, $dog->fresh()->toArray());
        $this->adminNotifications->dogUpdated($request->user(), $dog, $diff);

        return response()->json(['data' => $dog->fresh()]);
    }

    public function documents(Request $request): JsonResponse
    {
        $docs = $request->user()->documents()
            ->with('dog')
            ->paginate(20);

        return response()->json($docs);
    }

    public function uploadDocument(Request $request): JsonResponse
    {
        $request->validate([
            'file'   => 'required|file|mimes:pdf,jpg,jpeg,png,heic,docx|max:10240',
            'type'   => 'required|in:vaccination_record,vet_record,service_agreement,liability_waiver,other',
            'dog_id' => 'nullable|exists:dogs,id',
        ]);

        $user = $request->user();
        $file = $request->file('file');
        $path = $file->store('private/documents', 'local');

        $doc = $user->documents()->create([
            'dog_id'       => $request->dog_id,
            'type'         => $request->type,
            'filename'     => $file->getClientOriginalName(),
            'mime_type'    => $file->getMimeType(),
            'size_bytes'   => $file->getSize(),
            'storage_path' => $path,
            'uploaded_by'  => 'client',
        ]);

        $this->adminNotifications->documentUploaded($user, $doc);

        return response()->json(['data' => $doc], 201);
    }

    private function validated(Request $request, bool $required = true): array
    {
        $prefix = $required ? 'required|' : 'sometimes|';
        return $request->validate([
            'name'               => "{$prefix}string|max:100",
            'breed'              => 'sometimes|nullable|string|max:100',
            'date_of_birth'      => 'sometimes|nullable|date',
            'size'               => 'sometimes|nullable|in:small,medium,large,extra_large',
            'sex'                => 'sometimes|nullable|in:male,female',
            'weight_kg'          => 'sometimes|nullable|numeric|min:0',
            'colour'             => 'sometimes|nullable|string',
            'microchip_number'   => 'sometimes|nullable|string',
            'spayed_neutered'    => 'sometimes|boolean',
            'bite_history'       => 'sometimes|boolean',
            'bite_history_notes' => 'sometimes|nullable|string',
            'aggression_notes'   => 'sometimes|nullable|string',
            'vet_name'           => 'sometimes|nullable|string',
            'vet_phone'          => 'sometimes|nullable|string',
            'vet_address'        => 'sometimes|nullable|string',
            'medications'        => 'sometimes|nullable|array',
            'special_instructions' => 'sometimes|nullable|string',
        ]);
    }

    private function computeDiff(array $old, array $new): array
    {
        $diff = [];
        $skip = ['updated_at', 'created_at'];
        foreach ($new as $key => $val) {
            if (in_array($key, $skip)) continue;
            if (($old[$key] ?? null) !== $val) {
                $diff[$key] = ['from' => $old[$key] ?? null, 'to' => $val];
            }
        }
        return $diff;
    }
}

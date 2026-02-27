<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Dog;
use App\Models\HomeAccess;
use App\Models\User;
use Barryvdh\LaravelDompdf\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class IntakeController extends Controller
{
    public function show(User $client): JsonResponse
    {
        abort_unless($client->role === 'client', 404);

        return response()->json([
            'data' => $client->load(['clientProfile', 'dogs', 'homeAccess']),
        ]);
    }

    public function save(Request $request, User $client): JsonResponse
    {
        abort_unless($client->role === 'client', 404);

        if ($client->clientProfile?->intake_submitted_at) {
            return response()->json(['message' => 'Intake form already submitted and locked.'], 422);
        }

        $this->applyFormData($request, $client);

        return response()->json(['message' => 'Draft saved.']);
    }

    public function submit(Request $request, User $client): JsonResponse
    {
        abort_unless($client->role === 'client', 404);

        if ($client->clientProfile?->intake_submitted_at) {
            return response()->json(['message' => 'Intake form already submitted.'], 422);
        }

        $this->applyFormData($request, $client);

        // Mark submitted
        $client->clientProfile()->updateOrCreate(
            ['user_id' => $client->id],
            ['intake_submitted_at' => now()]
        );

        // Generate and store intake form as PDF
        $client->load(['clientProfile', 'dogs', 'homeAccess']);

        $pdf = Pdf::loadView('pdfs.intake_form', [
            'client'      => $client,
            'profile'     => $client->clientProfile,
            'dogs'        => $client->dogs,
            'homeAccess'  => $client->homeAccess,
            'submittedAt' => now()->setTimezone('America/Vancouver')->format('F j, Y g:i A'),
        ]);

        $pdfContent  = $pdf->output();
        $filename    = "intake_{$client->id}_" . now()->format('Ymd') . '.pdf';
        $storagePath = "private/documents/{$filename}";
        Storage::disk('local')->put($storagePath, $pdfContent);

        $client->documents()->create([
            'type'         => 'intake_form',
            'filename'     => 'Client Intake Form.pdf',
            'mime_type'    => 'application/pdf',
            'size_bytes'   => strlen($pdfContent),
            'storage_path' => $storagePath,
            'uploaded_by'  => 'admin',
        ]);

        return response()->json(['message' => 'Intake form submitted.']);
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private function applyFormData(Request $request, User $client): void
    {
        // User fields
        if ($request->has('name') && $request->name) {
            $client->update(['name' => $request->name]);
        }
        if ($request->has('email') && $request->email) {
            $existing = User::where('email', $request->email)->where('id', '!=', $client->id)->exists();
            if (!$existing) {
                $client->update(['email' => $request->email]);
            }
        }

        // Profile fields
        $profileFields = $request->only([
            'phone', 'address', 'city', 'province', 'postal_code',
            'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
            'vet_clinic_name', 'vet_phone', 'vet_address',
            'food_storage_location', 'customized_care_options', 'preferred_update_method',
            'report_detail_level', 'preferred_walk_days', 'preferred_walk_length', 'preferred_walk_times',
            'what_great_care_looks_like', 'biggest_concern', 'comfort_factors',
            'referral_source', 'additional_notes', 'billing_method',
        ]);
        $profileFields = array_filter($profileFields, fn($v) => $v !== null && $v !== '');

        if (!empty($profileFields)) {
            $client->clientProfile()->updateOrCreate(['user_id' => $client->id], $profileFields);
        }

        // Home access
        $homeData = $request->input('home_access');
        if (is_array($homeData) && !empty(array_filter($homeData))) {
            HomeAccess::updateOrCreate(['user_id' => $client->id], array_filter($homeData));
        }

        // Dogs
        $dogs = $request->input('dogs', []);
        foreach ($dogs as $dogData) {
            if (empty($dogData)) continue;

            $dogData['user_id'] = $client->id;

            // Convert empty strings to null for nullable fields
            foreach ($dogData as $k => $v) {
                if ($v === '') $dogData[$k] = null;
            }

            if (!empty($dogData['id'])) {
                $id = $dogData['id'];
                unset($dogData['id']);
                Dog::where('id', $id)->where('user_id', $client->id)->update($dogData);
            } else {
                unset($dogData['id']);
                if (!empty($dogData['name'])) {
                    $client->dogs()->create($dogData);
                }
            }
        }
    }
}

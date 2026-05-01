<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Dog;
use App\Models\HomeAccess;
use App\Models\User;
use App\Services\AdminNotificationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class IntakeController extends Controller
{
    public function __construct(private AdminNotificationService $adminNotifications) {}

    /**
     * Get the client's own intake data.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        return response()->json([
            'data' => $user->load(['clientProfile', 'dogs', 'homeAccess']),
        ]);
    }

    /**
     * Save the client's intake form as a draft.
     */
    public function save(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->clientProfile?->intake_submitted_at) {
            return response()->json(['message' => 'Intake form already submitted.'], 422);
        }

        $this->applyFormData($request, $user);

        return response()->json(['message' => 'Draft saved.']);
    }

    /**
     * Submit the client's intake form (final).
     */
    public function submit(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->clientProfile?->intake_submitted_at) {
            return response()->json(['message' => 'Intake form already submitted.'], 422);
        }

        $this->applyFormData($request, $user);

        // Mark submitted + confirmed
        $user->clientProfile()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'intake_submitted_at'  => now(),
                'profile_confirmed_at' => now(),
            ]
        );

        // Generate and store intake form as PDF
        $user->load(['clientProfile', 'dogs', 'homeAccess']);

        try {
            $pdf = Pdf::loadView('pdfs.intake_form', [
                'client'      => $user,
                'profile'     => $user->clientProfile,
                'dogs'        => $user->dogs,
                'homeAccess'  => $user->homeAccess,
                'submittedAt' => now()->setTimezone('America/Vancouver')->format('F j, Y g:i A'),
            ]);

            $pdfContent  = $pdf->output();
            $filename    = "intake_{$user->id}_" . now()->format('Ymd') . '.pdf';
            $storagePath = "private/documents/{$filename}";
            Storage::disk('local')->put($storagePath, $pdfContent);

            $user->documents()->create([
                'type'         => 'intake_form',
                'filename'     => "{$user->name} - Intake Form.pdf",
                'mime_type'    => 'application/pdf',
                'size_bytes'   => strlen($pdfContent),
                'storage_path' => $storagePath,
                'uploaded_by'  => 'client',
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Intake PDF generation failed', ['error' => $e->getMessage()]);
        }

        // Post intake summary in chat
        $profile = $user->clientProfile;
        $fields = [];
        if ($user->name) $fields[] = "Name: {$user->name}";
        if ($profile?->phone) $fields[] = "Phone: {$profile->phone}";
        if ($profile?->address) {
            $addr = $profile->address;
            if ($profile->city) $addr .= ", {$profile->city}";
            if ($profile->province) $addr .= ", {$profile->province}";
            if ($profile->postal_code) $addr .= " {$profile->postal_code}";
            $fields[] = "Address: {$addr}";
        }
        if ($profile?->emergency_contact_name) {
            $fields[] = "Emergency Contact: {$profile->emergency_contact_name}" .
                ($profile->emergency_contact_phone ? " ({$profile->emergency_contact_phone})" : '');
        }
        if ($profile?->vet_clinic_name) {
            $fields[] = "Vet: {$profile->vet_clinic_name}" .
                ($profile->vet_phone ? " ({$profile->vet_phone})" : '');
        }

        $dogNames = $user->dogs->pluck('name')->filter()->implode(', ');
        if ($dogNames) $fields[] = "Dogs: {$dogNames}";

        $body = "{$user->name} has completed their intake form.\n• " . implode("\n• ", $fields);
        $this->adminNotifications->notifyWithMessage($user, 'Intake Form Submitted', $body);

        return response()->json([
            'message' => 'Intake form submitted.',
            'data'    => $user->fresh('clientProfile'),
        ]);
    }

    private function applyFormData(Request $request, User $client): void
    {
        // User fields (clients can update their own name but not email)
        if ($request->has('name') && $request->name) {
            $client->update(['name' => $request->name]);
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
            'notify_app', 'notify_email', 'notify_sms',
        ]);
        // Boolean fields should pass through even when false
        $booleanKeys = ['notify_app', 'notify_email', 'notify_sms'];
        $booleanFields = [];
        foreach ($booleanKeys as $bk) {
            if (array_key_exists($bk, $profileFields)) {
                $booleanFields[$bk] = (bool) $profileFields[$bk];
                unset($profileFields[$bk]);
            }
        }
        $profileFields = array_filter($profileFields, fn($v) => $v !== null && $v !== '');
        $profileFields = array_merge($profileFields, $booleanFields);

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

            foreach ($dogData as $k => $v) {
                if ($v === '') $dogData[$k] = null;
            }

            // Only keep fillable fields to avoid mass-assignment errors
            $fillable = (new Dog())->getFillable();
            $dogData = array_intersect_key($dogData, array_flip($fillable));
            $dogData['user_id'] = $client->id;

            try {
                if (!empty($dogData['id'])) {
                    $id = $dogData['id'];
                    unset($dogData['id']);
                    $dog = Dog::where('id', $id)->where('user_id', $client->id)->first();
                    if ($dog) {
                        $dog->fill($dogData);
                        $dog->save();
                    }
                } else {
                    unset($dogData['id']);
                    if (!empty($dogData['name'])) {
                        $client->dogs()->create($dogData);
                    }
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Intake dog save failed', [
                    'dog_name' => $dogData['name'] ?? 'unknown',
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}

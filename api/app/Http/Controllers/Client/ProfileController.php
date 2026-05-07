<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\HomeAccess;
use App\Services\AdminNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class ProfileController extends Controller
{
    public function __construct(private AdminNotificationService $adminNotifications) {}

    private function ensureNotifyColumns(): void
    {
        if (!Schema::hasColumn('client_profiles', 'notify_app')) {
            Schema::table('client_profiles', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->boolean('notify_app')->default(true);
                $table->boolean('notify_email')->default(false);
                $table->boolean('notify_sms')->default(false);
            });
        }
    }

    public function show(Request $request): JsonResponse
    {
        $this->ensureNotifyColumns();
        return response()->json(['data' => $request->user()->load('clientProfile')]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->ensureNotifyColumns();

        $data = $request->validate([
            'name'                     => 'sometimes|string|max:255',
            'phone'                    => 'sometimes|nullable|string',
            'address'                  => 'sometimes|nullable|string',
            'city'                     => 'sometimes|nullable|string',
            'province'                 => 'sometimes|nullable|string|max:2',
            'postal_code'              => 'sometimes|nullable|string|max:7',
            'emergency_contact_name'   => 'sometimes|nullable|string',
            'emergency_contact_phone'  => 'sometimes|nullable|string',
            'secondary_contact_name'   => 'sometimes|nullable|string',
            'secondary_contact_email'  => 'sometimes|nullable|string|email',
            'secondary_contact_phone'  => 'sometimes|nullable|string',
            'notify_app'               => 'sometimes|boolean',
            'notify_email'             => 'sometimes|boolean',
            'notify_sms'               => 'sometimes|boolean',
            'secondary_notify_app'     => 'sometimes|boolean',
            'secondary_notify_email'   => 'sometimes|boolean',
            'secondary_notify_sms'     => 'sometimes|boolean',
            'billing_method'           => 'sometimes|in:credit_card,e_transfer,interac_pad,cash',
            'preferred_walk_days'      => 'sometimes|array',
            'preferred_walk_days.*'    => 'string',
            'preferred_walk_times'     => 'sometimes|array',
            'preferred_walk_times.*'   => 'string',
            'notification_preferences' => 'sometimes|array',
        ]);

        $user = $request->user();
        $profile = $user->clientProfile;

        // Track old values for change detection
        $oldValues = [];
        $fieldLabels = [
            'name' => 'Name', 'phone' => 'Phone', 'address' => 'Address',
            'city' => 'City', 'province' => 'Province', 'postal_code' => 'Postal Code',
            'emergency_contact_name' => 'Emergency Contact', 'emergency_contact_phone' => 'Emergency Phone',
            'secondary_contact_name' => 'Secondary Contact', 'secondary_contact_email' => 'Secondary Email',
            'secondary_contact_phone' => 'Secondary Phone', 'billing_method' => 'Billing Method',
        ];
        foreach ($fieldLabels as $field => $label) {
            if (!isset($data[$field])) continue;
            $old = $field === 'name' ? $user->name : ($profile?->$field ?? '');
            $oldValues[$field] = $old;
        }

        // Track billing method change for notification
        $oldBillingMethod = $profile?->billing_method;

        if (isset($data['name'])) {
            $user->update(['name' => $data['name']]);
        }

        $profileFields = array_diff_key($data, ['name' => true]);
        if ($profileFields) {
            $user->clientProfile()->updateOrCreate(['user_id' => $user->id], $profileFields);
        }

        // Build change summary for chat
        $changes = [];
        foreach ($fieldLabels as $field => $label) {
            if (!isset($data[$field])) continue;
            $oldVal = (string) ($oldValues[$field] ?? '');
            $newVal = (string) $data[$field];
            if ($oldVal !== $newVal) {
                if ($field === 'billing_method') {
                    $methodLabels = ['credit_card' => 'Credit Card', 'e_transfer' => 'E-Transfer', 'interac_pad' => 'Interac/PAD', 'cash' => 'Cash'];
                    $oldVal = $methodLabels[$oldVal] ?? $oldVal ?: 'Not set';
                    $newVal = $methodLabels[$newVal] ?? $newVal;
                }
                $changes[] = "{$label}: " . ($oldVal ? "{$oldVal} → {$newVal}" : $newVal);
            }
        }

        // Post changes in chat (don't let notification failures break the save)
        try {
            if (!empty($changes)) {
                $body = "{$user->name} updated their profile:\n• " . implode("\n• ", $changes);
                $this->adminNotifications->notifyWithMessage($user, 'Profile Updated', $body);
            } else {
                $this->adminNotifications->profileUpdated($user);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Profile update notification failed: ' . $e->getMessage());
        }

        return response()->json(['data' => $user->fresh('clientProfile')]);
    }

    /**
     * Client confirms their profile is accurate.
     */
    public function confirm(Request $request): JsonResponse
    {
        $user = $request->user();

        // Mark profile as confirmed
        $user->clientProfile()->updateOrCreate(
            ['user_id' => $user->id],
            ['profile_confirmed_at' => now()]
        );

        // Post approval message in chat
        $this->adminNotifications->notifyWithMessage(
            $user,
            'Profile Confirmed',
            "{$user->name} has approved their profile."
        );

        return response()->json([
            'message' => 'Profile confirmed.',
            'data'    => $user->fresh('clientProfile'),
        ]);
    }

    public function homeAccess(Request $request): JsonResponse
    {
        $access = $request->user()->homeAccess;
        if (!$access) {
            return response()->json(['data' => null]);
        }
        // Clients do NOT see codes — mask them
        return response()->json(['data' => array_merge($access->toArray(), [
            'lockbox_code' => $access->lockbox_code ? '****' : null,
            'door_code'    => $access->door_code ? '****' : null,
            'alarm_code'   => $access->alarm_code ? '****' : null,
        ])]);
    }

    public function updateHomeAccess(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entry_instructions'   => 'nullable|string',
            'lockbox_code'         => 'nullable|string',
            'door_code'            => 'nullable|string',
            'alarm_code'           => 'nullable|string',
            'key_location'         => 'nullable|string',
            'parking_instructions' => 'nullable|string',
            'notes'                => 'nullable|string',
        ]);

        $user = $request->user();
        HomeAccess::updateOrCreate(['user_id' => $user->id], $data);
        $this->adminNotifications->homeAccessUpdated($user);

        return response()->json(['message' => 'Home access updated.']);
    }
}

<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\HomeAccess;
use App\Services\AdminNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function __construct(private AdminNotificationService $adminNotifications) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->load('clientProfile')]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                     => 'sometimes|string|max:255',
            'phone'                    => 'sometimes|nullable|string',
            'address'                  => 'sometimes|nullable|string',
            'city'                     => 'sometimes|nullable|string',
            'province'                 => 'sometimes|nullable|string|max:2',
            'postal_code'              => 'sometimes|nullable|string|max:7',
            'emergency_contact_name'   => 'sometimes|nullable|string',
            'emergency_contact_phone'  => 'sometimes|nullable|string',
        ]);

        $user = $request->user();

        if (isset($data['name'])) {
            $user->update(['name' => $data['name']]);
        }

        $profileData = array_filter(array_diff_key($data, ['name' => true]));
        if ($profileData) {
            $user->clientProfile()->updateOrCreate(['user_id' => $user->id], $profileData);
        }

        $this->adminNotifications->profileUpdated($user);

        return response()->json(['data' => $user->fresh('clientProfile')]);
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

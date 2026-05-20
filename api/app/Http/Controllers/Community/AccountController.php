<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AccountController extends Controller
{
    /**
     * Default notification preferences. The DB column is nullable; when
     * empty we merge with these defaults so behavior is predictable on
     * accounts that predate the settings feature.
     */
    public const NOTIFICATION_DEFAULTS = [
        'connection_requests' => true,
        'messages'            => true,
        'broadcasts'          => true,
        'product_updates'     => false,
    ];

    /**
     * GET /api/community/account/settings
     */
    public function settings(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        return response()->json([
            'paused'             => (bool) $member->paused_at,
            'paused_at'          => $member->paused_at?->toIso8601String(),
            'notification_prefs' => array_merge(
                self::NOTIFICATION_DEFAULTS,
                is_array($member->notification_prefs) ? $member->notification_prefs : [],
            ),
        ]);
    }

    /**
     * PATCH /api/community/account/password
     * Body: current_password, password, password_confirmation
     */
    public function changePassword(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        $data = $request->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'string', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()],
        ]);

        if (!Hash::check($data['current_password'], $member->password)) {
            return response()->json(['message' => 'Your current password is incorrect.'], 422);
        }

        $member->forceFill([
            'password' => Hash::make($data['password']),
        ])->save();

        // Rotate the bearer token so a stolen session can't outlive a
        // password change. The caller gets a fresh token to persist.
        $token = $member->issueToken();

        return response()->json([
            'message' => 'Password updated.',
            'token'   => $token,
        ]);
    }

    /**
     * PATCH /api/community/account/notifications
     * Body: { key: bool, ... } — partial updates allowed; unknown keys ignored.
     */
    public function updateNotifications(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        $allowedKeys = array_keys(self::NOTIFICATION_DEFAULTS);

        $rules = ['prefs' => 'required|array'];
        foreach ($allowedKeys as $k) {
            $rules["prefs.$k"] = 'sometimes|boolean';
        }
        $data = $request->validate($rules);

        $existing = is_array($member->notification_prefs) ? $member->notification_prefs : [];
        $merged = array_merge(self::NOTIFICATION_DEFAULTS, $existing, $data['prefs']);
        // Strip unknown keys so the JSON stays clean.
        $merged = array_intersect_key($merged, self::NOTIFICATION_DEFAULTS);

        $member->forceFill(['notification_prefs' => $merged])->save();

        return response()->json(['notification_prefs' => $merged]);
    }

    /**
     * POST /api/community/account/pause
     * Hides the member from discovery without deleting their data.
     */
    public function pause(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        if (!$member->paused_at) {
            $member->forceFill(['paused_at' => now()])->save();
        }

        return response()->json([
            'paused'    => true,
            'paused_at' => $member->paused_at?->toIso8601String(),
        ]);
    }

    /**
     * POST /api/community/account/resume
     */
    public function resume(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        if ($member->paused_at) {
            $member->forceFill(['paused_at' => null])->save();
        }

        return response()->json(['paused' => false]);
    }

    /**
     * DELETE /api/community/account
     * Body: current_password
     *
     * Soft-deletes the member, revokes the bearer token, and marks the
     * status as `closed`. Connection edges and conversations stay in the
     * DB but reference a soft-deleted member, so other members see them
     * disappear from network/inbox views immediately.
     */
    public function destroy(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        $data = $request->validate([
            'current_password' => 'required|string',
        ]);

        if (!Hash::check($data['current_password'], $member->password)) {
            return response()->json(['message' => 'Your current password is incorrect.'], 422);
        }

        $member->forceFill([
            'status'    => 'closed',
            'api_token' => null,
        ])->save();
        $member->delete(); // soft-delete

        return response()->json(['message' => 'Account closed.']);
    }
}

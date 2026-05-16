<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AuthController extends Controller
{
    /**
     * POST /api/community/auth/register
     * Create a new Community member account in `pending_verification`
     * status. Verification (ID + selfie) happens as a separate step.
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|max:255|unique:community_members,email',
            'password' => ['required', 'string', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()],
        ]);

        $member = CommunityMember::create([
            'name'     => $data['name'],
            'email'    => strtolower($data['email']),
            'password' => Hash::make($data['password']),
            'status'   => 'pending_verification',
        ]);

        $token = $member->issueToken();

        return response()->json([
            'token'  => $token,
            'member' => $member->fresh(),
        ], 201);
    }

    /**
     * POST /api/community/auth/login
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $member = CommunityMember::where('email', strtolower($data['email']))->first();
        if (!$member || !Hash::check($data['password'], $member->password)) {
            return response()->json(['message' => 'The email and password do not match.'], 401);
        }

        if ($member->status === 'suspended') {
            return response()->json(['message' => 'This account has been suspended. Reach out to support if you believe this is in error.'], 403);
        }
        if ($member->status === 'closed') {
            return response()->json(['message' => 'This account has been closed.'], 403);
        }

        $token = $member->issueToken();

        return response()->json([
            'token'  => $token,
            'member' => $member->fresh(),
        ]);
    }

    /**
     * POST /api/community/auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $member = $request->attributes->get('community_member');
        if ($member) {
            $member->revokeToken();
        }
        return response()->json(['message' => 'Signed out.']);
    }

    /**
     * GET /api/community/me
     */
    public function me(Request $request): JsonResponse
    {
        $member = $request->attributes->get('community_member');
        return response()->json(['data' => $member]);
    }
}

<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'The email and password do not match.'], 401);
        }

        if ($user->status === 'inactive') {
            return response()->json(['message' => 'Your account has been deactivated.'], 403);
        }

        // Auto-activate pending users on login
        if ($user->status === 'pending') {
            $user->update(['status' => 'active']);
        }

        $token = $user->createToken('api')->plainTextToken;

        AuditLog::recordEvent($user, 'login');

        $user->load('clientProfile');

        return response()->json([
            'token' => $token,
            'user'  => $user,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        AuditLog::recordEvent($request->user(), 'logout');

        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->load('clientProfile')]);
    }

    public function setPassword(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()],
        ]);

        $user = $request->user();
        $user->update([
            'password' => Hash::make($request->password),
            'status'   => 'active',
        ]);

        // Mark onboarding step
        $user->onboardingSteps()->updateOrCreate(
            ['step' => 'set_password'],
            ['completed_at' => now()]
        );

        return response()->json(['message' => 'Password set successfully.']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email|exists:users,email']);

        $status = Password::sendResetLink($request->only('email'));

        return response()->json(['message' => __($status)]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token'    => 'required',
            'email'    => 'required|email',
            'password' => ['required', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->update(['password' => Hash::make($password)]);
                $user->tokens()->delete();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            $resetUser = User::where('email', $request->email)->first();
            if ($resetUser) {
                AuditLog::recordEvent($resetUser, 'password_reset');
            }
            return response()->json(['message' => 'Password reset successfully.']);
        }

        return response()->json(['message' => __($status)], 422);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()],
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        AuditLog::recordEvent($user, 'password_changed');

        return response()->json(['message' => 'Password changed successfully.']);
    }

    public function deleteAccount(Request $request): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = $request->user();

        if ($user->role === 'superadmin' || $user->role === 'admin') {
            return response()->json(['message' => 'Admin accounts cannot be self-deleted.'], 403);
        }

        if (!Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Password is incorrect.'], 422);
        }

        AuditLog::recordEvent($user, 'account_deleted');

        // Delete related data — order matters for foreign key constraints
        $user->tokens()->delete();

        // Invoices and line items (cascade handles line items)
        $user->invoices()->forceDelete();

        // Service requests (pivot cascade handles service_request_dog)
        $user->serviceRequests()->delete();

        // Appointments (cascade handles visit_reports, appointment_dog pivot)
        $user->appointments()->forceDelete();

        // Dogs (cascade handles vaccination_records, service_request_dog)
        $user->dogs()->each(function ($dog) {
            $dog->vaccinationRecords()->delete();
            $dog->forceDelete();
        });

        // Documents, onboarding, push notifications
        $user->documents()->delete();
        $user->onboardingSteps()->delete();
        $user->pushNotifications()->delete();

        // Home access & profile
        $user->homeAccess()->delete();
        $user->clientProfile()->delete();

        // Conversations and messages
        $conversations = \App\Models\Conversation::where('user_id', $user->id)->get();
        foreach ($conversations as $convo) {
            $convo->messages()->delete();
            $convo->delete();
        }

        // Hard-delete the user
        $user->forceDelete();

        return response()->json(['message' => 'Your account and data have been deleted.']);
    }

    public function updatePushToken(Request $request): JsonResponse
    {
        $request->validate(['expo_push_token' => 'required|string']);
        $request->user()->update(['expo_push_token' => $request->expo_push_token]);
        return response()->json(['message' => 'Push token updated.']);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class TeamController extends Controller
{
    public function index(): JsonResponse
    {
        $team = User::whereIn('role', ['admin', 'superadmin'])
            ->select('id', 'name', 'email', 'role', 'status', 'created_at')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $team]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'  => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'role'  => 'sometimes|in:admin',
        ]);

        $tempPassword = Str::random(12);

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($tempPassword),
            'role'     => 'admin',
            'status'   => 'active',
        ]);

        return response()->json([
            'data' => $user->only('id', 'name', 'email', 'role', 'status'),
            'temp_password' => $tempPassword,
            'message' => "Admin created. Temporary password: {$tempPassword}",
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        abort_if($user->role === 'superadmin', 422, 'Cannot modify a superadmin account.');
        abort_unless(in_array($user->role, ['admin', 'superadmin']), 404);

        $data = $request->validate([
            'name'   => 'sometimes|string|max:255',
            'email'  => 'sometimes|email|unique:users,email,' . $user->id,
            'status' => 'sometimes|in:active,inactive',
        ]);

        $user->update($data);

        return response()->json(['data' => $user->only('id', 'name', 'email', 'role', 'status')]);
    }

    public function destroy(User $user): JsonResponse
    {
        abort_if($user->role === 'superadmin', 422, 'Cannot delete a superadmin account.');
        abort_unless($user->role === 'admin', 404);

        $user->update(['status' => 'inactive']);

        return response()->json(['message' => 'Team member deactivated.']);
    }

    public function resetPassword(User $user): JsonResponse
    {
        abort_if($user->role === 'superadmin', 422, 'Cannot reset superadmin password here.');
        abort_unless(in_array($user->role, ['admin', 'superadmin']), 404);

        $tempPassword = Str::random(12);
        $user->update(['password' => Hash::make($tempPassword)]);

        return response()->json([
            'temp_password' => $tempPassword,
            'message' => "Password reset. New temporary password: {$tempPassword}",
        ]);
    }
}

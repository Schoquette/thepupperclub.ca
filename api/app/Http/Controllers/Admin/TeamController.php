<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Mail\TeamInvitationMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class TeamController extends Controller
{
    private function ensureCanManageTeam(): void
    {
        $user = auth()->user();
        abort_unless(
            $user->role === 'superadmin' || $user->email === 'sophie@thepupperclub.ca',
            403,
            'Only the super admin can manage team members.'
        );
    }

    public function index(): JsonResponse
    {
        $this->ensureHomeAddressColumns();

        $columns = ['id', 'name', 'email', 'role', 'status', 'created_at'];
        foreach (['home_address', 'home_street', 'home_city', 'home_province', 'home_postal_code'] as $col) {
            if (Schema::hasColumn('users', $col)) {
                $columns[] = $col;
            }
        }

        $team = User::whereIn('role', ['admin', 'superadmin'])
            ->select($columns)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $team]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureCanManageTeam();
        $this->ensureHomeAddressColumns();

        $data = $request->validate([
            'name'             => 'required|string|max:255',
            'email'            => 'required|email|unique:users,email',
            'role'             => 'sometimes|in:admin',
            'home_street'      => 'nullable|string|max:255',
            'home_city'        => 'nullable|string|max:100',
            'home_province'    => 'nullable|string|max:2',
            'home_postal_code' => 'nullable|string|max:10',
        ]);

        $tempPassword = Str::random(12);

        $addressFields = ['home_street', 'home_city', 'home_province', 'home_postal_code'];

        $fields = [
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($tempPassword),
            'role'     => 'admin',
            'status'   => 'active',
        ];

        foreach ($addressFields as $col) {
            if (Schema::hasColumn('users', $col) && isset($data[$col])) {
                $fields[$col] = $data[$col];
            }
        }

        // Build composite home_address for backward compatibility
        $fullAddress = trim(implode(', ', array_filter([
            $data['home_street'] ?? null,
            $data['home_city'] ?? null,
            $data['home_province'] ?? null,
            $data['home_postal_code'] ?? null,
        ])));
        if ($fullAddress && Schema::hasColumn('users', 'home_address')) {
            $fields['home_address'] = $fullAddress;
        }

        $user = User::create($fields);

        // Send invitation email with set-password link
        $token = Password::createToken($user);
        Mail::to($user->email)->send(new TeamInvitationMail($user, $token, $tempPassword));

        return response()->json([
            'data' => $user->only('id', 'name', 'email', 'role', 'status'),
            'temp_password' => $tempPassword,
            'message' => "Invite sent to {$user->email}.",
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->ensureCanManageTeam();
        abort_if($user->role === 'superadmin' && auth()->id() !== $user->id, 422, 'Cannot modify a superadmin account.');
        abort_unless(in_array($user->role, ['admin', 'superadmin']), 404);

        $this->ensureHomeAddressColumns();

        $data = $request->validate([
            'name'             => 'sometimes|string|max:255',
            'email'            => 'sometimes|email|unique:users,email,' . $user->id,
            'status'           => 'sometimes|in:active,inactive',
            'home_street'      => 'sometimes|nullable|string|max:255',
            'home_city'        => 'sometimes|nullable|string|max:100',
            'home_province'    => 'sometimes|nullable|string|max:2',
            'home_postal_code' => 'sometimes|nullable|string|max:10',
        ]);

        // Build composite home_address for backward compatibility
        $addressFields = ['home_street', 'home_city', 'home_province', 'home_postal_code'];
        $hasAddressUpdate = collect($addressFields)->contains(fn($f) => array_key_exists($f, $data));
        if ($hasAddressUpdate && Schema::hasColumn('users', 'home_address')) {
            $parts = [];
            foreach ($addressFields as $f) {
                $parts[] = $data[$f] ?? $user->$f ?? null;
            }
            $data['home_address'] = trim(implode(', ', array_filter($parts))) ?: null;
        }

        $user->update($data);

        $returnFields = ['id', 'name', 'email', 'role', 'status'];
        foreach (['home_address', 'home_street', 'home_city', 'home_province', 'home_postal_code'] as $col) {
            if (Schema::hasColumn('users', $col)) {
                $returnFields[] = $col;
            }
        }

        return response()->json(['data' => $user->only($returnFields)]);
    }

    public function destroy(User $user): JsonResponse
    {
        $this->ensureCanManageTeam();
        abort_if($user->role === 'superadmin', 422, 'Cannot delete a superadmin account.');
        abort_unless($user->role === 'admin', 404);

        $user->update(['status' => 'inactive']);

        return response()->json(['message' => 'Team member deactivated.']);
    }

    private function ensureHomeAddressColumns(): void
    {
        if (!Schema::hasColumn('users', 'home_street')) {
            Schema::table('users', function (\Illuminate\Database\Schema\Blueprint $table) {
                if (!Schema::hasColumn('users', 'home_address')) {
                    $table->string('home_address', 500)->nullable();
                }
                $table->string('home_street', 255)->nullable();
                $table->string('home_city', 100)->nullable();
                $table->string('home_province', 2)->nullable();
                $table->string('home_postal_code', 10)->nullable();
            });
        }
    }

    public function resetPassword(User $user): JsonResponse
    {
        $this->ensureCanManageTeam();
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

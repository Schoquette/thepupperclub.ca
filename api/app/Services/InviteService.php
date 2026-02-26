<?php

namespace App\Services;

use App\Mail\ClientInvitationMail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class InviteService
{
    public function invite(string $name, string $email): User
    {
        $tempPassword = Str::random(16);

        $user = User::create([
            'name'     => $name,
            'email'    => $email,
            'password' => bcrypt($tempPassword),
            'role'     => 'client',
            'status'   => 'pending',
        ]);

        // Create profile placeholder
        $user->clientProfile()->create([]);

        // Create conversation thread
        $user->conversation()->create([]);

        // Send invite email with temp password + set-password link
        $token = Password::createToken($user);
        Mail::to($user->email)->send(new ClientInvitationMail($user, $token, $tempPassword));

        return $user;
    }

    public function resend(User $user): void
    {
        $token = Password::createToken($user);
        Mail::to($user->email)->send(new ClientInvitationMail($user, $token, null));
    }

    public function resetPassword(User $user): void
    {
        Password::sendResetLink(['email' => $user->email]);
    }
}

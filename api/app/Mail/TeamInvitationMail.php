<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class TeamInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $setPasswordUrl;

    public function __construct(
        public User $user,
        public string $token,
        public ?string $tempPassword
    ) {
        $frontendUrl = rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/');
        $this->setPasswordUrl = "{$frontendUrl}/set-password?token={$token}&email=" . urlencode($user->email);
    }

    public function build(): static
    {
        return $this
            ->subject("You've been invited to The Pupper Club team!")
            ->view('emails.team-invitation');
    }
}

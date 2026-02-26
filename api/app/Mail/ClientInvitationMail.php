<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ClientInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $setPasswordUrl;

    public function __construct(
        public User $user,
        public string $token,
        public ?string $tempPassword
    ) {
        $frontendUrl = config('services.frontend_url');
        $this->setPasswordUrl = "{$frontendUrl}/set-password?token={$token}&email=" . urlencode($user->email);
    }

    public function build(): static
    {
        return $this
            ->subject("Welcome to The Pupper Club! Set your password")
            ->view('emails.client-invitation');
    }
}

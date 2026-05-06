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
        $frontendUrl = rtrim(config('services.frontend_url') ?: env('FRONTEND_URL', 'https://thepupperclub.ca'), '/');
        $this->setPasswordUrl = "{$frontendUrl}/set-password?token={$token}&email=" . urlencode($user->email);
    }

    public function build(): static
    {
        $mailable = $this
            ->subject("Welcome to The Pupper Club! Set your password")
            ->view('emails.client-invitation');

        // Embed logo as CID inline attachment (same as broadcast emails)
        $logoPath = public_path('images/logo-cream-stacked.png');
        if (file_exists($logoPath)) {
            $mailable->withSymfonyMessage(function ($message) use ($logoPath) {
                $logoPart = new \Symfony\Component\Mime\Part\DataPart(
                    file_get_contents($logoPath),
                    'logo.png',
                    'image/png'
                );
                $logoPart->asInline();
                $logoPart->setContentId('logo@thepupperclub.ca');
                $message->addPart($logoPart);
            });
        }

        return $mailable;
    }
}

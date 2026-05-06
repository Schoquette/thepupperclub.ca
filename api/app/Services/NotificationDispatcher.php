<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;

class NotificationDispatcher
{
    public function __construct(
        private ExpoNotificationService $expo,
        private SmsService $sms,
    ) {}

    /**
     * Send a notification to a client via their preferred channels.
     *
     * @param User   $user    The client user
     * @param string $title   Notification title (used for push + email subject)
     * @param string $body    Plain text body (used for push + SMS)
     * @param string|null $htmlBody  Optional HTML body for email (falls back to $body)
     * @param array  $data    Optional data payload for push notifications
     */
    public function notify(User $user, string $title, string $body, ?string $htmlBody = null, array $data = [], ?string $replyTo = null): void
    {
        $prefs = $this->getPreferences($user);

        // App / Push notification (default)
        if ($prefs['notify_app']) {
            $this->expo->send($user, $title, $body, $data);
        }

        // Email
        if ($prefs['notify_email'] && $user->email) {
            $this->sendEmail($user, $title, $htmlBody ?? nl2br(e($body)), $replyTo);
        }

        // SMS (one-way — log in to respond)
        if ($prefs['notify_sms']) {
            $phone = $user->clientProfile?->phone;
            if ($phone) {
                $smsBody = "The Pupper Club Alert\n\n"
                    . strip_tags($body)
                    . "\n\nTo respond, log in at thepupperclub.ca";
                $this->sms->send($phone, $smsBody);
            }
        }
    }

    /**
     * Send to multiple users respecting each user's preferences.
     */
    public function notifyMany(iterable $users, string $title, string $body, ?string $htmlBody = null, array $data = []): void
    {
        foreach ($users as $user) {
            $this->notify($user, $title, $body, $htmlBody, $data);
        }
    }

    /**
     * Get notification preferences for a user. Defaults to app-only.
     */
    private function getPreferences(User $user): array
    {
        $defaults = [
            'notify_app'   => true,
            'notify_email' => false,
            'notify_sms'   => false,
        ];

        // Admins: read prefs from users table
        if (in_array($user->role, ['admin', 'superadmin'])) {
            if (Schema::hasColumn('users', 'notify_app')) {
                return [
                    'notify_app'   => $user->notify_app ?? true,
                    'notify_email' => $user->notify_email ?? true,
                    'notify_sms'   => $user->notify_sms ?? false,
                ];
            }
            return ['notify_app' => true, 'notify_email' => true, 'notify_sms' => false];
        }

        // Clients: read prefs from client_profiles table
        if (!Schema::hasColumn('client_profiles', 'notify_app')) {
            return $defaults;
        }

        $profile = $user->clientProfile;
        if (!$profile) {
            return $defaults;
        }

        return [
            'notify_app'   => $profile->notify_app ?? true,
            'notify_email' => $profile->notify_email ?? false,
            'notify_sms'   => $profile->notify_sms ?? false,
        ];
    }

    /**
     * Send a branded email notification.
     */
    private function sendEmail(User $user, string $title, string $htmlContent, ?string $replyTo = null): void
    {
        try {
            $logoPath = public_path('images/logo-cream-stacked.png');
            Mail::send([], [], function ($message) use ($user, $title, $htmlContent, $replyTo, $logoPath) {
                // Check for custom general_notification template
                $customHtml = \App\Http\Controllers\Admin\NotificationController::renderSystemTemplate(
                    'general_notification',
                    ['{title}' => $title, '{content}' => $htmlContent]
                );

                $message->to($user->email)
                    ->subject($title)
                    ->html($customHtml ?? view('emails.notification', [
                        'title'    => $title,
                        'content'  => $htmlContent,
                        'userName' => $user->name,
                    ])->render());
                if (file_exists($logoPath)) {
                    $symfony = $message->getSymfonyMessage();
                    $logoPart = new \Symfony\Component\Mime\Part\DataPart(
                        file_get_contents($logoPath),
                        'logo.png',
                        'image/png'
                    );
                    $logoPart->asInline();
                    $logoPart->setContentId('logo@thepupperclub.ca');
                    $symfony->addPart($logoPart);
                }
                // Reply-To: use inbound address so replies route through the webhook,
                // falling back to the admin's email if no inbound is configured
                $inbound = config('services.resend.inbound_address');
                $message->replyTo($inbound ?: $replyTo ?: config('mail.from.address'));
            });
        } catch (\Throwable $e) {
            Log::warning('NotificationDispatcher: Email failed', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
        }
    }
}

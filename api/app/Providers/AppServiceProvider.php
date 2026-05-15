<?php

namespace App\Providers;

use App\Models\Appointment;
use App\Models\ClientProfile;
use App\Models\Dog;
use App\Models\HomeAccess;
use App\Models\Invoice;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\VaccinationRecord;
use App\Observers\AuditObserver;
use App\Mail\ResendTransport;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Database\Connectors\SqlServerConnector;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Fix SQL Server PDO: remove ATTR_STRINGIFY_FETCHES which isn't supported
        $this->app->bind('db.connector.sqlsrv', function () {
            return new class extends SqlServerConnector {
                protected $options = [
                    \PDO::ATTR_CASE => \PDO::CASE_NATURAL,
                    \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                    \PDO::ATTR_ORACLE_NULLS => \PDO::NULL_NATURAL,
                ];
            };
        });
    }

    public function boot(): void
    {
        // Register custom Resend API mail transport (bypasses SMTP)
        Mail::extend('resend', function () {
            return new ResendTransport(config('services.resend.key'));
        });
        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }

        // Point password reset links to the frontend, not the API
        ResetPassword::createUrlUsing(function ($user, string $token) {
            $frontendUrl = rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/');
            return "{$frontendUrl}/reset-password/{$token}?email=" . urlencode($user->email);
        });

        // Branded password reset email matching the other system templates
        ResetPassword::toMailUsing(function ($notifiable, string $token) {
            $frontendUrl = rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/');
            $url = "{$frontendUrl}/reset-password/{$token}?email=" . urlencode($notifiable->email);
            $expiryMinutes = (int) config('auth.passwords.password-resets.expire', 240);
            $hours = max(1, (int) round($expiryMinutes / 60));

            return (new MailMessage)
                ->subject('Reset your password — The Pupper Club')
                ->view('emails.password-reset', [
                    'name'  => $notifiable->name,
                    'url'   => $url,
                    'hours' => $hours,
                ]);
        });

        // Register audit logging on key models
        User::observe(AuditObserver::class);
        Dog::observe(AuditObserver::class);
        Appointment::observe(AuditObserver::class);
        Invoice::observe(AuditObserver::class);
        ServiceRequest::observe(AuditObserver::class);
        VaccinationRecord::observe(AuditObserver::class);
        ClientProfile::observe(AuditObserver::class);
        HomeAccess::observe(AuditObserver::class);
    }
}

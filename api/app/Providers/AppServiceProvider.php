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
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }

        // Point password reset links to the frontend, not the API
        ResetPassword::createUrlUsing(function ($user, string $token) {
            $frontendUrl = rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/');
            return "{$frontendUrl}/reset-password/{$token}?email=" . urlencode($user->email);
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

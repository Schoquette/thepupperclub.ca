<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientProfile extends Model
{
    protected $fillable = [
        'user_id',
        'phone',
        'address',
        'city',
        'province',
        'postal_code',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_relationship',
        'secondary_contact_name',
        'secondary_contact_email',
        'secondary_contact_phone',
        'secondary_notify_messages',
        'secondary_notify_report_cards',
        'secondary_notify_billing',
        'secondary_notify_appointments',
        'vet_clinic_name',
        'vet_phone',
        'vet_address',
        'billing_method',
        'food_storage_location',
        'customized_care_options',
        'preferred_update_method',
        'report_detail_level',
        'preferred_walk_days',
        'preferred_walk_length',
        'preferred_walk_times',
        'what_great_care_looks_like',
        'biggest_concern',
        'comfort_factors',
        'referral_source',
        'additional_notes',
        'subscription_tier',
        'subscription_plan',
        'subscription_amount',
        'walks_per_week',
        'subscription_start_date',
        'next_billing_date',
        'billing_day',
        'subscription_end_date',
        'subscription_paused_from',
        'subscription_paused_until',
        'pause_billing',
        'prorate_on_resume',
        'stripe_customer_id',
        'stripe_payment_method_id',
        'stripe_subscription_id',
        'stripe_price_id',
        'notes',
        'onboarding_completed_at',
        'intake_submitted_at',
        'profile_confirmed_at',
        'notify_app',
        'notify_email',
        'notify_sms',
        'notification_preferences',
    ];

    protected function casts(): array
    {
        return [
            'subscription_start_date'       => 'date',
            'next_billing_date'             => 'date',
            'subscription_end_date'         => 'date',
            'subscription_paused_from'      => 'date',
            'subscription_paused_until'     => 'date',
            'pause_billing'                 => 'boolean',
            'prorate_on_resume'             => 'boolean',
            'subscription_amount'           => 'decimal:2',
            'onboarding_completed_at'       => 'datetime',
            'intake_submitted_at'           => 'datetime',
            'profile_confirmed_at'          => 'datetime',
            'customized_care_options'       => 'array',
            'preferred_update_method'       => 'array',
            'preferred_walk_days'           => 'array',
            'preferred_walk_times'          => 'array',
            'secondary_notify_messages'     => 'boolean',
            'secondary_notify_report_cards' => 'boolean',
            'secondary_notify_billing'      => 'boolean',
            'secondary_notify_appointments' => 'boolean',
            'notify_app'                    => 'boolean',
            'notify_email'                  => 'boolean',
            'notify_sms'                    => 'boolean',
            'notification_preferences'      => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

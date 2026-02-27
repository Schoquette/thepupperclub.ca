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
        'subscription_start_date',
        'next_billing_date',
        'subscription_end_date',
        'stripe_customer_id',
        'stripe_payment_method_id',
        'notes',
        'onboarding_completed_at',
        'intake_submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'subscription_start_date'       => 'date',
            'next_billing_date'             => 'date',
            'subscription_end_date'         => 'date',
            'subscription_amount'           => 'decimal:2',
            'onboarding_completed_at'       => 'datetime',
            'intake_submitted_at'           => 'datetime',
            'customized_care_options'       => 'array',
            'preferred_update_method'       => 'array',
            'preferred_walk_days'           => 'array',
            'preferred_walk_times'          => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

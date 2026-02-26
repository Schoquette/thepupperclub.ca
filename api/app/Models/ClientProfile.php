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
        'billing_method',
        'subscription_tier',
        'subscription_start_date',
        'subscription_end_date',
        'stripe_customer_id',
        'notes',
        'onboarding_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'subscription_start_date' => 'date',
            'subscription_end_date'   => 'date',
            'onboarding_completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OnboardingStep extends Model
{
    protected $fillable = [
        'user_id',
        'step',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
        ];
    }

    public static function allSteps(): array
    {
        return [
            'set_password',
            'welcome',
            'profile',
            'home_access',
            'dog_profiles',
            'payment',
            'agreement',
            'confirmation',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

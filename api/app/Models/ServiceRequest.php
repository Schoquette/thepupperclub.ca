<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ServiceRequest extends Model
{
    protected $fillable = [
        'user_id',
        'service_type',
        'preferred_time_block',
        'preferred_date',
        'notes',
        'status',
        'admin_response',
        'counter_time_block',
        'counter_date',
    ];

    protected function casts(): array
    {
        return [
            'preferred_date' => 'date',
            'counter_date'   => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function dogs(): BelongsToMany
    {
        return $this->belongsToMany(Dog::class, 'service_request_dog');
    }
}

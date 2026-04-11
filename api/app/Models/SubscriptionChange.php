<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionChange extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'changed_by',
        'action',
        'old_plan',
        'old_amount',
        'new_plan',
        'new_amount',
        'effective_date',
        'proration_amount',
        'notes',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'old_amount'        => 'decimal:2',
            'new_amount'        => 'decimal:2',
            'effective_date'    => 'date',
            'proration_amount'  => 'decimal:2',
            'created_at'        => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function changedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}

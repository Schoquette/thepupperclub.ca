<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CalendarBlock extends Model
{
    /**
     * Output dates without timezone suffix — the frontend treats all
     * calendar times as Pacific regardless (matches Appointment).
     */
    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d\TH:i:s');
    }

    protected $fillable = [
        'title',
        'location',
        'scheduled_time',
        'duration_minutes',
        'assigned_to',
        'created_by',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_time' => 'datetime',
        ];
    }

    public function assignedAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

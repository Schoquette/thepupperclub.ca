<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Appointment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'assigned_to',
        'service_type',
        'status',
        'scheduled_time',
        'client_time_block',
        'duration_minutes',
        'notes',
        'recurrence_rule',
        'recurrence_parent_id',
        'check_in_time',
        'check_out_time',
        'pre_visit_notification_sent',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_time'               => 'datetime',
            'check_in_time'                => 'datetime',
            'check_out_time'               => 'datetime',
            'recurrence_rule'              => 'array',
            'pre_visit_notification_sent'  => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignedAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function dogs(): BelongsToMany
    {
        return $this->belongsToMany(Dog::class);
    }

    public function recurrenceParent(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'recurrence_parent_id');
    }

    public function visitReport(): HasOne
    {
        return $this->hasOne(VisitReport::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class, 'appointment_id');
    }
}

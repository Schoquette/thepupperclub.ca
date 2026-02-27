<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class VisitReport extends Model
{
    protected $fillable = [
        'appointment_id',
        'user_id',
        'arrival_time',
        'departure_time',
        'checklist',
        'special_trip_details',
        'report_photo_path',
        'notes',
        'sent_at',
        'email_sent_at',
        // Legacy fields (kept for backward compat)
        'eliminated',
        'ate_well',
        'drank_water',
        'mood',
        'energy_level',
        'distance_km',
        'photo_paths',
    ];

    protected function casts(): array
    {
        return [
            'arrival_time'   => 'datetime',
            'departure_time' => 'datetime',
            'checklist'      => 'array',
            'sent_at'        => 'datetime',
            'email_sent_at'  => 'datetime',
            // Legacy
            'eliminated'     => 'boolean',
            'ate_well'       => 'boolean',
            'drank_water'    => 'boolean',
            'distance_km'    => 'decimal:2',
            'photo_paths'    => 'array',
        ];
    }

    public function getPhotoUrlsAttribute(): array
    {
        return collect($this->photo_paths ?? [])
            ->map(fn($path) => Storage::url($path))
            ->all();
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

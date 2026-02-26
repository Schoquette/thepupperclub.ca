<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class VisitReport extends Model
{
    protected $fillable = [
        'appointment_id',
        'eliminated',
        'ate_well',
        'drank_water',
        'mood',
        'energy_level',
        'distance_km',
        'notes',
        'photo_paths',
    ];

    protected function casts(): array
    {
        return [
            'eliminated'  => 'boolean',
            'ate_well'    => 'boolean',
            'drank_water' => 'boolean',
            'distance_km' => 'decimal:2',
            'photo_paths' => 'array',
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
}

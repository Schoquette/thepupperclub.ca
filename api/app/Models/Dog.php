<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Dog extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'breed',
        'date_of_birth',
        'size',
        'sex',
        'weight_kg',
        'colour',
        'microchip_number',
        'spayed_neutered',
        'bite_history',
        'bite_history_notes',
        'aggression_notes',
        'vet_name',
        'vet_phone',
        'vet_address',
        'medications',
        'special_instructions',
        'photo_path',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth'   => 'date',
            'weight_kg'       => 'decimal:2',
            'spayed_neutered' => 'boolean',
            'bite_history'    => 'boolean',
            'is_active'       => 'boolean',
            'medications'     => 'array',
        ];
    }

    public function getPhotoUrlAttribute(): ?string
    {
        return $this->photo_path ? Storage::url($this->photo_path) : null;
    }

    public function getHasExpiredVaccinationsAttribute(): bool
    {
        return $this->vaccinationRecords()
            ->where('expiry_date', '<', now()->toDateString())
            ->exists();
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function vaccinationRecords(): HasMany
    {
        return $this->hasMany(VaccinationRecord::class);
    }
}

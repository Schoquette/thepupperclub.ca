<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VaccinationRecord extends Model
{
    protected $fillable = [
        'dog_id',
        'vaccine_name',
        'administered_date',
        'expiry_date',
        'document_path',
    ];

    protected function casts(): array
    {
        return [
            'administered_date' => 'date',
            'expiry_date'       => 'date',
        ];
    }

    public function getIsExpiredAttribute(): bool
    {
        return $this->expiry_date && $this->expiry_date->isPast();
    }

    public function dog(): BelongsTo
    {
        return $this->belongsTo(Dog::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CommunityPet extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'member_id',
        'species',
        'species_other',
        'name',
        'photo_path',
        'age_years',
        'sex',
        'spayed_neutered',
        'notes',
        'care_instructions',
        'species_data',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'spayed_neutered' => 'boolean',
            'species_data'    => 'array',
            'age_years'       => 'integer',
            'sort_order'      => 'integer',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'member_id');
    }

    /**
     * Lightweight shape for API responses. Excludes raw storage paths;
     * photo is exposed as a relative URL the client can fetch with a
     * bearer token.
     */
    public function publicShape(): array
    {
        return [
            'id'                => $this->id,
            'species'           => $this->species,
            'species_other'     => $this->species_other,
            'name'              => $this->name,
            'photo_url'         => $this->photo_path ? "/api/community/pets/{$this->id}/photo" : null,
            'age_years'         => $this->age_years,
            'sex'               => $this->sex,
            'spayed_neutered'   => $this->spayed_neutered,
            'notes'             => $this->notes,
            'care_instructions' => $this->care_instructions,
            'species_data'      => $this->species_data ?? [],
            'sort_order'        => $this->sort_order,
        ];
    }
}

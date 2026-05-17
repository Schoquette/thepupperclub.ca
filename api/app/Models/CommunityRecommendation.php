<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CommunityRecommendation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'author_id',
        'subject_id',
        'body',
        'hidden',
    ];

    protected function casts(): array
    {
        return [
            'hidden' => 'boolean',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'author_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'subject_id');
    }
}

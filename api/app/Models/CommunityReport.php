<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityReport extends Model
{
    protected $fillable = [
        'reporter_id',
        'reported_id',
        'category',
        'details',
        'reviewed_at',
        'reviewed_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
        ];
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'reporter_id');
    }

    public function reported(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'reported_id');
    }
}

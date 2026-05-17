<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CommunityBroadcast extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'sender_id',
        'care_type',
        'starts_at',
        'duration_minutes',
        'context',
        'status',
        'closed_with_recipient_id',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'sender_id');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(CommunityBroadcastRecipient::class, 'broadcast_id');
    }

    public function closedWith(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'closed_with_recipient_id');
    }
}

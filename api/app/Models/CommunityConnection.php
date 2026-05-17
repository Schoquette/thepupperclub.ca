<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CommunityConnection extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'requester_id',
        'recipient_id',
        'status',
        'note',
        'responded_at',
    ];

    protected function casts(): array
    {
        return [
            'responded_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'requester_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'recipient_id');
    }

    public function involves(int $memberId): bool
    {
        return $this->requester_id === $memberId || $this->recipient_id === $memberId;
    }

    public function otherParty(int $memberId): ?int
    {
        if ($this->requester_id === $memberId) return $this->recipient_id;
        if ($this->recipient_id === $memberId) return $this->requester_id;
        return null;
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityBroadcastRecipient extends Model
{
    protected $table = 'community_broadcast_recipients';

    protected $fillable = [
        'broadcast_id',
        'recipient_id',
        'status',
        'responded_at',
    ];

    protected function casts(): array
    {
        return [
            'responded_at' => 'datetime',
        ];
    }

    public function broadcast(): BelongsTo
    {
        return $this->belongsTo(CommunityBroadcast::class, 'broadcast_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'recipient_id');
    }
}

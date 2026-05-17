<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CommunityConversation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'member_a_id',
        'member_b_id',
        'last_message_at',
        'unread_count_a',
        'unread_count_b',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'unread_count_a'  => 'integer',
            'unread_count_b'  => 'integer',
        ];
    }

    public function memberA(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'member_a_id');
    }

    public function memberB(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'member_b_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(CommunityChatMessage::class, 'conversation_id');
    }

    public function involves(int $memberId): bool
    {
        return $this->member_a_id === $memberId || $this->member_b_id === $memberId;
    }

    public function otherPartyFor(int $memberId): ?int
    {
        if ($this->member_a_id === $memberId) return $this->member_b_id;
        if ($this->member_b_id === $memberId) return $this->member_a_id;
        return null;
    }

    /** Resolve / create the conversation between two members (order-independent). */
    public static function between(int $memberId1, int $memberId2): self
    {
        $a = min($memberId1, $memberId2);
        $b = max($memberId1, $memberId2);
        return self::firstOrCreate(
            ['member_a_id' => $a, 'member_b_id' => $b],
        );
    }

    /** Bump the per-side unread counter for whoever is NOT the sender. */
    public function incrementUnreadFor(int $recipientId): void
    {
        if ($recipientId === $this->member_a_id) {
            $this->increment('unread_count_a');
        } else {
            $this->increment('unread_count_b');
        }
    }

    public function clearUnreadFor(int $memberId): void
    {
        if ($memberId === $this->member_a_id) {
            $this->update(['unread_count_a' => 0]);
        } else {
            $this->update(['unread_count_b' => 0]);
        }
    }

    public function unreadCountFor(int $memberId): int
    {
        return $memberId === $this->member_a_id ? $this->unread_count_a : $this->unread_count_b;
    }
}

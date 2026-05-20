<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityInvite extends Model
{
    use HasFactory;

    protected $fillable = [
        'inviter_id',
        'email',
        'note',
        'status',
        'accepted_member_id',
        'sent_at',
        'accepted_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at'     => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'inviter_id');
    }

    public function acceptedMember(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'accepted_member_id');
    }
}

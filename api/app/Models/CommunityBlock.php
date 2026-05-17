<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityBlock extends Model
{
    protected $fillable = ['blocker_id', 'blocked_id', 'reason'];

    public function blocker(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'blocker_id');
    }

    public function blocked(): BelongsTo
    {
        return $this->belongsTo(CommunityMember::class, 'blocked_id');
    }

    /**
     * Return the set of member ids that the given member should never be
     * matched with — anyone they've blocked OR anyone who has blocked them.
     */
    public static function silentIdsFor(int $memberId): array
    {
        return self::query()
            ->where('blocker_id', $memberId)
            ->pluck('blocked_id')
            ->merge(
                self::query()->where('blocked_id', $memberId)->pluck('blocker_id'),
            )
            ->unique()
            ->values()
            ->all();
    }
}

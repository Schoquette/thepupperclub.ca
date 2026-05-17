<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityBlock;
use App\Models\CommunityConnection;
use App\Models\CommunityMember;
use App\Models\CommunityRecommendation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MembersController extends Controller
{
    /**
     * GET /api/community/members/{id}
     *
     * Returns the public-facing profile of another verified member,
     * provided the requester is on an accepted-connection edge with them.
     * No connection edge → 404, never a "private" hint.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $other = CommunityMember::find($id);
        if (!$other || $other->status !== 'verified') {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if ($other->id !== $me->id) {
            // A block in either direction hides the profile.
            $blocked = CommunityBlock::query()
                ->where(function ($q) use ($me, $other) {
                    $q->where(function ($q2) use ($me, $other) {
                        $q2->where('blocker_id', $me->id)->where('blocked_id', $other->id);
                    })->orWhere(function ($q2) use ($me, $other) {
                        $q2->where('blocker_id', $other->id)->where('blocked_id', $me->id);
                    });
                })
                ->exists();
            if ($blocked) {
                return response()->json(['message' => 'Not found.'], 404);
            }

            $connected = CommunityConnection::query()
                ->where('status', 'accepted')
                ->where(function ($q) use ($me, $other) {
                    $q->where(fn ($q2) => $q2->where('requester_id', $me->id)->where('recipient_id', $other->id));
                    $q->orWhere(fn ($q2) => $q2->where('requester_id', $other->id)->where('recipient_id', $me->id));
                })
                ->exists();
            if (!$connected) {
                return response()->json(['message' => 'Not found.'], 404);
            }
        }

        // Recommendations visible to other members: not hidden by the
        // subject. Authors come along for display.
        $recs = CommunityRecommendation::query()
            ->where('subject_id', $other->id)
            ->where('hidden', false)
            ->with('author:id,name')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (CommunityRecommendation $r) => [
                'id'           => $r->id,
                'body'         => $r->body,
                'author_id'    => $r->author_id,
                'author_name'  => $r->author ? $this->displayName((string) $r->author->name) : 'Unknown',
                'created_at'   => $r->created_at?->toIso8601String(),
                'mine'         => $r->author_id === $me->id,
            ]);

        // If looking at our own profile, include hidden recs too (we wrote
        // them ourselves OR we hid them as the subject) — labelled so the UI
        // can show the "Hidden from profile" affordance.
        $hiddenForMe = [];
        if ($other->id === $me->id) {
            $hiddenForMe = CommunityRecommendation::query()
                ->where('subject_id', $me->id)
                ->where('hidden', true)
                ->with('author:id,name')
                ->orderByDesc('created_at')
                ->limit(50)
                ->get()
                ->map(fn (CommunityRecommendation $r) => [
                    'id'           => $r->id,
                    'body'         => $r->body,
                    'author_id'    => $r->author_id,
                    'author_name'  => $r->author ? $this->displayName((string) $r->author->name) : 'Unknown',
                    'created_at'   => $r->created_at?->toIso8601String(),
                    'hidden'       => true,
                ])
                ->all();
        }

        // What the requester has authored for this subject (so the form
        // can prefill in edit mode).
        $myRecommendation = null;
        if ($other->id !== $me->id) {
            $mine = CommunityRecommendation::query()
                ->where('author_id', $me->id)
                ->where('subject_id', $other->id)
                ->first();
            if ($mine) {
                $myRecommendation = [
                    'id'   => $mine->id,
                    'body' => $mine->body,
                ];
            }
        }

        return response()->json([
            'data' => [
                'id'              => $other->id,
                'display_name'    => $this->displayName((string) $other->name),
                'introduction'    => $other->introduction,
                'availability'    => $other->availability ?? [],
                'is_self'         => $other->id === $me->id,
                'recommendations' => $recs,
                'hidden_recommendations' => $hiddenForMe,
                'my_recommendation'      => $myRecommendation,
            ],
        ]);
    }

    private function displayName(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        if (count($parts) === 1) return $parts[0];
        $first    = $parts[0];
        $lastInit = strtoupper(substr(end($parts), 0, 1));
        return "{$first} {$lastInit}.";
    }
}

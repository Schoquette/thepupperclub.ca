<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityBlock;
use App\Models\CommunityConnection;
use App\Models\CommunityMember;
use App\Services\GeohashService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NeighboursController extends Controller
{
    public function __construct(private GeohashService $geohash) {}

    /**
     * GET /api/community/neighbours
     *
     * Returns verified members near the requesting member. We filter by
     * geohash prefix (cell + 8 adjacent cells), then refine with a real
     * distance bucket. Addresses and exact coordinates are never returned.
     *
     * Excludes:
     *   - the requester themselves
     *   - members with an existing connection edge in either direction
     *     (so connected/declined/removed people don't reappear in the feed)
     */
    public function index(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        // Verification is an optional trust signal, not a gate. Suspended /
        // closed accounts are filtered out below; everyone else is welcome
        // to browse and be browsed. A `verified` flag rides along on each
        // row so the UI can render a soft badge.
        if (!$me->geohash) {
            return response()->json(['data' => [], 'message' => 'Add your address in your profile to see neighbours.'], 200);
        }

        $cells = $this->geohash->neighbourCells($me->geohash);

        // Members whose geohash prefix is one of our neighbour cells. We
        // match on the full geohash equality because both sides store the
        // same precision; if precisions diverge later we'd switch to a
        // LIKE prefix query.
        $candidatesQ = CommunityMember::query()
            ->where('id', '!=', $me->id)
            ->whereIn('status', ['pending_verification', 'verified'])
            ->whereIn('geohash', $cells);

        // Drop anyone the requester already has a connection edge with.
        // We pull the small list of "involved" ids and exclude them.
        $relatedIds = CommunityConnection::query()
            ->where(function ($q) use ($me) {
                $q->where('requester_id', $me->id)->orWhere('recipient_id', $me->id);
            })
            ->pluck('requester_id', 'recipient_id')
            ->keys()
            ->merge(
                CommunityConnection::query()
                    ->where(function ($q) use ($me) {
                        $q->where('requester_id', $me->id)->orWhere('recipient_id', $me->id);
                    })
                    ->pluck('recipient_id', 'requester_id')
                    ->keys(),
            )
            ->reject(fn ($id) => $id === $me->id)
            ->unique()
            ->values()
            ->all();

        if ($relatedIds) {
            $candidatesQ->whereNotIn('id', $relatedIds);
        }

        // Apply block filter: anyone blocked-by or blocking the requester
        // is silently absent from discovery.
        $silentIds = CommunityBlock::silentIdsFor($me->id);
        if ($silentIds) {
            $candidatesQ->whereNotIn('id', $silentIds);
        }

        // Pet counts by species let us show a non-identifying summary
        // ("1 dog · 1 cat") on each anonymous browse card.
        $candidates = $candidatesQ->withCount([
            'pets as pets_dog_count'   => fn ($q) => $q->where('species', 'dog'),
            'pets as pets_cat_count'   => fn ($q) => $q->where('species', 'cat'),
            'pets as pets_other_count' => fn ($q) => $q->where('species', 'other'),
        ])->limit(50)->get();

        $myCentre = $this->geohash->decode($me->geohash);
        $rows = [];
        foreach ($candidates as $c) {
            $cCentre = $this->geohash->decode((string) $c->geohash);
            if ($cCentre === null) continue;
            $distance = $this->geohash->distanceMeters($myCentre, $cCentre);
            if ($distance > ($me->radius_meters ?? 1000) * 1.5) continue; // generous slack

            // Anonymous browse shape — no name, no photo, no pet names.
            // Viewer sees intro / availability / care info / distance and
            // pet *counts* by species so they can decide whether to send a
            // connect request. Identifying info unlocks only after the
            // request is accepted.
            $rows[] = [
                'id'                => $c->id,
                'introduction'      => $c->introduction,
                'availability'      => $c->availability ?? [],
                'need_availability' => $c->need_availability ?? [],
                'care_offered'      => $c->care_offered ?? [],
                'care_needed'       => $c->care_needed ?? [],
                'verified'          => $c->status === 'verified',
                'distance_label'    => $this->geohash->distanceBucket($distance),
                'distance_sort'     => (int) $distance,
                'pets_summary'      => [
                    'dog'   => (int) $c->pets_dog_count,
                    'cat'   => (int) $c->pets_cat_count,
                    'other' => (int) $c->pets_other_count,
                ],
            ];
        }

        usort($rows, fn ($a, $b) => $a['distance_sort'] <=> $b['distance_sort']);
        foreach ($rows as &$r) unset($r['distance_sort']);

        return response()->json(['data' => $rows]);
    }
}

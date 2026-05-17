<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
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

        if ($me->status !== 'verified') {
            return response()->json(['data' => [], 'message' => 'Verify your account to see neighbours.'], 200);
        }
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
            ->where('status', 'verified')
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

        $candidates = $candidatesQ->limit(50)->get();

        $myCentre = $this->geohash->decode($me->geohash);
        $rows = [];
        foreach ($candidates as $c) {
            $cCentre = $this->geohash->decode((string) $c->geohash);
            if ($cCentre === null) continue;
            $distance = $this->geohash->distanceMeters($myCentre, $cCentre);
            if ($distance > ($me->radius_meters ?? 1000) * 1.5) continue; // generous slack
            $rows[] = [
                'id'              => $c->id,
                'display_name'    => $this->displayName((string) $c->name),
                'introduction'    => $c->introduction,
                'availability'    => $c->availability ?? [],
                'distance_label'  => $this->geohash->distanceBucket($distance),
                'distance_sort'   => (int) $distance,
            ];
        }

        usort($rows, fn ($a, $b) => $a['distance_sort'] <=> $b['distance_sort']);
        // Strip the sort key before returning.
        foreach ($rows as &$r) unset($r['distance_sort']);

        return response()->json(['data' => $rows]);
    }

    private function displayName(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        if (count($parts) === 1) return $parts[0];
        $first   = $parts[0];
        $lastInit = strtoupper(substr(end($parts), 0, 1));
        return "{$first} {$lastInit}.";
    }
}

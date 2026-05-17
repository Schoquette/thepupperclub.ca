<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityConnection;
use App\Models\CommunityMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConnectionsController extends Controller
{
    /**
     * GET /api/community/connections
     *
     * Returns three lists for the network screen:
     *   incoming — pending requests where I'm the recipient
     *   outgoing — pending requests I sent
     *   accepted — connections that are active
     */
    public function index(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $shape = function (CommunityConnection $c, int $otherId) {
            /** @var CommunityMember|null $other */
            $other = CommunityMember::find($otherId);
            return [
                'id'           => $c->id,
                'status'       => $c->status,
                'note'         => $c->note,
                'created_at'   => $c->created_at?->toIso8601String(),
                'member'       => $other ? [
                    'id'           => $other->id,
                    'display_name' => $this->displayName((string) $other->name),
                    'introduction' => $other->introduction,
                    'availability' => $other->availability ?? [],
                ] : null,
            ];
        };

        $incoming = CommunityConnection::query()
            ->where('recipient_id', $me->id)
            ->where('status', 'pending')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($c) => $shape($c, $c->requester_id))
            ->values();

        $outgoing = CommunityConnection::query()
            ->where('requester_id', $me->id)
            ->where('status', 'pending')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($c) => $shape($c, $c->recipient_id))
            ->values();

        $accepted = CommunityConnection::query()
            ->where(function ($q) use ($me) {
                $q->where('requester_id', $me->id)->orWhere('recipient_id', $me->id);
            })
            ->where('status', 'accepted')
            ->orderByDesc('responded_at')
            ->get()
            ->map(fn ($c) => $shape($c, $c->otherParty($me->id) ?? 0))
            ->values();

        return response()->json([
            'incoming' => $incoming,
            'outgoing' => $outgoing,
            'accepted' => $accepted,
        ]);
    }

    /**
     * POST /api/community/connections
     */
    public function store(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $data = $request->validate([
            'recipient_id' => 'required|integer|exists:community_members,id|different:' . $me->id,
            'note'         => 'nullable|string|max:280',
        ]);

        if ($me->status !== 'verified') {
            return response()->json(['message' => 'Verify your account before sending connection requests.'], 403);
        }

        // Don't create a new request if any edge already exists between us
        // in either direction. Soft-deleted rows don't count.
        $existing = CommunityConnection::query()
            ->where(function ($q) use ($me, $data) {
                $q->where(function ($q2) use ($me, $data) {
                    $q2->where('requester_id', $me->id)->where('recipient_id', $data['recipient_id']);
                })->orWhere(function ($q2) use ($me, $data) {
                    $q2->where('requester_id', $data['recipient_id'])->where('recipient_id', $me->id);
                });
            })
            ->first();

        if ($existing) {
            return response()->json(['message' => 'A connection already exists with this neighbour.', 'data' => $existing], 409);
        }

        $connection = CommunityConnection::create([
            'requester_id' => $me->id,
            'recipient_id' => $data['recipient_id'],
            'note'         => $data['note'] ?? null,
            'status'       => 'pending',
        ]);

        return response()->json(['data' => $connection], 201);
    }

    /**
     * PATCH /api/community/connections/{connection}
     * body: { action: "accept" | "decline" }
     */
    public function update(Request $request, CommunityConnection $connection): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if ($connection->recipient_id !== $me->id || $connection->status !== 'pending') {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $data = $request->validate([
            'action' => 'required|in:accept,decline',
        ]);

        $connection->forceFill([
            'status'       => $data['action'] === 'accept' ? 'accepted' : 'declined',
            'responded_at' => now(),
        ])->save();

        return response()->json(['data' => $connection->fresh()]);
    }

    /**
     * DELETE /api/community/connections/{connection}
     * Silently remove an accepted connection (or cancel a pending one I sent).
     */
    public function destroy(Request $request, CommunityConnection $connection): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if (!$connection->involves($me->id)) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if ($connection->status === 'accepted') {
            $connection->forceFill([
                'status' => 'removed',
            ])->save();
        }
        $connection->delete(); // soft-delete

        return response()->json(['message' => 'Removed.']);
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

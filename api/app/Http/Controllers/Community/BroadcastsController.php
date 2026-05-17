<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityBroadcast;
use App\Models\CommunityBroadcastRecipient;
use App\Models\CommunityConnection;
use App\Models\CommunityMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BroadcastsController extends Controller
{
    /**
     * GET /api/community/broadcasts/outgoing
     */
    public function outgoing(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $broadcasts = CommunityBroadcast::query()
            ->where('sender_id', $me->id)
            ->with(['recipients.recipient'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $data = $broadcasts->map(function (CommunityBroadcast $b) {
            $byStatus = $b->recipients->groupBy('status');
            return [
                'id'                 => $b->id,
                'care_type'          => $b->care_type,
                'starts_at'          => $b->starts_at?->toIso8601String(),
                'duration_minutes'   => $b->duration_minutes,
                'context'            => $b->context,
                'status'             => $b->status,
                'closed_at'          => $b->closed_at?->toIso8601String(),
                'recipients_total'   => $b->recipients->count(),
                'recipients_confirmed' => ($byStatus->get('confirmed')?->count() ?? 0),
                'recipients_declined'  => ($byStatus->get('declined')?->count() ?? 0),
                'recipients_pending'   => ($byStatus->get('pending')?->count() ?? 0),
                // Sender CAN see who confirmed (so they can pick one to
                // close with), but cannot see who hasn't responded.
                'confirmed_members'  => $byStatus->get('confirmed')?->map(fn ($r) => [
                    'id'           => $r->recipient->id,
                    'display_name' => $this->displayName((string) $r->recipient->name),
                ])->values() ?? [],
            ];
        });

        return response()->json(['data' => $data]);
    }

    /**
     * GET /api/community/broadcasts/incoming
     */
    public function incoming(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $rows = CommunityBroadcastRecipient::query()
            ->where('recipient_id', $me->id)
            ->whereHas('broadcast', fn ($q) => $q->where('status', 'open'))
            ->with(['broadcast.sender'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $data = $rows->map(function (CommunityBroadcastRecipient $r) {
            $b = $r->broadcast;
            return [
                'id'               => $b->id, // broadcast id (the resource action uses this)
                'recipient_row_id' => $r->id, // recipient join row, for the respond action
                'care_type'        => $b->care_type,
                'starts_at'        => $b->starts_at?->toIso8601String(),
                'duration_minutes' => $b->duration_minutes,
                'context'          => $b->context,
                'status'           => $r->status, // recipient's own status
                'sender'           => [
                    'id'           => $b->sender->id ?? null,
                    'display_name' => $b->sender ? $this->displayName((string) $b->sender->name) : 'Unknown',
                ],
            ];
        });

        return response()->json(['data' => $data]);
    }

    /**
     * POST /api/community/broadcasts
     */
    public function store(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $data = $request->validate([
            'care_type'        => 'required|in:walk,drop_in,overnight,other',
            'starts_at'        => 'required|date',
            'duration_minutes' => 'required|integer|min:5|max:1440',
            'context'          => 'nullable|string|max:1000',
            'recipient_ids'    => 'required|array|min:1|max:20',
            'recipient_ids.*'  => 'integer|exists:community_members,id',
        ]);

        // Only members from the sender's accepted-connections list can be
        // recipients. Anyone else is silently dropped — this avoids
        // confusing "blocked" / "not connected" error messages.
        $allowedIds = CommunityConnection::query()
            ->where('status', 'accepted')
            ->where(function ($q) use ($me) {
                $q->where('requester_id', $me->id)->orWhere('recipient_id', $me->id);
            })
            ->get()
            ->map(fn ($c) => $c->otherParty($me->id))
            ->filter()
            ->unique()
            ->all();

        $recipientIds = array_values(array_intersect(
            $data['recipient_ids'],
            $allowedIds,
        ));

        if (!$recipientIds) {
            return response()->json([
                'message' => 'Recipients must be neighbours you’re already connected with.',
            ], 422);
        }

        $broadcast = DB::transaction(function () use ($me, $data, $recipientIds) {
            $b = CommunityBroadcast::create([
                'sender_id'        => $me->id,
                'care_type'        => $data['care_type'],
                'starts_at'        => $data['starts_at'],
                'duration_minutes' => $data['duration_minutes'],
                'context'          => $data['context'] ?? null,
                'status'           => 'open',
            ]);

            foreach ($recipientIds as $rid) {
                CommunityBroadcastRecipient::create([
                    'broadcast_id' => $b->id,
                    'recipient_id' => $rid,
                    'status'       => 'pending',
                ]);
            }
            return $b;
        });

        return response()->json(['data' => $broadcast->load('recipients')], 201);
    }

    /**
     * PATCH /api/community/broadcasts/{broadcast}/respond
     * body: { action: confirm | decline }
     */
    public function respond(Request $request, CommunityBroadcast $broadcast): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $data = $request->validate(['action' => 'required|in:confirm,decline']);

        if ($broadcast->status !== 'open') {
            return response()->json(['message' => 'This broadcast is closed.'], 409);
        }

        $row = CommunityBroadcastRecipient::query()
            ->where('broadcast_id', $broadcast->id)
            ->where('recipient_id', $me->id)
            ->first();

        if (!$row) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $row->forceFill([
            'status'       => $data['action'] === 'confirm' ? 'confirmed' : 'declined',
            'responded_at' => now(),
        ])->save();

        return response()->json(['data' => $row->fresh()]);
    }

    /**
     * PATCH /api/community/broadcasts/{broadcast}/close
     * body: { confirmed_with_id?: int }   // optional: which recipient took the job
     */
    public function close(Request $request, CommunityBroadcast $broadcast): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if ($broadcast->sender_id !== $me->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $data = $request->validate([
            'confirmed_with_id' => 'nullable|integer|exists:community_members,id',
        ]);

        $broadcast->forceFill([
            'status'                   => 'closed',
            'closed_at'                => now(),
            'closed_with_recipient_id' => $data['confirmed_with_id'] ?? null,
        ])->save();

        return response()->json(['data' => $broadcast->fresh()]);
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

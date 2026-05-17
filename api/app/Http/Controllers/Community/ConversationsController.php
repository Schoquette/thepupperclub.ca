<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityChatMessage;
use App\Models\CommunityConnection;
use App\Models\CommunityConversation;
use App\Models\CommunityMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConversationsController extends Controller
{
    /**
     * GET /api/community/conversations
     *
     * Returns the requester's conversations, each with the other member's
     * shape, a last-message preview, and the unread count for this side.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $rows = CommunityConversation::query()
            ->where(function ($q) use ($me) {
                $q->where('member_a_id', $me->id)->orWhere('member_b_id', $me->id);
            })
            ->whereNotNull('last_message_at')
            ->orderByDesc('last_message_at')
            ->limit(100)
            ->get();

        // Hydrate the other member + last message in one go.
        $otherIds = $rows->map(fn ($c) => $c->otherPartyFor($me->id))->filter()->unique()->all();
        $members  = CommunityMember::whereIn('id', $otherIds)->get()->keyBy('id');
        $lastMessages = CommunityChatMessage::query()
            ->whereIn('conversation_id', $rows->pluck('id'))
            ->orderByDesc('id')
            ->get()
            ->groupBy('conversation_id')
            ->map(fn ($g) => $g->first());

        $data = $rows->map(function (CommunityConversation $c) use ($me, $members, $lastMessages) {
            $otherId = $c->otherPartyFor($me->id);
            $other   = $otherId ? $members->get($otherId) : null;
            $lm      = $lastMessages->get($c->id);
            return [
                'id'              => $c->id,
                'other_id'        => $otherId,
                'other_name'      => $other ? $this->displayName((string) $other->name) : 'Unknown',
                'last_message'    => $lm ? mb_substr($lm->body, 0, 120) : null,
                'last_message_at' => $c->last_message_at?->toIso8601String(),
                'unread_count'    => $c->unreadCountFor($me->id),
            ];
        });

        return response()->json(['data' => $data]);
    }

    /**
     * GET /api/community/conversations/{otherId}
     *
     * Resolves or creates the conversation with the given other member and
     * returns the message thread. Also clears the unread count on read.
     */
    public function thread(Request $request, int $otherId): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if ($otherId === $me->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        // Both parties must be on an accepted connection edge. Anything
        // less and we don't surface the thread at all (the route literally
        // looks like the conversation doesn't exist).
        if (!$this->areConnected($me->id, $otherId)) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $convo = CommunityConversation::between($me->id, $otherId);

        $messages = $convo->messages()
            ->orderBy('id')
            ->limit(500)
            ->get()
            ->map(fn (CommunityChatMessage $m) => [
                'id'         => $m->id,
                'sender_id'  => $m->sender_id,
                'is_self'    => $m->sender_id === $me->id,
                'body'       => $m->body,
                'created_at' => $m->created_at?->toIso8601String(),
                'read_at'    => $m->read_at?->toIso8601String(),
            ]);

        $convo->clearUnreadFor($me->id);

        $other = CommunityMember::find($otherId);

        return response()->json([
            'conversation' => [
                'id'         => $convo->id,
                'other_id'   => $otherId,
                'other_name' => $other ? $this->displayName((string) $other->name) : 'Unknown',
            ],
            'messages' => $messages,
        ]);
    }

    /**
     * POST /api/community/conversations/{otherId}/messages
     */
    public function send(Request $request, int $otherId): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if (!$this->areConnected($me->id, $otherId)) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $data = $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        $message = DB::transaction(function () use ($me, $otherId, $data) {
            $convo = CommunityConversation::between($me->id, $otherId);

            $m = $convo->messages()->create([
                'sender_id' => $me->id,
                'body'      => $data['body'],
            ]);

            $convo->forceFill(['last_message_at' => now()])->save();
            $convo->incrementUnreadFor($otherId);

            return $m;
        });

        return response()->json([
            'data' => [
                'id'         => $message->id,
                'sender_id'  => $message->sender_id,
                'is_self'    => true,
                'body'       => $message->body,
                'created_at' => $message->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    private function areConnected(int $a, int $b): bool
    {
        return CommunityConnection::query()
            ->where('status', 'accepted')
            ->where(function ($q) use ($a, $b) {
                $q->where(fn ($q2) => $q2->where('requester_id', $a)->where('recipient_id', $b));
                $q->orWhere(fn ($q2) => $q2->where('requester_id', $b)->where('recipient_id', $a));
            })
            ->exists();
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

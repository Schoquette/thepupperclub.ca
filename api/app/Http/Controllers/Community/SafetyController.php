<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityBlock;
use App\Models\CommunityConnection;
use App\Models\CommunityConversation;
use App\Models\CommunityMember;
use App\Models\CommunityReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SafetyController extends Controller
{
    /**
     * GET /api/community/blocks — list neighbours I've blocked.
     */
    public function listBlocks(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $rows = CommunityBlock::query()
            ->where('blocker_id', $me->id)
            ->with('blocked:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(function (CommunityBlock $b) {
                return [
                    'id'           => $b->id,
                    'member_id'    => $b->blocked_id,
                    'display_name' => $b->blocked ? $this->displayName((string) $b->blocked->name) : 'Unknown',
                    'reason'       => $b->reason,
                    'created_at'   => $b->created_at?->toIso8601String(),
                ];
            });

        return response()->json(['data' => $rows]);
    }

    /**
     * POST /api/community/blocks
     * body: { member_id: int, reason?: string }
     *
     * Side effects (deliberate, silent to the other party):
     *   - any existing connection edge is soft-deleted
     *   - the shared conversation is soft-deleted so we drop the thread
     *     from both sides' Messages list
     */
    public function block(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $data = $request->validate([
            'member_id' => 'required|integer|exists:community_members,id|different:' . $me->id,
            'reason'    => 'nullable|string|max:280',
        ]);

        DB::transaction(function () use ($me, $data) {
            CommunityBlock::updateOrCreate(
                ['blocker_id' => $me->id, 'blocked_id' => $data['member_id']],
                ['reason' => $data['reason'] ?? null],
            );

            // Drop any connection edge between us.
            CommunityConnection::query()
                ->where(function ($q) use ($me, $data) {
                    $q->where('requester_id', $me->id)->where('recipient_id', $data['member_id']);
                })
                ->orWhere(function ($q) use ($me, $data) {
                    $q->where('requester_id', $data['member_id'])->where('recipient_id', $me->id);
                })
                ->delete();

            // Drop the shared conversation so it disappears from both
            // Messages lists. The blocked party sees nothing change visibly
            // — they just stop receiving messages from this person.
            $a = min($me->id, (int) $data['member_id']);
            $b = max($me->id, (int) $data['member_id']);
            CommunityConversation::query()
                ->where('member_a_id', $a)->where('member_b_id', $b)
                ->delete();
        });

        return response()->json(['message' => 'Blocked.']);
    }

    /**
     * DELETE /api/community/blocks/{block}
     */
    public function unblock(Request $request, CommunityBlock $block): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if ($block->blocker_id !== $me->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $block->delete();

        return response()->json(['message' => 'Unblocked.']);
    }

    /**
     * POST /api/community/reports
     */
    public function report(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $data = $request->validate([
            'member_id' => 'required|integer|exists:community_members,id|different:' . $me->id,
            'category'  => 'required|in:uncomfortable,harassment,spam_or_scam,animal_safety,other',
            'details'   => 'nullable|string|max:2000',
        ]);

        $report = CommunityReport::create([
            'reporter_id' => $me->id,
            'reported_id' => $data['member_id'],
            'category'    => $data['category'],
            'details'     => $data['details'] ?? null,
        ]);

        return response()->json(['data' => $report], 201);
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

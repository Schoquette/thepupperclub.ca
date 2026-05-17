<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityConnection;
use App\Models\CommunityMember;
use App\Models\CommunityRecommendation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecommendationsController extends Controller
{
    /**
     * POST /api/community/recommendations
     * Upsert — one rec per (author, subject), edited in place after that.
     */
    public function upsert(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $data = $request->validate([
            'subject_id' => 'required|integer|exists:community_members,id|different:' . $me->id,
            'body'       => 'required|string|max:320',
        ]);

        // Must be on an accepted-connection edge with the subject.
        $connected = CommunityConnection::query()
            ->where('status', 'accepted')
            ->where(function ($q) use ($me, $data) {
                $q->where(fn ($q2) => $q2->where('requester_id', $me->id)->where('recipient_id', $data['subject_id']));
                $q->orWhere(fn ($q2) => $q2->where('requester_id', $data['subject_id'])->where('recipient_id', $me->id));
            })
            ->exists();

        if (!$connected) {
            return response()->json(['message' => 'You can only recommend connected neighbours.'], 403);
        }

        $rec = CommunityRecommendation::updateOrCreate(
            ['author_id' => $me->id, 'subject_id' => $data['subject_id']],
            ['body' => trim($data['body'])],
        );

        return response()->json(['data' => $rec->fresh()]);
    }

    /**
     * DELETE /api/community/recommendations/{recommendation}
     * Authors can delete their own. Subjects can't delete (only hide).
     */
    public function destroy(Request $request, CommunityRecommendation $recommendation): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if ($recommendation->author_id !== $me->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $recommendation->delete();

        return response()->json(['message' => 'Removed.']);
    }

    /**
     * PATCH /api/community/recommendations/{recommendation}/visibility
     * body: { hidden: true|false }
     *
     * Only the *subject* of a recommendation can toggle visibility. The
     * author is not notified (recipient-controlled, per spec).
     */
    public function visibility(Request $request, CommunityRecommendation $recommendation): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if ($recommendation->subject_id !== $me->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $data = $request->validate(['hidden' => 'required|boolean']);
        $recommendation->forceFill(['hidden' => $data['hidden']])->save();

        return response()->json(['data' => $recommendation->fresh()]);
    }
}

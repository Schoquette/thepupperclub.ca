<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityMember;
use App\Services\GeohashService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProfileController extends Controller
{
    public function __construct(private GeohashService $geohash) {}

    /**
     * PATCH /api/community/profile
     *
     * Accepts any subset of the editable profile fields. If `address` is
     * provided, we geocode it to a coarse geohash and persist only the
     * geohash — the address itself is never stored.
     */
    public function update(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        $careOptions = ['dog_walk', 'drop_in', 'overnight', 'multi_day'];

        $availabilityOptions = ['mornings', 'evenings', 'weekends', 'weekdays', 'ad_hoc'];

        $data = $request->validate([
            'name'                => 'sometimes|string|max:255',
            'introduction'        => 'sometimes|nullable|string|max:600',
            'availability'        => 'sometimes|nullable|array',
            'availability.*'      => 'string|in:' . implode(',', $availabilityOptions),
            'need_availability'   => 'sometimes|nullable|array',
            'need_availability.*' => 'string|in:' . implode(',', $availabilityOptions),
            'care_offered'        => 'sometimes|nullable|array',
            'care_offered.*'      => 'string|in:' . implode(',', $careOptions),
            'care_needed'         => 'sometimes|nullable|array',
            'care_needed.*'       => 'string|in:' . implode(',', $careOptions),
            'radius_meters'       => 'sometimes|integer|min:250|max:15000',
            'address'             => 'sometimes|nullable|string|max:500',
        ]);

        $updates = [];

        foreach (['name', 'introduction', 'availability', 'need_availability', 'care_offered', 'care_needed', 'radius_meters'] as $field) {
            if (array_key_exists($field, $data)) {
                $updates[$field] = $data[$field];
            }
        }

        // Address → geohash. We deliberately don't keep the address itself.
        if (array_key_exists('address', $data) && $data['address']) {
            $gh = $this->geohash->geocodeToGeohash($data['address'], 6);
            if (!$gh) {
                return response()->json([
                    'message' => 'We couldn’t locate that address. Please double-check the spelling, or include the city.',
                ], 422);
            }
            $updates['geohash'] = $gh;
        }

        if ($updates) {
            $member->forceFill($updates)->save();
        }

        return response()->json(['data' => $member->fresh()]);
    }

    /**
     * POST /api/community/profile/photo  (multipart, field: photo)
     * Replaces the member's own photo. Old file is deleted.
     */
    public function uploadPhoto(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        $request->validate([
            'photo' => 'required|file|image|max:8192',
        ]);
        $file = $request->file('photo');
        $ext = strtolower($file->getClientOriginalExtension());
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
        abort_unless(in_array($ext, $allowed, true), 422, 'Unsupported image type.');

        $newPath = $file->store("community_members/{$member->id}", 'local');
        $old = $member->photo_path;
        $member->forceFill(['photo_path' => $newPath])->save();
        if ($old && $old !== $newPath) {
            Storage::disk('local')->delete($old);
        }

        return response()->json(['data' => ['photo_url' => "/api/community/members/{$member->id}/photo"]]);
    }

    /**
     * DELETE /api/community/profile/photo
     */
    public function removePhoto(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');
        if ($member->photo_path) Storage::disk('local')->delete($member->photo_path);
        $member->forceFill(['photo_path' => null])->save();
        return response()->json(['message' => 'Photo removed.']);
    }

    /**
     * GET /api/community/members/{member}/photo
     * Connection-gated photo serving.
     */
    public function servePhoto(Request $request, CommunityMember $member): StreamedResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if (!$member->photo_path || !Storage::disk('local')->exists($member->photo_path)) {
            abort(404);
        }

        if ($member->id !== $me->id) {
            $allowed = \App\Models\CommunityConnection::query()
                ->where('status', 'accepted')
                ->where(function ($q) use ($me, $member) {
                    $q->where(fn ($q2) => $q2->where('requester_id', $me->id)->where('recipient_id', $member->id));
                    $q->orWhere(fn ($q2) => $q2->where('requester_id', $member->id)->where('recipient_id', $me->id));
                })
                ->exists();
            $blocked = \App\Models\CommunityBlock::query()
                ->where(function ($q) use ($me, $member) {
                    $q->where(fn ($q2) => $q2->where('blocker_id', $me->id)->where('blocked_id', $member->id));
                    $q->orWhere(fn ($q2) => $q2->where('blocker_id', $member->id)->where('blocked_id', $me->id));
                })
                ->exists();
            if (!$allowed || $blocked) abort(404);
        }

        return Storage::disk('local')->response($member->photo_path);
    }
}

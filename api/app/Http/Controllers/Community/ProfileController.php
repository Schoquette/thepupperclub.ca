<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityMember;
use App\Services\GeohashService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $careOptions = ['dog_walk', 'drop_in', 'overnight', 'multi_day', 'companionship'];

        $data = $request->validate([
            'name'           => 'sometimes|string|max:255',
            'introduction'   => 'sometimes|nullable|string|max:600',
            'availability'   => 'sometimes|nullable|array',
            'availability.*' => 'string|in:mornings,evenings,weekends,weekdays,ad_hoc',
            'care_offered'   => 'sometimes|nullable|array',
            'care_offered.*' => 'string|in:' . implode(',', $careOptions),
            'care_needed'    => 'sometimes|nullable|array',
            'care_needed.*'  => 'string|in:' . implode(',', $careOptions),
            'radius_meters'  => 'sometimes|integer|min:250|max:15000',
            'address'        => 'sometimes|nullable|string|max:500',
        ]);

        $updates = [];

        foreach (['name', 'introduction', 'availability', 'care_offered', 'care_needed', 'radius_meters'] as $field) {
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
}

<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityMember;
use App\Models\CommunityPet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PetsController extends Controller
{
    /**
     * POST /api/community/pets
     * Multipart: name, species, species_other?, age_years?, sex?,
     * spayed_neutered?, notes?, care_instructions?, species_data? (json),
     * photo? (file).
     */
    public function store(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        $data = $this->validatePet($request, false);

        $pet = new CommunityPet($data);
        $pet->member_id = $me->id;

        if ($request->hasFile('photo')) {
            $pet->photo_path = $this->storePhoto($request->file('photo'), $me->id);
        }

        $pet->save();

        return response()->json(['data' => $pet->publicShape()], 201);
    }

    /**
     * PATCH /api/community/pets/{pet}
     */
    public function update(Request $request, CommunityPet $pet): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if ($pet->member_id !== $me->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $data = $this->validatePet($request, true);

        $pet->fill($data);

        if ($request->hasFile('photo')) {
            $old = $pet->photo_path;
            $pet->photo_path = $this->storePhoto($request->file('photo'), $me->id);
            if ($old) Storage::disk('local')->delete($old);
        } elseif ($request->boolean('remove_photo')) {
            if ($pet->photo_path) Storage::disk('local')->delete($pet->photo_path);
            $pet->photo_path = null;
        }

        $pet->save();

        return response()->json(['data' => $pet->publicShape()]);
    }

    /**
     * DELETE /api/community/pets/{pet}
     */
    public function destroy(Request $request, CommunityPet $pet): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if ($pet->member_id !== $me->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if ($pet->photo_path) Storage::disk('local')->delete($pet->photo_path);
        $pet->delete();

        return response()->json(['message' => 'Removed.']);
    }

    /**
     * GET /api/community/pets/{pet}/photo
     * Connection-gated photo serving. Self always allowed; otherwise must
     * be on an accepted-connection edge with the pet's owner. Blocks
     * (either direction) hide the photo.
     */
    public function photo(Request $request, CommunityPet $pet): StreamedResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if (!$pet->photo_path || !Storage::disk('local')->exists($pet->photo_path)) {
            abort(404);
        }

        if ($pet->member_id !== $me->id && !$this->canSee($me->id, $pet->member_id)) {
            abort(404);
        }

        return Storage::disk('local')->response($pet->photo_path);
    }

    private function validatePet(Request $request, bool $partial): array
    {
        $rules = [
            'species'           => ($partial ? 'sometimes|' : '') . 'required|in:dog,cat,other',
            'species_other'     => 'nullable|string|max:60',
            'name'              => ($partial ? 'sometimes|' : '') . 'required|string|max:80',
            'age_years'         => 'nullable|integer|min:0|max:50',
            'sex'               => 'nullable|in:male,female,unknown',
            'spayed_neutered'   => 'nullable|boolean',
            'notes'             => 'nullable|string|max:1000',
            'care_instructions' => 'nullable|string|max:1500',
            'species_data'      => 'nullable',
            'photo'             => 'nullable|file|image|max:8192',
            'remove_photo'      => 'nullable|boolean',
            'sort_order'        => 'nullable|integer|min:0|max:999',
        ];

        $data = $request->validate($rules);

        // species_data may arrive as a JSON string (FormData) — normalise.
        if (isset($data['species_data']) && is_string($data['species_data'])) {
            $decoded = json_decode($data['species_data'], true);
            $data['species_data'] = is_array($decoded) ? $decoded : null;
        }

        // Drop fields we don't persist directly on the model.
        unset($data['photo'], $data['remove_photo']);

        return $data;
    }

    private function storePhoto(\Illuminate\Http\UploadedFile $file, int $memberId): string
    {
        $ext = strtolower($file->getClientOriginalExtension());
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
        if (!in_array($ext, $allowed, true)) {
            abort(422, 'Unsupported image type.');
        }
        return $file->store("community_pets/{$memberId}", 'local');
    }

    private function canSee(int $viewerId, int $ownerId): bool
    {
        // Defer to MembersController's logic by inlining the same checks:
        // requester must be on an accepted-connection edge AND not blocked
        // either direction.
        $blocked = \App\Models\CommunityBlock::query()
            ->where(function ($q) use ($viewerId, $ownerId) {
                $q->where(fn ($q2) => $q2->where('blocker_id', $viewerId)->where('blocked_id', $ownerId));
                $q->orWhere(fn ($q2) => $q2->where('blocker_id', $ownerId)->where('blocked_id', $viewerId));
            })
            ->exists();
        if ($blocked) return false;

        return \App\Models\CommunityConnection::query()
            ->where('status', 'accepted')
            ->where(function ($q) use ($viewerId, $ownerId) {
                $q->where(fn ($q2) => $q2->where('requester_id', $viewerId)->where('recipient_id', $ownerId));
                $q->orWhere(fn ($q2) => $q2->where('requester_id', $ownerId)->where('recipient_id', $viewerId));
            })
            ->exists();
    }
}

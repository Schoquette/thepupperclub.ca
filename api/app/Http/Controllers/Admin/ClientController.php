<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientDocument;
use App\Models\HomeAccess;
use App\Models\OnboardingStep;
use App\Models\User;
use App\Services\InviteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ClientController extends Controller
{
    public function __construct(private InviteService $inviteService) {}

    public function index(Request $request): JsonResponse
    {
        $query = User::where('role', 'client')
            ->with('clientProfile')
            ->withCount(['dogs', 'appointments']);

        if ($request->filter === 'pending') {
            $query->where('status', 'pending');
        } elseif ($request->filter === 'active') {
            $query->where('status', 'active');
        }

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('email', 'like', "%{$request->search}%");
            });
        }

        return response()->json($query->paginate(20));
    }

    public function show(User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        return response()->json([
            'data' => $client->load([
                'clientProfile',
                'dogs.vaccinationRecords',
                'documents',
                'onboardingSteps',
            ]),
        ]);
    }

    public function update(Request $request, User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        $data = $request->validate([
            'name'   => 'sometimes|string|max:255',
            'status' => 'sometimes|in:active,inactive,pending',
            'profile.phone'                   => 'sometimes|nullable|string',
            'profile.address'                 => 'sometimes|nullable|string',
            'profile.city'                    => 'sometimes|nullable|string',
            'profile.province'                => 'sometimes|nullable|string|max:2',
            'profile.postal_code'             => 'sometimes|nullable|string|max:7',
            'profile.emergency_contact_name'  => 'sometimes|nullable|string',
            'profile.emergency_contact_phone' => 'sometimes|nullable|string',
            'profile.billing_method'          => 'sometimes|in:credit_card,e_transfer,cash',
            'profile.subscription_tier'       => 'sometimes|nullable|string',
            'profile.subscription_start_date' => 'sometimes|nullable|date',
            'profile.subscription_end_date'   => 'sometimes|nullable|date',
            'profile.notes'                   => 'sometimes|nullable|string',
        ]);

        $client->update(array_filter(['name' => $data['name'] ?? null, 'status' => $data['status'] ?? null]));

        if (isset($data['profile'])) {
            $client->clientProfile()->updateOrCreate(['user_id' => $client->id], $data['profile']);
        }

        return response()->json(['data' => $client->fresh('clientProfile')]);
    }

    public function invite(Request $request): JsonResponse
    {
        $request->validate([
            'name'  => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
        ]);

        $user = $this->inviteService->invite($request->name, $request->email);

        return response()->json(['data' => $user, 'message' => 'Invitation sent.'], 201);
    }

    public function createDraft(Request $request): JsonResponse
    {
        $request->validate([
            'name'  => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
        ]);

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => bcrypt(Str::random(32)),
            'role'     => 'client',
            'status'   => 'pending',
        ]);

        return response()->json(['data' => $user], 201);
    }

    public function resendInvite(User $client): JsonResponse
    {
        $this->ensureIsClient($client);
        $this->inviteService->resend($client);
        return response()->json(['message' => 'Invitation resent.']);
    }

    public function resetPassword(User $client): JsonResponse
    {
        $this->ensureIsClient($client);
        $this->inviteService->resetPassword($client);
        return response()->json(['message' => 'Password reset email sent.']);
    }

    public function pending(): JsonResponse
    {
        $clients = User::where('role', 'client')
            ->where('status', 'pending')
            ->with('clientProfile')
            ->get();

        return response()->json(['data' => $clients]);
    }

    // ── Home Access ───────────────────────────────────────────────────────────

    public function homeAccess(User $client): JsonResponse
    {
        $this->ensureIsClient($client);
        return response()->json(['data' => $client->homeAccess]);
    }

    public function updateHomeAccess(Request $request, User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        $data = $request->validate([
            'entry_instructions'  => 'nullable|string',
            'lockbox_code'        => 'nullable|string',
            'door_code'           => 'nullable|string',
            'alarm_code'          => 'nullable|string',
            'key_location'        => 'nullable|string',
            'parking_instructions'=> 'nullable|string',
            'notes'               => 'nullable|string',
        ]);

        $homeAccess = HomeAccess::updateOrCreate(['user_id' => $client->id], $data);

        return response()->json(['data' => $homeAccess]);
    }

    // ── Documents ─────────────────────────────────────────────────────────────

    public function documents(User $client): JsonResponse
    {
        $this->ensureIsClient($client);
        return response()->json(['data' => $client->documents()->with('dog')->get()]);
    }

    public function uploadDocument(Request $request, User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        $request->validate([
            'file'   => 'required|file|mimes:pdf,jpg,jpeg,png,heic,docx|max:10240',
            'type'   => 'required|in:vaccination_record,vet_record,service_agreement,liability_waiver,other',
            'dog_id' => 'nullable|exists:dogs,id',
        ]);

        $file = $request->file('file');
        $path = $file->store('private/documents', 'local');

        $doc = $client->documents()->create([
            'dog_id'      => $request->dog_id,
            'type'        => $request->type,
            'filename'    => $file->getClientOriginalName(),
            'mime_type'   => $file->getMimeType(),
            'size_bytes'  => $file->getSize(),
            'storage_path'=> $path,
            'uploaded_by' => 'admin',
        ]);

        return response()->json(['data' => $doc], 201);
    }

    public function deleteDocument(User $client, ClientDocument $document): JsonResponse
    {
        $this->ensureIsClient($client);
        abort_unless($document->user_id === $client->id, 404);

        $document->delete();

        return response()->json(['message' => 'Document deleted.']);
    }

    private function ensureIsClient(User $user): void
    {
        abort_unless($user->role === 'client', 404);
    }
}

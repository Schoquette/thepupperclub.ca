<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ClientDocument;
use App\Models\HomeAccess;
use App\Models\OnboardingStep;
use App\Models\SubscriptionChange;
use App\Models\User;
use App\Services\InviteService;
use App\Services\StripeSubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ClientController extends Controller
{
    public function __construct(
        private InviteService $inviteService,
        private StripeSubscriptionService $subscriptionService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = User::where('role', 'client')
            ->with(['clientProfile', 'dogs:id,user_id,name'])
            ->withCount(['dogs', 'appointments']);

        if ($request->filter === 'pending') {
            $query->where('status', 'pending');
        } elseif ($request->filter === 'active') {
            $query->where('status', 'active');
        } elseif ($request->filter === 'inactive') {
            $query->where('status', 'inactive');
        }

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('email', 'like', "%{$request->search}%");
            });
        }

        $query->orderBy('name', 'asc');

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
            'email'  => 'sometimes|email|unique:users,email,' . $client->id,
            'status' => 'sometimes|in:active,inactive,pending',
            'profile.phone'                    => 'sometimes|nullable|string',
            'profile.address'                  => 'sometimes|nullable|string',
            'profile.city'                     => 'sometimes|nullable|string',
            'profile.province'                 => 'sometimes|nullable|string|max:2',
            'profile.postal_code'              => 'sometimes|nullable|string|max:7',
            'profile.emergency_contact_name'   => 'sometimes|nullable|string',
            'profile.emergency_contact_phone'  => 'sometimes|nullable|string',
            'profile.secondary_contact_name'           => 'sometimes|nullable|string|max:255',
            'profile.secondary_contact_email'          => 'sometimes|nullable|email|max:255',
            'profile.secondary_notify_messages'        => 'sometimes|boolean',
            'profile.secondary_notify_report_cards'    => 'sometimes|boolean',
            'profile.secondary_notify_billing'         => 'sometimes|boolean',
            'profile.secondary_notify_appointments'    => 'sometimes|boolean',
            'profile.notify_app'              => 'sometimes|boolean',
            'profile.notify_email'            => 'sometimes|boolean',
            'profile.notify_sms'              => 'sometimes|boolean',
            'profile.billing_method'          => 'sometimes|in:credit_card,e_transfer,interac_pad,cash',
            'profile.subscription_tier'       => 'sometimes|nullable|string',
            'profile.subscription_plan'       => 'sometimes|nullable|string',
            'profile.subscription_amount'     => 'sometimes|nullable|numeric|min:0',
            'profile.subscription_start_date' => 'sometimes|nullable|date',
            'profile.next_billing_date'       => 'sometimes|nullable|date',
            'profile.subscription_end_date'   => 'sometimes|nullable|date',
            'profile.notes'                   => 'sometimes|nullable|string',
        ]);

        $client->update(array_filter([
            'name'   => $data['name'] ?? null,
            'email'  => $data['email'] ?? null,
            'status' => $data['status'] ?? null,
        ]));

        if (isset($data['profile'])) {
            // Auto-add secondary contact columns if they don't exist yet
            if (!Schema::hasColumn('client_profiles', 'secondary_contact_name')) {
                Schema::table('client_profiles', function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->string('secondary_contact_name')->nullable();
                    $table->string('secondary_contact_email')->nullable();
                    $table->boolean('secondary_notify_messages')->default(false);
                    $table->boolean('secondary_notify_report_cards')->default(false);
                    $table->boolean('secondary_notify_billing')->default(false);
                    $table->boolean('secondary_notify_appointments')->default(false);
                });
            }

            // Auto-add notification preference columns if they don't exist yet
            if (!Schema::hasColumn('client_profiles', 'notify_app')) {
                Schema::table('client_profiles', function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->boolean('notify_app')->default(true);
                    $table->boolean('notify_email')->default(false);
                    $table->boolean('notify_sms')->default(false);
                });
            }

            // Strip any remaining columns that don't exist
            $profileData = collect($data['profile'])->filter(function ($value, $key) {
                return Schema::hasColumn('client_profiles', $key);
            })->all();
            $client->clientProfile()->updateOrCreate(['user_id' => $client->id], $profileData);
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

        AuditLog::recordEvent($request->user(), 'invite_sent', [
            'invited_user' => $user->name,
            'email'        => $user->email,
        ]);

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

    public function resetPassword(Request $request, User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        // If a password is provided, set it directly (useful when email isn't configured)
        if ($request->filled('password')) {
            $request->validate([
                'password' => 'required|string|min:8',
            ]);
            $client->update([
                'password' => Hash::make($request->password),
                'status'   => 'active',
            ]);
            return response()->json(['message' => 'Password set successfully.']);
        }

        // Otherwise send reset email
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
            'file'   => 'required|file|mimes:pdf,doc,docx,jpg,jpeg,png,heic|max:10240',
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

    // ── Subscriptions ─────────────────────────────────────────────────────

    public function subscribe(Request $request, User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        $request->validate([
            'stripe_price_id' => 'required|string',
            'effective_date'  => 'sometimes|nullable|date',
        ]);

        try {
            $result = $this->subscriptionService->subscribe(
                $client,
                $request->stripe_price_id,
                $request->effective_date
            );
        } catch (\Exception $e) {
            return response()->json(['message' => 'Subscription error: ' . $e->getMessage()], 422);
        }

        // Log the plan change
        $profile = $client->fresh('clientProfile')->clientProfile;
        $action = $result['action'] === 'created' ? 'created' : (
            ($result['proration'] ?? 0) > 0 ? 'upgraded' : (
                ($result['proration'] ?? 0) < 0 ? 'downgraded' : 'updated'
            )
        );
        SubscriptionChange::create([
            'user_id'           => $client->id,
            'changed_by'        => $request->user()->id,
            'action'            => $action,
            'old_plan'          => $result['old_plan'] ?? null,
            'old_amount'        => $result['old_amount'] ?? null,
            'new_plan'          => $profile->subscription_plan,
            'new_amount'        => $profile->subscription_amount,
            'effective_date'    => $request->effective_date ?? now()->toDateString(),
            'proration_amount'  => $result['proration'] ?? null,
            'created_at'        => now(),
        ]);

        // Generate proration invoice for mid-cycle plan changes (local billing only)
        if (!empty($result['proration']) && $result['proration'] != 0) {
            try {
                $invoiceService = app(\App\Services\InvoiceService::class);
                $profile = $client->clientProfile;
                $nextBilling = \Carbon\Carbon::parse($profile->next_billing_date);
                $effectiveDate = $request->effective_date
                    ? \Carbon\Carbon::parse($request->effective_date)
                    : now();

                $lineItems = [];
                $proAmount = $result['proration'];

                if ($proAmount > 0) {
                    $lineItems[] = [
                        'description'  => "Plan upgrade adjustment: {$result['old_plan']} → {$profile->subscription_plan} ({$effectiveDate->format('M j')} – {$nextBilling->copy()->subDay()->format('M j, Y')})",
                        'quantity'     => 1,
                        'unit_price'   => $proAmount,
                    ];
                } else {
                    $lineItems[] = [
                        'description'  => "Plan change credit: {$result['old_plan']} → {$profile->subscription_plan} ({$effectiveDate->format('M j')} – {$nextBilling->copy()->subDay()->format('M j, Y')})",
                        'quantity'     => 1,
                        'unit_price'   => $proAmount,
                    ];
                }

                $invoice = $invoiceService->create(
                    $client,
                    $lineItems,
                    $effectiveDate->toDateString(),
                    'Pro-rated adjustment for plan change.',
                    null,
                    $effectiveDate->toDateString(),
                    $nextBilling->copy()->subDay()->toDateString(),
                );

                $invoiceService->send($invoice);
            } catch (\Exception $e) {
                \Log::warning("Failed to create proration invoice for client {$client->id}: {$e->getMessage()}");
            }
        }

        return response()->json([
            'data'    => $client->fresh('clientProfile'),
            'message' => 'Subscription ' . $result['action'] . '.',
        ]);
    }

    public function cancelSubscription(Request $request, User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        $profile = $client->clientProfile;
        $immediate = $request->boolean('immediate', false);

        // Log cancellation before it happens
        SubscriptionChange::create([
            'user_id'        => $client->id,
            'changed_by'     => $request->user()->id,
            'action'         => $immediate ? 'canceled_immediate' : 'canceled',
            'old_plan'       => $profile?->subscription_plan,
            'old_amount'     => $profile?->subscription_amount,
            'effective_date'  => $immediate ? now()->toDateString() : $profile?->next_billing_date,
            'created_at'     => now(),
        ]);

        if ($immediate) {
            $this->subscriptionService->cancelImmediately($client);
        } else {
            $this->subscriptionService->cancel($client);
        }

        return response()->json([
            'data'    => $client->fresh('clientProfile'),
            'message' => $immediate ? 'Subscription canceled.' : 'Subscription will cancel at period end.',
        ]);
    }

    public function pauseSubscription(Request $request, User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        $data = $request->validate([
            'paused_from'      => 'required|date',
            'paused_until'     => 'required|date|after:paused_from',
            'pause_billing'    => 'required|boolean',
            'prorate_on_resume' => 'required|boolean',
        ]);

        $profile = $client->clientProfile;
        abort_unless($profile && ($profile->subscription_plan || $profile->stripe_subscription_id), 422, 'No active subscription to pause.');

        $profile->update([
            'subscription_paused_from'  => $data['paused_from'],
            'subscription_paused_until' => $data['paused_until'],
            'pause_billing'             => $data['pause_billing'],
            'prorate_on_resume'         => $data['prorate_on_resume'],
        ]);

        SubscriptionChange::create([
            'user_id'        => $client->id,
            'changed_by'     => $request->user()->id,
            'action'         => 'paused',
            'old_plan'       => $profile->subscription_plan,
            'new_plan'       => $profile->subscription_plan,
            'old_amount'     => $profile->subscription_amount,
            'new_amount'     => $profile->subscription_amount,
            'effective_date' => $data['paused_from'],
            'notes'          => 'Paused until ' . $data['paused_until']
                . ($data['pause_billing'] ? ' (billing paused)' : ' (billing continues)')
                . ($data['prorate_on_resume'] ? ', prorate on resume' : ''),
            'created_at'     => now(),
        ]);

        return response()->json([
            'data'    => $client->fresh('clientProfile'),
            'message' => 'Subscription paused.',
        ]);
    }

    public function resumeSubscription(Request $request, User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        $profile = $client->clientProfile;
        abort_unless($profile && $profile->subscription_paused_from, 422, 'Subscription is not paused.');

        $pausedFrom = \Carbon\Carbon::parse($profile->subscription_paused_from);
        $pausedUntil = \Carbon\Carbon::parse($profile->subscription_paused_until);
        $pausedDays = $pausedFrom->diffInDays(min($pausedUntil, now()));

        // If billing was paused, push next_billing_date forward by paused days
        if ($profile->pause_billing && $profile->next_billing_date) {
            $newBillingDate = \Carbon\Carbon::parse($profile->next_billing_date)->addDays($pausedDays);
            $profile->update(['next_billing_date' => $newBillingDate]);
        }

        $prorationCredit = null;
        if ($profile->prorate_on_resume && !$profile->pause_billing && $profile->subscription_amount > 0) {
            // Calculate credit for paused days where billing continued
            $dailyRate = (float) $profile->subscription_amount / 30;
            $prorationCredit = round($pausedDays * $dailyRate, 2);
        }

        $profile->update([
            'subscription_paused_from'  => null,
            'subscription_paused_until' => null,
            'pause_billing'             => true,
            'prorate_on_resume'         => false,
        ]);

        SubscriptionChange::create([
            'user_id'          => $client->id,
            'changed_by'       => $request->user()->id,
            'action'           => 'resumed',
            'old_plan'         => $profile->subscription_plan,
            'new_plan'         => $profile->subscription_plan,
            'old_amount'       => $profile->subscription_amount,
            'new_amount'       => $profile->subscription_amount,
            'effective_date'   => now()->toDateString(),
            'proration_amount' => $prorationCredit ? -$prorationCredit : null,
            'notes'            => 'Resumed' . ($prorationCredit ? " with \${$prorationCredit} proration credit" : ''),
            'created_at'       => now(),
        ]);

        // Create proration credit invoice if applicable
        if ($prorationCredit && $prorationCredit > 0) {
            $invoiceService = app(\App\Services\InvoiceService::class);
            $invoice = $invoiceService->create(
                $client,
                [[
                    'description' => "Subscription pause credit ({$pausedDays} days paused)",
                    'quantity'    => 1,
                    'unit_price'  => -$prorationCredit,
                ]],
                now()->toDateString(),
                'Proration credit for subscription pause period.',
            );
            $invoiceService->send($invoice);
        }

        return response()->json([
            'data'             => $client->fresh('clientProfile'),
            'proration_credit' => $prorationCredit,
            'message'          => 'Subscription resumed.' . ($prorationCredit ? " A \${$prorationCredit} credit has been applied." : ''),
        ]);
    }

    public function subscriptionHistory(User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        $changes = SubscriptionChange::where('user_id', $client->id)
            ->with('changedByUser:id,name')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $changes]);
    }

    public function destroy(User $client): JsonResponse
    {
        $this->ensureIsClient($client);

        // Delete all related data so the email can be reused
        $client->dogs()->each(function ($dog) {
            \Illuminate\Support\Facades\Storage::disk('local')->deleteDirectory("dogs/{$dog->id}");
            $dog->vaccinationRecords()->delete();
            $dog->delete();
        });
        $client->documents()->each(function ($doc) {
            if ($doc->storage_path) {
                \Illuminate\Support\Facades\Storage::disk('local')->delete($doc->storage_path);
            }
            $doc->delete();
        });
        $client->appointments()->delete();
        $client->clientProfile()->delete();
        $client->homeAccess()->delete();
        $client->onboardingSteps()->delete();
        $client->subscriptionChanges()->delete();

        // Delete conversations and messages
        $conversation = \App\Models\Conversation::where('user_id', $client->id)->first();
        if ($conversation) {
            $conversation->messages()->delete();
            $conversation->delete();
        }

        // Hard delete the user
        $client->tokens()->delete();
        $client->forceDelete();

        return response()->json(['message' => 'Client deleted.']);
    }

    private function ensureIsClient(User $user): void
    {
        abort_unless($user->role === 'client', 404);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\PushNotification;
use App\Models\ServiceRequest;
use App\Services\AppointmentService;
use App\Services\InvoiceService;
use App\Services\NotificationDispatcher;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class ServiceRequestController extends Controller
{
    public function __construct(
        private AppointmentService $appointmentService,
        private InvoiceService $invoiceService,
        private NotificationDispatcher $dispatcher,
    ) {}

    public function index(): JsonResponse
    {
        $requests = ServiceRequest::with(['user.clientProfile', 'dogs'])
            ->orderByRaw("FIELD(status, 'pending', 'counter_offered', 'approved', 'declined')")
            ->orderBy('preferred_date')
            ->paginate(20);

        return response()->json($requests);
    }

    /**
     * Admin creates a service request on behalf of a client.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id'              => 'required|exists:users,id',
            'service_type'         => 'required|in:walk_30,walk_60,drop_in,overnight,day_boarding',
            'preferred_time_block' => 'required|in:early_morning,morning,midday,afternoon,evening',
            'preferred_date'       => 'required|date',
            'notes'                => 'nullable|string',
            'dog_ids'              => 'required|array|min:1',
            'dog_ids.*'            => 'exists:dogs,id',
        ]);

        $sr = ServiceRequest::create([
            'user_id'              => $data['user_id'],
            'service_type'         => $data['service_type'],
            'preferred_time_block' => $data['preferred_time_block'],
            'preferred_date'       => $data['preferred_date'],
            'notes'                => $data['notes'] ?? null,
            'status'               => 'pending',
            'request_type'         => 'new_visit',
        ]);

        $sr->dogs()->attach($data['dog_ids']);

        return response()->json(['data' => $sr->load(['dogs', 'user'])], 201);
    }

    public function update(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        $this->ensureCounterTimeColumn();

        $data = $request->validate([
            'action'              => 'required|in:approve,decline,counter',
            'admin_response'      => 'nullable|string',
            'counter_time_block'  => 'nullable|in:early_morning,morning,midday,afternoon,evening',
            'counter_time'        => 'nullable|date_format:H:i',
            'counter_date'        => 'required_if:action,counter|date',
            'scheduled_time'      => 'required_if:action,approve|date',
            'billing_type'        => 'nullable|in:included_in_plan,charge',
            'billing_description' => 'nullable|string|max:255',
            'billing_amount'      => 'nullable|numeric|min:0',
        ]);

        $serviceRequest->load(['user.clientProfile', 'dogs']);
        $adminId = $request->user()->id;

        match ($data['action']) {
            'approve' => $this->approve($serviceRequest, $data, $adminId),
            'decline' => $this->decline($serviceRequest, $data, $adminId),
            'counter' => $this->counter($serviceRequest, $data, $adminId),
        };

        return response()->json(['data' => $serviceRequest->fresh()]);
    }

    private function approve(ServiceRequest $serviceRequest, array $data, int $adminId): void
    {
        $serviceRequest->update(['status' => 'approved', 'admin_response' => $data['admin_response'] ?? null]);

        $durations = [
            'walk_30' => 30, 'walk_60' => 60, 'drop_in' => 30,
            'day_boarding' => 480, 'overnight' => 1440,
        ];

        $this->appointmentService->create([
            'user_id'           => $serviceRequest->user_id,
            'dog_ids'           => $serviceRequest->dogs->pluck('id')->all(),
            'service_type'      => $serviceRequest->service_type,
            'scheduled_time'    => $data['scheduled_time'],
            'client_time_block' => $serviceRequest->preferred_time_block,
            'duration_minutes'  => $durations[$serviceRequest->service_type] ?? 30,
            'force'             => true, // Admin already sees conflict warnings in UI
        ]);

        // Add charge to client's next invoice (unless included in plan)
        $billingType = $data['billing_type'] ?? 'included_in_plan';
        if ($billingType === 'charge' && !empty($data['billing_amount']) && $data['billing_amount'] > 0) {
            $this->addChargeToNextInvoice(
                $serviceRequest->user,
                $data['billing_description'] ?? str_replace('_', ' ', $serviceRequest->service_type),
                (float) $data['billing_amount'],
                Carbon::parse($data['scheduled_time'])->toDateString(),
            );
        }

        $scheduledAt = Carbon::parse($data['scheduled_time']);
        $dogNames = $serviceRequest->dogs->pluck('name')->join(' & ');
        $serviceLabel = str_replace('_', ' ', $serviceRequest->service_type);
        $title = 'Request Approved';
        $body = "Great news! Your {$serviceLabel} request for {$dogNames} has been approved and scheduled for {$scheduledAt->format('l, M j \\a\\t g:i A')}.";
        if (!empty($data['admin_response'])) {
            $body .= "\n\nNote: {$data['admin_response']}";
        }

        $this->notifyClient($serviceRequest->user, $title, $body, $adminId);
    }

    /**
     * Add a line item charge to the client's next open invoice, or create a new draft.
     */
    private function addChargeToNextInvoice($client, string $description, float $amount, string $serviceDate): void
    {
        // Find an existing draft/sent invoice for this client
        $invoice = \App\Models\Invoice::where('user_id', $client->id)
            ->whereIn('status', ['draft', 'sent'])
            ->orderBy('created_at', 'desc')
            ->first();

        if ($invoice) {
            // Add line item to existing invoice
            $this->invoiceService->attachLineItems($invoice, [[
                'description'  => $description,
                'quantity'     => 1,
                'unit_price'   => $amount,
                'service_date' => $serviceDate,
            ]]);
            $this->invoiceService->recalculate($invoice);
        } else {
            // Create a new draft invoice
            $this->invoiceService->create(
                $client,
                [[
                    'description'  => $description,
                    'quantity'     => 1,
                    'unit_price'   => $amount,
                    'service_date' => $serviceDate,
                ]],
                null, // due_date — admin can set later
            );
        }
    }

    private function decline(ServiceRequest $serviceRequest, array $data, int $adminId): void
    {
        $serviceRequest->update(['status' => 'declined', 'admin_response' => $data['admin_response']]);

        $dogNames = $serviceRequest->dogs->pluck('name')->join(' & ');
        $serviceLabel = str_replace('_', ' ', $serviceRequest->service_type);
        $title = 'Request Declined';
        $body = "Unfortunately, your {$serviceLabel} request for {$dogNames} on {$serviceRequest->preferred_date->format('M j')} could not be accommodated.";
        if (!empty($data['admin_response'])) {
            $body .= "\n\nNote: {$data['admin_response']}";
        }
        $body .= "\n\nFeel free to submit a new request for a different date or time!";

        $this->notifyClient($serviceRequest->user, $title, $body, $adminId);
    }

    private function counter(ServiceRequest $serviceRequest, array $data, int $adminId): void
    {
        $serviceRequest->update([
            'status'             => 'counter_offered',
            'admin_response'     => $data['admin_response'],
            'counter_time_block' => $data['counter_time_block'] ?? null,
            'counter_time'       => $data['counter_time'] ?? null,
            'counter_date'       => $data['counter_date'],
        ]);

        $dogNames = $serviceRequest->dogs->pluck('name')->join(' & ');
        $serviceLabel = str_replace('_', ' ', $serviceRequest->service_type);
        $counterDate = Carbon::parse($data['counter_date']);
        $timeLabel = !empty($data['counter_time'])
            ? Carbon::createFromFormat('H:i', $data['counter_time'])->format('g:i A')
            : ($data['counter_time_block'] ?? '');

        $title = 'Alternative Time Offered';
        $body = "We'd love to help with your {$serviceLabel} request for {$dogNames}! We have an alternative time available: {$counterDate->format('l, M j')} at {$timeLabel}.";
        if (!empty($data['admin_response'])) {
            $body .= "\n\nNote: {$data['admin_response']}";
        }
        $body .= "\n\nPlease let us know if this works for you!";

        $this->notifyClient($serviceRequest->user, $title, $body, $adminId);
    }

    /**
     * Send notification via conversation message + preferred channels.
     */
    private function notifyClient($user, string $title, string $body, int $adminId): void
    {
        // Store in push notifications
        PushNotification::create([
            'user_id' => $user->id,
            'title'   => $title,
            'body'    => $body,
            'data'    => ['type' => 'service_request'],
            'sent_at' => now(),
        ]);

        // Store in conversation thread
        $conversation = Conversation::firstOrCreate(['user_id' => $user->id]);
        $conversation->messages()->create([
            'sender_id' => $adminId,
            'type'      => 'notification',
            'body'      => $body,
            'metadata'  => [
                'title'           => $title,
                'service_request' => true,
            ],
        ]);

        // Dispatch via client's preferred channels (push, email, SMS)
        $this->dispatcher->notify($user, $title, $body, type: 'service_requests');
    }

    private function ensureCounterTimeColumn(): void
    {
        if (!Schema::hasColumn('service_requests', 'counter_time')) {
            Schema::table('service_requests', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->string('counter_time')->nullable()->after('counter_time_block');
            });
        }
    }
}

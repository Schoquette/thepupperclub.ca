<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ServiceRequest;
use App\Services\AppointmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceRequestController extends Controller
{
    public function __construct(private AppointmentService $appointmentService) {}

    public function index(): JsonResponse
    {
        $requests = ServiceRequest::with(['user.clientProfile', 'dogs'])
            ->orderByRaw("FIELD(status, 'pending', 'counter_offered', 'approved', 'declined')")
            ->orderBy('preferred_date')
            ->paginate(20);

        return response()->json($requests);
    }

    public function update(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        $data = $request->validate([
            'action'              => 'required|in:approve,decline,counter',
            'admin_response'      => 'nullable|string',
            'counter_time_block'  => 'required_if:action,counter|in:early_morning,morning,midday,afternoon,evening',
            'counter_date'        => 'required_if:action,counter|date',
            // approve also needs a scheduled_time for the appointment
            'scheduled_time'      => 'required_if:action,approve|date',
        ]);

        match ($data['action']) {
            'approve' => $this->approve($serviceRequest, $data),
            'decline' => $serviceRequest->update(['status' => 'declined', 'admin_response' => $data['admin_response']]),
            'counter' => $serviceRequest->update([
                'status'             => 'counter_offered',
                'admin_response'     => $data['admin_response'],
                'counter_time_block' => $data['counter_time_block'],
                'counter_date'       => $data['counter_date'],
            ]),
        };

        return response()->json(['data' => $serviceRequest->fresh()]);
    }

    private function approve(ServiceRequest $serviceRequest, array $data): void
    {
        $serviceRequest->update(['status' => 'approved', 'admin_response' => $data['admin_response'] ?? null]);

        // Create the appointment
        $this->appointmentService->create([
            'user_id'           => $serviceRequest->user_id,
            'dog_ids'           => $serviceRequest->dogs->pluck('id')->all(),
            'service_type'      => $serviceRequest->service_type,
            'scheduled_time'    => $data['scheduled_time'],
            'client_time_block' => $serviceRequest->preferred_time_block,
            'duration_minutes'  => 30,
        ]);
    }
}

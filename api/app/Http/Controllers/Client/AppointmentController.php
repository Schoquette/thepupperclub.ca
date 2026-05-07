<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Conversation;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\AdminNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    public function __construct(private AdminNotificationService $adminNotifications) {}

    public function index(Request $request): JsonResponse
    {
        $appointments = $request->user()
            ->appointments()
            ->with('dogs')
            ->when($request->upcoming, fn($q) => $q->where('scheduled_time', '>=', now()))
            ->orderBy('scheduled_time')
            ->get();

        return response()->json(['data' => $appointments]);
    }

    /**
     * Client cancels their own future appointment.
     */
    public function cancel(Request $request, Appointment $appointment): JsonResponse
    {
        $user = $request->user();
        abort_unless($appointment->user_id === $user->id, 403);
        abort_unless($appointment->scheduled_time->isFuture(), 422, 'Cannot cancel a past appointment.');
        abort_if(in_array($appointment->status, ['cancelled', 'completed']), 422, 'Appointment is already ' . $appointment->status . '.');

        $appointment->update(['status' => 'cancelled']);

        $dateStr = $appointment->scheduled_time->format('M j \a\t g:i A');
        $dogNames = $appointment->dogs->pluck('name')->join(', ');
        $body = "{$user->name} cancelled their appointment on {$dateStr} ({$dogNames}).";

        $this->adminNotifications->notifyWithMessage($user, 'Appointment Cancelled', $body);

        return response()->json(['message' => 'Appointment cancelled.']);
    }

    /**
     * Client requests a time change — creates a service request linked to the appointment.
     */
    public function requestTimeChange(Request $request, Appointment $appointment): JsonResponse
    {
        $user = $request->user();
        abort_unless($appointment->user_id === $user->id, 403);
        abort_unless($appointment->scheduled_time->isFuture(), 422, 'Cannot modify a past appointment.');

        $data = $request->validate([
            'preferred_time_block' => 'required|in:early_morning,morning,midday,afternoon,evening',
            'preferred_date'       => 'required|date|after:today',
            'notes'                => 'nullable|string',
        ]);

        $sr = ServiceRequest::create([
            'user_id'              => $user->id,
            'appointment_id'       => $appointment->id,
            'service_type'         => $appointment->service_type,
            'preferred_time_block' => $data['preferred_time_block'],
            'preferred_date'       => $data['preferred_date'],
            'request_type'         => 'time_change',
            'notes'                => trim(
                "Time change request for appointment #{$appointment->id} on "
                . $appointment->scheduled_time->format('M j, Y \a\t g:i A')
                . ($data['notes'] ? "\n\n{$data['notes']}" : '')
            ),
        ]);

        // Attach the same dogs
        $sr->dogs()->attach($appointment->dogs->pluck('id'));

        $dogNames = $appointment->dogs->pluck('name')->join(', ');
        $body = "{$user->name} requested a time change for their "
            . str_replace('_', ' ', $appointment->service_type)
            . " on {$appointment->scheduled_time->format('M j')} ({$dogNames}). New preferred: {$data['preferred_date']}, {$data['preferred_time_block']}.";

        $this->adminNotifications->notifyWithMessage($user, 'Time Change Requested', $body);

        return response()->json(['data' => $sr->load('dogs')], 201);
    }

    /**
     * Client requests a time extension for an appointment.
     */
    public function requestExtension(Request $request, Appointment $appointment): JsonResponse
    {
        $user = $request->user();
        abort_unless($appointment->user_id === $user->id, 403);
        abort_unless($appointment->scheduled_time->isFuture(), 422, 'Cannot modify a past appointment.');

        $data = $request->validate([
            'extra_minutes' => 'required|integer|in:15,30,45,60',
            'notes'         => 'nullable|string',
        ]);

        $dogNames = $appointment->dogs->pluck('name')->join(', ');

        $sr = ServiceRequest::create([
            'user_id'              => $user->id,
            'appointment_id'       => $appointment->id,
            'service_type'         => $appointment->service_type,
            'preferred_time_block' => $appointment->client_time_block ?? 'morning',
            'preferred_date'       => $appointment->scheduled_time->toDateString(),
            'request_type'         => 'extension',
            'notes'                => trim(
                "Extension request: +{$data['extra_minutes']} minutes for appointment on "
                . $appointment->scheduled_time->format('M j, Y \a\t g:i A')
                . " ({$dogNames})"
                . ($data['notes'] ? "\n\n{$data['notes']}" : '')
            ),
        ]);

        $sr->dogs()->attach($appointment->dogs->pluck('id'));

        $body = "{$user->name} requested a {$data['extra_minutes']}-minute extension for their "
            . str_replace('_', ' ', $appointment->service_type)
            . " on {$appointment->scheduled_time->format('M j \a\t g:i A')} ({$dogNames})."
            . ($data['notes'] ? "\nNote: {$data['notes']}" : '');

        $this->adminNotifications->notifyWithMessage($user, 'Time Extension Requested', $body);

        return response()->json(['data' => $sr->load('dogs'), 'message' => 'Extension request sent.'], 201);
    }

    /**
     * Client requests a special service add-on for an appointment.
     */
    public function requestSpecialService(Request $request, Appointment $appointment): JsonResponse
    {
        $user = $request->user();
        abort_unless($appointment->user_id === $user->id, 403);
        abort_unless($appointment->scheduled_time->isFuture(), 422, 'Cannot modify a past appointment.');

        $data = $request->validate([
            'service'  => 'required|in:bring_to_appointment,brush,nail_trim,other',
            'address'  => 'nullable|string|max:500',
            'comments' => 'nullable|string|max:1000',
        ]);

        $serviceLabels = [
            'bring_to_appointment' => 'Bring to Appointment',
            'brush'                => 'Brush',
            'nail_trim'            => 'Nail Trim',
            'other'                => 'Other',
        ];

        $dogNames = $appointment->dogs->pluck('name')->join(', ');
        $label = $serviceLabels[$data['service']] ?? $data['service'];

        $noteLines = ["Special service: {$label} for appointment on "
            . $appointment->scheduled_time->format('M j, Y \a\t g:i A')
            . " ({$dogNames})"];
        if ($data['service'] === 'bring_to_appointment' && $data['address']) {
            $noteLines[] = "Drop-off address: {$data['address']}";
        }
        if ($data['comments']) {
            $noteLines[] = $data['comments'];
        }

        $sr = ServiceRequest::create([
            'user_id'              => $user->id,
            'appointment_id'       => $appointment->id,
            'service_type'         => $appointment->service_type,
            'preferred_time_block' => $appointment->client_time_block ?? 'morning',
            'preferred_date'       => $appointment->scheduled_time->toDateString(),
            'request_type'         => 'special_service',
            'notes'                => implode("\n", $noteLines),
        ]);

        $sr->dogs()->attach($appointment->dogs->pluck('id'));

        $body = "{$user->name} requested \"{$label}\" for their "
            . str_replace('_', ' ', $appointment->service_type)
            . " on {$appointment->scheduled_time->format('M j \a\t g:i A')} ({$dogNames}).";

        if ($data['service'] === 'bring_to_appointment' && $data['address']) {
            $body .= "\nDrop-off address: {$data['address']}";
        }
        if ($data['comments']) {
            $body .= "\nComments: {$data['comments']}";
        }

        $this->adminNotifications->notifyWithMessage($user, 'Special Service Requested', $body);

        return response()->json(['data' => $sr->load('dogs'), 'message' => 'Special service request sent.'], 201);
    }

    // ── Service Requests ─────────────────────────────────────────────────────

    public function serviceRequests(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->serviceRequests()->with('dogs')->orderBy('created_at', 'desc')->get(),
        ]);
    }

    public function storeServiceRequest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'service_type'          => 'required|in:walk_30,walk_60,drop_in,overnight,day_boarding',
            'preferred_time_block'  => 'required|in:early_morning,morning,midday,afternoon,evening',
            'preferred_date'        => 'required|date|after:today',
            'notes'                 => 'nullable|string',
            'dog_ids'               => 'required|array|min:1',
            'dog_ids.*'             => 'exists:dogs,id',
            'addons'                => 'nullable|array',
            'addons.*.service'      => 'required_with:addons|in:bring_to_appointment,brush,nail_trim,other',
            'addons.*.address'      => 'nullable|string|max:500',
            'addons.*.comments'     => 'nullable|string|max:1000',
        ]);

        $user = $request->user();

        // Verify all dogs belong to this client
        $validDogIds = $user->dogs()->whereIn('id', $data['dog_ids'])->pluck('id');
        abort_unless($validDogIds->count() === count($data['dog_ids']), 403, 'Invalid dog IDs.');

        // Build notes including any add-on services
        $notes = $data['notes'] ?? '';
        if (!empty($data['addons'])) {
            $addonLabels = [
                'bring_to_appointment' => 'Bring to Appointment',
                'brush'                => 'Brush',
                'nail_trim'            => 'Nail Trim',
                'other'                => 'Other',
            ];
            $addonLines = [];
            foreach ($data['addons'] as $addon) {
                $label = $addonLabels[$addon['service']] ?? $addon['service'];
                $line  = $label;
                if ($addon['service'] === 'bring_to_appointment' && !empty($addon['address'])) {
                    $line .= " — Address: {$addon['address']}";
                }
                if (!empty($addon['comments'])) {
                    $line .= " — {$addon['comments']}";
                }
                $addonLines[] = $line;
            }
            $notes = trim($notes . "\n\nAdd-on services: " . implode(', ', $addonLines));
        }

        $sr = ServiceRequest::create([
            'user_id'             => $user->id,
            'service_type'        => $data['service_type'],
            'preferred_time_block'=> $data['preferred_time_block'],
            'preferred_date'      => $data['preferred_date'],
            'request_type'        => 'new_visit',
            'notes'               => $notes ?: null,
        ]);

        $sr->dogs()->attach($data['dog_ids']);

        return response()->json(['data' => $sr->load('dogs')], 201);
    }

    public function updateServiceRequest(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        abort_unless($serviceRequest->user_id === $request->user()->id, 403);
        abort_unless($serviceRequest->status === 'pending', 422, 'Only pending requests can be edited.');

        $data = $request->validate([
            'service_type'          => 'required|in:walk_30,walk_60,drop_in,overnight,day_boarding',
            'preferred_time_block'  => 'required|in:early_morning,morning,midday,afternoon,evening',
            'preferred_date'        => 'required|date|after:today',
            'notes'                 => 'nullable|string',
            'dog_ids'               => 'required|array|min:1',
            'dog_ids.*'             => 'exists:dogs,id',
        ]);

        $user = $request->user();
        $validDogIds = $user->dogs()->whereIn('id', $data['dog_ids'])->pluck('id');
        abort_unless($validDogIds->count() === count($data['dog_ids']), 403, 'Invalid dog IDs.');

        $serviceRequest->update([
            'service_type'         => $data['service_type'],
            'preferred_time_block' => $data['preferred_time_block'],
            'preferred_date'       => $data['preferred_date'],
            'notes'                => $data['notes'] ?? null,
        ]);

        $serviceRequest->dogs()->sync($data['dog_ids']);

        return response()->json(['data' => $serviceRequest->load('dogs')]);
    }

    public function destroyServiceRequest(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        abort_unless($serviceRequest->user_id === $request->user()->id, 403);
        abort_unless($serviceRequest->status === 'pending', 422, 'Only pending requests can be cancelled.');

        $serviceRequest->dogs()->detach();
        $serviceRequest->delete();

        return response()->json(['message' => 'Service request cancelled.']);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\User;
use App\Services\AppointmentService;
use App\Services\MileageService;
use App\Services\NotificationDispatcher;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AppointmentController extends Controller
{
    public function __construct(private AppointmentService $service) {}

    public function index(Request $request): JsonResponse
    {
        $hasAssignedTo = Schema::hasColumn('appointments', 'assigned_to');
        $eagerLoads = ['user.clientProfile', 'dogs', 'visitReport'];
        if ($hasAssignedTo) $eagerLoads[] = 'assignedAdmin:id,name';

        $query = Appointment::with($eagerLoads)
            ->when($request->date, fn($q) => $q->whereDate('scheduled_time', $request->date))
            ->when($request->start, fn($q) => $q->where('scheduled_time', '>=', $request->start))
            ->when($request->end, fn($q) => $q->where('scheduled_time', '<=', $request->end))
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($hasAssignedTo && $request->assigned_to, fn($q) => $q->where('assigned_to', $request->assigned_to))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderBy('scheduled_time');

        return response()->json($query->paginate(50));
    }

    public function schedulingStatus(Request $request): JsonResponse
    {
        // Use the exact date sent by frontend (Sunday-based weeks)
        $weekStart = $request->week_start
            ? Carbon::parse($request->week_start)->startOfDay()
            : Carbon::now()->startOfWeek(Carbon::SUNDAY);
        $weekEnd = $weekStart->copy()->addDays(6)->endOfDay();

        // Get active clients with a walks_per_week quota
        $clients = User::where('role', 'client')
            ->whereHas('clientProfile', fn($q) => $q->whereNotNull('walks_per_week')->where('walks_per_week', '>', 0))
            ->with('clientProfile:id,user_id,subscription_plan,walks_per_week,subscription_paused_from,preferred_walk_days,preferred_walk_times')
            ->with('dogs:id,user_id,name')
            ->get();

        // Count scheduled appointments per client for the week
        $counts = Appointment::whereBetween('scheduled_time', [$weekStart, $weekEnd])
            ->whereIn('status', ['scheduled', 'checked_in', 'completed'])
            ->selectRaw('user_id, count(*) as count')
            ->groupBy('user_id')
            ->pluck('count', 'user_id');

        $result = $clients->map(function ($client) use ($counts) {
            $quota = $client->clientProfile->walks_per_week;
            $scheduled = $counts->get($client->id, 0);
            $isPaused = (bool) $client->clientProfile->subscription_paused_from;

            return [
                'user_id'   => $client->id,
                'name'      => $client->name,
                'plan'      => $client->clientProfile->subscription_plan,
                'quota'     => $quota,
                'scheduled' => $scheduled,
                'diff'      => $scheduled - $quota,
                'status'    => $isPaused ? 'paused' : ($scheduled >= $quota ? ($scheduled > $quota ? 'over' : 'ok') : 'under'),
                'dogs'      => $client->dogs->pluck('name')->toArray(),
                'preferred_days'  => $client->clientProfile->preferred_walk_days ?? [],
                'preferred_times' => $client->clientProfile->preferred_walk_times ?? [],
            ];
        })->sortBy('diff')->values();

        return response()->json([
            'data'       => $result,
            'week_start' => $weekStart->format('Y-m-d'),
            'week_end'   => $weekEnd->format('Y-m-d'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $rules = [
            'user_id'          => 'required|exists:users,id',
            'dog_ids'          => 'required|array|min:1',
            'dog_ids.*'        => 'exists:dogs,id',
            'service_type'     => 'required|in:walk_30,walk_60,drop_in,overnight,day_boarding',
            'scheduled_time'   => 'required|date',
            'client_time_block'=> 'required|in:early_morning,morning,midday,afternoon,evening',
            'duration_minutes' => 'required|integer|min:15',
            'notes'            => 'nullable|string',
            'recurrence_rule'  => 'nullable|array',
            'recurrence'       => 'nullable|array',
        ];

        if (Schema::hasColumn('appointments', 'assigned_to')) {
            $rules['assigned_to'] = 'nullable|exists:users,id';
        }

        $data = $request->validate($rules);
        $data['force'] = filter_var($request->input('force', false), FILTER_VALIDATE_BOOLEAN);

        $appointment = $this->service->create($data);

        return response()->json(['data' => $appointment->load(['dogs', 'user'])], 201);
    }

    public function show(Appointment $appointment): JsonResponse
    {
        return response()->json([
            'data' => $appointment->load(['user.clientProfile', 'dogs', 'visitReport']),
        ]);
    }

    public function update(Request $request, Appointment $appointment): JsonResponse
    {
        $rules = [
            'scheduled_time'    => 'sometimes|date',
            'client_time_block' => 'sometimes|in:early_morning,morning,midday,afternoon,evening',
            'service_type'      => 'sometimes|in:walk_30,walk_60,drop_in,overnight,day_boarding',
            'duration_minutes'  => 'sometimes|integer|min:15',
            'dog_ids'           => 'sometimes|array|min:1',
            'dog_ids.*'         => 'exists:dogs,id',
            'status'            => 'sometimes|in:scheduled,checked_in,completed,cancelled',
            'notes'             => 'sometimes|nullable|string',
            'scope'             => 'sometimes|in:single,future_all',
            'notify_client'     => 'sometimes|boolean',
        ];

        if (Schema::hasColumn('appointments', 'assigned_to')) {
            $rules['assigned_to'] = 'sometimes|nullable|exists:users,id';
        }

        $data = $request->validate($rules);

        $scope = $data['scope'] ?? 'single';
        $notifyClient = filter_var($data['notify_client'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $dogIds = $data['dog_ids'] ?? null;
        unset($data['scope'], $data['notify_client'], $data['dog_ids']);

        // Track what changed for the notification message
        $changes = [];
        if (isset($data['scheduled_time']) && $data['scheduled_time'] !== $appointment->scheduled_time?->toIso8601String()) {
            $changes[] = 'time updated to ' . \Carbon\Carbon::parse($data['scheduled_time'])->format('l, M j \a\t g:i A');
        }
        if (isset($data['service_type']) && $data['service_type'] !== $appointment->service_type) {
            $changes[] = 'service changed to ' . str_replace('_', ' ', $data['service_type']);
        }
        if (isset($data['status']) && $data['status'] === 'cancelled') {
            $changes[] = 'appointment cancelled';
        }

        $this->service->update($appointment, $data, $scope);

        // Sync dogs if provided
        if ($dogIds !== null) {
            $appointment->dogs()->sync($dogIds);
        }

        $appointment = $appointment->fresh(['dogs', 'user.clientProfile']);

        // Send notification to client if requested
        if ($notifyClient && $appointment->user) {
            $dogNames = $appointment->dogs->pluck('name')->join(' & ');
            $changeSummary = count($changes) ? implode(', ', $changes) : 'appointment details updated';
            $title = 'Appointment Updated';
            $body = "Hi {$appointment->user->name}, your appointment for {$dogNames} has been updated: {$changeSummary}.";

            app(NotificationDispatcher::class)->notify(
                $appointment->user,
                $title,
                $body,
                type: 'appointment_updates',
            );
        }

        return response()->json(['data' => $appointment]);
    }

    public function destroy(Request $request, Appointment $appointment): JsonResponse
    {
        $scope = $request->scope ?? 'single';
        $this->service->cancel($appointment, $scope);
        return response()->json(['message' => 'Appointment cancelled.']);
    }

    public function checkIn(Appointment $appointment): JsonResponse
    {
        abort_unless($appointment->status === 'scheduled', 422, 'Appointment is not in scheduled state.');

        $appointment->update([
            'status'        => 'checked_in',
            'check_in_time' => now(),
        ]);

        // Send arrival notification
        app(\App\Services\VisitNotificationService::class)->sendArrival($appointment);

        return response()->json(['data' => $appointment->fresh()]);
    }

    public function complete(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($appointment->status === 'checked_in', 422, 'Appointment is not checked in.');

        $data = $request->validate([
            'eliminated'   => 'required|boolean',
            'ate_well'     => 'required|boolean',
            'drank_water'  => 'required|boolean',
            'mood'         => 'required|in:great,good,okay,anxious,unwell',
            'energy_level' => 'required|in:high,normal,low',
            'distance_km'  => 'nullable|numeric|min:0',
            'notes'        => 'nullable|string',
            'photos'       => 'required|array|min:1',
            'photos.*'     => 'required|file|image|max:10240',
        ]);

        $appointment->update([
            'status'         => 'completed',
            'check_out_time' => now(),
        ]);

        $photoPaths = collect($request->file('photos'))
            ->map(fn($photo) => $photo->store('private/photos', 'local'))
            ->all();

        $report = $appointment->visitReport()->create(array_merge(
            $data,
            ['photo_paths' => $photoPaths]
        ));

        // Auto-calculate mileage for the day using Google Maps
        try {
            $teamMemberId = Schema::hasColumn('appointments', 'assigned_to')
                ? $appointment->assigned_to
                : null;
            app(MileageService::class)->recalculateDay(
                $appointment->scheduled_time->copy()->startOfDay(),
                $teamMemberId
            );
            $report->refresh();
        } catch (\Throwable $e) {
            // Don't fail completion if mileage calc fails
            \Illuminate\Support\Facades\Log::warning('Auto-mileage calculation failed', ['error' => $e->getMessage()]);
        }

        return response()->json(['data' => $report]);
    }

    public function report(Appointment $appointment): JsonResponse
    {
        return response()->json(['data' => $appointment->load('visitReport')->visitReport]);
    }

    public function updateReport(Request $request, Appointment $appointment): JsonResponse
    {
        $data = $request->validate([
            'eliminated'   => 'sometimes|boolean',
            'ate_well'     => 'sometimes|boolean',
            'drank_water'  => 'sometimes|boolean',
            'mood'         => 'sometimes|in:great,good,okay,anxious,unwell',
            'energy_level' => 'sometimes|in:high,normal,low',
            'distance_km'  => 'sometimes|nullable|numeric',
            'notes'        => 'sometimes|nullable|string',
        ]);

        $appointment->visitReport()->update($data);

        return response()->json(['data' => $appointment->visitReport]);
    }

    /**
     * Email today's schedule to the requesting admin.
     */
    public function emailSchedule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date' => 'required|date',
        ]);

        $date = Carbon::parse($data['date']);
        $admin = $request->user();

        $appointments = Appointment::with(['user.clientProfile', 'dogs'])
            ->whereDate('scheduled_time', $date)
            ->where('status', '!=', 'cancelled')
            ->orderBy('scheduled_time')
            ->get();

        if ($appointments->isEmpty()) {
            return response()->json(['message' => 'No appointments scheduled for ' . $date->format('l, F j, Y') . '.']);
        }

        $serviceLabels = [
            'walk_30' => '30-min Visit', 'walk_60' => '60-min Visit',
            'drop_in' => 'Drop-in', 'day_boarding' => 'Day Boarding',
            'overnight' => 'Overnight',
        ];

        // Build schedule rows
        $rows = '';
        foreach ($appointments as $appt) {
            $time = $appt->scheduled_time->setTimezone('America/Vancouver')->format('g:i A');
            $endTime = $appt->scheduled_time->copy()->addMinutes($appt->duration_minutes)->setTimezone('America/Vancouver')->format('g:i A');
            $client = $appt->user;
            $dogs = $appt->dogs->pluck('name')->join(', ');
            $service = $serviceLabels[$appt->service_type] ?? ucwords(str_replace('_', ' ', $appt->service_type));
            $address = $client?->clientProfile?->address ?? '';
            $city = $client?->clientProfile?->city ?? '';
            $fullAddress = trim($address . ($city ? ', ' . $city : ''));

            $rows .= '<tr>'
                . '<td style="padding:10px 12px;border-bottom:1px solid #e9e4df;font-size:14px;color:#3B2F2A;white-space:nowrap;"><strong>' . e($time) . '</strong><br><span style="color:#C8BFB6;font-size:12px;">' . e($endTime) . '</span></td>'
                . '<td style="padding:10px 12px;border-bottom:1px solid #e9e4df;font-size:14px;color:#3B2F2A;"><strong>' . e($client?->name ?? '—') . '</strong><br><span style="color:#C8BFB6;font-size:12px;">' . e($dogs) . '</span></td>'
                . '<td style="padding:10px 12px;border-bottom:1px solid #e9e4df;font-size:13px;color:#5a4a44;">' . e($service) . '</td>'
                . '<td style="padding:10px 12px;border-bottom:1px solid #e9e4df;font-size:13px;color:#5a4a44;">' . e($fullAddress) . '</td>'
                . '</tr>';
        }

        $htmlBody = '<p style="font-size:13px;color:#C8BFB6;margin:0 0 4px;">Schedule for</p>'
            . '<p style="font-size:20px;font-weight:700;color:#3B2F2A;margin:0 0 20px;">' . e($date->format('l, F j, Y')) . '</p>'
            . '<p style="font-size:14px;color:#5a4a44;margin:0 0 20px;">' . $appointments->count() . ' appointment' . ($appointments->count() !== 1 ? 's' : '') . '</p>'
            . '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
            . '<thead><tr style="background:#6492D8;">'
            . '<th style="padding:8px 12px;text-align:left;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Time</th>'
            . '<th style="padding:8px 12px;text-align:left;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Client</th>'
            . '<th style="padding:8px 12px;text-align:left;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Service</th>'
            . '<th style="padding:8px 12px;text-align:left;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Address</th>'
            . '</tr></thead><tbody>' . $rows . '</tbody></table>';

        $title = "Schedule — " . $date->format('M j, Y');

        app(NotificationDispatcher::class)->notify($admin, $title, strip_tags($htmlBody), $htmlBody);

        return response()->json(['message' => 'Schedule emailed to ' . $admin->email . '.']);
    }
}

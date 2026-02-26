<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Invoice;
use App\Services\AppointmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    public function __construct(private AppointmentService $service) {}

    public function index(Request $request): JsonResponse
    {
        $query = Appointment::with(['user.clientProfile', 'dogs', 'visitReport'])
            ->when($request->date, fn($q) => $q->whereDate('scheduled_time', $request->date))
            ->when($request->start, fn($q) => $q->where('scheduled_time', '>=', $request->start))
            ->when($request->end, fn($q) => $q->where('scheduled_time', '<=', $request->end))
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderBy('scheduled_time');

        return response()->json($query->paginate(50));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id'          => 'required|exists:users,id',
            'dog_ids'          => 'required|array|min:1',
            'dog_ids.*'        => 'exists:dogs,id',
            'service_type'     => 'required|in:walk_30,walk_60,drop_in,overnight,day_boarding',
            'scheduled_time'   => 'required|date',
            'client_time_block'=> 'required|in:early_morning,morning,midday,afternoon,evening',
            'duration_minutes' => 'required|integer|min:15',
            'notes'            => 'nullable|string',
            'recurrence_rule'  => 'nullable|array',
        ]);

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
        $data = $request->validate([
            'scheduled_time'   => 'sometimes|date',
            'client_time_block'=> 'sometimes|in:early_morning,morning,midday,afternoon,evening',
            'status'           => 'sometimes|in:scheduled,checked_in,completed,cancelled',
            'notes'            => 'sometimes|nullable|string',
            'scope'            => 'sometimes|in:single,future_all',
        ]);

        $scope = $data['scope'] ?? 'single';
        unset($data['scope']);

        $this->service->update($appointment, $data, $scope);

        return response()->json(['data' => $appointment->fresh(['dogs', 'user'])]);
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

        app(\App\Services\VisitNotificationService::class)->sendVisitComplete($appointment, $report);

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
}

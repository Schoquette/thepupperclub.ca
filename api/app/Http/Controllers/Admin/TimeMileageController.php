<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

class TimeMileageController extends Controller
{
    public function report(Request $request): JsonResponse
    {
        $hasAssignedTo = Schema::hasColumn('appointments', 'assigned_to');
        $hasDistanceKm = Schema::hasColumn('appointments', 'distance_km');

        $rules = [
            'start' => 'required|date',
            'end'   => 'required|date|after_or_equal:start',
        ];
        if ($hasAssignedTo) {
            $rules['assigned_to'] = 'nullable|integer|exists:users,id';
        }
        $request->validate($rules);

        $start = Carbon::parse($request->start)->startOfDay();
        $end   = Carbon::parse($request->end)->endOfDay();

        $eagerLoads = ['user.clientProfile', 'dogs'];
        if (Schema::hasTable('visit_reports')) {
            $eagerLoads[] = 'visitReport';
        }
        if ($hasAssignedTo) $eagerLoads[] = 'assignedAdmin:id,name';

        $appointments = Appointment::with($eagerLoads)
            ->whereIn('status', ['scheduled', 'checked_in', 'completed'])
            ->whereBetween('scheduled_time', [$start, $end])
            ->where('scheduled_time', '<=', now())
            ->when($hasAssignedTo && $request->assigned_to, fn($q) => $q->where('assigned_to', $request->assigned_to))
            ->orderBy('scheduled_time')
            ->get();

        $rows = $appointments->map(function (Appointment $appt) use ($hasDistanceKm) {
            $checkIn  = $appt->check_in_time;
            $checkOut = $appt->check_out_time;
            $actualMinutes  = ($checkIn && $checkOut)
                ? $checkIn->diffInMinutes($checkOut)
                : null;
            $scheduledMinutes = $appt->duration_minutes ?? null;
            $address  = trim(implode(', ', array_filter([
                $appt->user?->clientProfile?->address,
                $appt->user?->clientProfile?->city,
            ])));

            $distanceKm = $appt->visitReport?->distance_km ?? ($hasDistanceKm ? $appt->distance_km : null) ?? null;

            return [
                'id'                  => $appt->id,
                'date'                => $appt->scheduled_time->toDateString(),
                'client_name'         => $appt->user?->name ?? '—',
                'dogs'                => $appt->dogs->pluck('name')->join(', '),
                'service_type'        => $appt->service_type,
                'address'             => $address ?: null,
                'assigned_to'         => $appt->assignedAdmin?->name ?? null,
                'scheduled_time'      => $appt->scheduled_time->format('g:i A'),
                'scheduled_minutes'   => $scheduledMinutes,
                'check_in'            => $checkIn?->format('g:i A'),
                'check_out'           => $checkOut?->format('g:i A'),
                'actual_minutes'      => $actualMinutes,
                'duration_minutes'    => $actualMinutes ?? $scheduledMinutes,
                'distance_km'         => $distanceKm,
                'status'              => $appt->status,
            ];
        });

        // Summaries
        $totalMinutes = $rows->sum('duration_minutes');
        $totalKm      = $rows->sum('distance_km');
        $totalVisits   = $rows->count();

        return response()->json([
            'data' => [
                'rows'     => $rows->values(),
                'summary'  => [
                    'total_visits'   => $totalVisits,
                    'total_minutes'  => $totalMinutes,
                    'total_hours'    => round($totalMinutes / 60, 1),
                    'total_km'       => round($totalKm, 1),
                ],
            ],
        ]);
    }

    /**
     * Calculate driving distance between a list of addresses using Google Maps Distance Matrix API.
     * Expects: { addresses: ["addr1", "addr2", ...] }
     * Returns total distance in km for the round trip route through all addresses.
     */
    /**
     * Estimate mileage for a single appointment.
     * Uses the previous appointment's client address as origin, or the team member's home address.
     */
    public function appointmentMileage(Appointment $appointment): JsonResponse
    {
        $apiKey = config('services.google.maps_api_key');
        if (!$apiKey) {
            return response()->json(['error' => 'Google Maps API key not configured.'], 422);
        }

        // Destination: this appointment's client address
        $clientProfile = $appointment->user?->clientProfile;
        $destination = trim(implode(', ', array_filter([
            $clientProfile?->address, $clientProfile?->city, $clientProfile?->province, $clientProfile?->postal_code,
        ])));
        if (!$destination) {
            return response()->json(['error' => 'Client has no address on file.'], 422);
        }

        // Origin: previous appointment's client address, or team member's home
        $origin = null;
        $originLabel = null;

        // Find the previous appointment on the same day for the same team member
        $date = $appointment->scheduled_time->toDateString();
        $prevAppt = Appointment::with('user.clientProfile')
            ->where('id', '!=', $appointment->id)
            ->whereDate('scheduled_time', $date)
            ->where('scheduled_time', '<', $appointment->scheduled_time)
            ->whereIn('status', ['scheduled', 'checked_in', 'completed'])
            ->when($appointment->assigned_to, fn($q) => $q->where('assigned_to', $appointment->assigned_to))
            ->orderByDesc('scheduled_time')
            ->first();

        if ($prevAppt) {
            $pp = $prevAppt->user?->clientProfile;
            $origin = trim(implode(', ', array_filter([
                $pp?->address, $pp?->city, $pp?->province, $pp?->postal_code,
            ])));
            $originLabel = $prevAppt->user?->name ?? 'Previous client';
        }

        // Fallback to team member's home address
        if (!$origin) {
            $teamMember = $appointment->assigned_to
                ? \App\Models\User::find($appointment->assigned_to)
                : \App\Models\User::whereIn('role', ['admin', 'superadmin'])->first();

            if ($teamMember) {
                $origin = trim(implode(', ', array_filter([
                    $teamMember->home_street ?? $teamMember->home_address ?? null,
                    $teamMember->home_city ?? null,
                    $teamMember->home_province ?? null,
                    $teamMember->home_postal_code ?? null,
                ])));
                $originLabel = 'Home';
            }
        }

        if (!$origin) {
            return response()->json(['error' => 'No origin address found (no previous appointment or team member home address).'], 422);
        }

        // Call Google Maps Distance Matrix
        $url = "https://maps.googleapis.com/maps/api/distancematrix/json"
             . "?origins=" . urlencode($origin)
             . "&destinations=" . urlencode($destination)
             . "&units=metric&key={$apiKey}";

        try {
            $response = json_decode(file_get_contents($url), true);
            if (($response['status'] ?? '') === 'OK'
                && ($response['rows'][0]['elements'][0]['status'] ?? '') === 'OK') {
                $meters = $response['rows'][0]['elements'][0]['distance']['value'];
                return response()->json([
                    'data' => [
                        'distance_km'  => round($meters / 1000, 1),
                        'from'         => $originLabel,
                        'from_address' => $origin,
                        'to_address'   => $destination,
                    ],
                ]);
            }
            return response()->json(['error' => 'Could not calculate distance.'], 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Maps API error: ' . $e->getMessage()], 500);
        }
    }

    public function mileageEstimate(Request $request): JsonResponse
    {
        $request->validate([
            'addresses'   => 'required|array|min:2',
            'addresses.*' => 'required|string',
        ]);

        $apiKey = config('services.google.maps_api_key');
        if (!$apiKey) {
            return response()->json(['error' => 'Google Maps API key not configured.'], 422);
        }

        $addresses = $request->addresses;
        $totalMeters = 0;
        $legs = [];

        // Calculate distance between consecutive addresses
        for ($i = 0; $i < count($addresses) - 1; $i++) {
            $origin      = urlencode($addresses[$i]);
            $destination = urlencode($addresses[$i + 1]);

            $url = "https://maps.googleapis.com/maps/api/distancematrix/json"
                 . "?origins={$origin}&destinations={$destination}&units=metric&key={$apiKey}";

            $response = json_decode(file_get_contents($url), true);

            if (($response['status'] ?? '') === 'OK'
                && ($response['rows'][0]['elements'][0]['status'] ?? '') === 'OK') {
                $meters   = $response['rows'][0]['elements'][0]['distance']['value'];
                $text     = $response['rows'][0]['elements'][0]['distance']['text'];
                $totalMeters += $meters;
                $legs[] = [
                    'from'     => $addresses[$i],
                    'to'       => $addresses[$i + 1],
                    'distance' => $text,
                    'meters'   => $meters,
                ];
            }
        }

        return response()->json([
            'data' => [
                'total_km' => round($totalMeters / 1000, 1),
                'legs'     => $legs,
            ],
        ]);
    }
}

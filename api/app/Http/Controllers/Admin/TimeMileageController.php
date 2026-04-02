<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class TimeMileageController extends Controller
{
    public function report(Request $request): JsonResponse
    {
        $request->validate([
            'start'       => 'required|date',
            'end'         => 'required|date|after_or_equal:start',
            'assigned_to' => 'nullable|integer|exists:users,id',
        ]);

        $start = Carbon::parse($request->start)->startOfDay();
        $end   = Carbon::parse($request->end)->endOfDay();

        $appointments = Appointment::with(['user.clientProfile', 'dogs', 'visitReport', 'assignedAdmin:id,name'])
            ->where('status', 'completed')
            ->whereBetween('scheduled_time', [$start, $end])
            ->when($request->assigned_to, fn($q) => $q->where('assigned_to', $request->assigned_to))
            ->orderBy('scheduled_time')
            ->get();

        $rows = $appointments->map(function (Appointment $appt) {
            $checkIn  = $appt->check_in_time;
            $checkOut = $appt->check_out_time;
            $minutes  = ($checkIn && $checkOut) ? $checkIn->diffInMinutes($checkOut) : null;
            $address  = trim(implode(', ', array_filter([
                $appt->user?->clientProfile?->address,
                $appt->user?->clientProfile?->city,
            ])));

            return [
                'id'              => $appt->id,
                'date'            => $appt->scheduled_time->toDateString(),
                'client_name'     => $appt->user?->name ?? '—',
                'dogs'            => $appt->dogs->pluck('name')->join(', '),
                'service_type'    => $appt->service_type,
                'address'         => $address ?: null,
                'assigned_to'     => $appt->assignedAdmin?->name ?? null,
                'check_in'        => $checkIn?->format('g:i A'),
                'check_out'       => $checkOut?->format('g:i A'),
                'duration_minutes' => $minutes,
                'distance_km'     => $appt->visitReport?->distance_km,
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

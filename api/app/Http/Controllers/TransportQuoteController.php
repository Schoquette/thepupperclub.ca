<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TransportQuoteController extends Controller
{
    /** Flat fee charged for the first 5km. */
    private const BASE_RATE        = 30.00;
    /** Kilometres included in the base rate. */
    private const FREE_KM          = 5;
    /** Dollars charged per km beyond FREE_KM. */
    private const PER_KM_OVERAGE   = 1.00;

    /**
     * POST /api/transport-quote
     *
     * Public endpoint so the marketing services page can show a price
     * estimate for standalone appointment transportation (vet, groomer,
     * day-care drop-off, etc.). For paid clients the same service is
     * included in regular visits.
     *
     * Returns a structured breakdown so the front-end can render line
     * items rather than just a single number:
     *
     *   {
     *     distance_km, trip_type,
     *     base_rate, free_km, per_km_overage,
     *     billable_km, mileage_cost, total_cost,
     *     formatted: { distance_km, base_rate, mileage_cost, total_cost }
     *   }
     */
    public function quote(Request $request): JsonResponse
    {
        $data = $request->validate([
            'origin'      => 'required|string|min:4|max:300',
            'destination' => 'required|string|min:4|max:300',
            'trip_type'   => 'sometimes|in:one_way,return',
        ]);

        $tripType = $data['trip_type'] ?? 'one_way';
        $distanceKm = $this->oneWayDistanceKm($data['origin'], $data['destination']);

        if ($distanceKm === null) {
            return response()->json([
                'message' => 'We couldn’t calculate driving distance for those addresses. Please double-check the spelling, or include the city.',
            ], 422);
        }

        // Mileage charged per km past the free allowance. For a return trip
        // the mileage is doubled (we drive there + back) but the base rate
        // covers the trip as a whole, not each leg.
        $billableKm     = max(0, $distanceKm - self::FREE_KM);
        $mileageMult    = $tripType === 'return' ? 2 : 1;
        $mileageCost    = round($billableKm * self::PER_KM_OVERAGE * $mileageMult, 2);
        $total          = round(self::BASE_RATE + $mileageCost, 2);

        return response()->json([
            'distance_km'    => round($distanceKm, 2),
            'trip_type'      => $tripType,
            'base_rate'      => self::BASE_RATE,
            'free_km'        => self::FREE_KM,
            'per_km_overage' => self::PER_KM_OVERAGE,
            'billable_km'    => round($billableKm, 2),
            'mileage_cost'   => $mileageCost,
            'total_cost'     => $total,
            'formatted'      => [
                'distance_km'  => number_format($distanceKm, 1) . ' km',
                'base_rate'    => '$' . number_format(self::BASE_RATE, 2),
                'mileage_cost' => '$' . number_format($mileageCost, 2),
                'total_cost'   => '$' . number_format($total, 2),
            ],
        ]);
    }

    /**
     * Ask Google for driving distance in kilometres. Returns null on any
     * error so the caller can surface a clean validation-style message
     * instead of leaking an HTTP detail to the visitor.
     */
    private function oneWayDistanceKm(string $origin, string $destination): ?float
    {
        $apiKey = config('services.google.maps_api_key');
        if (!$apiKey) {
            Log::warning('TransportQuote: GOOGLE_MAPS_API_KEY is not set');
            return null;
        }

        $url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
            . '?origins=' . urlencode($origin)
            . '&destinations=' . urlencode($destination)
            . '&units=metric'
            . '&key=' . $apiKey;

        try {
            $body = @file_get_contents($url);
            if ($body === false) return null;
            $data = json_decode($body, true);
            if (($data['status'] ?? '') !== 'OK') return null;
            $el = $data['rows'][0]['elements'][0] ?? [];
            if (($el['status'] ?? '') !== 'OK') return null;
            $meters = $el['distance']['value'] ?? null;
            if (!$meters) return null;
            return $meters / 1000;
        } catch (\Throwable $e) {
            Log::warning('TransportQuote: distance lookup failed', [
                'origin' => $origin, 'destination' => $destination, 'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}

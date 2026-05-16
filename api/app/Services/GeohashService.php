<?php

namespace App\Services;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

/**
 * Geocodes an address via Google Maps and returns a coarse geohash.
 *
 * We deliberately keep the geohash short (6 characters ≈ ±0.6km cell) so
 * that:
 *   - It's still useful for "is this neighbour within ~1km?" matching
 *   - It's NOT precise enough to reconstruct an actual address
 *
 * The original lat/lng is never stored on the member row.
 */
class GeohashService
{
    private const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

    public function geocodeToGeohash(string $address, int $precision = 6): ?string
    {
        $apiKey = config('services.google.maps_api_key');
        if (!$apiKey) {
            Log::warning('GeohashService: GOOGLE_MAPS_API_KEY is not set');
            return null;
        }

        try {
            $client = new Client(['timeout' => 5.0]);
            $res = $client->get('https://maps.googleapis.com/maps/api/geocode/json', [
                'query' => ['address' => $address, 'key' => $apiKey],
            ]);
            $body = json_decode((string) $res->getBody(), true);
        } catch (\Throwable $e) {
            Log::warning('GeohashService: geocoding request failed', ['error' => $e->getMessage()]);
            return null;
        }

        if (($body['status'] ?? '') !== 'OK' || empty($body['results'][0]['geometry']['location'])) {
            return null;
        }

        $lat = (float) $body['results'][0]['geometry']['location']['lat'];
        $lng = (float) $body['results'][0]['geometry']['location']['lng'];

        return $this->encode($lat, $lng, $precision);
    }

    /**
     * Standard geohash encoding (interleaved-bits scheme). 6 chars ≈ ±0.6km.
     */
    public function encode(float $lat, float $lng, int $precision = 6): string
    {
        $latRange = [-90.0, 90.0];
        $lngRange = [-180.0, 180.0];
        $geohash = '';
        $bits = 0;
        $bitsTotal = 0;
        $isEven = true;

        while (strlen($geohash) < $precision) {
            if ($isEven) {
                $mid = ($lngRange[0] + $lngRange[1]) / 2;
                if ($lng > $mid) { $bits = ($bits << 1) | 1; $lngRange[0] = $mid; }
                else             { $bits = $bits << 1;       $lngRange[1] = $mid; }
            } else {
                $mid = ($latRange[0] + $latRange[1]) / 2;
                if ($lat > $mid) { $bits = ($bits << 1) | 1; $latRange[0] = $mid; }
                else             { $bits = $bits << 1;       $latRange[1] = $mid; }
            }
            $isEven = !$isEven;
            $bitsTotal++;
            if ($bitsTotal === 5) {
                $geohash .= self::BASE32[$bits];
                $bits = 0;
                $bitsTotal = 0;
            }
        }

        return $geohash;
    }
}

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

    /**
     * Decode a geohash back to the centre lat/lng of its cell.
     */
    public function decode(string $geohash): ?array
    {
        $latRange = [-90.0, 90.0];
        $lngRange = [-180.0, 180.0];
        $isEven = true;

        $geohash = strtolower($geohash);
        for ($i = 0; $i < strlen($geohash); $i++) {
            $c = strpos(self::BASE32, $geohash[$i]);
            if ($c === false) return null;
            for ($mask = 16; $mask >= 1; $mask >>= 1) {
                $bit = ($c & $mask) > 0;
                if ($isEven) {
                    $mid = ($lngRange[0] + $lngRange[1]) / 2;
                    if ($bit) $lngRange[0] = $mid; else $lngRange[1] = $mid;
                } else {
                    $mid = ($latRange[0] + $latRange[1]) / 2;
                    if ($bit) $latRange[0] = $mid; else $latRange[1] = $mid;
                }
                $isEven = !$isEven;
            }
        }

        return [
            ($latRange[0] + $latRange[1]) / 2,
            ($lngRange[0] + $lngRange[1]) / 2,
        ];
    }

    /**
     * Great-circle distance in metres between two [lat, lng] pairs.
     */
    public function distanceMeters(array $a, array $b): float
    {
        $earthRadius = 6371000.0; // metres
        [$lat1, $lng1] = $a;
        [$lat2, $lng2] = $b;

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $sLat1 = sin(deg2rad($lat1));
        $sLat2 = sin(deg2rad($lat2));

        $h = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return 2 * $earthRadius * asin(min(1.0, sqrt($h)));
    }

    /**
     * Bucket a distance in metres into a human-readable label that's
     * intentionally imprecise (per the spec's privacy promise — we never
     * surface exact distance).
     */
    public function distanceBucket(float $meters): string
    {
        if ($meters < 250)  return 'In your area';
        if ($meters < 500)  return 'Less than 500m away';
        if ($meters < 1000) return 'Less than 1 km away';
        if ($meters < 2000) return 'About 1 km away';
        if ($meters < 3500) return 'About 2 km away';
        if ($meters < 5500) return 'About 4 km away';
        return 'More than 5 km away';
    }

    /**
     * Return the 9 geohash cells (self + 8 adjacent) that cover the
     * immediate neighbourhood of the given geohash. We use these as a
     * prefix filter in SQL — much faster than computing distance to
     * every member, especially as the table grows.
     */
    public function neighbourCells(string $geohash): array
    {
        $center = $this->decode($geohash);
        if ($center === null) return [$geohash];

        // 6-char cell dimensions: ~1.22km × 0.61km. Step by a slightly
        // generous offset so we definitely catch the 8 surrounding cells
        // regardless of where in the cell the centre lat/lng sits.
        $latStep = 0.006;   // ≈ 670m
        $lngStep = 0.012;   // ≈ 900m at mid-latitudes

        $cells = [];
        for ($dLat = -1; $dLat <= 1; $dLat++) {
            for ($dLng = -1; $dLng <= 1; $dLng++) {
                $cells[] = $this->encode(
                    $center[0] + $dLat * $latStep,
                    $center[1] + $dLng * $lngStep,
                    strlen($geohash),
                );
            }
        }
        return array_values(array_unique($cells));
    }
}

<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class MileageService
{
    /**
     * Recalculate mileage for all completed appointments on a given day
     * for a specific team member (or all if no team member assigned).
     *
     * Route: home → client1 → client2 → ... → clientN → home
     * Each appointment stores the leg distance TO that client.
     * The last appointment also includes the return trip home.
     */
    public function recalculateDay(Carbon $date, ?int $teamMemberId): void
    {
        $apiKey = config('services.google.maps_api_key');
        if (!$apiKey) {
            Log::info('MileageService: No Google Maps API key configured, skipping.');
            return;
        }

        $hasAssignedTo = Schema::hasColumn('appointments', 'assigned_to');

        // Get all completed appointments for this team member on this day, ordered by check-in time
        $appointments = Appointment::with(['user.clientProfile', 'visitReport'])
            ->where('status', 'completed')
            ->whereDate('scheduled_time', $date->toDateString())
            ->when($hasAssignedTo && $teamMemberId, fn($q) => $q->where('assigned_to', $teamMemberId))
            ->orderBy('check_in_time')
            ->orderBy('scheduled_time')
            ->get();

        if ($appointments->isEmpty()) return;

        // Get team member's home address
        $homeAddress = null;
        if ($teamMemberId) {
            $teamMember = User::find($teamMemberId);
            if ($teamMember) {
                $homeAddress = $this->getUserHomeAddress($teamMember);
            }
        }

        // If no team member assigned, try the first admin/superadmin with a home address
        if (!$homeAddress && !$teamMemberId) {
            $admin = User::whereIn('role', ['admin', 'superadmin'])
                ->where('status', 'active')
                ->get()
                ->first(fn($u) => $this->getUserHomeAddress($u));
            if ($admin) {
                $homeAddress = $this->getUserHomeAddress($admin);
            }
        }

        // Build route: collect client addresses in order
        $stops = [];
        foreach ($appointments as $appt) {
            $clientAddress = $this->getClientAddress($appt);
            $stops[] = [
                'appointment' => $appt,
                'address'     => $clientAddress,
            ];
        }

        // Filter out appointments with no client address
        $stops = array_values(array_filter($stops, fn($s) => !empty($s['address'])));
        if (empty($stops)) return;

        // Calculate each leg
        foreach ($stops as $i => $stop) {
            $origin = null;

            if ($i === 0) {
                // First appointment: from team member's home
                $origin = $homeAddress;
            } else {
                // Subsequent: from previous client's address
                $origin = $stops[$i - 1]['address'];
            }

            $legDistance = 0;
            if ($origin && $origin !== $stop['address']) {
                $legDistance = $this->getDistance($origin, $stop['address'], $apiKey);
            }

            // For the last appointment, add return trip home
            $returnDistance = 0;
            if ($i === count($stops) - 1 && $homeAddress && $homeAddress !== $stop['address']) {
                $returnDistance = $this->getDistance($stop['address'], $homeAddress, $apiKey);
            }

            $totalKm = round($legDistance + $returnDistance, 1);

            // Update the visit report with calculated mileage
            $report = $stop['appointment']->visitReport;
            if ($report) {
                $report->update(['distance_km' => $totalKm]);
            }
        }
    }

    /**
     * Get the home address for a team member (admin user).
     * Prefers structured fields, falls back to composite home_address.
     */
    private function getUserHomeAddress(User $user): ?string
    {
        // Try structured fields first
        if (Schema::hasColumn('users', 'home_street') && $user->home_street) {
            $parts = array_filter([
                $user->home_street,
                $user->home_city,
                $user->home_province,
                $user->home_postal_code,
            ]);
            return implode(', ', $parts);
        }

        // Fall back to composite field
        if (Schema::hasColumn('users', 'home_address')) {
            return $user->home_address ?: null;
        }

        return null;
    }

    /**
     * Get the client's address from their profile.
     */
    private function getClientAddress(Appointment $appointment): ?string
    {
        $profile = $appointment->user?->clientProfile;
        if (!$profile) return null;

        $parts = array_filter([
            $profile->address,
            $profile->city,
            $profile->province,
            $profile->postal_code,
        ]);

        return $parts ? implode(', ', $parts) : null;
    }

    /**
     * Call Google Maps Distance Matrix API to get driving distance in km.
     */
    private function getDistance(string $origin, string $destination, string $apiKey): float
    {
        $url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
            . '?origins=' . urlencode($origin)
            . '&destinations=' . urlencode($destination)
            . '&units=metric'
            . '&key=' . $apiKey;

        try {
            $response = json_decode(file_get_contents($url), true);

            if (($response['status'] ?? '') === 'OK'
                && ($response['rows'][0]['elements'][0]['status'] ?? '') === 'OK') {
                return $response['rows'][0]['elements'][0]['distance']['value'] / 1000;
            }
        } catch (\Throwable $e) {
            Log::warning('MileageService: Google Maps API error', [
                'origin'      => $origin,
                'destination' => $destination,
                'error'       => $e->getMessage(),
            ]);
        }

        return 0;
    }
}

<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsService
{
    /**
     * Send an SMS via Twilio REST API.
     */
    public function send(string $to, string $message): bool
    {
        $sid   = config('services.twilio.sid');
        $token = config('services.twilio.auth_token');
        $from  = config('services.twilio.from_number');

        if (!$sid || !$token || !$from) {
            Log::info('SmsService: Twilio not configured, skipping SMS.');
            return false;
        }

        // Normalize phone number — ensure it starts with +1 for Canadian numbers
        $to = $this->normalizePhone($to);
        if (!$to) {
            Log::warning('SmsService: Invalid phone number, skipping.');
            return false;
        }

        try {
            $response = Http::withBasicAuth($sid, $token)
                ->asForm()
                ->post("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json", [
                    'To'   => $to,
                    'From' => $from,
                    'Body' => $this->truncateMessage($message),
                ]);

            if ($response->successful()) {
                return true;
            }

            Log::warning('SmsService: Twilio API error', [
                'status' => $response->status(),
                'body'   => $response->json(),
            ]);
            return false;
        } catch (\Throwable $e) {
            Log::error('SmsService: Failed to send SMS', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Normalize a Canadian phone number to E.164 format (+1XXXXXXXXXX).
     */
    private function normalizePhone(string $phone): ?string
    {
        // Strip all non-digits
        $digits = preg_replace('/\D/', '', $phone);

        // Handle 10-digit Canadian numbers
        if (strlen($digits) === 10) {
            return '+1' . $digits;
        }

        // Handle 11-digit (already has country code 1)
        if (strlen($digits) === 11 && str_starts_with($digits, '1')) {
            return '+' . $digits;
        }

        // Already in E.164
        if (str_starts_with($phone, '+') && strlen($digits) >= 10) {
            return '+' . $digits;
        }

        return null;
    }

    /**
     * Truncate message to SMS limit (1600 chars for Twilio).
     */
    private function truncateMessage(string $message): string
    {
        return mb_substr($message, 0, 1600);
    }
}

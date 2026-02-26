<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExpoNotificationService
{
    private const EXPO_API = 'https://exp.host/--/api/v2/push/send';

    public function send(User $user, string $title, string $body, array $data = []): void
    {
        if (!$user->expo_push_token) return;

        $this->sendRaw([[
            'to'    => $user->expo_push_token,
            'title' => $title,
            'body'  => $body,
            'data'  => $data,
            'sound' => 'default',
        ]]);
    }

    public function sendToUsers(Collection $users, string $title, string $body, array $data = []): void
    {
        $messages = $users
            ->filter(fn(User $u) => $u->expo_push_token)
            ->map(fn(User $u) => [
                'to'    => $u->expo_push_token,
                'title' => $title,
                'body'  => $body,
                'data'  => $data,
                'sound' => 'default',
            ])
            ->values()
            ->all();

        if (empty($messages)) return;

        // Expo allows up to 100 messages per request
        foreach (array_chunk($messages, 100) as $chunk) {
            $this->sendRaw($chunk);
        }
    }

    private function sendRaw(array $messages): void
    {
        try {
            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
            ])->post(self::EXPO_API, $messages);

            if (!$response->successful()) {
                Log::warning('Expo push notification failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Expo push notification error: ' . $e->getMessage());
        }
    }
}

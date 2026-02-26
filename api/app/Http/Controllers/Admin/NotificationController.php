<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PushNotification;
use App\Models\User;
use App\Services\ExpoNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private ExpoNotificationService $expo) {}

    public function broadcast(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'      => 'required|string|max:255',
            'body'       => 'required|string',
            'recipients' => 'required|array',    // ['all'] or array of user IDs
        ]);

        $query = User::where('role', 'client')
            ->whereNotNull('expo_push_token')
            ->where('status', 'active');

        if ($data['recipients'] !== ['all']) {
            $query->whereIn('id', $data['recipients']);
        }

        $users = $query->get();

        foreach ($users as $user) {
            $notification = PushNotification::create([
                'user_id' => $user->id,
                'title'   => $data['title'],
                'body'    => $data['body'],
                'data'    => ['type' => 'broadcast'],
                'sent_at' => now(),
            ]);

            // Also create message in conversation thread
            $conversation = $user->conversation()->firstOrCreate(['user_id' => $user->id]);
            $conversation->messages()->create([
                'sender_id' => $request->user()->id,
                'type'      => 'notification',
                'body'      => $data['body'],
                'metadata'  => ['title' => $data['title'], 'broadcast' => true],
            ]);
        }

        $this->expo->sendToUsers($users, $data['title'], $data['body']);

        return response()->json(['message' => "Broadcast sent to {$users->count()} clients."]);
    }

    public function history(Request $request): JsonResponse
    {
        $notifications = PushNotification::with('user')
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json($notifications);
    }
}

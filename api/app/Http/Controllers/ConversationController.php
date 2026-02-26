<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    public function thread(Request $request, int $clientId): JsonResponse
    {
        $user = $request->user();

        // Admin can view any; client can only view own
        if ($user->isClient()) {
            abort_unless($user->id === $clientId, 403);
        }

        $conversation = Conversation::firstOrCreate(['user_id' => $clientId]);

        $query = $conversation->messages()
            ->with('sender:id,name,role')
            ->when($request->since, fn($q) => $q->where('id', '>', $request->since));

        $messages = $query->orderBy('id')->paginate(50);

        // Mark as read for requesting user
        if ($user->isClient()) {
            $conversation->messages()
                ->whereNull('read_at')
                ->where('sender_id', '!=', $user->id)
                ->update(['read_at' => now()]);
            $conversation->update(['unread_count_client' => 0]);
        } else {
            $conversation->messages()
                ->whereNull('read_at')
                ->where('sender_id', '!=', $user->id)
                ->update(['read_at' => now()]);
            $conversation->update(['unread_count_admin' => 0]);
        }

        return response()->json($messages);
    }

    public function sendMessage(Request $request, int $clientId): JsonResponse
    {
        $user = $request->user();

        if ($user->isClient()) {
            abort_unless($user->id === $clientId, 403);
        }

        $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        $conversation = Conversation::firstOrCreate(['user_id' => $clientId]);

        $message = $conversation->messages()->create([
            'sender_id' => $user->id,
            'type'      => 'text',
            'body'      => $request->body,
        ]);

        // Increment unread count for the other party
        if ($user->isClient()) {
            $conversation->increment('unread_count_admin');
        } else {
            $conversation->increment('unread_count_client');
        }

        $conversation->update(['last_message_at' => now()]);

        return response()->json(['data' => $message->load('sender:id,name,role')], 201);
    }

    public function markRead(Request $request, int $clientId, Message $message): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient()) {
            abort_unless($user->id === $clientId, 403);
        }

        $message->update(['read_at' => now()]);

        return response()->json(['message' => 'Marked as read.']);
    }

    public function inbox(): JsonResponse
    {
        $conversations = Conversation::with(['user:id,name,email', 'lastMessage'])
            ->orderByDesc('last_message_at')
            ->paginate(30);

        return response()->json($conversations);
    }

    public function updateStatus(Request $request, Conversation $conversation): JsonResponse
    {
        $request->validate(['status' => 'required|in:open,resolved,needs_follow_up']);
        $conversation->update(['status' => $request->status]);
        return response()->json(['data' => $conversation->fresh()]);
    }
}

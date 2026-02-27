<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConversationController extends Controller
{
    public function thread(Request $request, int $clientId): JsonResponse
    {
        $user = $request->user();

        if ($user->isClient()) {
            abort_unless($user->id === $clientId, 403);
        }

        $conversation = Conversation::firstOrCreate(['user_id' => $clientId]);

        $messages = $conversation->messages()
            ->with('sender:id,name,role')
            ->orderBy('id')
            ->paginate(50);

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

        if ($user->isClient()) {
            $conversation->increment('unread_count_admin');
        } else {
            $conversation->increment('unread_count_client');
        }

        $conversation->update(['last_message_at' => now()]);

        return response()->json(['data' => $message->load('sender:id,name,role')], 201);
    }

    public function sendPhoto(Request $request, int $clientId): JsonResponse
    {
        $user = $request->user();

        if ($user->isClient()) {
            abort_unless($user->id === $clientId, 403);
        }

        $request->validate([
            'photo' => 'required|file|image|max:10240',
        ]);

        $conversation = Conversation::firstOrCreate(['user_id' => $clientId]);

        $file  = $request->file('photo');
        $path  = $file->store("photos/{$conversation->id}", 'local');

        $message = $conversation->messages()->create([
            'sender_id' => $user->id,
            'type'      => 'photo',
            'body'      => $file->getClientOriginalName(),
            'metadata'  => [
                'storage_path'  => $path,
                'mime_type'     => $file->getMimeType(),
                'original_name' => $file->getClientOriginalName(),
            ],
        ]);

        if ($user->isClient()) {
            $conversation->increment('unread_count_admin');
        } else {
            $conversation->increment('unread_count_client');
        }

        $conversation->update(['last_message_at' => now()]);

        return response()->json(['data' => $message->load('sender:id,name,role')], 201);
    }

    public function servePhoto(Request $request, Message $message): StreamedResponse
    {
        $user         = $request->user();
        $conversation = $message->conversation;

        if ($user->isClient()) {
            abort_unless($conversation->user_id === $user->id, 403);
        }

        abort_unless($message->type === 'photo', 404);

        $meta = $message->metadata ?? [];
        $path = $meta['storage_path'] ?? null;

        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response(
            $path,
            $meta['original_name'] ?? 'photo.jpg',
            ['Content-Type' => $meta['mime_type'] ?? 'image/jpeg']
        );
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

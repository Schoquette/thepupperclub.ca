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

        $currentUserId = $user->id;
        $messages = $conversation->messages()
            ->with(['sender:id,name,role', 'reactions'])
            ->orderBy('id')
            ->paginate(50);

        // Transform reactions into grouped summary
        $messages->getCollection()->transform(function ($msg) use ($currentUserId) {
            $grouped = $msg->reactions
                ->groupBy('emoji')
                ->map(fn($group, $emoji) => [
                    'emoji'         => $emoji,
                    'count'         => $group->count(),
                    'reacted_by_me' => $group->contains('user_id', $currentUserId),
                ])
                ->values();
            $msg->setRelation('reactions', $grouped);
            return $msg;
        });

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

    public function editMessage(Request $request, Message $message): JsonResponse
    {
        $user = $request->user();

        abort_unless($message->sender_id === $user->id, 403);
        abort_unless($message->type === 'text', 422);
        abort_unless($message->created_at->diffInMinutes(now()) <= 120, 422);

        $request->validate(['body' => 'required|string|max:5000']);

        $message->update([
            'body'       => $request->body,
            'edited_at'  => now(),
        ]);

        return response()->json(['data' => $message->fresh('sender')]);
    }

    public function deleteMessage(Request $request, Message $message): JsonResponse
    {
        $user = $request->user();

        abort_unless($message->sender_id === $user->id, 403);
        abort_unless(in_array($message->type, ['text', 'photo']), 422);
        abort_unless($message->created_at->diffInMinutes(now()) <= 120, 422);

        $message->update(['deleted_at' => now()]);

        return response()->json(['message' => 'Message deleted.']);
    }

    public function toggleReaction(Request $request, Message $message): JsonResponse
    {
        $user         = $request->user();
        $conversation = Conversation::findOrFail($message->conversation_id);

        if ($user->isClient()) {
            abort_unless($conversation->user_id === $user->id, 403);
        }

        $data = $request->validate(['emoji' => 'required|string|max:20']);

        $existing = $message->reactions()
            ->where('user_id', $user->id)
            ->where('emoji', $data['emoji'])
            ->first();

        if ($existing) {
            $existing->delete();
        } else {
            $message->reactions()->create([
                'user_id' => $user->id,
                'emoji'   => $data['emoji'],
            ]);
        }

        $currentUserId = $user->id;
        $grouped = $message->fresh(['reactions'])->reactions
            ->groupBy('emoji')
            ->map(fn($group, $emoji) => [
                'emoji'         => $emoji,
                'count'         => $group->count(),
                'reacted_by_me' => $group->contains('user_id', $currentUserId),
            ])
            ->values();

        return response()->json(['data' => $grouped]);
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

<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\User;
use App\Services\AdminNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class InboundEmailController extends Controller
{
    /**
     * Handle inbound email webhook from Resend.
     *
     * Resend forwards incoming emails as JSON with fields:
     *   - from: sender email address
     *   - to: recipient email address
     *   - subject: email subject
     *   - text: plain text body
     *   - html: HTML body
     *
     * We match the sender to a client and insert the reply into their conversation.
     */
    public function handle(Request $request): JsonResponse
    {
        $from    = $this->extractEmail($request->input('from', ''));
        $subject = $request->input('subject', '');
        $text    = $request->input('text', '');
        $html    = $request->input('html', '');

        if (!$from) {
            Log::info('InboundEmail: No sender address, ignoring.');
            return response()->json(['status' => 'ignored']);
        }

        // Find the client by email
        $client = User::where('email', $from)
            ->where('role', 'client')
            ->first();

        if (!$client) {
            // Try secondary contact email
            $client = User::whereHas('clientProfile', function ($q) use ($from) {
                $q->where('secondary_contact_email', $from);
            })->where('role', 'client')->first();
        }

        if (!$client) {
            Log::info('InboundEmail: No matching client for sender', ['from' => $from]);
            return response()->json(['status' => 'no_match']);
        }

        // Clean up the reply text — strip quoted content (lines starting with >)
        $body = $this->cleanReplyText($text ?: strip_tags($html));

        if (!trim($body)) {
            Log::info('InboundEmail: Empty body after cleaning', ['from' => $from]);
            return response()->json(['status' => 'empty']);
        }

        // Create the message in the client's conversation
        $conversation = Conversation::firstOrCreate(['user_id' => $client->id]);

        $message = $conversation->messages()->create([
            'sender_id' => $client->id,
            'type'      => 'text',
            'body'      => $body,
            'metadata'  => [
                'source'  => 'email',
                'subject' => $subject,
            ],
        ]);

        $conversation->increment('unread_count_admin');
        $conversation->update(['last_message_at' => now()]);

        Log::info('InboundEmail: Message created', [
            'client_id'  => $client->id,
            'message_id' => $message->id,
        ]);

        return response()->json(['status' => 'ok', 'message_id' => $message->id]);
    }

    /**
     * Extract a clean email address from a "Name <email>" string.
     */
    private function extractEmail(string $from): ?string
    {
        if (preg_match('/<([^>]+)>/', $from, $matches)) {
            return strtolower(trim($matches[1]));
        }

        $email = strtolower(trim($from));
        return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }

    /**
     * Strip quoted reply content and email signatures from the reply text.
     */
    private function cleanReplyText(string $text): string
    {
        $lines = explode("\n", $text);
        $cleaned = [];

        foreach ($lines as $line) {
            // Stop at quoted content
            if (str_starts_with(trim($line), '>')) break;

            // Stop at common reply separators
            $trimmed = trim($line);
            if (preg_match('/^-{2,}/', $trimmed)) break;
            if (preg_match('/^On .+ wrote:$/i', $trimmed)) break;
            if (str_starts_with($trimmed, 'From:')) break;
            if (str_starts_with($trimmed, 'Sent from my')) break;

            $cleaned[] = $line;
        }

        return trim(implode("\n", $cleaned));
    }
}

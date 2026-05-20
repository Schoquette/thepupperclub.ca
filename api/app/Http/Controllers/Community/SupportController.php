<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SupportController extends Controller
{
    /**
     * POST /api/community/support/contact
     * Body: { topic: technical|question|feature|safety, body: string }
     *
     * Emails the support inbox (sophie@thepupperclub.ca). Safety reports
     * are flagged in the subject so they sort to the top. The member's
     * reply-to is included so a normal reply lands in their inbox.
     */
    public function contact(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        $data = $request->validate([
            'topic' => 'required|in:technical,question,feature,safety',
            'body'  => 'required|string|min:5|max:4000',
        ]);

        $topicLabels = [
            'technical' => 'Technical issue',
            'question'  => 'Question',
            'feature'   => 'Feature request',
            'safety'    => 'SAFETY incident',
        ];

        $subject = '[Community] ' . ($topicLabels[$data['topic']] ?? 'Message')
            . ' from member #' . $member->id;

        $bodyText = "From: {$member->name} <{$member->email}> (member #{$member->id})\n"
            . "Topic: {$topicLabels[$data['topic']]}\n"
            . "Status: {$member->status}\n"
            . "---\n\n"
            . $data['body'];

        // Community support always lands at sophie@thepupperclub.ca.
        // Emails route through the same Resend transport configured for the
        // Client Portal (MAIL_MAILER=resend), so no extra setup is needed.
        $to = config('mail.community_support_address', 'sophie@thepupperclub.ca');

        try {
            Mail::raw($bodyText, function ($message) use ($subject, $to, $member) {
                $message->to($to)
                    ->subject($subject)
                    ->replyTo($member->email, $member->name);
            });
        } catch (\Throwable $e) {
            Log::error('Community support contact failed', [
                'member_id' => $member->id,
                'topic'     => $data['topic'],
                'error'     => $e->getMessage(),
            ]);
            // The mail send failed but we don't want the member to lose
            // their message — log it server-side so we can recover it.
            Log::info('Community support fallback log', [
                'member_id' => $member->id,
                'topic'     => $data['topic'],
                'body'      => $data['body'],
            ]);
            return response()->json([
                'message' => 'We saved your message. Email is having a moment — we’ll still see it.',
            ], 202);
        }

        return response()->json(['message' => 'Sent.']);
    }
}

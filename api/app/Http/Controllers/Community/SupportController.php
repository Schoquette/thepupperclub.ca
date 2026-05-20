<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityMember;
use App\Services\CommunityMailer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SupportController extends Controller
{
    public function __construct(private CommunityMailer $mailer) {}

    /**
     * POST /api/community/support/contact
     * Body: { topic: technical|question|feature|safety, body: string }
     *
     * Delivers the message to the support inbox (sophie@thepupperclub.ca)
     * using the branded Community email template. The submitter's address
     * is the Reply-To so a normal reply lands back in their inbox.
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
        $topicLabel = $topicLabels[$data['topic']] ?? 'Message';

        $isSafety = $data['topic'] === 'safety';
        $subject  = ($isSafety ? '[SAFETY] ' : '[Community] ')
            . $topicLabel . ' — member #' . $member->id;

        // Build a branded HTML body. The template wraps this in the
        // cream/blue layout shared with the Client Portal.
        $title = $isSafety
            ? 'Safety report from a Community member'
            : 'New ' . strtolower($topicLabel) . ' from a Community member';

        $bodyParagraphs = preg_split('/\n{2,}/', trim($data['body']));
        $bodyHtml = '';
        foreach ($bodyParagraphs as $p) {
            $bodyHtml .= '<p>' . nl2br(e($p)) . '</p>';
        }

        $content =
            '<p><strong>From:</strong> ' . e($member->name) . ' &lt;' . e($member->email) . '&gt;'
                . ' (member #' . (int) $member->id . ')</p>'
            . '<p><strong>Topic:</strong> ' . e($topicLabel) . '</p>'
            . '<p><strong>Account status:</strong> ' . e($member->status) . '</p>'
            . '<hr style="border:none;border-top:1px solid #F6F3EE;margin:24px 0;">'
            . $bodyHtml
            . '<hr style="border:none;border-top:1px solid #F6F3EE;margin:24px 0;">'
            . '<p style="color:#5a4a44;font-size:13px;">'
                . 'Reply directly to this email to reach the member &mdash; their address is set as Reply-To.'
            . '</p>';

        $to = config('mail.community_support_address', 'sophie@thepupperclub.ca');

        $sent = $this->mailer->send(
            toEmail:     $to,
            subject:     $subject,
            title:       $title,
            htmlContent: $content,
            replyTo:     $member->email,
            replyToName: $member->name,
        );

        if (!$sent) {
            // Mail failed — log the message so we can recover it manually.
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

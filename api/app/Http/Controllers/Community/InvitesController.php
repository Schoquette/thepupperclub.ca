<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityInvite;
use App\Models\CommunityMember;
use App\Services\CommunityMailer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class InvitesController extends Controller
{
    public function __construct(private CommunityMailer $mailer) {}

    /**
     * GET /api/community/invites
     *
     * Returns the inviter's referral code + the shareable join link, plus
     * the history of direct email invites they've sent.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');
        $code = $me->ensureReferralCode();

        $invites = CommunityInvite::query()
            ->where('inviter_id', $me->id)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn (CommunityInvite $i) => [
                'id'          => $i->id,
                'email'       => $i->email,
                'status'      => $i->status,
                'sent_at'     => $i->sent_at?->toIso8601String(),
                'accepted_at' => $i->accepted_at?->toIso8601String(),
            ]);

        return response()->json([
            'referral_code' => $code,
            'invite_url'    => $this->joinUrl($code),
            'invites'       => $invites,
        ]);
    }

    /**
     * POST /api/community/invites
     * Body: { email: string, note?: string }
     *
     * Sends a branded invite email through CommunityMailer. The recipient
     * lands on the sign-up screen with the inviter's referral code
     * pre-filled (?invited_by=CODE). Acceptance is recorded later when
     * they sign up — there's no auto-connection.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');
        $code = $me->ensureReferralCode();

        $data = $request->validate([
            'email' => 'required|email|max:255',
            'note'  => 'nullable|string|max:600',
        ]);

        $email = strtolower(trim($data['email']));

        // Friendly guard against the obvious mistakes.
        if ($email === strtolower($me->email)) {
            return response()->json(['message' => 'That’s your own email.'], 422);
        }
        if (CommunityMember::where('email', $email)->whereNull('deleted_at')->exists()) {
            return response()->json(['message' => 'Someone with that email is already a member. You can find them on Discover once they show up in your radius.'], 422);
        }

        // Soft de-dup: if we already invited this address recently, just
        // resend the email and update the timestamp rather than spamming
        // them with duplicate rows.
        $invite = CommunityInvite::query()
            ->where('inviter_id', $me->id)
            ->where('email', $email)
            ->where('status', 'sent')
            ->first();
        if (!$invite) {
            $invite = CommunityInvite::create([
                'inviter_id' => $me->id,
                'email'      => $email,
                'note'       => $data['note'] ?? null,
                'status'     => 'sent',
                'sent_at'    => now(),
            ]);
        } else {
            $invite->forceFill([
                'note'    => $data['note'] ?? $invite->note,
                'sent_at' => now(),
            ])->save();
        }

        $url = $this->joinUrl($code);
        $firstName = preg_split('/\s+/', trim($me->name))[0] ?? $me->name;

        $noteHtml = $data['note']
            ? '<p style="border-left:3px solid #6492D8;padding-left:14px;color:#3B2F2A;font-style:italic;">'
                . nl2br(e(trim($data['note']))) . '</p>'
            : '';

        $content =
            '<p>' . e($firstName) . ' thought you might want to join The Pupper Club&rsquo;s Community.</p>'
          . $noteHtml
          . '<p>The Community is a small, trusted circle of verified neighbours who help each other with their pets &mdash; dog walks, drop-in visits, the occasional overnight when life happens. No marketplace, no ratings, no money changes hands.</p>'
          . '<p style="color:#5a4a44;font-style:italic;">You never know who could be down the street, and longing to be besties with your pup!</p>'
          . '<p style="margin:28px 0;">'
              . '<a href="' . e($url) . '" '
              . 'style="background:#6492D8;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:50px;display:inline-block;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:13px;">'
              . 'Join the Community'
              . '</a>'
          . '</p>'
          . '<p style="color:#5a4a44;font-size:13px;">Or paste this link into your browser:<br>'
              . '<span style="color:#6492D8;">' . e($url) . '</span></p>';

        $sent = $this->mailer->send(
            toEmail:     $email,
            subject:     $firstName . ' invited you to The Pupper Club Community',
            title:       'You’re invited to The Pupper Club Community',
            htmlContent: $content,
            replyTo:     $me->email,
            replyToName: $me->name,
        );

        if (!$sent) {
            Log::info('Community invite send failed', [
                'inviter_id' => $me->id,
                'email'      => $email,
            ]);
            return response()->json([
                'message' => 'We saved your invite. Email is having a moment — we’ll retry shortly.',
                'data'    => $this->shapeInvite($invite),
            ], 202);
        }

        return response()->json(['data' => $this->shapeInvite($invite)], 201);
    }

    /**
     * DELETE /api/community/invites/{invite}
     * Used to hide / cancel a pending invite row from the inviter's list.
     */
    public function destroy(Request $request, CommunityInvite $invite): JsonResponse
    {
        /** @var CommunityMember $me */
        $me = $request->attributes->get('community_member');

        if ($invite->inviter_id !== $me->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $invite->delete();
        return response()->json(['message' => 'Removed.']);
    }

    private function joinUrl(string $code): string
    {
        $base = rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/');
        return $base . '/community/app/sign-up?invited_by=' . urlencode($code);
    }

    private function shapeInvite(CommunityInvite $i): array
    {
        return [
            'id'          => $i->id,
            'email'       => $i->email,
            'status'      => $i->status,
            'sent_at'     => $i->sent_at?->toIso8601String(),
            'accepted_at' => $i->accepted_at?->toIso8601String(),
        ];
    }
}

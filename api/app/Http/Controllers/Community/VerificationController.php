<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Stripe\Stripe;
use Stripe\Webhook;

class VerificationController extends Controller
{
    /**
     * POST /api/community/verification/start
     *
     * Create a Stripe Identity VerificationSession for the authenticated
     * member and return the hosted-page URL. The desktop client opens that
     * URL in the system browser; we update the member's status from a
     * webhook once Stripe confirms the result.
     */
    public function start(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        if ($member->status === 'verified') {
            return response()->json(['message' => 'Already verified.'], 422);
        }

        Stripe::setApiKey(config('services.stripe.secret'));

        $frontendUrl = rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/');

        try {
            $session = \Stripe\Identity\VerificationSession::create([
                'type'     => 'document',
                'metadata' => [
                    'community_member_id' => (string) $member->id,
                ],
                'options' => [
                    'document' => [
                        'allowed_types'           => ['driving_license', 'passport', 'id_card'],
                        'require_live_capture'    => true,
                        'require_matching_selfie' => true,
                    ],
                ],
                'return_url' => $frontendUrl . '/community/verification-complete',
            ]);
        } catch (\Throwable $e) {
            Log::error('Stripe Identity session create failed', [
                'member_id' => $member->id,
                'error'     => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Unable to start verification. Please try again in a moment.'], 502);
        }

        $member->forceFill([
            'verification_provider'   => 'stripe_identity',
            'verification_session_id' => $session->id,
        ])->save();

        return response()->json([
            'url'        => $session->url,
            'session_id' => $session->id,
            'expires_at' => $session->client_secret ? null : null, // included for future client-side flow
        ]);
    }

    /**
     * POST /api/webhooks/stripe-identity
     *
     * Stripe posts here whenever a VerificationSession changes state. We
     * verify the signature with the dedicated identity webhook secret
     * (separate from the main payments webhook).
     */
    public function webhook(Request $request): Response
    {
        Stripe::setApiKey(config('services.stripe.secret'));
        $secret = config('services.stripe.identity_webhook_secret');

        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                $request->header('Stripe-Signature') ?? '',
                $secret,
            );
        } catch (\Throwable $e) {
            return response('Invalid signature.', 400);
        }

        $session = $event->data->object ?? null;
        if (!$session) return response('OK', 200);

        $memberId = (int) ($session->metadata->community_member_id ?? 0);
        if (!$memberId) return response('OK', 200);

        $member = CommunityMember::find($memberId);
        if (!$member) return response('OK', 200);

        match ($event->type) {
            'identity.verification_session.verified' => $this->markVerified($member, $session->id),
            // requires_input means Stripe needs the user to redo something;
            // we keep the member in pending state and surface the next-step
            // URL the next time they request a new session.
            'identity.verification_session.requires_input' => $this->markPending($member, 'requires_input'),
            'identity.verification_session.canceled'       => $this->markPending($member, 'canceled'),
            default                                        => null,
        };

        return response('OK', 200);
    }

    private function markVerified(CommunityMember $member, string $sessionId): void
    {
        $member->forceFill([
            'status'                  => 'verified',
            'verified_at'             => now(),
            'verification_provider'   => 'stripe_identity',
            'verification_session_id' => $sessionId,
        ])->save();
    }

    private function markPending(CommunityMember $member, string $reason): void
    {
        // No status change — but we log so admins can spot a member who's
        // had multiple cancellations in a row.
        Log::info('Community verification non-terminal event', [
            'member_id' => $member->id,
            'reason'    => $reason,
        ]);
    }
}

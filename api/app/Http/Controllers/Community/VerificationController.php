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
     * Cents charged for the one-time ID-verification fee. We pass this
     * through to the member to cover Stripe Identity's per-check cost.
     */
    private const VERIFICATION_FEE_CENTS = 500;

    /**
     * GET /api/community/verification/status
     *
     * Lightweight read used by the verification screen to decide whether
     * to show the "pay $5" CTA, the "start ID check" CTA, or the "done"
     * confirmation.
     */
    public function status(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        return response()->json([
            'status'    => $member->status,
            'paid'      => (bool) $member->verification_paid_at,
            'paid_at'   => $member->verification_paid_at?->toIso8601String(),
            'fee_cents' => self::VERIFICATION_FEE_CENTS,
            'currency'  => 'cad',
        ]);
    }

    /**
     * POST /api/community/verification/checkout
     *
     * Create a Stripe Checkout Session for the one-time $5 verification
     * fee. The session's metadata carries the member id so the webhook
     * can flip `verification_paid_at` once payment confirms.
     *
     * Idempotent against the "already paid" state — if the member has
     * already paid we just return a no-op response so the UI can move on.
     */
    public function checkout(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        if ($member->status === 'verified') {
            return response()->json(['message' => 'Already verified.'], 422);
        }
        if ($member->verification_paid_at) {
            return response()->json([
                'paid'        => true,
                'redirect_url' => null,
            ]);
        }

        Stripe::setApiKey(config('services.stripe.secret'));
        $frontendUrl = $this->safeFrontendUrl($request);

        try {
            $session = \Stripe\Checkout\Session::create([
                'mode'                 => 'payment',
                'payment_method_types' => ['card'],
                // Surface the "Add promotion code" field on Stripe Checkout
                // so members can apply codes like THEGOODEST (100% off).
                // When the total hits $0, Stripe finalises the session
                // without a card charge and the same
                // checkout.session.completed webhook still fires — so our
                // verification_paid_at flag flips normally.
                'allow_promotion_codes' => true,
                'line_items'           => [[
                    'quantity'   => 1,
                    'price_data' => [
                        'currency'     => 'cad',
                        'unit_amount'  => self::VERIFICATION_FEE_CENTS,
                        'product_data' => [
                            'name'        => 'Community identity verification',
                            'description' => 'One-time fee that covers Stripe Identity’s per-check cost. The Pupper Club doesn’t earn anything from it.',
                        ],
                    ],
                ]],
                'customer_email' => $member->email,
                'metadata'       => [
                    'community_member_id' => (string) $member->id,
                    'kind'                => 'community_verification_fee',
                ],
                'success_url' => $frontendUrl . '/community/app/verify?paid=1',
                'cancel_url'  => $frontendUrl . '/community/app/verify?cancelled=1',
            ]);
        } catch (\Throwable $e) {
            Log::error('Stripe Checkout session create failed', [
                'member_id' => $member->id,
                'error'     => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Unable to open checkout. Please try again in a moment.'], 502);
        }

        $member->forceFill([
            'verification_checkout_session_id' => $session->id,
        ])->save();

        return response()->json([
            'url'        => $session->url,
            'session_id' => $session->id,
        ]);
    }

    /**
     * POST /api/community/verification/start
     *
     * Create a Stripe Identity VerificationSession for the authenticated
     * member and return the hosted-page URL. The desktop client opens that
     * URL in the system browser; we update the member's status from a
     * webhook once Stripe confirms the result.
     *
     * Gated on `verification_paid_at` — the $5 fee must be paid first.
     */
    public function start(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        if ($member->status === 'verified') {
            return response()->json(['message' => 'Already verified.'], 422);
        }

        if (!$member->verification_paid_at) {
            return response()->json([
                'message'         => 'The $5 verification fee must be paid first.',
                'requires_payment' => true,
            ], 402);
        }

        Stripe::setApiKey(config('services.stripe.secret'));

        $frontendUrl = $this->safeFrontendUrl($request);

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
                'return_url' => $frontendUrl . '/community/app/verify?id=done',
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
        ]);
    }

    /**
     * POST /api/webhooks/stripe-identity
     *
     * Stripe posts here whenever a VerificationSession changes state. We
     * verify the signature with the dedicated identity webhook secret.
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
            'identity.verification_session.requires_input' => $this->markPending($member, 'requires_input'),
            'identity.verification_session.canceled'       => $this->markPending($member, 'canceled'),
            default                                        => null,
        };

        return response('OK', 200);
    }

    /**
     * POST /api/webhooks/stripe (community-checkout subset)
     *
     * Subscribed to `checkout.session.completed`. Only acts on sessions
     * whose metadata.kind is `community_verification_fee` so we don't
     * collide with the main paid-service Stripe webhook handler.
     */
    public function checkoutWebhook(Request $request): Response
    {
        Stripe::setApiKey(config('services.stripe.secret'));
        $secret = config('services.stripe.community_checkout_webhook_secret')
            ?: config('services.stripe.webhook_secret');

        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                $request->header('Stripe-Signature') ?? '',
                $secret,
            );
        } catch (\Throwable $e) {
            return response('Invalid signature.', 400);
        }

        if ($event->type !== 'checkout.session.completed') {
            return response('OK', 200);
        }

        $session = $event->data->object ?? null;
        if (!$session) return response('OK', 200);

        $kind     = $session->metadata->kind ?? null;
        $memberId = (int) ($session->metadata->community_member_id ?? 0);
        if ($kind !== 'community_verification_fee' || !$memberId) {
            return response('OK', 200);
        }

        $member = CommunityMember::find($memberId);
        if (!$member) return response('OK', 200);

        if (!$member->verification_paid_at) {
            $member->forceFill([
                'verification_paid_at'             => now(),
                'verification_checkout_session_id' => $session->id,
            ])->save();
        }

        return response('OK', 200);
    }

    /**
     * Pick the frontend origin Stripe should redirect back to. We use the
     * request's Origin (preferred) or Referer header if it matches one of
     * the host names we ship to; otherwise fall back to the config default.
     *
     * Members access the SPA at either the apex (https://thepupperclub.ca)
     * or the www subdomain. Redirecting back to the *wrong* one means
     * landing on a different localStorage origin — which boots them out
     * because the bearer token can't be read.
     */
    public static function safeFrontendUrl(Request $request): string
    {
        $allowed = [
            'https://thepupperclub.ca',
            'https://www.thepupperclub.ca',
        ];
        $candidate = $request->headers->get('Origin') ?? $request->headers->get('Referer');
        if ($candidate) {
            $parsed = parse_url($candidate);
            if ($parsed && !empty($parsed['scheme']) && !empty($parsed['host'])) {
                $origin = $parsed['scheme'] . '://' . $parsed['host'];
                if (in_array($origin, $allowed, true)) {
                    return $origin;
                }
            }
        }
        return rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/');
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
        Log::info('Community verification non-terminal event', [
            'member_id' => $member->id,
            'reason'    => $reason,
        ]);
    }
}

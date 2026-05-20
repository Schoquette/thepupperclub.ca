<?php

namespace App\Http\Controllers\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Stripe;

class DonationsController extends Controller
{
    /** $1 .. $1000 in CAD cents. */
    private const MIN_CENTS = 100;
    private const MAX_CENTS = 100_000;

    /**
     * POST /api/community/donations/checkout
     * Body: { amount_cents: int }
     *
     * Creates a one-off Stripe Checkout Session in payment mode and
     * returns the hosted-page URL. Metadata tags the session as a
     * `community_donation` so the existing community-checkout webhook
     * ignores it (donations don't grant verification access).
     */
    public function checkout(Request $request): JsonResponse
    {
        /** @var CommunityMember $member */
        $member = $request->attributes->get('community_member');

        $data = $request->validate([
            'amount_cents' => 'required|integer|min:' . self::MIN_CENTS . '|max:' . self::MAX_CENTS,
        ]);

        Stripe::setApiKey(config('services.stripe.secret'));
        $frontendUrl = rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/');

        try {
            $session = \Stripe\Checkout\Session::create([
                'mode'                 => 'payment',
                'payment_method_types' => ['card'],
                'submit_type'          => 'donate',
                'line_items'           => [[
                    'quantity'   => 1,
                    'price_data' => [
                        'currency'     => 'cad',
                        'unit_amount'  => $data['amount_cents'],
                        'product_data' => [
                            'name'        => 'Community contribution',
                            'description' => 'A voluntary contribution to keep The Pupper Club Community running.',
                        ],
                    ],
                ]],
                'customer_email' => $member->email,
                'metadata' => [
                    'community_member_id' => (string) $member->id,
                    'kind'                => 'community_donation',
                ],
                'success_url' => $frontendUrl . '/community/app/donate?thanks=1',
                'cancel_url'  => $frontendUrl . '/community/app/donate',
            ]);
        } catch (\Throwable $e) {
            Log::error('Stripe Checkout (donation) failed', [
                'member_id' => $member->id,
                'cents'     => $data['amount_cents'],
                'error'     => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Unable to open the donation page. Please try again in a moment.'], 502);
        }

        return response()->json([
            'url'        => $session->url,
            'session_id' => $session->id,
        ]);
    }
}

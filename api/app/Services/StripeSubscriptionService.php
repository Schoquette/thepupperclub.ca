<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use Stripe\StripeClient;

class StripeSubscriptionService
{
    private ?StripeClient $stripe = null;

    private function stripe(): StripeClient
    {
        if (!$this->stripe) {
            $key = config('services.stripe.secret');
            abort_unless($key, 500, 'Stripe secret key is not configured.');
            $this->stripe = new StripeClient($key);
        }
        return $this->stripe;
    }

    /**
     * Create or update a subscription for a client.
     * For CC/interac_pad billing: creates a real Stripe Subscription (auto-charges).
     * For e-transfer/cash: stores plan locally (invoiced via GenerateSubscriptionInvoices).
     *
     * @param string|null $effectiveDate  When the new plan takes effect (for mid-cycle changes).
     *                                     null = immediate for new, or next billing date for changes.
     */
    public function subscribe(User $client, string $stripePriceId, ?string $effectiveDate = null): array
    {
        $profile = $client->clientProfile;
        abort_unless($profile, 422, 'Client has no profile.');

        // Look up the price to get product info
        try {
            $price = $this->stripe()->prices->retrieve($stripePriceId, ['expand' => ['product']]);
            $productName = is_object($price->product) ? $price->product->name : 'Subscription';
            $amount = $price->unit_amount / 100;
        } catch (\Exception $e) {
            throw new \RuntimeException('Could not retrieve plan from Stripe: ' . $e->getMessage());
        }

        $billingMethod = $profile->billing_method ?? 'credit_card';

        // For non-CC/non-PAD billing, just store locally — no Stripe subscription
        if (!in_array($billingMethod, ['credit_card', 'interac_pad'])) {
            // Cancel any existing Stripe subscription first
            if ($profile->stripe_subscription_id) {
                try {
                    $this->stripe()->subscriptions->cancel($profile->stripe_subscription_id);
                } catch (\Exception $e) {}
            }

            $isNewSubscription = !$profile->subscription_plan;
            $oldAmount = (float) ($profile->subscription_amount ?? 0);
            $oldPlan = $profile->subscription_plan;
            $prorationCredit = null;

            // Calculate proration if changing plan mid-cycle
            if (!$isNewSubscription && $effectiveDate && $profile->next_billing_date) {
                $effective = Carbon::parse($effectiveDate);
                $nextBilling = Carbon::parse($profile->next_billing_date);
                $prevBilling = $nextBilling->copy()->subMonth();

                // Days remaining in current cycle from effective date
                $totalDays = $prevBilling->diffInDays($nextBilling);
                $remainingDays = $effective->diffInDays($nextBilling);

                if ($remainingDays > 0 && $totalDays > 0) {
                    // Credit for unused days on old plan, charge for remaining days on new plan
                    $dailyOld = $oldAmount / $totalDays;
                    $dailyNew = $amount / $totalDays;
                    $prorationCredit = round(($dailyNew - $dailyOld) * $remainingDays, 2);
                }
            }

            $profile->update([
                'stripe_subscription_id'  => null,
                'stripe_price_id'         => $stripePriceId,
                'subscription_plan'       => $productName,
                'subscription_amount'     => (string) $amount,
                'subscription_tier'       => $price->nickname ?? strtolower($productName),
                'subscription_start_date' => $isNewSubscription ? ($effectiveDate ? Carbon::parse($effectiveDate) : now()) : $profile->subscription_start_date,
                'next_billing_date'       => $isNewSubscription ? ($effectiveDate ? Carbon::parse($effectiveDate)->addMonth() : now()->addMonth()) : $profile->next_billing_date,
                'subscription_end_date'   => null,
            ]);

            return [
                'action'     => $isNewSubscription ? 'created' : 'updated',
                'type'       => 'local',
                'proration'  => $prorationCredit,
                'old_plan'   => $oldPlan,
                'old_amount' => $oldAmount,
            ];
        }

        // CC/interac_pad billing — create Stripe subscription for auto-charge
        // Ensure Stripe customer exists
        if (!$profile->stripe_customer_id) {
            $customer = $this->stripe()->customers->create([
                'email'    => $client->email,
                'name'     => $client->name,
                'metadata' => ['user_id' => $client->id],
            ]);
            $profile->update(['stripe_customer_id' => $customer->id]);
        }

        // If client already has an active subscription, update it
        if ($profile->stripe_subscription_id) {
            try {
                $sub = $this->stripe()->subscriptions->retrieve($profile->stripe_subscription_id);
                if (in_array($sub->status, ['active', 'trialing', 'past_due'])) {
                    $sub = $this->stripe()->subscriptions->update($profile->stripe_subscription_id, [
                        'items' => [
                            ['id' => $sub->items->data[0]->id, 'price' => $stripePriceId],
                        ],
                        'proration_behavior' => 'create_prorations',
                    ]);

                    $this->syncProfileFromSubscription($profile, $sub, $price);
                    return ['action' => 'updated', 'type' => 'stripe', 'proration' => null];
                }
            } catch (\Exception $e) {
                // Subscription doesn't exist in Stripe anymore, create new one
            }
        }

        // Ensure client has a payment method for CC billing
        if ($billingMethod === 'credit_card') {
            abort_unless($profile->stripe_payment_method_id, 422, 'Client must have a card on file before subscribing with credit card.');
        }

        $sub = $this->stripe()->subscriptions->create([
            'customer'               => $profile->stripe_customer_id,
            'default_payment_method' => $profile->stripe_payment_method_id,
            'items'                  => [['price' => $stripePriceId]],
            'currency'               => 'cad',
            'metadata'               => ['user_id' => $client->id],
        ]);

        $this->syncProfileFromSubscription($profile, $sub, $price);
        return ['action' => 'created', 'type' => 'stripe', 'proration' => null];
    }

    /**
     * Cancel subscription at period end.
     */
    public function cancel(User $client): void
    {
        $profile = $client->clientProfile;

        if ($profile?->stripe_subscription_id) {
            $this->stripe()->subscriptions->update($profile->stripe_subscription_id, [
                'cancel_at_period_end' => true,
            ]);
        } else {
            // Local-only subscription — set end date
            $profile?->update(['subscription_end_date' => $profile->next_billing_date ?? now()]);
        }
    }

    /**
     * Cancel subscription immediately.
     */
    public function cancelImmediately(User $client): void
    {
        $profile = $client->clientProfile;

        if ($profile?->stripe_subscription_id) {
            try {
                $this->stripe()->subscriptions->cancel($profile->stripe_subscription_id);
            } catch (\Exception $e) {}
        }

        $profile?->update([
            'stripe_subscription_id' => null,
            'stripe_price_id'        => null,
            'subscription_end_date'  => now(),
        ]);
    }

    /**
     * Sync local profile fields from the Stripe subscription object.
     */
    public function syncProfileFromSubscription($profile, $sub, $price = null): void
    {
        $priceObj = $price ?? $sub->items->data[0]->price;
        $productName = is_object($priceObj->product) ? $priceObj->product->name : null;

        if (!$productName && is_string($priceObj->product)) {
            try {
                $product = $this->stripe()->products->retrieve($priceObj->product);
                $productName = $product->name;
            } catch (\Exception $e) {
                $productName = $priceObj->nickname ?? 'Subscription';
            }
        }

        $profile->update([
            'stripe_subscription_id'  => $sub->id,
            'stripe_price_id'         => $priceObj->id,
            'subscription_plan'       => $productName,
            'subscription_amount'     => (string) ($priceObj->unit_amount / 100),
            'subscription_tier'       => $priceObj->nickname ?? strtolower($productName ?? ''),
            'subscription_start_date' => Carbon::createFromTimestamp($sub->current_period_start),
            'next_billing_date'       => Carbon::createFromTimestamp($sub->current_period_end),
            'subscription_end_date'   => $sub->cancel_at ? Carbon::createFromTimestamp($sub->cancel_at) : null,
        ]);
    }
}

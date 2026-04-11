<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\User;
use App\Services\InvoiceService;
use App\Services\StripeSubscriptionService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Stripe\Event;
use Stripe\Stripe;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    public function __construct(
        private InvoiceService $invoiceService,
        private StripeSubscriptionService $subscriptionService,
    ) {}

    public function handle(Request $request): Response
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                $request->header('Stripe-Signature'),
                config('services.stripe.webhook_secret')
            );
        } catch (\Exception $e) {
            return response('Invalid signature.', 400);
        }

        match ($event->type) {
            'invoice.created'                  => $this->onInvoiceCreated($event),
            'invoice.finalized'                => $this->onInvoiceFinalized($event),
            'invoice.payment_succeeded'        => $this->onInvoicePaid($event),
            'invoice.payment_failed'           => $this->onInvoiceFailed($event),
            'customer.subscription.updated'    => $this->onSubscriptionUpdated($event),
            'customer.subscription.deleted'    => $this->onSubscriptionDeleted($event),
            'payment_intent.succeeded'         => $this->onPaymentIntentSucceeded($event),
            default                            => null,
        };

        return response('OK', 200);
    }

    /**
     * Stripe created an invoice (e.g. for a subscription renewal).
     * Create a matching local invoice record.
     */
    private function onInvoiceCreated(Event $event): void
    {
        $stripeInvoice = $event->data->object;

        // Skip if we already have this invoice
        if (Invoice::where('stripe_invoice_id', $stripeInvoice->id)->exists()) {
            return;
        }

        $user = $this->findUserByCustomer($stripeInvoice->customer);
        if (!$user) return;

        $invoice = Invoice::create([
            'user_id'            => $user->id,
            'invoice_number'     => Invoice::generateNumber(),
            'stripe_invoice_id'  => $stripeInvoice->id,
            'status'             => 'draft',
            'subtotal'           => ($stripeInvoice->subtotal ?? 0) / 100,
            'gst'                => ($stripeInvoice->tax ?? 0) / 100,
            'total'              => ($stripeInvoice->total ?? 0) / 100,
            'due_date'           => $stripeInvoice->due_date ? Carbon::createFromTimestamp($stripeInvoice->due_date) : null,
        ]);

        // Create line items from Stripe invoice lines
        if (isset($stripeInvoice->lines->data)) {
            foreach ($stripeInvoice->lines->data as $line) {
                InvoiceLineItem::create([
                    'invoice_id'  => $invoice->id,
                    'description' => $line->description ?? 'Subscription',
                    'quantity'    => $line->quantity ?? 1,
                    'unit_price'  => ($line->unit_amount ?? $line->amount ?? 0) / 100,
                    'total'       => ($line->amount ?? 0) / 100,
                ]);
            }
        }
    }

    /**
     * Stripe finalized an invoice — it's now payable.
     * Update status to 'sent' and notify the client.
     */
    private function onInvoiceFinalized(Event $event): void
    {
        $stripeInvoice = $event->data->object;

        $invoice = Invoice::where('stripe_invoice_id', $stripeInvoice->id)->first();

        // If we missed the invoice.created event, create the local record now
        if (!$invoice) {
            $this->onInvoiceCreated($event);
            $invoice = Invoice::where('stripe_invoice_id', $stripeInvoice->id)->first();
        }

        if (!$invoice) return;

        // Update totals from the finalized invoice
        $invoice->update([
            'subtotal' => ($stripeInvoice->subtotal ?? 0) / 100,
            'gst'      => ($stripeInvoice->tax ?? 0) / 100,
            'total'    => ($stripeInvoice->total ?? 0) / 100,
            'due_date' => $stripeInvoice->due_date ? Carbon::createFromTimestamp($stripeInvoice->due_date) : null,
        ]);

        // Send notification to client (sets status to 'sent')
        if ($invoice->status !== 'sent') {
            $this->invoiceService->send($invoice);
        }
    }

    /**
     * Stripe collected payment on an invoice.
     */
    private function onInvoicePaid(Event $event): void
    {
        $stripeInvoice = $event->data->object;

        $invoice = Invoice::where('stripe_invoice_id', $stripeInvoice->id)->first();

        // If we missed earlier events, create the record now
        if (!$invoice) {
            $this->onInvoiceCreated($event);
            $invoice = Invoice::where('stripe_invoice_id', $stripeInvoice->id)->first();
        }

        if ($invoice && $invoice->status !== 'paid') {
            // Store the payment intent for reference
            if ($stripeInvoice->payment_intent) {
                $invoice->update(['stripe_payment_intent_id' => $stripeInvoice->payment_intent]);
            }
            $this->invoiceService->markPaid($invoice);
        }
    }

    /**
     * Stripe failed to collect payment.
     */
    private function onInvoiceFailed(Event $event): void
    {
        $stripeInvoice = $event->data->object;
        $invoice = Invoice::where('stripe_invoice_id', $stripeInvoice->id)->first();
        if ($invoice) {
            app(\App\Services\AdminNotificationService::class)->invoicePaymentFailed($invoice);
        }
    }

    /**
     * Subscription was updated (plan change, renewal, etc.)
     */
    private function onSubscriptionUpdated(Event $event): void
    {
        $subscription = $event->data->object;
        $user = $this->findUserByCustomer($subscription->customer);
        if (!$user || !$user->clientProfile) return;

        $this->subscriptionService->syncProfileFromSubscription(
            $user->clientProfile,
            $subscription
        );
    }

    /**
     * Subscription was fully deleted/canceled.
     */
    private function onSubscriptionDeleted(Event $event): void
    {
        $subscription = $event->data->object;
        $user = $this->findUserByCustomer($subscription->customer);
        if (!$user || !$user->clientProfile) return;

        $user->clientProfile->update([
            'stripe_subscription_id' => null,
            'stripe_price_id'        => null,
            'subscription_end_date'  => now(),
        ]);
    }

    /**
     * A PaymentIntent succeeded (for ad-hoc invoice payments made through the portal).
     */
    private function onPaymentIntentSucceeded(Event $event): void
    {
        $intent = $event->data->object;
        $invoice = Invoice::where('stripe_payment_intent_id', $intent->id)->first();
        if ($invoice && $invoice->status !== 'paid') {
            $this->invoiceService->markPaid($invoice);
        }
    }

    private function findUserByCustomer(string $customerId): ?User
    {
        return User::whereHas('clientProfile', fn($q) =>
            $q->where('stripe_customer_id', $customerId)
        )->first();
    }
}

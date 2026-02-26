<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\User;
use App\Services\InvoiceService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Stripe\Event;
use Stripe\Stripe;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    public function __construct(private InvoiceService $invoiceService) {}

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
            'invoice.payment_succeeded'        => $this->onInvoicePaid($event),
            'invoice.payment_failed'           => $this->onInvoiceFailed($event),
            'customer.subscription.updated'    => $this->onSubscriptionUpdated($event),
            'payment_intent.succeeded'         => $this->onPaymentIntentSucceeded($event),
            default                            => null,
        };

        return response('OK', 200);
    }

    private function onInvoicePaid(Event $event): void
    {
        $stripeInvoice = $event->data->object;
        $invoice = Invoice::where('stripe_invoice_id', $stripeInvoice->id)->first();
        if ($invoice) {
            $this->invoiceService->markPaid($invoice);
        }
    }

    private function onInvoiceFailed(Event $event): void
    {
        $stripeInvoice = $event->data->object;
        $invoice = Invoice::where('stripe_invoice_id', $stripeInvoice->id)->first();
        if ($invoice) {
            // Notify admin and client
            app(\App\Services\AdminNotificationService::class)->invoicePaymentFailed($invoice);
        }
    }

    private function onSubscriptionUpdated(Event $event): void
    {
        $subscription = $event->data->object;
        $customer = User::whereHas('clientProfile', fn($q) =>
            $q->where('stripe_customer_id', $subscription->customer)
        )->first();

        if ($customer) {
            $customer->clientProfile->update([
                'subscription_tier' => $subscription->items->data[0]->price->nickname ?? null,
            ]);
        }
    }

    private function onPaymentIntentSucceeded(Event $event): void
    {
        $intent = $event->data->object;
        $invoice = Invoice::where('stripe_payment_intent_id', $intent->id)->first();
        if ($invoice) {
            $this->invoiceService->markPaid($invoice);
        }
    }
}

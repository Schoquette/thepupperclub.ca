<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Stripe\PaymentIntent;
use Stripe\Stripe;

class InvoiceService
{
    private const GST_RATE       = 0.05;
    private const CC_SURCHARGE   = 0.029;

    public function create(User $client, array $lineItems, ?string $dueDate = null, ?string $notes = null): Invoice
    {
        $invoice = Invoice::create([
            'user_id'        => $client->id,
            'invoice_number' => Invoice::generateNumber(),
            'status'         => 'draft',
            'due_date'       => $dueDate,
            'notes'          => $notes,
        ]);

        $this->attachLineItems($invoice, $lineItems);
        $this->recalculate($invoice);

        return $invoice;
    }

    public function attachLineItems(Invoice $invoice, array $lineItems): void
    {
        foreach ($lineItems as $item) {
            $total = $item['quantity'] * $item['unit_price'];
            $invoice->lineItems()->create(array_merge($item, ['total' => $total]));
        }
    }

    public function recalculate(Invoice $invoice): void
    {
        $invoice->refresh();
        $subtotal  = $invoice->lineItems->sum('total');
        $gst       = round($subtotal * self::GST_RATE, 2);

        $billingMethod = $invoice->user->clientProfile?->billing_method ?? 'credit_card';
        $surcharge = $billingMethod === 'credit_card'
            ? round(($subtotal + $gst) * self::CC_SURCHARGE, 2)
            : 0;

        $total = $subtotal + $gst + $surcharge + $invoice->tip;

        $invoice->update(compact('subtotal', 'gst', 'total') + ['credit_card_surcharge' => $surcharge]);
    }

    public function send(Invoice $invoice): void
    {
        $invoice->update(['status' => 'sent']);

        $adminId = \App\Models\User::where('role', 'admin')->value('id') ?? 1;

        // Send invoice message in conversation thread
        $conversation = $invoice->user->conversation()->firstOrCreate(['user_id' => $invoice->user_id]);
        $conversation->messages()->create([
            'sender_id' => $adminId,
            'type'      => 'invoice',
            'body'      => "Invoice #{$invoice->invoice_number} for \${$invoice->total} is ready.",
            'metadata'  => [
                'invoice_id'     => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'total'          => $invoice->total,
                'due_date'       => $invoice->due_date?->toDateString(),
            ],
        ]);

        $conversation->increment('unread_count_client');
        $conversation->update(['last_message_at' => now()]);
    }

    public function markPaid(Invoice $invoice): void
    {
        $invoice->update(['status' => 'paid', 'paid_at' => now()]);

        // Notify client via push + thread message
        app(VisitNotificationService::class)->sendInvoicePaid($invoice);
    }

    public function chargeCard(Invoice $invoice, string $paymentMethodId): array
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        $stripeCustomerId = $invoice->user->clientProfile?->stripe_customer_id;

        $intent = PaymentIntent::create([
            'amount'               => (int) ($invoice->total * 100),
            'currency'             => 'cad',
            'customer'             => $stripeCustomerId,
            'payment_method'       => $paymentMethodId,
            'confirm'              => true,
            'return_url'           => config('app.frontend_url') . '/client/invoices',
            'metadata'             => ['invoice_id' => $invoice->id],
        ]);

        $invoice->update(['stripe_payment_intent_id' => $intent->id]);

        if ($intent->status === 'succeeded') {
            $this->markPaid($invoice);
        }

        return ['client_secret' => $intent->client_secret, 'status' => $intent->status];
    }

    public function addTip(Invoice $invoice, float $amount): Invoice
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        $intent = PaymentIntent::create([
            'amount'         => (int) ($amount * 100),
            'currency'       => 'cad',
            'customer'       => $invoice->user->clientProfile?->stripe_customer_id,
            'metadata'       => ['invoice_id' => $invoice->id, 'type' => 'tip'],
        ]);

        $invoice->increment('tip', $amount);
        $invoice->increment('total', $amount);

        return $invoice->fresh();
    }

    public function dashboardSummary(): array
    {
        $monthStart = now()->startOfMonth();
        $monthEnd   = now()->endOfMonth();

        return [
            'billed_this_month'    => Invoice::whereBetween('created_at', [$monthStart, $monthEnd])->sum('total'),
            'collected_this_month' => Invoice::where('status', 'paid')->whereBetween('paid_at', [$monthStart, $monthEnd])->sum('total'),
            'outstanding'          => Invoice::whereIn('status', ['sent', 'overdue'])->sum('total'),
            'overdue_count'        => Invoice::where('status', 'overdue')->count(),
        ];
    }
}

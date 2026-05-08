<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Stripe\PaymentIntent;
use Stripe\Stripe;

class InvoiceService
{
    private const METHOD_LABELS = [
        'credit_card' => 'Credit Card',
        'e_transfer'  => 'E-Transfer',
        'cash'        => 'Cash',
    ];
    private const GST_RATE       = 0.05;
    private const CC_SURCHARGE   = 0.02;

    public function create(
        User $client,
        array $lineItems,
        ?string $dueDate = null,
        ?string $notes = null,
        ?bool $applyCcSurcharge = null,
        ?string $billingPeriodStart = null,
        ?string $billingPeriodEnd = null,
    ): Invoice {
        $billingMethod = $client->clientProfile?->billing_method ?? 'credit_card';

        // Auto-apply CC surcharge if billing method is credit_card (unless explicitly overridden)
        if ($applyCcSurcharge === null) {
            $applyCcSurcharge = $billingMethod === 'credit_card';
        }

        $invoice = Invoice::create([
            'user_id'              => $client->id,
            'invoice_number'       => Invoice::generateNumber(),
            'status'               => 'draft',
            'due_date'             => $dueDate,
            'notes'                => $notes,
            'apply_cc_surcharge'   => $applyCcSurcharge,
            'billing_method'       => $billingMethod,
            'billing_period_start' => $billingPeriodStart,
            'billing_period_end'   => $billingPeriodEnd,
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

        $surcharge = $invoice->apply_cc_surcharge
            ? round(($subtotal + $gst) * self::CC_SURCHARGE, 2)
            : 0;

        $total = $subtotal + $gst + $surcharge + $invoice->tip;

        $invoice->update(compact('subtotal', 'gst', 'total') + ['credit_card_surcharge' => $surcharge]);
    }

    public function send(Invoice $invoice): void
    {
        $invoice->update(['status' => 'sent']);
        $this->sendConversationMessage($invoice);
        $this->sendInvoiceEmail($invoice, 'invoice');
    }

    public function resend(Invoice $invoice, ?string $customMessage = null): void
    {
        $this->sendConversationMessage($invoice, '', $customMessage);
        $this->sendInvoiceEmail($invoice, 'invoice', $customMessage);
    }

    public function sendReminder(Invoice $invoice, ?string $customMessage = null): void
    {
        $this->sendConversationMessage($invoice, 'Reminder: ', $customMessage);
        $this->sendInvoiceEmail($invoice, 'reminder', $customMessage);
    }

    public function sendPaidNotification(Invoice $invoice): void
    {
        $this->sendInvoiceEmail($invoice, 'paid');
    }

    private function sendConversationMessage(Invoice $invoice, string $prefix = '', ?string $customMessage = null): void
    {
        $adminId = \App\Models\User::where('role', 'admin')->value('id') ?? 1;
        $conversation = $invoice->user->conversation()->firstOrCreate(['user_id' => $invoice->user_id]);

        if ($customMessage) {
            $body = $customMessage;
        } else {
            $body = "{$prefix}Invoice #{$invoice->invoice_number} for \${$invoice->total} is ready.";
            if ($invoice->billing_period_start && $invoice->billing_period_end) {
                $body .= " Service period: {$invoice->billing_period_start->format('F j, Y')} - {$invoice->billing_period_end->format('F j, Y')}.";
            }
        }

        $conversation->messages()->create([
            'sender_id' => $adminId,
            'type'      => 'invoice',
            'body'      => $body,
            'metadata'  => [
                'invoice_id'            => $invoice->id,
                'invoice_number'        => $invoice->invoice_number,
                'total'                 => $invoice->total,
                'due_date'              => $invoice->due_date?->toDateString(),
                'billing_period_start'  => $invoice->billing_period_start?->toDateString(),
                'billing_period_end'    => $invoice->billing_period_end?->toDateString(),
            ],
        ]);

        $conversation->increment('unread_count_client');
        $conversation->update(['last_message_at' => now()]);
    }

    private function sendInvoiceEmail(Invoice $invoice, string $type, ?string $customMessage = null): void
    {
        $client = $invoice->user;
        $billingPeriod = null;
        if ($invoice->billing_period_start && $invoice->billing_period_end) {
            $billingPeriod = $invoice->billing_period_start->format('F j, Y') . ' - ' . $invoice->billing_period_end->format('F j, Y');
        }

        $titles = [
            'invoice'  => "Invoice #{$invoice->invoice_number} — The Pupper Club",
            'reminder' => "Payment Reminder — Invoice #{$invoice->invoice_number}",
            'paid'     => "Payment Received — Invoice #{$invoice->invoice_number}",
        ];

        $portalUrls = [
            'invoice'  => rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/') . '/client/invoices',
            'reminder' => rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/') . '/client/billing',
            'paid'     => rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/') . '/client/invoices',
        ];

        $title = $titles[$type] ?? $titles['invoice'];
        $methodLabel = self::METHOD_LABELS[$invoice->billing_method] ?? $invoice->billing_method;

        $htmlBody = view('emails.invoice', [
            'title'         => $title,
            'userName'      => $client->name,
            'type'          => $type,
            'invoiceNumber' => $invoice->invoice_number,
            'total'         => number_format($invoice->total, 2),
            'dueDate'       => $invoice->due_date?->format('F j, Y'),
            'billingPeriod' => $billingPeriod,
            'paymentMethod' => $methodLabel,
            'portalUrl'     => $portalUrls[$type] ?? $portalUrls['invoice'],
            'customMessage' => $customMessage,
        ])->render();

        $plainBody = $customMessage
            ?? "Invoice #{$invoice->invoice_number} for \${$invoice->total} CAD.";
        if (!$customMessage && $billingPeriod) {
            $plainBody .= " Service period: {$billingPeriod}.";
        }

        app(NotificationDispatcher::class)->notify($client, $title, $plainBody, $htmlBody, type: 'invoices');
    }

    public function markPaid(Invoice $invoice): void
    {
        $invoice->update(['status' => 'paid', 'paid_at' => now()]);

        // Send thank-you message in conversation
        $adminId = \App\Models\User::where('role', 'admin')->value('id') ?? 1;
        $conversation = $invoice->user->conversation()->firstOrCreate(['user_id' => $invoice->user_id]);
        $conversation->messages()->create([
            'sender_id' => $adminId,
            'type'      => 'text',
            'body'      => "Thank you for your payment, and being an awesome client!",
        ]);
        $conversation->increment('unread_count_client');
        $conversation->update(['last_message_at' => now()]);

        $this->sendPaidNotification($invoice);
    }

    public function chargeCard(Invoice $invoice, string $paymentMethodId): array
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        // If this invoice came from Stripe (subscription), pay via Stripe Invoice API
        if ($invoice->stripe_invoice_id) {
            $stripeInvoice = \Stripe\Invoice::retrieve($invoice->stripe_invoice_id);

            if ($stripeInvoice->status === 'open') {
                $result = $stripeInvoice->pay(['payment_method' => $paymentMethodId]);
                if ($result->status === 'paid') {
                    $this->markPaid($invoice);
                }
                return ['status' => $result->status === 'paid' ? 'succeeded' : 'pending'];
            }

            // Already paid in Stripe
            if ($stripeInvoice->status === 'paid') {
                $this->markPaid($invoice);
                return ['status' => 'succeeded'];
            }
        }

        // For ad-hoc invoices, use PaymentIntent
        $stripeCustomerId = $invoice->user->clientProfile?->stripe_customer_id;

        $intent = PaymentIntent::create([
            'amount'               => (int) ($invoice->total * 100),
            'currency'             => 'cad',
            'customer'             => $stripeCustomerId,
            'payment_method'       => $paymentMethodId,
            'confirm'              => true,
            'return_url'           => rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/') . '/client/invoices',
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

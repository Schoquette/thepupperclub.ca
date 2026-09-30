<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\InvoiceLineItem;
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
        // Auto-add gst_exempt column if missing
        if (!\Illuminate\Support\Facades\Schema::hasColumn('invoice_line_items', 'gst_exempt')) {
            \Illuminate\Support\Facades\Schema::table('invoice_line_items', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->boolean('gst_exempt')->default(false);
            });
        }

        // Auto-add discount columns if missing
        if (!\Illuminate\Support\Facades\Schema::hasColumn('invoice_line_items', 'discount_type')) {
            \Illuminate\Support\Facades\Schema::table('invoice_line_items', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->string('discount_type', 10)->default('none');
                $table->decimal('discount_value', 10, 2)->default(0);
            });
        }

        // Auto-widen quantity from integer to decimal if needed (was originally unsignedSmallInteger)
        $colInfo = \Illuminate\Support\Facades\DB::selectOne(
            'SHOW COLUMNS FROM invoice_line_items WHERE Field = ?', ['quantity']
        );
        if ($colInfo && !str_contains(strtolower($colInfo->Type ?? ''), 'decimal')) {
            \Illuminate\Support\Facades\DB::statement(
                'ALTER TABLE invoice_line_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00'
            );
        }

        foreach ($lineItems as $item) {
            $lineSubtotal = $item['quantity'] * $item['unit_price'];
            $discountType = $item['discount_type'] ?? 'none';
            $discountAmount = InvoiceLineItem::computeDiscountAmount($lineSubtotal, $discountType, $item['discount_value'] ?? 0);
            $total = round($lineSubtotal - $discountAmount, 2);

            $invoice->lineItems()->create(array_merge($item, [
                'discount_type'  => $discountType,
                'discount_value' => $item['discount_value'] ?? 0,
                'total'          => $total,
                'gst_exempt'     => (bool) ($item['gst_exempt'] ?? false),
            ]));
        }
    }

    public function recalculate(Invoice $invoice): void
    {
        $invoice->refresh();
        $subtotal  = $invoice->lineItems->sum('total');
        $taxable   = $invoice->lineItems->where('gst_exempt', false)->sum('total');
        $gst       = round($taxable * self::GST_RATE, 2);

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
        $this->maybeChargeOnSend($invoice);
    }

    /**
     * Subscription/PAYG billing-cycle invoices (identified by having a
     * billing period — ad-hoc invoices created via Invoice Create don't
     * set one) auto-charge the client's card at send time, now that
     * nothing charges automatically on a schedule. Sending is the
     * deliberate manual-approval action that now also triggers the charge
     * for credit-card clients with a saved card; anyone else (no card,
     * e-transfer, cash, or an ad-hoc invoice) just gets the email as
     * before, and pays via the portal or another channel.
     */
    private function maybeChargeOnSend(Invoice $invoice): void
    {
        if (!$invoice->billing_period_start) return;

        $profile = $invoice->user->clientProfile;
        if (!$profile || $profile->billing_method !== 'credit_card' || !$profile->stripe_payment_method_id) {
            return;
        }

        try {
            $result = $this->chargeCard($invoice, $profile->stripe_payment_method_id);
            if ($result['status'] !== 'succeeded') {
                \Illuminate\Support\Facades\Log::warning("Charge-on-send pending for invoice {$invoice->id}: status {$result['status']}");
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Charge-on-send failed for invoice {$invoice->id}: {$e->getMessage()}");
            try {
                \App\Models\ErrorLog::create([
                    'user_id'    => $invoice->user_id,
                    'type'       => 'InvoiceChargeOnSendFailed',
                    'message'    => $e->getMessage(),
                    'context'    => ['invoice_id' => $invoice->id, 'invoice_number' => $invoice->invoice_number],
                    'created_at' => now(),
                ]);
            } catch (\Throwable $logError) {}
        }
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

        app(NotificationDispatcher::class)->notify($client, $title, $plainBody, $htmlBody, type: 'invoices', bcc: 'sophie@thepupperclub.ca');
    }

    public function markPaid(Invoice $invoice, bool $notifyClient = true, ?string $paidAt = null): void
    {
        $invoice->update(['status' => 'paid', 'paid_at' => $paidAt ? \Carbon\Carbon::parse($paidAt) : now()]);

        // Credit a prepaid pack purchase now that it's actually paid for —
        // covers admin "Mark Paid", the synchronous chargeCard() success
        // path, and the Stripe webhook, since all three funnel through here.
        if (\Illuminate\Support\Facades\Schema::hasColumn('invoices', 'payg_pack_service_type') && $invoice->payg_pack_service_type) {
            $column = "pack_purchased_{$invoice->payg_pack_service_type}";
            if (!\Illuminate\Support\Facades\Schema::hasColumn('client_profiles', $column)) {
                \Illuminate\Support\Facades\Schema::table('client_profiles', function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->unsignedInteger('pack_purchased_walk_30')->default(0);
                    $table->unsignedInteger('pack_purchased_walk_60')->default(0);
                    $table->unsignedInteger('pack_purchased_pack_hike')->default(0);
                });
            }
            \App\Models\ClientProfile::where('user_id', $invoice->user_id)
                ->increment($column, $invoice->payg_pack_quantity ?? 10);
        }

        if (!$notifyClient) {
            return;
        }

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

    /**
     * Correct the recorded payment date on an already-paid invoice, so
     * monthly income reporting (dashboardSummary()'s collected_this_month,
     * which filters on paid_at) reflects when the money actually came in
     * rather than whenever the invoice happened to get marked paid.
     * Deliberately separate from update() -- every other field on a paid
     * invoice stays locked.
     */
    public function updatePaidDate(Invoice $invoice, string $paidAt): void
    {
        $invoice->update(['paid_at' => \Carbon\Carbon::parse($paidAt)]);
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

    private const VISIT_TYPE_LABELS = [
        'walk_30'   => '30-Minute Visits',
        'walk_60'   => '60-Minute Visits',
        'pack_hike' => 'Group Hikes',
    ];

    /**
     * Creates a one-line invoice for a prepaid 10-pack purchase, tagged so
     * markPaid() knows to credit the client's pack balance once it's
     * actually paid — the balance is never credited at creation time.
     */
    public function createPackPurchaseInvoice(User $client, string $serviceType, int $quantity, int $packPriceCents): Invoice
    {
        if (!\Illuminate\Support\Facades\Schema::hasColumn('invoices', 'payg_pack_service_type')) {
            \Illuminate\Support\Facades\Schema::table('invoices', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->string('payg_pack_service_type')->nullable();
                $table->unsignedInteger('payg_pack_quantity')->nullable();
            });
        }

        $label = self::VISIT_TYPE_LABELS[$serviceType] ?? $serviceType;

        $invoice = $this->create(
            $client,
            [[
                'description'  => "10-Pack — {$label}",
                'quantity'     => 1,
                'unit_price'   => round($packPriceCents / 100, 2),
                'service_date' => now()->toDateString(),
            ]],
            now()->toDateString(),
        );

        $invoice->update(['payg_pack_service_type' => $serviceType, 'payg_pack_quantity' => $quantity]);

        return $invoice;
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

    /**
     * @param array{status?: ?string, user_id?: ?string, month?: ?string} $filters
     *   Same shape as the filters accepted by index() — applied on top of
     *   each metric's own built-in status/date constraint, so e.g. filtering
     *   to "Draft" correctly zeroes out Collected/Outstanding rather than
     *   ignoring the filter.
     */
    public function dashboardSummary(array $filters = []): array
    {
        if (!empty($filters['month'])) {
            $monthStart = \Carbon\Carbon::parse($filters['month'] . '-01')->startOfMonth();
            $monthEnd   = $monthStart->copy()->endOfMonth();
        } else {
            $monthStart = now()->startOfMonth();
            $monthEnd   = now()->endOfMonth();
        }

        $applyFilters = function ($query) use ($filters) {
            return $query
                ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
                ->when($filters['user_id'] ?? null, fn ($q, $userId) => $q->where('user_id', $userId));
        };

        $billedQuery = $applyFilters(Invoice::whereBetween('created_at', [$monthStart, $monthEnd]));
        $collectedQuery = $applyFilters(
            Invoice::where('status', 'paid')->whereBetween('paid_at', [$monthStart, $monthEnd])
        );
        $outstandingQuery = $applyFilters(Invoice::whereIn('status', ['sent', 'overdue']));
        $overdueQuery = $applyFilters(Invoice::where('status', 'overdue'));

        $buildFilteredQuery = fn () => $applyFilters(Invoice::query())
            ->when(!empty($filters['month']), fn ($q) => $q->whereBetween('created_at', [$monthStart, $monthEnd]));

        return [
            'billed_this_month'    => $billedQuery->sum('total'),
            'collected_this_month' => $collectedQuery->sum('total'),
            'outstanding'          => $outstandingQuery->sum('total'),
            'overdue_count'        => $overdueQuery->count(),
            'filtered_total'       => $buildFilteredQuery()->sum('total'),
            'filtered_count'       => $buildFilteredQuery()->count(),
        ];
    }

    /**
     * Month-by-month revenue projection assuming every currently-active
     * subscription continues unchanged. A subscription paused through a
     * given month is excluded from that month's total, then reappears
     * once its pause window (subscription_paused_until) has passed —
     * an indefinite pause (no end date) is excluded from every month.
     */
    public function subscriptionProjections(int $months = 6): array
    {
        $profiles = \App\Models\ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->whereHas('user', fn ($q) => $q->where('status', 'active'))
            ->get(['user_id', 'subscription_amount', 'subscription_plan', 'subscription_paused_from', 'subscription_paused_until']);

        $start = now()->startOfMonth();
        $result = [];

        for ($i = 0; $i < $months; $i++) {
            $monthStart = $start->copy()->addMonths($i);

            $total = 0.0;
            $count = 0;
            foreach ($profiles as $profile) {
                if ($profile->subscription_paused_from) {
                    $pausedUntil = $profile->subscription_paused_until;
                    $stillPaused = !$pausedUntil || $monthStart->lte($pausedUntil);
                    if ($stillPaused) continue;
                }
                $total += (float) $profile->subscription_amount;
                $count++;
            }

            $result[] = [
                'month'              => $monthStart->format('Y-m'),
                'label'              => $monthStart->format('F Y'),
                'projected_total'    => round($total, 2),
                'active_subscribers' => $count,
            ];
        }

        return $result;
    }
}

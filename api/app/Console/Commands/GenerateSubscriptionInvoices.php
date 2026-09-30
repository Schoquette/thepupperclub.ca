<?php

namespace App\Console\Commands;

use App\Models\Appointment;
use App\Models\ClientProfile;
use App\Models\Invoice;
use App\Models\User;
use App\Services\InvoiceService;
use App\Services\NotificationDispatcher;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class GenerateSubscriptionInvoices extends Command
{
    protected $signature = 'billing:generate-subscription-invoices';
    protected $description = 'Generate draft subscription invoices 7 days before billing and send reminders — actual sending/charging requires manual approval';

    public function handle(InvoiceService $invoiceService, NotificationDispatcher $dispatcher): void
    {
        // ── 0. Auto-resume expired pauses ────────────────────────────────────
        $this->autoResumeExpiredPauses();

        // ── 1. Generate invoices 7 days before billing date (all clients) ────
        $this->generateUpcomingInvoices($invoiceService);

        // ── 2. Send payment reminder (3 days before billing date) ────────────
        $this->sendUpcomingReminders($dispatcher);

        // ── 3. Auto-send approved invoices on their due date ──────────────────
        $this->sendApprovedInvoices($invoiceService);

        // ── 4. Advance billing date once it passes (all billing methods) ─────
        $this->advanceManualBillingDates();

        // ── 5. Pay-As-You-Go: bill the running tab on the billing date ───────
        $this->generatePaygInvoices($invoiceService);

        $this->info('Done.');
    }

    private function autoResumeExpiredPauses(): void
    {
        $today = now()->toDateString();

        $expired = ClientProfile::whereNotNull('subscription_paused_until')
            ->where('subscription_paused_until', '<=', $today)
            ->get();

        foreach ($expired as $profile) {
            $pausedFrom = Carbon::parse($profile->subscription_paused_from);
            $pausedUntil = Carbon::parse($profile->subscription_paused_until);
            $pausedDays = $pausedFrom->diffInDays($pausedUntil);

            // Push billing date forward if billing was paused
            if ($profile->pause_billing && $profile->next_billing_date) {
                $newBillingDate = Carbon::parse($profile->next_billing_date)->addDays($pausedDays);
                $profile->update(['next_billing_date' => $newBillingDate]);
            }

            $profile->update([
                'subscription_paused_from'  => null,
                'subscription_paused_until' => null,
                'pause_billing'             => true,
                'prorate_on_resume'         => false,
            ]);

            \App\Models\SubscriptionChange::create([
                'user_id'        => $profile->user_id,
                'action'         => 'resumed',
                'old_plan'       => $profile->subscription_plan,
                'new_plan'       => $profile->subscription_plan,
                'effective_date' => $today,
                'notes'          => 'Auto-resumed after pause expired',
                'created_at'     => now(),
            ]);

            $this->info("Auto-resumed subscription for user {$profile->user_id} (pause ended {$pausedUntil->toDateString()}).");
        }
    }

    /**
     * Generate (but do not send) invoices for ALL clients 7 days before
     * their billing date. Left as a draft — billing now requires manual
     * approval/send, which is also what triggers the actual card charge
     * for credit-card clients (see InvoiceService::send()). Invoice due
     * date = billing date (first day of service).
     */
    private function generateUpcomingInvoices(InvoiceService $invoiceService): void
    {
        $today = now()->toDateString();
        $sevenDaysFromNow = now()->addDays(7)->toDateString();

        // Find clients whose billing date is within the next 7 days (catch-up included)
        $clients = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->whereBetween('next_billing_date', [$today, $sevenDaysFromNow])
            ->whereNull('stripe_subscription_id')
            ->whereNull('subscription_paused_from')
            ->with('user')
            ->get();

        foreach ($clients as $profile) {
            $client = $profile->user;
            if (!$client || $client->status !== 'active') continue;

            $billingDate = Carbon::parse($profile->next_billing_date)->toDateString();

            // Skip if an invoice already exists for this billing period
            $existingInvoice = Invoice::where('user_id', $client->id)
                ->where('billing_period_start', $billingDate)
                ->whereNotIn('status', ['void'])
                ->first();

            if ($existingInvoice) continue;

            $plan = $profile->subscription_plan ?? 'Monthly Subscription';
            $amount = (float) $profile->subscription_amount;

            $periodStart = Carbon::parse($billingDate);
            $periodEnd = $periodStart->copy()->addMonth()->subDay();

            $invoice = $invoiceService->create(
                $client,
                [[
                    'description'  => "Monthly subscription — {$plan}",
                    'quantity'     => 1,
                    'unit_price'   => $amount,
                    'service_date' => $billingDate,
                ]],
                $billingDate, // due on the billing date (first day of service)
                null,
                null,
                $periodStart->toDateString(),
                $periodEnd->toDateString(),
            );

            $this->info("Draft invoice #{$invoice->invoice_number} generated for {$client->name} (due {$billingDate}) — awaiting manual approval/send.");
        }
    }

    private function sendUpcomingReminders(NotificationDispatcher $dispatcher): void
    {
        $reminderDate = now()->addDays(3)->toDateString();

        $upcomingClients = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->where('next_billing_date', $reminderDate)
            ->where(fn($q) => $q->whereNull('subscription_paused_from')->orWhere('pause_billing', false))
            ->with('user')
            ->get();

        foreach ($upcomingClients as $profile) {
            $client = $profile->user;
            if (!$client || $client->status !== 'active') continue;

            $billingDate = Carbon::parse($profile->next_billing_date)->format('F j, Y');
            $amount = number_format($profile->subscription_amount, 2);
            $plan = $profile->subscription_plan ?? 'subscription';
            $methodLabel = match ($profile->billing_method) {
                'credit_card' => 'Credit Card',

                'e_transfer'  => 'E-Transfer',
                'cash'        => 'Cash',
                default       => $profile->billing_method,
            };

            // Nothing charges automatically on a schedule anymore — an
            // invoice only gets sent (and, for credit-card clients,
            // charged) once it's been manually reviewed, so this is a
            // heads-up rather than a promise of a specific processing date.
            $title = "Upcoming Payment — The Pupper Club";
            $body = "Your {$plan} invoice of \${$amount} CAD for {$billingDate} will be ready for payment soon. Secure payment can be made in the portal.";

            $htmlBody = view('emails.invoice', [
                'title'         => $title,
                'userName'      => $client->name,
                'type'          => 'reminder',
                'invoiceNumber' => '(upcoming)',
                'total'         => $amount,
                'dueDate'       => $billingDate,
                'billingPeriod' => null,
                'paymentMethod' => $methodLabel,
                'portalUrl'     => rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/') . '/client/billing',
            ])->render();

            $dispatcher->notify($client, $title, $body, $htmlBody, type: 'invoices');
            $this->info("Billing reminder sent to {$client->name} for {$billingDate}.");
        }
    }

    /**
     * Auto-send approved invoices whose due date has arrived. Excludes
     * subscription/PAYG billing-cycle invoices (billing_period_start set)
     * — those need an explicit manual send, since send() is what triggers
     * the card charge for them now; this stage remains for ad-hoc
     * invoices an admin approved but might forget to send by the due date.
     */
    private function sendApprovedInvoices(InvoiceService $invoiceService): void
    {
        $today = now()->toDateString();

        $approvedInvoices = Invoice::where('status', 'approved')
            ->where('due_date', '<=', $today)
            ->whereNull('billing_period_start')
            ->get();

        foreach ($approvedInvoices as $invoice) {
            $invoiceService->send($invoice);
            $this->info("Auto-sent approved invoice #{$invoice->invoice_number} (due {$invoice->due_date->toDateString()}).");
        }
    }

    /**
     * Advance every subscription client's billing date once it passes,
     * regardless of billing method — nothing auto-charges from this
     * command anymore (see InvoiceService::send()), so there's no longer
     * a distinction between "auto-charge CC" and "just advance the date"
     * cases here. The admin approving/sending the draft invoice generated
     * by generateUpcomingInvoices() is what actually collects payment.
     */
    private function advanceManualBillingDates(): void
    {
        $today = now()->toDateString();

        $clients = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->where('next_billing_date', '<=', $today)
            ->whereNull('stripe_subscription_id')
            ->whereNull('subscription_paused_from')
            ->get();

        foreach ($clients as $profile) {
            $nextBilling = $this->nextBillingDate($profile);
            $profile->update(['next_billing_date' => $nextBilling]);
            $this->info("Advanced billing date for user {$profile->user_id} to {$nextBilling}.");
        }
    }

    /**
     * Bill Pay-As-You-Go clients (running-tab mode, and any prepaid-pack
     * overage) on their normal billing date — reusing the same
     * next_billing_date/billing_day fields subscriptions use, just with a
     * variable amount instead of a fixed one. Only visits scheduled on or
     * before the billing date are included; a recurring series can have
     * occurrences already stamped months into the future (pack/running-tab
     * mode is decided at scheduling time, not check-in), and those simply
     * stay unbilled until a later run's billing date reaches them.
     */
    private function generatePaygInvoices(InvoiceService $invoiceService): void
    {
        $today = now()->toDateString();
        $serviceLabels = ['walk_30' => '30-Minute Visit', 'walk_60' => '60-Minute Visit', 'pack_hike' => 'Group Hike'];

        $clients = ClientProfile::whereNotNull('payg_mode')
            ->where('next_billing_date', '<=', $today)
            ->with('user')
            ->get();

        foreach ($clients as $profile) {
            $client = $profile->user;
            if (!$client || $client->status !== 'active') continue;

            $billingDate = Carbon::parse($profile->next_billing_date)->toDateString();

            $unbilled = Appointment::where('user_id', $client->id)
                ->where('payg_charge_mode', 'running_tab')
                ->whereNull('payg_billed_at')
                ->where('status', '!=', 'cancelled')
                ->where('scheduled_time', '<=', $billingDate . ' 23:59:59')
                ->orderBy('scheduled_time')
                ->get();

            if ($unbilled->isEmpty()) {
                $profile->update(['next_billing_date' => $this->nextBillingDate($profile)]);
                continue;
            }

            $lineItems = $unbilled->map(fn ($a) => [
                'description'  => ($serviceLabels[$a->service_type] ?? $a->service_type) . ' — ' . $a->scheduled_time->format('M j, Y'),
                'quantity'     => 1,
                'unit_price'   => (float) $a->payg_rate,
                'service_date' => $a->scheduled_time->toDateString(),
            ])->values()->all();

            $invoice = $invoiceService->create(
                $client,
                $lineItems,
                $billingDate,
                null,
                null,
                $unbilled->first()->scheduled_time->toDateString(),
                $billingDate,
            );

            Appointment::whereIn('id', $unbilled->pluck('id'))->update(['payg_billed_at' => now()]);

            if ($profile->billing_method === 'credit_card' && $profile->stripe_payment_method_id) {
                try {
                    $result = $invoiceService->chargeCard($invoice, $profile->stripe_payment_method_id);
                    if ($result['status'] === 'succeeded') {
                        $this->info("PAYG auto-charged {$client->name} \${$invoice->total} (Invoice #{$invoice->invoice_number}, {$unbilled->count()} visits).");
                    } else {
                        // Notify only — do NOT call send(), which would
                        // re-attempt the charge via maybeChargeOnSend()
                        // and risk a second, independent charge for the
                        // same invoice.
                        if ($invoice->status === 'draft') $invoiceService->markSentAndNotify($invoice);
                        $this->warn("PAYG auto-charge pending for {$client->name}, invoice sent as unpaid.");
                    }
                } catch (\Exception $e) {
                    if ($invoice->status === 'draft') $invoiceService->markSentAndNotify($invoice);
                    Log::warning("PAYG auto-charge failed for client {$client->id}: {$e->getMessage()}");
                    try {
                        \App\Models\ErrorLog::create([
                            'user_id'    => $client->id,
                            'type'       => 'PaygAutoChargeFailed',
                            'message'    => $e->getMessage(),
                            'context'    => ['invoice_id' => $invoice->id, 'invoice_number' => $invoice->invoice_number],
                            'created_at' => now(),
                        ]);
                    } catch (\Throwable $logError) {}
                }
            } else {
                $invoiceService->send($invoice);
                $this->info("PAYG invoice #{$invoice->invoice_number} sent to {$client->name} ({$unbilled->count()} visits, \${$invoice->total}).");
            }

            $profile->update(['next_billing_date' => $this->nextBillingDate($profile)]);
        }
    }

    /**
     * Calculate the next billing date, preserving the original billing day.
     * e.g. billing_day=31: Jan 31 → Feb 28 → Mar 31 → Apr 30 → May 31
     */
    private function nextBillingDate(ClientProfile $profile): string
    {
        $current = Carbon::parse($profile->next_billing_date);
        $billingDay = $profile->billing_day ?? $current->day;

        $next = $current->copy()->addMonth();
        $next->day = min($billingDay, $next->daysInMonth);

        return $next->toDateString();
    }
}

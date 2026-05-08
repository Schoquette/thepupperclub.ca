<?php

namespace App\Console\Commands;

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
    protected $description = 'Generate subscription invoices 7 days before billing, auto-charge CC on due date, send reminders';

    public function handle(InvoiceService $invoiceService, NotificationDispatcher $dispatcher): void
    {
        // ── 0. Auto-resume expired pauses ────────────────────────────────────
        $this->autoResumeExpiredPauses();

        // ── 1. Generate invoices 7 days before billing date (all clients) ────
        $this->generateUpcomingInvoices($invoiceService);

        // ── 2. Send payment reminder (3 days before billing date) ────────────
        $this->sendUpcomingReminders($dispatcher);

        // ── 3. Auto-charge CC clients on billing date ────────────────────────
        $this->autoChargeOnDueDate($invoiceService);

        // ── 4. Advance billing date for non-CC clients on billing date ───────
        $this->advanceManualBillingDates();

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
     * Generate & send invoices for ALL clients 7 days before their billing date.
     * Invoice due date = billing date (first day of service).
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

            $invoiceService->send($invoice);
            $this->info("Invoice #{$invoice->invoice_number} sent to {$client->name} (due {$billingDate}).");
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
                'interac_pad' => 'Interac/PAD',
                'e_transfer'  => 'E-Transfer',
                'cash'        => 'Cash',
                default       => $profile->billing_method,
            };

            $title = "Upcoming Payment — The Pupper Club";
            $body = "Your {$plan} payment of \${$amount} CAD will be processed on {$billingDate}.";

            $autoCharge = in_array($profile->billing_method, ['credit_card', 'interac_pad']);
            if ($autoCharge) {
                $body .= " It will be charged to your {$methodLabel} on file automatically.";
            }

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
     * Auto-charge CC clients on their billing date.
     * Finds the existing invoice (generated 7 days ago) and charges it.
     * If no invoice exists (edge case), creates one on the spot.
     */
    private function autoChargeOnDueDate(InvoiceService $invoiceService): void
    {
        $today = now()->toDateString();

        $autoChargeClients = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->where('next_billing_date', '<=', $today)
            ->whereIn('billing_method', ['credit_card', 'interac_pad'])
            ->whereNotNull('stripe_payment_method_id')
            ->whereNull('stripe_subscription_id')
            ->whereNull('subscription_paused_from')
            ->with('user')
            ->get();

        foreach ($autoChargeClients as $profile) {
            $client = $profile->user;
            if (!$client || $client->status !== 'active') continue;

            $billingDate = Carbon::parse($profile->next_billing_date)->toDateString();
            $plan = $profile->subscription_plan ?? 'Monthly Subscription';
            $amount = (float) $profile->subscription_amount;

            // Look for the invoice that was pre-generated
            $invoice = Invoice::where('user_id', $client->id)
                ->where('billing_period_start', $billingDate)
                ->whereIn('status', ['sent', 'overdue'])
                ->first();

            // If no invoice exists (missed generation window), create one now
            if (!$invoice) {
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
                    $billingDate,
                    null,
                    null,
                    $periodStart->toDateString(),
                    $periodEnd->toDateString(),
                );
            }

            // Attempt to auto-charge
            try {
                $result = $invoiceService->chargeCard($invoice, $profile->stripe_payment_method_id);

                if ($result['status'] === 'succeeded') {
                    $this->info("Auto-charged {$client->name} for \${$amount} (Invoice #{$invoice->invoice_number}).");
                } else {
                    if ($invoice->status === 'draft') {
                        $invoiceService->send($invoice);
                    }
                    $this->warn("Auto-charge pending for {$client->name}, invoice sent as unpaid.");
                }
            } catch (\Exception $e) {
                if ($invoice->status === 'draft') {
                    $invoiceService->send($invoice);
                }
                Log::warning("Auto-charge failed for client {$client->id}: {$e->getMessage()}");
                $this->error("Auto-charge failed for {$client->name}: {$e->getMessage()}. Invoice sent.");
            }

            // Advance next billing date (preserving original billing day)
            $profile->update(['next_billing_date' => $this->nextBillingDate($profile)]);
        }
    }

    /**
     * Advance billing date for non-CC clients (e-transfer, cash) once the billing date passes.
     * Also handles CC clients without a payment method on file.
     */
    private function advanceManualBillingDates(): void
    {
        $today = now()->toDateString();

        // Non-CC clients whose billing date has passed
        $manualClients = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->where('next_billing_date', '<=', $today)
            ->where(function ($q) {
                $q->whereIn('billing_method', ['e_transfer', 'cash'])
                  ->orWhereNull('billing_method');
            })
            ->whereNull('stripe_subscription_id')
            ->whereNull('subscription_paused_from')
            ->get();

        // CC/PAD clients without a payment method (can't auto-charge, just advance)
        $noPaymentMethod = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->where('next_billing_date', '<=', $today)
            ->whereIn('billing_method', ['credit_card', 'interac_pad'])
            ->whereNull('stripe_payment_method_id')
            ->whereNull('stripe_subscription_id')
            ->whereNull('subscription_paused_from')
            ->get();

        $allClients = $manualClients->merge($noPaymentMethod);

        foreach ($allClients as $profile) {
            $nextBilling = $this->nextBillingDate($profile);
            $profile->update(['next_billing_date' => $nextBilling]);
            $this->info("Advanced billing date for user {$profile->user_id} to {$nextBilling}.");
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

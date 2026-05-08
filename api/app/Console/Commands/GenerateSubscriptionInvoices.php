<?php

namespace App\Console\Commands;

use App\Models\ClientProfile;
use App\Models\User;
use App\Services\InvoiceService;
use App\Services\NotificationDispatcher;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class GenerateSubscriptionInvoices extends Command
{
    protected $signature = 'billing:generate-subscription-invoices';
    protected $description = 'Generate monthly subscription invoices, auto-charge card/PAD clients, and send 3-day advance reminders';

    public function handle(InvoiceService $invoiceService, NotificationDispatcher $dispatcher): void
    {
        $today = now()->toDateString();

        // ── 0. Auto-resume expired pauses ────────────────────────────────────
        $this->autoResumeExpiredPauses();

        // ── 1. Send upcoming-payment reminder (3 days before billing date) ───
        $this->sendUpcomingReminders($dispatcher);

        // ── 2. Auto-charge CC/Interac-PAD clients whose billing date is today ──
        $this->autoChargeClients($invoiceService);

        // ── 3. Generate invoices for manual-pay clients (e-transfer, cash) ──
        $this->generateManualInvoices($invoiceService);

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

    private function autoChargeClients(InvoiceService $invoiceService): void
    {
        $today = now()->toDateString();

        $autoChargeClients = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->where('next_billing_date', '<=', $today)
            ->whereIn('billing_method', ['credit_card', 'interac_pad'])
            ->whereNotNull('stripe_payment_method_id')
            ->whereNull('stripe_subscription_id') // skip Stripe-managed subscriptions
            ->whereNull('subscription_paused_from') // skip paused subscriptions
            ->with('user')
            ->get();

        foreach ($autoChargeClients as $profile) {
            $client = $profile->user;
            if (!$client || $client->status !== 'active') continue;

            $plan = $profile->subscription_plan ?? 'Monthly Subscription';
            $amount = (float) $profile->subscription_amount;

            $periodStart = Carbon::parse($today);
            $periodEnd = $periodStart->copy()->addDays(29);

            $invoice = $invoiceService->create(
                $client,
                [[
                    'description' => "Monthly subscription — {$plan}",
                    'quantity'    => 1,
                    'unit_price'  => $amount,
                    'service_date' => $today,
                ]],
                $today,
                null,
                null,
                $periodStart->toDateString(),
                $periodEnd->toDateString(),
            );

            // Attempt to auto-charge
            try {
                $result = $invoiceService->chargeCard($invoice, $profile->stripe_payment_method_id);

                if ($result['status'] === 'succeeded') {
                    $this->info("Auto-charged {$client->name} for \${$amount} (Invoice #{$invoice->invoice_number}).");
                } else {
                    // Payment pending or failed — send as unpaid invoice
                    $invoiceService->send($invoice);
                    $this->warn("Auto-charge pending for {$client->name}, invoice sent as unpaid.");
                }
            } catch (\Exception $e) {
                // Charge failed — send invoice normally so client can pay manually
                $invoiceService->send($invoice);
                Log::warning("Auto-charge failed for client {$client->id}: {$e->getMessage()}");
                $this->error("Auto-charge failed for {$client->name}: {$e->getMessage()}. Invoice sent.");
            }

            // Advance next billing date
            $nextBilling = Carbon::parse($profile->next_billing_date)->addMonth()->toDateString();
            $profile->update(['next_billing_date' => $nextBilling]);
        }
    }

    private function generateManualInvoices(InvoiceService $invoiceService): void
    {
        $today = now()->toDateString();
        $threeDaysFromNow = now()->addDays(3)->toDateString();

        // E-transfer/cash clients: send invoice 3 days BEFORE billing date so they have time to pay
        $earlyInvoiceClients = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->whereBetween('next_billing_date', [$today, $threeDaysFromNow])
            ->where(function ($q) {
                $q->whereIn('billing_method', ['e_transfer', 'cash'])
                  ->orWhereNull('billing_method');
            })
            ->whereNull('stripe_subscription_id')
            ->whereNull('subscription_paused_from') // skip paused subscriptions
            ->with('user')
            ->get();

        foreach ($earlyInvoiceClients as $profile) {
            $client = $profile->user;
            if (!$client || $client->status !== 'active') continue;

            $plan = $profile->subscription_plan ?? 'Monthly Subscription';
            $amount = (float) $profile->subscription_amount;
            $billingDate = $profile->next_billing_date->toDateString();

            $periodStart = Carbon::parse($billingDate);
            $periodEnd = $periodStart->copy()->addDays(29);

            $invoice = $invoiceService->create(
                $client,
                [[
                    'description'  => "Monthly subscription — {$plan}",
                    'quantity'     => 1,
                    'unit_price'   => $amount,
                    'service_date' => $billingDate,
                ]],
                $billingDate, // due on the actual billing date
                null,
                null,
                $periodStart->toDateString(),
                $periodEnd->toDateString(),
            );

            $invoiceService->send($invoice);

            // Advance next billing date
            $nextBilling = Carbon::parse($profile->next_billing_date)->addMonth()->toDateString();
            $profile->update(['next_billing_date' => $nextBilling]);

            $this->info("Invoice #{$invoice->invoice_number} sent early to {$client->name} (due {$billingDate}).");
        }

        // CC/PAD clients who don't have a payment method saved — send on due date
        $noPaymentMethod = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->where('next_billing_date', '<=', $today)
            ->whereIn('billing_method', ['credit_card', 'interac_pad'])
            ->whereNull('stripe_payment_method_id')
            ->whereNull('stripe_subscription_id')
            ->whereNull('subscription_paused_from') // skip paused subscriptions
            ->with('user')
            ->get();

        $allClients = $noPaymentMethod;

        foreach ($allClients as $profile) {
            $client = $profile->user;
            if (!$client || $client->status !== 'active') continue;

            $plan = $profile->subscription_plan ?? 'Monthly Subscription';
            $amount = (float) $profile->subscription_amount;

            $periodStart = Carbon::parse($today);
            $periodEnd = $periodStart->copy()->addDays(29);

            $invoice = $invoiceService->create(
                $client,
                [[
                    'description' => "Monthly subscription — {$plan}",
                    'quantity'    => 1,
                    'unit_price'  => $amount,
                    'service_date' => $today,
                ]],
                $today,
                null,
                null,
                $periodStart->toDateString(),
                $periodEnd->toDateString(),
            );

            $invoiceService->send($invoice);

            $nextBilling = Carbon::parse($profile->next_billing_date)->addMonth()->toDateString();
            $profile->update(['next_billing_date' => $nextBilling]);

            $this->info("Invoice #{$invoice->invoice_number} created for {$client->name}.");
        }
    }
}

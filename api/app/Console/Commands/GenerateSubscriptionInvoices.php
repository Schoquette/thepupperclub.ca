<?php

namespace App\Console\Commands;

use App\Models\ClientProfile;
use App\Models\User;
use App\Services\InvoiceService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class GenerateSubscriptionInvoices extends Command
{
    protected $signature = 'billing:generate-subscription-invoices';
    protected $description = 'Generate monthly subscription invoices and send 3-day advance payment notifications';

    public function handle(InvoiceService $invoiceService): void
    {
        $today = now()->toDateString();

        // ── 1. Send upcoming-payment email (3 days before billing date) ─────────
        $reminderDate = now()->addDays(3)->toDateString();
        $upcomingClients = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->where('next_billing_date', $reminderDate)
            ->with('user')
            ->get();

        foreach ($upcomingClients as $profile) {
            $client = $profile->user;
            if (!$client || $client->status !== 'active') continue;

            $billingDate = Carbon::parse($profile->next_billing_date)->format('F j, Y');
            $amount      = number_format($profile->subscription_amount, 2);
            $plan        = $profile->subscription_plan ?? 'subscription';

            Mail::send([], [], function ($mail) use ($client, $billingDate, $amount, $plan) {
                $mail->to($client->email, $client->name)
                     ->subject('Upcoming payment — The Pupper Club')
                     ->html("
                        <p>Hi {$client->name},</p>
                        <p>Just a heads-up: your <strong>{$plan}</strong> subscription payment of
                           <strong>\${$amount} CAD</strong> will be processed on <strong>{$billingDate}</strong>.</p>
                        <p>If you'd like to update your payment method before then, you can do so in
                           <a href='".config('app.frontend_url')."/client/billing'>your portal</a>.</p>
                        <p>Thanks,<br>Sophie — The Pupper Club</p>
                     ");
            });

            $this->info("Billing reminder sent to {$client->name} for {$billingDate}.");
        }

        // ── 2. Generate invoices for clients whose billing date is today ─────────
        $billingClients = ClientProfile::whereNotNull('subscription_amount')
            ->where('subscription_amount', '>', 0)
            ->where('next_billing_date', $today)
            ->with('user')
            ->get();

        foreach ($billingClients as $profile) {
            $client = $profile->user;
            if (!$client || $client->status !== 'active') continue;

            $plan   = $profile->subscription_plan ?? 'Monthly Subscription';
            $amount = (float) $profile->subscription_amount;

            $invoice = $invoiceService->create($client, [[
                'description'  => "Monthly subscription — {$plan}",
                'quantity'     => 1,
                'unit_price'   => $amount,
                'service_date' => $today,
            ]], Carbon::parse($today)->addDay()->toDateString());  // due next day

            $invoiceService->send($invoice);

            // Advance next_billing_date by one month
            $nextBilling = Carbon::parse($profile->next_billing_date)->addMonth()->toDateString();
            $profile->update(['next_billing_date' => $nextBilling]);

            $this->info("Invoice #{$invoice->invoice_number} created for {$client->name}.");
        }

        $this->info('Done.');
    }
}

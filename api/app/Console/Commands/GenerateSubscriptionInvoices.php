<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\InvoiceService;
use Illuminate\Console\Command;

class GenerateSubscriptionInvoices extends Command
{
    protected $signature = 'billing:generate-subscription-invoices';
    protected $description = 'Generate monthly subscription invoices for clients whose billing date is today';

    public function handle(InvoiceService $invoiceService): void
    {
        $today = now()->day;

        $clients = User::where('role', 'client')
            ->where('status', 'active')
            ->whereHas('clientProfile', function ($q) use ($today) {
                $q->whereNotNull('subscription_tier')
                  ->whereRaw('DAY(subscription_start_date) = ?', [$today]);
            })
            ->with('clientProfile')
            ->get();

        foreach ($clients as $client) {
            $tier = $client->clientProfile->subscription_tier;

            $invoice = $invoiceService->create($client, [[
                'description'  => "Monthly subscription — {$tier}",
                'quantity'     => 1,
                'unit_price'   => $this->tierPrice($tier),
                'service_date' => now()->toDateString(),
            ]]);

            $invoiceService->send($invoice);
            $this->info("Subscription invoice created for {$client->name} (#{$invoice->invoice_number})");
        }
    }

    private function tierPrice(string $tier): float
    {
        return match (strtolower($tier)) {
            'basic'    => 249.00,
            'standard' => 399.00,
            'premium'  => 549.00,
            default    => 0.00,
        };
    }
}

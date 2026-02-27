<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Services\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\SetupIntent;
use Stripe\Stripe;

class InvoiceController extends Controller
{
    public function __construct(private InvoiceService $invoiceService) {}

    public function index(Request $request): JsonResponse
    {
        $invoices = $request->user()
            ->invoices()
            ->with('lineItems')
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($invoices);
    }

    public function pay(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless($invoice->user_id === $request->user()->id, 403);
        abort_unless(in_array($invoice->status, ['sent', 'overdue']), 422, 'Invoice is not payable.');

        $request->validate(['payment_method_id' => 'required|string']);

        $result = $this->invoiceService->chargeCard($invoice, $request->payment_method_id);

        return response()->json(['data' => $result]);
    }

    public function tip(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless($invoice->user_id === $request->user()->id, 403);
        abort_unless($invoice->status === 'paid', 422, 'Can only tip on paid invoices.');

        $request->validate([
            'amount' => 'required|numeric|min:0.50',
        ]);

        $result = $this->invoiceService->addTip($invoice, $request->amount);

        return response()->json(['data' => $result]);
    }

    /**
     * Create a Stripe SetupIntent so the client can save a card on file.
     */
    public function setupIntent(Request $request): JsonResponse
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        $user    = $request->user();
        $profile = $user->clientProfile;

        // Ensure Stripe customer exists
        if (!$profile?->stripe_customer_id) {
            $customer = \Stripe\Customer::create([
                'email' => $user->email,
                'name'  => $user->name,
            ]);
            $profile->update(['stripe_customer_id' => $customer->id]);
        }

        $intent = SetupIntent::create([
            'customer' => $profile->stripe_customer_id,
            'usage'    => 'off_session',
        ]);

        return response()->json(['client_secret' => $intent->client_secret]);
    }

    /**
     * Save a confirmed payment method as the default for this client.
     */
    public function savePaymentMethod(Request $request): JsonResponse
    {
        $request->validate(['payment_method_id' => 'required|string']);

        Stripe::setApiKey(config('services.stripe.secret'));

        $user    = $request->user();
        $profile = $user->clientProfile;

        // Attach to customer
        $pm = \Stripe\PaymentMethod::retrieve($request->payment_method_id);
        $pm->attach(['customer' => $profile->stripe_customer_id]);

        // Set as default
        \Stripe\Customer::update($profile->stripe_customer_id, [
            'invoice_settings' => ['default_payment_method' => $request->payment_method_id],
        ]);

        $profile->update(['stripe_payment_method_id' => $request->payment_method_id]);

        return response()->json(['message' => 'Payment method saved.']);
    }

    /**
     * Get the saved payment method details.
     */
    public function paymentMethod(Request $request): JsonResponse
    {
        $profile = $request->user()->clientProfile;

        if (!$profile?->stripe_payment_method_id) {
            return response()->json(['data' => null]);
        }

        try {
            Stripe::setApiKey(config('services.stripe.secret'));
            $pm = \Stripe\PaymentMethod::retrieve($profile->stripe_payment_method_id);
            return response()->json(['data' => [
                'brand'    => $pm->card?->brand,
                'last4'    => $pm->card?->last4,
                'exp_month' => $pm->card?->exp_month,
                'exp_year'  => $pm->card?->exp_year,
            ]]);
        } catch (\Exception $e) {
            return response()->json(['data' => null]);
        }
    }
}

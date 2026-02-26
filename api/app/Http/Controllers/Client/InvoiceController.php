<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Services\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\User;
use App\Services\InvoiceService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class InvoiceController extends Controller
{
    public function __construct(private InvoiceService $invoiceService) {}

    public function index(Request $request): JsonResponse
    {
        $query = Invoice::with(['user.clientProfile', 'lineItems'])
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->month, function ($q) use ($request) {
                $q->whereYear('created_at', substr($request->month, 0, 4))
                  ->whereMonth('created_at', substr($request->month, 5, 2));
            })
            ->orderBy('created_at', 'desc');

        return response()->json($query->paginate(25));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id'     => 'required|exists:users,id',
            'due_date'    => 'nullable|date',
            'notes'       => 'nullable|string',
            'line_items'  => 'required|array|min:1',
            'line_items.*.description'  => 'required|string',
            'line_items.*.quantity'     => 'required|integer|min:1',
            'line_items.*.unit_price'   => 'required|numeric|min:0',
            'line_items.*.service_date' => 'nullable|date',
            'line_items.*.appointment_id' => 'nullable|exists:appointments,id',
        ]);

        $invoice = $this->invoiceService->create(
            User::find($data['user_id']),
            $data['line_items'],
            $data['due_date'] ?? null,
            $data['notes'] ?? null
        );

        return response()->json(['data' => $invoice->load('lineItems')], 201);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return response()->json(['data' => $invoice->load(['user.clientProfile', 'lineItems'])]);
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless(in_array($invoice->status, ['draft', 'sent']), 422, 'Cannot edit a paid or void invoice.');

        $data = $request->validate([
            'due_date'   => 'sometimes|nullable|date',
            'notes'      => 'sometimes|nullable|string',
            'line_items' => 'sometimes|array|min:1',
        ]);

        if (isset($data['line_items'])) {
            $invoice->lineItems()->delete();
            $this->invoiceService->attachLineItems($invoice, $data['line_items']);
            $this->invoiceService->recalculate($invoice);
        }

        $invoice->update(array_filter(['due_date' => $data['due_date'] ?? null, 'notes' => $data['notes'] ?? null]));

        return response()->json(['data' => $invoice->fresh('lineItems')]);
    }

    public function markPaid(Invoice $invoice): JsonResponse
    {
        $invoice->update(['status' => 'paid', 'paid_at' => now()]);
        return response()->json(['data' => $invoice->fresh()]);
    }

    public function send(Invoice $invoice): JsonResponse
    {
        $this->invoiceService->send($invoice);
        return response()->json(['message' => 'Invoice sent.']);
    }

    public function pdf(Invoice $invoice): Response
    {
        $pdf = Pdf::loadView('invoices.pdf', [
            'invoice' => $invoice->load(['user.clientProfile', 'lineItems']),
        ]);

        return $pdf->download("invoice-{$invoice->invoice_number}.pdf");
    }

    public function dashboard(): JsonResponse
    {
        return response()->json(['data' => $this->invoiceService->dashboardSummary()]);
    }
}

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
            'user_id'              => 'required|exists:users,id',
            'due_date'             => 'nullable|date',
            'notes'                => 'nullable|string',
            'apply_cc_surcharge'   => 'sometimes|boolean',
            'billing_period_start' => 'nullable|date',
            'billing_period_end'   => 'nullable|date',
            'line_items'           => 'required|array|min:1',
            'line_items.*.description'    => 'required|string',
            'line_items.*.quantity'       => 'required|integer|min:1',
            'line_items.*.unit_price'     => 'required|numeric',
            'line_items.*.service_date'   => 'nullable|date',
            'line_items.*.appointment_id' => 'nullable|exists:appointments,id',
        ]);

        $invoice = $this->invoiceService->create(
            User::find($data['user_id']),
            $data['line_items'],
            $data['due_date'] ?? null,
            $data['notes'] ?? null,
            $data['apply_cc_surcharge'] ?? false,
            $data['billing_period_start'] ?? null,
            $data['billing_period_end'] ?? null,
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
            'due_date'           => 'sometimes|nullable|date',
            'notes'              => 'sometimes|nullable|string',
            'apply_cc_surcharge' => 'sometimes|boolean',
            'line_items'         => 'sometimes|array|min:1',
        ]);

        if (array_key_exists('apply_cc_surcharge', $data)) {
            $invoice->update(['apply_cc_surcharge' => $data['apply_cc_surcharge']]);
        }

        if (isset($data['line_items'])) {
            $invoice->lineItems()->delete();
            $this->invoiceService->attachLineItems($invoice, $data['line_items']);
        }

        // Recalculate if line items or surcharge changed
        if (isset($data['line_items']) || array_key_exists('apply_cc_surcharge', $data)) {
            $this->invoiceService->recalculate($invoice);
        }

        $invoice->update(array_filter(['due_date' => $data['due_date'] ?? null, 'notes' => $data['notes'] ?? null]));

        return response()->json(['data' => $invoice->fresh('lineItems')]);
    }

    public function markPaid(Invoice $invoice): JsonResponse
    {
        $this->invoiceService->markPaid($invoice);
        return response()->json(['data' => $invoice->fresh()]);
    }

    public function void(Invoice $invoice): JsonResponse
    {
        abort_unless(in_array($invoice->status, ['draft', 'sent', 'overdue']), 422, 'Cannot void a paid invoice.');
        $invoice->update(['status' => 'void']);
        return response()->json(['data' => $invoice->fresh()]);
    }

    public function applyDiscount(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless(in_array($invoice->status, ['draft', 'sent']), 422, 'Cannot modify a paid or void invoice.');

        $data = $request->validate([
            'description' => 'required|string|max:255',
            'amount'      => 'required|numeric|min:0.01',
        ]);

        // Add a negative line item for the discount
        $invoice->lineItems()->create([
            'description' => $data['description'],
            'quantity'    => 1,
            'unit_price'  => -$data['amount'],
            'total'       => -$data['amount'],
        ]);

        $this->invoiceService->recalculate($invoice);

        return response()->json(['data' => $invoice->fresh('lineItems')]);
    }

    public function send(Invoice $invoice): JsonResponse
    {
        $this->invoiceService->send($invoice);
        return response()->json(['message' => 'Invoice sent.']);
    }

    public function resend(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless(in_array($invoice->status, ['sent', 'overdue']), 422, 'Can only resend sent or overdue invoices.');
        $data = $request->validate(['message' => 'nullable|string|max:2000']);
        $this->invoiceService->resend($invoice, $data['message'] ?? null);
        return response()->json(['message' => 'Invoice resent.']);
    }

    public function sendReminder(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless(in_array($invoice->status, ['sent', 'overdue']), 422, 'Can only send reminders for sent or overdue invoices.');
        $data = $request->validate(['message' => 'nullable|string|max:2000']);
        $this->invoiceService->sendReminder($invoice, $data['message'] ?? null);
        return response()->json(['message' => 'Payment reminder sent.']);
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

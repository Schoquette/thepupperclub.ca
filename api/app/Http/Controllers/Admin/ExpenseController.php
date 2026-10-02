<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Services\ReceiptExtractionService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExpenseController extends Controller
{
    public function __construct(private ReceiptExtractionService $receiptExtraction) {}

    private function ensureExpensesTable(): void
    {
        if (!Schema::hasTable('expenses')) {
            Schema::create('expenses', function (Blueprint $table) {
                $table->id();
                $table->date('expense_date')->index();
                $table->string('item');
                $table->string('vendor')->index();
                $table->string('category')->index();
                $table->decimal('subtotal', 10, 2);
                $table->decimal('gst', 10, 2)->default(0);
                $table->decimal('pst', 10, 2)->default(0);
                $table->decimal('total', 10, 2);
                $table->string('receipt_path')->nullable();
                $table->string('source')->default('manual');
                $table->timestamps();
            });
        }
    }

    private function applyFilters($query, Request $request)
    {
        return $query
            ->when($request->month, function ($q) use ($request) {
                $start = Carbon::parse($request->month . '-01')->startOfMonth();
                $end = $start->copy()->endOfMonth();
                $q->whereBetween('expense_date', [$start, $end]);
            })
            ->when($request->vendor, fn ($q, $vendor) => $q->where('vendor', $vendor))
            ->when($request->category, fn ($q, $category) => $q->where('category', $category));
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureExpensesTable();

        $query = $this->applyFilters(Expense::query(), $request)
            ->orderByDesc('expense_date');

        return response()->json($query->paginate(20));
    }

    public function vendors(): JsonResponse
    {
        $this->ensureExpensesTable();

        $vendors = Expense::select('vendor')
            ->distinct()
            ->orderBy('vendor')
            ->pluck('vendor');

        return response()->json(['data' => $vendors]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $this->ensureExpensesTable();

        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();

        $filtered = $this->applyFilters(Expense::query(), $request);

        $byCategory = (clone $filtered)
            ->selectRaw('category, SUM(total) as total')
            ->groupBy('category')
            ->orderByDesc('total')
            ->get();

        $byVendor = (clone $filtered)
            ->selectRaw('vendor, SUM(total) as total')
            ->groupBy('vendor')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        return response()->json(['data' => [
            'total_this_month' => Expense::whereBetween('expense_date', [$monthStart, $monthEnd])->sum('total'),
            'filtered_total'   => (clone $filtered)->sum('total'),
            'filtered_count'   => (clone $filtered)->count(),
            'by_category'      => $byCategory,
            'by_vendor'        => $byVendor,
        ]]);
    }

    private function storeReceipt(Expense $expense, $file): void
    {
        $path = $file->store("receipts/{$expense->id}", 'local');
        $expense->update(['receipt_path' => $path]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureExpensesTable();

        $data = $this->validateExpense($request);

        $data['total'] = round($data['subtotal'] + ($data['gst'] ?? 0) + ($data['pst'] ?? 0), 2);
        $data['source'] = $request->source === 'receipt_scan' ? 'receipt_scan' : 'manual';

        $expense = Expense::create($data);

        if ($request->hasFile('receipt')) {
            $this->storeReceipt($expense, $request->file('receipt'));
        }

        return response()->json(['data' => $expense->fresh()], 201);
    }

    public function update(Request $request, Expense $expense): JsonResponse
    {
        $this->ensureExpensesTable();

        $data = $this->validateExpense($request);
        $data['total'] = round($data['subtotal'] + ($data['gst'] ?? 0) + ($data['pst'] ?? 0), 2);

        $expense->update($data);

        if ($request->hasFile('receipt')) {
            if ($expense->receipt_path) {
                Storage::disk('local')->delete($expense->receipt_path);
            }
            $this->storeReceipt($expense, $request->file('receipt'));
        }

        return response()->json(['data' => $expense->fresh()]);
    }

    private function validateExpense(Request $request): array
    {
        return $request->validate([
            'expense_date' => 'required|date',
            'item'         => 'required|string|max:255',
            'vendor'       => 'required|string|max:255',
            'category'     => ['required', Rule::in(Expense::CATEGORIES)],
            'subtotal'     => 'required|numeric|min:0',
            'gst'          => 'nullable|numeric|min:0',
            'pst'          => 'nullable|numeric|min:0',
            'receipt'      => 'nullable|image|max:10240',
        ]);
    }

    public function destroy(Expense $expense): JsonResponse
    {
        $this->ensureExpensesTable();

        if ($expense->receipt_path) {
            Storage::disk('local')->delete($expense->receipt_path);
        }
        $expense->delete();

        return response()->json(['message' => 'Expense deleted.']);
    }

    public function serveReceipt(Expense $expense): StreamedResponse
    {
        abort_unless($expense->receipt_path && Storage::disk('local')->exists($expense->receipt_path), 404);

        return Storage::disk('local')->response($expense->receipt_path);
    }

    // ── Export ───────────────────────────────────────────────────────────────

    public function export(Request $request)
    {
        $this->ensureExpensesTable();

        $request->validate(['format' => 'required|in:csv,pdf']);

        $expenses = $this->applyFilters(Expense::query(), $request)
            ->orderBy('expense_date')
            ->get();

        $columns = ['Date', 'Item', 'Vendor', 'Category', 'Subtotal', 'GST', 'PST', 'Total'];

        $rows = $expenses->map(fn (Expense $e) => [
            $e->expense_date->format('Y-m-d'),
            $e->item,
            $e->vendor,
            $e->category,
            '$' . number_format($e->subtotal, 2),
            '$' . number_format($e->gst, 2),
            '$' . number_format($e->pst, 2),
            '$' . number_format($e->total, 2),
        ])->toArray();

        $summary = [
            'Total Expenses' => count($rows),
            'Subtotal'       => '$' . number_format($expenses->sum('subtotal'), 2),
            'GST'            => '$' . number_format($expenses->sum('gst'), 2),
            'PST'            => '$' . number_format($expenses->sum('pst'), 2),
            'Grand Total'    => '$' . number_format($expenses->sum('total'), 2),
        ];

        if ($request->format === 'csv') {
            return $this->respondCsv('Expenses', $columns, $rows, $summary);
        }

        $dateRange = $request->month
            ? Carbon::parse($request->month . '-01')->format('F Y')
            : 'All Dates';

        return $this->respondPdf('Expenses', $dateRange, $columns, $rows, $summary);
    }

    private function respondCsv(string $title, array $columns, array $rows, array $summary): Response
    {
        $lines = [];
        $lines[] = implode(',', array_map(fn ($c) => '"' . str_replace('"', '""', $c) . '"', $columns));

        foreach ($rows as $row) {
            $lines[] = implode(',', array_map(fn ($v) => '"' . str_replace('"', '""', (string) $v) . '"', $row));
        }

        $lines[] = '';
        foreach ($summary as $label => $value) {
            $lines[] = '"' . $label . '","' . $value . '"';
        }

        $csv = implode("\n", $lines);
        $filename = str_replace(' ', '_', strtolower($title)) . '_' . now()->format('Y-m-d') . '.csv';

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    private function respondPdf(string $title, string $dateRange, array $columns, array $rows, array $summary)
    {
        $pdf = Pdf::setOption(['isRemoteEnabled' => true])
            ->loadView('pdfs.report', compact('title', 'dateRange', 'columns', 'rows', 'summary'))
            ->setPaper('letter', 'landscape');

        $filename = str_replace(' ', '_', strtolower($title)) . '_' . now()->format('Y-m-d') . '.pdf';

        return $pdf->download($filename);
    }

    // ── Spreadsheet import ──────────────────────────────────────────────────

    public function importTemplate(): Response
    {
        $csv = "date,item,vendor,category,subtotal,gst,pst\n"
            . "2026-10-01,Poop bags (bulk),Costco,Supplies,45.00,2.25,3.15\n";

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="expense_import_template.csv"',
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $this->ensureExpensesTable();

        $request->validate([
            'file' => 'required|file|mimes:csv,xlsx,xls|max:10240',
        ]);

        $spreadsheet = IOFactory::load($request->file('file')->getRealPath());
        $rows = $spreadsheet->getActiveSheet()->toArray(null, true, true, false);

        if (empty($rows)) {
            return response()->json(['inserted' => 0, 'defaulted_to_other' => 0, 'errors' => []]);
        }

        $header = array_map(fn ($h) => strtolower(trim((string) $h)), array_shift($rows));
        $colIndex = array_flip($header);

        $required = ['date', 'item', 'vendor', 'subtotal'];
        foreach ($required as $col) {
            if (!isset($colIndex[$col])) {
                return response()->json(['message' => "Missing required column: {$col}"], 422);
            }
        }

        $toInsert = [];
        $errors = [];
        $defaultedToOther = 0;
        $rowNum = 1; // header was row 1

        foreach ($rows as $row) {
            $rowNum++;

            $get = fn (string $col) => isset($colIndex[$col]) ? ($row[$colIndex[$col]] ?? null) : null;

            $isBlank = collect($row)->every(fn ($v) => $v === null || trim((string) $v) === '');
            if ($isBlank) {
                continue;
            }

            $rawDate = $get('date');
            $date = null;
            try {
                $date = $rawDate !== null && trim((string) $rawDate) !== '' ? Carbon::parse($rawDate) : null;
            } catch (\Throwable $e) {
                $date = null;
            }
            if (!$date) {
                $errors[] = ['row' => $rowNum, 'reason' => 'Missing or invalid date.'];
                continue;
            }

            $item = trim((string) $get('item'));
            if ($item === '') {
                $errors[] = ['row' => $rowNum, 'reason' => 'Missing item description.'];
                continue;
            }

            $vendor = trim((string) $get('vendor'));
            if ($vendor === '') {
                $errors[] = ['row' => $rowNum, 'reason' => 'Missing vendor.'];
                continue;
            }

            $subtotalRaw = $get('subtotal');
            if ($subtotalRaw === null || trim((string) $subtotalRaw) === '' || !is_numeric($subtotalRaw)) {
                $errors[] = ['row' => $rowNum, 'reason' => 'Missing or invalid subtotal.'];
                continue;
            }
            $subtotal = round((float) $subtotalRaw, 2);

            $gstRaw = $get('gst');
            $pstRaw = $get('pst');
            if ($gstRaw !== null && trim((string) $gstRaw) !== '' && !is_numeric($gstRaw)) {
                $errors[] = ['row' => $rowNum, 'reason' => 'Invalid GST amount.'];
                continue;
            }
            if ($pstRaw !== null && trim((string) $pstRaw) !== '' && !is_numeric($pstRaw)) {
                $errors[] = ['row' => $rowNum, 'reason' => 'Invalid PST amount.'];
                continue;
            }
            $gst = $gstRaw !== null && trim((string) $gstRaw) !== '' ? round((float) $gstRaw, 2) : 0;
            $pst = $pstRaw !== null && trim((string) $pstRaw) !== '' ? round((float) $pstRaw, 2) : 0;

            $categoryRaw = trim((string) $get('category'));
            $category = collect(Expense::CATEGORIES)->first(
                fn ($c) => strcasecmp($c, $categoryRaw) === 0
            );
            if (!$category) {
                $category = 'Other';
                $defaultedToOther++;
            }

            $toInsert[] = [
                'expense_date' => $date->toDateString(),
                'item'         => $item,
                'vendor'       => $vendor,
                'category'     => $category,
                'subtotal'     => $subtotal,
                'gst'          => $gst,
                'pst'          => $pst,
                'total'        => round($subtotal + $gst + $pst, 2),
                'source'       => 'import',
                'created_at'   => now(),
                'updated_at'   => now(),
            ];
        }

        if (!empty($toInsert)) {
            DB::transaction(function () use ($toInsert) {
                foreach (array_chunk($toInsert, 200) as $chunk) {
                    Expense::insert($chunk);
                }
            });
        }

        return response()->json([
            'inserted'            => count($toInsert),
            'defaulted_to_other'  => $defaultedToOther,
            'errors'              => $errors,
        ]);
    }

    // ── Receipt AI extraction ───────────────────────────────────────────────

    public function extractReceipt(Request $request): JsonResponse
    {
        $request->validate(['receipt' => 'required|image|max:10240']);

        $file = $request->file('receipt');
        $bytes = file_get_contents($file->getRealPath());
        $mimeType = $file->getMimeType() ?: 'image/jpeg';

        $data = $this->receiptExtraction->extract($bytes, $mimeType);

        if ($data === null) {
            return response()->json([
                'success' => false,
                'message' => "Couldn't read this receipt automatically. Please enter the details manually.",
            ]);
        }

        return response()->json(['success' => true, 'data' => $data]);
    }
}

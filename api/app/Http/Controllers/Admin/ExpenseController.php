<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Services\ExpenseCategorizerService;
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
    public function __construct(
        private ReceiptExtractionService $receiptExtraction,
        private ExpenseCategorizerService $categorizer,
    ) {}

    private function ensureExpensesTable(): void
    {
        if (!Schema::hasTable('expenses')) {
            Schema::create('expenses', function (Blueprint $table) {
                $table->id();
                // Nullable throughout except total/category: spreadsheet imports and
                // quick manual entries can be incomplete by design -- the admin fills
                // in the rest later via Edit, so a row is never rejected for missing data.
                $table->date('expense_date')->nullable()->index();
                $table->string('item')->nullable();
                $table->string('vendor')->nullable()->index();
                $table->string('category')->index();
                $table->decimal('subtotal', 10, 2)->nullable();
                $table->decimal('gst', 10, 2)->default(0);
                $table->decimal('pst', 10, 2)->default(0);
                $table->decimal('total', 10, 2)->default(0);
                $table->string('receipt_path')->nullable();
                $table->string('source')->default('manual');
                $table->timestamps();
            });
            return;
        }

        $this->ensureExpensesColumnsNullable();
    }

    /**
     * Heals tables created by an earlier deploy where expense_date/item/
     * vendor/subtotal were still NOT NULL. Raw ALTER (not Schema::change(),
     * which needs doctrine/dbal -- not installed here) to MODIFY each column,
     * mirroring TeamController::ensureTeamMemberRoleEnum()'s approach. Cheap
     * SHOW COLUMNS check first so the ALTER only runs once, ever.
     */
    private function ensureExpensesColumnsNullable(): void
    {
        $columns = [
            'expense_date' => 'date',
            'item'         => 'varchar(255)',
            'vendor'       => 'varchar(255)',
            'subtotal'     => 'decimal(10,2)',
        ];

        foreach ($columns as $column => $type) {
            try {
                $col = DB::selectOne('SHOW COLUMNS FROM expenses WHERE Field = ?', [$column]);
                if ($col && $col->Null === 'NO') {
                    DB::statement("ALTER TABLE expenses MODIFY COLUMN {$column} {$type} NULL");
                }
            } catch (\Throwable $e) {
                try {
                    \App\Models\ErrorLog::create([
                        'type'       => 'SchemaHealFailed',
                        'message'    => $e->getMessage(),
                        'context'    => ['table' => 'expenses', 'column' => $column],
                        'created_at' => now(),
                    ]);
                } catch (\Throwable $logError) {}
            }
        }
    }

    private function ensureCategoriesTable(): void
    {
        if (!Schema::hasTable('expense_categories')) {
            Schema::create('expense_categories', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->timestamps();
            });

            foreach (ExpenseCategory::DEFAULT_SEED as $name) {
                ExpenseCategory::create(['name' => $name]);
            }
        }
    }

    private function categoryNames(): array
    {
        $this->ensureCategoriesTable();

        return ExpenseCategory::orderBy('name')->pluck('name')->all();
    }

    public function categories(): JsonResponse
    {
        $this->ensureCategoriesTable();

        return response()->json(['data' => ExpenseCategory::orderBy('name')->get()]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $this->ensureCategoriesTable();

        $data = $request->validate([
            'name' => 'required|string|max:255|unique:expense_categories,name',
        ]);

        $category = ExpenseCategory::create($data);

        return response()->json(['data' => $category], 201);
    }

    public function updateCategory(Request $request, ExpenseCategory $category): JsonResponse
    {
        $this->ensureCategoriesTable();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('expense_categories', 'name')->ignore($category->id)],
        ]);

        $oldName = $category->name;
        $category->update($data);

        if ($oldName !== $data['name']) {
            $this->ensureExpensesTable();
            Expense::where('category', $oldName)->update(['category' => $data['name']]);
        }

        return response()->json(['data' => $category]);
    }

    public function destroyCategory(ExpenseCategory $category): JsonResponse
    {
        $this->ensureCategoriesTable();

        abort_if($category->name === 'Other', 422, '"Other" can\'t be deleted -- it\'s the fallback category for uncategorized expenses.');

        $this->ensureExpensesTable();
        Expense::where('category', $category->name)->update(['category' => 'Other']);

        $category->delete();

        return response()->json(['message' => 'Category deleted. Any expenses using it were moved to "Other".']);
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

        $vendors = Expense::whereNotNull('vendor')
            ->select('vendor')
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
        $data['category'] = $data['category'] ?? 'Other';
        $data['total'] = round(($data['subtotal'] ?? 0) + ($data['gst'] ?? 0) + ($data['pst'] ?? 0), 2);
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
        $data['category'] = $data['category'] ?? 'Other';
        $data['total'] = round(($data['subtotal'] ?? 0) + ($data['gst'] ?? 0) + ($data['pst'] ?? 0), 2);

        $expense->update($data);

        if ($request->hasFile('receipt')) {
            if ($expense->receipt_path) {
                Storage::disk('local')->delete($expense->receipt_path);
            }
            $this->storeReceipt($expense, $request->file('receipt'));
        }

        return response()->json(['data' => $expense->fresh()]);
    }

    // Everything but the receipt image is optional -- a row saved with gaps
    // (from a quick manual entry or a partial spreadsheet import) can always
    // be filled in later via Edit, rather than being blocked up front.
    private function validateExpense(Request $request): array
    {
        return $request->validate([
            'expense_date' => 'nullable|date',
            'item'         => 'nullable|string|max:255',
            'vendor'       => 'nullable|string|max:255',
            'category'     => ['nullable', Rule::in($this->categoryNames())],
            'subtotal'     => 'nullable|numeric|min:0',
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
            $e->expense_date?->format('Y-m-d') ?? '—',
            $e->item ?? '—',
            $e->vendor ?? '—',
            $e->category,
            '$' . number_format($e->subtotal ?? 0, 2),
            '$' . number_format($e->gst ?? 0, 2),
            '$' . number_format($e->pst ?? 0, 2),
            '$' . number_format($e->total ?? 0, 2),
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

    /**
     * Every row that has *something* in it gets imported, even if incomplete --
     * missing/invalid fields are just left blank (or defaulted, for category)
     * rather than rejecting the row, since the admin can fill gaps in later via
     * Edit. The only rows skipped are fully blank ones (nothing to import).
     */
    public function import(Request $request): JsonResponse
    {
        $this->ensureExpensesTable();

        $request->validate([
            'file' => 'required|file|mimes:csv,xlsx,xls|max:10240',
        ]);

        try {
            $spreadsheet = IOFactory::load($request->file('file')->getRealPath());
        } catch (\Throwable $e) {
            return response()->json(['message' => "Couldn't read this file. Please check it's a valid CSV or Excel file."], 422);
        }

        $rows = $spreadsheet->getActiveSheet()->toArray(null, true, true, false);

        if (empty($rows)) {
            return response()->json(['inserted' => 0, 'incomplete' => 0, 'defaulted_to_other' => 0]);
        }

        $header = array_map(fn ($h) => strtolower(trim((string) $h)), array_shift($rows));

        // Real-world exports rarely use our exact template headers (a bank/
        // card export might call the amount column "Amount" or "Cost", or
        // the date column "Transaction Date") -- match on common synonyms
        // instead of requiring an exact column name.
        $aliases = [
            'date'     => ['date', 'expense date', 'transaction date', 'purchase date', 'trans date'],
            'item'     => ['item', 'description', 'desc', 'details', 'memo', 'expense'],
            'vendor'   => ['vendor', 'merchant', 'payee', 'supplier', 'merchant name'],
            'category' => ['category', 'type', 'expense category'],
            'subtotal' => ['subtotal', 'amount', 'cost', 'price', 'total', 'value'],
            'gst'      => ['gst', 'gst/hst', 'gst amount'],
            'pst'      => ['pst', 'pst amount'],
        ];
        $colMap = [];
        foreach ($aliases as $field => $names) {
            $colMap[$field] = null;
            foreach ($header as $idx => $h) {
                if (in_array($h, $names, true)) {
                    $colMap[$field] = $idx;
                    break;
                }
            }
        }

        $categories = $this->categoryNames();

        $toInsert = [];
        $incomplete = 0;
        $needsCategorization = []; // indices into $toInsert with no category match

        foreach ($rows as $row) {
            $get = fn (string $col) => $colMap[$col] !== null ? ($row[$colMap[$col]] ?? null) : null;
            $str = fn ($v) => $v !== null && trim((string) $v) !== '' ? trim((string) $v) : null;
            $num = fn ($v) => $v !== null && trim((string) $v) !== '' && is_numeric($v) ? round((float) $v, 2) : null;

            $isBlank = collect($row)->every(fn ($v) => $v === null || trim((string) $v) === '');
            if ($isBlank) {
                continue;
            }

            $rawDate = $get('date');
            $date = null;
            if ($str($rawDate) !== null) {
                try {
                    // Excel stores dates as a serial day-count, not text -- a cell
                    // formatted as a date can come through toArray() as a plain
                    // number depending on the source file, so detect that case
                    // before falling back to free-text parsing.
                    if (is_numeric($rawDate) && $rawDate > 20000 && $rawDate < 80000) {
                        $date = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $rawDate)->format('Y-m-d');
                    } else {
                        $date = Carbon::parse($rawDate)->toDateString();
                    }
                } catch (\Throwable $e) {
                    $date = null;
                }
            }

            $item = $str($get('item'));
            $vendor = $str($get('vendor'));
            $subtotal = $num($get('subtotal'));
            $gst = $num($get('gst')) ?? 0;
            $pst = $num($get('pst')) ?? 0;

            if (!$date || !$item || !$vendor || $subtotal === null) {
                $incomplete++;
            }

            $categoryRaw = $str($get('category'));
            $category = $categoryRaw
                ? collect($categories)->first(fn ($c) => strcasecmp($c, $categoryRaw) === 0)
                : null;

            $toInsert[] = [
                'expense_date' => $date,
                'item'         => $item,
                'vendor'       => $vendor,
                'category'     => $category ?? 'Other',
                'subtotal'     => $subtotal,
                'gst'          => $gst,
                'pst'          => $pst,
                'total'        => round(($subtotal ?? 0) + $gst + $pst, 2),
                'source'       => 'import',
                'created_at'   => now(),
                'updated_at'   => now(),
            ];

            if (!$category && ($item || $vendor)) {
                $needsCategorization[] = count($toInsert) - 1;
            }
        }

        // Cap how many rows go to the categorizer in one request -- a single
        // Claude call keeps this fast and cheap for realistic import sizes;
        // an unusually large batch just falls back to "Other" rather than
        // needing multi-call chunking logic.
        $autoCategorized = 0;
        if (!empty($needsCategorization) && count($needsCategorization) <= 300) {
            $items = array_map(fn ($idx) => [
                'vendor' => $toInsert[$idx]['vendor'],
                'item'   => $toInsert[$idx]['item'],
            ], $needsCategorization);

            $guesses = $this->categorizer->categorize($items, $categories);

            if ($guesses !== null) {
                foreach ($needsCategorization as $i => $idx) {
                    $guess = $guesses[$i] ?? 'Other';
                    $toInsert[$idx]['category'] = $guess;
                    if ($guess !== 'Other') {
                        $autoCategorized++;
                    }
                }
            }
        }

        $defaultedToOther = collect($toInsert)->where('category', 'Other')->count();

        if (!empty($toInsert)) {
            DB::transaction(function () use ($toInsert) {
                foreach (array_chunk($toInsert, 200) as $chunk) {
                    Expense::insert($chunk);
                }
            });
        }

        return response()->json([
            'inserted'           => count($toInsert),
            'incomplete'         => $incomplete,
            'defaulted_to_other' => $defaultedToOther,
            'auto_categorized'   => $autoCategorized,
        ]);
    }

    // ── Receipt AI extraction ───────────────────────────────────────────────

    public function extractReceipt(Request $request): JsonResponse
    {
        $request->validate(['receipt' => 'required|image|max:10240']);

        $file = $request->file('receipt');
        $bytes = file_get_contents($file->getRealPath());
        $mimeType = $file->getMimeType() ?: 'image/jpeg';

        $data = $this->receiptExtraction->extract($bytes, $mimeType, $this->categoryNames());

        if ($data === null) {
            return response()->json([
                'success' => false,
                'message' => "Couldn't read this receipt automatically. Please enter the details manually.",
            ]);
        }

        return response()->json(['success' => true, 'data' => $data]);
    }
}

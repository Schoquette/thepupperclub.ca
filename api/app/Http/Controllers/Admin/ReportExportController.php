<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Invoice;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

class ReportExportController extends Controller
{
    // ── JSON Endpoints ──────────────────────────────────────────────────────

    public function walkHistory(Request $request): JsonResponse
    {
        $request->validate([
            'start'   => 'required|date',
            'end'     => 'required|date|after_or_equal:start',
            'user_id' => 'nullable|integer|exists:users,id',
        ]);

        $start = Carbon::parse($request->start)->startOfDay();
        $end   = Carbon::parse($request->end)->endOfDay();

        $hasAssignedTo = Schema::hasColumn('appointments', 'assigned_to');

        $eagerLoads = ['user', 'dogs'];
        if ($hasAssignedTo) {
            $eagerLoads[] = 'assignedAdmin:id,name';
        }

        $appointments = Appointment::with($eagerLoads)
            ->whereNot('status', 'cancelled')
            ->whereBetween('scheduled_time', [$start, $end])
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->orderBy('scheduled_time')
            ->get();

        $rows = $appointments->map(function (Appointment $appt) use ($hasAssignedTo) {
            $duration = $appt->duration_minutes;
            if (!$duration && $appt->check_in_time && $appt->check_out_time) {
                $duration = $appt->check_in_time->diffInMinutes($appt->check_out_time);
            }

            return [
                'id'            => $appt->id,
                'date'          => $appt->scheduled_time->toDateString(),
                'client_name'   => $appt->user?->name ?? '—',
                'dogs'          => $appt->dogs->pluck('name')->join(', '),
                'service_type'  => $appt->service_type,
                'status'        => $appt->status,
                'scheduled_time'=> $appt->scheduled_time->format('g:i A'),
                'duration_minutes' => $duration,
                'team_member'   => $hasAssignedTo ? ($appt->assignedAdmin?->name ?? null) : null,
                'notes'         => $appt->notes,
            ];
        });

        return response()->json([
            'data' => [
                'rows'    => $rows->values(),
                'summary' => [
                    'total_appointments' => $rows->count(),
                    'total_minutes'      => $rows->sum('duration_minutes'),
                    'total_hours'        => round($rows->sum('duration_minutes') / 60, 1),
                ],
            ],
        ]);
    }

    public function billingHistory(Request $request): JsonResponse
    {
        $request->validate([
            'start'   => 'required|date',
            'end'     => 'required|date|after_or_equal:start',
            'user_id' => 'nullable|integer|exists:users,id',
        ]);

        $start = Carbon::parse($request->start)->startOfDay();
        $end   = Carbon::parse($request->end)->endOfDay();

        $invoices = Invoice::with('user')
            ->whereBetween('created_at', [$start, $end])
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->orderByDesc('created_at')
            ->get();

        $rows = $invoices->map(function (Invoice $inv) {
            return [
                'id'             => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'date'           => $inv->created_at->toDateString(),
                'client_name'    => $inv->user?->name ?? '—',
                'status'         => $inv->status,
                'subtotal'       => number_format($inv->subtotal, 2),
                'gst'            => number_format($inv->gst, 2),
                'total'          => number_format($inv->total, 2),
                'paid_at'        => $inv->paid_at?->toDateString(),
            ];
        });

        return response()->json([
            'data' => [
                'rows'    => $rows->values(),
                'summary' => [
                    'total_invoices' => $rows->count(),
                    'total_revenue'  => number_format($invoices->sum('total'), 2),
                    'total_gst'      => number_format($invoices->sum('gst'), 2),
                    'paid_count'     => $invoices->where('status', 'paid')->count(),
                    'outstanding'    => number_format($invoices->whereIn('status', ['sent', 'overdue'])->sum('total'), 2),
                ],
            ],
        ]);
    }

    // ── Export Endpoint ─────────────────────────────────────────────────────

    public function export(Request $request)
    {
        $request->validate([
            'start'   => 'required|date',
            'end'     => 'required|date|after_or_equal:start',
            'type'    => 'required|in:mileage,walk_history,billing',
            'format'  => 'required|in:csv,pdf',
            'user_id' => 'nullable|integer|exists:users,id',
        ]);

        $start  = Carbon::parse($request->start)->startOfDay();
        $end    = Carbon::parse($request->end)->endOfDay();
        $type   = $request->type;
        $format = $request->format;

        [$title, $columns, $rows, $summary] = match ($type) {
            'mileage'      => $this->buildMileageData($start, $end, $request->user_id),
            'walk_history'  => $this->buildWalkHistoryData($start, $end, $request->user_id),
            'billing'      => $this->buildBillingData($start, $end, $request->user_id),
        };

        $dateRange = $start->format('M j, Y') . ' — ' . $end->format('M j, Y');

        if ($format === 'csv') {
            return $this->respondCsv($title, $columns, $rows, $summary, $type);
        }

        return $this->respondPdf($title, $dateRange, $columns, $rows, $summary);
    }

    // ── Data Builders ───────────────────────────────────────────────────────

    private function buildMileageData(Carbon $start, Carbon $end, ?int $userId): array
    {
        $hasAssignedTo = Schema::hasColumn('appointments', 'assigned_to');

        $eagerLoads = ['user', 'dogs', 'visitReport'];
        if ($hasAssignedTo) {
            $eagerLoads[] = 'assignedAdmin:id,name';
        }

        $appointments = Appointment::with($eagerLoads)
            ->where('status', 'completed')
            ->whereBetween('scheduled_time', [$start, $end])
            ->when($userId, fn($q) => $q->where('user_id', $userId))
            ->orderBy('scheduled_time')
            ->get();

        $columns = ['Date', 'Client', 'Dogs', 'Service', 'Check In', 'Check Out', 'Duration', 'Mileage (km)'];

        $rows = $appointments->map(function (Appointment $appt) {
            $checkIn  = $appt->check_in_time;
            $checkOut = $appt->check_out_time;
            $minutes  = ($checkIn && $checkOut) ? $checkIn->diffInMinutes($checkOut) : null;

            return [
                $appt->scheduled_time->format('Y-m-d'),
                $appt->user?->name ?? '—',
                $appt->dogs->pluck('name')->join(', '),
                $appt->service_type,
                $checkIn?->format('g:i A') ?? '—',
                $checkOut?->format('g:i A') ?? '—',
                $minutes ? $minutes . ' min' : '—',
                $appt->visitReport?->distance_km ?? '—',
            ];
        })->toArray();

        $totalMinutes = $appointments->sum(function ($appt) {
            return ($appt->check_in_time && $appt->check_out_time)
                ? $appt->check_in_time->diffInMinutes($appt->check_out_time)
                : 0;
        });
        $totalKm = $appointments->sum(fn($a) => $a->visitReport?->distance_km ?? 0);

        $summary = [
            'Total Visits'  => count($rows),
            'Total Time'    => round($totalMinutes / 60, 1) . ' hrs',
            'Total Mileage' => round($totalKm, 1) . ' km',
        ];

        return ['Mileage Report', $columns, $rows, $summary];
    }

    private function buildWalkHistoryData(Carbon $start, Carbon $end, ?int $userId): array
    {
        $hasAssignedTo = Schema::hasColumn('appointments', 'assigned_to');

        $eagerLoads = ['user', 'dogs'];
        if ($hasAssignedTo) {
            $eagerLoads[] = 'assignedAdmin:id,name';
        }

        $appointments = Appointment::with($eagerLoads)
            ->whereNot('status', 'cancelled')
            ->whereBetween('scheduled_time', [$start, $end])
            ->when($userId, fn($q) => $q->where('user_id', $userId))
            ->orderBy('scheduled_time')
            ->get();

        $columns = ['Date', 'Client', 'Dogs', 'Service', 'Status', 'Scheduled Time', 'Duration', 'Team Member', 'Notes'];

        $rows = $appointments->map(function (Appointment $appt) use ($hasAssignedTo) {
            $duration = $appt->duration_minutes;
            if (!$duration && $appt->check_in_time && $appt->check_out_time) {
                $duration = $appt->check_in_time->diffInMinutes($appt->check_out_time);
            }

            return [
                $appt->scheduled_time->format('Y-m-d'),
                $appt->user?->name ?? '—',
                $appt->dogs->pluck('name')->join(', '),
                $appt->service_type,
                ucfirst($appt->status),
                $appt->scheduled_time->format('g:i A'),
                $duration ? $duration . ' min' : '—',
                $hasAssignedTo ? ($appt->assignedAdmin?->name ?? '—') : '—',
                $appt->notes ?? '',
            ];
        })->toArray();

        $totalMinutes = collect($rows)->sum(fn($r) => (int) $r[6]);

        $summary = [
            'Total Appointments' => count($rows),
            'Total Time'         => round($totalMinutes / 60, 1) . ' hrs',
        ];

        return ['Walk History', $columns, $rows, $summary];
    }

    private function buildBillingData(Carbon $start, Carbon $end, ?int $userId): array
    {
        $invoices = Invoice::with('user')
            ->whereBetween('created_at', [$start, $end])
            ->when($userId, fn($q) => $q->where('user_id', $userId))
            ->orderByDesc('created_at')
            ->get();

        $columns = ['Invoice #', 'Date', 'Client', 'Status', 'Subtotal', 'GST', 'Total', 'Paid Date'];

        $rows = $invoices->map(function (Invoice $inv) {
            return [
                $inv->invoice_number,
                $inv->created_at->format('Y-m-d'),
                $inv->user?->name ?? '—',
                ucfirst($inv->status),
                '$' . number_format($inv->subtotal, 2),
                '$' . number_format($inv->gst, 2),
                '$' . number_format($inv->total, 2),
                $inv->paid_at?->format('Y-m-d') ?? '—',
            ];
        })->toArray();

        $summary = [
            'Total Invoices'  => count($rows),
            'Total Revenue'   => '$' . number_format($invoices->sum('total'), 2),
            'Total GST'       => '$' . number_format($invoices->sum('gst'), 2),
            'Paid'            => $invoices->where('status', 'paid')->count(),
            'Outstanding'     => '$' . number_format($invoices->whereIn('status', ['sent', 'overdue'])->sum('total'), 2),
        ];

        return ['Billing History', $columns, $rows, $summary];
    }

    // ── Response Helpers ────────────────────────────────────────────────────

    private function respondCsv(string $title, array $columns, array $rows, array $summary, string $type): Response
    {
        $lines = [];

        // Header row
        $lines[] = implode(',', array_map(fn($c) => '"' . str_replace('"', '""', $c) . '"', $columns));

        // Data rows
        foreach ($rows as $row) {
            $lines[] = implode(',', array_map(fn($v) => '"' . str_replace('"', '""', (string) $v) . '"', $row));
        }

        // Blank line + summary
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
        $pdf = Pdf::loadView('pdfs.report', compact('title', 'dateRange', 'columns', 'rows', 'summary'))
            ->setPaper('letter', 'landscape');

        $filename = str_replace(' ', '_', strtolower($title)) . '_' . now()->format('Y-m-d') . '.pdf';

        return $pdf->download($filename);
    }
}

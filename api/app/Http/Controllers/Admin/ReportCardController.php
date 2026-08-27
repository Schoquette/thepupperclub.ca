<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ReportCardTemplate;
use App\Models\User;
use App\Models\VisitReport;
use App\Models\VisitReportComment;
use App\Services\ReportCardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportCardController extends Controller
{
    public function __construct(private ReportCardService $service) {}

    // ── List / Show ───────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = VisitReport::with(['user:id,name,email', 'appointment.user:id,name,email'])
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->status === 'sent',  fn($q) => $q->whereNotNull('sent_at'))
            ->when($request->status === 'draft', fn($q) => $q->whereNull('sent_at'))
            ->orderByDesc('created_at');

        return response()->json($query->paginate(20));
    }

    /**
     * Past completed/checked-in appointments that don't have a report card yet.
     */
    public function due(Request $request): JsonResponse
    {
        // Auto-add report_card_dismissed column if it doesn't exist
        if (!Schema::hasColumn('appointments', 'report_card_dismissed')) {
            try {
                Schema::table('appointments', function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->boolean('report_card_dismissed')->default(false)->after('status');
                });
            } catch (\Throwable $e) {
                // GoDaddy DDL restriction — proceed without the column
            }
        }

        $hasDismissed = Schema::hasColumn('appointments', 'report_card_dismissed');

        $query = \App\Models\Appointment::with(['user:id,name,email', 'dogs'])
            ->whereIn('status', ['completed', 'checked_in'])
            ->where('scheduled_time', '<', now())
            ->doesntHave('visitReport')
            ->when($hasDismissed, fn($q) => $q->where('report_card_dismissed', false))
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->orderByDesc('scheduled_time');

        return response()->json(['data' => $query->get()]);
    }

    public function dismissDue(\App\Models\Appointment $appointment): JsonResponse
    {
        if (!Schema::hasColumn('appointments', 'report_card_dismissed')) {
            try {
                Schema::table('appointments', function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->boolean('report_card_dismissed')->default(false)->after('status');
                });
            } catch (\Throwable $e) {
                return response()->json(['message' => 'Could not dismiss — column unavailable.'], 422);
            }
        }

        $appointment->update(['report_card_dismissed' => true]);
        return response()->json(['message' => 'Dismissed.']);
    }

    public function show(VisitReport $reportCard): JsonResponse
    {
        return response()->json(['data' => $reportCard->load(['user:id,name,email', 'appointment.dogs', 'appointment.user:id,name,email'])]);
    }

    // ── Create / Update ───────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'user_id'              => 'required|exists:users,id',
                'dog_ids'              => 'nullable|array',
                'dog_ids.*'            => 'integer|exists:dogs,id',
                'appointment_id'       => 'nullable|exists:appointments,id',
                'arrival_time'         => 'nullable|date',
                'departure_time'       => 'nullable|date',
                'checklist'            => 'nullable|array',
                'special_trip_details' => 'nullable|string|max:255',
                'notes'                => 'nullable|string|max:5000',
                'dog_data'             => 'nullable|json',
                'photos'               => 'nullable|array',
                'photos.*'             => 'file|max:20480',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e; // let Laravel return the standard 422 with field errors
        }

        $checklist = isset($data['checklist'])
            ? array_map('boolval', $data['checklist'])
            : null;

        $dogData = isset($data['dog_data']) ? json_decode($data['dog_data'], true) : null;

        $fields = [
            'user_id'              => $data['user_id'],
            'appointment_id'       => $data['appointment_id'] ?? null,
            'arrival_time'         => $data['arrival_time'] ?? null,
            'departure_time'       => $data['departure_time'] ?? null,
            'checklist'            => $checklist,
            'special_trip_details' => $data['special_trip_details'] ?? null,
            'notes'                => $data['notes'] ?? null,
        ];

        // Guard hasColumn() + migration in one try/catch — GoDaddy may restrict DDL
        try {
            $hasIds  = Schema::hasColumn('visit_reports', 'dog_ids');
            $hasData = Schema::hasColumn('visit_reports', 'dog_data');
            if (!$hasIds || !$hasData) {
                Schema::table('visit_reports', function (\Illuminate\Database\Schema\Blueprint $table) use ($hasIds, $hasData) {
                    if (!$hasIds)  $table->json('dog_ids')->nullable();
                    if (!$hasData) $table->json('dog_data')->nullable();
                });
                $hasIds = $hasData = true;
            }
            if ($hasIds)  $fields['dog_ids']  = $data['dog_ids'] ?? null;
            if ($hasData) $fields['dog_data'] = $dogData;
        } catch (\Throwable $e) {
            // Columns unavailable — report still saves without them
        }

        try {
            $report = VisitReport::create(array_filter($fields, fn($v) => $v !== null));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Store failed: ' . $e->getMessage()], 422);
        }

        if ($request->hasFile('photos')) {
            try {
                $paths = collect($request->file('photos'))
                    ->map(fn($file) => $file->store("report_cards/{$report->id}", 'local'))
                    ->all();
                $report->update(['photo_paths' => $paths]);
            } catch (\Throwable $e) {
                return response()->json(['message' => 'Report saved but photo upload failed: ' . $e->getMessage()], 201);
            }
        }

        return response()->json(['data' => $report->fresh(['user', 'appointment'])], 201);
    }

    public function update(Request $request, VisitReport $reportCard): JsonResponse
    {
        $data = $request->validate([
            'arrival_time'         => 'sometimes|nullable|date',
            'departure_time'       => 'sometimes|nullable|date',
            'checklist'            => 'sometimes|nullable|array',
            'special_trip_details' => 'sometimes|nullable|string|max:255',
            'notes'                => 'sometimes|nullable|string|max:5000',
            'dog_data'             => 'sometimes|nullable|json',
            'photos'               => 'sometimes|array',
            'photos.*'             => 'file|max:20480', // skip image MIME check — HEIC unsupported on GoDaddy
        ]);

        if (isset($data['checklist'])) {
            $data['checklist'] = array_map('boolval', $data['checklist']);
        }
        if (isset($data['dog_data'])) {
            $dogDataColumnOk = Schema::hasColumn('visit_reports', 'dog_data');
            if (!$dogDataColumnOk) {
                try {
                    $hasIds = Schema::hasColumn('visit_reports', 'dog_ids');
                    Schema::table('visit_reports', function (\Illuminate\Database\Schema\Blueprint $table) use ($hasIds) {
                        if (!$hasIds) $table->json('dog_ids')->nullable();
                        $table->json('dog_data')->nullable();
                    });
                    $dogDataColumnOk = true;
                } catch (\Throwable $e) {
                    // Migration failed — skip dog_data so the rest of the update succeeds
                }
            }
            if ($dogDataColumnOk) {
                $data['dog_data'] = json_decode($data['dog_data'], true);
            } else {
                unset($data['dog_data']);
            }
        }

        unset($data['photos']);
        try {
            $reportCard->update($data);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Update failed: ' . $e->getMessage()], 422);
        }

        // Append new photos
        if ($request->hasFile('photos')) {
            try {
                $existing = $reportCard->photo_paths ?? [];
                $newPaths = collect($request->file('photos'))
                    ->map(fn($file) => $file->store("report_cards/{$reportCard->id}", 'local'))
                    ->all();
                $reportCard->update(['photo_paths' => array_merge($existing, $newPaths)]);
            } catch (\Throwable $e) {
                return response()->json([
                    'data' => $reportCard->fresh(['user', 'appointment']),
                    'message' => 'Saved but photo upload failed: ' . $e->getMessage(),
                ]);
            }
        }

        return response()->json(['data' => $reportCard->fresh(['user', 'appointment'])]);
    }

    public function destroy(VisitReport $reportCard): JsonResponse
    {
        abort_unless(!$reportCard->sent_at, 422, 'Cannot delete a sent report card.');

        // Delete all photos from storage
        foreach ($reportCard->photo_paths ?? [] as $path) {
            Storage::disk('local')->delete($path);
        }
        if ($reportCard->report_photo_path) {
            Storage::disk('local')->delete($reportCard->report_photo_path);
        }
        $reportCard->delete();

        return response()->json(['message' => 'Report card deleted.']);
    }

    // ── Send ──────────────────────────────────────────────────────────────────

    public function send(VisitReport $reportCard): JsonResponse
    {
        try {
            $this->service->send($reportCard);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Send failed: ' . $e->getMessage()], 422);
        }

        return response()->json(['message' => 'Report card sent.', 'data' => $reportCard->fresh()]);
    }

    // ── Photos ────────────────────────────────────────────────────────────────

    public function servePhoto(VisitReport $reportCard, int $index = 0): StreamedResponse
    {
        $paths = $reportCard->photo_paths ?? [];

        // Backward compat: fall back to legacy single-photo field
        if (empty($paths) && $reportCard->report_photo_path) {
            $paths = [$reportCard->report_photo_path];
        }

        abort_if($index < 0 || $index >= count($paths), 404);
        abort_unless(Storage::disk('local')->exists($paths[$index]), 404);

        return Storage::disk('local')->response($paths[$index]);
    }

    public function deletePhoto(Request $request, VisitReport $reportCard): JsonResponse
    {
        $index = (int) $request->query('index', 0);
        $paths = $reportCard->photo_paths ?? [];

        if ($index >= 0 && $index < count($paths)) {
            Storage::disk('local')->delete($paths[$index]);
            array_splice($paths, $index, 1);
            $reportCard->update(['photo_paths' => $paths]);
        }

        return response()->json(['message' => 'Photo removed.']);
    }

    // ── Templates ─────────────────────────────────────────────────────────────

    public function getTemplate(User $client): JsonResponse
    {
        return response()->json(['data' => ReportCardTemplate::forClient($client->id)]);
    }

    public function saveTemplate(Request $request, User $client): JsonResponse
    {
        $request->validate([
            'items'           => 'required|array|min:1',
            'items.*.key'     => 'required|string',
            'items.*.label'   => 'required|string',
            'items.*.enabled' => 'required|boolean',
        ]);

        $template = ReportCardTemplate::updateOrCreate(
            ['user_id' => $client->id],
            ['items'   => $request->items]
        );

        return response()->json(['data' => $template]);
    }

    public function resetTemplate(User $client): JsonResponse
    {
        ReportCardTemplate::where('user_id', $client->id)->delete();
        return response()->json(['data' => ReportCardTemplate::defaultItems(), 'message' => 'Template reset to default.']);
    }

    public function deleteComment(VisitReport $reportCard, VisitReportComment $comment): JsonResponse
    {
        abort_unless($comment->visit_report_id === $reportCard->id, 404);
        $comment->delete();
        return response()->json(['message' => 'Comment deleted.']);
    }
}

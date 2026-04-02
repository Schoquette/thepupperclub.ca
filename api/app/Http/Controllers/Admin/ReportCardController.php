<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ReportCardTemplate;
use App\Models\User;
use App\Models\VisitReport;
use App\Services\ReportCardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportCardController extends Controller
{
    public function __construct(private ReportCardService $service) {}

    // ── List / Show ───────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = VisitReport::with(['user:id,name,email', 'appointment'])
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->status === 'sent',  fn($q) => $q->whereNotNull('sent_at'))
            ->when($request->status === 'draft', fn($q) => $q->whereNull('sent_at'))
            ->orderByDesc('created_at');

        return response()->json($query->paginate(20));
    }

    public function show(VisitReport $reportCard): JsonResponse
    {
        return response()->json(['data' => $reportCard->load(['user:id,name,email', 'appointment.dogs'])]);
    }

    // ── Create / Update ───────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id'              => 'required|exists:users,id',
            'appointment_id'       => 'nullable|exists:appointments,id',
            'arrival_time'         => 'nullable|date',
            'departure_time'       => 'nullable|date',
            'checklist'            => 'nullable|array',
            'special_trip_details' => 'nullable|string|max:255',
            'notes'                => 'nullable|string|max:5000',
            'photos'               => 'nullable|array',
            'photos.*'             => 'file|image|max:10240',
        ]);

        $checklist = isset($data['checklist'])
            ? array_map('boolval', $data['checklist'])
            : null;

        $report = VisitReport::create(array_filter([
            'user_id'              => $data['user_id'],
            'appointment_id'       => $data['appointment_id'] ?? null,
            'arrival_time'         => $data['arrival_time'] ?? null,
            'departure_time'       => $data['departure_time'] ?? null,
            'checklist'            => $checklist,
            'special_trip_details' => $data['special_trip_details'] ?? null,
            'notes'                => $data['notes'] ?? null,
        ], fn($v) => $v !== null));

        if ($request->hasFile('photos')) {
            $paths = collect($request->file('photos'))
                ->map(fn($file) => $file->store("report_cards/{$report->id}", 'local'))
                ->all();
            $report->update(['photo_paths' => $paths]);
        }

        return response()->json(['data' => $report->fresh(['user', 'appointment'])], 201);
    }

    public function update(Request $request, VisitReport $reportCard): JsonResponse
    {
        abort_unless(!$reportCard->sent_at, 422, 'Cannot edit a sent report card.');

        $data = $request->validate([
            'arrival_time'         => 'sometimes|nullable|date',
            'departure_time'       => 'sometimes|nullable|date',
            'checklist'            => 'sometimes|nullable|array',
            'special_trip_details' => 'sometimes|nullable|string|max:255',
            'notes'                => 'sometimes|nullable|string|max:5000',
            'photos'               => 'sometimes|array',
            'photos.*'             => 'file|image|max:10240',
        ]);

        if (isset($data['checklist'])) {
            $data['checklist'] = array_map('boolval', $data['checklist']);
        }

        unset($data['photos']);
        $reportCard->update($data);

        // Append new photos
        if ($request->hasFile('photos')) {
            $existing = $reportCard->photo_paths ?? [];
            $newPaths = collect($request->file('photos'))
                ->map(fn($file) => $file->store("report_cards/{$reportCard->id}", 'local'))
                ->all();
            $reportCard->update(['photo_paths' => array_merge($existing, $newPaths)]);
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
        abort_if($reportCard->sent_at, 422, 'Report card already sent.');

        $this->service->send($reportCard);

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
}

<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\VisitReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportCardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $reports = VisitReport::where('user_id', $request->user()->id)
            ->whereNotNull('sent_at')
            ->with('appointment')
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($reports);
    }

    public function show(Request $request, VisitReport $reportCard): JsonResponse
    {
        abort_unless($reportCard->user_id === $request->user()->id, 403);
        abort_unless($reportCard->sent_at, 404);

        return response()->json(['data' => $reportCard->load('appointment.dogs')]);
    }

    public function servePhoto(Request $request, VisitReport $reportCard, int $index = 0): StreamedResponse
    {
        abort_unless($reportCard->user_id === $request->user()->id, 403);
        abort_unless($reportCard->sent_at, 404);

        $paths = $reportCard->photo_paths ?? [];
        if (empty($paths) && $reportCard->report_photo_path) {
            $paths = [$reportCard->report_photo_path];
        }

        abort_if($index < 0 || $index >= count($paths), 404);
        abort_unless(Storage::disk('local')->exists($paths[$index]), 404);

        return Storage::disk('local')->response($paths[$index]);
    }
}

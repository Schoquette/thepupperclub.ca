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

    public function servePhoto(Request $request, VisitReport $reportCard): StreamedResponse
    {
        abort_unless($reportCard->user_id === $request->user()->id, 403);
        abort_unless($reportCard->sent_at, 404);
        abort_unless($reportCard->report_photo_path, 404);
        abort_unless(Storage::disk('local')->exists($reportCard->report_photo_path), 404);

        return Storage::disk('local')->response($reportCard->report_photo_path);
    }
}

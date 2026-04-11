<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\VisitReport;
use App\Models\VisitReportComment;
use App\Services\AdminNotificationService;
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
            ->with(['appointment', 'comments.user'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($reports);
    }

    public function show(Request $request, VisitReport $reportCard): JsonResponse
    {
        abort_unless($reportCard->user_id === $request->user()->id, 403);
        abort_unless($reportCard->sent_at, 404);

        return response()->json(['data' => $reportCard->load(['appointment.dogs', 'comments.user'])]);
    }

    public function postComment(Request $request, VisitReport $reportCard): JsonResponse
    {
        abort_unless($reportCard->user_id === $request->user()->id, 403);
        abort_unless($reportCard->sent_at, 404);

        $data = $request->validate(['body' => 'required|string|max:2000']);

        $comment = $reportCard->comments()->create([
            'user_id' => $request->user()->id,
            'body'    => $data['body'],
        ]);

        return response()->json(['data' => $comment->load('user'), 'message' => 'Comment posted.']);
    }

    public function deleteComment(Request $request, VisitReport $reportCard, VisitReportComment $comment): JsonResponse
    {
        abort_unless($comment->visit_report_id === $reportCard->id, 404);
        // Client can delete their own comments
        abort_unless($comment->user_id === $request->user()->id, 403);

        $comment->delete();

        return response()->json(['message' => 'Comment deleted.']);
    }

    public function submitChangeRequest(Request $request, VisitReport $reportCard): JsonResponse
    {
        abort_unless($reportCard->user_id === $request->user()->id, 403);
        abort_unless($reportCard->sent_at, 404);
        abort_if($reportCard->change_request, 422, 'A change request has already been submitted for this report.');

        $data = $request->validate(['change_request' => 'required|string|max:2000']);

        $reportCard->update(['change_request' => $data['change_request']]);

        $client = $request->user();
        $body = "{$client->name} has requested: {$data['change_request']}";
        app(AdminNotificationService::class)->notifyWithMessage($client, 'Change Request', $body);

        return response()->json(['data' => $reportCard->fresh(), 'message' => 'Change request submitted.']);
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

<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\User;
use App\Models\VisitReport;
use App\Http\Controllers\Admin\NotificationController;
use Illuminate\Support\Facades\Mail;

class ReportCardService
{
    /**
     * Send a report card to the client:
     *  1. Creates a visit_report message in the conversation thread
     *  2. Sends an HTML email to the client
     */
    public function send(VisitReport $report): void
    {
        $client = $report->user ?? $report->appointment?->user;
        if (!$client) return;

        $adminId = User::where('role', 'admin')->value('id') ?? 1;

        // ── 1. Chat message ────────────────────────────────────────────────────
        $conversation = Conversation::firstOrCreate(['user_id' => $client->id]);

        $conversation->messages()->create([
            'sender_id' => $adminId,
            'type'      => 'visit_report',
            'body'      => 'Visit Report Card',
            'metadata'  => [
                'report_id'           => $report->id,
                'arrival_time'        => $report->arrival_time?->toIso8601String(),
                'departure_time'      => $report->departure_time?->toIso8601String(),
                'checklist'           => $report->checklist ?? [],
                'special_trip_details'=> $report->special_trip_details,
                'notes'               => $report->notes,
                'has_photo'           => (bool) $report->report_photo_path,
            ],
        ]);

        $conversation->increment('unread_count_client');
        $conversation->update(['last_message_at' => now()]);

        $report->update(['sent_at' => now()]);

        // ── 2. Email ───────────────────────────────────────────────────────────
        $this->sendEmail($report, $client, $adminId);
    }

    private function sendEmail(VisitReport $report, User $client, int $adminId): void
    {
        $dogs = $report->appointment?->dogs ?? $client->dogs;
        $dogNames = $dogs->pluck('name')->implode(', ') ?: 'your pup';

        $checklist = collect($report->checklist ?? [])
            ->filter(fn($v, $k) => $k !== 'special_trip_details' && (bool)$v)
            ->keys()
            ->map(fn($k) => ucwords(str_replace('_', ' ', $k)))
            ->values()
            ->all();

        $photoUrl = $report->report_photo_path
            ? rtrim(config('app.url'), '/') . '/api/admin/report-cards/' . $report->id . '/photo'
            : null;

        // Get first dog's profile photo URL
        $firstDog = $dogs->first();
        $dogPhotoUrl = ($firstDog && $firstDog->photo_path)
            ? rtrim(config('app.url'), '/') . '/api/admin/dogs/' . $firstDog->id . '/photo'
            : null;

        Mail::send([], [], function ($mail) use ($client, $report, $dogNames, $checklist, $photoUrl, $dogPhotoUrl) {
            $arrivalTime   = $report->arrival_time?->setTimezone('America/Vancouver')->format('g:i A') ?? '';
            $departureTime = $report->departure_time?->setTimezone('America/Vancouver')->format('g:i A') ?? '';
            $visitDate     = $report->arrival_time?->setTimezone('America/Vancouver')->format('F j, Y') ?? '';
            $portalUrl     = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5174')), '/') . '/client/report-cards';

            // Build checklist HTML for token replacement
            $checklistHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
            foreach ($checklist as $item) {
                $checklistHtml .= '<span style="display:inline-flex;align-items:center;gap:6px;background:#F6F3EE;border-radius:20px;padding:6px 12px;font-size:13px;color:#3B2F2A;"><span style="width:8px;height:8px;border-radius:50%;background:#C9A24D;display:inline-block;"></span>' . e($item) . '</span>';
            }
            $checklistHtml .= '</div>';

            $visitPhotoHtml = $photoUrl
                ? '<div style="margin:0 -40px 20px;overflow:hidden;"><img src="' . e($photoUrl) . '" alt="Visit photo" style="width:100%;max-height:320px;object-fit:cover;display:block;"></div>'
                : '';
            $dogPhotoHtmlStr = $dogPhotoUrl
                ? '<div style="text-align:center;margin-bottom:20px;"><img src="' . e($dogPhotoUrl) . '" alt="Dog photo" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #C9A24D;" /></div>'
                : '';

            // Check for custom template
            $tokens = [
                '{client_name}'     => $client->name,
                '{dog_names}'       => $dogNames,
                '{visit_date}'      => $visitDate,
                '{arrival_time}'    => $arrivalTime,
                '{departure_time}'  => $departureTime,
                '{checklist_html}'  => $checklistHtml,
                '{notes}'           => e($report->notes ?? ''),
                '{visit_photo_html}'=> $visitPhotoHtml,
                '{dog_photo_html}'  => $dogPhotoHtmlStr,
                '{portal_url}'      => $portalUrl,
            ];

            $customSubject = NotificationController::getSystemSubject('report_card', $tokens);
            $customHtml    = NotificationController::renderSystemTemplate('report_card', $tokens);

            $html = $customHtml ?? view('emails.report_card', [
                'client'             => $client,
                'report'             => $report,
                'dogNames'           => $dogNames,
                'checklist'          => $checklist,
                'specialTrip'        => ($report->checklist['special_trip'] ?? false)
                                         ? ($report->special_trip_details ?: 'Yes')
                                         : null,
                'photoUrl'           => $photoUrl,
                'dogPhotoUrl'        => $dogPhotoUrl,
                'arrivalTime'        => $arrivalTime,
                'departureTime'      => $departureTime,
                'visitDate'          => $visitDate,
                'portalUrl'          => $portalUrl,
            ])->render();

            $mail->to($client->email, $client->name)
                 ->subject($customSubject ?? 'Visit Report Card — The Pupper Club')
                 ->html($html);

            // Embed logo as inline CID attachment
            $logoPath = public_path('images/logo-cream-stacked.png');
            if (file_exists($logoPath)) {
                $logoPart = new \Symfony\Component\Mime\Part\DataPart(
                    file_get_contents($logoPath),
                    'logo.png',
                    'image/png'
                );
                $logoPart->asInline();
                $logoPart->setContentId('logo@thepupperclub.ca');
                $mail->getSymfonyMessage()->attachPart($logoPart);
            }
        });

        $report->update(['email_sent_at' => now()]);
    }
}

<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\User;
use App\Models\VisitReport;
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

        Mail::send('emails.report_card', [
            'client'             => $client,
            'report'             => $report,
            'dogNames'           => $dogNames,
            'checklist'          => $checklist,
            'specialTrip'        => ($report->checklist['special_trip'] ?? false)
                                     ? ($report->special_trip_details ?: 'Yes')
                                     : null,
            'photoUrl'           => $photoUrl,
            'arrivalTime'        => $report->arrival_time?->setTimezone('America/Vancouver')->format('g:i A'),
            'departureTime'      => $report->departure_time?->setTimezone('America/Vancouver')->format('g:i A'),
            'visitDate'          => $report->arrival_time?->setTimezone('America/Vancouver')->format('F j, Y'),
            'portalUrl'          => rtrim(config('app.frontend_url'), '/') . '/client/report-cards',
        ], function ($mail) use ($client) {
            $mail->to($client->email, $client->name)
                 ->subject('Visit Report Card — The Pupper Club');
        });

        $report->update(['email_sent_at' => now()]);
    }
}

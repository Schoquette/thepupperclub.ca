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

        $dogs = $report->appointment?->dogs ?? $client->dogs;
        $dogNames = $dogs->pluck('name')->implode(', ') ?: null;

        $conversation->messages()->create([
            'sender_id' => $adminId,
            'type'      => 'visit_report',
            'body'      => 'Visit Report Card',
            'metadata'  => [
                'report_id'           => $report->id,
                'arrival_time'        => $report->arrival_time?->toIso8601String(),
                'departure_time'      => $report->departure_time?->toIso8601String(),
                'checklist'           => $report->checklist ?? [],
                'dog_data'            => $report->dog_data,
                'special_trip_details'=> $report->special_trip_details,
                'notes'               => $report->notes,
                'dog_names'           => $dogNames,
                'has_photo'           => (bool) $report->report_photo_path,
                'photo_count'         => count($report->photo_paths ?? ($report->report_photo_path ? [1] : [])),
            ],
        ]);

        $conversation->increment('unread_count_client');
        $conversation->update(['last_message_at' => now()]);

        $report->update(['sent_at' => now()]);

        // ── 2. Email (best-effort — failure logged but doesn't block the send) ─
        try {
            $this->sendEmail($report, $client, $adminId);
        } catch (\Throwable $e) {
            // Email log already written by ResendTransport; log the exception too
            \Illuminate\Support\Facades\Log::error('ReportCardService: email failed', [
                'report_id' => $report->id,
                'error'     => $e->getMessage(),
            ]);
        }
    }

    private function sendEmail(VisitReport $report, User $client, int $adminId): void
    {
        $dogs = $report->appointment?->dogs ?? $client->dogs;
        $dogNames = $dogs->pluck('name')->implode(', ') ?: 'your pup';

        // Build a map of dog ID → name for per-dog sections
        $dogNameMap = $dogs->pluck('name', 'id')->toArray();

        // Build per-dog sections from dog_data (or fall back to flat checklist)
        $dogSections = [];
        $dogData = $report->dog_data;
        if (!empty($dogData) && is_array($dogData)) {
            foreach ($dogData as $key => $section) {
                $name = $dogNameMap[$key] ?? ($key === '_general' ? null : "Dog #{$key}");
                $items = collect($section['checklist'] ?? [])
                    ->filter(fn($v) => (bool)$v)
                    ->keys()
                    ->map(fn($k) => ucwords(str_replace('_', ' ', $k)))
                    ->values()
                    ->all();
                $dogSections[] = [
                    'name'      => $name,
                    'checklist' => $items,
                    'notes'     => $section['notes'] ?? '',
                ];
            }
        } else {
            // Flat checklist fallback
            $items = collect($report->checklist ?? [])
                ->filter(fn($v, $k) => $k !== 'special_trip_details' && (bool)$v)
                ->keys()
                ->map(fn($k) => ucwords(str_replace('_', ' ', $k)))
                ->values()
                ->all();
            $dogSections[] = [
                'name'      => null,
                'checklist' => $items,
                'notes'     => $report->notes ?? '',
            ];
        }

        // Flat checklist for token replacement (merged)
        $checklist = collect($dogSections)->flatMap(fn($s) => $s['checklist'])->unique()->values()->all();

        // Build photo CIDs for inline embedding (auth-free in email clients)
        $photoPaths = $report->photo_paths ?? [];
        if (empty($photoPaths) && $report->report_photo_path) {
            $photoPaths = [$report->report_photo_path];
        }
        $photoCids = [];
        foreach ($photoPaths as $i => $path) {
            $photoCids[] = "report-photo-{$i}@thepupperclub.ca";
        }

        // Dog profile photo CID
        $firstDog = $dogs->first();
        $dogPhotoCid = ($firstDog && $firstDog->photo_path) ? 'dog-photo@thepupperclub.ca' : null;

        Mail::send([], [], function ($mail) use ($client, $report, $dogNames, $checklist, $photoCids, $photoPaths, $dogPhotoCid, $firstDog, $dogSections) {
            $arrivalTime   = $report->arrival_time?->setTimezone('America/Vancouver')->format('g:i A') ?? '';
            $departureTime = $report->departure_time?->setTimezone('America/Vancouver')->format('g:i A') ?? '';
            $visitDate     = $report->arrival_time?->setTimezone('America/Vancouver')->format('F j, Y') ?? '';
            $portalUrl     = rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/') . '/client/report-cards';

            // Build checklist HTML for token replacement
            $checklistHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
            foreach ($checklist as $item) {
                $checklistHtml .= '<span style="display:inline-flex;align-items:center;gap:6px;background:#F6F3EE;border-radius:20px;padding:6px 12px;font-size:13px;color:#3B2F2A;"><span style="width:8px;height:8px;border-radius:50%;background:#C9A24D;display:inline-block;"></span>' . e($item) . '</span>';
            }
            $checklistHtml .= '</div>';

            $visitPhotoHtml  = $this->buildPhotoGridHtml($photoCids);
            $dogPhotoHtmlStr = $dogPhotoCid
                ? '<div style="text-align:center;margin-bottom:20px;"><img src="cid:' . $dogPhotoCid . '" alt="Dog photo" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #C9A24D;" /></div>'
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
                'client'        => $client,
                'report'        => $report,
                'dogNames'      => $dogNames,
                'dogSections'   => $dogSections,
                'checklist'     => $checklist,
                'specialTrip'   => ($report->checklist['special_trip'] ?? false)
                                     ? ($report->special_trip_details ?: 'Yes')
                                     : null,
                'photoCids'     => $photoCids,
                'dogPhotoCid'   => $dogPhotoCid,
                'arrivalTime'   => $arrivalTime,
                'departureTime' => $departureTime,
                'visitDate'     => $visitDate,
                'portalUrl'     => $portalUrl,
            ])->render();

            $replyAddr = config('services.resend.inbound_address') ?: config('mail.from.address');
            $mail->to($client->email, $client->name)
                 ->subject($customSubject ?? 'Visit Report Card — The Pupper Club')
                 ->replyTo($replyAddr)
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
                $mail->getSymfonyMessage()->addPart($logoPart);
            }

            $this->embedPhotos($mail->getSymfonyMessage(), $photoPaths, $photoCids);

            // Embed dog profile photo as inline CID attachment
            if ($dogPhotoCid && $firstDog && $firstDog->photo_path &&
                \Illuminate\Support\Facades\Storage::disk('local')->exists($firstDog->photo_path)) {
                $content = \Illuminate\Support\Facades\Storage::disk('local')->get($firstDog->photo_path);
                $ext     = strtolower(pathinfo($firstDog->photo_path, PATHINFO_EXTENSION));
                $mime    = in_array($ext, ['jpg', 'jpeg']) ? 'image/jpeg' : "image/{$ext}";
                $part    = new \Symfony\Component\Mime\Part\DataPart($content, "dog-photo.{$ext}", $mime);
                $part->asInline();
                $part->setContentId($dogPhotoCid);
                $mail->getSymfonyMessage()->addPart($part);
            }
        });

        $report->update(['email_sent_at' => now()]);
    }

    /**
     * Build a table-based photo grid for email (3 columns, ~180px tall thumbnails).
     */
    private function buildPhotoGridHtml(array $photoCids): string
    {
        if (empty($photoCids)) return '';

        $cols  = min(count($photoCids), 3);
        $width = match ($cols) { 1 => '100%', 2 => '49%', default => '32%' };
        $height = count($photoCids) === 1 ? '300px' : '180px';

        $html  = '<div style="margin:0 0 20px;">';
        $html .= '<table width="100%" cellspacing="4" cellpadding="0" border="0"><tr>';

        foreach ($photoCids as $i => $cid) {
            if ($i > 0 && $i % $cols === 0) {
                $html .= '</tr><tr>';
            }
            $html .= '<td width="' . $width . '" style="vertical-align:top;">'
                   . '<img src="cid:' . $cid . '" alt="Visit photo" '
                   . 'style="width:100%;height:' . $height . ';object-fit:cover;border-radius:6px;display:block;">'
                   . '</td>';
        }

        // Fill empty cells in the last row so the table doesn't stretch
        $remainder = count($photoCids) % $cols;
        if ($remainder > 0) {
            for ($j = $remainder; $j < $cols; $j++) {
                $html .= '<td width="' . $width . '"></td>';
            }
        }

        $html .= '</tr></table></div>';
        return $html;
    }

    /**
     * Embed all visit photos as inline CID attachments on a Symfony email message.
     */
    private function embedPhotos(\Symfony\Component\Mime\Email $message, array $photoPaths, array $photoCids): void
    {
        foreach ($photoPaths as $i => $path) {
            if (!isset($photoCids[$i])) continue;
            if (!\Illuminate\Support\Facades\Storage::disk('local')->exists($path)) continue;

            $content = \Illuminate\Support\Facades\Storage::disk('local')->get($path);
            $ext     = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $mime    = in_array($ext, ['jpg', 'jpeg']) ? 'image/jpeg' : "image/{$ext}";
            $part    = new \Symfony\Component\Mime\Part\DataPart($content, "photo-{$i}.{$ext}", $mime);
            $part->asInline();
            $part->setContentId($photoCids[$i]);
            $message->addPart($part);
        }

        // ── Secondary contact ──────────────────────────────────────────────────
        $profile = $client->profile;
        if ($profile &&
            $profile->secondary_notify_report_cards &&
            !empty($profile->secondary_contact_email)) {

            $secondaryName = $profile->secondary_contact_name ?: $profile->secondary_contact_email;

            Mail::send([], [], function ($mail) use (
                $profile, $secondaryName, $client, $report,
                $dogNames, $checklist, $photoCids, $photoPaths,
                $dogPhotoCid, $firstDog, $dogSections
            ) {
                $arrivalTime   = $report->arrival_time?->setTimezone('America/Vancouver')->format('g:i A') ?? '';
                $departureTime = $report->departure_time?->setTimezone('America/Vancouver')->format('g:i A') ?? '';
                $visitDate     = $report->arrival_time?->setTimezone('America/Vancouver')->format('F j, Y') ?? '';
                $portalUrl     = rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/') . '/client/report-cards';

                $checklistHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
                foreach ($checklist as $item) {
                    $checklistHtml .= '<span style="display:inline-flex;align-items:center;gap:6px;background:#F6F3EE;border-radius:20px;padding:6px 12px;font-size:13px;color:#3B2F2A;"><span style="width:8px;height:8px;border-radius:50%;background:#C9A24D;display:inline-block;"></span>' . e($item) . '</span>';
                }
                $checklistHtml .= '</div>';

                $visitPhotoHtml = $this->buildPhotoGridHtml($photoCids);

                $tokens = [
                    '{client_name}'      => $secondaryName,
                    '{dog_names}'        => $dogNames,
                    '{visit_date}'       => $visitDate,
                    '{arrival_time}'     => $arrivalTime,
                    '{departure_time}'   => $departureTime,
                    '{checklist_html}'   => $checklistHtml,
                    '{notes}'            => e($report->notes ?? ''),
                    '{visit_photo_html}' => $visitPhotoHtml,
                    '{dog_photo_html}'   => '',
                    '{portal_url}'       => $portalUrl,
                ];

                $customSubject = \App\Http\Controllers\Admin\NotificationController::getSystemSubject('report_card', $tokens);
                $customHtml    = \App\Http\Controllers\Admin\NotificationController::renderSystemTemplate('report_card', $tokens);

                $html = $customHtml ?? view('emails.report_card', [
                    'client'        => $client,
                    'report'        => $report,
                    'dogNames'      => $dogNames,
                    'dogSections'   => $dogSections,
                    'checklist'     => $checklist,
                    'specialTrip'   => ($report->checklist['special_trip'] ?? false)
                                         ? ($report->special_trip_details ?: 'Yes')
                                         : null,
                    'photoCids'     => $photoCids,
                    'dogPhotoCid'   => null,
                    'arrivalTime'   => $arrivalTime,
                    'departureTime' => $departureTime,
                    'visitDate'     => $visitDate,
                    'portalUrl'     => $portalUrl,
                ])->render();

                $replyAddr = config('services.resend.inbound_address') ?: config('mail.from.address');
                $mail->to($profile->secondary_contact_email, $secondaryName)
                     ->subject($customSubject ?? 'Visit Report Card — The Pupper Club')
                     ->replyTo($replyAddr)
                     ->html($html);

                $logoPath = public_path('images/logo-cream-stacked.png');
                if (file_exists($logoPath)) {
                    $logoPart = new \Symfony\Component\Mime\Part\DataPart(
                        file_get_contents($logoPath), 'logo.png', 'image/png'
                    );
                    $logoPart->asInline();
                    $logoPart->setContentId('logo@thepupperclub.ca');
                    $mail->getSymfonyMessage()->addPart($logoPart);
                }

                $this->embedPhotos($mail->getSymfonyMessage(), $photoPaths, $photoCids);
            });
        }
    }
}

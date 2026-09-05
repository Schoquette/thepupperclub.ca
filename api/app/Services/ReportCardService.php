<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\User;
use App\Models\VisitReport;
use App\Http\Controllers\Admin\NotificationController;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Mime\Email as SymfonyEmail;
use Symfony\Component\Mime\Part\DataPart;

class ReportCardService
{
    private const ADMIN_EMAIL = 'sophie@thepupperclub.ca';
    private const ADMIN_NAME  = 'Sophie @ The Pupper Club';

    /**
     * Send a report card to the client:
     *  1. Creates a visit_report message in the conversation thread
     *  2. Sends an HTML email to the client (+ secondary contact if opted in)
     *     Admin is always BCC'd for confirmation.
     */
    public function send(VisitReport $report): void
    {
        $client = $report->user ?? $report->appointment?->user;
        if (!$client) return;

        $adminId = User::where('role', 'admin')->value('id') ?? 1;

        // ── 1. Chat message ────────────────────────────────────────────────────
        $conversation = Conversation::firstOrCreate(['user_id' => $client->id]);

        $dogs     = $report->appointment?->dogs ?? $client->dogs;
        $dogNames = $dogs->pluck('name')->implode(', ') ?: null;

        $conversation->messages()->create([
            'sender_id' => $adminId,
            'type'      => 'visit_report',
            'body'      => 'Visit Report Card',
            'metadata'  => [
                'report_id'            => $report->id,
                'arrival_time'         => $report->arrival_time?->toIso8601String(),
                'departure_time'       => $report->departure_time?->toIso8601String(),
                'checklist'            => $report->checklist ?? [],
                'dog_data'             => $report->dog_data,
                'special_trip_details' => $report->special_trip_details,
                'notes'                => $report->notes,
                'dog_names'            => $dogNames,
                'has_photo'            => (bool) $report->report_photo_path,
                'photo_count'          => count($report->photo_paths ?? ($report->report_photo_path ? [1] : [])),
            ],
        ]);

        $conversation->increment('unread_count_client');
        $conversation->update(['last_message_at' => now()]);

        $report->update(['sent_at' => now()]);

        // ── 2. Email (best-effort — failure logged but doesn't block the send) ─
        try {
            $this->sendEmail($report, $client, $adminId);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ReportCardService: email failed', [
                'report_id' => $report->id,
                'error'     => $e->getMessage(),
            ]);
            // Also record to the DB-backed error log (visible in the admin
            // dashboard) since the file log isn't reachable on GoDaddy shared
            // hosting without SSH.
            try {
                \App\Models\ErrorLog::create([
                    'user_id'  => $client->id,
                    'type'     => 'report_card_email_failed',
                    'message'  => $e->getMessage(),
                    'context'  => ['report_id' => $report->id, 'trace' => $e->getTraceAsString()],
                    'url'      => null,
                    'ip_address' => null,
                    'created_at' => now(),
                ]);
            } catch (\Throwable $inner) {
                // Never let error-logging itself break the send flow.
            }
        }
    }

    private function sendEmail(VisitReport $report, User $client, int $adminId): void
    {
        $dogs       = $report->appointment?->dogs ?? $client->dogs;
        $dogNames   = $dogs->pluck('name')->implode(', ') ?: 'your pup';
        $dogNameMap = $dogs->pluck('name', 'id')->toArray();
        $firstDog   = $dogs->first();

        // ── Per-dog checklist sections ─────────────────────────────────────────
        $dogSections = [];
        $dogData     = $report->dog_data;

        if (!empty($dogData) && is_array($dogData)) {
            foreach ($dogData as $key => $section) {
                $name  = $dogNameMap[$key] ?? ($key === '_general' ? null : "Dog #{$key}");
                $items = collect($section['checklist'] ?? [])
                    ->filter(fn($v) => (bool) $v)
                    ->keys()
                    ->map(fn($k) => ucwords(str_replace('_', ' ', $k)))
                    ->values()
                    ->all();
                $dogSections[] = ['name' => $name, 'checklist' => $items, 'notes' => $section['notes'] ?? ''];
            }
        } else {
            $items = collect($report->checklist ?? [])
                ->filter(fn($v, $k) => $k !== 'special_trip_details' && (bool) $v)
                ->keys()
                ->map(fn($k) => ucwords(str_replace('_', ' ', $k)))
                ->values()
                ->all();
            $dogSections[] = ['name' => null, 'checklist' => $items, 'notes' => $report->notes ?? ''];
        }

        $checklist = collect($dogSections)->flatMap(fn($s) => $s['checklist'])->unique()->values()->all();

        // ── Photo paths & CIDs ────────────────────────────────────────────────
        $photoPaths = $report->photo_paths ?? [];
        if (empty($photoPaths) && $report->report_photo_path) {
            $photoPaths = [$report->report_photo_path];
        }
        $photoCids = [];
        foreach ($photoPaths as $i => $path) {
            $photoCids[] = "report-photo-{$i}@thepupperclub.ca";
        }

        $dogPhotoCid = ($firstDog && $firstDog->photo_path) ? 'dog-photo@thepupperclub.ca' : null;

        // ── Shared HTML fragments ─────────────────────────────────────────────
        $arrivalTime   = $report->arrival_time?->setTimezone('America/Vancouver')->format('g:i A') ?? '';
        $departureTime = $report->departure_time?->setTimezone('America/Vancouver')->format('g:i A') ?? '';
        $visitDate     = $report->arrival_time?->setTimezone('America/Vancouver')->format('F j, Y') ?? '';
        $portalUrl     = rtrim(config('services.frontend_url', 'https://thepupperclub.ca'), '/') . '/client/report-cards';
        $replyAddr     = config('services.resend.inbound_address') ?: config('mail.from.address');

        $checklistHtml = $this->buildChecklistHtml($checklist);
        $visitPhotoHtml = $this->buildPhotoGridHtml($photoCids);
        $dogPhotoHtmlStr = $dogPhotoCid
            ? '<div style="text-align:center;margin-bottom:20px;"><img src="cid:' . $dogPhotoCid . '" alt="Dog photo" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #C9A24D;"></div>'
            : '';

        $tokens = [
            '{client_name}'      => $client->name,
            '{dog_names}'        => $dogNames,
            '{visit_date}'       => $visitDate,
            '{arrival_time}'     => $arrivalTime,
            '{departure_time}'   => $departureTime,
            '{checklist_html}'   => $checklistHtml,
            '{notes}'            => nl2br(e($report->notes ?? '')),
            '{visit_photo_html}' => $visitPhotoHtml,
            '{dog_photo_html}'   => $dogPhotoHtmlStr,
            '{portal_url}'       => $portalUrl,
        ];

        $subject     = NotificationController::getSystemSubject('report_card', $tokens)
                       ?? 'Visit Report Card — The Pupper Club';
        $customHtml  = NotificationController::renderSystemTemplate('report_card', $tokens);
        $html        = $customHtml ?? view('emails.report_card', [
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

        // ── Primary email (client + admin BCC) ────────────────────────────────
        Mail::send([], [], function ($mail) use (
            $client, $subject, $html, $replyAddr,
            $photoPaths, $photoCids, $dogPhotoCid, $firstDog
        ) {
            $mail->to($client->email, $client->name)
                 ->bcc(self::ADMIN_EMAIL, self::ADMIN_NAME)
                 ->subject($subject)
                 ->replyTo($replyAddr)
                 ->html($html);

            $this->attachLogo($mail->getSymfonyMessage());
            $this->embedPhotos($mail->getSymfonyMessage(), $photoPaths, $photoCids);
            $this->embedDogPhoto($mail->getSymfonyMessage(), $firstDog, $dogPhotoCid);
        });

        $report->update(['email_sent_at' => now()]);

        // ── Secondary contact (if opted in) ───────────────────────────────────
        $profile = $client->clientProfile;
        if ($profile && $profile->secondary_notify_report_cards && !empty($profile->secondary_contact_email)) {
            $secondaryName   = $profile->secondary_contact_name ?: $profile->secondary_contact_email;
            $secondaryTokens = array_merge($tokens, ['{client_name}' => $secondaryName, '{dog_photo_html}' => '']);
            $secondaryHtml   = NotificationController::renderSystemTemplate('report_card', $secondaryTokens)
                               ?? view('emails.report_card', array_merge(
                                   compact('report', 'dogNames', 'dogSections', 'checklist', 'photoCids',
                                           'arrivalTime', 'departureTime', 'visitDate', 'portalUrl'),
                                   ['client' => $client, 'dogPhotoCid' => null,
                                    'specialTrip' => ($report->checklist['special_trip'] ?? false)
                                                       ? ($report->special_trip_details ?: 'Yes') : null]
                               ))->render();

            Mail::send([], [], function ($mail) use (
                $profile, $secondaryName, $subject, $secondaryHtml, $replyAddr,
                $photoPaths, $photoCids
            ) {
                $mail->to($profile->secondary_contact_email, $secondaryName)
                     ->subject($subject)
                     ->replyTo($replyAddr)
                     ->html($secondaryHtml);

                $this->attachLogo($mail->getSymfonyMessage());
                $this->embedPhotos($mail->getSymfonyMessage(), $photoPaths, $photoCids);
            });
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function buildChecklistHtml(array $checklist): string
    {
        $html = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        foreach ($checklist as $item) {
            $html .= '<span style="display:inline-flex;align-items:center;gap:6px;background:#F6F3EE;border-radius:20px;padding:6px 12px;font-size:13px;color:#3B2F2A;">'
                   . '<span style="width:8px;height:8px;border-radius:50%;background:#C9A24D;display:inline-block;"></span>'
                   . e($item) . '</span>';
        }
        return $html . '</div>';
    }

    private function buildPhotoGridHtml(array $photoCids): string
    {
        if (empty($photoCids)) return '';

        $count  = count($photoCids);
        $cols   = min($count, 3);
        $width  = match ($cols) { 1 => '100%', 2 => '49%', default => '32%' };
        $height = $count === 1 ? '300px' : '180px';

        $html = '<div style="margin:0 0 20px;"><table width="100%" cellspacing="4" cellpadding="0" border="0"><tr>';
        foreach ($photoCids as $i => $cid) {
            if ($i > 0 && $i % $cols === 0) $html .= '</tr><tr>';
            $html .= '<td width="' . $width . '" style="vertical-align:top;">'
                   . '<img src="cid:' . $cid . '" alt="Visit photo" style="width:100%;height:' . $height . ';object-fit:cover;border-radius:6px;display:block;">'
                   . '</td>';
        }
        // Pad last row
        $remainder = $count % $cols;
        if ($remainder > 0) {
            for ($j = $remainder; $j < $cols; $j++) {
                $html .= '<td width="' . $width . '"></td>';
            }
        }
        return $html . '</tr></table></div>';
    }

    private function attachLogo(SymfonyEmail $message): void
    {
        $logoPath = public_path('images/logo-cream-stacked.png');
        if (!file_exists($logoPath)) return;
        $part = new DataPart(file_get_contents($logoPath), 'logo.png', 'image/png');
        $part->asInline();
        $part->setContentId('logo@thepupperclub.ca');
        $message->addPart($part);
    }

    private function embedPhotos(SymfonyEmail $message, array $photoPaths, array $photoCids): void
    {
        foreach ($photoPaths as $i => $path) {
            if (!isset($photoCids[$i])) continue;
            if (!Storage::disk('local')->exists($path)) continue;
            $content = Storage::disk('local')->get($path);
            $ext     = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $mime    = in_array($ext, ['jpg', 'jpeg']) ? 'image/jpeg' : "image/{$ext}";

            [$content, $mime, $ext] = $this->resizeForEmail($content, $mime, $ext);

            $part = new DataPart($content, "photo-{$i}.{$ext}", $mime);
            $part->asInline();
            $part->setContentId($photoCids[$i]);
            $message->addPart($part);
        }
    }

    /**
     * Downscale + recompress an image for email embedding. Report card
     * photos come straight off phone cameras (multiple MB each); embedding
     * several full-resolution originals pushes the total message past
     * providers' size limits (e.g. Gmail's 25MB) and the whole email
     * silently bounces — the recipient never sees it, and Resend still
     * reports "sent" since it only reflects the initial handoff, not final
     * delivery. Emails only need to look good in an inbox, not print
     * quality — stored originals for the portal/PDF are untouched.
     */
    private function resizeForEmail(string $content, string $mime, string $ext, int $maxDimension = 1280, int $quality = 72): array
    {
        if (!extension_loaded('gd')) {
            return [$content, $mime, $ext];
        }
        try {
            $src = @imagecreatefromstring($content);
            if (!$src) {
                return [$content, $mime, $ext];
            }
            $width = imagesx($src);
            $height = imagesy($src);
            if (max($width, $height) > $maxDimension) {
                $ratio = $maxDimension / max($width, $height);
                $newWidth = max(1, (int) round($width * $ratio));
                $newHeight = max(1, (int) round($height * $ratio));
                $resized = imagecreatetruecolor($newWidth, $newHeight);
                imagecopyresampled($resized, $src, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
                imagedestroy($src);
                $src = $resized;
            }
            ob_start();
            imagejpeg($src, null, $quality);
            $data = ob_get_clean();
            imagedestroy($src);
            return [$data, 'image/jpeg', 'jpg'];
        } catch (\Throwable $e) {
            return [$content, $mime, $ext];
        }
    }

    private function embedDogPhoto(SymfonyEmail $message, $firstDog, ?string $dogPhotoCid): void
    {
        if (!$dogPhotoCid || !$firstDog || !$firstDog->photo_path) return;
        if (!Storage::disk('local')->exists($firstDog->photo_path)) return;
        $content = Storage::disk('local')->get($firstDog->photo_path);
        $ext     = strtolower(pathinfo($firstDog->photo_path, PATHINFO_EXTENSION));
        $mime    = in_array($ext, ['jpg', 'jpeg']) ? 'image/jpeg' : "image/{$ext}";
        [$content, $mime, $ext] = $this->resizeForEmail($content, $mime, $ext, 300, 75);
        $part    = new DataPart($content, "dog-photo.{$ext}", $mime);
        $part->asInline();
        $part->setContentId($dogPhotoCid);
        $message->addPart($part);
    }
}

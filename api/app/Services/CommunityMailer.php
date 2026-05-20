<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Send branded emails on behalf of the Community portal.
 *
 * All Community-originated mail (Contact Us, connection requests,
 * broadcast notifications, donation receipts, etc.) routes through here
 * so it shares the same `emails.layout` + inline logo treatment that the
 * Client Portal uses. The view template is `emails.notification` —
 * intentionally the same one the Client Portal renders — so the visual
 * identity stays consistent across both portals.
 *
 * Returns true on a successful send, false on failure. Failures are
 * logged but never thrown — callers should handle the false return and
 * decide how loud to be about it (most queue a fallback log entry).
 */
class CommunityMailer
{
    /**
     * @param array{name?: string|null}                  $toName       Optional display name for the recipient.
     * @param array{filename: string, mime: string, data: string} ...$inlineImages
     *                  Optional inline images. Each gets a Content-ID
     *                  the template can reference via cid:.
     */
    public function send(
        string $toEmail,
        string $subject,
        string $title,
        string $htmlContent,
        ?string $toName = null,
        ?string $replyTo = null,
        ?string $replyToName = null,
        array $inlineImages = [],
    ): bool {
        $logoPath = public_path('images/logo-cream-stacked.png');

        try {
            Mail::send([], [], function ($message) use (
                $toEmail, $toName, $subject, $title, $htmlContent, $replyTo, $replyToName, $logoPath, $inlineImages
            ) {
                $rendered = view('emails.notification', [
                    'title'   => $title,
                    'content' => $htmlContent,
                ])->render();

                $message
                    ->to($toEmail, $toName)
                    ->subject($subject)
                    ->html($rendered);

                $symfony = $message->getSymfonyMessage();

                // Inline brand logo so the blue header band on the layout
                // template renders properly across all major mail clients.
                if (file_exists($logoPath)) {
                    $logoPart = new \Symfony\Component\Mime\Part\DataPart(
                        file_get_contents($logoPath),
                        'logo.png',
                        'image/png',
                    );
                    $logoPart->asInline();
                    $logoPart->setContentId('logo@thepupperclub.ca');
                    $symfony->addPart($logoPart);
                }

                foreach ($inlineImages as $img) {
                    $part = new \Symfony\Component\Mime\Part\DataPart(
                        $img['data'],
                        $img['filename'] ?? 'photo.jpg',
                        $img['mime'] ?? 'image/jpeg',
                    );
                    $part->asInline();
                    $part->setContentId($img['cid'] ?? uniqid('img@thepupperclub.ca'));
                    $symfony->addPart($part);
                }

                // Reply-To: if the caller passed a specific one (e.g. a
                // Contact Us submitter), use it. Otherwise fall back to the
                // inbound address so replies land in the portal inbox.
                if ($replyTo) {
                    $message->replyTo($replyTo, $replyToName);
                } else {
                    $inbound = config('services.resend.inbound_address');
                    $message->replyTo($inbound ?: config('mail.from.address'));
                }
            });
            return true;
        } catch (\Throwable $e) {
            Log::warning('CommunityMailer: send failed', [
                'to'      => $toEmail,
                'subject' => $subject,
                'error'   => $e->getMessage(),
            ]);
            return false;
        }
    }
}

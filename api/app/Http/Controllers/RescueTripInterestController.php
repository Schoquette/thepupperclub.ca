<?php

namespace App\Http\Controllers;

use App\Models\RescueTripInterest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

class RescueTripInterestController extends Controller
{
    /** Recognised trip slugs → human labels for the admin email + DB column. */
    private const TRIPS = [
        'costa-rica' => 'Costa Rica — Surf Camp + Dog Rescue',
        'merida'     => 'Mérida, Mexico — Kitesurfing + Dog Rescue',
        'puebla'     => 'Puebla, Mexico — Culture + Dog Rescue',
        'seoul'      => 'Seoul, South Korea — Culture, Sightseeing + Dog Rescue',
        'general'    => 'General — open to any trip',
    ];

    /**
     * POST /api/rescue-trip-interest
     * Public endpoint. Accepts the visitor's name, email, trip slug, and
     * optional comments. Stores a row, sends a branded admin alert to
     * sophie@thepupperclub.ca with the visitor as Reply-To.
     */
    public function store(Request $request): JsonResponse
    {
        // Rate-limit by IP — 8 submissions per 15 minutes is plenty for
        // a real visitor and a low ceiling for casual spam.
        $key = 'rescue-trip:' . ($request->ip() ?: 'anon');
        if (RateLimiter::tooManyAttempts($key, 8)) {
            return response()->json([
                'message' => 'Too many submissions from this address. Please try again in a bit.',
            ], 429);
        }
        RateLimiter::hit($key, 60 * 15);

        $data = $request->validate([
            'name'      => 'required|string|max:120',
            'email'     => 'required|email|max:255',
            'trip'      => 'required|string|in:' . implode(',', array_keys(self::TRIPS)),
            'comments'  => 'nullable|string|max:2000',
            // Honeypot: visible-to-bots field that must stay empty.
            'website'   => 'nullable|string|max:0',
        ]);

        $label = self::TRIPS[$data['trip']];

        $row = RescueTripInterest::create([
            'name'       => trim($data['name']),
            'email'      => strtolower(trim($data['email'])),
            'trip_slug'  => $data['trip'],
            'trip_label' => $label,
            'comments'   => isset($data['comments']) ? trim($data['comments']) : null,
            'source_url' => $request->headers->get('Referer'),
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 500),
        ]);

        $this->emailAdmin($row);

        return response()->json([
            'message' => 'Thanks! We’ll be in touch as soon as this trip opens up.',
        ], 201);
    }

    /**
     * Send the branded admin alert. Failures are swallowed but logged so
     * the visitor's row is preserved even if mail breaks.
     */
    private function emailAdmin(RescueTripInterest $row): void
    {
        $to = config('mail.community_support_address', 'sophie@thepupperclub.ca');
        $subject = '[Rescue Trips] Interest from ' . $row->name . ' — ' . $row->trip_label;

        $title = 'New Rescue Trip interest';

        $commentsHtml = $row->comments
            ? '<p><strong>Comments:</strong></p>'
                . '<p style="border-left:3px solid #6492D8;padding-left:14px;color:#3B2F2A;font-style:italic;">'
                . nl2br(e($row->comments)) . '</p>'
            : '';

        $content =
            '<p><strong>Visitor:</strong> ' . e($row->name) . ' &lt;' . e($row->email) . '&gt;</p>'
          . '<p><strong>Trip:</strong> ' . e($row->trip_label) . '</p>'
          . ($row->source_url ? '<p><strong>From:</strong> ' . e($row->source_url) . '</p>' : '')
          . '<hr style="border:none;border-top:1px solid #F6F3EE;margin:24px 0;">'
          . $commentsHtml
          . '<p style="color:#5a4a44;font-size:13px;">Reply directly to this email to reach them — their address is set as Reply-To.</p>';

        try {
            $logoPath = public_path('images/logo-cream-stacked.png');
            Mail::send([], [], function ($message) use ($to, $subject, $title, $content, $row, $logoPath) {
                $rendered = view('emails.notification', [
                    'title'   => $title,
                    'content' => $content,
                ])->render();

                $message->to($to)
                    ->subject($subject)
                    ->replyTo($row->email, $row->name)
                    ->html($rendered);

                $symfony = $message->getSymfonyMessage();
                if (file_exists($logoPath)) {
                    $part = new \Symfony\Component\Mime\Part\DataPart(
                        file_get_contents($logoPath),
                        'logo.png',
                        'image/png',
                    );
                    $part->asInline();
                    $part->setContentId('logo@thepupperclub.ca');
                    $symfony->addPart($part);
                }
            });
        } catch (\Throwable $e) {
            Log::warning('RescueTripInterest: email failed', [
                'row_id' => $row->id,
                'error'  => $e->getMessage(),
            ]);
        }
    }
}

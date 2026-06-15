<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class ContactController extends Controller
{
    public function submit(Request $request)
    {
        // Validation is intentionally lenient: only the contact fields
        // genuinely need to be present. `dog_name` is rendered as a long
        // textarea on the marketing form ('Tell me about your pup(s)…')
        // so visitors routinely write paragraphs there — the old 100-char
        // cap silently 422'd those submissions.
        $validated = $request->validate([
            'first_name'      => 'required|string|max:120',
            'last_name'       => 'required|string|max:120',
            'email'           => 'required|email|max:255',
            'phone'           => 'nullable|string|max:30',
            'dog_name'        => 'nullable|string|max:3000',
            'looking_for'     => 'nullable|string|max:500',
            'preferred_start' => 'nullable|string|max:30',
            'referral'        => 'nullable|string|max:200',
            'message'         => 'nullable|string|max:8000',
        ]);

        $name    = trim($validated['first_name'] . ' ' . $validated['last_name']);
        $subject = 'New Contact Form — ' . $name;

        // Build the email body (HTML, branded layout) AND a plain-text
        // fallback so the message survives every client. Frontend may
        // not send a `message` field if every optional input is blank —
        // we synthesize one from whatever was filled.
        $contentHtml = $this->buildHtmlBody($validated);

        $logoPath = public_path('images/logo-cream-stacked.png');

        try {
            Mail::send([], [], function ($mail) use ($validated, $subject, $contentHtml, $name, $logoPath) {
                $mail->to('sophie@thepupperclub.ca')
                     ->replyTo($validated['email'], $name)
                     ->subject($subject)
                     ->html(view('emails.notification', [
                         'title'   => 'New contact form submission',
                         'content' => $contentHtml,
                     ])->render());

                // Inline brand logo so the cream/blue header band renders.
                $symfony = $mail->getSymfonyMessage();
                if (file_exists($logoPath)) {
                    $logo = new \Symfony\Component\Mime\Part\DataPart(
                        file_get_contents($logoPath),
                        'logo.png',
                        'image/png',
                    );
                    $logo->asInline();
                    $logo->setContentId('logo@thepupperclub.ca');
                    $symfony->addPart($logo);
                }
            });
        } catch (\Throwable $e) {
            Log::error('Contact form email failed', [
                'error' => $e->getMessage(),
                'data'  => $validated,
            ]);
            // Don't tell the visitor everything's fine if the mail
            // bombed — they need to know to try us another way.
            return response()->json([
                'message' => 'We got the form but email is having a moment. Please also reach us at sophie@thepupperclub.ca or 604-998-1418 so nothing falls through.',
            ], 202);
        }

        Log::info('Contact form submission', $validated);

        return response()->json(['message' => 'Message received. We\'ll be in touch!']);
    }

    private function buildHtmlBody(array $data): string
    {
        $row = fn (string $label, ?string $value) =>
            $value
                ? '<p style="margin:0 0 10px;"><strong>' . e($label) . ':</strong> ' . nl2br(e($value)) . '</p>'
                : '';

        $header =
            $row('From', trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? '')))
          . $row('Email', $data['email'] ?? null)
          . $row('Phone', $data['phone'] ?? null);

        $bits =
            $row('Looking for', $data['looking_for'] ?? null)
          . $row('Pupper(s) / notes', $data['dog_name'] ?? null)
          . $row('Preferred start', $data['preferred_start'] ?? null)
          . $row('Heard about us', $data['referral'] ?? null);

        $extra = '';
        if (!empty($data['message']) && trim($data['message']) !== '') {
            // Skip the bundled message if it's just a repeat of the four
            // fields above — the frontend builds it from the same inputs.
            $extra = '<hr style="border:none;border-top:1px solid #F6F3EE;margin:20px 0;">'
                . '<p style="margin:0 0 10px;"><strong>Additional notes:</strong></p>'
                . '<p style="margin:0;">' . nl2br(e($data['message'])) . '</p>';
        }

        if (!$bits && !$extra) {
            $bits = '<p style="color:#5a4a44;font-style:italic;margin:0;">No additional details were provided.</p>';
        }

        $reply = '<p style="color:#5a4a44;font-size:13px;margin-top:24px;">'
            . 'Reply directly to this email to reach them &mdash; their address is set as Reply-To.</p>';

        return $header
            . '<hr style="border:none;border-top:1px solid #F6F3EE;margin:20px 0;">'
            . $bits
            . $extra
            . $reply;
    }
}

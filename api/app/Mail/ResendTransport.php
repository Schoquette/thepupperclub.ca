<?php

namespace App\Mail;

use App\Models\EmailLog;
use App\Models\User;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;
use Symfony\Component\Mime\Part\DataPart;

class ResendTransport extends AbstractTransport
{
    /** Copied on every email sent to a client, regardless of which code
     *  path composed it -- this transport is the single funnel all
     *  outbound mail passes through. */
    private const OWNER_EMAIL = 'sophie@thepupperclub.ca';

    public function __construct(
        private string $apiKey,
    ) {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());

        $payload = [
            'from'    => $this->formatAddress($email->getFrom()[0] ?? null),
            'to'      => array_map(fn(Address $a) => $this->formatAddress($a), $email->getTo()),
            'subject' => $email->getSubject() ?? '(no subject)',
        ];

        if ($email->getHtmlBody()) {
            $payload['html'] = $email->getHtmlBody();
        }
        if ($email->getTextBody()) {
            $payload['text'] = $email->getTextBody();
        }

        $replyTo = $email->getReplyTo();
        if (!empty($replyTo)) {
            $payload['reply_to'] = array_map(fn(Address $a) => $this->formatAddress($a), $replyTo);
        }

        $cc = $email->getCc();
        if (!empty($cc)) {
            $payload['cc'] = array_map(fn(Address $a) => $this->formatAddress($a), $cc);
        }

        $bcc = $email->getBcc();
        $bccAddresses = !empty($bcc) ? array_map(fn(Address $a) => $this->formatAddress($a), $bcc) : [];

        // Copy the business owner on every email sent to a client. Checked
        // by looking up the primary recipient rather than trusting a flag
        // from the caller, so this can never be missed by a new email type
        // that forgets to opt in.
        $firstTo = $email->getTo()[0] ?? null;
        if ($firstTo) {
            $recipient = User::where('email', $firstTo->getAddress())->first();
            if ($recipient && $recipient->role === 'client' && !in_array(self::OWNER_EMAIL, $bccAddresses, true)) {
                $bccAddresses[] = self::OWNER_EMAIL;
            }
        }

        if (!empty($bccAddresses)) {
            $payload['bcc'] = $bccAddresses;
        }

        // Handle attachments (inline + regular)
        $attachments = $email->getAttachments();
        if (!empty($attachments)) {
            $payload['attachments'] = [];
            foreach ($attachments as $attachment) {
                if ($attachment instanceof DataPart) {
                    $item = [
                        'filename' => $attachment->getFilename() ?? 'attachment',
                        'content'  => base64_encode($attachment->getBody()),
                    ];

                    $contentId = $attachment->getContentId();
                    if ($contentId) {
                        // Strip angle brackets — Symfony wraps CIDs in <...>
                        $item['content_id'] = trim($contentId, '<>');
                    }

                    $payload['attachments'][] = $item;
                }
            }
        }

        $toEmail = $payload['to'][0] ?? '';
        $subject = $payload['subject'] ?? '';
        $mailClass = get_class($message->getOriginalMessage());

        try {
            $client = new Client();
            $response = $client->post('https://api.resend.com/emails', [
                'headers' => [
                    'Authorization' => "Bearer {$this->apiKey}",
                    'Content-Type'  => 'application/json',
                ],
                'json' => $payload,
            ]);

            $body = json_decode($response->getBody()->getContents(), true);
            $resendId = $body['id'] ?? null;
            if ($resendId) {
                $message->setMessageId($resendId);
            }

            $this->logEmail($toEmail, $subject, $mailClass, 'sent', null, $resendId, $email->getHtmlBody());
        } catch (\Throwable $e) {
            $this->logEmail($toEmail, $subject, $mailClass, 'failed', $e->getMessage(), null, $email->getHtmlBody());
            throw $e;
        }
    }

    public function __toString(): string
    {
        return 'resend';
    }

    private function logEmail(string $to, string $subject, string $mailClass, string $status, ?string $error, ?string $resendId, ?string $bodyHtml = null): void
    {
        try {
            static $bodyHtmlColumnChecked = false;
            if (!$bodyHtmlColumnChecked) {
                $bodyHtmlColumnChecked = true;
                if (!Schema::hasColumn('email_logs', 'body_html')) {
                    DB::statement("ALTER TABLE `email_logs` ADD COLUMN `body_html` MEDIUMTEXT NULL");
                }
            }

            $user = User::where('email', $to)->first();
            EmailLog::create([
                'user_id'       => $user?->id,
                'to_email'      => $to,
                'subject'       => $subject,
                'mail_class'    => class_basename($mailClass),
                'status'        => $status,
                'error_message' => $error,
                'resend_id'     => $resendId,
                'body_html'     => $bodyHtml,
                'created_at'    => now(),
            ]);
        } catch (\Throwable $e) {
            // Don't let logging failures break email sending
        }
    }

    private function formatAddress(?Address $address): string
    {
        if (!$address) return '';
        $name = $address->getName();
        $email = $address->getAddress();
        return $name ? "{$name} <{$email}>" : $email;
    }
}

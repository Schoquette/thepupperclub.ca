<?php

namespace App\Mail;

use GuzzleHttp\Client;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;
use Symfony\Component\Mime\Part\DataPart;

class ResendTransport extends AbstractTransport
{
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
        if (!empty($bcc)) {
            $payload['bcc'] = array_map(fn(Address $a) => $this->formatAddress($a), $bcc);
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

        $client = new Client();
        $response = $client->post('https://api.resend.com/emails', [
            'headers' => [
                'Authorization' => "Bearer {$this->apiKey}",
                'Content-Type'  => 'application/json',
            ],
            'json' => $payload,
        ]);

        $body = json_decode($response->getBody()->getContents(), true);
        if (isset($body['id'])) {
            $message->setMessageId($body['id']);
        }
    }

    public function __toString(): string
    {
        return 'resend';
    }

    private function formatAddress(?Address $address): string
    {
        if (!$address) return '';
        $name = $address->getName();
        $email = $address->getAddress();
        return $name ? "{$name} <{$email}>" : $email;
    }
}

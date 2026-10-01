<?php

namespace App\Http\Controllers;

use App\Models\ClientDocument;
use App\Models\Conversation;
use App\Services\NotificationDispatcher;
use App\Services\SignedPdfBuilder;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SigningController extends Controller
{
    /**
     * Admin requests a signature on a document.
     * POST /admin/clients/{client}/documents/{document}/request-signature
     */
    public function request(Request $request, int $clientId, ClientDocument $document): JsonResponse
    {
        abort_unless((int) $document->user_id === $clientId, 404);
        abort_unless($document->mime_type === 'application/pdf', 422, 'Only PDF documents can be sent for signature.');
        abort_if($document->signed_at, 422, 'This document has already been signed.');

        $token = Str::random(64);

        $document->update([
            'signature_requested_at' => now(),
            'signature_token'        => ClientDocument::hashToken($token),
        ]);

        $frontendUrl = rtrim(env('FRONTEND_URL', 'https://thepupperclub.ca'), '/');
        $signingUrl  = "{$frontendUrl}/sign/{$token}";

        // Send a message in the client's conversation thread
        $admin        = $request->user();
        $conversation = Conversation::firstOrCreate(['user_id' => $clientId]);
        $conversation->messages()->create([
            'sender_id' => $admin->id,
            'type'      => 'text',
            'body'      => "Please review and sign the document **{$document->filename}**:\n\n{$signingUrl}",
            'metadata'  => ['signing_url' => $signingUrl, 'document_id' => $document->id],
        ]);

        // Send branded email notification with signing link
        $client = $document->user;
        if ($client) {
            $tokens = [
                '{client_name}'   => $client->name,
                '{document_name}' => $document->filename,
                '{signing_url}'   => $signingUrl,
            ];

            $customSubject = Admin\NotificationController::getSystemSubject('signature_request', $tokens);
            $customHtml    = Admin\NotificationController::renderSystemTemplate('signature_request', $tokens);

            $title = $customSubject ?? "Document for Signature — The Pupper Club";
            $body  = "Please review and sign \"{$document->filename}\". Open the link in your portal to sign.";

            // Build inner HTML content (NOT the full layout — NotificationDispatcher wraps it)
            $htmlBody = $customHtml ?? '<p>Hi ' . e($client->name) . ',</p>'
                . '<p>A document has been sent to you for review and signature:</p>'
                . '<p style="background:#F6F3EE;border-radius:8px;padding:14px 18px;font-size:14px;">'
                . '<strong style="color:#3B2F2A;">' . e($document->filename) . '</strong></p>'
                . '<p>Please review the document carefully and provide your electronic signature at the link below.</p>'
                . '<p style="text-align:center;margin:28px 0;">'
                . '<a href="' . $signingUrl . '" style="display:inline-block;background:#C9A24D;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:bold;font-size:15px;">'
                . 'Review &amp; Sign Document</a></p>'
                . '<p style="font-size:13px;color:#C8BFB6;">This link is unique to you. Once signed, it cannot be reused.</p>';

            app(NotificationDispatcher::class)->notify($client, $title, $body, $htmlBody, type: 'documents');
        }

        return response()->json([
            'signing_url' => $signingUrl,
            'token'       => $token,
        ]);
    }

    /**
     * Admin adds/sends a non-portal external co-signer on a client's document.
     * Must be called before the client signs — once the client has signed,
     * maybeAdvance() may already have completed the document.
     * POST /admin/clients/{client}/documents/{document}/add-external-signer
     */
    public function addExternalSigner(Request $request, int $clientId, ClientDocument $document): JsonResponse
    {
        abort_unless((int) $document->user_id === $clientId, 404);
        abort_if($document->signed_at, 422, 'The client has already signed this document — an external co-signer must be added before the client signs.');
        abort_if($document->external_signed_at, 422, 'This external co-signer has already signed.');

        $data = $request->validate([
            'name'  => 'required|string|max:255',
            'email' => 'required|email|max:255',
        ]);

        $token = Str::random(64);
        $document->update([
            'external_recipient_name'         => $data['name'],
            'external_recipient_email'        => $data['email'],
            'external_signature_token'        => ClientDocument::hashToken($token),
            'external_signature_requested_at' => now(),
        ]);

        $frontendUrl = rtrim(env('FRONTEND_URL', 'https://thepupperclub.ca'), '/');
        $signingUrl  = "{$frontendUrl}/sign/{$token}";

        try {
            $logoPath  = public_path('images/logo-cream-stacked.png');
            $replyAddr = config('services.resend.inbound_address') ?: config('mail.from.address');
            $title     = "Document for Signature — The Pupper Club";
            $recipientName = $data['name'];
            $recipientEmail = $data['email'];
            \Illuminate\Support\Facades\Mail::send([], [], function ($message) use ($recipientName, $recipientEmail, $title, $signingUrl, $document, $logoPath, $replyAddr) {
                $message->to($recipientEmail)
                    ->subject($title)
                    ->replyTo($replyAddr)
                    ->html(view('emails.signature_request', [
                        'userName'     => $recipientName,
                        'documentName' => $document->filename,
                        'signingUrl'   => $signingUrl,
                    ])->render());
                if (file_exists($logoPath)) {
                    $logoPart = new \Symfony\Component\Mime\Part\DataPart(
                        file_get_contents($logoPath), 'logo.png', 'image/png'
                    );
                    $logoPart->asInline();
                    $logoPart->setContentId('logo@thepupperclub.ca');
                    $message->getSymfonyMessage()->addPart($logoPart);
                }
            });
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('External co-signer email failed', ['error' => $e->getMessage()]);
            try {
                \App\Models\ErrorLog::create([
                    'user_id'    => $clientId,
                    'type'       => 'ExternalSigningRequestEmailFailed',
                    'message'    => $e->getMessage(),
                    'context'    => ['document_id' => $document->id],
                    'created_at' => now(),
                ]);
            } catch (\Throwable $logError) {}
        }

        return response()->json([
            'external_signing_url' => $signingUrl,
            'token'                => $token,
        ]);
    }

    /**
     * Public: return document metadata for the signing page.
     * GET /signing/{token}
     */
    public function show(string $token): JsonResponse
    {
        [$document, $targetRole] = $this->resolveByToken($token);
        $isCountersign = $targetRole === 'company';

        if ($targetRole === 'company') {
            abort_if($document->countersigned_at, 410, 'This document has already been counter-signed.');
        } elseif ($targetRole === 'client') {
            abort_if($document->signed_at, 410, 'This document has already been signed.');
        } else {
            abort_if($document->external_signed_at, 410, 'This document has already been signed.');
        }

        // Track first view and notify admin (client signing only)
        if ($targetRole === 'client' && !$document->first_viewed_at) {
            $document->update(['first_viewed_at' => now()]);

            // Notify admin that client opened the document
            $admin = \App\Models\User::whereIn('role', ['admin', 'superadmin'])->first();
            $client = $document->user;
            if ($admin && $client) {
                $title = "Document viewed — {$document->filename}";
                $body  = "{$client->name} has opened \"{$document->filename}\" for the first time.";
                app(NotificationDispatcher::class)->notify($admin, $title, $body);
            }
        }

        $fields = [];
        $values = match ($targetRole) {
            'company'  => $document->countersign_field_values ?? [],
            'external' => $document->external_field_values ?? [],
            default    => $document->field_values ?? [],
        };

        if ($document->template) {
            foreach ($document->template->fields as $field) {
                // Only show fields assigned to the current signer
                $fieldRole = $field->assigned_to ?? 'client';
                if ($fieldRole !== $targetRole) continue;

                $fields[] = [
                    'id'            => $field->id,
                    'label'         => $field->label,
                    'field_type'    => $field->field_type,
                    'assigned_to'   => $fieldRole,
                    'page'          => $field->page,
                    'x'             => $field->x,
                    'y'             => $field->y,
                    'width'         => $field->width,
                    'height'        => $field->height,
                    'required'      => $field->required,
                    'sort_order'    => $field->sort_order,
                    'default_value' => $field->default_value,
                    'value'         => $values[$field->id] ?? '',
                ];
            }
        }

        return response()->json([
            'data' => [
                'id'                       => $document->id,
                'filename'                 => $document->filename,
                'client'                   => $document->user?->name,
                'external_recipient_name'  => $document->external_recipient_name,
                'requested'                => $document->signature_requested_at,
                'signed'                   => $document->signed_at,
                'is_countersign'           => $isCountersign,
                'signer_role'              => $targetRole,
                'has_fields'               => count($fields) > 0,
                'fields'                   => $fields,
                'field_values'             => $values,
            ],
        ]);
    }

    /**
     * Look up a document by any of its three signer tokens (countersign,
     * client, external), in that order, and return it with the matching role.
     *
     * @return array{0: ClientDocument, 1: string} [$document, $role]
     */
    private function resolveByToken(string $token): array
    {
        $hashed = ClientDocument::hashToken($token);

        $document = ClientDocument::where('countersign_token', $hashed)->with('template.fields')->first();
        if ($document) {
            return [$document, 'company'];
        }

        $document = ClientDocument::where('signature_token', $hashed)->with('template.fields')->first();
        if ($document) {
            return [$document, 'client'];
        }

        $document = ClientDocument::where('external_signature_token', $hashed)->with('template.fields')->firstOrFail();
        return [$document, 'external'];
    }

    /**
     * Public: serve the PDF for display on the signing page.
     * GET /signing/{token}/document
     */
    public function serveDocument(string $token): StreamedResponse
    {
        // Support all three signer tokens
        $hashed = ClientDocument::hashToken($token);
        $document = ClientDocument::where('signature_token', $hashed)->first()
            ?? ClientDocument::where('countersign_token', $hashed)->first()
            ?? ClientDocument::where('external_signature_token', $hashed)->firstOrFail();

        abort_unless(Storage::disk('local')->exists($document->storage_path), 404);

        return Storage::disk('local')->response(
            $document->storage_path,
            $document->filename,
            ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'inline']
        );
    }

    /**
     * Public: submit the signature.
     * POST /signing/{token}/sign
     */
    public function sign(Request $request, string $token): JsonResponse
    {
        $hashed = ClientDocument::hashToken($token);
        $document = ClientDocument::where('countersign_token', $hashed)->with(['user', 'template.fields'])->first();
        $targetRole = 'company';
        if (!$document) {
            $document = ClientDocument::where('signature_token', $hashed)->with(['user', 'template.fields'])->first();
            $targetRole = 'client';
        }
        if (!$document) {
            $document = ClientDocument::where('external_signature_token', $hashed)->with(['user', 'template.fields'])->firstOrFail();
            $targetRole = 'external';
        }

        if ($targetRole === 'company') {
            abort_if($document->countersigned_at, 410, 'This document has already been counter-signed.');
        } elseif ($targetRole === 'client') {
            abort_if($document->signed_at, 410, 'This document has already been signed.');
        } else {
            abort_if($document->external_signed_at, 410, 'This document has already been signed.');
        }

        $data = $request->validate([
            'signer_name'    => 'required|string|max:255',
            'signature_data' => 'required|string',
            'field_values'   => 'nullable|array',
        ]);

        $base64 = $data['signature_data'];
        if (str_contains($base64, ',')) {
            $base64 = explode(',', $base64, 2)[1];
        }

        if ($targetRole === 'company') {
            // Counter-sign by admin/company
            $document->update([
                'countersigned_at'          => now(),
                'countersigner_name'        => $data['signer_name'],
                'countersigner_ip'          => $request->ip(),
                'countersign_signature_data' => $base64,
                'countersign_field_values'  => $data['field_values'] ?? null,
                'status'                    => 'completed',
            ]);

            // Re-generate certificate with all signatures
            $this->generateCertificate($document->fresh('user'));

            return response()->json(['message' => 'Document counter-signed successfully.']);
        }

        if ($targetRole === 'external') {
            $updateData = [
                'external_signed_at'      => now(),
                'external_signer_name'    => $data['signer_name'],
                'external_signer_ip'      => $request->ip(),
                'external_signature_data' => $base64,
            ];
            if (!empty($data['field_values'])) {
                $updateData['external_field_values'] = $data['field_values'];
            }
            $document->update($updateData);

            $this->maybeAdvance($document->fresh(['user', 'template.fields']), $data['signer_name']);

            return response()->json(['message' => 'Document signed successfully.']);
        }

        // Client sign
        $updateData = [
            'signed_at'      => now(),
            'signer_name'    => $data['signer_name'],
            'signer_ip'      => $request->ip(),
            'signature_data' => $base64,
            'status'         => 'signed',
        ];

        if (!empty($data['field_values'])) {
            $updateData['field_values'] = $data['field_values'];
        }

        $document->update($updateData);

        $this->maybeAdvance($document->fresh(['user', 'template.fields']), $data['signer_name']);

        return response()->json(['message' => 'Document signed successfully.']);
    }

    /**
     * Called after the client and/or external signer signs. Only proceeds
     * once every primary role actually configured on this document (client,
     * if user_id is set; external, if external_recipient_email is set) has
     * signed — so counter-signing (or immediate certificate generation, if
     * there are no company fields) always reflects the complete document,
     * not a partially-signed one.
     */
    private function maybeAdvance(ClientDocument $document, string $lastSignerName): void
    {
        $needsClient   = $document->user_id !== null;
        $needsExternal = $document->external_recipient_email !== null;
        $clientDone    = !$needsClient || $document->signed_at !== null;
        $externalDone  = !$needsExternal || $document->external_signed_at !== null;

        if (!$clientDone || !$externalDone) {
            return; // still waiting on the other primary signer
        }

        $hasCompanyFields = $document->template?->fields->where('assigned_to', 'company')->isNotEmpty() ?? false;

        if ($hasCompanyFields) {
            // Generate counter-sign token and notify admin
            $countersignToken = Str::random(64);
            $document->update([
                'countersign_token' => ClientDocument::hashToken($countersignToken),
                'status'            => 'awaiting_countersign',
            ]);

            $frontendUrl    = rtrim(env('FRONTEND_URL', 'https://thepupperclub.ca'), '/');
            $countersignUrl = "{$frontendUrl}/sign/{$countersignToken}";

            $admin = \App\Models\User::whereIn('role', ['admin', 'superadmin'])->first();
            if ($admin) {
                $title = "Counter-signature needed — {$document->filename}";
                $body  = "{$lastSignerName} has signed \"{$document->filename}\". Please review and counter-sign.";
                $htmlBody = '<p>' . e($body) . '</p>'
                    . '<div style="text-align:center;margin:28px 0;">'
                    . '<a href="' . $countersignUrl . '" style="'
                    . 'display:inline-block;background:#3B2F2A;color:#F6F3EE;'
                    . 'padding:14px 32px;border-radius:10px;text-decoration:none;'
                    . 'font-weight:600;font-size:15px;"'
                    . '>Counter-Sign Document</a></div>';

                app(NotificationDispatcher::class)->notify($admin, $title, $body, $htmlBody);

                if ($document->user_id) {
                    $conversation = Conversation::firstOrCreate(['user_id' => $document->user_id]);
                    $conversation->messages()->create([
                        'sender_id' => $document->user_id,
                        'type'      => 'text',
                        'body'      => "I've signed the document \"{$document->filename}\". Awaiting your counter-signature.",
                        'metadata'  => ['system' => true, 'document_id' => $document->id],
                    ]);
                    $conversation->increment('unread_count_admin');
                    $conversation->update(['last_message_at' => now()]);
                }
            }
        } else {
            // No company fields — generate certificate immediately
            $document->update(['status' => 'completed']);
            $this->generateCertificate($document);

            $admin = \App\Models\User::whereIn('role', ['admin', 'superadmin'])->first();
            if ($admin) {
                if ($document->user_id) {
                    $conversation = Conversation::firstOrCreate(['user_id' => $document->user_id]);
                    $conversation->messages()->create([
                        'sender_id' => $document->user_id,
                        'type'      => 'text',
                        'body'      => "I've signed the document \"{$document->filename}\".",
                        'metadata'  => ['system' => true, 'document_id' => $document->id],
                    ]);
                    $conversation->increment('unread_count_admin');
                    $conversation->update(['last_message_at' => now()]);
                }

                $signerName = $document->user?->name ?? $document->external_recipient_name ?? $lastSignerName;
                $title = "Document signed — {$document->filename}";
                $body  = "{$signerName} has signed \"{$document->filename}\".";
                app(NotificationDispatcher::class)->notify($admin, $title, $body);
            }
        }
    }

    /**
     * Generate (or regenerate) the signature certificate PDF.
     */
    private function generateCertificate(ClientDocument $document): void
    {
        // Load template fields so the certificate can list every form input
        // alongside the value the signer provided. Keyed by field id (matches
        // the shape of field_values / countersign_field_values).
        $document->loadMissing('template.fields');
        $templateFields = $document->template?->fields ?? collect();

        $clientFields = $templateFields
            ->where('assigned_to', 'client')
            ->map(fn ($f) => [
                'label' => $f->label,
                'type'  => $f->field_type,
                'value' => $this->formatFieldValue($f, ($document->field_values ?? [])[$f->id] ?? null),
            ])
            ->filter(fn ($row) => $row['value'] !== null && $row['value'] !== '')
            ->values();

        $companyFields = $templateFields
            ->where('assigned_to', 'company')
            ->map(fn ($f) => [
                'label' => $f->label,
                'type'  => $f->field_type,
                'value' => $this->formatFieldValue($f, ($document->countersign_field_values ?? [])[$f->id] ?? null),
            ])
            ->filter(fn ($row) => $row['value'] !== null && $row['value'] !== '')
            ->values();

        $externalFields = $templateFields
            ->where('assigned_to', 'external')
            ->map(fn ($f) => [
                'label' => $f->label,
                'type'  => $f->field_type,
                'value' => $this->formatFieldValue($f, ($document->external_field_values ?? [])[$f->id] ?? null),
            ])
            ->filter(fn ($row) => $row['value'] !== null && $row['value'] !== '')
            ->values();

        $viewData = [
            'document'        => $document,
            'client_fields'   => $clientFields,
            'company_fields'  => $companyFields,
            'external_fields' => $externalFields,
        ];

        // Client slot — only populated if a client actually signed. A
        // standalone external-only document never sets these, and the
        // certificate blade guards its "Client Signature" section on
        // $document->user_id being present.
        if ($document->signed_at) {
            $viewData['signer_name']   = $document->signer_name;
            $viewData['signer_ip']     = $document->signer_ip;
            $viewData['signed_at']     = $document->signed_at;
            $viewData['signature_png'] = $document->signature_data;
        }

        if ($document->external_signed_at) {
            $viewData['external_signer_name']   = $document->external_signer_name;
            $viewData['external_signer_ip']     = $document->external_signer_ip;
            $viewData['external_signed_at']     = $document->external_signed_at;
            $viewData['external_signature_png'] = $document->external_signature_data;
        }

        if ($document->countersigned_at) {
            $viewData['countersigner_name'] = $document->countersigner_name;
            $viewData['countersigner_ip']   = $document->countersigner_ip;
            $viewData['countersigned_at']   = $document->countersigned_at;
            $viewData['countersign_png']    = $document->countersign_signature_data;
        }

        $certBinary = Pdf::loadView('pdfs.signature_certificate', $viewData)->output();

        // Try to build the full signed PDF: stamped original + appended cert.
        // If anything goes wrong (no template, encrypted source, FPDI failure)
        // we fall back to saving just the certificate so the download still
        // works and the audit trail is preserved.
        $signedPath = 'private/documents/signed_' . $document->id . '_' . Str::random(8) . '.pdf';

        $certTmp = tempnam(sys_get_temp_dir(), 'tpc_cert_') . '.pdf';
        file_put_contents($certTmp, $certBinary);

        try {
            $merged = app(SignedPdfBuilder::class)->build($document, $certTmp);
            if ($merged !== null) {
                Storage::disk('local')->put($signedPath, $merged);
            } else {
                Storage::disk('local')->put($signedPath, $certBinary);
            }
        } finally {
            @unlink($certTmp);
        }

        // Clean up old signed PDF if one existed
        if ($document->signed_pdf_path && Storage::disk('local')->exists($document->signed_pdf_path)) {
            Storage::disk('local')->delete($document->signed_pdf_path);
        }

        $document->update(['signed_pdf_path' => $signedPath]);
    }

    /**
     * Render a stored field value into a readable string for the certificate.
     */
    private function formatFieldValue($field, $value): ?string
    {
        if ($value === null) return null;

        $type = $field->field_type ?? 'open_text';

        if ($type === 'checkbox') {
            // Common truthy representations in the field-values payload
            $truthy = filter_var($value, FILTER_VALIDATE_BOOLEAN)
                || in_array((string) $value, ['1', 'true', 'on', 'yes', 'checked'], true);
            return $truthy ? 'Checked' : 'Unchecked';
        }

        if ($type === 'date' && is_string($value) && $value !== '') {
            try {
                return \Carbon\Carbon::parse($value)->format('F j, Y');
            } catch (\Throwable $e) {
                return $value;
            }
        }

        if ($type === 'signature' || $type === 'initial') {
            // The signature image is rendered separately; mark presence here
            return is_string($value) && $value !== '' ? '— Provided —' : null;
        }

        if (is_array($value)) {
            return implode(', ', array_map(fn ($v) => (string) $v, $value));
        }

        $str = trim((string) $value);
        return $str === '' ? null : $str;
    }

    /**
     * Admin: download the signature certificate PDF.
     * GET /admin/clients/{client}/documents/{document}/certificate
     */
    public function certificate(int $clientId, ClientDocument $document): StreamedResponse
    {
        abort_unless((int) $document->user_id === $clientId, 404);
        abort_unless($document->signed_pdf_path, 404, 'No certificate available yet.');

        // Documents signed before the stamping pipeline shipped have a
        // cert-only PDF stored under a `cert_` filename. Detect that and
        // regenerate so the download includes the stamped original pages.
        $needsRegen = str_starts_with((string) $document->signed_pdf_path, 'private/documents/cert_')
            || !Storage::disk('local')->exists($document->signed_pdf_path);

        if ($needsRegen) {
            $this->generateCertificate($document);
            $document->refresh();
        }

        abort_unless(Storage::disk('local')->exists($document->signed_pdf_path), 404);

        $certName = 'signed_' . $document->filename;

        return Storage::disk('local')->download(
            $document->signed_pdf_path,
            $certName,
            ['Content-Type' => 'application/pdf']
        );
    }

    /**
     * Admin: download the signature certificate PDF for any document,
     * client-assigned or standalone external. Unlike certificate() above
     * (kept for backward compatibility), this isn't scoped by client ID.
     * GET /admin/documents/{document}/certificate
     */
    public function certificateByDocument(ClientDocument $document): StreamedResponse
    {
        abort_unless($document->signed_pdf_path, 404, 'No certificate available yet.');

        $needsRegen = str_starts_with((string) $document->signed_pdf_path, 'private/documents/cert_')
            || !Storage::disk('local')->exists($document->signed_pdf_path);

        if ($needsRegen) {
            $this->generateCertificate($document);
            $document->refresh();
        }

        abort_unless(Storage::disk('local')->exists($document->signed_pdf_path), 404);

        return Storage::disk('local')->download(
            $document->signed_pdf_path,
            'signed_' . $document->filename,
            ['Content-Type' => 'application/pdf']
        );
    }
}

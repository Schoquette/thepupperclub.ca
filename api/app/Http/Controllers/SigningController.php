<?php

namespace App\Http\Controllers;

use App\Models\ClientDocument;
use App\Models\Conversation;
use App\Services\NotificationDispatcher;
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
            'signature_token'        => $token,
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
     * Public: return document metadata for the signing page.
     * GET /signing/{token}
     */
    public function show(string $token): JsonResponse
    {
        // Check if it's a countersign token
        $document = ClientDocument::where('countersign_token', $token)
            ->with('template.fields')
            ->first();

        $isCountersign = false;
        if ($document) {
            $isCountersign = true;
            abort_if($document->countersigned_at, 410, 'This document has already been counter-signed.');
        } else {
            $document = ClientDocument::where('signature_token', $token)
                ->with('template.fields')
                ->firstOrFail();
            abort_if($document->signed_at, 410, 'This document has already been signed.');
        }

        // Track first view and notify admin (client signing only)
        if (!$isCountersign && !$document->first_viewed_at) {
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
        $targetRole = $isCountersign ? 'company' : 'client';

        if ($document->template) {
            foreach ($document->template->fields as $field) {
                // Only show fields assigned to the current signer
                $fieldRole = $field->assigned_to ?? 'client';
                if ($fieldRole !== $targetRole) continue;

                $values = $isCountersign
                    ? ($document->countersign_field_values ?? [])
                    : ($document->field_values ?? []);

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
                'id'             => $document->id,
                'filename'       => $document->filename,
                'client'         => $document->user?->name,
                'requested'      => $document->signature_requested_at,
                'signed'         => $document->signed_at,
                'is_countersign' => $isCountersign,
                'signer_role'    => $targetRole,
                'has_fields'     => count($fields) > 0,
                'fields'         => $fields,
                'field_values'   => $isCountersign
                    ? ($document->countersign_field_values ?? [])
                    : ($document->field_values ?? []),
            ],
        ]);
    }

    /**
     * Public: serve the PDF for display on the signing page.
     * GET /signing/{token}/document
     */
    public function serveDocument(string $token): StreamedResponse
    {
        // Support both client and countersign tokens
        $document = ClientDocument::where('signature_token', $token)->first()
            ?? ClientDocument::where('countersign_token', $token)->firstOrFail();

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
        // Check countersign first
        $document = ClientDocument::where('countersign_token', $token)
            ->with(['user', 'template.fields'])
            ->first();

        $isCountersign = false;
        if ($document) {
            $isCountersign = true;
            abort_if($document->countersigned_at, 410, 'This document has already been counter-signed.');
        } else {
            $document = ClientDocument::where('signature_token', $token)
                ->with(['user', 'template.fields'])
                ->firstOrFail();
            abort_if($document->signed_at, 410, 'This document has already been signed.');
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

        if ($isCountersign) {
            // Counter-sign by admin/company
            $document->update([
                'countersigned_at'          => now(),
                'countersigner_name'        => $data['signer_name'],
                'countersigner_ip'          => $request->ip(),
                'countersign_signature_data' => $base64,
                'countersign_field_values'  => $data['field_values'] ?? null,
                'status'                    => 'completed',
            ]);

            // Re-generate certificate with both signatures
            $this->generateCertificate($document->fresh('user'));

            return response()->json(['message' => 'Document counter-signed successfully.']);
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

        // Check if template has company fields that need counter-signing
        $hasCompanyFields = false;
        if ($document->template) {
            $hasCompanyFields = $document->template->fields
                ->where('assigned_to', 'company')
                ->isNotEmpty();
        }

        if ($hasCompanyFields) {
            // Generate counter-sign token and notify admin
            $countersignToken = Str::random(64);
            $document->update([
                'countersign_token' => $countersignToken,
                'status'            => 'awaiting_countersign',
            ]);

            $frontendUrl    = rtrim(env('FRONTEND_URL', 'https://thepupperclub.ca'), '/');
            $countersignUrl = "{$frontendUrl}/sign/{$countersignToken}";

            // Notify admin
            $admin = \App\Models\User::whereIn('role', ['admin', 'superadmin'])->first();
            if ($admin) {
                $title = "Counter-signature needed — {$document->filename}";
                $body  = "{$data['signer_name']} has signed \"{$document->filename}\". Please review and counter-sign.";
                $htmlBody = '<p>' . e($body) . '</p>'
                    . '<div style="text-align:center;margin:28px 0;">'
                    . '<a href="' . $countersignUrl . '" style="'
                    . 'display:inline-block;background:#3B2F2A;color:#F6F3EE;'
                    . 'padding:14px 32px;border-radius:10px;text-decoration:none;'
                    . 'font-weight:600;font-size:15px;"'
                    . '>Counter-Sign Document</a></div>';

                app(NotificationDispatcher::class)->notify($admin, $title, $body, $htmlBody);

                // Also add to conversation
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
        } else {
            // No company fields — generate certificate immediately
            $this->generateCertificate($document->fresh('user'));

            // Notify admin via conversation + push/email
            $admin = \App\Models\User::whereIn('role', ['admin', 'superadmin'])->first();
            if ($admin) {
                $conversation = Conversation::firstOrCreate(['user_id' => $document->user_id]);
                $conversation->messages()->create([
                    'sender_id' => $document->user_id,
                    'type'      => 'text',
                    'body'      => "I've signed the document \"{$document->filename}\".",
                    'metadata'  => ['system' => true, 'document_id' => $document->id],
                ]);
                $conversation->increment('unread_count_admin');
                $conversation->update(['last_message_at' => now()]);

                $clientName = $document->user?->name ?? $data['signer_name'];
                $title = "Document signed — {$document->filename}";
                $body  = "{$clientName} has signed \"{$document->filename}\".";
                app(NotificationDispatcher::class)->notify($admin, $title, $body);
            }
        }

        return response()->json(['message' => 'Document signed successfully.']);
    }

    /**
     * Generate (or regenerate) the signature certificate PDF.
     */
    private function generateCertificate(ClientDocument $document): void
    {
        $viewData = [
            'document'      => $document,
            'signer_name'   => $document->signer_name,
            'signer_ip'     => $document->signer_ip,
            'signed_at'     => $document->signed_at,
            'signature_png' => $document->signature_data,
        ];

        if ($document->countersigned_at) {
            $viewData['countersigner_name'] = $document->countersigner_name;
            $viewData['countersigner_ip']   = $document->countersigner_ip;
            $viewData['countersigned_at']   = $document->countersigned_at;
            $viewData['countersign_png']    = $document->countersign_signature_data;
        }

        $pdf = Pdf::loadView('pdfs.signature_certificate', $viewData);

        $certPath = 'private/documents/cert_' . $document->id . '_' . Str::random(8) . '.pdf';
        Storage::disk('local')->put($certPath, $pdf->output());

        // Clean up old cert if exists
        if ($document->signed_pdf_path && Storage::disk('local')->exists($document->signed_pdf_path)) {
            Storage::disk('local')->delete($document->signed_pdf_path);
        }

        $document->update(['signed_pdf_path' => $certPath]);
    }

    /**
     * Admin: download the signature certificate PDF.
     * GET /admin/clients/{client}/documents/{document}/certificate
     */
    public function certificate(int $clientId, ClientDocument $document): StreamedResponse
    {
        abort_unless((int) $document->user_id === $clientId, 404);
        abort_unless($document->signed_pdf_path, 404, 'No certificate available yet.');
        abort_unless(Storage::disk('local')->exists($document->signed_pdf_path), 404);

        $certName = 'signed_' . $document->filename;

        return Storage::disk('local')->download(
            $document->signed_pdf_path,
            $certName,
            ['Content-Type' => 'application/pdf']
        );
    }
}

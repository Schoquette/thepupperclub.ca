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

        $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:5174'), '/');
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

            $htmlBody = $customHtml ?? view('emails.signature_request', [
                'userName'     => $client->name,
                'documentName' => $document->filename,
                'signingUrl'   => $signingUrl,
            ])->render();

            app(NotificationDispatcher::class)->notify($client, $title, $body, $htmlBody);
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
        $document = ClientDocument::where('signature_token', $token)
            ->with('template.fields')
            ->firstOrFail();

        abort_if($document->signed_at, 410, 'This document has already been signed.');

        $fields = [];
        if ($document->template) {
            foreach ($document->template->fields as $field) {
                $fields[] = [
                    'id'            => $field->id,
                    'label'         => $field->label,
                    'field_type'    => $field->field_type,
                    'page'          => $field->page,
                    'x'             => $field->x,
                    'y'             => $field->y,
                    'width'         => $field->width,
                    'height'        => $field->height,
                    'required'      => $field->required,
                    'sort_order'    => $field->sort_order,
                    'default_value' => $field->default_value,
                    'value'         => $document->field_values[$field->id] ?? '',
                ];
            }
        }

        return response()->json([
            'data' => [
                'id'           => $document->id,
                'filename'     => $document->filename,
                'client'       => $document->user?->name,
                'requested'    => $document->signature_requested_at,
                'signed'       => $document->signed_at,
                'has_fields'   => count($fields) > 0,
                'fields'       => $fields,
                'field_values' => $document->field_values ?? [],
            ],
        ]);
    }

    /**
     * Public: serve the PDF for display on the signing page.
     * GET /signing/{token}/document
     */
    public function serveDocument(string $token): StreamedResponse
    {
        $document = ClientDocument::where('signature_token', $token)->firstOrFail();

        abort_if($document->signed_at, 410, 'Document already signed.');
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
        $document = ClientDocument::where('signature_token', $token)
            ->with('user')
            ->firstOrFail();

        abort_if($document->signed_at, 410, 'This document has already been signed.');

        $data = $request->validate([
            'signer_name'    => 'required|string|max:255',
            'signature_data' => 'required|string',   // base64 PNG data URL
            'field_values'   => 'nullable|array',     // field_id => value
        ]);

        // Strip the data: prefix to get raw base64
        $base64 = $data['signature_data'];
        if (str_contains($base64, ',')) {
            $base64 = explode(',', $base64, 2)[1];
        }

        $updateData = [
            'signed_at'      => now(),
            'signer_name'    => $data['signer_name'],
            'signer_ip'      => $request->ip(),
            'signature_data' => $base64,
            'status'         => 'signed',
        ];

        // Store field values if provided
        if (!empty($data['field_values'])) {
            $updateData['field_values'] = $data['field_values'];
        }

        $document->update($updateData);

        // Generate certificate PDF
        $pdf  = Pdf::loadView('pdfs.signature_certificate', [
            'document'      => $document->fresh('user'),
            'signer_name'   => $data['signer_name'],
            'signer_ip'     => $request->ip(),
            'signed_at'     => now(),
            'signature_png' => $base64,
        ]);

        $certPath = 'private/documents/cert_' . $document->id . '_' . Str::random(8) . '.pdf';
        Storage::disk('local')->put($certPath, $pdf->output());

        $document->update(['signed_pdf_path' => $certPath]);

        // Notify admin via conversation
        $admin = \App\Models\User::where('role', 'admin')->first();
        if ($admin) {
            $conversation = Conversation::firstOrCreate(['user_id' => $document->user_id]);
            $conversation->messages()->create([
                'sender_id' => $document->user_id,
                'type'      => 'text',
                'body'      => "I've signed the document \"{$document->filename}\".",
                'metadata'  => ['system' => true, 'document_id' => $document->id],
            ]);
        }

        return response()->json(['message' => 'Document signed successfully.']);
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

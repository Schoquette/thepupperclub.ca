<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientDocument;
use App\Models\Conversation;
use App\Models\DocumentTemplate;
use App\Models\DocumentTemplateField;
use App\Services\NotificationDispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentTemplateController extends Controller
{
    // ── Template CRUD ────────────────────────────────────────────────────────

    public function index(): JsonResponse
    {
        $templates = DocumentTemplate::withCount('fields', 'documents')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $templates]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'pdf' => 'required|file|mimes:pdf,doc,docx,jpg,jpeg,png,heic|max:20480',
        ]);

        $file = $request->file('pdf');
        $path = $file->store('private/templates', 'local');

        // Count PDF pages (basic method — count /Page occurrences)
        $pageCount = 1;
        try {
            $content = file_get_contents(Storage::disk('local')->path($path));
            $pageCount = max(1, preg_match_all('/\/Type\s*\/Page[^s]/', $content));
        } catch (\Throwable $e) {
            // Default to 1 if we can't count
        }

        $template = DocumentTemplate::create([
            'name'             => $request->name,
            'description'      => $request->description,
            'pdf_storage_path' => $path,
            'pdf_filename'     => $file->getClientOriginalName(),
            'page_count'       => $pageCount,
            'created_by'       => $request->user()->id,
        ]);

        return response()->json(['data' => $template->load('fields')], 201);
    }

    public function show(DocumentTemplate $template): JsonResponse
    {
        return response()->json([
            'data' => $template->load('fields'),
        ]);
    }

    public function update(Request $request, DocumentTemplate $template): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        $template->update($data);

        return response()->json(['data' => $template->load('fields')]);
    }

    public function destroy(DocumentTemplate $template): JsonResponse
    {
        // Delete PDF file
        if (Storage::disk('local')->exists($template->pdf_storage_path)) {
            Storage::disk('local')->delete($template->pdf_storage_path);
        }

        $template->delete();

        return response()->json(['message' => 'Template deleted.']);
    }

    public function servePdf(DocumentTemplate $template): StreamedResponse
    {
        abort_unless(Storage::disk('local')->exists($template->pdf_storage_path), 404);

        return Storage::disk('local')->response(
            $template->pdf_storage_path,
            $template->pdf_filename,
            ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'inline']
        );
    }

    // ── Fields ───────────────────────────────────────────────────────────────

    public function saveFields(Request $request, DocumentTemplate $template): JsonResponse
    {
        $data = $request->validate([
            'fields'                => 'present|array',
            'fields.*.label'        => 'required|string|max:255',
            'fields.*.field_type'   => 'required|string|in:name,checkbox,date,signature,dog_name,open_text',
            'fields.*.assigned_to'  => 'sometimes|string|in:client,company',
            'fields.*.page'         => 'required|integer|min:1',
            'fields.*.x'            => 'required|numeric|min:0|max:100',
            'fields.*.y'            => 'required|numeric|min:0|max:100',
            'fields.*.width'        => 'required|numeric|min:1|max:100',
            'fields.*.height'       => 'required|numeric|min:1|max:100',
            'fields.*.required'     => 'boolean',
            'fields.*.sort_order'   => 'integer|min:0',
            'fields.*.default_value'=> 'nullable|string|max:255',
        ]);

        DB::transaction(function () use ($template, $data) {
            $template->fields()->delete();

            foreach ($data['fields'] as $i => $field) {
                $template->fields()->create([
                    ...$field,
                    'sort_order' => $field['sort_order'] ?? $i,
                ]);
            }
        });

        return response()->json([
            'data'    => $template->load('fields'),
            'message' => 'Fields saved.',
        ]);
    }

    // ── Use Template (create client document from template) ──────────────────

    public function useTemplate(Request $request, DocumentTemplate $template): JsonResponse
    {
        $data = $request->validate([
            'client_id' => 'required|exists:users,id',
        ]);

        $template->load('fields');

        // Copy the PDF file
        $newPath = 'private/documents/' . Str::random(8) . '_' . $template->pdf_filename;
        Storage::disk('local')->copy($template->pdf_storage_path, $newPath);

        // Pre-fill field values from client data
        $client = \App\Models\User::with('dogs')->find($data['client_id']);
        $fieldValues = [];
        foreach ($template->fields as $field) {
            $value = $field->default_value ?? '';
            if ($field->field_type === 'name' && $client) {
                $value = $client->name;
            } elseif ($field->field_type === 'dog_name' && $client) {
                $value = $client->dogs->first()?->name ?? '';
            } elseif ($field->field_type === 'date') {
                $value = now()->format('Y-m-d');
            }
            $fieldValues[$field->id] = $value;
        }

        $document = ClientDocument::create([
            'user_id'      => $data['client_id'],
            'type'         => 'document',
            'filename'     => $template->pdf_filename,
            'mime_type'    => 'application/pdf',
            'size_bytes'   => Storage::disk('local')->size($newPath),
            'storage_path' => $newPath,
            'uploaded_by'  => $request->user()->id,
            'template_id'  => $template->id,
            'status'       => 'draft',
            'field_values' => $fieldValues,
        ]);

        return response()->json([
            'data'    => $document->load('template.fields'),
            'message' => 'Document created from template.',
        ]);
    }

    // ── Admin document management ────────────────────────────────────────────

    public function adminIndex(Request $request): JsonResponse
    {
        $query = ClientDocument::with(['user', 'template.fields'])
            ->orderBy('created_at', 'desc');

        if ($request->status) {
            if ($request->status === 'signed') {
                $query->whereNotNull('signed_at');
            } elseif ($request->status === 'sent') {
                $query->whereNotNull('sent_at')->whereNull('signed_at');
            } elseif ($request->status === 'draft') {
                $query->where('status', 'draft');
            }
        }

        if ($request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('filename', 'like', "%{$search}%")
                  ->orWhereHas('user', fn($q2) => $q2->where('name', 'like', "%{$search}%"));
            });
        }

        $documents = $query->paginate(50);

        return response()->json($documents);
    }

    public function updateFieldValues(Request $request, ClientDocument $document): JsonResponse
    {
        $data = $request->validate([
            'field_values' => 'required|array',
        ]);

        $document->update(['field_values' => $data['field_values']]);

        return response()->json([
            'data'    => $document->load('template.fields'),
            'message' => 'Field values updated.',
        ]);
    }

    public function sendForSigning(Request $request, ClientDocument $document): JsonResponse
    {
        abort_unless($document->user_id, 422, 'Document must be assigned to a client.');
        abort_if($document->signed_at, 422, 'Document is already signed.');

        // Require fields to be defined before sending template-based documents
        if ($document->template_id) {
            $fieldCount = $document->template?->fields()->count() ?? 0;
            abort_if($fieldCount === 0, 422, 'Please define signing fields on this template before sending. Go to Templates > Edit to add fields.');
        }

        $token = Str::random(64);

        $document->update([
            'status'                => 'sent',
            'sent_at'               => now(),
            'signature_requested_at'=> now(),
            'signature_token'       => $token,
        ]);

        $frontendUrl = rtrim(env('FRONTEND_URL', 'https://thepupperclub.ca'), '/');
        $signingUrl  = "{$frontendUrl}/sign/{$token}";

        // Send notification to client
        $client = $document->user;
        if ($client) {
            // Add message to conversation
            $admin        = $request->user();
            $conversation = Conversation::firstOrCreate(['user_id' => $client->id]);
            $conversation->messages()->create([
                'sender_id' => $admin->id,
                'type'      => 'text',
                'body'      => "Please review and sign the document **{$document->filename}**:\n\n{$signingUrl}",
                'metadata'  => ['signing_url' => $signingUrl, 'document_id' => $document->id],
            ]);

            // Send email
            $title = "Document for Signature — The Pupper Club";
            $body  = "Please review and sign \"{$document->filename}\".";
            $htmlBody = view('emails.signature_request', [
                'userName'     => $client->name,
                'documentName' => $document->filename,
                'signingUrl'   => $signingUrl,
            ])->render();

            app(NotificationDispatcher::class)->notify($client, $title, $body, $htmlBody);
        }

        return response()->json([
            'signing_url' => $signingUrl,
            'token'       => $token,
            'message'     => 'Document sent for signing.',
        ]);
    }
}

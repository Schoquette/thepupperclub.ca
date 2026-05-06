<?php

namespace App\Http\Controllers;

use App\Models\ClientDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function serve(Request $request, ClientDocument $document): StreamedResponse
    {
        $user = $request->user();

        if (!$user) {
            abort(401, 'Not authenticated');
        }

        // Admin can access any document; client can only access their own
        if ($user->role !== 'admin' && $document->user_id !== $user->id) {
            abort(403, "Access denied. Role: {$user->role}, doc owner: {$document->user_id}, you: {$user->id}");
        }

        if (!Storage::disk('local')->exists($document->storage_path)) {
            abort(404, "File not found at: {$document->storage_path}");
        }

        if ($request->boolean('inline')) {
            return Storage::disk('local')->response(
                $document->storage_path,
                $document->filename,
                ['Content-Type' => $document->mime_type, 'Content-Disposition' => 'inline']
            );
        }

        return Storage::disk('local')->download(
            $document->storage_path,
            $document->filename,
            ['Content-Type' => $document->mime_type]
        );
    }
}

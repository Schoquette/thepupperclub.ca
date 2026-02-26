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

        // Admin can access any document; client can only access their own
        if ($user->role !== 'admin' && $document->user_id !== $user->id) {
            abort(403);
        }

        abort_unless(Storage::disk('local')->exists($document->storage_path), 404);

        return Storage::disk('local')->download(
            $document->storage_path,
            $document->filename,
            ['Content-Type' => $document->mime_type]
        );
    }
}

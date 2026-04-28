<?php

namespace App\Console\Commands;

use App\Models\Document;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class RegenerateIntakePdfs extends Command
{
    protected $signature = 'intake:regenerate-pdfs';
    protected $description = 'Regenerate intake form PDFs for all clients who have submitted their intake';

    public function handle(): int
    {
        $clients = User::where('role', 'client')
            ->whereHas('clientProfile', fn($q) => $q->whereNotNull('intake_submitted_at'))
            ->with(['clientProfile', 'dogs', 'homeAccess'])
            ->get();

        if ($clients->isEmpty()) {
            $this->info('No submitted intake forms found.');
            return 0;
        }

        $this->info("Regenerating PDFs for {$clients->count()} client(s)...");

        $success = 0;
        foreach ($clients as $client) {
            try {
                $submittedAt = $client->clientProfile->intake_submitted_at
                    ->setTimezone('America/Vancouver')
                    ->format('F j, Y g:i A');

                $pdf = Pdf::loadView('pdfs.intake_form', [
                    'client'      => $client,
                    'profile'     => $client->clientProfile,
                    'dogs'        => $client->dogs,
                    'homeAccess'  => $client->homeAccess,
                    'submittedAt' => $submittedAt,
                ]);

                $pdfContent  = $pdf->output();
                $filename    = "intake_{$client->id}_" . now()->format('Ymd') . '.pdf';
                $storagePath = "private/documents/{$filename}";
                Storage::disk('local')->put($storagePath, $pdfContent);

                // Delete old intake PDF documents and replace
                $client->documents()->where('type', 'intake_form')->delete();

                $client->documents()->create([
                    'type'         => 'intake_form',
                    'filename'     => 'Client Intake Form.pdf',
                    'mime_type'    => 'application/pdf',
                    'size_bytes'   => strlen($pdfContent),
                    'storage_path' => $storagePath,
                    'uploaded_by'  => 'admin',
                ]);

                $success++;
                $this->line("  ✓ {$client->name}");
            } catch (\Throwable $e) {
                $this->error("  ✗ {$client->name}: {$e->getMessage()}");
            }
        }

        $this->info("Done. {$success}/{$clients->count()} PDFs regenerated.");
        return 0;
    }
}

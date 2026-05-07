<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use ZipArchive;

class BackupController extends Controller
{
    public function download(Request $request)
    {
        $tables = [
            'users',
            'dogs',
            'client_profiles',
            'appointments',
            'invoices',
            'invoice_line_items',
            'service_requests',
            'conversations',
            'messages',
            'visit_reports',
            'client_documents',
            'vaccination_records',
        ];

        $date = now()->format('Y-m-d');
        $zipName = "thepupperclub-backup-{$date}.zip";
        $zipPath = storage_path("app/{$zipName}");

        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return response()->json(['message' => 'Could not create backup archive.'], 500);
        }

        foreach ($tables as $table) {
            try {
                $rows = DB::table($table)->get();
            } catch (\Exception $e) {
                // Skip tables that don't exist
                continue;
            }

            if ($rows->isEmpty()) {
                // Add an empty CSV with just headers from schema
                try {
                    $columns = DB::getSchemaBuilder()->getColumnListing($table);
                    $csv = implode(',', $columns) . "\n";
                } catch (\Exception $e) {
                    $csv = '';
                }
                $zip->addFromString("{$table}.csv", $csv);
                continue;
            }

            $columns = array_keys((array) $rows->first());
            $handle = fopen('php://temp', 'r+');
            fputcsv($handle, $columns);

            foreach ($rows as $row) {
                fputcsv($handle, array_values((array) $row));
            }

            rewind($handle);
            $csv = stream_get_contents($handle);
            fclose($handle);

            $zip->addFromString("{$table}.csv", $csv);
        }

        $zip->close();

        return response()->download($zipPath, $zipName, [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend(true);
    }
}

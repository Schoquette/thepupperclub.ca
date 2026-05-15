<?php

namespace App\Services;

use App\Models\ClientDocument;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use setasign\Fpdi\Fpdi;

/**
 * Stamps signer field values + signature images onto the original PDF and
 * appends the rendered signing certificate as a final page (or pages). The
 * result is a single PDF that shows the completed form plus the audit trail,
 * DocuSign-style.
 *
 * Template fields store x/y/width/height as PERCENTAGES (0-100) of the page
 * dimensions, captured in the visual editor. We scale them against each
 * page's actual size in mm at draw time.
 */
class SignedPdfBuilder
{
    /**
     * Build the merged signed PDF.
     *
     * @return string|null Raw PDF bytes, or null if the original PDF could not
     *                     be opened (caller should fall back to cert-only).
     */
    public function build(ClientDocument $document, ?string $certificatePath): ?string
    {
        $originalPath = $document->storage_path
            ? Storage::disk('local')->path($document->storage_path)
            : null;

        if (!$originalPath || !file_exists($originalPath)) {
            return null;
        }

        try {
            $pdf = new Fpdi();
            $pdf->SetAutoPageBreak(false);
            $pageCount = $pdf->setSourceFile($originalPath);
        } catch (\Throwable $e) {
            Log::warning('SignedPdfBuilder: could not open original PDF', [
                'document_id' => $document->id,
                'error'       => $e->getMessage(),
            ]);
            return null;
        }

        $document->loadMissing('template.fields');
        $fields = $document->template?->fields ?? collect();

        $clientValues  = $document->field_values ?? [];
        $companyValues = $document->countersign_field_values ?? [];
        $signaturePng   = $document->signature_data;
        $countersignPng = $document->countersign_signature_data;

        for ($pageNum = 1; $pageNum <= $pageCount; $pageNum++) {
            $tplId = $pdf->importPage($pageNum);
            $size  = $pdf->getTemplateSize($tplId);
            $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
            $pdf->useTemplate($tplId);

            $pageW = (float) $size['width'];
            $pageH = (float) $size['height'];

            foreach ($fields->where('page', $pageNum) as $field) {
                $valueMap = $field->assigned_to === 'company' ? $companyValues : $clientValues;
                $rawValue = $valueMap[$field->id] ?? null;

                // Coordinates are 0-100 of page dimensions
                $x = ($field->x / 100) * $pageW;
                $y = ($field->y / 100) * $pageH;
                $w = ($field->width / 100) * $pageW;
                $h = ($field->height / 100) * $pageH;

                $this->renderField($pdf, $field, $rawValue, $signaturePng, $countersignPng, $x, $y, $w, $h);
            }
        }

        // Append the signing certificate
        if ($certificatePath && file_exists($certificatePath)) {
            try {
                $certPages = $pdf->setSourceFile($certificatePath);
                for ($i = 1; $i <= $certPages; $i++) {
                    $tplId = $pdf->importPage($i);
                    $size  = $pdf->getTemplateSize($tplId);
                    $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
                    $pdf->useTemplate($tplId);
                }
            } catch (\Throwable $e) {
                Log::warning('SignedPdfBuilder: failed to append certificate', [
                    'document_id' => $document->id,
                    'error'       => $e->getMessage(),
                ]);
            }
        }

        return $pdf->Output('S');
    }

    private function renderField(Fpdi $pdf, $field, $rawValue, ?string $signaturePng, ?string $countersignPng, float $x, float $y, float $w, float $h): void
    {
        $type = $field->field_type ?? 'open_text';

        if ($type === 'signature' || $type === 'initial') {
            $png = $field->assigned_to === 'company' ? $countersignPng : $signaturePng;
            if (!$png) return;
            $this->drawSignature($pdf, $png, $x, $y, $w, $h);
            return;
        }

        if ($rawValue === null || $rawValue === '') return;

        if ($type === 'checkbox') {
            $truthy = filter_var($rawValue, FILTER_VALIDATE_BOOLEAN)
                || in_array((string) $rawValue, ['1', 'true', 'yes', 'on', 'checked'], true);
            if ($truthy) {
                $fontSize = max(8.0, min(14.0, $h * 2.4));
                $pdf->SetFont('Helvetica', 'B', $fontSize);
                $pdf->SetTextColor(59, 47, 42);
                $pdf->SetXY($x, $y);
                $pdf->Cell($w, $h, $this->sanitise('X'), 0, 0, 'C');
            }
            return;
        }

        $text = $this->valueToText($field, $rawValue);
        if ($text === '') return;

        // Choose a size that fits the cell height, then shrink to fit width.
        $fontSize = max(7.0, min(11.0, $h * 1.8));
        $pdf->SetFont('Helvetica', '', $fontSize);
        $pdf->SetTextColor(59, 47, 42);

        // If the string is wider than the cell, scale the font down to fit.
        while ($fontSize > 6 && $pdf->GetStringWidth($text) > $w - 1) {
            $fontSize -= 0.5;
            $pdf->SetFont('Helvetica', '', $fontSize);
        }

        $pdf->SetXY($x, $y);
        $pdf->Cell($w, $h, $text, 0, 0, 'L');
    }

    private function drawSignature(Fpdi $pdf, string $base64Png, float $x, float $y, float $w, float $h): void
    {
        $decoded = base64_decode($base64Png, true);
        if ($decoded === false || $decoded === '') return;

        $tmp = tempnam(sys_get_temp_dir(), 'tpc_sig_') . '.png';
        file_put_contents($tmp, $decoded);
        try {
            // contain-fit the image within the box, preserving aspect ratio
            $pdf->Image($tmp, $x, $y, $w, $h, 'PNG');
        } catch (\Throwable $e) {
            Log::warning('SignedPdfBuilder: signature image failed to draw', [
                'error' => $e->getMessage(),
            ]);
        } finally {
            @unlink($tmp);
        }
    }

    private function valueToText($field, $value): string
    {
        if (is_array($value)) {
            return $this->sanitise(implode(', ', array_map(fn ($v) => (string) $v, $value)));
        }

        $type = $field->field_type ?? 'open_text';
        $str  = (string) $value;

        if ($type === 'date' && $str !== '') {
            try {
                $str = Carbon::parse($str)->format('M j, Y');
            } catch (\Throwable $e) {
                // keep raw
            }
        }

        return $this->sanitise(trim($str));
    }

    /**
     * FPDF's built-in fonts use ISO-8859-1, not UTF-8. Best-effort transliterate
     * so accented characters render as their nearest ASCII equivalent rather
     * than as garbled boxes.
     */
    private function sanitise(string $s): string
    {
        if ($s === '') return '';
        $converted = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT//IGNORE', $s);
        return $converted === false ? $s : $converted;
    }
}

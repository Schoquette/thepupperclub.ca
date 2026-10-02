<?php

namespace App\Services;

use App\Models\ErrorLog;
use Illuminate\Support\Facades\Log;

class ReceiptExtractionService
{
    private const MODEL = 'claude-sonnet-5';

    /**
     * Returns the extracted fields, or null if extraction wasn't possible
     * (no API key configured, request failure, or unparseable response).
     * Never throws -- callers should treat null as "fall back to manual entry".
     *
     * $categories is the business's current category list -- passed in (not
     * hardcoded) since categories are user-managed, not a fixed constant.
     */
    public function extract(string $imageBytes, string $mimeType, array $categories = []): ?array
    {
        $apiKey = config('services.anthropic.api_key');
        if (!$apiKey) {
            Log::info('ReceiptExtractionService: ANTHROPIC_API_KEY not configured, skipping extraction.');
            return null;
        }

        $categoryList = implode(', ', $categories) ?: 'Other';
        $prompt = "This is a photo of a business expense receipt. Extract the vendor name, transaction date (YYYY-MM-DD), a short item/description of what was purchased, the subtotal before tax, the GST amount, the PST amount, any tip/gratuity amount, and the total, using BC Canadian sales tax conventions (GST and PST are usually printed separately on the receipt). Also pick the single best-fitting category for this expense from exactly this list: {$categoryList}. Respond with ONLY a JSON object with exactly these keys: vendor, date, item, subtotal, gst, pst, tip, total, category. Use null for any field that is illegible or absent (except category, which must always be one of the given options, and tip, which should be 0 if there's no tip line on the receipt). Do not include any other text, explanation, or markdown code fences.";

        try {
            $client = new \GuzzleHttp\Client(['timeout' => 30]);
            $response = $client->post('https://api.anthropic.com/v1/messages', [
                'headers' => [
                    'x-api-key'         => $apiKey,
                    'anthropic-version' => '2023-06-01',
                    'content-type'      => 'application/json',
                ],
                'json' => [
                    'model'      => self::MODEL,
                    'max_tokens' => 1024,
                    'messages'   => [[
                        'role'    => 'user',
                        'content' => [
                            [
                                'type'   => 'image',
                                'source' => [
                                    'type'       => 'base64',
                                    'media_type' => $mimeType,
                                    'data'       => base64_encode($imageBytes),
                                ],
                            ],
                            [
                                'type' => 'text',
                                'text' => $prompt,
                            ],
                        ],
                    ]],
                ],
            ]);

            $data = json_decode((string) $response->getBody(), true);
            $text = $data['content'][0]['text'] ?? null;

            if (!$text) {
                Log::warning('ReceiptExtractionService: unexpected Anthropic response shape', ['data' => $data]);
                return null;
            }

            $parsed = $this->parseJsonResponse($text);
            if (!$parsed) {
                Log::warning('ReceiptExtractionService: could not parse JSON from response', ['text' => $text]);
                $this->logError('Could not parse JSON from Anthropic response', ['text' => $text]);
                return null;
            }

            $category = $parsed['category'] ?? null;
            if (!$category || !in_array($category, $categories, true)) {
                $category = null;
            }

            return [
                'vendor'   => $parsed['vendor'] ?? null,
                'date'     => $parsed['date'] ?? null,
                'item'     => $parsed['item'] ?? null,
                'subtotal' => $parsed['subtotal'] ?? null,
                'gst'      => $parsed['gst'] ?? null,
                'pst'      => $parsed['pst'] ?? null,
                'tip'      => $parsed['tip'] ?? null,
                'total'    => $parsed['total'] ?? null,
                'category' => $category,
            ];
        } catch (\Throwable $e) {
            Log::warning('ReceiptExtractionService: extraction failed', ['error' => $e->getMessage()]);
            $this->logError($e->getMessage());
            return null;
        }
    }

    private function parseJsonResponse(string $text): ?array
    {
        // Strip markdown code fences if present
        $text = preg_replace('/^```(?:json)?\s*|\s*```$/m', '', trim($text));

        $data = json_decode($text, true);
        if (is_array($data)) {
            return $data;
        }

        // Fall back to extracting the first {...} block from surrounding prose
        if (preg_match('/\{.*\}/s', $text, $matches)) {
            $data = json_decode($matches[0], true);
            if (is_array($data)) {
                return $data;
            }
        }

        return null;
    }

    private function logError(string $message, array $context = []): void
    {
        try {
            ErrorLog::create([
                'type'       => 'ReceiptExtractionFailed',
                'message'    => $message,
                'context'    => $context,
                'created_at' => now(),
            ]);
        } catch (\Throwable $logError) {}
    }
}

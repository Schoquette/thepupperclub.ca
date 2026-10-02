<?php

namespace App\Services;

use App\Models\ErrorLog;
use Illuminate\Support\Facades\Log;

class ExpenseCategorizerService
{
    private const MODEL = 'claude-sonnet-5';

    /**
     * Given a list of ['vendor' => ..., 'item' => ...] pairs and the
     * business's current category list, returns a parallel array of best-fit
     * category names (same order, same length), or null if categorization
     * wasn't possible (no API key, request failure, unparseable/mismatched
     * response). Never throws -- callers should treat null as "leave as is".
     */
    public function categorize(array $items, array $categories): ?array
    {
        if (empty($items)) {
            return [];
        }

        $apiKey = config('services.anthropic.api_key');
        if (!$apiKey) {
            Log::info('ExpenseCategorizerService: ANTHROPIC_API_KEY not configured, skipping auto-categorization.');
            return null;
        }

        $categoryList = implode(', ', $categories);
        $numbered = collect($items)
            ->map(fn ($i, $idx) => ($idx + 1) . '. vendor="' . ($i['vendor'] ?? '') . '", item="' . ($i['item'] ?? '') . '"')
            ->implode("\n");

        $prompt = "You're categorizing business expenses for a dog-walking company. Valid categories are exactly: {$categoryList}. For each numbered expense below, pick the single best-fitting category from that list -- use \"Other\" only if nothing else plausibly fits. Respond with ONLY a JSON array of " . count($items) . " category name strings, in the same order as the list, one per expense. No other text, no markdown code fences.\n\n{$numbered}";

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
                    'max_tokens' => 4096,
                    'messages'   => [['role' => 'user', 'content' => $prompt]],
                ],
            ]);

            $data = json_decode((string) $response->getBody(), true);
            $text = $data['content'][0]['text'] ?? null;

            if (!$text) {
                Log::warning('ExpenseCategorizerService: unexpected Anthropic response shape', ['data' => $data]);
                return null;
            }

            $parsed = $this->parseJsonArrayResponse($text);
            if (!is_array($parsed) || count($parsed) !== count($items)) {
                Log::warning('ExpenseCategorizerService: response count mismatch or unparseable', ['text' => $text]);
                $this->logError('Category count mismatch or unparseable response', ['text' => $text, 'expected' => count($items)]);
                return null;
            }

            // Hallucinated categories outside the given list fall back to "Other".
            return array_map(
                fn ($c) => in_array($c, $categories, true) ? $c : 'Other',
                $parsed
            );
        } catch (\Throwable $e) {
            Log::warning('ExpenseCategorizerService: categorization failed', ['error' => $e->getMessage()]);
            $this->logError($e->getMessage());
            return null;
        }
    }

    private function parseJsonArrayResponse(string $text): ?array
    {
        $text = preg_replace('/^```(?:json)?\s*|\s*```$/m', '', trim($text));

        $data = json_decode($text, true);
        if (is_array($data)) {
            return $data;
        }

        if (preg_match('/\[.*\]/s', $text, $matches)) {
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
                'type'       => 'ExpenseCategorizationFailed',
                'message'    => $message,
                'context'    => $context,
                'created_at' => now(),
            ]);
        } catch (\Throwable $logError) {}
    }
}

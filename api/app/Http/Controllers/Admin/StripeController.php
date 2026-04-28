<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Stripe\StripeClient;

class StripeController extends Controller
{
    /**
     * Return all active Stripe products with their active prices,
     * shaped for use in the invoice line-item picker.
     */
    public function products(): JsonResponse
    {
        $key = config('services.stripe.secret');
        if (!$key) {
            return response()->json(['data' => [], 'message' => 'Stripe secret key is not configured on the server.']);
        }

        try {
            $stripe = new StripeClient($key);

            $products = $stripe->products->all(['active' => true, 'limit' => 100]);

            // Fetch all active prices (both recurring and one-time)
            $prices = $stripe->prices->all(['active' => true, 'limit' => 100]);

            // Index prices by product ID
            $priceMap = [];
            foreach ($prices->data as $price) {
                $priceMap[$price->product][] = [
                    'id'       => $price->id,
                    'amount'   => $price->unit_amount !== null ? $price->unit_amount / 100 : null,
                    'currency' => strtoupper($price->currency),
                    'nickname' => $price->nickname,
                    'type'     => $price->type,
                    'interval' => $price->recurring?->interval ?? null,
                ];
            }

            $result = [];
            foreach ($products->data as $product) {
                $productPrices = $priceMap[$product->id] ?? [];
                // Include product even if it only has one-time prices — frontend filters
                $result[] = [
                    'id'          => $product->id,
                    'name'        => $product->name,
                    'description' => $product->description,
                    'prices'      => $productPrices,
                ];
            }

            // Sort by name
            usort($result, fn($a, $b) => strcmp($a['name'], $b['name']));

            return response()->json([
                'data' => $result,
                'debug' => [
                    'products_count' => count($products->data),
                    'prices_count'   => count($prices->data),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'data'    => [],
                'message' => 'Stripe error: ' . $e->getMessage(),
            ]);
        }
    }
}

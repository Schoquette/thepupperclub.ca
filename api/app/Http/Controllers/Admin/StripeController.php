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
        $stripe = new StripeClient(config('services.stripe.secret'));

        $products = $stripe->products->all(['active' => true, 'limit' => 100]);
        $prices   = $stripe->prices->all(['active' => true, 'limit' => 100, 'expand' => []]);

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
            $result[] = [
                'id'          => $product->id,
                'name'        => $product->name,
                'description' => $product->description,
                'prices'      => $priceMap[$product->id] ?? [],
            ];
        }

        // Sort by name
        usort($result, fn($a, $b) => strcmp($a['name'], $b['name']));

        return response()->json(['data' => $result]);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\PaygPricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaygPricingController extends Controller
{
    public function __construct(private PaygPricingService $pricing) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->pricing->all()]);
    }

    public function status(User $client): JsonResponse
    {
        abort_unless($client->role === 'client', 404);
        return response()->json(['data' => $this->pricing->statusFor($client)]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'service_type'    => 'required|in:' . implode(',', PaygPricingService::VISIT_TYPES),
            'stripe_price_id' => 'required|string',
        ]);

        try {
            $row = $this->pricing->setPrice($data['service_type'], $data['stripe_price_id']);
        } catch (\Throwable $e) {
            try {
                \App\Models\ErrorLog::create([
                    'user_id'    => $request->user()?->id,
                    'type'       => 'PaygPricingSetFailed',
                    'message'    => $e->getMessage(),
                    'context'    => $data,
                    'created_at' => now(),
                ]);
            } catch (\Throwable $logError) {}
            return response()->json(['message' => 'Could not load that Stripe price: ' . $e->getMessage()], 422);
        }

        return response()->json(['data' => [
            'service_type'     => $row->service_type,
            'stripe_price_id'  => $row->stripe_price_id,
            'pack_price_cents' => $row->pack_price_cents,
            'per_visit_rate'   => $row->perVisitRate(),
        ]]);
    }
}

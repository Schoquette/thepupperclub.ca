<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\ClientProfile;
use App\Models\PaygServicePricing;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Stripe\Price;
use Stripe\Stripe;

class PaygPricingService
{
    public const VISIT_TYPES = ['walk_30', 'walk_60', 'pack_hike'];

    /** Creates payg_service_pricing (with its 3 seed rows) on first use —
     *  production has no migration runner, so new tables self-heal the
     *  same way new columns do elsewhere in this app. */
    private function ensureTable(): void
    {
        if (Schema::hasTable('payg_service_pricing')) return;

        Schema::create('payg_service_pricing', function (\Illuminate\Database\Schema\Blueprint $table) {
            $table->string('service_type')->primary();
            $table->string('stripe_price_id')->nullable();
            $table->unsignedInteger('pack_price_cents')->nullable();
            $table->timestamps();
        });

        foreach (self::VISIT_TYPES as $type) {
            PaygServicePricing::create(['service_type' => $type]);
        }
    }

    public function all(): array
    {
        $this->ensureTable();
        $rows = PaygServicePricing::whereIn('service_type', self::VISIT_TYPES)->get()->keyBy('service_type');

        return collect(self::VISIT_TYPES)->map(function ($type) use ($rows) {
            $row = $rows->get($type);
            return [
                'service_type'     => $type,
                'stripe_price_id'  => $row?->stripe_price_id,
                'pack_price_cents' => $row?->pack_price_cents,
                'per_visit_rate'   => $row?->perVisitRate(),
            ];
        })->values()->all();
    }

    /** Saves the chosen Stripe Price for a visit type and caches its
     *  amount locally so scheduling a visit never has to call Stripe. */
    public function setPrice(string $serviceType, string $stripePriceId): PaygServicePricing
    {
        $this->ensureTable();
        abort_unless(in_array($serviceType, self::VISIT_TYPES, true), 422, 'Invalid service type.');

        Stripe::setApiKey(config('services.stripe.secret'));
        $price = Price::retrieve($stripePriceId);
        abort_if($price->unit_amount === null, 422, 'Selected Stripe price has no fixed amount.');

        return PaygServicePricing::updateOrCreate(
            ['service_type' => $serviceType],
            ['stripe_price_id' => $stripePriceId, 'pack_price_cents' => $price->unit_amount],
        );
    }

    /** custom_price_{type} if the client has one, else the global rate
     *  from the 10-pack price, else null (not configured yet). */
    public function resolveRate(ClientProfile $profile, string $serviceType): ?float
    {
        $customColumn = "custom_price_{$serviceType}";
        if (Schema::hasColumn('client_profiles', $customColumn) && $profile->{$customColumn} !== null) {
            return (float) $profile->{$customColumn};
        }

        $this->ensureTable();
        $row = PaygServicePricing::find($serviceType);
        return $row?->perVisitRate();
    }

    public function packPriceCents(string $serviceType): ?int
    {
        $this->ensureTable();
        return PaygServicePricing::find($serviceType)?->pack_price_cents;
    }

    /**
     * Live snapshot of a client's PAYG standing — pack balances (derived
     * from stamped appointments, never a hand-maintained counter) and the
     * unbilled running tab. Used by both the admin client page and the
     * client's own billing page.
     */
    public function statusFor(User $client): array
    {
        $profile = $client->clientProfile;
        if (!$profile || empty($profile->payg_mode)) {
            return ['payg_mode' => null];
        }

        $packBalances = [];
        foreach (self::VISIT_TYPES as $type) {
            $purchasedColumn = "pack_purchased_{$type}";
            $purchased = Schema::hasColumn('client_profiles', $purchasedColumn) ? (int) $profile->{$purchasedColumn} : 0;
            $used = Appointment::where('user_id', $client->id)
                ->where('service_type', $type)
                ->where('payg_charge_mode', 'pack')
                ->where('status', '!=', 'cancelled')
                ->count();
            $packBalances[$type] = [
                'purchased' => $purchased,
                'used'      => $used,
                'remaining' => max(0, $purchased - $used),
            ];
        }

        $unbilled = Appointment::where('user_id', $client->id)
            ->where('payg_charge_mode', 'running_tab')
            ->whereNull('payg_billed_at')
            ->where('status', '!=', 'cancelled')
            ->orderBy('scheduled_time')
            ->get(['id', 'service_type', 'scheduled_time', 'payg_rate']);

        return [
            'payg_mode'     => $profile->payg_mode,
            'pack_balances' => $packBalances,
            'running_tab'   => [
                'total' => round((float) $unbilled->sum('payg_rate'), 2),
                'count' => $unbilled->count(),
                'since' => $unbilled->first()?->scheduled_time,
                'visits' => $unbilled->values(),
            ],
            'custom_prices' => [
                'walk_30'   => $profile->custom_price_walk_30,
                'walk_60'   => $profile->custom_price_walk_60,
                'pack_hike' => $profile->custom_price_pack_hike,
            ],
        ];
    }
}

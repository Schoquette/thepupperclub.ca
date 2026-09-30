<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaygServicePricing extends Model
{
    protected $table = 'payg_service_pricing';
    protected $primaryKey = 'service_type';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'service_type',
        'stripe_price_id',
        'pack_price_cents',
    ];

    /** Per-visit rate implied by the 10-pack price, or null if not configured. */
    public function perVisitRate(): ?float
    {
        return $this->pack_price_cents !== null ? round($this->pack_price_cents / 10 / 100, 2) : null;
    }
}

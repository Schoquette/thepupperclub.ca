<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceLineItem extends Model
{
    protected $fillable = [
        'invoice_id',
        'description',
        'quantity',
        'unit_price',
        'discount_type',
        'discount_value',
        'total',
        'service_date',
        'appointment_id',
        'gst_exempt',
    ];

    protected function casts(): array
    {
        return [
            'unit_price'     => 'decimal:2',
            'discount_value' => 'decimal:2',
            'total'          => 'decimal:2',
            'service_date'   => 'date',
            'gst_exempt'     => 'boolean',
        ];
    }

    /** Discount amount in dollars for a given line quantity/price/discount. */
    public static function computeDiscountAmount(float $lineSubtotal, ?string $discountType, $discountValue): float
    {
        $value = (float) ($discountValue ?? 0);
        return match ($discountType) {
            'percent' => round($lineSubtotal * min(max($value, 0), 100) / 100, 2),
            'fixed'   => min(max($value, 0), $lineSubtotal),
            default   => 0.0,
        };
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }
}

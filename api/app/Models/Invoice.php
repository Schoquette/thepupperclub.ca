<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    protected $fillable = [
        'user_id',
        'invoice_number',
        'status',
        'subtotal',
        'gst',
        'credit_card_surcharge',
        'tip',
        'total',
        'due_date',
        'paid_at',
        'stripe_payment_intent_id',
        'stripe_invoice_id',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'subtotal'               => 'decimal:2',
            'gst'                    => 'decimal:2',
            'credit_card_surcharge'  => 'decimal:2',
            'tip'                    => 'decimal:2',
            'total'                  => 'decimal:2',
            'due_date'               => 'date',
            'paid_at'                => 'datetime',
        ];
    }

    public static function generateNumber(): string
    {
        $year = now()->year;
        $count = static::whereYear('created_at', $year)->count() + 1;
        return sprintf('PC-%d-%04d', $year, $count);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lineItems(): HasMany
    {
        return $this->hasMany(InvoiceLineItem::class);
    }
}

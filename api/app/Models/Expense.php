<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    public const CATEGORIES = [
        'Supplies',
        'Vehicle/Gas',
        'Insurance',
        'Software',
        'Marketing',
        'Professional Fees',
        'Equipment',
        'Utilities',
        'Other',
    ];

    protected $fillable = [
        'expense_date',
        'item',
        'vendor',
        'category',
        'subtotal',
        'gst',
        'pst',
        'total',
        'receipt_path',
        'source',
    ];

    protected function casts(): array
    {
        return [
            'expense_date' => 'date',
            'subtotal'     => 'decimal:2',
            'gst'          => 'decimal:2',
            'pst'          => 'decimal:2',
            'total'        => 'decimal:2',
        ];
    }
}

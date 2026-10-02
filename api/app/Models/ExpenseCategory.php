<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExpenseCategory extends Model
{
    public const DEFAULT_SEED = [
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

    protected $fillable = ['name'];
}

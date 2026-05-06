<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentTemplateField extends Model
{
    protected $fillable = [
        'template_id',
        'label',
        'field_type',
        'assigned_to',
        'page',
        'x',
        'y',
        'width',
        'height',
        'required',
        'sort_order',
        'default_value',
    ];

    protected function casts(): array
    {
        return [
            'x'        => 'float',
            'y'        => 'float',
            'width'    => 'float',
            'height'   => 'float',
            'required' => 'boolean',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(DocumentTemplate::class, 'template_id');
    }
}

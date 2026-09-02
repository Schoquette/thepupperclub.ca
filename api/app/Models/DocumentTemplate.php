<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentTemplate extends Model
{
    protected $fillable = [
        'client_id',
        'name',
        'description',
        'pdf_storage_path',
        'pdf_filename',
        'page_count',
        'created_by',
    ];

    public function fields(): HasMany
    {
        return $this->hasMany(DocumentTemplateField::class, 'template_id')->orderBy('sort_order');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Set only for one-off documents built for a single client (hidden
    // from the shared template library). Null for reusable templates.
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ClientDocument::class, 'template_id');
    }
}

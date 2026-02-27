<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ClientDocument extends Model
{
    protected $fillable = [
        'user_id',
        'dog_id',
        'type',
        'filename',
        'mime_type',
        'size_bytes',
        'storage_path',
        'uploaded_by',
        'signature_requested_at',
        'signature_token',
        'signed_at',
        'signer_name',
        'signer_ip',
        'signature_data',
        'signed_pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'signature_requested_at' => 'datetime',
            'signed_at'              => 'datetime',
        ];
    }

    public function getDownloadUrlAttribute(): string
    {
        return route('documents.serve', $this->id);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function dog(): BelongsTo
    {
        return $this->belongsTo(Dog::class);
    }
}

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
        'template_id',
        'status',
        'field_values',
        'sent_at',
        'expires_at',
        'signature_requested_at',
        'signature_token',
        'signed_at',
        'signer_name',
        'signer_ip',
        'signature_data',
        'signed_pdf_path',
        'countersign_token',
        'countersigned_at',
        'countersigner_name',
        'countersigner_ip',
        'countersign_signature_data',
        'countersign_field_values',
        'first_viewed_at',
        'external_recipient_name',
        'external_recipient_email',
        'external_signature_requested_at',
        'external_signature_token',
        'external_signed_at',
        'external_signer_name',
        'external_signer_ip',
        'external_signature_data',
        'external_field_values',
    ];

    protected function casts(): array
    {
        return [
            'signature_requested_at' => 'datetime',
            'signed_at'              => 'datetime',
            'sent_at'                => 'datetime',
            'expires_at'             => 'datetime',
            'field_values'           => 'array',
            'countersigned_at'       => 'datetime',
            'countersign_field_values' => 'array',
            'first_viewed_at'          => 'datetime',
            'external_signature_requested_at' => 'datetime',
            'external_signed_at'              => 'datetime',
            'external_field_values'           => 'array',
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

    public function template(): BelongsTo
    {
        return $this->belongsTo(DocumentTemplate::class, 'template_id');
    }
}

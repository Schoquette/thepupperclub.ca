<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Carbon;

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
    ];

    public function getSignedUrlAttribute(): string
    {
        return route('documents.serve', ['document' => $this->id, 'token' => $this->generateToken()]);
    }

    public function getExpiresAtAttribute(): string
    {
        return Carbon::now()->addMinutes(30)->toIso8601String();
    }

    protected function generateToken(): string
    {
        return hash_hmac('sha256', $this->id . $this->storage_path, config('app.key'));
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

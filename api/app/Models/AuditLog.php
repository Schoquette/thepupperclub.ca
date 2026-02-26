<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'model_type',
        'model_id',
        'action',
        'changed_fields',
        'ip_address',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'changed_fields' => 'array',
            'created_at'     => 'datetime',
        ];
    }

    public static function record(User $actor, Model $model, string $action, array $changedFields = []): void
    {
        static::create([
            'user_id'        => $actor->id,
            'model_type'     => get_class($model),
            'model_id'       => $model->getKey(),
            'action'         => $action,
            'changed_fields' => $changedFields ?: null,
            'ip_address'     => request()->ip(),
            'created_at'     => now(),
        ]);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

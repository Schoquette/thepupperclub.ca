<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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

    /**
     * Record an audit log entry for a model action.
     */
    public static function record(?User $actor, Model $model, string $action, array $changedFields = []): void
    {
        if (!$actor) return;

        self::ensureActionColumn();

        static::create([
            'user_id'        => $actor->id,
            'model_type'     => class_basename($model),
            'model_id'       => $model->getKey(),
            'action'         => $action,
            'changed_fields' => $changedFields ?: null,
            'ip_address'     => request()->ip(),
            'created_at'     => now(),
        ]);
    }

    /**
     * Record an auth or system event (no associated model).
     */
    public static function recordEvent(?User $actor, string $action, array $data = []): void
    {
        if (!$actor) return;

        self::ensureActionColumn();

        static::create([
            'user_id'        => $actor->id,
            'model_type'     => 'User',
            'model_id'       => $actor->id,
            'action'         => $action,
            'changed_fields' => $data ?: null,
            'ip_address'     => request()->ip(),
            'created_at'     => now(),
        ]);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Ensure the action column is a varchar instead of enum so it supports all action types.
     */
    private static function ensureActionColumn(): void
    {
        static $checked = false;
        if ($checked) return;
        $checked = true;

        if (!Schema::hasTable('audit_logs')) return;

        // Convert enum to varchar if needed
        try {
            $col = DB::selectOne("SHOW COLUMNS FROM audit_logs WHERE Field = 'action'");
            if ($col && str_starts_with($col->Type, 'enum')) {
                DB::statement("ALTER TABLE audit_logs MODIFY COLUMN `action` VARCHAR(50) NOT NULL");
            }
        } catch (\Throwable $e) {
            // Silently continue — column may already be varchar
        }
    }
}

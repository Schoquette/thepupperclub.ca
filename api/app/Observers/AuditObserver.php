<?php

namespace App\Observers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;

class AuditObserver
{
    /** Fields to exclude from change tracking (noisy or sensitive). */
    private const EXCLUDED_FIELDS = [
        'password', 'remember_token', 'updated_at', 'created_at',
        'deleted_at', 'email_verified_at', 'pre_visit_notification_sent',
    ];

    public function created(Model $model): void
    {
        $actor = auth()->user();
        if (!$actor) return;

        AuditLog::record($actor, $model, 'created');
    }

    public function updated(Model $model): void
    {
        $actor = auth()->user();
        if (!$actor) return;

        $changes = $model->getChanges();
        $original = $model->getOriginal();

        $changedFields = [];
        foreach ($changes as $key => $newValue) {
            if (in_array($key, self::EXCLUDED_FIELDS)) continue;

            $changedFields[$key] = [
                'from' => $original[$key] ?? null,
                'to'   => $newValue,
            ];
        }

        // Don't log if only excluded fields changed
        if (empty($changedFields)) return;

        AuditLog::record($actor, $model, 'updated', $changedFields);
    }

    public function deleted(Model $model): void
    {
        $actor = auth()->user();
        if (!$actor) return;

        AuditLog::record($actor, $model, 'deleted');
    }
}

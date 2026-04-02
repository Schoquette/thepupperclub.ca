<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportCardTemplate extends Model
{
    protected $fillable = ['user_id', 'items'];

    protected function casts(): array
    {
        return ['items' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Default checklist items used when no client-specific template exists.
     */
    public static function defaultItems(): array
    {
        return [
            ['key' => 'no_1',           'label' => 'No. 1',                     'enabled' => true],
            ['key' => 'no_2',           'label' => 'No. 2',                     'enabled' => true],
            ['key' => 'grooming',       'label' => 'Grooming',                  'enabled' => true],
            ['key' => 'indoor_play',    'label' => 'Indoor Play',               'enabled' => true],
            ['key' => 'outdoor_play',   'label' => 'Outdoor Play',              'enabled' => true],
            ['key' => 'long_walk',      'label' => 'Long Walk',                 'enabled' => true],
            ['key' => 'socialization',  'label' => 'Socialization',             'enabled' => true],
            ['key' => 'training',       'label' => 'Training',                  'enabled' => true],
            ['key' => 'water_refill',   'label' => 'Water Refill',              'enabled' => true],
            ['key' => 'feeding',        'label' => 'Feeding',                   'enabled' => true],
            ['key' => 'medication',     'label' => 'Medication Administration', 'enabled' => true],
        ];
    }

    /**
     * Get the effective template items for a client (falls back to defaults).
     */
    public static function forClient(int $userId): array
    {
        $template = static::where('user_id', $userId)->first();
        return $template?->items ?? static::defaultItems();
    }
}

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
            ['key' => 'outdoor_walk',   'label' => 'Outdoor Walk',            'enabled' => true],
            ['key' => 'indoor_play',    'label' => 'Indoor Play',             'enabled' => true],
            ['key' => 'grooming',       'label' => 'Grooming',                'enabled' => true],
            ['key' => 'fed',            'label' => 'Fed',                     'enabled' => true],
            ['key' => 'water_refresh',  'label' => 'Water Refresh',           'enabled' => true],
            ['key' => 'bathed',         'label' => 'Bathed',                  'enabled' => true],
            ['key' => 'training',       'label' => 'Training',                'enabled' => true],
            ['key' => 'massage',        'label' => 'Massage',                 'enabled' => true],
            ['key' => 'ear_cleaning',   'label' => 'Ear Cleaning',            'enabled' => true],
            ['key' => 'teeth_cleaning', 'label' => 'Teeth Cleaning',          'enabled' => true],
            ['key' => 'nail_trim',      'label' => 'Nail Trim',               'enabled' => true],
            ['key' => 'cuddle_time',    'label' => 'Cuddle Time',             'enabled' => true],
            ['key' => 'medication',     'label' => 'Medication Administered', 'enabled' => true],
            ['key' => 'special_trip',   'label' => 'Special Trip',            'enabled' => true],
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

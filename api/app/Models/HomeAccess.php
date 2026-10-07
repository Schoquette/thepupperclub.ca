<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class HomeAccess extends Model
{
    protected $fillable = [
        'user_id',
        'entry_instructions',
        'buzzer_code',
        'lockbox_code',
        'door_code',
        'alarm_code',
        'key_location',
        'parking_instructions',
        'notes',
    ];

    // Encrypt sensitive codes on set, decrypt on get
    public function setBuzzerCodeAttribute(?string $value): void
    {
        $this->attributes['buzzer_code'] = $value ? Crypt::encryptString($value) : null;
    }

    public function getBuzzerCodeAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    public function setLockboxCodeAttribute(?string $value): void
    {
        $this->attributes['lockbox_code'] = $value ? Crypt::encryptString($value) : null;
    }

    public function getLockboxCodeAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    public function setDoorCodeAttribute(?string $value): void
    {
        $this->attributes['door_code'] = $value ? Crypt::encryptString($value) : null;
    }

    public function getDoorCodeAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    public function setAlarmCodeAttribute(?string $value): void
    {
        $this->attributes['alarm_code'] = $value ? Crypt::encryptString($value) : null;
    }

    public function getAlarmCodeAttribute(?string $value): ?string
    {
        return $value ? Crypt::decryptString($value) : null;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

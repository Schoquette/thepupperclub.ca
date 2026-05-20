<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class CommunityMember extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'password',
        'status',
        'verification_provider',
        'verification_session_id',
        'verification_paid_at',
        'verification_checkout_session_id',
        'verified_at',
        'geohash',
        'introduction',
        'photo_path',
        'availability',
        'need_availability',
        'care_offered',
        'care_needed',
        'radius_meters',
        'api_token',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'api_token',
    ];

    protected function casts(): array
    {
        return [
            'verified_at'           => 'datetime',
            'verification_paid_at'  => 'datetime',
            'last_login_at'         => 'datetime',
            'availability'   => 'array',
            'radius_meters'  => 'integer',
        ];
    }

    /**
     * Generate a new opaque bearer token and persist it. Caller is
     * responsible for returning the plain string to the client; we never
     * surface it in subsequent API responses (it's in the `hidden` array).
     */
    public function issueToken(): string
    {
        $token = Str::random(64);
        $this->forceFill([
            'api_token'     => hash('sha256', $token),
            'last_login_at' => now(),
        ])->save();
        return $token;
    }

    public function revokeToken(): void
    {
        $this->forceFill(['api_token' => null])->save();
    }

    public static function findByPlainToken(string $plain): ?self
    {
        return self::where('api_token', hash('sha256', $plain))->first();
    }

    public function pets(): HasMany
    {
        return $this->hasMany(CommunityPet::class, 'member_id')->orderBy('sort_order')->orderBy('id');
    }
}

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
        'paused_at',
        'notification_prefs',
        'referral_code',
        'referred_by_member_id',
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
            'paused_at'             => 'datetime',
            'last_login_at'         => 'datetime',
            'availability'          => 'array',
            'need_availability'     => 'array',
            'care_offered'          => 'array',
            'care_needed'           => 'array',
            'notification_prefs'    => 'array',
            'radius_meters'         => 'integer',
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

    /**
     * Mint and persist a short, unambiguous referral code if the member
     * doesn't already have one. The code is what gets embedded in a
     * shareable join link (...?invited_by=CODE).
     *
     * The alphabet is base32-ish (no 0/O/1/I/L) to keep codes readable
     * when spoken or hand-typed.
     */
    public function ensureReferralCode(): string
    {
        if ($this->referral_code) return $this->referral_code;

        $alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
        do {
            $code = '';
            for ($i = 0; $i < 8; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (self::where('referral_code', $code)->exists());

        $this->forceFill(['referral_code' => $code])->save();
        return $code;
    }
}

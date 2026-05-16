<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Community is intentionally a separate auth surface from the paid
        // service's `users` table. Same person may eventually have both
        // accounts; we keep them decoupled so an unverified Community member
        // never lands in the paid-service tables.
        Schema::create('community_members', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');

            // Lifecycle: a member starts pending_verification, becomes
            // verified after ID + selfie pass, can be suspended (admin
            // action) or closed (member-initiated).
            $table->enum('status', ['pending_verification', 'verified', 'suspended', 'closed'])
                ->default('pending_verification');

            // Third-party verification metadata (Persona / Stripe Identity /
            // Onfido). Populated when verification kicks off, finalised when
            // a webhook confirms a pass.
            $table->string('verification_provider')->nullable();
            $table->string('verification_session_id')->nullable();
            $table->timestamp('verified_at')->nullable();

            // Coarse geohash (max 12 chars, but we'll truncate to ~6-7 in
            // application code so we have radius-match precision without
            // being able to reconstruct an address).
            $table->string('geohash', 12)->nullable()->index();

            // User-facing profile bits (all optional at signup).
            $table->text('introduction')->nullable();
            $table->json('availability')->nullable();
            $table->unsignedSmallInteger('radius_meters')->default(1000);

            // Simple bearer-token auth for the scaffold. We can swap this
            // for Sanctum personal-access-tokens once we need multi-device
            // / revocation per device.
            $table->string('api_token', 80)->nullable()->unique();
            $table->timestamp('last_login_at')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_members');
    }
};

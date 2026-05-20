<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_members', function (Blueprint $table) {
            // Pause / resume — when set, the member is hidden from
            // discovery and other surfaces without deleting their data.
            $table->timestamp('paused_at')->nullable()->after('verification_paid_at');
            // Per-channel notification preferences. Defaults reasonable
            // (everything on) and are merged client-side, so we don't
            // back-fill on existing rows.
            $table->json('notification_prefs')->nullable()->after('paused_at');
        });
    }

    public function down(): void
    {
        Schema::table('community_members', function (Blueprint $table) {
            $table->dropColumn(['paused_at', 'notification_prefs']);
        });
    }
};

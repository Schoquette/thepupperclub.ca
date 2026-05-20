<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_members', function (Blueprint $table) {
            $table->timestamp('verification_paid_at')->nullable()->after('verified_at');
            $table->string('verification_checkout_session_id')->nullable()->after('verification_paid_at');
        });
    }

    public function down(): void
    {
        Schema::table('community_members', function (Blueprint $table) {
            $table->dropColumn(['verification_paid_at', 'verification_checkout_session_id']);
        });
    }
};

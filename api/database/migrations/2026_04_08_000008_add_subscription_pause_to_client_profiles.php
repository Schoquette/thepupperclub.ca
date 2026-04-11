<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->date('subscription_paused_from')->nullable()->after('subscription_end_date');
            $table->date('subscription_paused_until')->nullable()->after('subscription_paused_from');
            $table->boolean('pause_billing')->default(true)->after('subscription_paused_until');
            $table->boolean('prorate_on_resume')->default(false)->after('pause_billing');
        });
    }

    public function down(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->dropColumn(['subscription_paused_from', 'subscription_paused_until', 'pause_billing', 'prorate_on_resume']);
        });
    }
};

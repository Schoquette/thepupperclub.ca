<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->boolean('secondary_notify_app')->default(false)->after('secondary_contact_phone');
            $table->boolean('secondary_notify_email')->default(false)->after('secondary_notify_app');
            $table->boolean('secondary_notify_sms')->default(false)->after('secondary_notify_email');
        });
    }

    public function down(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->dropColumn(['secondary_notify_app', 'secondary_notify_email', 'secondary_notify_sms']);
        });
    }
};

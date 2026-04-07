<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->string('secondary_contact_name')->nullable()->after('emergency_contact_phone');
            $table->string('secondary_contact_email')->nullable()->after('secondary_contact_name');
        });
    }

    public function down(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->dropColumn(['secondary_contact_name', 'secondary_contact_email']);
        });
    }
};

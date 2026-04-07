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
            $table->boolean('secondary_notify_messages')->default(false)->after('secondary_contact_email');
            $table->boolean('secondary_notify_report_cards')->default(false)->after('secondary_notify_messages');
            $table->boolean('secondary_notify_billing')->default(false)->after('secondary_notify_report_cards');
            $table->boolean('secondary_notify_appointments')->default(false)->after('secondary_notify_billing');
        });
    }

    public function down(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'secondary_contact_name',
                'secondary_contact_email',
                'secondary_notify_messages',
                'secondary_notify_report_cards',
                'secondary_notify_billing',
                'secondary_notify_appointments',
            ]);
        });
    }
};

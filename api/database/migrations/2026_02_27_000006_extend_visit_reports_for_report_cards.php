<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visit_reports', function (Blueprint $table) {
            // Make appointment_id nullable (allow standalone reports)
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->dateTime('arrival_time')->nullable()->after('appointment_id');
            $table->dateTime('departure_time')->nullable()->after('arrival_time');
            $table->json('checklist')->nullable()->after('departure_time');
            $table->string('special_trip_details')->nullable()->after('checklist');
            $table->string('report_photo_path')->nullable()->after('special_trip_details');
            $table->timestamp('sent_at')->nullable()->after('photo_paths');
            $table->timestamp('email_sent_at')->nullable()->after('sent_at');
        });

        Schema::create('report_card_templates', function (Blueprint $table) {
            $table->id();
            // null user_id = global default template
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->json('items'); // array of {key, label, enabled, order}
            $table->timestamps();

            $table->unique('user_id'); // one template per client
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_card_templates');
        Schema::table('visit_reports', function (Blueprint $table) {
            $table->dropColumn([
                'user_id', 'arrival_time', 'departure_time', 'checklist',
                'special_trip_details', 'report_photo_path', 'sent_at', 'email_sent_at',
            ]);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('service_type', ['walk_30', 'walk_60', 'drop_in', 'overnight', 'day_boarding']);
            $table->enum('status', ['scheduled', 'checked_in', 'completed', 'cancelled'])->default('scheduled');
            $table->dateTime('scheduled_time');            // exact time — admin only
            $table->enum('client_time_block', ['early_morning', 'morning', 'midday', 'afternoon', 'evening']);
            $table->unsignedSmallInteger('duration_minutes')->default(30);
            $table->text('notes')->nullable();
            $table->json('recurrence_rule')->nullable();
            $table->foreignId('recurrence_parent_id')->nullable()->constrained('appointments')->nullOnDelete();
            $table->dateTime('check_in_time')->nullable();
            $table->dateTime('check_out_time')->nullable();
            $table->boolean('pre_visit_notification_sent')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'scheduled_time']);
            $table->index(['status', 'scheduled_time']);
        });

        // Pivot: appointments <-> dogs
        Schema::create('appointment_dog', function (Blueprint $table) {
            $table->foreignId('appointment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dog_id')->constrained()->cascadeOnDelete();
            $table->primary(['appointment_id', 'dog_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_dog');
        Schema::dropIfExists('appointments');
    }
};

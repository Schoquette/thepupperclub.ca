<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('service_type', ['walk_30', 'walk_60', 'drop_in', 'overnight', 'day_boarding']);
            $table->enum('preferred_time_block', ['early_morning', 'morning', 'midday', 'afternoon', 'evening']);
            $table->date('preferred_date');
            $table->text('notes')->nullable();
            $table->enum('status', ['pending', 'approved', 'declined', 'counter_offered'])->default('pending');
            $table->text('admin_response')->nullable();
            $table->enum('counter_time_block', ['early_morning', 'morning', 'midday', 'afternoon', 'evening'])->nullable();
            $table->date('counter_date')->nullable();
            $table->timestamps();
        });

        Schema::create('service_request_dog', function (Blueprint $table) {
            $table->foreignId('service_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dog_id')->constrained()->cascadeOnDelete();
            $table->primary(['service_request_id', 'dog_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_request_dog');
        Schema::dropIfExists('service_requests');
    }
};

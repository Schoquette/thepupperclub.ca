<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visit_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained()->cascadeOnDelete();
            $table->boolean('eliminated')->default(false);
            $table->boolean('ate_well')->default(false);
            $table->boolean('drank_water')->default(false);
            $table->enum('mood', ['great', 'good', 'okay', 'anxious', 'unwell'])->default('good');
            $table->enum('energy_level', ['high', 'normal', 'low'])->default('normal');
            $table->decimal('distance_km', 5, 2)->nullable();
            $table->text('notes')->nullable();
            $table->json('photo_paths')->nullable(); // array of storage paths
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_reports');
    }
};

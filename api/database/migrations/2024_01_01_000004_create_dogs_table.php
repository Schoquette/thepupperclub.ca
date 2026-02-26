<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dogs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('breed')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->enum('size', ['small', 'medium', 'large', 'extra_large'])->nullable();
            $table->enum('sex', ['male', 'female'])->nullable();
            $table->decimal('weight_kg', 5, 2)->nullable();
            $table->string('colour')->nullable();
            $table->string('microchip_number')->nullable();
            $table->boolean('spayed_neutered')->default(false);
            $table->boolean('bite_history')->default(false);
            $table->text('bite_history_notes')->nullable();
            $table->text('aggression_notes')->nullable();
            $table->string('vet_name')->nullable();
            $table->string('vet_phone')->nullable();
            $table->string('vet_address')->nullable();
            $table->json('medications')->nullable(); // array of {name, dosage, frequency, notes}
            $table->text('special_instructions')->nullable();
            $table->string('photo_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dogs');
    }
};

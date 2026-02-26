<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('onboarding_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('step', [
                'set_password',
                'welcome',
                'profile',
                'home_access',
                'dog_profiles',
                'payment',
                'agreement',
                'confirmation',
            ]);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'step']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('onboarding_steps');
    }
};

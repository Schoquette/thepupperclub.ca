<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('home_accesses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('entry_instructions')->nullable();
            $table->text('lockbox_code')->nullable();   // encrypted
            $table->text('door_code')->nullable();       // encrypted
            $table->text('alarm_code')->nullable();      // encrypted
            $table->string('key_location')->nullable();
            $table->text('parking_instructions')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('home_accesses');
    }
};

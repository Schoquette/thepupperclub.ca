<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rescue_trip_interests', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('email', 255);
            // Slug of the trip the visitor expressed interest in. Free-form
            // so we can introduce new trips without a migration. Values:
            // costa-rica, merida, puebla, seoul, general, …
            $table->string('trip_slug', 60);
            $table->string('trip_label', 120);
            $table->text('comments')->nullable();
            $table->string('source_url', 255)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->timestamps();
            $table->index('email');
            $table->index('trip_slug');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rescue_trip_interests');
    }
};

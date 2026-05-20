<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A community member can list one or more pets so neighbours know
        // who they'd be helping. Species-specific fields (e.g. dog
        // breed/size, cat indoor/outdoor) live in the `species_data` JSON
        // column so the schema doesn't sprout dozens of nullable columns.
        Schema::create('community_pets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('member_id');
            $table->enum('species', ['dog', 'cat', 'other']);
            $table->string('species_other')->nullable(); // free text when species=other
            $table->string('name');
            $table->string('photo_path')->nullable();

            $table->unsignedSmallInteger('age_years')->nullable();
            $table->enum('sex', ['male', 'female', 'unknown'])->nullable();
            $table->boolean('spayed_neutered')->nullable(); // null = unsure
            $table->text('notes')->nullable();             // personality + general
            $table->text('care_instructions')->nullable(); // feeding, meds, do/don't

            $table->json('species_data')->nullable();      // per-species fields

            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('member_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->index(['member_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_pets');
    }
};

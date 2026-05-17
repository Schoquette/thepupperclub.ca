<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Positive-only written recommendations between members. Per spec:
        //   - written, not numerical (no scores)
        //   - authored, not anonymous
        //   - recipient-controlled (can hide)
        //   - one per (author, subject) — additional prompts upsert the
        //     existing row rather than creating duplicates
        Schema::create('community_recommendations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('author_id');
            $table->unsignedBigInteger('subject_id');
            $table->string('body', 320);
            $table->boolean('hidden')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('author_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->foreign('subject_id')->references('id')->on('community_members')->cascadeOnDelete();

            $table->unique(['author_id', 'subject_id']);
            $table->index(['subject_id', 'hidden']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_recommendations');
    }
};

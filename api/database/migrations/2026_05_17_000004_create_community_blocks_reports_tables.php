<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Blocks are silent + immediate. The blocked party gets no signal:
        // the blocker just disappears from discovery, conversations, and
        // broadcast recipient lists.
        Schema::create('community_blocks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('blocker_id');
            $table->unsignedBigInteger('blocked_id');
            // Free-text reason for the blocker's own reference only —
            // never shown to the blocked party. Optional.
            $table->string('reason', 280)->nullable();
            $table->timestamps();

            $table->foreign('blocker_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->foreign('blocked_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->unique(['blocker_id', 'blocked_id']);
            $table->index('blocked_id');
        });

        // Reports route to the moderation team. Categories are deliberately
        // plain-English (per spec: "clarity over jargon").
        Schema::create('community_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('reporter_id');
            $table->unsignedBigInteger('reported_id');
            $table->enum('category', [
                'uncomfortable',     // someone making me uncomfortable
                'harassment',        // harassment or hostile behaviour
                'spam_or_scam',      // spam or scam
                'animal_safety',     // concern for an animal's safety
                'other',
            ]);
            $table->text('details')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->unsignedBigInteger('reviewed_by_user_id')->nullable(); // admin in the paid-service users table
            $table->timestamps();

            $table->foreign('reporter_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->foreign('reported_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->index(['reported_id', 'category']);
            $table->index('reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_reports');
        Schema::dropIfExists('community_blocks');
    }
};

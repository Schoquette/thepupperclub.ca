<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Care broadcasts — a member asks selected neighbours for help with
        // a one-off care task. Recipients see only their own copy; they do
        // not see who else got the broadcast, and they do not see who has
        // or hasn't responded. The sender sees responses as they come in.
        Schema::create('community_broadcasts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sender_id');
            $table->enum('care_type', ['walk', 'drop_in', 'overnight', 'other']);
            $table->dateTime('starts_at');
            $table->unsignedSmallInteger('duration_minutes')->default(30);
            $table->text('context')->nullable();
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->unsignedBigInteger('closed_with_recipient_id')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('sender_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->foreign('closed_with_recipient_id')->references('id')->on('community_members')->nullOnDelete();

            $table->index(['sender_id', 'status']);
            $table->index('starts_at');
        });

        Schema::create('community_broadcast_recipients', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broadcast_id');
            $table->unsignedBigInteger('recipient_id');
            $table->enum('status', ['pending', 'confirmed', 'declined'])->default('pending');
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->foreign('broadcast_id')->references('id')->on('community_broadcasts')->cascadeOnDelete();
            $table->foreign('recipient_id')->references('id')->on('community_members')->cascadeOnDelete();

            // One row per (broadcast, recipient).
            $table->unique(['broadcast_id', 'recipient_id']);
            $table->index(['recipient_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_broadcast_recipients');
        Schema::dropIfExists('community_broadcasts');
    }
};

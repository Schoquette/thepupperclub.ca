<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One-to-one chat threads between two CommunityMembers. We store
        // the two member ids sorted (member_a_id < member_b_id) so the
        // unique constraint dedupes regardless of who started the thread.
        //
        // Note: messages are NOT end-to-end encrypted in this scaffold.
        // The spec calls for E2E; we'll retrofit per-device key exchange
        // once verification and discovery are battle-tested.
        Schema::create('community_conversations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('member_a_id');
            $table->unsignedBigInteger('member_b_id');
            $table->timestamp('last_message_at')->nullable();
            $table->unsignedInteger('unread_count_a')->default(0);
            $table->unsignedInteger('unread_count_b')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('member_a_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->foreign('member_b_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->unique(['member_a_id', 'member_b_id']);
            $table->index('last_message_at');
        });

        Schema::create('community_chat_messages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('conversation_id');
            $table->unsignedBigInteger('sender_id');
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('conversation_id')->references('id')->on('community_conversations')->cascadeOnDelete();
            $table->foreign('sender_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->index(['conversation_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_chat_messages');
        Schema::dropIfExists('community_conversations');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete(); // client's user_id
            $table->enum('status', ['open', 'resolved', 'needs_follow_up'])->default('open');
            $table->unsignedInteger('unread_count_admin')->default(0);
            $table->unsignedInteger('unread_count_client')->default(0);
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();

            $table->unique('user_id'); // one conversation per client
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->enum('type', ['text', 'pre_visit_prompt', 'arrival', 'visit_report', 'invoice', 'notification'])->default('text');
            $table->text('body')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'id']);
            $table->index(['conversation_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
    }
};

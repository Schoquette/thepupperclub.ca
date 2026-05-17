<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('community_connections', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('requester_id');
            $table->unsignedBigInteger('recipient_id');

            // Lifecycle:
            //   pending  → the request hasn't been responded to yet
            //   accepted → connection is active
            //   declined → recipient explicitly said no (silent to requester)
            //   removed  → connection was active and later silently removed
            $table->enum('status', ['pending', 'accepted', 'declined', 'removed'])
                ->default('pending');

            // Optional note included with the request — short, plain text.
            $table->string('note', 280)->nullable();

            $table->timestamp('responded_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('requester_id')->references('id')->on('community_members')->cascadeOnDelete();
            $table->foreign('recipient_id')->references('id')->on('community_members')->cascadeOnDelete();

            // Prevent duplicate edges in either direction at the app layer
            // (we still allow a fresh row after a removed/declined one via
            // soft-deletes + scoped queries).
            $table->unique(['requester_id', 'recipient_id']);

            // Common access patterns
            $table->index(['recipient_id', 'status']);
            $table->index(['requester_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_connections');
    }
};

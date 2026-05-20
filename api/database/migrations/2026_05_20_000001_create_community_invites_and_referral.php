<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Per-member referral code. Used to mint a shareable join link
        // (.../sign-up?invited_by=CODE). Acceptance does NOT auto-connect
        // the inviter — it's purely a "you're here because of X" signal.
        Schema::table('community_members', function (Blueprint $table) {
            $table->string('referral_code', 16)->nullable()->unique()->after('email');
            // When someone signs up via a join link we record who referred
            // them, so we can credit the inviter and email a thank-you.
            $table->unsignedBigInteger('referred_by_member_id')->nullable()->after('referral_code');
            $table->foreign('referred_by_member_id')
                ->references('id')->on('community_members')
                ->nullOnDelete();
        });

        // Direct email invites sent through the portal.
        Schema::create('community_invites', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('inviter_id');
            $table->string('email');
            $table->text('note')->nullable();
            // sent → email went out
            // accepted → recipient signed up using the embedded code
            // expired → unused after a reasonable window (180 days)
            $table->enum('status', ['sent', 'accepted', 'expired'])->default('sent');
            $table->unsignedBigInteger('accepted_member_id')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
            $table->foreign('inviter_id')
                ->references('id')->on('community_members')
                ->cascadeOnDelete();
            $table->foreign('accepted_member_id')
                ->references('id')->on('community_members')
                ->nullOnDelete();
            $table->index(['inviter_id', 'status']);
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_invites');
        Schema::table('community_members', function (Blueprint $table) {
            $table->dropForeign(['referred_by_member_id']);
            $table->dropColumn(['referral_code', 'referred_by_member_id']);
        });
    }
};

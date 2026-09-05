<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_logs')) {
            return;
        }

        Schema::create('email_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('to_email');
            $table->string('subject', 500);
            $table->string('mail_class', 100)->nullable();
            $table->string('status', 20)->default('sent');
            $table->text('error_message')->nullable();
            $table->string('resend_id', 100)->nullable();
            $table->mediumText('body_html')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index('status');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_logs');
    }
};

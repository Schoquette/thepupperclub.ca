<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action'); // created, upgraded, downgraded, canceled, canceled_immediate
            $table->string('old_plan')->nullable();
            $table->decimal('old_amount', 10, 2)->nullable();
            $table->string('new_plan')->nullable();
            $table->decimal('new_amount', 10, 2)->nullable();
            $table->date('effective_date')->nullable();
            $table->decimal('proration_amount', 10, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_changes');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dogs', function (Blueprint $table) {
            $table->boolean('off_leash_approved')->default(false)->after('is_active');
            $table->boolean('media_consent')->default(false)->after('off_leash_approved');
            $table->boolean('buddy_walks_ok')->default(false)->after('media_consent');
        });
    }

    public function down(): void
    {
        Schema::table('dogs', function (Blueprint $table) {
            $table->dropColumn(['off_leash_approved', 'media_consent', 'buddy_walks_ok']);
        });
    }
};

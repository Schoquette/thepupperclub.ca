<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_members', function (Blueprint $table) {
            // Stored under the local disk (private/community_members/...).
            // Served via an authenticated endpoint to other connected
            // neighbours.
            $table->string('photo_path')->nullable()->after('introduction');
        });
    }

    public function down(): void
    {
        Schema::table('community_members', function (Blueprint $table) {
            $table->dropColumn('photo_path');
        });
    }
};

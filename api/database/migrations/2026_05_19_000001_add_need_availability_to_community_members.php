<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_members', function (Blueprint $table) {
            // Parallel to `availability` (which captures *when* a member is
            // free to help others). `need_availability` captures *when* a
            // member typically needs care for their own pets. Same chip
            // vocabulary — mornings / evenings / weekdays / weekends /
            // ad_hoc — so we can later match supply to demand.
            $table->json('need_availability')->nullable()->after('availability');
        });
    }

    public function down(): void
    {
        Schema::table('community_members', function (Blueprint $table) {
            $table->dropColumn('need_availability');
        });
    }
};

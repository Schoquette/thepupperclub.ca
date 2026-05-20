<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('community_members', function (Blueprint $table) {
            // Two arrays of care-type tags:
            //   care_offered — kinds of care this member can provide to others
            //   care_needed  — kinds of care this member sometimes needs
            // Members can fill either, both, or neither. Same vocabulary in
            // both columns so we can match offers to needs cleanly later.
            $table->json('care_offered')->nullable()->after('availability');
            $table->json('care_needed')->nullable()->after('care_offered');
        });
    }

    public function down(): void
    {
        Schema::table('community_members', function (Blueprint $table) {
            $table->dropColumn(['care_offered', 'care_needed']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Two free-form note fields per dog so admins + clients can record
     * additional context that doesn't fit into the structured intake
     * fields:
     *   walking_notes — anything relevant to walks (pace, route, leash
     *                   handling, encounters to avoid, etc.)
     *   general_notes — anything else worth knowing about the dog
     */
    public function up(): void
    {
        Schema::table('dogs', function (Blueprint $table) {
            if (!Schema::hasColumn('dogs', 'walking_notes')) {
                $table->text('walking_notes')->nullable()->after('avoid_on_walks');
            }
            if (!Schema::hasColumn('dogs', 'general_notes')) {
                $table->text('general_notes')->nullable()->after('walking_notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('dogs', function (Blueprint $table) {
            $table->dropColumn(['walking_notes', 'general_notes']);
        });
    }
};

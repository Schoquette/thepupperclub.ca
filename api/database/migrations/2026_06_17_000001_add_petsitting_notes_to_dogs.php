<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Third free-form note field per dog: petsitting_notes.
     * Mirrors walking_notes and general_notes — anything relevant to
     * overnight / in-home / extended sitting situations specifically.
     */
    public function up(): void
    {
        Schema::table('dogs', function (Blueprint $table) {
            if (!Schema::hasColumn('dogs', 'petsitting_notes')) {
                $table->text('petsitting_notes')->nullable()->after('general_notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('dogs', function (Blueprint $table) {
            $table->dropColumn('petsitting_notes');
        });
    }
};

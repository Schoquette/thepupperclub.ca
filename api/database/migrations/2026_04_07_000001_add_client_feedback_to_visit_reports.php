<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visit_reports', function (Blueprint $table) {
            $table->text('client_comment')->nullable()->after('notes');
            $table->text('change_request')->nullable()->after('client_comment');
        });
    }

    public function down(): void
    {
        Schema::table('visit_reports', function (Blueprint $table) {
            $table->dropColumn(['client_comment', 'change_request']);
        });
    }
};

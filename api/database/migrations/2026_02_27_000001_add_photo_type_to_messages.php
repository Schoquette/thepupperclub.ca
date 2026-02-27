<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE messages MODIFY COLUMN type ENUM('text','pre_visit_prompt','arrival','visit_report','invoice','notification','photo') NOT NULL DEFAULT 'text'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE messages MODIFY COLUMN type ENUM('text','pre_visit_prompt','arrival','visit_report','invoice','notification') NOT NULL DEFAULT 'text'");
    }
};

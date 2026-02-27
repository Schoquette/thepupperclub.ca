<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP NULL AFTER read_at');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE messages DROP COLUMN IF EXISTS edited_at');
    }
};

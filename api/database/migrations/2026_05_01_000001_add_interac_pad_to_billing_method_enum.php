<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE client_profiles MODIFY COLUMN billing_method ENUM('credit_card','e_transfer','cash','ach','interac_pad') NOT NULL DEFAULT 'credit_card'"
        );
    }

    public function down(): void
    {
        DB::statement(
            "ALTER TABLE client_profiles MODIFY COLUMN billing_method ENUM('credit_card','e_transfer','cash','ach') NOT NULL DEFAULT 'credit_card'"
        );
    }
};

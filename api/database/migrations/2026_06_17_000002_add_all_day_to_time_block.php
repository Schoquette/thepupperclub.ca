<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add 'all_day' to the appointments.client_time_block enum so day
     * boarding + overnight bookings can be tagged correctly instead of
     * being forced into one of the five 3-hour blocks.
     *
     * Uses raw ALTER TABLE because the shared host doesn't have
     * doctrine/dbal installed (Blueprint::enum + change() requires it).
     */
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE appointments
             MODIFY client_time_block ENUM(
                'early_morning', 'morning', 'midday', 'afternoon', 'evening', 'all_day'
             ) NOT NULL"
        );
    }

    public function down(): void
    {
        // Backfill any all_day rows to 'morning' so they fit the old
        // enum before narrowing it.
        DB::statement("UPDATE appointments SET client_time_block = 'morning' WHERE client_time_block = 'all_day'");
        DB::statement(
            "ALTER TABLE appointments
             MODIFY client_time_block ENUM(
                'early_morning', 'morning', 'midday', 'afternoon', 'evening'
             ) NOT NULL"
        );
    }
};

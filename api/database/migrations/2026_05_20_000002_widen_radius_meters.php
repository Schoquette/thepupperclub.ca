<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The column was originally unsignedSmallInteger (caps at 65,535).
     * We want to allow radii up to 200,000m (200 km), so widen to
     * unsigned INT. We use raw SQL because the shared host doesn't have
     * doctrine/dbal installed and we can't run `composer require` on it.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE community_members MODIFY radius_meters INT UNSIGNED NOT NULL DEFAULT 1000');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE community_members MODIFY radius_meters SMALLINT UNSIGNED NOT NULL DEFAULT 1000');
    }
};

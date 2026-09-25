<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'color')) {
            // Calendar event colour for this team member's assigned
            // appointments/blocks (hex string, e.g. "#9B6BD6"). Null = use
            // the default service-type-based colouring.
            DB::statement("ALTER TABLE users ADD COLUMN color VARCHAR(7) NULL AFTER role");
        }

        // Allow "not-yet-onboarded" team members: a placeholder record with
        // no email/password that exists only to appear in the assignment
        // dropdown and calendar. MySQL's unique index treats multiple NULLs
        // as distinct, so this doesn't conflict with real client/admin
        // emails.
        DB::statement("ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL");
        DB::statement("ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE users DROP COLUMN color");
        DB::statement("ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL");
        DB::statement("ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL");
    }
};

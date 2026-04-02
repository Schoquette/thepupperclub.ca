<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('superadmin','admin','client') DEFAULT 'client'");

        // Promote Sophie to superadmin
        DB::table('users')
            ->where('email', 'sophie@thepupperclub.ca')
            ->update(['role' => 'superadmin']);
    }

    public function down(): void
    {
        DB::table('users')
            ->where('role', 'superadmin')
            ->update(['role' => 'admin']);

        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin','client') DEFAULT 'client'");
    }
};

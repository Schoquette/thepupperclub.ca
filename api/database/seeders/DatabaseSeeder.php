<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Create admin user (Sophie)
        User::firstOrCreate(['email' => 'sophie@thepupperclub.ca'], [
            'name'     => 'Sophie Choquette',
            'password' => Hash::make('changeme123'),
            'role'     => 'admin',
            'status'   => 'active',
        ]);

        $this->command->info('Admin user created: sophie@thepupperclub.ca / changeme123');
        $this->command->warn('IMPORTANT: Change the admin password immediately after first login!');
    }
}

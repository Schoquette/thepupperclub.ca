<?php
// Secret migration runner — visit /api/migrate.php?key=YOUR_SECRET to run migrations
// Delete this file after initial setup for security

$secret = 'pupper-migrate-2026';

if (($_GET['key'] ?? '') !== $secret) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "<pre>\n";

// Run migrations
echo "Running migrations...\n";
Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
echo Illuminate\Support\Facades\Artisan::output();

// Run seeder
echo "\nRunning seeder...\n";
Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
echo Illuminate\Support\Facades\Artisan::output();

echo "\nDone!\n";
echo "</pre>";

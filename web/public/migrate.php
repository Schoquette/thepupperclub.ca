<?php
// Secret migration runner — visit /migrate.php?key=YOUR_SECRET to run migrations
// Delete this file after initial setup for security
error_reporting(E_ALL);
ini_set('display_errors', '1');

$secret = 'pupper-migrate-2026';

if (($_GET['key'] ?? '') !== $secret) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

// Path to the api/ directory (sibling folder on server)
$apiPath = __DIR__ . '/api';

// Check vendor exists
if (!file_exists($apiPath . '/vendor/autoload.php')) {
    echo "<pre>ERROR: vendor/autoload.php not found at $apiPath/vendor/\n";
    echo "Composer dependencies have not been installed.\n</pre>";
    exit;
}

require $apiPath . '/vendor/autoload.php';

$app = require_once $apiPath . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "<pre>\n";

// Run migrations
echo "Running migrations...\n";
try {
    Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    echo Illuminate\Support\Facades\Artisan::output();
} catch (\Exception $e) {
    echo "Migration error: " . $e->getMessage() . "\n";
}

// Run seeder
echo "\nRunning seeder...\n";
try {
    Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
    echo Illuminate\Support\Facades\Artisan::output();
} catch (\Exception $e) {
    echo "Seeder error: " . $e->getMessage() . "\n";
}

echo "\nDone!\n";
echo "</pre>";

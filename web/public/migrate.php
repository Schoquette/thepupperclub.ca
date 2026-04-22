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

// Create required storage directories if they don't exist
$storageDirs = [
    $apiPath . '/storage',
    $apiPath . '/storage/logs',
    $apiPath . '/storage/app',
    $apiPath . '/storage/app/public',
    $apiPath . '/storage/app/documents',
    $apiPath . '/storage/app/templates',
    $apiPath . '/storage/app/photos',
    $apiPath . '/storage/framework',
    $apiPath . '/storage/framework/cache',
    $apiPath . '/storage/framework/cache/data',
    $apiPath . '/storage/framework/sessions',
    $apiPath . '/storage/framework/views',
    $apiPath . '/bootstrap/cache',
];

echo "<pre>\n";
echo "=== Storage Directory Setup ===\n";
foreach ($storageDirs as $dir) {
    if (!is_dir($dir)) {
        if (@mkdir($dir, 0775, true)) {
            echo "Created: " . basename(dirname($dir)) . '/' . basename($dir) . "\n";
        } else {
            echo "FAILED to create: $dir\n";
        }
    } else {
        echo "Exists: " . basename(dirname($dir)) . '/' . basename($dir) . "\n";
    }
}
echo "\n";

// Check vendor exists
if (!file_exists($apiPath . '/vendor/autoload.php')) {
    echo "ERROR: vendor/autoload.php not found at $apiPath/vendor/\n";
    echo "Composer dependencies have not been installed.\n</pre>";
    exit;
}

require $apiPath . '/vendor/autoload.php';

$app = require_once $apiPath . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "PHP version: " . phpversion() . "\n";
echo "DB connection: " . config('database.default') . "\n\n";

// Check for ?fresh=1 to do a full reset
$fresh = ($_GET['fresh'] ?? '') === '1';

if ($fresh) {
    echo "=== FRESH MIGRATION (dropping all tables) ===\n";
    try {
        Illuminate\Support\Facades\Artisan::call('migrate:fresh', ['--force' => true, '--seed' => true]);
        echo Illuminate\Support\Facades\Artisan::output();
    } catch (\Exception $e) {
        echo "Error: " . $e->getMessage() . "\n";
    }
} else {
    echo "=== Running migrations ===\n";
    try {
        Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        echo Illuminate\Support\Facades\Artisan::output();
    } catch (\Exception $e) {
        echo "Migration error: " . $e->getMessage() . "\n";
    }

    echo "\n=== Running seeder ===\n";
    try {
        Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
        echo Illuminate\Support\Facades\Artisan::output();
    } catch (\Exception $e) {
        echo "Seeder error: " . $e->getMessage() . "\n";
    }
}

echo "\nDone!\n";
echo "</pre>";

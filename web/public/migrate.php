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

// Show available database drivers
echo "Available PDO drivers: " . implode(', ', PDO::getAvailableDrivers()) . "\n";
echo "PHP version: " . phpversion() . "\n\n";

// Test raw PDO connection to diagnose attribute issues
echo "Testing raw SQL Server connection...\n";
try {
    $host = env('DB_HOST');
    $port = env('DB_PORT', '1433');
    $db = env('DB_DATABASE');
    $dsn = "sqlsrv:Server={$host},{$port};Database={$db};Encrypt=no;TrustServerCertificate=yes";
    $pdo = new PDO($dsn, env('DB_USERNAME'), env('DB_PASSWORD'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "Raw PDO connection: SUCCESS\n";
    $pdo = null;
} catch (\Exception $e) {
    echo "Raw PDO connection failed: " . $e->getMessage() . "\n";
}

// Test which PDO attributes cause issues
echo "\nTesting PDO attributes...\n";
$attrs = [
    'ATTR_CASE' => PDO::ATTR_CASE,
    'ATTR_ERRMODE' => PDO::ATTR_ERRMODE,
    'ATTR_ORACLE_NULLS' => PDO::ATTR_ORACLE_NULLS,
    'ATTR_STRINGIFY_FETCHES' => PDO::ATTR_STRINGIFY_FETCHES,
];
foreach ($attrs as $name => $attr) {
    try {
        $pdo = new PDO($dsn, env('DB_USERNAME'), env('DB_PASSWORD'));
        $pdo->setAttribute($attr, $attr === PDO::ATTR_ERRMODE ? PDO::ERRMODE_EXCEPTION : ($attr === PDO::ATTR_CASE ? PDO::CASE_NATURAL : ($attr === PDO::ATTR_ORACLE_NULLS ? PDO::NULL_NATURAL : false)));
        echo "  $name: OK\n";
        $pdo = null;
    } catch (\Exception $e) {
        echo "  $name: FAILED - " . $e->getMessage() . "\n";
    }
}
echo "\n";

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

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
$apiPath = realpath(__DIR__ . '/api') ?: __DIR__ . '/api';

// Also try parent-level api/ if the above doesn't exist
if (!is_dir($apiPath)) {
    $apiPath = realpath(__DIR__ . '/../api') ?: __DIR__ . '/../api';
}

echo "<pre>\n";
echo "=== Diagnostics ===\n";
echo "Document root: " . __DIR__ . "\n";
echo "API path: $apiPath\n";
echo "API dir exists: " . (is_dir($apiPath) ? 'YES' : 'NO') . "\n";
echo "API dir writable: " . (is_writable($apiPath) ? 'YES' : 'NO') . "\n";
if (is_dir($apiPath . '/storage')) {
    echo "storage/ writable: " . (is_writable($apiPath . '/storage') ? 'YES' : 'NO') . "\n";
    echo "storage/app/ writable: " . (is_dir($apiPath . '/storage/app') ? (is_writable($apiPath . '/storage/app') ? 'YES' : 'NO') : 'dir missing') . "\n";
    echo "storage/framework/ writable: " . (is_dir($apiPath . '/storage/framework') ? (is_writable($apiPath . '/storage/framework') ? 'YES' : 'NO') : 'dir missing') . "\n";
}
echo "PHP SAPI: " . php_sapi_name() . "\n";
echo "PHP user: " . (function_exists('get_current_user') ? get_current_user() : 'unknown') . "\n";
echo "\n";

// Create required storage directories if they don't exist
$storageDirs = [
    'storage',
    'storage/logs',
    'storage/app',
    'storage/app/public',
    'storage/app/documents',
    'storage/app/templates',
    'storage/app/photos',
    'storage/framework',
    'storage/framework/cache',
    'storage/framework/cache/data',
    'storage/framework/sessions',
    'storage/framework/views',
    'bootstrap/cache',
];

echo "=== Storage Directory Setup ===\n";

// Save current dir and move into api/ so mkdir uses relative paths
// (works around Windows absolute-path permission issues)
$origDir = getcwd();
chdir($apiPath);

foreach ($storageDirs as $relDir) {
    $full = $apiPath . '/' . $relDir;
    if (is_dir($full)) {
        echo "Exists: $relDir\n";
        continue;
    }
    // Try mkdir with recursive flag (no explicit permissions on Windows)
    $ok = @mkdir($full, 0777, true);
    if (!$ok) {
        // Fallback: try creating via shell on Windows
        $winPath = str_replace('/', '\\', $full);
        @exec("mkdir \"$winPath\" 2>&1", $out, $code);
        $ok = is_dir($full);
    }
    echo ($ok ? "Created: $relDir" : "FAILED: $relDir") . "\n";
    // Drop a .gitkeep so the dir persists in deploys
    if ($ok) {
        @file_put_contents($full . '/.gitkeep', '');
    }
}

chdir($origDir);
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

// Modes: ?clean=1 (fresh + admin only), ?fresh=1 (fresh + test data), default (incremental + seed)
$clean = ($_GET['clean'] ?? '') === '1';
$fresh = ($_GET['fresh'] ?? '') === '1';

if ($clean || $fresh) {
    echo "=== FRESH MIGRATION (dropping all tables) ===\n";
    try {
        // Run migrate:fresh WITHOUT --seed so we control seeding separately
        Illuminate\Support\Facades\Artisan::call('migrate:fresh', ['--force' => true]);
        echo Illuminate\Support\Facades\Artisan::output();
    } catch (\Exception $e) {
        echo "Error: " . $e->getMessage() . "\n";
    }

    if ($clean) {
        // Admin-only: just create the admin user
        echo "\n=== Creating admin user only (clean start) ===\n";
        try {
            $admin = \App\Models\User::firstOrCreate(['email' => 'sophie@thepupperclub.ca'], [
                'name'     => 'Sophie Choquette',
                'password' => \Illuminate\Support\Facades\Hash::make('changeme123'),
                'role'     => 'superadmin',
                'status'   => 'active',
            ]);
            echo "Admin created: {$admin->email} (id: {$admin->id})\n";
        } catch (\Exception $e) {
            echo "Error creating admin: " . $e->getMessage() . "\n";
        }
    } else {
        // fresh=1: seed with test data
        echo "\n=== Running seeder (test data) ===\n";
        try {
            Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
            echo Illuminate\Support\Facades\Artisan::output();
        } catch (\Exception $e) {
            echo "Seeder error: " . $e->getMessage() . "\n";
        }
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

// ── Quick data check ──
echo "\n=== Data Check ===\n";
try {
    $users = \Illuminate\Support\Facades\DB::table('users')->count();
    $clients = \Illuminate\Support\Facades\DB::table('users')->where('role', 'client')->count();
    $dogs = \Illuminate\Support\Facades\DB::table('dogs')->count();
    $profiles = \Illuminate\Support\Facades\DB::table('client_profiles')->count();
    echo "Users: $users (Clients: $clients)\n";
    echo "Client Profiles: $profiles\n";
    echo "Dogs: $dogs\n";
    if ($clients === 0) {
        echo "\n⚠ NO CLIENTS FOUND — seeder may have failed.\n";
        echo "Try running again without ?fresh=1 to re-seed.\n";
    }
} catch (\Exception $e) {
    echo "Check failed: " . $e->getMessage() . "\n";
}

echo "\nDone!\n";
echo "</pre>";

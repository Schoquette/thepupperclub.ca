<?php
// GitHub Webhook Auto-Deploy
// GitHub sends a POST to this URL after each push, and this script runs git pull.

$secret = 'f1b85c1314075bc39fa51a98d465370ecce1b7f0';

// Verify the request is from GitHub
$signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$payload = file_get_contents('php://input');

if (!$signature || !$payload) {
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

$expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
if (!hash_equals($expected, $signature)) {
    http_response_code(403);
    echo 'Invalid signature';
    exit;
}

// Only deploy on push to main
$data = json_decode($payload, true);
$ref = $data['ref'] ?? '';
if ($ref !== 'refs/heads/main') {
    echo 'Not main branch, skipping.';
    exit;
}

// Run git pull from the site root
$siteRoot = realpath(__DIR__ . '/..') ?: __DIR__;

// Try common git paths on Windows
$gitPaths = ['git', 'C:\\Program Files\\Git\\bin\\git.exe', 'C:\\Program Files (x86)\\Git\\bin\\git.exe'];
$git = 'git';
foreach ($gitPaths as $path) {
    if (stripos(PHP_OS, 'WIN') !== false && $path !== 'git' && file_exists($path)) {
        $git = "\"$path\"";
        break;
    }
}

$output = [];
$code = 0;

// Pull latest code
exec("cd \"$siteRoot\" && $git pull origin main 2>&1", $output, $code);

// Log the deployment
$log = date('Y-m-d H:i:s') . " | code=$code | " . implode(' ', $output) . "\n";
@file_put_contents(__DIR__ . '/deploy.log', $log, FILE_APPEND);

header('Content-Type: text/plain');
echo "Deploy " . ($code === 0 ? "OK" : "FAILED (code $code)") . "\n";
echo implode("\n", $output);

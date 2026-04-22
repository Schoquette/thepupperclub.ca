<?php
// SPA fallback for portal routes
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Don't intercept API routes — let them pass through to Laravel
if (str_starts_with($uri, '/api/') || str_starts_with($uri, '/api')) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'API not configured. Run composer install and php artisan migrate.']);
    exit;
}

// Marketing site pages (static HTML)
$pages = [
    '/'         => 'index.html',
    '/about'    => 'about.html',
    '/services' => 'services.html',
    '/contact'  => 'contact.html',
    '/faq'      => 'faq.html',
    '/privacy'  => 'privacy.html',
    '/terms'    => 'terms.html',
];

if (isset($pages[$uri])) {
    readfile(__DIR__ . '/' . $pages[$uri]);
    exit;
}

// Everything else (login, admin, client, sign, etc.) → React app
readfile(__DIR__ . '/app.html');

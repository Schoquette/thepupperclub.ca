<?php
// SPA fallback for portal routes
header('X-Fallback-Version: 4');
header('X-Fallback-Method: ' . ($_SERVER['REQUEST_METHOD'] ?? '?'));
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// API requests reach this file in two scenarios:
//   1. The Laravel front-controller isn't deployed (genuine 404).
//   2. The IIS URL Rewrite "API Passthrough" rule didn't fire for an
//      OPTIONS preflight (Plesk/IIS edge case we hit in production). We
//      answer those CORS preflights here with the right Access-Control-*
//      headers so the browser allows the follow-up POST/GET, which DOES
//      route through to Laravel and gets Laravel's own CORS middleware.
if (str_starts_with($uri, '/api/') || str_starts_with($uri, '/api')) {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = [
            'https://thepupperclub.ca',
            'https://www.thepupperclub.ca',
            'http://localhost:5173',
            'http://localhost:5174',
        ];
        if (in_array($origin, $allowed, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
            header('Access-Control-Max-Age: 86400');
            header('Vary: Origin');
        }
        http_response_code(204);
        exit;
    }
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'API not configured. Run composer install and php artisan migrate.']);
    exit;
}

// Marketing site pages (static HTML).
$pages = [
    '/'         => 'index.html',
    '/about'    => 'about.html',
    '/services' => 'services.html',
    '/contact'  => 'contact.html',
    '/faq'      => 'faq.html',
    '/privacy'  => 'privacy.html',
    '/terms'    => 'terms.html',

    // Community sub-brand. /community and /community/ are served by IIS
    // directly via the directory's index.html (community/index.html).
    // These nested routes need an explicit map because the rewrite rule
    // only fires for paths that aren't files OR directories.
    '/community/verification-complete'  => 'community/verification-complete.html',
    '/community/verification-complete/' => 'community/verification-complete.html',
    '/community/early-access'           => 'community/early-access.html',
    '/community/early-access/'          => 'community/early-access.html',
];

if (isset($pages[$uri])) {
    readfile(__DIR__ . '/' . $pages[$uri]);
    exit;
}

// SEO files
$seoFiles = [
    '/robots.txt'  => 'robots.txt',
    '/sitemap.xml' => 'sitemap.xml',
    '/google963925999d6d5da9.html' => 'google963925999d6d5da9.html',
];

if (isset($seoFiles[$uri])) {
    $ext = pathinfo($seoFiles[$uri], PATHINFO_EXTENSION);
    $types = ['xml' => 'application/xml', 'html' => 'text/html', 'txt' => 'text/plain'];
    header('Content-Type: ' . ($types[$ext] ?? 'text/plain'));
    readfile(__DIR__ . '/' . $seoFiles[$uri]);
    exit;
}

// Community member app — a separate React SPA, deployed at /community/app/.
// Any nested route under that prefix that isn't a real file (e.g.
// /community/app/sign-in, /community/app/discover) should serve the SPA's
// index.html and let client-side routing take over.
if (str_starts_with($uri, '/community/app')) {
    $appIndex = __DIR__ . '/community/app/index.html';
    if (is_file($appIndex)) {
        readfile($appIndex);
        exit;
    }
}

// Everything else (login, admin, client, sign, etc.) → main React portal
readfile(__DIR__ . '/app.html');

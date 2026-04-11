<?php
// SPA fallback for portal routes — serve app.html for React Router paths
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Marketing site pages (static HTML)
$pages = [
    '/'         => 'index.html',
    '/about'    => 'about.html',
    '/services' => 'services.html',
    '/contact'  => 'contact.html',
    '/faq'      => 'faq.html',
];

if (isset($pages[$uri])) {
    readfile(__DIR__ . '/' . $pages[$uri]);
    exit;
}

// Everything else (login, admin, client, sign, etc.) → React app
readfile(__DIR__ . '/app.html');

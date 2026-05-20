<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_filter(array_map(
        fn($d) => str_starts_with($d, 'http') ? $d : null,
        explode(',', env(
            'CORS_ALLOWED_ORIGINS',
            // Defaults cover production (apex + www) plus the common
            // local-dev ports for the web portal and the community app.
            'https://thepupperclub.ca,https://www.thepupperclub.ca,http://localhost:5173,http://localhost:5174'
        ))
    )),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];

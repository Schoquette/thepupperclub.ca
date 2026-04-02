<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_filter(array_map(
        fn($d) => str_starts_with($d, 'http') ? $d : null,
        explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:5174'))
    )),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];

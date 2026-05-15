<?php

return [

    'defaults' => [
        'guard' => 'web',
        'passwords' => 'users',
    ],

    'guards' => [
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],
        'sanctum' => [
            'driver' => 'sanctum',
            'provider' => 'users',
        ],
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => App\Models\User::class,
        ],
    ],

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => 'password_reset_tokens',
            'expire' => 10080, // 7 days (in minutes) — gives invited clients time to set their password
            'throttle' => 60,
        ],

        // Short-lived broker used for the forgot-password / admin-initiated
        // password reset flow. Invitations stay on the `users` broker so new
        // clients keep their 7-day window to set a password.
        'password-resets' => [
            'provider' => 'users',
            'table' => 'password_reset_tokens',
            'expire' => 240, // 4 hours
            'throttle' => 60,
        ],
    ],

    'password_timeout' => 10800,

];

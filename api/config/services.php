<?php

return [
    'mailgun' => [
        'domain'   => env('MAILGUN_DOMAIN'),
        'secret'   => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme'   => 'https',
    ],
    'resend' => [
        'key'             => env('RESEND_API_KEY', env('MAIL_PASSWORD')),
        'inbound_address' => env('RESEND_INBOUND_ADDRESS'), // e.g. reply@thepupperclub.ca
    ],
    'stripe' => [
        'key'             => env('STRIPE_KEY'),
        'secret'          => env('STRIPE_SECRET'),
        'webhook_secret'  => env('STRIPE_WEBHOOK_SECRET'),
    ],

    'google' => [
        'maps_api_key' => env('GOOGLE_MAPS_API_KEY'),
    ],

    'twilio' => [
        'sid'         => env('TWILIO_SID'),
        'auth_token'  => env('TWILIO_AUTH_TOKEN'),
        'from_number' => env('TWILIO_FROM_NUMBER'),
    ],

    'frontend_url' => env('FRONTEND_URL', 'https://thepupperclub.ca'),
];

<?php

return [

    // GoDaddy's env panel can inject trailing non-breaking spaces (same issue
    // fixed for MAIL_MAILER in config/mail.php) — an untrimmed value like
    // "America/Vancouver " fails date_default_timezone_set() silently
    // and PHP falls back to UTC, making now() run hours ahead of Pacific.
    'timezone' => trim(env('APP_TIMEZONE', 'America/Vancouver')) ?: 'America/Vancouver',

];

<?php

return [

    // GoDaddy's env panel can inject invisible non-breaking-space characters
    // around saved values (same class of issue as MAIL_MAILER in
    // config/mail.php). Plain trim() does not strip those, so a corrupted
    // value survives trim() unchanged, date_default_timezone_set() then
    // fails silently, and PHP falls back to UTC -- confirmed live via
    // error_logs timestamps recording raw UTC instead of Pacific, which
    // surfaced as the admin Dashboard's "Today's Walks" showing tomorrow's
    // appointment once UTC rolls over in the evening. Strip any
    // whitespace-like character explicitly, then validate against PHP's
    // real timezone list so this can never silently produce an invalid
    // timezone again.
    'timezone' => (function () {
        $raw = env('APP_TIMEZONE', 'America/Vancouver');
        $clean = preg_replace('/[\x{00A0}\x{200B}\s]+/u', '', (string) $raw);
        return in_array($clean, timezone_identifiers_list(), true) ? $clean : 'America/Vancouver';
    })(),

];

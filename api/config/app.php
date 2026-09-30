<?php

return [

    // Hardcoded rather than read from APP_TIMEZONE: GoDaddy's env panel
    // value was found to be genuinely set to "UTC" in production (not
    // corrupted whitespace as first suspected -- confirmed via a raw-byte
    // dump of the env value), which silently ran the whole app on UTC and
    // surfaced as the admin Dashboard's "Today's Walks" showing tomorrow's
    // appointment once UTC rolled over in the evening. This app only ever
    // serves one business in one timezone, so stop depending on GoDaddy's
    // env panel for this and hardcode it.
    'timezone' => 'America/Vancouver',

];

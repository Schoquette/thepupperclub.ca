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
    //
    // Fixed UTC-7 offset, not the DST-aware "America/Vancouver" zone: BC
    // did not fall back for the 2026 autumn DST change, so the region is
    // no longer actually on standard "Pacific Time" as that zone defines
    // it -- using the DST-aware zone here would make now()/Carbon::now()
    // one hour behind true local time (check-in/departure timestamps,
    // "today" boundaries, the calendar's current-time indicator) for as
    // long as this holds. Revisit if/when the region resumes normal DST
    // observance.
    'timezone' => 'Etc/GMT+7',

];

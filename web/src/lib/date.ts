const TZ = 'America/Vancouver';

/** Today's date as YYYY-MM-DD in Pacific Time. */
export const todayPacific = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: TZ });

/** Format a Date as YYYY-MM-DD in Pacific Time (avoids UTC-date-shifting). */
export const toDateStrPacific = (d: Date): string =>
  d.toLocaleDateString('en-CA', { timeZone: TZ });

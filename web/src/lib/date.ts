// Fixed UTC-7 offset, not the DST-aware 'America/Vancouver' zone: BC did
// not fall back for the 2026 autumn DST change, so the region is no
// longer actually on standard "Pacific Time" as that zone defines it.
// Using the DST-aware zone here would read one hour behind true local
// time for as long as this holds. Mirrors api/config/app.php's
// 'Etc/GMT+7'. Revisit if/when the region resumes normal DST observance.
export const PACIFIC_TZ = 'Etc/GMT+7';
const TZ = PACIFIC_TZ;

/** Today's date as YYYY-MM-DD in current Vancouver local time. */
export const todayPacific = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: TZ });

/** Format a Date as YYYY-MM-DD in current Vancouver local time (avoids UTC-date-shifting). */
export const toDateStrPacific = (d: Date): string =>
  d.toLocaleDateString('en-CA', { timeZone: TZ });

/** The current instant, as a Date whose local getters/date-fns formatting
 *  reflect current Vancouver local time regardless of the viewing device's
 *  own timezone or DST state. Use this (not `new Date()`) wherever the UI
 *  needs "now" for today/current-time logic -- greying out past slots,
 *  default-selecting today, etc. */
export const nowPacific = (): Date => {
  const now = new Date();
  const fixedOffsetMs = 7 * 60 * 60 * 1000;
  const browserOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - fixedOffsetMs + browserOffsetMs);
};

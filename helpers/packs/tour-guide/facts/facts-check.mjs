/**
 * Place facts — staleness and disagreement with Google's hours. Pure: `now` and Google's hours are arguments.
 *   factsStale(facts, now, timeZone?) → { facts, menu, any, facts_age_days, menu_age_days }
 *   dateOf(now, timeZone?) → 'YYYY-MM-DD' (Phase 13, A15: the local day in `timeZone`; without one, the UTC day as before)
 *   factsConflict(facts, googleHours, date) → { conflict, items: [{ kind, own, google, text }] }
 * Google's hours use the shapes gems/gems-hours.mjs reads (periods, the snapshot's hours, or a by_date map).
 */
import { isDate, daysBetween, weekdayOf, fromMinutes, toMinutes, WEEKDAY_NAMES } from '../schemas/tour-guide-dates.mjs';
import { openWindows } from '../gems/gems-hours.mjs';

/** Facts older than this many days are stale (opening times and booking rules change with the season). */
export const FACTS_MAX_AGE_DAYS = 90;
/** A menu check older than this many days is stale (menus change more often than hours). */
export const MENU_MAX_AGE_DAYS = 30;
/** Own and Google closing times this close (minutes) are the same time. */
export const CLOSE_TOLERANCE_MINUTES = 15;

/**
 * dateOf(now, timeZone?) → 'YYYY-MM-DD' from a Date, an ISO timestamp or a date string. A Date or a timestamp gives its
 * day in `timeZone` (an IANA zone, e.g. the trip's or the owner's); without a zone, its UTC day (as before Phase 13).
 * A calendar date is returned as it is. An unknown zone throws.
 */
export function dateOf(now, timeZone) {
  const zoned = (t) => (timeZone == null ? new Date(t).toISOString().slice(0, 10) : localDay(t, timeZone));
  if (now instanceof Date && Number.isFinite(now.getTime())) return zoned(now.getTime());
  const s = String(now ?? '');
  if (isDate(s)) return s;
  const t = Date.parse(s);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && Number.isFinite(t)) return zoned(t);
  throw new Error(`facts: now must be a Date, an ISO timestamp or YYYY-MM-DD (got ${JSON.stringify(now)})`);
}
function localDay(t, timeZone) {
  let fmt;
  try { fmt = new Intl.DateTimeFormat('en-US', { timeZone: String(timeZone), year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { throw new Error(`facts: not a time zone: ${JSON.stringify(timeZone)}`); }
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** factsStale(facts, now, timeZone?) → which parts are past their age (an unknown check date counts as stale); `now`'s day in timeZone (A15). */
export function factsStale(facts, now, timeZone) {
  const today = dateOf(now, timeZone);
  const age = (d) => (isDate(d) ? daysBetween(d, today) : null);
  const facts_age_days = age(facts && facts.checked);
  const menu_age_days = facts && facts.menu ? age(facts.menu.checked) : null;
  const factsOld = facts_age_days === null || facts_age_days > FACTS_MAX_AGE_DAYS;
  const menuOld = !!(facts && facts.menu) && (menu_age_days === null || menu_age_days > MENU_MAX_AGE_DAYS);
  return { facts: factsOld, menu: menuOld, any: factsOld || menuOld, facts_age_days, menu_age_days };
}

/**
 * factsConflict(facts, googleHours, date) → where the place's own facts and Google's hours disagree on that date:
 *   closed_day   — own facts say closed that weekday, Google shows it open
 *   google_closed — Google shows it closed, own facts list closed weekdays that do not include it
 *   close_time   — own closing time and Google's last closing time differ by more than CLOSE_TOLERANCE_MINUTES
 *   last_entry_after_close — own last entry is at or after Google's last closing time
 * Unknown Google hours never conflict. The planner trusts the place's own facts and shows `text` as an info warning.
 * Phase 13 (B7): a place whose own site says it opens on irregular or posted days (`facts.irregular: true`) raises no
 * closed_day item.
 */
export function factsConflict(facts, googleHours, date) {
  if (!isDate(date)) throw new Error(`facts: date must be YYYY-MM-DD (got ${JSON.stringify(date)})`);
  const items = [];
  const windows = facts ? openWindows(googleHours, date) : null;
  if (!facts || windows === null) return { conflict: false, items };
  const day = weekdayOf(date), dayName = WEEKDAY_NAMES[day];
  const ownClosed = Array.isArray(facts.closed_weekdays) && facts.closed_weekdays.includes(day);
  if (ownClosed && windows.length && facts.irregular !== true) {   // C13: a place whose days vary has no fixed closed day
    items.push({ kind: 'closed_day', own: 'closed', google: 'open', text: `Its own site says it is closed on ${dayName}s; Google shows it open` });
    return { conflict: true, items };
  }
  if (!windows.length) {
    if (Array.isArray(facts.closed_weekdays) && !ownClosed) items.push({ kind: 'google_closed', own: 'open', google: 'closed', text: `Google shows it closed on ${dayName}s; its own site does not` });
    return { conflict: items.length > 0, items };
  }
  const gClose = Math.max(...windows.map((w) => w.close));
  const own = toMinutes(facts.close);
  if (own !== null && Math.abs(own - gClose) > CLOSE_TOLERANCE_MINUTES) {
    items.push({ kind: 'close_time', own: facts.close, google: fromMinutes(gClose === 1440 ? 1439 : gClose), text: `Its own site says it closes at ${facts.close}; Google says ${gClose >= 1440 ? 'midnight' : fromMinutes(gClose)}` });
  }
  const last = toMinutes(facts.last_entry);
  if (last !== null && last >= gClose) {
    items.push({ kind: 'last_entry_after_close', own: facts.last_entry, google: fromMinutes(gClose === 1440 ? 1439 : gClose), text: `Its own site gives last entry at ${facts.last_entry}, after Google's closing time` });
  }
  return { conflict: items.length > 0, items };
}

// Developed by: LightAISolutions

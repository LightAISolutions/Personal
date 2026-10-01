/**
 * Tour Guide — calendar and clock helpers shared by the schema checks, the Later lists and the fixtures.
 * Dates are 'YYYY-MM-DD' (calendar dates, no time zone), clock times 'HH:MM' in the trip's time zone.
 * Night rule (data contract v1): lodging covers the nights [from, to); the last trip date, when no lodging covers its
 * night, belongs to the lodging checked out that day (to === end_date).
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/** isDate('2027-02-30') → false (a real calendar date, not just the pattern). */
export function isDate(s) {
  const m = DATE_RE.exec(String(s));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
const dayNumber = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / 86400000);
/** addDays('2027-05-12', 1) → '2027-05-13' */
export function addDays(date, n) { return new Date((dayNumber(date) + n) * 86400000).toISOString().slice(0, 10); }
/** daysBetween('2027-05-12', '2027-05-14') → 2 */
export function daysBetween(a, b) { return dayNumber(b) - dayNumber(a); }
/** dateRange(start, end) → every date from start to end inclusive ([] when end < start). */
export function dateRange(start, end) {
  const out = [];
  for (let i = 0, n = daysBetween(start, end); i <= n; i++) out.push(addDays(start, i));
  return out;
}
/** weekdayOf('2027-05-12') → 0 = Sunday … 6 = Saturday (Google's `day`). */
export function weekdayOf(date) { return new Date(date + 'T00:00:00Z').getUTCDay(); }
export const WEEKDAY_NAMES = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

/** toMinutes('09:30') → 570; '24:00' → 1440; null when malformed. */
export function toMinutes(t) {
  const m = TIME_RE.exec(String(t));
  if (!m || +m[2] > 59 || +m[1] > 24 || (+m[1] === 24 && +m[2] !== 0)) return null;
  return +m[1] * 60 + +m[2];
}
/** fromMinutes(570) → '09:30' (wraps past midnight). */
export function fromMinutes(min) {
  const x = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
}

/** tripDates(trip) → [start_date … end_date]. */
export function tripDates(trip) { return dateRange(trip.start_date, trip.end_date); }

/** lodgingsForNight(trip, date) → the lodgings covering the night of `date` (normally exactly one). */
export function lodgingsForNight(trip, date) {
  const all = Array.isArray(trip.lodging) ? trip.lodging : [];
  const hit = all.filter((l) => l.from <= date && date < l.to);
  if (hit.length || date !== trip.end_date) return hit;
  return all.filter((l) => l.to === date && l.from < date);
}
/** lodgingForNight(trip, date) → the one lodging covering that night, or null when none or several do. */
export function lodgingForNight(trip, date) {
  const hit = lodgingsForNight(trip, date);
  return hit.length === 1 ? hit[0] : null;
}
/** dayLodgings(trip, date) → { start, end }: the day starts where the previous night was spent (the first day: that night's lodging) and ends at that night's lodging. */
export function dayLodgings(trip, date) {
  const end = lodgingForNight(trip, date);
  const start = date === trip.start_date ? end : lodgingForNight(trip, addDays(date, -1));
  return { start, end };
}

// Developed by: LightAISolutions

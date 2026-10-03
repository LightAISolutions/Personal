/**
 * Tour Guide planner — clock and calendar helpers. Wall-clock values are minutes from the date's midnight in the
 * trip's time zone (HH:MM on the wire); ISO instants are produced only where the Routes API wants a departure time.
 */
const TIME_RE = /^(\d{2}):(\d{2})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** '09:30' → 570. */
export function toMin(s) {
  const m = TIME_RE.exec(String(s || ''));
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error(`planner: bad time "${s}" (HH:MM)`);
  return +m[1] * 60 + +m[2];
}
/** 570 → '09:30'; values past midnight wrap (a return leg after 24:00 shows the next day's clock). */
export function hm(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
export function isDate(s) { return DATE_RE.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s; }
/** 0 = Sunday … 6 = Saturday, as Google's `periods[].open.day`. A calendar date's weekday does not depend on the zone. */
export function weekdayOf(date) { return new Date(date + 'T00:00:00Z').getUTCDay(); }
const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/**
 * dayDate('2027-05-12') → 'Wed 12 May': a date in words for the owner, the format of the Telegram day card
 * (tgCmdDate in gas/10_commands.js, Utilities.formatDate 'EEE d MMM'; fixed English names, as Apps Script prints them).
 * Never longer than the YYYY-MM-DD it replaces. Anything that is not a real date comes back unchanged.
 */
export function dayDate(date) {
  if (!isDate(date)) return date;
  const d = new Date(date + 'T00:00:00Z');
  return `${DAY3[d.getUTCDay()]} ${d.getUTCDate()} ${MON3[d.getUTCMonth()]}`;
}
export function addDays(date, n) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function dateRange(start, end) { const out = []; for (let d = start; d <= end; d = addDays(d, 1)) out.push(d); return out; }
export function assertTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { throw new Error(`planner: unknown time zone "${tz}"`); }
  return tz;
}
function offsetMinutes(utcMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs));
  const g = (t) => +parts.find((p) => p.type === t).value;
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - utcMs) / 60000);
}
/** localToIso('2027-05-03', 570, 'Europe/Paris') → the ISO instant of 09:30 local on that date (DST-safe, two passes). */
export function localToIso(date, minutes, tz) {
  const [y, mo, d] = date.split('-').map(Number);
  const naive = Date.UTC(y, mo - 1, d) + Math.round(minutes) * 60000;
  let utc = naive - offsetMinutes(naive, tz) * 60000;
  const off2 = offsetMinutes(utc, tz);
  if (naive - off2 * 60000 !== utc) utc = naive - off2 * 60000;
  return new Date(utc).toISOString();
}
/** Calendar date of an instant in a zone, 'YYYY-MM-DD'. */
export function dateIn(now, tz) { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)); }

// Developed by: LightAISolutions

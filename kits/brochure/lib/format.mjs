/**
 * Brochure kit — dates, times and durations. Model dates are plain `YYYY-MM-DD` strings and times plain `HH:MM`
 * (the trip's local wall clock); nothing here touches the machine time zone, so a render is reproducible anywhere.
 */
const DAY = 86400000;

export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) || d.getUTCDate() !== +m[3] ? null : d;
}
export function parseTime(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return +m[1] * 60 + +m[2];
}
/** Whole days from a to b inclusive (both `YYYY-MM-DD`); null when either is invalid. */
export function daySpan(a, b) {
  const x = parseDate(a), y = parseDate(b);
  return x && y ? Math.round((y - x) / DAY) + 1 : null;
}
export function addDays(s, n) {
  const d = parseDate(s);
  if (!d) return null;
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
}
function fmt(d, locale, opts) { return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts }).format(d); }

/** 'Thursday, November 12, 2026' (en-US) — long form for the cover and day headers. */
export function longDate(s, locale = 'en-US') {
  const d = parseDate(s); return d ? fmt(d, locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : String(s || '');
}
/** 'Thu 12 Nov' — compact, for columns and folios. */
export function shortDate(s, locale = 'en-US') {
  const d = parseDate(s); return d ? fmt(d, locale, { weekday: 'short', month: 'short', day: 'numeric' }) : String(s || '');
}
export function weekday(s, locale = 'en-US', width = 'long') {
  const d = parseDate(s); return d ? fmt(d, locale, { weekday: width }) : '';
}
export function monthDay(s, locale = 'en-US') {
  const d = parseDate(s); return d ? fmt(d, locale, { month: 'long', day: 'numeric' }) : String(s || '');
}
/** '12–14 November 2026' or '28 November – 2 December 2026' (en-US order: 'November 12–14, 2026'). */
export function dateRange(a, b, locale = 'en-US') {
  const x = parseDate(a), y = parseDate(b);
  if (!x || !y) return [a, b].filter(Boolean).join(' – ');
  try { return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }).formatRange(x, y); }
  catch { return longDate(a, locale) + ' – ' + longDate(b, locale); }
}
/** `HH:MM` → { text: '9:30', suffix: 'am' } for en-US locales, { text: '09:30', suffix: '' } otherwise. */
export function clock(s, locale = 'en-US') {
  const m = parseTime(s);
  if (m === null) return { text: String(s || ''), suffix: '' };
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  if (/^en-(US|CA|AU|NZ|PH)$/i.test(locale)) return { text: `${h % 12 || 12}:${mm}`, suffix: h < 12 ? 'am' : 'pm' };
  return { text: `${String(h).padStart(2, '0')}:${mm}`, suffix: '' };
}
export function clockText(s, locale) { const c = clock(s, locale); return c.suffix ? c.text + ' ' + c.suffix : c.text; }
/** 95 → '1 h 35 min'; 45 → '45 min'; 120 → '2 h'. */
export function duration(min) {
  const n = Math.round(Number(min));
  if (!Number.isFinite(n) || n <= 0) return '';
  const h = Math.floor(n / 60), m = n % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}
/** Minutes between two `HH:MM` strings (null when either is invalid or the end precedes the start). */
export function minutesBetween(a, b) {
  const x = parseTime(a), y = parseTime(b);
  return x === null || y === null || y < x ? null : y - x;
}
export function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
export function pad2(n) { return String(n).padStart(2, '0'); }
export function number(n, locale = 'en-US') { return Number.isFinite(Number(n)) ? new Intl.NumberFormat(locale).format(Number(n)) : ''; }
export function distance(m) {
  const n = Number(m); if (!Number.isFinite(n) || n <= 0) return '';
  return n < 950 ? Math.round(n / 10) * 10 + ' m' : (n / 1000).toFixed(n < 10000 ? 1 : 0) + ' km';
}

// Developed by: LightAISolutions

/**
 * Tour Guide brochure-map — the "Bookings" practical section (WP-10a, suggestion 6): the trip's booking records
 * (tour-guide-booking.schema.json) as brochure items, records still to book first (nearest deadline first), then the
 * booked ones; "not needed" records are left out. Every time is shown in the trip's zone and, when it reads differently,
 * in the owner's zone ("your time"). Plain text only — the brochure kit escapes it; links are https only.
 * Wiring into index.mjs (trip.bookings → practical) belongs to the brochure-map owner.
 */
import { clip, compact, SHORT, TEXT } from './brochure-map-text.mjs';
import { dayDate } from '../planner/planner-time.mjs';

export const BOOKINGS_TITLE = 'Bookings';
export const BOOKINGS_MAX = 30;   // PRACTICAL_LIMITS.items
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A booking instant in ms, or NaN (missing, malformed, or without an explicit offset). */
export function bookingMs(v) { return typeof v === 'string' && AT.test(v) ? Date.parse(v) : NaN; }
function zoneOk(tz) {
  if (!tz) return false;
  try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }).format(0); return true; } catch { return false; }
}
/** fmt(ms, tz, twelve) → "Tue 2 Mar 10:00" (24 h) or "Mon 1 Mar 4:00 pm" (12 h). */
export function fmtWhen(ms, tz, twelve) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hourCycle: twelve ? 'h12' : 'h23' })
    .formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  const hour = twelve ? String(Number(p.hour)) : String(p.hour).padStart(2, '0');
  return `${p.weekday} ${p.day} ${p.month} ${hour}:${p.minute}` + (twelve ? ' ' + String(p.dayPeriod || '').toLowerCase() : '');
}
/** Both times: "Tue 2 Mar 10:00 local time (Mon 1 Mar 4:00 pm your time)", or one when they read the same. */
export function bothTimes(ms, tripTz, ownerTz) {
  const there = fmtWhen(ms, tripTz, false);
  if (!ownerTz || ownerTz === tripTz || fmtWhen(ms, ownerTz, false) === there) return there;
  return `${there} local time (${fmtWhen(ms, ownerTz, true)} your time)`;
}
/** The deadline a record sorts by: book_by, else opens_at, else its day (noon UTC), else last. */
function due(b) {
  const by = bookingMs(b.book_by);
  if (Number.isFinite(by)) return by;
  const o = bookingMs(b.opens_at);
  if (Number.isFinite(o)) return o;
  return DATE.test(String(b.for_date || '')) ? Date.parse(b.for_date + 'T12:00:00Z') : Infinity;
}
function httpsUrl(u) {
  const s = typeof u === 'string' ? u.trim() : '';
  if (!s || s.length > 2000 || !/^https:\/\/[^\s/]+/i.test(s)) return undefined;
  try { return new URL(s).protocol === 'https:' ? s : undefined; } catch { return undefined; }
}
/** A day as the Telegram day card writes it ("Fri 3 Sep"; ICU's en-GB would print "Sept"). */
const dayLabel = (d) => dayDate(d);
function bookingItem(b, tripTz, ownerTz, now, plannedOn) {
  const label = clip(b.title, SHORT);
  if (!label) return undefined;
  const open = b.status !== 'booked', parts = [];
  const rule = clip([b.rule, b.how].filter((x) => clip(x)).join(' · '), TEXT);
  if (rule) parts.push(rule + '.');
  const o = bookingMs(b.opens_at), by = bookingMs(b.book_by), known = Number.isFinite(now);
  if (Number.isFinite(o)) parts.push(`${open && known && o <= now ? 'Open since' : 'Opens'} ${bothTimes(o, tripTz, ownerTz)}.`);
  if (Number.isFinite(by)) parts.push(`${open && known && by < now ? 'Was due' : 'Book by'} ${bothTimes(by, tripTz, ownerTz)}.`);
  if (DATE.test(String(b.for_date || ''))) parts.push(`For ${dayLabel(b.for_date)}.`);
  else if (!b.for_date && b.place && plannedOn && DATE.test(String(plannedOn.get(b.place) || ''))) parts.push(`Planned for ${dayLabel(plannedOn.get(b.place))}.`);
  if (b.party_min) parts.push(`At least ${b.party_min} people.`);
  parts.push(open ? 'Still to book.' : 'Booked.');
  return compact({ label, text: clip(parts.join(' '), TEXT), url: open ? httpsUrl(b.url) : undefined });
}
/**
 * bookingsSection(bookings, { tripTz, ownerTz, now }) → { title: 'Bookings', items: [{ label, text, url? }] } or null.
 * tripTz: the trip's zone (times print there first); ownerTz: the owner's zone ("your time"); now (ms or ISO, optional):
 * when given, open records say "Open since" / "Was due" for times already past; plannedOn (optional Map place → date,
 * WP-12d): a record with no date whose place is planned says "Planned for <day>.". At most BOOKINGS_MAX items.
 */
export function bookingsSection(bookings, { tripTz, ownerTz, now, plannedOn } = {}) {
  const tz = zoneOk(tripTz) ? tripTz : 'UTC', home = zoneOk(ownerTz) ? ownerTz : undefined;
  const t = typeof now === 'string' ? Date.parse(now) : (typeof now === 'number' ? now : NaN);
  const list = (Array.isArray(bookings) ? bookings : []).filter((b) => b && typeof b === 'object' && b.status !== 'not_needed');
  const rank = (b) => (b.status === 'booked' ? 1 : 0);
  const items = list.map((b, i) => ({ b, i })).sort((x, y) => rank(x.b) - rank(y.b) || due(x.b) - due(y.b) || x.i - y.i)
    .map((x) => bookingItem(x.b, tz, home, t, plannedOn instanceof Map ? plannedOn : null)).filter(Boolean).slice(0, BOOKINGS_MAX);
  return items.length ? { title: BOOKINGS_TITLE, items } : null;
}

// Developed by: LightAISolutions

/**
 * Tour Guide — Day trip: the owner's words in (TG-PHASE-15 WP-15a). Pure; no clock (today is passed in), no network.
 * The core's tgDaytripParse (gas/41_daytrip.js) mirrors parseDaytripText rule for rule; the shared case list
 * daytrip/fixtures/daytrip-parse-cases.json holds the two to one answer.
 *
 *   /daytrip [from] <place> [under <N> min|h] [on <date>]      the two trailing clauses in either order, each at most once
 *   under 45 min · under 1.5 h · under 2h · under 100          → minutes, clamped to 30–180; absent: 90
 *   on YYYY-MM-DD · on M/D (the next such date from today, today included) · on today · on tomorrow
 *   what is left, without a leading "from", is the base (1–80 characters; empty: the caller starts from where you stay)
 * → { ok: true, from, max_minutes, date | null } | { ok: false, why: 'bad_date' | 'past_date' | 'too_long' }
 * "on" followed by anything but a date stays part of the base ("Stoke on Wyvern"). The text is data: cut and cleaned,
 * never interpreted as an instruction.
 */
import { isDate, addDays } from '../schemas/tour-guide-dates.mjs';

export const MINUTES_MIN = 30;
export const MINUTES_MAX = 180;
export const MINUTES_DEFAULT = 90;
export const FROM_MAX = 80;

const UNDER_RE = /(?:^|\s+)under\s+(\d{1,3}(?:\.\d{1,2})?)\s*(min|mins|minute|minutes|m|h|hr|hrs|hour|hours)?\s*$/i;
const ON_RE = /(?:^|\s+)on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|today|tomorrow)\s*$/i;

const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const pad = (n) => (n < 10 ? '0' : '') + n;
/** Minutes from the "under" clause's number and unit, clamped to 30–180. */
export function underMinutes(num, unit) {
  const h = /^h/i.test(String(unit || ''));
  const m = Math.round(Number(num) * (h ? 60 : 1));
  return Math.min(MINUTES_MAX, Math.max(MINUTES_MIN, m));
}
/** The "on" clause's date: { date } | { why }. */
export function resolveDate(token, today) {
  const t = String(token).toLowerCase();
  if (t === 'today') return { date: today };
  if (t === 'tomorrow') return { date: addDays(today, 1) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    if (!isDate(t)) return { why: 'bad_date' };
    return t < today ? { why: 'past_date' } : { date: t };
  }
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(t);
  const y = +today.slice(0, 4);
  for (let k = 0; m && k <= 8; k++) {
    const d = (y + k) + '-' + pad(+m[1]) + '-' + pad(+m[2]);
    if (isDate(d) && d >= today) return { date: d };
  }
  return { why: 'bad_date' };
}

/** parseDaytripText(text, { today }) — see the header. */
export function parseDaytripText(text, { today } = {}) {
  if (!isDate(today)) throw new Error(`daytrip: today must be a calendar date YYYY-MM-DD (got ${JSON.stringify(today)})`);
  let s = clean(text).replace(/^\/daytrip(@[A-Za-z0-9_]+)?(\s+|$)/i, '').replace(/[?.!]+$/, '').trim();
  let max = MINUTES_DEFAULT, date = null, onDone = false, underDone = false;
  for (let i = 0; i < 2; i++) {
    let m;
    if (!onDone && (m = ON_RE.exec(s))) {
      const r = resolveDate(m[1], today);
      if (r.why) return { ok: false, why: r.why };
      date = r.date; onDone = true; s = s.slice(0, m.index).trim(); continue;
    }
    if (!underDone && (m = UNDER_RE.exec(s))) {
      max = underMinutes(m[1], m[2]); underDone = true; s = s.slice(0, m.index).trim(); continue;
    }
    break;
  }
  const from = clean(s.replace(/^from(\s+|$)/i, ''));
  if (from.length > FROM_MAX) return { ok: false, why: 'too_long' };
  return { ok: true, from, max_minutes: max, date };
}

// Developed by: LightAISolutions

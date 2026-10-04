/**
 * Tour Guide — What's on (C15, WP-15b): the owner's words after `/whatson`, read into a place and a window.
 *   parseWhatsonText(text, { today }) →
 *     { ok: true, place: string | null, from: date | null, to: date | null, dates_given: boolean }
 *     { ok: false, reason: 'past' | 'reversed' | 'too_long' | 'long_place', place: string | null }
 * `[in] [<place>] [<when>]`: the longest run of words at the end that reads as a <when> is the window. The rest, minus a
 * leading "in", is the place. <when>: today, tomorrow, this week (today to Sunday), next week (Monday to Sunday), this
 * weekend; a date (YYYY-MM-DD, M/D, 8 Jun, Jun 8); a range (<date> to <date>, <date>-<date>, <date>..<date>, 8-10 Jun,
 * Jun 8-10). A year-less date is its next occurrence from today; a year-less range end is the first on or after the start
 * (the same month and an earlier day is a reversed range). Checks in order: reversed, past (ends before today), then the
 * start is moved up to today, then too long (more than 31 days). No window given: from and to are null (the core fills
 * the defaults). gas/42_whatson.js tgWhatsonParse is the core's mirror; tests hold the two to one case list.
 */
import { isRealDate, daysBetween, addDays } from './whatson-check.mjs';

export const PLACE_MAX = 80;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad = (n) => (n < 10 ? '0' : '') + n;

/** A month word (three letters or more of an English month name) → 1–12, else 0. */
export function monthOf(w) {
  w = String(w || '').toLowerCase().replace(/\.$/, '');
  if (w.length < 3) return 0;
  for (let i = 0; i < 12; i++) if (MONTHS[i].indexOf(w) === 0) return i + 1;
  return 0;
}
/** The first real date with month m and day d on or after `ref` (a leap day may wait some years), else null. */
function onOrAfter(m, d, ref) {
  const y0 = Number(ref.slice(0, 4));
  for (let y = y0; y <= y0 + 8; y++) {
    const iso = y + '-' + pad(m) + '-' + pad(d);
    if (isRealDate(iso) && iso >= ref) return iso;
  }
  return null;
}
/** One date token → { iso } | { m, d } (year-less) | null. */
function dateToken(s) {
  let r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (r) return isRealDate(s) ? { iso: s } : null;
  r = /^(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (r) return md(Number(r[1]), Number(r[2]));
  r = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+\.?)$/.exec(s);
  if (r && monthOf(r[2])) return md(monthOf(r[2]), Number(r[1]));
  r = /^([a-z]+\.?) (\d{1,2})(?:st|nd|rd|th)?$/.exec(s);
  if (r && monthOf(r[1])) return md(monthOf(r[1]), Number(r[2]));
  return null;
}
/** A month and day that exist in some year (29 Feb does). */
function md(m, d) { return m >= 1 && m <= 12 && d >= 1 && isRealDate('2028-' + pad(m) + '-' + pad(d)) ? { m, d } : null; }
const startOf = (t, today) => (t.iso ? t.iso : onOrAfter(t.m, t.d, today));
/** A range's end: as written; year-less, the first on or after the start (same month, earlier day: kept reversed). */
function endOf(t, start) {
  if (t.iso) return t.iso;
  const cand = start.slice(0, 4) + '-' + pad(t.m) + '-' + pad(t.d);
  if (isRealDate(cand) && (cand >= start || t.m === Number(start.slice(5, 7)))) return cand;
  return onOrAfter(t.m, t.d, start);
}
function range(a, b, today) {
  const ta = dateToken(a), tb = dateToken(b);
  if (!ta || !tb) return null;
  const from = startOf(ta, today), to = from && endOf(tb, from);
  return from && to ? { from, to } : null;
}
const dow = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();   // 0 = Sunday

/** A <when> phrase (lower case, single spaces) → { from, to } as written (may be past or reversed), else null. */
function whenOf(s, today) {
  const wd = dow(today);
  if (s === 'today') return { from: today, to: today };
  if (s === 'tomorrow') return { from: addDays(today, 1), to: addDays(today, 1) };
  if (s === 'this week') return { from: today, to: addDays(today, (7 - wd) % 7) };
  if (s === 'next week') { const mon = addDays(today, (8 - wd) % 7 || 7); return { from: mon, to: addDays(mon, 6) }; }
  if (s === 'this weekend') return wd === 0 ? { from: today, to: today } : { from: addDays(today, 6 - wd), to: addDays(today, 7 - wd) };
  let r = /^(\d{1,2})\s*[-–]\s*(\d{1,2}) ([a-z]+\.?)$/.exec(s);
  if (r && monthOf(r[3])) return range(r[1] + ' ' + r[3], r[2] + ' ' + r[3], today);
  r = /^([a-z]+\.?) (\d{1,2})\s*[-–]\s*(\d{1,2})$/.exec(s);
  if (r && monthOf(r[1])) return range(r[1] + ' ' + r[2], r[1] + ' ' + r[3], today);
  const split = s.split(/ to |\s*\.\.\s*/);
  if (split.length === 2) return range(split[0].trim(), split[1].trim(), today);
  if (split.length > 2) return null;
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] !== '-' && s[i] !== '–') continue;
    const got = range(s.slice(0, i).trim(), s.slice(i + 1).trim(), today);
    if (got) return got;
  }
  const t = dateToken(s);
  if (!t) return null;
  const d = startOf(t, today);
  return d ? { from: d, to: d } : null;
}

/** parseWhatsonText(text, { today }) — see the file comment. */
export function parseWhatsonText(text, { today } = {}) {
  if (!isRealDate(today)) throw new Error('whatson: parseWhatsonText needs `today` as a calendar date');
  const words = String(text == null ? '' : text).slice(0, 300).replace(/^\s*\/whatson(@\w+)?(?=\s|$)/i, '').trim().split(/\s+/).filter(Boolean);
  let when = null, k = words.length;
  for (let i = 0; i < words.length; i++) {
    const w = whenOf(words.slice(i).join(' ').toLowerCase(), today);
    if (w) { when = w; k = i; break; }
  }
  const rest = words.slice(0, k);
  if (rest.length && rest[0].toLowerCase() === 'in') rest.shift();
  const place = rest.join(' ') || null;
  if (place && place.length > PLACE_MAX) return { ok: false, reason: 'long_place', place: null };
  if (!when) return { ok: true, place, from: null, to: null, dates_given: false };
  if (when.from > when.to) return { ok: false, reason: 'reversed', place };
  if (when.to < today) return { ok: false, reason: 'past', place };
  const from = when.from < today ? today : when.from;
  if (daysBetween(from, when.to) > 30) return { ok: false, reason: 'too_long', place };
  return { ok: true, place, from, to: when.to, dates_given: true };
}

// Developed by: LightAISolutions

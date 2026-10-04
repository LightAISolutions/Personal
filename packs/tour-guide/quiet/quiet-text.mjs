/**
 * Tour Guide — Quiet: the owner's words in (TG-PHASE-16 WP-16a). Pure; no clock (today is passed in), no network.
 * The core's tgQuietParse (gas/43_quiet.js) mirrors parseQuietText rule for rule; the shared case list
 * quiet/fixtures/quiet-parse-cases.json holds the two to one answer.
 *
 *   /quiet <place> [on <date>]
 *   on YYYY-MM-DD · on M/D (the next such date from today, today included) · on today · on tomorrow — /daytrip's date words
 *   what is left is the place, the crowd magnet in the owner's words (0–80 characters; empty: the caller lists or explains)
 * → { ok: true, place, date | null } | { ok: false, why: 'bad_date' | 'past_date' | 'too_long' }
 * "on" followed by anything but a date stays part of the place ("Stoke on Wyvern"). The text is data: cut and cleaned,
 * never interpreted as an instruction.
 */
import { isDate } from '../schemas/tour-guide-dates.mjs';
import { resolveDate } from '../daytrip/daytrip-text.mjs';

export const PLACE_MAX = 80;

const ON_RE = /(?:^|\s+)on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|today|tomorrow)\s*$/i;
const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

/** parseQuietText(text, { today }) — see the header. */
export function parseQuietText(text, { today } = {}) {
  if (!isDate(today)) throw new Error(`quiet: today must be a calendar date YYYY-MM-DD (got ${JSON.stringify(today)})`);
  let s = clean(text).replace(/^\/quiet(@[A-Za-z0-9_]+)?(\s+|$)/i, '').replace(/[?.!]+$/, '').trim();
  let date = null;
  const m = ON_RE.exec(s);
  if (m) {
    const r = resolveDate(m[1], today);
    if (r.why) return { ok: false, why: r.why };
    date = r.date;
    s = s.slice(0, m.index);
  }
  const place = clean(s);
  if (place.length > PLACE_MAX) return { ok: false, why: 'too_long' };
  return { ok: true, place, date };
}

// Developed by: LightAISolutions

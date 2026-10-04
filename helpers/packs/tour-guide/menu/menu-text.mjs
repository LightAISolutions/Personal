/**
 * Tour Guide — Menu check: the owner's words in (TG-PHASE-16 WP-16b, Contract C16). Pure; no clock (today is passed in),
 * no network. The core's tgMenuParse (gas/44_menu.js) mirrors parseMenuText rule for rule; the shared case list
 * menu/fixtures/menu-parse-cases.json holds the two to one answer.
 *
 *   /menu <restaurant> [on <date>]      "on" takes /daytrip's date words, closing the text, at most once
 *   on YYYY-MM-DD · on M/D (the next such date from today, today included) · on today · on tomorrow
 *   what is left is the restaurant, 1–80 characters
 * → { ok: true, place, date | null } | { ok: false, why: 'no_place' | 'too_long' | 'bad_date' | 'past_date' }
 * "on" followed by anything but a date stays part of the name ("Kettle on the Quay"). The text is data: cut and cleaned,
 * never interpreted as an instruction.
 */
import { isDate } from '../schemas/tour-guide-dates.mjs';
import { resolveDate } from '../daytrip/daytrip-text.mjs';

/** The longest restaurant name a request carries (C16 request kind `menu`: place 1–80). */
export const PLACE_MAX = 80;

const ON_RE = /(?:^|\s+)on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|today|tomorrow)\s*$/i;
const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

/** parseMenuText(text, { today }) — see the header. */
export function parseMenuText(text, { today } = {}) {
  if (!isDate(today)) throw new Error(`menu: today must be a calendar date YYYY-MM-DD (got ${JSON.stringify(today)})`);
  let s = clean(text).replace(/^\/menu(@[A-Za-z0-9_]+)?(\s+|$)/i, '').replace(/[?.!]+$/, '').trim();
  let date = null;
  const m = ON_RE.exec(s);
  if (m) {
    const r = resolveDate(m[1], today);
    if (r.why) return { ok: false, why: r.why };
    date = r.date;
    s = s.slice(0, m.index);
  }
  const place = clean(s);
  if (!place) return { ok: false, why: 'no_place' };
  if (place.length > PLACE_MAX) return { ok: false, why: 'too_long' };
  return { ok: true, place, date };
}

// Developed by: LightAISolutions

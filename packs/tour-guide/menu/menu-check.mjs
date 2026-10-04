/**
 * Tour Guide — Menu check: the engine (TG-PHASE-16 WP-16b, Contract C16). Pure: no clock, no network, no file. The
 * private skill's judgment step reads the restaurant's own menu and hands over the dishes; these functions turn them into
 * the place's dated menu fact and decide which dinners the check counts for.
 *   menuFits(dishes, { read, others }) → 'yes' | 'partly' | 'no' | 'unknown'
 *   menuNote({ fits, dishes, diet })   → the fact's note, ≤ 160 characters, cut at a word with "…"
 *   menuFact(payload)                  → { checked, fits, note } (the place's facts.menu)
 *   menuCaveat(note)                   → 'unchecked' | 'old' | null — dinnerMenu's two caveats in a dinner's note
 *   menuCounts(checked, date)          → true when the check counts for a dinner on `date`: made at most MAX_AGE_DAYS
 *                                        before it, so every plan built from the check up to that day counts it too
 *                                        (the planner ages a menu from the day it builds, never past the dinner)
 *   menuCountsFrom(date)               → the first date whose check counts for a dinner on `date`
 *   sortDishes(dishes)                 → by course, then `yes` before `ask`, otherwise in the menu's order
 * Defaults and their reasons: helpers/decisions/WP-16b.md.
 */
import { MENU_MAX_AGE_DAYS } from '../facts/facts-check.mjs';
import { isDate, addDays, daysBetween } from '../schemas/tour-guide-dates.mjs';

export const MENU = Object.freeze({
  DISHES: 12,             // a chat card stays one screen and the payload far under its 12 000 characters; the rest are counted
  PARTLY_MIN_SMALL: 2,    // one starter or side is a snack, not a dinner; two that fit make a meal of small plates
  NOTE_MAX: 160,          // the place schema's facts.menu.note bound
  OTHERS_MAX: 200,        // C16 `others` bound: a long menu is still counted, never listed
  SOURCES_MAX: 3          // C16 `sources` bound: the menu page itself, at most two more of the place's own pages
});
/** The courses, in the order a card lists them (C16 dish `course`). */
export const COURSES = Object.freeze(['set', 'main', 'starter', 'side', 'dessert', 'drink']);
/** A dish's answer for the party (C16 dish `fits`); a dish that does not fit is counted in `others`, never listed. */
export const DISH_FITS = Object.freeze(['yes', 'ask']);
export const FITS = Object.freeze(['yes', 'partly', 'no', 'unknown']);
/** How long a check counts before a dinner: the facts pack's MENU_MAX_AGE_DAYS, the planner's own number (Phase 13). */
export const MAX_AGE_DAYS = MENU_MAX_AGE_DAYS;
/**
 * dinnerMenu's two caveats (planner/planner-dinner.mjs) in a dinner's note: at the start, or after " · ", in any case —
 * "Salt Loft · menu not checked for vegetarian", "Menu last checked 2027-03-01". The core's TG_MENU.CAVEAT_RE
 * (gas/44_menu.js) is this pattern; a parity test holds the two to one source.
 */
export const CAVEAT_RE = /(?:^|\s·\s)menu\s+(not checked for|last checked)\s+\S/i;

const MAIN = ['set', 'main'], SMALL = ['starter', 'side'];
const list = (d) => (Array.isArray(d) ? d.filter((x) => x && typeof x === 'object') : []);

/** menuFits(dishes, { read, others }) — the first rule that applies (see the header and the brief). */
export function menuFits(dishes, { read = true, others = 0 } = {}) {
  const all = list(dishes);
  if (!read || (!all.length && !(others > 0))) return 'unknown';
  if (all.some((d) => MAIN.includes(d.course) && d.fits === 'yes')) return 'yes';
  if (all.some((d) => MAIN.includes(d.course) && d.fits === 'ask')) return 'partly';
  if (all.filter((d) => SMALL.includes(d.course) && d.fits === 'yes').length >= MENU.PARTLY_MIN_SMALL) return 'partly';
  return 'no';
}

/** cutWords(s, max) → s, or its longest start that ends at a word, without trailing punctuation, plus "…" (≤ max). */
export function cutWords(s, max) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  let head = s.slice(0, max - 1);
  const sp = head.lastIndexOf(' ');
  if (sp > 0 && s[max - 1] !== ' ') head = head.slice(0, sp);
  return head.replace(/[\s,;:·—-]+$/, '') + '…';
}

/** menuNote({ fits, dishes, diet }) → "Fits: a, b; ask: c" · "Nothing on the menu fits <diet>" · "No menu found to check". */
export function menuNote({ fits, dishes = [], diet = '' } = {}) {
  const d = String(diet ?? '').replace(/\s+/g, ' ').trim() || 'your diet';
  if (fits === 'no') return cutWords(`Nothing on the menu fits ${d}`, MENU.NOTE_MAX);
  if (fits !== 'yes' && fits !== 'partly') return 'No menu found to check';
  const names = (want) => list(dishes).filter((x) => x.fits === want).map((x) => String(x.name ?? '').trim()).filter(Boolean).join(', ');
  const parts = [];
  if (names('yes')) parts.push('Fits: ' + names('yes'));
  if (names('ask')) parts.push('ask: ' + names('ask'));
  if (!parts.length) parts.push((fits === 'yes' ? 'Fits ' : 'Partly fits ') + d);   // never from menuFits' own answer
  return cutWords(parts.join('; '), MENU.NOTE_MAX);
}

/** menuFact(payload) → the place's facts.menu: { checked, fits, note }. */
export function menuFact(p) {
  return { checked: p.checked, fits: p.fits, note: p.note };
}

/** menuCaveat(note) → 'unchecked' (menu not checked for …), 'old' (menu last checked …) or null. */
export function menuCaveat(note) {
  const m = CAVEAT_RE.exec(String(note ?? ''));
  if (!m) return null;
  return /^not/i.test(m[1]) ? 'unchecked' : 'old';
}

/** menuCounts(checked, date) → true when `checked` is at most MAX_AGE_DAYS before `date` (a later check counts too). */
export function menuCounts(checked, date) {
  if (!isDate(checked) || !isDate(date)) return false;
  return daysBetween(checked, date) <= MAX_AGE_DAYS;
}
/** menuCountsFrom(date) → the first check date that counts for a dinner on `date`. */
export function menuCountsFrom(date) {
  if (!isDate(date)) throw new Error(`menu: date must be a calendar date YYYY-MM-DD (got ${JSON.stringify(date)})`);
  return addDays(date, -MAX_AGE_DAYS);
}

/** sortDishes(dishes) → a sorted copy: course (COURSES order), then `yes` before `ask`, then the menu's own order. */
export function sortDishes(dishes) {
  const rank = (x) => { const i = COURSES.indexOf(x.course); return i < 0 ? COURSES.length : i; };
  return list(dishes).map((x, i) => ({ x, i }))
    .sort((a, b) => rank(a.x) - rank(b.x) || (a.x.fits === 'ask') - (b.x.fits === 'ask') || a.i - b.i)
    .map((e) => e.x);
}

// Developed by: LightAISolutions

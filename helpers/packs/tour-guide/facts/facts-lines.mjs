/**
 * Place facts — the display lines the digest builder, the app and the brochure show (C11 digest stop fields):
 *   factsLines(facts, { now, diet }) → { facts_line?, booking_line?, price_line?, menu_checked? }   each line ≤ 160
 *   menuLine(facts, { now, diet }) → one line on the menu against the diet ('' when there is no menu check)
 * Only keys with something to say are present, so the result can be spread onto a digest stop. Words are ours; numbers
 * and names come from the place's own facts (never from Google). Deterministic for the same input.
 */
import { factsStale } from './facts-check.mjs';
import { WEEKDAY_NAMES } from '../schemas/tour-guide-dates.mjs';

export const LINE_MAX = 160;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** fitLine(clauses, sep, max) → the clauses joined, dropping whole clauses from the end until it fits; '' for none. */
export function fitLine(clauses, sep = ' · ', max = LINE_MAX) {
  const list = clauses.filter((c) => typeof c === 'string' && c.trim());
  for (let n = list.length; n > 0; n--) { const s = list.slice(0, n).join(sep); if (s.length <= max) return s; }
  return list.length ? list[0].slice(0, max - 1).trimEnd() + '…' : '';
}

/** duration(90) → '90 min'; 120 → '2 h'; 150 → '2½ h' (minutes below two hours, hours and halves from two hours). */
export function duration(m) {
  if (m < 120) return `${m} min`;
  const h = Math.round(m / 30) / 2;
  return `${Math.floor(h)}${h % 1 ? '½' : ''} h`;
}
/** visitRange({ min, max }) → 'about 60–90 min', 'about 2–3 h', 'about 90 min–2½ h', 'about 45 min'. */
export function visitRange(v) {
  if (!v) return '';
  if (v.min === v.max) return `about ${duration(v.min)}`;
  const a = duration(v.min), b = duration(v.max);
  const ua = a.split(' ')[1], ub = b.split(' ')[1];
  return ua === ub ? `about ${a.split(' ')[0]}–${b}` : `about ${a}–${b}`;
}
/** closedDays([1, 2]) → 'closed Mondays and Tuesdays'; every day → 'closed every day'. */
export function closedDays(days) {
  if (!Array.isArray(days) || !days.length) return '';
  if (days.length === 7) return 'closed every day';
  const names = days.map((d) => WEEKDAY_NAMES[d] + 's');
  return 'closed ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]);
}
const monthYear = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
/** dietWords(diet) → 'vegetarian', 'vegetarian, no pork' ('' for none). */
export function dietWords(diet) {
  const list = (Array.isArray(diet) ? diet : diet ? [diet] : []).map((x) => String(x).trim()).filter(Boolean);
  return list.join(', ').slice(0, 60);
}

function factsLineOf(f, stale) {
  const c = [];
  if (f.last_entry) c.push(`Last entry ${f.last_entry}${f.last_entry_note ? ` (${f.last_entry_note})` : ''}`);
  if (f.close) c.push(f.last_entry ? `closes ${f.close}` : `Closes ${f.close}`);
  if (f.visit_minutes) c.push(visitRange(f.visit_minutes));
  if (f.closed_weekdays && !(f.irregular === true && f.closed_weekdays.length >= 7)) c.push(closedDays(f.closed_weekdays));
  if (f.gate_name) c.push(`enter at ${f.gate_name}`);
  // C13 (B7): only a place whose own site says its days vary gets this clause, so an old place's line is unchanged
  if (f.irregular === true) {
    if (c.length) c[0] = c[0][0].toLowerCase() + c[0].slice(1);
    c.unshift(typeof f.irregular_note === 'string' && f.irregular_note.trim() ? `Opening days vary: ${f.irregular_note.trim()}` : 'Opening days vary');
  }
  if (!c.length) return '';
  const src = stale ? `official site, checked ${monthYear(f.checked)}` : 'official site';
  c[0] = c[0][0].toUpperCase() + c[0].slice(1);
  return fitLine([...c, src]);
}

function bookingLineOf(b) {
  if (!b) return '';
  const c = [];
  if (b.required === false) c.push('No booking needed');
  else if (b.required === true || b.lead || b.how) c.push(['Book', b.lead || (b.required ? 'ahead' : null), b.how].filter(Boolean).join(' '));
  if (b.party_min && b.party_min > 1) c.push(`${b.party_min} people or more`);
  if (b.text) c.push(b.text);
  return fitLine(c);
}

function fitWords(fits, diet) {
  const d = dietWords(diet);
  if (!d || fits === 'unknown') return '';
  return { yes: `menu fits ${d}`, partly: `menu partly fits ${d}`, no: `menu does not fit ${d}` }[fits] || '';
}

function priceLineOf(f, diet) {
  const c = [];
  if (f.price) c.push(f.price.includes ? `${f.price.text}, ${f.price.includes}` : f.price.text);
  if (f.payment) c.push(f.payment);
  if (f.menu && c.length) c.push(fitWords(f.menu.fits, diet));
  return fitLine(c);
}

/**
 * factsLines(facts, { now, diet, timeZone? }) — `now` (a Date, timestamp or YYYY-MM-DD; its day in `timeZone` when given,
 * Phase 13 A15) marks stale facts with their check month;
 * `diet` (a string or a list, e.g. 'vegetarian') adds the menu's fit to the price line. menu_checked is the menu check date.
 */
export function factsLines(facts, { now, diet, timeZone } = {}) {
  const out = {};
  if (!facts || typeof facts !== 'object') return out;
  const stale = now != null ? factsStale(facts, now, timeZone).facts : false;
  const fl = factsLineOf(facts, stale), bl = bookingLineOf(facts.booking), pl = priceLineOf(facts, diet);
  if (fl) out.facts_line = fl;
  if (bl) out.booking_line = bl;
  if (pl) out.price_line = pl;
  if (facts.menu && facts.menu.checked) out.menu_checked = facts.menu.checked;
  return out;
}

/** menuLine(facts, { now, diet }) → 'Menu checked 2 Apr 2027: partly fits vegetarian — ask for the set without fish stock' (stale: '(may have changed)'). */
export function menuLine(facts, { now, diet, timeZone } = {}) {
  const m = facts && facts.menu;
  if (!m) return '';
  const d = dietWords(diet);
  const fit = { yes: d ? `fits ${d}` : 'fits the diet', partly: d ? `partly fits ${d}` : 'partly fits the diet', no: d ? `does not fit ${d}` : 'does not fit the diet', unknown: 'fit not known' }[m.fits];
  const when = `${+m.checked.slice(8, 10)} ${monthYear(m.checked)}`;
  const stale = now != null && factsStale(facts, now, timeZone).menu ? ' (may have changed)' : '';
  return fitLine([`Menu checked ${when}${stale}: ${fit}`, m.note || ''], ' — ');
}

// Developed by: LightAISolutions

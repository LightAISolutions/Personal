/**
 * The season sheet — what is on and what is in bloom on a date, and whether a single-bloom garden is worth a visit.
 *   eventsOn(season, date, { kinds? }) → the season's events running that day, by start time
 *   bloomOn(season, date) → a short line ('Autumn leaves at their peak · Roses past their best'; '' when nothing is known)
 *   bloomKindOf(place) → the one bloom a garden or park is mainly about ('roses', 'hydrangea', …), else null
 *   outOfSeason(place, { season, date | dates, lat }) → true when that bloom is out on every date given
 * Usual bloom months (BLOOM_MONTHS_NORTH, shifted six months south of the equator) are broad on purpose: a garden is only
 * dropped when it is clearly out of season. The trip's own forecast (`season.bloom`) wins over the usual months.
 * Unknowns are never the bad case: no latitude, a tropical latitude, or a name that names two blooms keeps the place.
 */
import { isDate } from '../schemas/tour-guide-dates.mjs';

/** Northern-hemisphere months (1–12) a bloom is usually worth seeing; sources and reasons in helpers/decisions/WP-11b.md. */
export const BLOOM_MONTHS_NORTH = Object.freeze({
  plum: Object.freeze([1, 2, 3]),
  cherry: Object.freeze([3, 4, 5]),
  wisteria: Object.freeze([4, 5]),
  iris: Object.freeze([5, 6]),
  roses: Object.freeze([5, 6, 7, 8, 9, 10]),
  hydrangea: Object.freeze([6, 7, 8]),
  lotus: Object.freeze([6, 7, 8]),
  lavender: Object.freeze([6, 7, 8])
});
/** Between these latitudes the temperate calendar does not hold; outOfSeason never drops there. */
export const TROPICS_LAT = 23.5;
/** Name and tag words that say a garden is mainly one bloom (Latin words are matched whole; Japanese terms anywhere). */
export const BLOOM_WORDS = Object.freeze({
  roses: /\b(roses?|rosarium|rosary|roseraie|rosengarten|rosaleda|roseto|rozarium)\b|バラ園|薔薇|ばら園/i,
  cherry: /\b(cherry|cherries|sakura|hanami)\b|桜|さくら/i,
  plum: /\b(plum|plums|ume|bairin|umezono)\b|梅園|梅林/i,
  hydrangea: /\b(hydrangeas?|ajisai)\b|紫陽花|あじさい|アジサイ/i,
  wisteria: /\b(wisterias?|wistaria|fujidana)\b|藤棚|藤園/i,
  iris: /\b(iris|irises|hanashobu|shobu|shoubu)\b|菖蒲/i,
  lotus: /\b(lotus|hasu)\b|蓮池|はす池/i,
  lavender: /\b(lavender|lavande|lavendel)\b|ラベンダー/i
});
const GARDEN_CATEGORIES = new Set(['garden', 'park']);
const GARDEN_TYPES = new Set(['garden', 'botanical_garden', 'park', 'national_park']);
const IN_STATUS = new Set(['starting', 'peak']), OUT_STATUS = new Set(['before', 'past']);
const LABELS = Object.freeze({ autumn_leaves: 'Autumn leaves', cherry: 'Cherry blossom', plum: 'Plum blossom', wisteria: 'Wisteria', hydrangea: 'Hydrangeas', iris: 'Irises', lotus: 'Lotus', roses: 'Roses', lavender: 'Lavender', other: 'Seasonal bloom' });
const STATUS_WORDS = Object.freeze({ before: 'not out yet', starting: 'starting', peak: 'at their peak', past: 'past their best' });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (d) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]}`;

/** eventsOn(season, date, { kinds }) → events with from ≤ date ≤ to (only `kinds` when given), sorted by start, then name. */
export function eventsOn(season, date, { kinds } = {}) {
  if (!isDate(date)) throw new Error(`season: date must be YYYY-MM-DD (got ${JSON.stringify(date)})`);
  const want = kinds ? new Set(kinds) : null;
  return ((season && season.events) || [])
    .filter((ev) => ev.from <= date && date <= ev.to && (!want || want.has(ev.kind)))
    .sort((a, b) => (a.start || '99:99').localeCompare(b.start || '99:99') || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** bloomStatusOn(entry, date) → 'before' | 'starting' | 'peak' | 'past' | 'in' (inside its window, no status) | null (nothing known). */
export function bloomStatusOn(b, date) {
  if (isDate(b.from) && date < b.from) return 'before';
  if (isDate(b.to) && date > b.to) return 'past';
  if (b.status) return b.status;
  return isDate(b.from) || isDate(b.to) ? 'in' : null;
}

/** bloomOn(season, date) → one short line on the leaf or blossom forecast for that day (≤ 160 characters). */
export function bloomOn(season, date) {
  if (!isDate(date)) throw new Error(`season: date must be YYYY-MM-DD (got ${JSON.stringify(date)})`);
  const parts = [];
  for (const b of (season && season.bloom) || []) {
    const st = bloomStatusOn(b, date), label = LABELS[b.kind] || LABELS.other;
    if (st === null) continue;
    if (st === 'before' && isDate(b.from) && date < b.from) parts.push(`${label} expected from ${dayMonth(b.from)}`);
    else if (st === 'in') parts.push(`${label} in season`);
    else parts.push(`${label} ${STATUS_WORDS[st]}`);
  }
  let line = '';
  for (const p of parts) { const next = line ? `${line} · ${p}` : p; if (next.length > 160) break; line = next; }
  return line;
}

/** bloomKindOf(place) → the single bloom a garden or park's name or tags name, else null (two blooms: null). */
export function bloomKindOf(place) {
  if (!place || typeof place !== 'object') return null;
  const types = [place.primary_type, ...(place.types || [])].filter(Boolean);
  const gardenish = GARDEN_CATEGORIES.has(place.category) || types.some((t) => GARDEN_TYPES.has(t));
  if (!gardenish) return null;
  const text = [place.name, ...(Array.isArray(place.tags) ? place.tags : [])].filter(Boolean).join(' ');
  const hits = Object.keys(BLOOM_WORDS).filter((k) => BLOOM_WORDS[k].test(text));
  return hits.length === 1 ? hits[0] : null;
}

/** usualMonths(kind, lat) → the months that bloom is usually out at that latitude (south: shifted six months), null in the tropics or unknown. */
export function usualMonths(kind, lat) {
  const north = BLOOM_MONTHS_NORTH[kind];
  if (!north || !Number.isFinite(lat) || Math.abs(lat) < TROPICS_LAT) return null;
  return lat > 0 ? north.slice() : north.map((m) => ((m + 5) % 12) + 1);
}

/** forecastSays(season, kind, dates) → true (in season on some date), false (out on every date), null (the sheet says nothing). */
export function forecastSays(season, kind, dates) {
  const entries = ((season && season.bloom) || []).filter((b) => b.kind === kind);
  let said = null;
  for (const b of entries) {
    const st = dates.map((d) => bloomStatusOn(b, d));
    if (st.some((s) => s === 'in' || IN_STATUS.has(s))) return true;
    if (st.every((s) => OUT_STATUS.has(s))) said = false;
  }
  return said;
}

/**
 * outOfSeason(place, { season, date, dates, lat }) → true when the place is mainly one bloom and that bloom is out on
 * every date given: the trip's forecast decides when it speaks for that bloom, else the usual months at the place's
 * latitude (its `location.lat` or `lat`, else the `lat` option). Anything unknown → false.
 */
export function outOfSeason(place, { season, date, dates, lat } = {}) {
  const list = (dates || (Array.isArray(date) ? date : date != null ? [date] : [])).map(String);
  if (!list.length || !list.every(isDate)) throw new Error('season: outOfSeason needs date or dates as YYYY-MM-DD');
  const kind = bloomKindOf(place);
  if (!kind) return false;
  const said = forecastSays(season, kind, list);
  if (said !== null) return !said;
  const at = Number.isFinite(place.location && place.location.lat) ? place.location.lat : Number.isFinite(place.lat) ? place.lat : lat;
  const months = usualMonths(kind, at);
  if (!months) return false;
  return list.every((d) => !months.includes(+d.slice(5, 7)));
}

// Developed by: LightAISolutions

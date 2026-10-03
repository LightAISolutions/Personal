/**
 * Tour Guide Scout — the owner's words in, search strings out (helpers/decisions/TG-SCOUT.md §7). Pure functions; no
 * clock, no network. The owner's text is data: it is cut, cleaned and clipped, never interpreted as an instruction.
 */
import { isDate } from '../schemas/tour-guide-dates.mjs';

export const TEXT_MAX = 80;
const SLUG_MAX = 40;
const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s, max = TEXT_MAX) => (s.length > max ? s.slice(0, max).trim() : s);

/**
 * parseScoutText(text) → { what, where }. Accepts "matcha in Kyoto", "matcha, Kyoto", "matcha @ Kyoto",
 * "matcha near Gion, Kyoto" and a leading "/scout". The earliest separator wins, except " in ", where the LAST one is
 * used ("tea ceremony in a temple in Kyoto" → where "Kyoto"). `where` is '' when there is no separator. Both ≤ 80.
 */
export function parseScoutText(text) {
  let s = clean(text).replace(/^\/scout(@[A-Za-z0-9_]+)?(\s+|$)/i, '').replace(/[?.!]+$/, '').trim();
  const cuts = [];
  const lower = s.toLowerCase();
  const lastIn = lower.lastIndexOf(' in ');
  if (lastIn > 0) cuts.push([lastIn, 4]);
  const near = lower.indexOf(' near ');
  if (near > 0) cuts.push([near, 6]);
  const at = s.indexOf('@');
  if (at > 0) cuts.push([at, 1]);
  const comma = s.indexOf(',');
  if (comma > 0) cuts.push([comma, 1]);
  if (!cuts.length) return { what: clip(s), where: '' };
  cuts.sort((a, b) => a[0] - b[0]);
  const [pos, len] = cuts[0];
  const what = clean(s.slice(0, pos)), where = clean(s.slice(pos + len)).replace(/^[,@\s]+/, '');
  return { what: clip(what), where: clip(where) };
}

/** slugOf(what) → a lower-case ASCII slug ≤ 40 chars ('' when nothing Latin survives, e.g. a CJK query). */
export function slugOf(what, max = SLUG_MAX) {
  return String(what ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
}

/**
 * scoutId(created_on, what, taken = []) → 'sc-YYYYMMDD-<slug>', adding -2, -3… when the id is already in `taken`
 * (an array or a Set). The slug falls back to 'scout' when the query has no Latin letters. Throws on a bad date.
 */
export function scoutId(created_on, what, taken = []) {
  if (!isDate(created_on)) throw new Error(`scout: created_on must be a calendar date YYYY-MM-DD (got ${JSON.stringify(created_on)})`);
  const used = taken instanceof Set ? taken : new Set(Array.isArray(taken) ? taken : []);
  const day = created_on.replace(/-/g, '');
  const slug = slugOf(what) || 'scout';
  const base = `sc-${day}-${slug}`;
  if (!used.has(base)) return base;
  for (let k = 2; k < 10000; k++) {
    const suffix = `-${k}`;
    const id = `sc-${day}-${slug.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!used.has(id)) return id;
  }
  throw new Error('scout: no free scout id');
}

/** Words that make a query an activity, checked first ("matcha ceremony" is an activity), then food words. */
export const ACTIVITY_WORDS = Object.freeze(['ceremony', 'class', 'classes', 'workshop', 'lesson', 'course', 'tour', 'tours', 'museum', 'museums', 'gallery', 'galleries', 'temple', 'temples', 'shrine', 'shrines', 'church', 'garden', 'gardens', 'park', 'hike', 'hiking', 'trail', 'onsen', 'bath', 'baths', 'sento', 'spa', 'viewpoint', 'view', 'views', 'castle', 'show', 'theatre', 'theater', 'concert', 'festival', 'market tour', 'kayak', 'cycling', 'bike', 'beach', 'craft', 'crafts', 'pottery', 'calligraphy', 'kimono', 'experience']);
export const FOOD_WORDS = Object.freeze(['matcha', 'coffee', 'espresso', 'tea', 'ramen', 'udon', 'soba', 'sushi', 'tempura', 'tofu', 'yuba', 'kaiseki', 'izakaya', 'cafe', 'café', 'bakery', 'bread', 'pastry', 'pastries', 'cake', 'dessert', 'desserts', 'sweets', 'wagashi', 'mochi', 'ice cream', 'gelato', 'parfait', 'yuzu', 'market', 'food', 'restaurant', 'restaurants', 'lunch', 'dinner', 'breakfast', 'brunch', 'bar', 'bars', 'sake', 'wine', 'beer', 'cocktail', 'cocktails', 'pizza', 'noodles', 'curry', 'dumplings', 'vegan', 'vegetarian', 'chocolate', 'donut', 'doughnut', 'croissant', 'tacos', 'pho', 'bbq', 'barbecue']);
/** Food words that read as a drink or a sweet: their extra search uses "cafe", the rest "restaurant". */
export const CAFE_WORDS = Object.freeze(['matcha', 'coffee', 'espresso', 'tea', 'cafe', 'café', 'bakery', 'bread', 'pastry', 'pastries', 'cake', 'dessert', 'desserts', 'sweets', 'wagashi', 'mochi', 'ice cream', 'gelato', 'parfait', 'yuzu', 'chocolate', 'donut', 'doughnut', 'croissant', 'brunch', 'breakfast']);

const hasWord = (text, list) => {
  const t = ' ' + String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
  return list.some((w) => t.includes(' ' + w + ' '));
};

/** guessGroup(what) → 'food' | 'activities' from a small word list (activity words win; default 'activities'). */
export function guessGroup(what) {
  if (hasWord(what, ACTIVITY_WORDS)) return 'activities';
  if (hasWord(what, FOOD_WORDS)) return 'food';
  return 'activities';
}

/**
 * scoutQueries({ what, where, group, diet, extra_terms = [] }) → 1–3 Text Search strings, distinct, in order:
 * "<what> in <where>"; for food "<what> cafe|restaurant <where>" and, with a diet, "<diet> <what> <where>"; for
 * activities the extra terms ("<what> <term> <where>"). Without `where` the strings simply omit it.
 */
export function scoutQueries({ what, where = '', group, diet, extra_terms = [] } = {}) {
  const w = clip(clean(what)), place = clip(clean(where));
  if (!w) throw new Error('scout: scoutQueries needs `what`');
  const g = group === 'food' || group === 'activities' ? group : guessGroup(w);
  const tail = (s) => clean(place ? `${s} ${place}` : s);
  const out = [place ? `${w} in ${place}` : w];
  if (g === 'food') {
    if (!/\b(cafe|café|restaurant|bar)\b/i.test(w)) out.push(tail(`${w} ${hasWord(w, CAFE_WORDS) ? 'cafe' : 'restaurant'}`));
    const d = clean(diet);
    if (d && !w.toLowerCase().includes(d.toLowerCase())) out.push(tail(`${d} ${w}`));
  }
  for (const term of Array.isArray(extra_terms) ? extra_terms : []) {
    const t = clean(term);
    if (t) out.push(tail(`${w} ${t}`));
  }
  return [...new Set(out.map((q) => q.slice(0, 200)))].slice(0, 3);
}

// Developed by: LightAISolutions

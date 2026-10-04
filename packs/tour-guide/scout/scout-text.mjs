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
 * parseScoutText(text) → { what, where, city, area } — the one grammar for the owner's words (TG-SCOUT.md §9; the core's
 * `tgScoutParse` only words its acknowledgement). A leading "/scout" (or "/scout@bot") and trailing ?/./! are dropped.
 * The separator is chosen in this order, as the core does:
 *   1. the LAST " in "      "tea ceremony in a temple in Wrenmouth" → what "tea ceremony in a temple", city "Wrenmouth";
 *                           "ramen near the station in Wrenmouth"   → what "ramen", area "the station", city "Wrenmouth"
 *   2. the first " near "   "matcha near Old Harbour, Wrenmouth" → city = the last comma part ("Wrenmouth"), area = the rest ("Old Harbour");
 *                           "matcha near Old Harbour" (no comma) → area "Old Harbour", city '' (the caller falls back to the trip)
 *   3. the first "@"        "matcha @ Wrenmouth" → city "Wrenmouth"
 *   4. the first ","        "matcha, Wrenmouth"  → city "Wrenmouth"
 *   none                    "matcha" → where, city and area ''
 * `where` is the place as written ("Old Harbour, Wrenmouth"; "the station, Wrenmouth" for the near…in form), kept for older callers.
 * Every field ≤ 80 characters. The text is data: cut and cleaned, never interpreted.
 */
export function parseScoutText(text) {
  const s = clean(text).replace(/^\/scout(@[A-Za-z0-9_]+)?(\s+|$)/i, '').replace(/[?.!]+$/, '').trim();
  const lower = s.toLowerCase();
  let what = s, where = '', city = '', area = '', m;
  const lastIn = lower.lastIndexOf(' in ');
  const nearSplit = (place) => {
    const parts = place.split(',').map((x) => clean(x)).filter(Boolean);
    return parts.length >= 2 ? { area: parts.slice(0, -1).join(', '), city: parts[parts.length - 1] } : { area: parts.join(''), city: '' };
  };
  if (lastIn > 0) {
    what = clean(s.slice(0, lastIn));
    city = clean(s.slice(lastIn + 4)).replace(/^[,@\s]+/, '');
    const near = /^(.+?)\s+near\s+(.+)$/i.exec(what);
    if (near && city) { what = clean(near[1]); area = clean(near[2]); }
    where = area ? `${area}, ${city}` : city;
  } else if ((m = /^(.+?)\s+near\s+(.+)$/i.exec(s))) {
    what = clean(m[1]); where = clean(m[2]);
    ({ area, city } = nearSplit(where));
  } else if ((m = /^(.+?)\s*@\s*(.+)$/.exec(s)) || (m = /^(.+?)\s*,\s*(.+)$/.exec(s))) {
    what = clean(m[1]); where = clean(m[2]).replace(/^[,@\s]+/, ''); city = where;
  }
  return { what: clip(what), where: clip(where), city: clip(city), area: clip(area) };
}

const hasWordIn = (text, list) => {
  const t = ' ' + String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
  return list.some((w) => t.includes(' ' + w + ' '));
};

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

const hasWord = hasWordIn;

/** isCafeTopic(what) → true when the query names a drink or a sweet (a CAFE_WORDS word, "ice cream" included). */
export const isCafeTopic = (what) => hasWord(what, CAFE_WORDS);

/**
 * The vegetarian screen's three kinds of food place (TG-PHASE-14 WP-14b change 4). Without a judgment a drink place
 * is "likely" for a vegetarian or vegan party, a café / sweets / market place for a vegetarian party only; a meal place
 * keeps the strict screen. Matched as whole words (a plural "s" allowed), diacritics and case ignored.
 */
export const DRINK_WORDS = Object.freeze(['bar', 'sake', 'wine', 'beer', 'cocktail', 'coffee', 'tea', 'tea house', 'matcha', 'kissaten', 'juice']);
export const CAFE_SWEET_WORDS = Object.freeze(['cafe', 'sweets', 'dessert', 'wagashi', 'bakery', 'ice cream', 'parfait']);
export const MARKET_WORDS = Object.freeze(['market', 'food hall']);
export const MEAL_WORDS = Object.freeze(['ramen', 'udon', 'soba', 'kaiseki', 'izakaya', 'lunch', 'dinner', 'sushi', 'tempura', 'okonomiyaki', 'curry', 'teishoku', 'restaurant']);

const kindText = (s) => ' ' + String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
const kindHas = (text, list) => list.some((w) => text.includes(' ' + w + ' ') || text.includes(' ' + w + 's ') || text.includes(' ' + w + 'es '));
/** The strictest kind a text names: 'meal' > 'cafe' / 'market' > 'drink', or null. */
function kindOf(s) {
  const t = kindText(s);
  if (kindHas(t, MEAL_WORDS)) return 'meal';
  if (kindHas(t, CAFE_SWEET_WORDS)) return 'cafe';
  if (kindHas(t, MARKET_WORDS)) return 'market';
  if (kindHas(t, DRINK_WORDS)) return 'drink';
  return null;
}
const STRICT = { meal: 3, cafe: 2, market: 2, drink: 1 };

/**
 * foodKind(record, what) → 'meal' | 'cafe' | 'market' | 'drink'. The place's own name and its primary type (underscores
 * read as spaces: tea_house → "tea house") decide, the stricter of the two winning (a meal word anywhere keeps the
 * strict screen); when neither names a kind, the query does; with nothing at all, 'meal' (strict).
 */
export function foodKind(record, what) {
  const r = record || {};
  const own = [kindOf(r.name), kindOf(String(r.primary_type ?? '').replace(/_/g, ' '))].filter(Boolean);
  if (own.length) return own.sort((a, b) => STRICT[b] - STRICT[a])[0];
  return kindOf(what) || 'meal';
}

/** guessGroup(what) →'food' | 'activities' from a small word list (activity words win; default 'activities'). */
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

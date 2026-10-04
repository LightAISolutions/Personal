/**
 * Tour Guide — What's on (C15, TG-PHASE-15 WP-15b): the `whatson` payload's rules.
 *   validateWhatsonPayload(p) → string[]      the core's tgEnvValidateWhatson (gas/42_whatson.js), rule for rule and word
 *                                             for word (tests/pack_tour-guide_whatson.test.js holds the two to one answer)
 *   checkWhatson(p) → [{ path, message }]     the rules the JSON schema cannot say (dates, order, the 40 000 cap), for
 *                                             schemas/index.mjs KINDS (a REQUEST: helpers/status/WP-15b.md)
 *   compareItems(a, b, from, to), firstDayIn(item, from, to), daysIn(item, from, to)
 * No imports: schemas/index.mjs may import this file without a cycle.
 */
export const ID_RE = /^wo-\d{8}-[a-z0-9-]{1,40}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const KINDS = Object.freeze(['light_up', 'special_opening', 'festival', 'market', 'exhibition', 'performance', 'holiday', 'closure']);
/** Holidays and closures inform; they cannot be chosen. */
export const CHOOSABLE = Object.freeze(KINDS.filter((k) => k !== 'holiday' && k !== 'closure'));
export const LABELS = Object.freeze(['evening', 'free', 'crowded', 'rain_ok', 'veg_food', 'booking']);
export const LEFT_REASONS = Object.freeze(['outside_dates', 'duplicate', 'unconfirmed', 'sold_out', 'other']);
export const CONFIDENCE = Object.freeze(['confirmed', 'likely']);
export const LIMITS = Object.freeze({ ITEMS: 20, MORE: 50, SOURCES: 10, LEFT_OUT: 20, DAYS: 31, WINDOW_DAYS: 31, LABELS: 4,
  NAME: 120, WHY: 200, FOOD: 160, PRICE: 80, BOOKING: 120, LABEL: 80, AREA: 80, TITLE: 120, URL: 2000 });
export const PAYLOAD_MAX = 40000;   // one Sheet cell (the core stores the payload as JSON in the WhatsOn tab)
const ENV_MAX = 60000;              // the core's TG_ENV_DIGEST_MAX_CHARS
const MAX_ERRORS = 20;              // the core's TG_ENV_MAX_ERRORS
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL_RE = /^https:\/\/\S+$/;
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
/** The core's Google field names, normalised (TG_GOOGLE_FIELDS through tgScoutNormKey, then TG_SCOUT_GOOGLE_EXTRA). */
export const GOOGLE_KEYS = Object.freeze(['hours', 'openinghours', 'regularopeninghours', 'currentopeninghours', 'opennow', 'rating',
  'userratingcount', 'reviewcount', 'reviews', 'website', 'websiteuri', 'address', 'formattedaddress',
  'shortformattedaddress', 'businessstatus', 'pricelevel', 'pricerange', 'phone', 'internationalphonenumber',
  'nationalphonenumber', 'types', 'primarytype', 'editorialsummary', 'photos',
  'photo', 'location', 'lat', 'lng', 'latitude', 'longitude', 'googlemapsuri', 'servesvegetarianfood', 'displayname',
  'reviewcount', 'reviews', 'pricerange', 'userratingcount', 'userratingstotal', 'regularopeninghours', 'pricelevel', 'geometry', 'vicinity']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
/** A real calendar date (2027-02-30 is refused), as the core's tgEnvRealDate. */
export function isRealDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const dayNo = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 86400000);
/** Whole days from a to b (b − a). */
export const daysBetween = (a, b) => dayNo(b) - dayNo(a);
/** iso + n days. */
export const addDays = (iso, n) => new Date((dayNo(iso) + n) * 86400000).toISOString().slice(0, 10);

/**
 * daysIn(item, from, to) → the item's dates inside the window, in order: its `days` when it lists them, else every day of
 * its run that the window covers. Dates that are not real dates are ignored.
 */
export function daysIn(it, from, to) {
  if (!isObj(it) || !isRealDate(it.from) || !isRealDate(it.to)) return [];
  if (Array.isArray(it.days)) return it.days.filter((d) => isRealDate(d) && d >= from && d <= to && d >= it.from && d <= it.to);
  const out = [];
  for (let d = it.from > from ? it.from : from, end = it.to < to ? it.to : to; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
/** firstDayIn(item, from, to) → its first date inside the window, or null. */
export function firstDayIn(it, from, to) {
  if (!isObj(it) || !isRealDate(it.from) || !isRealDate(it.to)) return null;
  if (Array.isArray(it.days)) return daysIn(it, from, to)[0] || null;
  const d = it.from > from ? it.from : from;
  return d <= (it.to < to ? it.to : to) ? d : null;
}
/** The board's order: the first day in the window, then the start (none first), then the name ignoring case. */
export function compareItems(a, b, from, to) {
  const ka = [firstDayIn(a, from, to) || '9999-12-31', TIME_RE.test(a.start || '') ? a.start : '', String(a.name || '').toLowerCase()];
  const kb = [firstDayIn(b, from, to) || '9999-12-31', TIME_RE.test(b.start || '') ? b.start : '', String(b.name || '').toLowerCase()];
  for (let i = 0; i < 3; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; }
  return 0;
}

/* ---------------- the core's helpers, word for word (gas/20_envelopes.js) ---------------- */
function obj(errs, path, o, required, optional) {
  if (!isObj(o)) { errs.push(path + ' must be an object'); return false; }
  const allowed = required.concat(optional || []);
  Object.keys(o).forEach((k) => { if (!allowed.includes(k)) errs.push(path + ': unknown key "' + cut(k, 40) + '"'); });
  required.forEach((k) => { if (o[k] === undefined) errs.push(path + ': ' + k + ' required'); });
  return true;
}
function str(errs, path, v, min, max, re) {
  if (typeof v !== 'string') { errs.push(path + ' must be a string'); return; }
  if (v.length < min) errs.push(path + (min === 1 ? ' must not be empty' : ' too short'));
  if (v.length > max) errs.push(path + ' longer than ' + max + ' chars');
  if (re && !re.test(v)) errs.push(path + ' has the wrong format');
}
function int(errs, path, v, min, max) {
  if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v) { errs.push(path + ' must be an integer'); return; }
  if (v < min || (max !== undefined && v > max)) errs.push(path + ' out of range');
}
function oneOf(errs, path, v, list) { if (!list.includes(v)) errs.push(path + ' must be one of ' + list.join(' | ')); }
function arr(errs, path, v, max) {
  if (!Array.isArray(v)) { errs.push(path + ' must be an array'); return false; }
  if (v.length > max) errs.push(path + ': at most ' + max + ' entries');
  return true;
}
function date(errs, path, v) { if (!isRealDate(v)) errs.push(path + ' must be a calendar date YYYY-MM-DD'); }
function dupes(errs, path, list, key) {
  const seen = new Set();
  list.forEach((x, i) => {
    if (!isObj(x) || x[key] === undefined) return;
    const k = String(x[key]);
    if (seen.has(k)) errs.push(path + '[' + i + ']: duplicate ' + key + ' ' + cut(k, 40));
    seen.add(k);
  });
}
const normKey = (k) => String(k).toLowerCase().replace(/[^a-z]/g, '');
/** Every Google field name anywhere in the payload, as "path.key" (the core's tgScoutGoogleKeys). */
export function googleKeys(v, path) {
  const out = [];
  (function walk(x, at, depth) {
    if (depth > 6 || out.length > 20) return;
    if (Array.isArray(x)) { x.forEach((y, i) => walk(y, at + '[' + i + ']', depth + 1)); return; }
    if (!isObj(x)) return;
    Object.keys(x).forEach((k) => {
      if (GOOGLE_KEYS.includes(normKey(k))) out.push((at ? at + '.' : '') + cut(k, 40));
      walk(x[k], (at ? at + '.' : '') + cut(k, 40), depth + 1);
    });
  })(v, path || '', 0);
  return out;
}
const done = (errs) => (errs.length > MAX_ERRORS ? errs.slice(0, MAX_ERRORS).concat(['… ' + (errs.length - MAX_ERRORS) + ' more']) : errs);

const REQUIRED = ['id', 'trip', 'place', 'from', 'to', 'created_on', 'items', 'sources', 'left_out'];
const OPTIONAL = ['v', 'kind', 'auto', 'more'];
const ITEM_REQUIRED = ['id', 'name', 'kind', 'from', 'to', 'why', 'url', 'confidence'];
const ITEM_OPTIONAL = ['days', 'start', 'end', 'venue', 'food', 'price', 'booking', 'labels'];
const ORDER_TEXT = ' out of order (first day in from..to, then start, then name)';
/** An item the order rule can place: a day in the window, a string name and no broken start. */
const placeable = (it, w) => isObj(it) && typeof it.name === 'string' && (it.start === undefined || TIME_RE.test(it.start)) && firstDayIn(it, w.from, w.to) !== null;

function item(errs, at, it, w) {
  if (!obj(errs, at, it, ITEM_REQUIRED, ITEM_OPTIONAL)) return;
  if (it.id !== undefined) str(errs, at + '.id', it.id, 1, 64, SLUG_RE);
  if (it.name !== undefined) str(errs, at + '.name', it.name, 1, LIMITS.NAME);
  if (it.kind !== undefined) oneOf(errs, at + '.kind', it.kind, KINDS);
  if (it.from !== undefined) date(errs, at + '.from', it.from);
  if (it.to !== undefined) date(errs, at + '.to', it.to);
  const run = isRealDate(it.from) && isRealDate(it.to);
  if (run && it.from > it.to) errs.push(at + '.to must not be before from');
  if (it.days !== undefined && arr(errs, at + '.days', it.days, LIMITS.DAYS)) {
    it.days.forEach((d, j) => {
      date(errs, at + '.days[' + j + ']', d);
      if (!isRealDate(d)) return;
      if (run && (d < it.from || d > it.to)) errs.push(at + '.days[' + j + '] outside from..to');
      if (j > 0 && isRealDate(it.days[j - 1]) && d <= it.days[j - 1]) errs.push(at + '.days[' + j + '] out of order or repeated');
    });
  }
  if (it.start !== undefined) str(errs, at + '.start', it.start, 5, 5, TIME_RE);
  if (it.end !== undefined) str(errs, at + '.end', it.end, 5, 5, TIME_RE);
  if (it.venue !== undefined && obj(errs, at + '.venue', it.venue, ['name'], ['area', 'place_id'])) {
    if (it.venue.name !== undefined) str(errs, at + '.venue.name', it.venue.name, 1, LIMITS.NAME);
    if (it.venue.area !== undefined) str(errs, at + '.venue.area', it.venue.area, 1, LIMITS.AREA);
    if (it.venue.place_id !== undefined) str(errs, at + '.venue.place_id', it.venue.place_id, 1, 300, PLACE_ID_RE);
  }
  if (it.why !== undefined) str(errs, at + '.why', it.why, 1, LIMITS.WHY);
  if (it.food !== undefined) str(errs, at + '.food', it.food, 1, LIMITS.FOOD);
  if (it.price !== undefined) str(errs, at + '.price', it.price, 1, LIMITS.PRICE);
  if (it.booking !== undefined) str(errs, at + '.booking', it.booking, 1, LIMITS.BOOKING);
  if (it.url !== undefined) str(errs, at + '.url', it.url, 1, LIMITS.URL, URL_RE);
  if (it.confidence !== undefined) oneOf(errs, at + '.confidence', it.confidence, CONFIDENCE);
  if (it.labels !== undefined && arr(errs, at + '.labels', it.labels, LIMITS.LABELS)) {
    it.labels.forEach((l, j) => {
      oneOf(errs, at + '.labels[' + j + ']', l, LABELS);
      if (it.labels.indexOf(l) < j) errs.push(at + '.labels[' + j + ']: duplicate ' + cut(l, 40));
    });
  }
  if (w && run && it.from <= it.to && firstDayIn(it, w.from, w.to) === null) errs.push(at + ' has no day in from..to');
}

/** validateWhatsonPayload(p) → string[] (empty = valid); the core's tgEnvValidateWhatson, rule for rule and word for word. */
export function validateWhatsonPayload(p) {
  const errs = [];
  if (!isObj(p)) return ['payload must be an object'];
  googleKeys(p, '').forEach((k) => errs.push(k + ': Google field refused (own data only)'));
  if (!obj(errs, 'payload', p, REQUIRED, OPTIONAL)) return done(errs);
  if (p.v !== undefined && p.v !== 1) errs.push('v must be 1');
  if (p.kind !== undefined && p.kind !== 'whatson') errs.push('kind must be "whatson"');
  if (p.id !== undefined) str(errs, 'id', p.id, 1, 52, ID_RE);
  if (p.trip !== undefined && p.trip !== null) str(errs, 'trip', p.trip, 1, 64, SLUG_RE);
  if (p.place !== undefined && obj(errs, 'place', p.place, ['label', 'slug'])) {
    if (p.place.label !== undefined) str(errs, 'place.label', p.place.label, 1, LIMITS.LABEL);
    if (p.place.slug !== undefined) str(errs, 'place.slug', p.place.slug, 1, 64, SLUG_RE);
  }
  ['from', 'to', 'created_on'].forEach((k) => { if (p[k] !== undefined) date(errs, k, p[k]); });
  let w = null;
  if (isRealDate(p.from) && isRealDate(p.to)) {
    if (p.from > p.to) errs.push('to must not be before from');
    else if (daysBetween(p.from, p.to) > LIMITS.WINDOW_DAYS - 1) errs.push('from..to: at most ' + LIMITS.WINDOW_DAYS + ' days');
    else w = { from: p.from, to: p.to };
  }
  if (p.auto !== undefined && p.auto !== true) errs.push('auto must be true when present');
  if (p.more !== undefined) int(errs, 'more', p.more, 0, LIMITS.MORE);
  if (p.items !== undefined && arr(errs, 'items', p.items, LIMITS.ITEMS)) {
    p.items.forEach((it, i) => item(errs, 'items[' + i + ']', it, w));
    dupes(errs, 'items', p.items, 'id');
    if (w) p.items.forEach((it, i) => {
      if (i > 0 && placeable(p.items[i - 1], w) && placeable(it, w) && compareItems(p.items[i - 1], it, w.from, w.to) > 0) errs.push('items[' + i + ']' + ORDER_TEXT);
    });
  }
  if (p.sources !== undefined && arr(errs, 'sources', p.sources, LIMITS.SOURCES)) {
    p.sources.forEach((s, i) => {
      const at = 'sources[' + i + ']';
      if (!obj(errs, at, s, ['title', 'url'])) return;
      if (s.title !== undefined) str(errs, at + '.title', s.title, 1, LIMITS.TITLE);
      if (s.url !== undefined) str(errs, at + '.url', s.url, 1, LIMITS.URL, URL_RE);
    });
  }
  if (p.left_out !== undefined && arr(errs, 'left_out', p.left_out, LIMITS.LEFT_OUT)) {
    p.left_out.forEach((l, i) => {
      const at = 'left_out[' + i + ']';
      if (!obj(errs, at, l, ['name', 'reason'])) return;
      if (l.name !== undefined) str(errs, at + '.name', l.name, 1, LIMITS.NAME);
      if (l.reason !== undefined) oneOf(errs, at + '.reason', l.reason, LEFT_REASONS);
    });
  }
  const n = JSON.stringify(p).length;
  if (n > ENV_MAX) errs.push('payload is ' + n + ' chars (max ' + ENV_MAX + ')');
  if (n > PAYLOAD_MAX) errs.push('payload is ' + n + ' chars (max ' + PAYLOAD_MAX + ' for one cell)');
  return done(errs);
}

/**
 * checkWhatson(p) → [{ path, message }]: the rules beyond the JSON schema — the window (from ≤ to, ≤ 31 days), each
 * item's run and days, a day in the window, the order, unique ids and labels, and the 40 000-character cap. Run once
 * the schema passes (schemas/index.mjs KINDS).
 */
export function checkWhatson(p) {
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  if (!isObj(p)) return errs;
  let w = null;
  if (isRealDate(p.from) && isRealDate(p.to)) {
    if (p.from > p.to) e('/to', 'before from');
    else if (daysBetween(p.from, p.to) > LIMITS.WINDOW_DAYS - 1) e('/to', 'more than ' + LIMITS.WINDOW_DAYS + ' days after from');
    else w = { from: p.from, to: p.to };
  }
  for (const k of ['from', 'to', 'created_on']) if (typeof p[k] === 'string' && !isRealDate(p[k])) e('/' + k, 'not a calendar date');
  const items = Array.isArray(p.items) ? p.items : [], ids = new Set();
  items.forEach((it, i) => {
    if (!isObj(it)) return;
    const at = '/items/' + i;
    if (ids.has(it.id)) e(at + '/id', 'duplicate item id "' + it.id + '"');
    ids.add(it.id);
    for (const k of ['from', 'to']) if (typeof it[k] === 'string' && !isRealDate(it[k])) e(at + '/' + k, 'not a calendar date');
    const run = isRealDate(it.from) && isRealDate(it.to);
    if (run && it.from > it.to) e(at + '/to', 'before from');
    (Array.isArray(it.days) ? it.days : []).forEach((d, j) => {
      if (!isRealDate(d)) { e(at + '/days/' + j, 'not a calendar date'); return; }
      if (run && (d < it.from || d > it.to)) e(at + '/days/' + j, 'outside the item\'s from..to');
      if (j > 0 && isRealDate(it.days[j - 1]) && d <= it.days[j - 1]) e(at + '/days/' + j, 'out of order or repeated');
    });
    (Array.isArray(it.labels) ? it.labels : []).forEach((l, j) => { if (it.labels.indexOf(l) < j) e(at + '/labels/' + j, 'duplicate label "' + l + '"'); });
    if (w && run && it.from <= it.to && firstDayIn(it, w.from, w.to) === null) e(at, 'no day in the board\'s from..to');
    if (w && i > 0 && placeable(items[i - 1], w) && placeable(it, w) && compareItems(items[i - 1], it, w.from, w.to) > 0) e(at, 'out of order (first day in from..to, then start, then name)');
  });
  const n = JSON.stringify(p).length;
  if (n > PAYLOAD_MAX) e('/', 'payload is ' + n + ' chars (max ' + PAYLOAD_MAX + ')');
  return errs;
}

// Developed by: LightAISolutions

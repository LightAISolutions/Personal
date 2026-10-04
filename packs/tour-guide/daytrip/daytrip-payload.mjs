/**
 * Tour Guide — Day trip: the `daytrip` envelope payload (Contract C15, TG-PHASE-15 WP-15a).
 * validateDaytripPayload mirrors the core's tgEnvValidateDaytrip (gas/41_daytrip.js) rule for rule and message for
 * message, and schemas/tour-guide-daytrip.schema.json says the same; tests/pack_tour-guide_daytrip.test.js holds the
 * three to one answer. Own data only: every Google field is refused by name (the core's tgScoutGoogleKeys list), and the
 * whole payload stays under 20 000 characters.
 *   dayTripId(createdOn, baseSlug) → 'dt-YYYYMMDD-<base slug ≤ 40>'
 *   daytripPayload({ trip, base: { label, slug? }, createdOn, maxMinutes, date?, ranked }) → a valid payload; throws listing every problem
 *   checkDaytrip(p) → [{ path, message }] — the rules the schema subset cannot say (rank order, unique slugs and labels,
 *                     real dates, size); schemas/index.mjs runs it as KINDS.daytrip once the schema passes
 * Self-contained (reads the schema file and uses the brochure kit's validator subset, as vegcard-payload.mjs does) so
 * schemas/index.mjs can import checkDaytrip without an import cycle.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSubset } from '../../../kits/brochure/lib/validate.mjs';
import { LABELS, REASONS, LENGTHS, ITEMS_MAX, LEFT_MAX, MORE_MAX } from './daytrip-rank.mjs';
import { MINUTES_MIN, MINUTES_MAX } from './daytrip-text.mjs';

export const DAYTRIP_SCHEMA = Object.freeze(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas', 'tour-guide-daytrip.schema.json'), 'utf8')));
export const ID_RE = /^dt-\d{8}-[a-z0-9-]{1,40}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const PAYLOAD_MAX = 20000;
const ENV_MAX = 60000;              // the core's TG_ENV_DIGEST_MAX_CHARS
const MAX_ERRORS = 20;              // the core's TG_ENV_MAX_ERRORS
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const URL_RE = /^https:\/\/\S+$/;
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
const ID_SLUG_MAX = 40;

/** The core's Google field names (gas/21_sheets.js TG_GOOGLE_FIELDS and gas/16_scout.js TG_SCOUT_GOOGLE_EXTRA), compared
 *  as tgScoutNormKey does: lower case, letters only. A parity test checks this list against the core's. */
const GOOGLE_FIELDS = ['hours', 'opening_hours', 'regular_opening_hours', 'current_opening_hours', 'open_now', 'rating',
  'user_rating_count', 'review_count', 'reviews', 'website', 'website_uri', 'address', 'formatted_address',
  'short_formatted_address', 'business_status', 'price_level', 'price_range', 'phone', 'international_phone_number',
  'national_phone_number', 'types', 'primary_type', 'editorial_summary', 'photos'];
const GOOGLE_EXTRA = ['photo', 'location', 'lat', 'lng', 'latitude', 'longitude', 'googlemapsuri', 'servesvegetarianfood', 'displayname',
  'reviewcount', 'reviews', 'pricerange', 'userratingcount', 'userratingstotal', 'regularopeninghours', 'pricelevel', 'geometry', 'vicinity'];
const normKey = (k) => String(k).toLowerCase().replace(/[^a-z]/g, '');
export const GOOGLE_KEYS = Object.freeze(GOOGLE_FIELDS.map(normKey).concat(GOOGLE_EXTRA));

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

/** Every Google field name anywhere in the payload, as "path.key" — the core's tgScoutGoogleKeys, walk for walk. */
export function googleKeys(v, path = '') {
  const out = [];
  (function walk(x, at, depth) {
    if (depth > 6 || out.length > 20) return;
    if (Array.isArray(x)) { x.forEach((y, i) => walk(y, at + '[' + i + ']', depth + 1)); return; }
    if (!isObj(x)) return;
    Object.keys(x).forEach((k) => {
      if (GOOGLE_KEYS.includes(normKey(k))) out.push((at ? at + '.' : '') + cut(k, 40));
      walk(x[k], (at ? at + '.' : '') + cut(k, 40), depth + 1);
    });
  })(v, path, 0);
  return out;
}

/* ---- the core's tgEnv* helpers, word for word ---- */
function obj(errs, path, o, required, optional = []) {
  if (!isObj(o)) { errs.push(path + ' must be an object'); return false; }
  const allowed = required.concat(optional);
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
const bool = (errs, path, v) => { if (typeof v !== 'boolean') errs.push(path + ' must be true or false'); };
const enumv = (errs, path, v, list) => { if (!list.includes(v)) errs.push(path + ' must be one of ' + list.join(' | ')); };
function arr(errs, path, v, max, min) {
  if (!Array.isArray(v)) { errs.push(path + ' must be an array'); return false; }
  if (v.length > max) errs.push(path + ': at most ' + max + ' entries');
  if (min && v.length < min) errs.push(path + ': at least ' + min + ' entries');
  return true;
}
function realDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const date = (errs, path, v) => { if (!realDate(v)) errs.push(path + ' must be a calendar date YYYY-MM-DD'); };
const slug = (errs, path, v) => str(errs, path, v, 1, 64, SLUG_RE);
const url = (errs, path, v) => str(errs, path, v, 1, 2000, URL_RE);
function dupes(errs, path, list, key, what) {
  const seen = {};
  (Array.isArray(list) ? list : []).forEach((x, i) => {
    if (!isObj(x) || x[key] === undefined) return;
    const k = String(x[key]);
    if (Object.prototype.hasOwnProperty.call(seen, k)) errs.push(path + '[' + i + ']: duplicate ' + (what || key) + ' ' + cut(k, 40));
    seen[k] = true;
  });
}
const done = (errs) => (errs.length > MAX_ERRORS ? errs.slice(0, MAX_ERRORS).concat(['… ' + (errs.length - MAX_ERRORS) + ' more']) : errs);

function item(errs, at, it) {
  if (!obj(errs, at, it, ['n', 'slug', 'name', 'ride', 'length', 'why', 'see', 'score', 'parts', 'labels', 'stops', 'maps_url'], ['area', 'eat', 'season', 'closed', 'place_id'])) return;
  if (it.n !== undefined) int(errs, at + '.n', it.n, 1, ITEMS_MAX);
  if (it.slug !== undefined) slug(errs, at + '.slug', it.slug);
  if (it.name !== undefined) str(errs, at + '.name', it.name, 1, 120);
  if (it.area !== undefined) str(errs, at + '.area', it.area, 0, 80);
  if (it.ride !== undefined && obj(errs, at + '.ride', it.ride, ['minutes', 'estimated'], ['from_station', 'to_station'])) {
    if (it.ride.minutes !== undefined) int(errs, at + '.ride.minutes', it.ride.minutes, 1, 600);
    if (it.ride.estimated !== undefined) bool(errs, at + '.ride.estimated', it.ride.estimated);
    ['from_station', 'to_station'].forEach((k) => { if (it.ride[k] !== undefined) str(errs, at + '.ride.' + k, it.ride[k], 1, 80); });
  }
  if (it.length !== undefined) enumv(errs, at + '.length', it.length, LENGTHS);
  if (it.why !== undefined) str(errs, at + '.why', it.why, 1, 200);
  if (it.see !== undefined && arr(errs, at + '.see', it.see, 4, 1)) it.see.forEach((s, j) => str(errs, at + '.see[' + j + ']', s, 1, 80));
  if (it.eat !== undefined) str(errs, at + '.eat', it.eat, 1, 160);
  if (it.season !== undefined) str(errs, at + '.season', it.season, 1, 120);
  if (it.closed !== undefined && arr(errs, at + '.closed', it.closed, 7)) it.closed.forEach((d, j) => date(errs, at + '.closed[' + j + ']', d));
  if (it.score !== undefined) int(errs, at + '.score', it.score, 0, 100);
  if (it.parts !== undefined && obj(errs, at + '.parts', it.parts, ['fit', 'reach', 'season', 'food'])) {
    ['fit', 'reach', 'season', 'food'].forEach((k) => { if (it.parts[k] !== undefined) int(errs, at + '.parts.' + k, it.parts[k], 0, 100); });
  }
  if (it.labels !== undefined && arr(errs, at + '.labels', it.labels, 4)) {
    it.labels.forEach((l, j) => enumv(errs, at + '.labels[' + j + ']', l, LABELS));
    it.labels.forEach((l, j) => { if (it.labels.indexOf(l) !== j) errs.push(at + '.labels[' + j + ']: duplicate label'); });
  }
  if (it.stops !== undefined && arr(errs, at + '.stops', it.stops, 6, 1)) {
    it.stops.forEach((s, j) => {
      const as = at + '.stops[' + j + ']';
      if (!obj(errs, as, s, ['name'], ['place_id'])) return;
      if (s.name !== undefined) str(errs, as + '.name', s.name, 1, 120);
      if (s.place_id !== undefined) str(errs, as + '.place_id', s.place_id, 6, 300, PLACE_ID_RE);
    });
  }
  if (it.place_id !== undefined) str(errs, at + '.place_id', it.place_id, 6, 300, PLACE_ID_RE);
  if (it.maps_url !== undefined) url(errs, at + '.maps_url', it.maps_url);
}

/** validateDaytripPayload(p) → string[] (empty = valid); the same rules and words as the core's validator. */
export function validateDaytripPayload(p) {
  const errs = [];
  if (!isObj(p)) return ['payload must be an object'];
  googleKeys(p, '').forEach((k) => errs.push(k + ': Google field refused (own data only)'));
  if (!obj(errs, 'payload', p, ['id', 'trip', 'base', 'created_on', 'max_minutes', 'items', 'left_out'], ['v', 'date', 'more'])) return done(errs);
  if (p.v !== undefined && p.v !== 1) errs.push('v must be 1');
  if (p.id !== undefined) str(errs, 'id', p.id, 1, 52, ID_RE);
  if (p.trip !== undefined && p.trip !== null) slug(errs, 'trip', p.trip);
  if (p.base !== undefined && obj(errs, 'base', p.base, ['label', 'slug'])) {
    if (p.base.label !== undefined) str(errs, 'base.label', p.base.label, 1, 80);
    if (p.base.slug !== undefined) slug(errs, 'base.slug', p.base.slug);
  }
  if (p.created_on !== undefined) date(errs, 'created_on', p.created_on);
  if (p.max_minutes !== undefined) int(errs, 'max_minutes', p.max_minutes, MINUTES_MIN, MINUTES_MAX);
  if (p.date !== undefined) date(errs, 'date', p.date);
  if (p.more !== undefined) int(errs, 'more', p.more, 0, MORE_MAX);
  if (p.items !== undefined && arr(errs, 'items', p.items, ITEMS_MAX)) {
    p.items.forEach((it, i) => {
      item(errs, 'items[' + i + ']', it);
      if (isObj(it) && typeof it.n === 'number' && it.n !== i + 1) errs.push('items[' + i + '].n must be ' + (i + 1) + ' (rank order)');
    });
    dupes(errs, 'items', p.items, 'slug', 'slug');
  }
  if (p.left_out !== undefined && arr(errs, 'left_out', p.left_out, LEFT_MAX)) {
    p.left_out.forEach((l, i) => {
      const at = 'left_out[' + i + ']';
      if (!obj(errs, at, l, ['name', 'reason'])) return;
      if (l.name !== undefined) str(errs, at + '.name', l.name, 1, 120);
      if (l.reason !== undefined) enumv(errs, at + '.reason', l.reason, REASONS);
    });
  }
  const n = JSON.stringify(p).length;
  if (n > ENV_MAX) errs.push('payload is ' + n + ' chars (max ' + ENV_MAX + ')');
  if (n > PAYLOAD_MAX) errs.push('payload is ' + n + ' chars (max ' + PAYLOAD_MAX + ')');
  return done(errs);
}

/** The rules the schema subset cannot state, as [{ path, message }] (JSON-pointer paths), for schemas/index.mjs. */
export function checkDaytrip(p) {
  return validateDaytripPayload(p).map((m) => ({ path: '/', message: m }));
}

/** 'dt-YYYYMMDD-<slug>': the run's local date and the base's slug cut to 40 ('base' when nothing is left). */
export function dayTripId(createdOn, baseSlug) {
  if (!realDate(createdOn)) throw new Error(`daytrip: createdOn must be a calendar date YYYY-MM-DD (got ${JSON.stringify(createdOn)})`);
  const s = String(baseSlug ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, ID_SLUG_MAX).replace(/-+$/, '');
  return 'dt-' + createdOn.replace(/-/g, '') + '-' + (s || 'base');
}

/** A base slug from its label (accents dropped, ≤ 60). */
export const baseSlugOf = (label) => String(label ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'base';

/** daytripPayload({ trip, base, createdOn, maxMinutes, date, ranked }) → the `daytrip` payload; throws when invalid. */
export function daytripPayload({ trip = null, base = {}, createdOn, maxMinutes, date: day, ranked = {} } = {}) {
  const label = String(base.label ?? '').replace(/\s+/g, ' ').trim();
  const bslug = typeof base.slug === 'string' && SLUG_RE.test(base.slug) ? base.slug : baseSlugOf(label);
  const p = { v: 1, id: dayTripId(createdOn, bslug), trip: trip || null, base: { label, slug: bslug }, created_on: createdOn, max_minutes: maxMinutes };
  if (day) p.date = day;
  p.items = Array.isArray(ranked.items) ? ranked.items : [];
  if (ranked.more > 0) p.more = ranked.more;
  p.left_out = Array.isArray(ranked.left_out) ? ranked.left_out : [];
  const errs = validateDaytripPayload(p).concat(validateSubset(p, DAYTRIP_SCHEMA).map((e) => e.path + ': ' + e.message));
  if (errs.length) throw new Error('daytrip payload is invalid: ' + [...new Set(errs)].join('; '));
  return p;
}

// Developed by: LightAISolutions

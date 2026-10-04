/**
 * Tour Guide — Menu check: the `menu` envelope payload (Contract C16, TG-PHASE-16 WP-16b).
 * validateMenuPayload mirrors the core's tgEnvValidateMenu (gas/44_menu.js) rule for rule and message for message, and
 * schemas/tour-guide-menu.schema.json says the same; tests/pack_tour-guide_menu.test.js holds the three to one answer.
 * Own data only: every Google field is refused by name (the core's tgScoutGoogleKeys list), a dish's price is the menu's
 * own words, and the whole payload stays under 12 000 characters.
 *   menuId(createdOn, slug) → 'mn-YYYYMMDD-<place slug ≤ 40>'
 *   menuPayload({ trip, createdOn, date, place, checked, read, diet, dishes, others, sources }) → a valid payload; throws
 *   checkMenu(p) → [{ path, message }] — the rules the schema subset cannot say (`ask` exactly on the dishes to ask about,
 *                  a source unless nothing was found, real dates, no Google field, size), for schemas/index.mjs
 * Self-contained (reads its schema file and uses the brochure kit's validator subset, as daytrip-payload.mjs does), so
 * schemas/index.mjs can import checkMenu without an import cycle.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSubset } from '../../../kits/brochure/lib/validate.mjs';
import { googleKeys } from '../daytrip/daytrip-payload.mjs';
import { MENU, COURSES, DISH_FITS, FITS, menuFits, menuNote, sortDishes } from './menu-check.mjs';

export const MENU_SCHEMA = Object.freeze(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas', 'tour-guide-menu.schema.json'), 'utf8')));
export const ID_RE = /^mn-\d{8}-[a-z0-9-]{1,40}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const PAYLOAD_MAX = 12000;   // C16: a check is one card and one Sheet cell, far under the envelope's 60 000
export const NOTE_MAX = MENU.NOTE_MAX;
const ENV_MAX = 60000;              // the core's TG_ENV_DIGEST_MAX_CHARS
const MAX_ERRORS = 20;              // the core's TG_ENV_MAX_ERRORS
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const URL_RE = /^https:\/\/\S+$/;
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
const ID_SLUG_MAX = 40;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

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
const done = (errs) => (errs.length > MAX_ERRORS ? errs.slice(0, MAX_ERRORS).concat(['… ' + (errs.length - MAX_ERRORS) + ' more']) : errs);

function dish(errs, at, d) {
  if (!obj(errs, at, d, ['name', 'course', 'fits'], ['local', 'ask', 'price'])) return;
  if (d.name !== undefined) str(errs, at + '.name', d.name, 1, 80);
  if (d.local !== undefined) str(errs, at + '.local', d.local, 1, 80);
  if (d.course !== undefined) enumv(errs, at + '.course', d.course, COURSES);
  if (d.fits !== undefined) enumv(errs, at + '.fits', d.fits, DISH_FITS);
  if (d.ask !== undefined) str(errs, at + '.ask', d.ask, 1, 120);
  if (d.price !== undefined) str(errs, at + '.price', d.price, 1, 40);
  if (d.fits === 'ask' && d.ask === undefined) errs.push(at + '.ask required when fits is ask');
  if (d.fits === 'yes' && d.ask !== undefined) errs.push(at + '.ask only when fits is ask');
}

/** validateMenuPayload(p) → string[] (empty = valid); the same rules and words as the core's validator. */
export function validateMenuPayload(p) {
  const errs = [];
  if (!isObj(p)) return ['payload must be an object'];
  googleKeys(p, '').forEach((k) => errs.push(k + ': Google field refused (own data only)'));
  if (!obj(errs, 'payload', p, ['id', 'trip', 'created_on', 'place', 'checked', 'fits', 'note', 'diet', 'dishes', 'sources'], ['v', 'date', 'others'])) return done(errs);
  if (p.v !== undefined && p.v !== 1) errs.push('v must be 1');
  if (p.id !== undefined) str(errs, 'id', p.id, 1, 52, ID_RE);
  if (p.trip !== undefined && p.trip !== null) slug(errs, 'trip', p.trip);
  if (p.created_on !== undefined) date(errs, 'created_on', p.created_on);
  if (p.date !== undefined) date(errs, 'date', p.date);
  if (p.place !== undefined && obj(errs, 'place', p.place, ['name', 'slug'], ['place_id', 'local_name'])) {
    if (p.place.name !== undefined) str(errs, 'place.name', p.place.name, 1, 120);
    if (p.place.slug !== undefined) slug(errs, 'place.slug', p.place.slug);
    if (p.place.place_id !== undefined) str(errs, 'place.place_id', p.place.place_id, 6, 300, PLACE_ID_RE);
    if (p.place.local_name !== undefined) str(errs, 'place.local_name', p.place.local_name, 1, 80);
  }
  if (p.checked !== undefined) date(errs, 'checked', p.checked);
  if (p.fits !== undefined) enumv(errs, 'fits', p.fits, FITS);
  if (p.note !== undefined) str(errs, 'note', p.note, 1, NOTE_MAX);
  if (p.diet !== undefined) str(errs, 'diet', p.diet, 1, 80);
  if (p.dishes !== undefined && arr(errs, 'dishes', p.dishes, MENU.DISHES)) p.dishes.forEach((d, i) => dish(errs, 'dishes[' + i + ']', d));
  if (p.others !== undefined) int(errs, 'others', p.others, 0, MENU.OTHERS_MAX);
  if (p.sources !== undefined && arr(errs, 'sources', p.sources, MENU.SOURCES_MAX)) {
    p.sources.forEach((s, i) => {
      const at = 'sources[' + i + ']';
      if (!obj(errs, at, s, ['title', 'url'])) return;
      if (s.title !== undefined) str(errs, at + '.title', s.title, 1, 120);
      if (s.url !== undefined) url(errs, at + '.url', s.url);
    });
    if (!p.sources.length && p.fits !== 'unknown') errs.push('sources: at least 1 entry unless fits is unknown');
  }
  const n = JSON.stringify(p).length;
  if (n > ENV_MAX) errs.push('payload is ' + n + ' chars (max ' + ENV_MAX + ')');
  if (n > PAYLOAD_MAX) errs.push('payload is ' + n + ' chars (max ' + PAYLOAD_MAX + ')');
  return done(errs);
}

/** The rules the schema subset cannot state, as [{ path, message }], for schemas/index.mjs (KINDS.menu). */
export function checkMenu(p) {
  return validateMenuPayload(p).map((m) => ({ path: '/', message: m }));
}

/** 'mn-YYYYMMDD-<slug>': the run's local date and the place's slug cut to 40 ('place' when nothing is left). */
export function menuId(createdOn, placeSlug) {
  if (!realDate(createdOn)) throw new Error(`menu: createdOn must be a calendar date YYYY-MM-DD (got ${JSON.stringify(createdOn)})`);
  const s = String(placeSlug ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, ID_SLUG_MAX).replace(/-+$/, '');
  return 'mn-' + createdOn.replace(/-/g, '') + '-' + (s || 'place');
}

const tidy = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
/** A dish in the payload's shape: its own words tidied, `ask` only on a dish to ask about, empty optional words dropped. */
function dishOut(d) {
  const o = { name: tidy(d.name) };
  if (tidy(d.local)) o.local = tidy(d.local);
  o.course = d.course;
  o.fits = d.fits;
  if (d.fits === 'ask') o.ask = tidy(d.ask);
  if (tidy(d.price)) o.price = tidy(d.price);
  return o;
}

/**
 * menuPayload({ trip, createdOn, date?, place: { name, slug, place_id?, local_name? }, checked, read, diet, dishes, others?, sources })
 * → the `menu` payload. Dishes that do not fit (`fits` other than yes or ask) are counted in `others`, never listed; the
 * rest are sorted (sortDishes), the first MENU.DISHES kept and the remainder added to `others` (capped at OTHERS_MAX).
 * `fits` and `note` come from menuFits and menuNote. Throws listing every problem.
 */
export function menuPayload({ trip = null, createdOn, date: day, place = {}, checked, read = true, diet = '', dishes = [], others = 0, sources = [] } = {}) {
  const given = Array.isArray(dishes) ? dishes.filter(isObj) : [];
  const listed = given.filter((d) => DISH_FITS.includes(d.fits));
  const sorted = sortDishes(listed).map(dishOut);
  const kept = sorted.slice(0, MENU.DISHES);
  const extra = (Number.isInteger(others) && others > 0 ? others : 0) + (given.length - listed.length) + (sorted.length - kept.length);
  const fits = menuFits(sorted, { read: !!read, others: extra });
  const pl = { name: tidy(place.name), slug: String(place.slug ?? '') };
  if (place.place_id) pl.place_id = String(place.place_id);
  if (tidy(place.local_name)) pl.local_name = tidy(place.local_name);
  const p = { v: 1, id: menuId(createdOn, pl.slug), trip: trip || null, created_on: createdOn };
  if (day) p.date = day;
  p.place = pl;
  p.checked = checked;
  p.fits = fits;
  p.note = menuNote({ fits, dishes: kept, diet: tidy(diet) });
  p.diet = tidy(diet);
  p.dishes = fits === 'unknown' ? [] : kept;
  if (fits !== 'unknown' && extra > 0) p.others = Math.min(MENU.OTHERS_MAX, extra);
  p.sources = (Array.isArray(sources) ? sources : []).filter(isObj).slice(0, MENU.SOURCES_MAX).map((s) => ({ title: tidy(s.title), url: String(s.url ?? '') }));
  const errs = validateMenuPayload(p).concat(validateSubset(p, MENU_SCHEMA).map((e) => e.path + ': ' + e.message));
  if (errs.length) throw new Error('menu payload is invalid: ' + [...new Set(errs)].join('; '));
  return p;
}

// Developed by: LightAISolutions

/**
 * Tour Guide — Quiet: the `quiet` envelope payload (Contract C16, TG-PHASE-16 WP-16a).
 * validateQuietPayload mirrors the core's tgEnvValidateQuiet (gas/43_quiet.js) rule for rule and message for message,
 * and schemas/tour-guide-quiet.schema.json says the same; tests/pack_tour-guide_quiet.test.js holds the three to one
 * answer. Own data only: every Google field is refused by name (the core's tgScoutGoogleKeys list, through Day trip's
 * googleKeys), and the whole payload stays under 12 000 characters.
 *   quietId(createdOn, slug) → 'qt-YYYYMMDD-<magnet slug ≤ 40>'
 *   quietPayload({ trip, createdOn, date?, magnet: { name, slug?, place_id?, kind, busy, quiet, source? }, ranked }) →
 *     a valid payload; throws listing every problem
 *   checkQuiet(p) → [{ path, message }] — the rules the schema subset cannot say (rank order, unique slugs and labels,
 *     real dates, Google fields, size), for schemas/index.mjs KINDS.quiet
 * Self-contained apart from Day trip's googleKeys (which imports nothing from schemas/index.mjs), so schemas/index.mjs
 * can import checkQuiet without an import cycle.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSubset } from '../../../kits/brochure/lib/validate.mjs';
import { googleKeys } from '../daytrip/daytrip-payload.mjs';
import { LABELS, REASONS, QUIETER, MODES, QUIET } from './quiet-rank.mjs';

export const QUIET_SCHEMA = Object.freeze(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas', 'tour-guide-quiet.schema.json'), 'utf8')));
export const ID_RE = /^qt-\d{8}-[a-z0-9-]{1,40}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const PAYLOAD_MAX = 12000;
const ENV_MAX = 60000;              // the core's TG_ENV_DIGEST_MAX_CHARS
const MAX_ERRORS = 20;              // the core's TG_ENV_MAX_ERRORS
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const URL_RE = /^https:\/\/\S+$/;
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
const ID_SLUG_MAX = 40;
const PARTS = ['quiet', 'quality', 'fit', 'local', 'reach'];

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
  if (!obj(errs, at, it, ['n', 'slug', 'name', 'kind', 'reach', 'quieter', 'why', 'score', 'parts', 'labels', 'maps_url'], ['place_id', 'best'])) return;
  if (it.n !== undefined) int(errs, at + '.n', it.n, 1, QUIET.ITEMS);
  if (it.slug !== undefined) slug(errs, at + '.slug', it.slug);
  if (it.name !== undefined) str(errs, at + '.name', it.name, 1, 120);
  if (it.place_id !== undefined) str(errs, at + '.place_id', it.place_id, 6, 300, PLACE_ID_RE);
  if (it.kind !== undefined) str(errs, at + '.kind', it.kind, 1, 40);
  if (it.reach !== undefined && obj(errs, at + '.reach', it.reach, ['minutes', 'mode', 'estimated'])) {
    if (it.reach.minutes !== undefined) int(errs, at + '.reach.minutes', it.reach.minutes, 0, 180);
    if (it.reach.mode !== undefined) enumv(errs, at + '.reach.mode', it.reach.mode, MODES);
    if (it.reach.estimated !== undefined) bool(errs, at + '.reach.estimated', it.reach.estimated);
  }
  if (it.quieter !== undefined) enumv(errs, at + '.quieter', it.quieter, QUIETER);
  if (it.why !== undefined) str(errs, at + '.why', it.why, 1, 200);
  if (it.best !== undefined) str(errs, at + '.best', it.best, 1, 120);
  if (it.score !== undefined) int(errs, at + '.score', it.score, 0, 100);
  if (it.parts !== undefined && obj(errs, at + '.parts', it.parts, PARTS)) {
    PARTS.forEach((k) => { if (it.parts[k] !== undefined) int(errs, at + '.parts.' + k, it.parts[k], 0, 100); });
  }
  if (it.labels !== undefined && arr(errs, at + '.labels', it.labels, QUIET.LABELS_MAX)) {
    it.labels.forEach((l, j) => enumv(errs, at + '.labels[' + j + ']', l, LABELS));
    it.labels.forEach((l, j) => { if (it.labels.indexOf(l) !== j) errs.push(at + '.labels[' + j + ']: duplicate label'); });
  }
  if (it.maps_url !== undefined) url(errs, at + '.maps_url', it.maps_url);
}

/** validateQuietPayload(p) → string[] (empty = valid); the same rules and words as the core's validator. */
export function validateQuietPayload(p) {
  const errs = [];
  if (!isObj(p)) return ['payload must be an object'];
  googleKeys(p, '').forEach((k) => errs.push(k + ': Google field refused (own data only)'));
  if (!obj(errs, 'payload', p, ['id', 'trip', 'created_on', 'magnet', 'items', 'left_out'], ['v', 'date', 'more'])) return done(errs);
  if (p.v !== undefined && p.v !== 1) errs.push('v must be 1');
  if (p.id !== undefined) str(errs, 'id', p.id, 1, 52, ID_RE);
  if (p.trip !== undefined && p.trip !== null) slug(errs, 'trip', p.trip);
  if (p.created_on !== undefined) date(errs, 'created_on', p.created_on);
  if (p.date !== undefined) date(errs, 'date', p.date);
  if (p.magnet !== undefined && obj(errs, 'magnet', p.magnet, ['name', 'slug', 'kind', 'busy', 'quiet'], ['place_id', 'source'])) {
    const m = p.magnet;
    if (m.name !== undefined) str(errs, 'magnet.name', m.name, 1, 120);
    if (m.slug !== undefined) slug(errs, 'magnet.slug', m.slug);
    if (m.place_id !== undefined) str(errs, 'magnet.place_id', m.place_id, 6, 300, PLACE_ID_RE);
    if (m.kind !== undefined) str(errs, 'magnet.kind', m.kind, 1, 40);
    if (m.busy !== undefined) bool(errs, 'magnet.busy', m.busy);
    if (m.quiet !== undefined) str(errs, 'magnet.quiet', m.quiet, 1, 160);
    if (m.source !== undefined && obj(errs, 'magnet.source', m.source, ['title', 'url'])) {
      if (m.source.title !== undefined) str(errs, 'magnet.source.title', m.source.title, 1, 120);
      if (m.source.url !== undefined) url(errs, 'magnet.source.url', m.source.url);
    }
  }
  if (p.more !== undefined) int(errs, 'more', p.more, 0, QUIET.MORE_MAX);
  if (p.items !== undefined && arr(errs, 'items', p.items, QUIET.ITEMS)) {
    p.items.forEach((it, i) => {
      item(errs, 'items[' + i + ']', it);
      if (isObj(it) && typeof it.n === 'number' && it.n !== i + 1) errs.push('items[' + i + '].n must be ' + (i + 1) + ' (rank order)');
    });
    dupes(errs, 'items', p.items, 'slug', 'slug');
  }
  if (p.left_out !== undefined && arr(errs, 'left_out', p.left_out, QUIET.LEFT_MAX)) {
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

/** The rules the schema subset cannot state, as [{ path, message }], for schemas/index.mjs (KINDS.quiet; a REQUEST of WP-16a). */
export function checkQuiet(p) {
  return validateQuietPayload(p).map((m) => ({ path: '/', message: m }));
}

/** 'qt-YYYYMMDD-<slug>': the run's local date and the magnet's slug cut to 40 ('place' when nothing is left). */
export function quietId(createdOn, magnetSlug) {
  if (!realDate(createdOn)) throw new Error(`quiet: createdOn must be a calendar date YYYY-MM-DD (got ${JSON.stringify(createdOn)})`);
  const s = String(magnetSlug ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, ID_SLUG_MAX).replace(/-+$/, '');
  return 'qt-' + createdOn.replace(/-/g, '') + '-' + (s || 'place');
}

/** A magnet slug from its name (accents dropped, ≤ 60). */
export const magnetSlugOf = (name) => String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'place';

const clean = (s, max) => { const t = String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };

/** quietPayload({ trip, createdOn, date, magnet, ranked }) → the `quiet` payload; throws when invalid. */
export function quietPayload({ trip = null, createdOn, date: day, magnet = {}, ranked = {} } = {}) {
  const name = clean(magnet.name, 120);
  const mslug = typeof magnet.slug === 'string' && SLUG_RE.test(magnet.slug) ? magnet.slug : magnetSlugOf(name);
  const m = { name, slug: mslug };
  if (typeof magnet.place_id === 'string' && PLACE_ID_RE.test(magnet.place_id)) m.place_id = magnet.place_id;
  m.kind = clean(magnet.kind, 40);
  m.busy = magnet.busy === true;
  m.quiet = clean(magnet.quiet, 160);
  if (isObj(magnet.source)) m.source = { title: clean(magnet.source.title, 120), url: String(magnet.source.url ?? '') };
  const p = { v: 1, id: quietId(createdOn, mslug), trip: trip || null, created_on: createdOn };
  if (day) p.date = day;
  p.magnet = m;
  p.items = Array.isArray(ranked.items) ? ranked.items : [];
  if (ranked.more > 0) p.more = ranked.more;
  p.left_out = Array.isArray(ranked.left_out) ? ranked.left_out : [];
  const errs = validateQuietPayload(p).concat(validateSubset(p, QUIET_SCHEMA).map((e) => e.path + ': ' + e.message));
  if (errs.length) throw new Error('quiet payload is invalid: ' + [...new Set(errs)].join('; '));
  return p;
}

// Developed by: LightAISolutions

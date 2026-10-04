/**
 * Tour Guide Scout — what persists (helpers/decisions/TG-SCOUT.md §3 and §5): the `scout` envelope payload and the
 * Place fields for places/<slug>.md. Own data only: our scores, our words, a rating band word, our reach estimate, a
 * Maps link. No Google field is copied; `assertNoGoogleKeys` walks the whole payload and refuses one.
 */
import { slugFor, SLUG_RE } from '../gems/gems-record.mjs';
import { GOOGLE_FIELDS } from '../gems/gems-project.mjs';
import { ratingBand } from '../gems/gems-line.mjs';
import { placeUrl } from '../../../kits/maps/lib/maps-urls.mjs';
import { validatePayload, assertValid, formatErrors, isDate } from '../schemas/index.mjs';
import { LEFT_OUT_MAX, LABELS, LABELS_MAX } from './scout-weights.mjs';
import { ownName } from './scout-rank.mjs';

const CATEGORY_RE = /^[a-z][a-z0-9-]{0,31}$/;
const clip = (s, max) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };
const own = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const pct = (x) => Math.min(100, Math.max(0, Math.round(100 * (Number(x) || 0))));

/** Keys that are Google content (gems GOOGLE_FIELDS, minus `name`, which items legitimately carry, plus the scout extras). */
export const SCOUT_GOOGLE_KEYS = Object.freeze([...GOOGLE_FIELDS.filter((k) => k !== 'name'),
  'record', 'photo', 'photos', 'editorial', 'editorialSummary', 'serves_vegetarian', 'servesVegetarianFood', 'weekdayDescriptions', 'weekday_descriptions', 'count', 'formatted_address', 'currentOpeningHours']);

/** assertNoGoogleKeys(obj, where) → obj, or throws when any object anywhere inside carries a SCOUT_GOOGLE_KEYS key. */
export function assertNoGoogleKeys(obj, where = 'scout payload') {
  const walk = (v, path) => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}/${i}`)); return; }
    if (!v || typeof v !== 'object') return;
    for (const k of Object.keys(v)) {
      if (SCOUT_GOOGLE_KEYS.includes(k)) throw new Error(`scout: ${where} carries Google content at ${path}/${k}; only our own scores and words persist`);
      walk(v[k], `${path}/${k}`);
    }
  };
  walk(obj, '');
  return obj;
}

/** An item's labels: its own, plus `seen_before` when its place id is known; schema order, each once, ≤ 8. */
function labelsOf(it, known) {
  const set = new Set(Array.isArray(it.labels) ? it.labels : []);
  if (it.place_id && known.has(it.place_id)) set.add('seen_before');
  return [...LABELS.filter((l) => set.has(l)), ...[...set].filter((l) => !LABELS.includes(l))].slice(0, LABELS_MAX);
}

function uniqueSlug(base, used) {
  const root = SLUG_RE.test(base) ? base : 'place';
  let s = root;
  for (let k = 2; used.has(s); k++) s = `${root.slice(0, 64 - String(k).length - 1).replace(/-+$/, '')}-${k}`;
  used.add(s);
  return s;
}

/**
 * scoutPayload({ scout_id, query, destination, place_label, trip?, group, created_on, from?, diet?, ranked,
 *                slugs?, areas?, categories?, drive?, known? }) → the `scout` payload, validated (throws on any schema error or
 * any Google field). `ranked` is rankScout's result. Slugs come from `slugs[place_id]` (else the record's slug or
 * the item's name), de-duplicated with -2, -3…; the category from `categories`, else the record's, else 'other';
 * `rated` is our band word for the rating; `diet` is kept for food only. An item's `name` is the place's own name when
 * the judgment gave one (rankScout's `own_name`), else Google's, shown for this board only. `known` (place ids already
 * in the owner's Places, an array or a Set) labels those items `seen_before`, as rankScout does (TG-PHASE-13 WP-13d).
 */
export function scoutPayload(a = {}) {
  const ranked = a.ranked;
  if (!ranked || !Array.isArray(ranked.items) || !Array.isArray(ranked.left_out)) throw new Error('scout: scoutPayload needs `ranked` (the rankScout result)');
  const slugs = a.slugs || {}, areas = a.areas || {}, categories = a.categories || {};
  const group = a.group || ranked.group;
  const known = a.known instanceof Set ? a.known : new Set(Array.isArray(a.known) ? a.known : []);
  const used = new Set();
  const items = ranked.items.map((it, i) => {
    const rec = it.record || {};
    const wanted = own(slugs, it.place_id) && SLUG_RE.test(String(slugs[it.place_id])) ? String(slugs[it.place_id]) : slugFor({ ...rec, name: it.name, place_id: it.place_id, slug: rec.slug });
    const cat = own(categories, it.place_id) && CATEGORY_RE.test(String(categories[it.place_id])) ? String(categories[it.place_id]) : CATEGORY_RE.test(String(rec.category)) ? rec.category : 'other';
    const out = {
      n: i + 1, slug: uniqueSlug(wanted, used), name: clip(it.name, 120) || 'Unnamed place', area: clip(own(areas, it.place_id) ? areas[it.place_id] : '', 80), category: cat,
      score: Math.min(100, Math.max(0, Math.round(Number(it.score) || 0))),
      parts: { topic: pct(it.parts && it.parts.topic), quality: pct(it.parts && it.parts.quality), fit: pct(it.parts && it.parts.fit), reach: pct(it.parts && it.parts.reach) },
      why_you: clip(it.why, 200) || `A match for ${clip(a.query, 60)}.`,
      labels: labelsOf(it, known)
    };
    if (it.try) out.try = clip(it.try, 120);
    if (Number.isFinite(rec.rating) && rec.rating_count > 0) out.rated = ratingBand(rec.rating);
    if (it.reach && Number.isFinite(it.reach.minutes)) out.reach = { minutes: Math.min(600, Math.max(0, Math.round(it.reach.minutes))), mode: it.reach.mode, estimated: it.reach.estimated === true };
    out.maps_url = placeUrl({ name: it.name, placeId: it.place_id });
    out.place_id = it.place_id;
    return out;
  });
  const p = { v: 1, kind: 'scout', scout_id: a.scout_id, query: clip(a.query, 80), destination: a.destination, place_label: clip(a.place_label, 80) };
  if (a.trip) p.trip = a.trip;
  p.group = group;
  p.created_on = a.created_on;
  if (a.from) p.from = clip(a.from, 80);
  if (group === 'food' && typeof a.diet === 'string' && a.diet.trim()) p.diet = clip(a.diet, 80);
  p.items = items;
  p.left_out = ranked.left_out.slice(0, LEFT_OUT_MAX).map((l) => ({ name: clip(l.name, 120) || 'Unnamed place', reason: l.reason }));
  const more = Number.isInteger(ranked.more) ? ranked.more : 0;
  if (more > 0) p.more = Math.min(1000, more);
  if (a.drive && typeof a.drive === 'object') {
    const d = {};
    for (const k of ['board_html', 'board_pdf']) if (own(a.drive, k)) d[k] = a.drive[k];
    p.drive = d;
  }
  assertNoGoogleKeys(p);
  const r = validatePayload('scout', p);
  if (!r.ok) throw Object.assign(new Error('scout: the scout payload is invalid:\n' + formatErrors(r.errors)), { errors: r.errors });
  return p;
}

const HISTORY_MAX = 200, TAGS_MAX = 20;
/** queryTag(query) → the query as a Place tag: lower-case, single spaces, ≤ 40 chars. */
export const queryTag = (query) => clip(String(query ?? '').toLowerCase(), 40).replace(/…$/, '').trim();

/**
 * scoutPlaceFields(item, { query, trip?, scout_id, on, existing?, destination?, own_name? }) → { place, entry, changed },
 * or { place: null, reason: 'no_own_name' } for a new place without an own name.
 * `item` is one payload item. A new place takes its name from `own_name` — the judgment's `name`: the place's own name
 * from its own site or a local source, ≤ 120 — and never from Google (the repo keeps only Google's place id; review
 * B9); without one it is not written to places/ and the caller counts it. A new place: status candidate, tags
 * [scout, <query>], why_fit = why_you, activity = the try line or the query, priority 2, source_trip = trip,
 * destination, gem when labelled. An existing place keeps every field it has (its name, status, priority, notes…),
 * gains the two tags and only the fields it lacks, with or without an own name. Both get one history entry
 * { trip: trip || scout_id, on, event: 'scouted', note: '<query> #<n>' }, added once (re-running is a no-op).
 * The result is validated as a Place (throws when invalid).
 */
export function scoutPlaceFields(item, o = {}) {
  if (!item || typeof item !== 'object') throw new Error('scout: scoutPlaceFields needs a payload item');
  if (!isDate(o.on)) throw new Error(`scout: scoutPlaceFields needs \`on\` as a calendar date (got ${JSON.stringify(o.on)})`);
  const query = clip(o.query, 80);
  if (!query) throw new Error('scout: scoutPlaceFields needs `query`');
  const histTrip = o.trip || o.scout_id;
  if (!histTrip || !SLUG_RE.test(String(histTrip))) throw new Error('scout: scoutPlaceFields needs a trip slug or the scout_id');
  const entry = { trip: String(histTrip), on: o.on, event: 'scouted', note: clip(`${query} #${item.n}`, 120) };
  const base = o.existing ? JSON.parse(JSON.stringify(o.existing)) : null;
  let place;
  if (base) {
    place = base;
    if (o.existing.place_id && item.place_id && o.existing.place_id !== item.place_id) throw new Error(`scout: ${item.slug} already names another place id`);
  } else {
    if (!item.place_id) throw new Error(`scout: a new place needs the item's place_id (${item.slug})`);
    const name = ownName(o.own_name);
    if (!name) return { place: null, reason: 'no_own_name' };
    place = { v: 1, id: item.slug, place_id: item.place_id, name, category: item.category, tags: [], status: 'candidate', activity: clip(item.try || query, 120), priority: 2 };
  }
  place.tags = [...new Set([...(place.tags || []), 'scout', queryTag(query)].filter(Boolean))].slice(0, TAGS_MAX);
  if (!place.why_fit && item.why_you) place.why_fit = clip(item.why_you, 1000);
  if (!place.activity) place.activity = clip(item.try || query, 120);
  if (!place.destination && o.destination) place.destination = o.destination;
  if (!place.source_trip && o.trip) place.source_trip = o.trip;
  if (place.gem === undefined && (item.labels || []).includes('gem')) place.gem = true;
  const history = Array.isArray(place.history) ? place.history : [];
  const dup = history.some((h) => h.trip === entry.trip && h.on === entry.on && h.event === entry.event && h.note === entry.note);
  if (!dup) place.history = [...history, entry].slice(-HISTORY_MAX);
  assertValid(place, 'place');
  const changed = !base || JSON.stringify(place) !== JSON.stringify(o.existing);
  return { place, entry, changed };
}

// Developed by: LightAISolutions

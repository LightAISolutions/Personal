/**
 * Gem Funnel — the pool record: what the skill assembles per place from the stream results (proposal §4 stage 1) and
 * what every later stage reads. `normalizeRecord` validates defensively and returns a clean copy; `fromSearchResult`
 * maps a raw Places (New) search result into one. Reviews, when present, are in-run inputs only: no function in gems/
 * ever copies review text into an output, and the record keeps only publish_time, rating and (optionally) the author
 * attribution the display layer needs.
 */
import { LOCAL_MENTION_KINDS, LOCAL_MENTIONS_MAX, LOCAL_MENTION_REF_MAX, ROUGH_EDGES, LOCAL_FAVOURITE_MIN_PUBLISHERS } from './gems-weights.mjs';
import { isLatLng } from './gems-geo.mjs';
import { hoursKnown } from './gems-hours.mjs';
import { refineCategory } from '../planner/planner-category.mjs';

export const STREAMS = Object.freeze(['taste', 'local', 'quiet', 'owner_seed']);
export const BUSINESS_STATUSES = Object.freeze(['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY', 'BUSINESS_STATUS_UNSPECIFIED']);
export const PRICE_LEVELS = Object.freeze(['PRICE_LEVEL_UNSPECIFIED', 'PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE']);
export const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const LANGUAGE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
export const LEDGER_REF_RE = /^L\d{3,}(\.\d{1,3})?$/;
export const TYPE_RE = /^[a-z][a-z0-9_]{0,63}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/** Pack categories a record may carry (`category`), with the Google types that imply each one. First match wins. */
export const CATEGORY_TYPES = Object.freeze({
  restaurant: ['restaurant', 'meal_takeaway', 'meal_delivery', 'food'],
  cafe: ['cafe', 'coffee_shop', 'bakery', 'tea_house', 'dessert_shop', 'ice_cream_shop'],
  bar: ['bar', 'pub', 'wine_bar', 'night_club'],
  market: ['market', 'grocery_store', 'food_market', 'flea_market'],
  museum: ['museum', 'art_gallery', 'history_museum', 'art_museum', 'planetarium', 'aquarium'],
  garden: ['garden', 'botanical_garden'],
  park: ['park', 'national_park', 'hiking_area', 'beach'],
  viewpoint: ['observation_deck', 'scenic_spot', 'lookout'],
  temple: ['buddhist_temple', 'hindu_temple'],
  shrine: ['shinto_shrine'],
  church: ['church', 'mosque', 'synagogue', 'place_of_worship'],
  experience: ['cultural_center'],
  shop: ['store', 'book_store', 'clothing_store', 'gift_shop', 'shopping_mall', 'home_goods_store'],
  neighbourhood: ['neighborhood', 'neighbourhood', 'historical_landmark', 'tourist_attraction']
});
export const FOOD_CATEGORIES = Object.freeze(['restaurant', 'cafe', 'bar', 'market']);

const err = (m) => new Error('gems: ' + m);

/** categoryOf(record) → the record's own `category`, else the first CATEGORY_TYPES match on primary_type then types, else 'other'. */
export function categoryOf(record) {
  if (record.category) return record.category === 'church' ? refineCategory(record) : record.category;   // a legacy church named "…-ji" is a temple
  const types = [record.primary_type, ...(record.types || [])].filter(Boolean);
  for (const t of types) for (const [cat, list] of Object.entries(CATEGORY_TYPES)) if (list.includes(t)) return cat;
  return 'other';
}
/** groupOf(record) → 'food' | 'activities' (the shortlist's two groups). */
export function groupOf(record) { return FOOD_CATEGORIES.includes(categoryOf(record)) ? 'food' : 'activities'; }

/** slugFor(record) → record.slug, else a deterministic slug from the name (fallback: the place id, lower-cased). */
export function slugFor(record) {
  if (record.slug) return record.slug;
  const fromName = String(record.name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
  if (SLUG_RE.test(fromName)) return fromName;
  const fromId = String(record.place_id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
  return SLUG_RE.test(fromId) ? fromId : 'place-' + fromId.replace(/[^a-z0-9]/g, '').slice(0, 58);
}

function normalizeMention(m, i) {
  if (!m || typeof m !== 'object') throw err(`local_mentions[${i}] must be an object`);
  const ref = String(m.ref ?? '').trim();
  if (!ref || ref.length > LOCAL_MENTION_REF_MAX) throw err(`local_mentions[${i}].ref must be 1–${LOCAL_MENTION_REF_MAX} characters`);
  const language = String(m.language ?? '').trim().replace(/^([A-Za-z]{2,3})/, (s) => s.toLowerCase());
  if (!LANGUAGE_RE.test(language)) throw err(`local_mentions[${i}].language must be a BCP-47-like tag (got ${JSON.stringify(m.language)})`);
  if (!LOCAL_MENTION_KINDS.includes(m.kind)) throw err(`local_mentions[${i}].kind must be one of ${LOCAL_MENTION_KINDS.join(', ')}`);
  const out = { ref, language, kind: m.kind };
  // Optional publisher (the research kit's `publisher` / host of the mention): mentions from one publisher count once,
  // so fifty posts on one blog cannot buy a 💎 (WP-6b red team). Anything else on the mention is dropped here.
  if (m.publisher !== undefined && m.publisher !== null) {
    const publisher = String(m.publisher).trim().toLowerCase();
    if (!publisher || publisher.length > LOCAL_MENTION_REF_MAX) throw err(`local_mentions[${i}].publisher must be 1–${LOCAL_MENTION_REF_MAX} characters when given`);
    out.publisher = publisher;
  }
  return out;
}
function normalizeReview(r, i) {
  if (!r || typeof r !== 'object') throw err(`reviews[${i}] must be an object`);
  if (!ISO_RE.test(String(r.publish_time))) throw err(`reviews[${i}].publish_time must be an ISO timestamp`);
  if (!(Number.isFinite(r.rating) && r.rating >= 1 && r.rating <= 5)) throw err(`reviews[${i}].rating must be 1–5`);
  const out = { publish_time: String(r.publish_time), rating: r.rating };
  if (r.author != null) out.author = String(r.author).slice(0, 120);
  return out; // deliberately no `text`: review text never enters a record
}
function optionalNumber(v, name, { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (v === undefined || v === null) return undefined;
  if (!Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) throw err(`${name} must be a${integer ? 'n integer' : ' number'} in [${min}, ${max}] (got ${JSON.stringify(v)})`);
  return v;
}

/**
 * normalizeRecord(raw) → a validated, frozen-shape copy of a pool record:
 *   { place_id, name, types[], primary_type?, category, rating?, rating_count?, price_level?, business_status,
 *     location {lat,lng} | null, hours?, website?, streams[], local_mentions[], mass_tourism_rank?, reviews?,
 *     slug?, friction[], signals? }
 * Throws `gems: …` on nonsense. Unknown keys are dropped.
 */
export function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') throw err('a pool record must be an object');
  if (!PLACE_ID_RE.test(String(raw.place_id ?? ''))) throw err(`place_id must be a Google place id (got ${JSON.stringify(raw.place_id)})`);
  const name = String(raw.name ?? '').trim();
  if (!name || name.length > 300) throw err(`record ${raw.place_id}: name must be 1–300 characters`);
  const types = raw.types === undefined ? [] : raw.types;
  if (!Array.isArray(types) || !types.every((t) => TYPE_RE.test(String(t)))) throw err(`record ${raw.place_id}: types must be an array of Google type names`);
  if (raw.primary_type != null && !TYPE_RE.test(String(raw.primary_type))) throw err(`record ${raw.place_id}: primary_type must be a Google type name`);
  if (raw.category != null && !/^[a-z][a-z0-9-]{0,31}$/.test(String(raw.category))) throw err(`record ${raw.place_id}: category must be a pack category slug`);
  const business_status = raw.business_status ?? 'BUSINESS_STATUS_UNSPECIFIED';
  if (!BUSINESS_STATUSES.includes(business_status)) throw err(`record ${raw.place_id}: business_status must be one of ${BUSINESS_STATUSES.join(', ')}`);
  if (raw.price_level != null && !PRICE_LEVELS.includes(raw.price_level)) throw err(`record ${raw.place_id}: price_level must be one of ${PRICE_LEVELS.join(', ')}`);
  if (raw.location != null && !isLatLng(raw.location)) throw err(`record ${raw.place_id}: location must be { lat, lng }`);
  if (raw.hours != null && !hoursKnown(raw.hours)) throw err(`record ${raw.place_id}: hours must carry periods[] or by_date{} (or be null)`);
  if (raw.website != null && !/^https?:\/\/\S+$/.test(String(raw.website))) throw err(`record ${raw.place_id}: website must be an http(s) URL`);
  const streams = raw.streams === undefined ? [] : raw.streams;
  if (!Array.isArray(streams) || !streams.every((s) => STREAMS.includes(s))) throw err(`record ${raw.place_id}: streams must be a subset of ${STREAMS.join(', ')}`);
  const mentions = raw.local_mentions === undefined || raw.local_mentions === null ? [] : raw.local_mentions;
  if (!Array.isArray(mentions)) throw err(`record ${raw.place_id}: local_mentions must be an array`);
  if (raw.slug != null && !SLUG_RE.test(String(raw.slug))) throw err(`record ${raw.place_id}: slug must match ${SLUG_RE}`);
  const friction = raw.friction === undefined || raw.friction === null ? [] : raw.friction;
  if (!Array.isArray(friction) || !friction.every((f) => ROUGH_EDGES.includes(f))) throw err(`record ${raw.place_id}: friction must be a subset of ${ROUGH_EDGES.join(', ')}`);
  if (raw.signals != null && typeof raw.signals !== 'object') throw err(`record ${raw.place_id}: signals must be an object of booleans`);
  const out = {
    place_id: String(raw.place_id), name, types: types.map(String), category: null,
    rating: optionalNumber(raw.rating, `record ${raw.place_id}: rating`, { min: 0, max: 5 }),
    rating_count: optionalNumber(raw.rating_count, `record ${raw.place_id}: rating_count`, { min: 0, integer: true }),
    business_status, location: raw.location ?? null, hours: raw.hours ?? null,
    streams: [...new Set(streams)], local_mentions: mentions.map(normalizeMention),
    mass_tourism_rank: optionalNumber(raw.mass_tourism_rank, `record ${raw.place_id}: mass_tourism_rank`, { min: 1, integer: true }),
    friction: [...new Set(friction)]
  };
  if (raw.primary_type != null) out.primary_type = String(raw.primary_type);
  if (raw.price_level != null) out.price_level = raw.price_level;
  if (raw.website != null) out.website = String(raw.website);
  if (raw.slug != null) out.slug = String(raw.slug);
  if (raw.reviews != null) { if (!Array.isArray(raw.reviews)) throw err(`record ${raw.place_id}: reviews must be an array`); out.reviews = raw.reviews.map(normalizeReview); }
  if (raw.signals != null) out.signals = Object.fromEntries(Object.entries(raw.signals).map(([k, v]) => [k, v === true]));
  out.category = raw.category ?? categoryOf(out);
  return out;
}

/** normalizePool(pool) → normalized records; throws on a duplicate place_id (dedupe is the skill's job, stage 1). */
export function normalizePool(pool) {
  if (!Array.isArray(pool)) throw err('pool must be an array of records');
  const seen = new Set();
  return pool.map((r, i) => {
    const n = normalizeRecord(r);
    if (seen.has(n.place_id)) throw err(`pool[${i}]: duplicate place_id ${n.place_id} (dedupe by place id first)`);
    seen.add(n.place_id);
    return n;
  });
}

/**
 * fromSearchResult(place, { streams, local_mentions?, slug? }) → a pool record from a raw Places (New) Text Search /
 * Nearby Search result (displayName.text, types, primaryType, rating, userRatingCount, priceLevel, businessStatus,
 * location.latitude/longitude, regularOpeningHours, websiteUri, reviews[].publishTime/rating/authorAttribution).
 */
export function fromSearchResult(place, { streams = [], local_mentions = [], slug } = {}) {
  if (!place || !place.id) throw err('fromSearchResult needs a place with an id');
  const raw = {
    place_id: place.id, name: place.displayName?.text ?? place.displayName ?? '', types: place.types || [], primary_type: place.primaryType ?? undefined,
    rating: place.rating ?? undefined, rating_count: place.userRatingCount ?? undefined, price_level: place.priceLevel ?? undefined,
    business_status: place.businessStatus ?? 'BUSINESS_STATUS_UNSPECIFIED',
    location: place.location && Number.isFinite(place.location.latitude) ? { lat: place.location.latitude, lng: place.location.longitude } : null,
    hours: place.regularOpeningHours ? { periods: place.regularOpeningHours.periods || [] } : null,
    website: place.websiteUri ?? undefined, streams, local_mentions, slug
  };
  if (Array.isArray(place.reviews)) raw.reviews = place.reviews.filter((r) => r && r.publishTime).map((r) => ({ publish_time: r.publishTime, rating: r.rating, author: r.authorAttribution?.displayName ?? undefined }));
  return normalizeRecord(raw);
}

/** mentionCount(record, kind?) → distinct publishers (falling back to refs) of that kind (all kinds when omitted). */
export function mentionCount(record, kind) {
  return new Set((record.local_mentions || []).filter((m) => !kind || m.kind === kind).map((m) => (m.publisher ? 'p:' + m.publisher : 'r:' + m.ref))).size;
}
export const isOwnerSeed = (record) => (record.streams || []).includes('owner_seed');
/** isLocalFavourite(record) → mentions from ≥ LOCAL_FAVOURITE_MIN_PUBLISHERS distinct publishers (refs when no publisher), as mentionCount counts. */
export const isLocalFavourite = (record) => mentionCount(record) >= LOCAL_FAVOURITE_MIN_PUBLISHERS;

// Developed by: LightAISolutions

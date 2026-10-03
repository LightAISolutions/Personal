/**
 * Gem Funnel — stage 2, free screening (proposal §4): no calls, one reason per dropped place, the first rule that
 * fires in this order: not_operational · avoided_type · not_a_visit · facility · chain · low_rating · too_few_ratings ·
 * closed_all_dates · out_of_season · too_far, then part_of over what is left (a gate, a sub-garden or a pavilion listed on
 * its own next to the big place it belongs to). not_a_visit, facility, out_of_season and part_of apply to the activities
 * group only (out_of_season: a garden or park that is mainly one bloom, season/outOfSeason); owner seeds skip them.
 * Unknowns are never treated as the bad case: BUSINESS_STATUS_UNSPECIFIED passes, unknown hours pass, a record
 * without a location passes the distance test and is never part_of (the skill resolves locations before the funnel).
 * Rating floor: `rating_floor` (+ the country's `rating_offset`). A local favourite (mentions from ≥ 2 distinct
 * publishers, WP-11b) has the floor LOCAL_FAVOURITE_RATING_FLOOR (3.8, + the offset) and 1.5 × the off-track limit, and
 * leaves the screen flagged `local_favourite`; a mass-tourism top-ten place or one in the pool's top decile of rating
 * counts (≥ CROWD_MAGNET_MIN_COUNT) leaves it flagged `crowd_magnet`. Flags never drop a place.
 */
import { RATING_FLOOR_DEFAULT, MIN_RATING_COUNT, MIN_LOCAL_MENTIONS_TO_WAIVE_COUNT, OFF_TRACK_MINUTES_DEFAULT, MODES_DEFAULT, ratingFloorFor,
  LOCAL_FAVOURITE_RATING_FLOOR, LOCAL_FAVOURITE_OFF_TRACK_FACTOR, CROWD_MAGNET_TOP_SHARE, CROWD_MAGNET_MIN_COUNT, MASS_TOURISM_TOP_N,
  RATING_OFFSET_MAX, NOT_A_VISIT_TYPES, FACILITY_NAME_RE, PART_OF_RADIUS_M, PART_OF_COUNT_RATIO, PART_OF_CORE_MIN, NAME_SUFFIX_WORDS, FEATURE_WORDS } from './gems-weights.mjs';
import { CHAIN_LIST, nameCounts, chainReason } from './gems-chains.mjs';
import { normalizePool, mentionCount, isOwnerSeed, isLocalFavourite, groupOf } from './gems-record.mjs';
import { outOfSeason, bloomKindOf } from '../season/season-bloom.mjs';
import { closedOnAll } from './gems-hours.mjs';
import { minutesToNearestAnchor, isLatLng, haversineKm } from './gems-geo.mjs';

export const DROP_REASONS = Object.freeze(['not_operational', 'avoided_type', 'not_a_visit', 'facility', 'chain', 'low_rating', 'too_few_ratings', 'closed_all_dates', 'out_of_season', 'too_far', 'part_of']);
const NOT_A_VISIT = new Set(NOT_A_VISIT_TYPES), SUFFIX = new Set(NAME_SUFFIX_WORDS), FEATURE = new Set(FEATURE_WORDS);

/** nameWords('Kinkaku-ji (金閣寺)') → ['kinkaku', 'ji'] — Latin words only, accents folded, lower case. */
export function nameWords(name) {
  return String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}
/** nameCore('Kinkaku-ji') → 'kinkaku'; 'Fushimi Inari Taisha' → 'fushimi inari' (suffix words dropped). */
export function nameCore(name) { return nameWords(name).filter((w) => !SUFFIX.has(w)).join(' '); }
/** isFeatureName('Second Torii') → true: every Latin word is a feature word or a number (a name with no Latin words is never one). */
export function isFeatureName(name) { const w = nameWords(name); return w.length > 0 && w.every((x) => FEATURE.has(x) || /^\d+$/.test(x)); }
/** notAVisit(record) → the type that makes it not a visit, else null (primary type first; types only when there is no primary type). */
function notAVisit(r) {
  if (r.primary_type) return NOT_A_VISIT.has(r.primary_type) ? r.primary_type : null;
  return (r.types || []).find((t) => NOT_A_VISIT.has(t)) || null;
}
/**
 * partOfParent(record, pool) → the pool place it belongs to, else null: an activities place within PART_OF_RADIUS_M with
 * ≥ PART_OF_COUNT_RATIO × its ratings whose name core appears in the record's name with only feature words besides, or any
 * such place when the record's name is only feature words. A sub-temple or a museum inside a park keeps its own name and stays.
 */
export function partOfParent(r, pool) {
  if (!isLatLng(r.location)) return null;
  const mine = ' ' + nameWords(r.name).join(' ') + ' ', feature = isFeatureName(r.name), count = Math.max(1, r.rating_count ?? 0);
  let best = null;
  for (const p of pool) {
    if (p === r || p.place_id === r.place_id || !isLatLng(p.location) || groupOf(p) !== 'activities') continue;
    if ((p.rating_count ?? 0) < PART_OF_COUNT_RATIO * count) continue;
    if (haversineKm(r.location, p.location) * 1000 > PART_OF_RADIUS_M) continue;
    const core = nameCore(p.name), coreWords = new Set(core.split(' '));
    // named after it AND the rest of the name is feature words: "Yasaka Jinja West Gate" yes, a sub-temple "Daitoku-ji Ohbai-in" no
    const named = core.length >= PART_OF_CORE_MIN && mine.includes(' ' + core + ' ') && core !== nameCore(r.name) &&
      nameWords(r.name).filter((w) => !coreWords.has(w) && !SUFFIX.has(w)).every((w) => FEATURE.has(w) || /^\d+$/.test(w));
    if ((named || feature) && (!best || (p.rating_count ?? 0) > (best.rating_count ?? 0))) best = p;
  }
  return best;
}
const CLOSED_STATUSES = ['CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'];

/**
 * crowdMagnetIds(records) → the place ids of the pool's crowd magnets: a mass-tourism rank ≤ MASS_TOURISM_TOP_N, or a
 * rating count in the pool's top CROWD_MAGNET_TOP_SHARE (top decile, by rank among the records with a count; ties at the
 * cut-off count in) that is also ≥ CROWD_MAGNET_MIN_COUNT.
 */
export function crowdMagnetIds(records) {
  const ids = new Set();
  for (const r of records) if (r.mass_tourism_rank != null && r.mass_tourism_rank <= MASS_TOURISM_TOP_N) ids.add(r.place_id);
  const counted = records.filter((r) => Number.isFinite(r.rating_count)).map((r) => r.rating_count).sort((a, b) => b - a);
  if (counted.length) {
    const cut = counted[Math.max(0, Math.ceil(counted.length * CROWD_MAGNET_TOP_SHARE) - 1)];
    for (const r of records) if (Number.isFinite(r.rating_count) && r.rating_count >= cut && r.rating_count >= CROWD_MAGNET_MIN_COUNT) ids.add(r.place_id);
  }
  return ids;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * screen(pool, { trip_dates, anchors = [], off_track_minutes = 25, modes = ['TRANSIT','WALK'], avoid_types = [],
 *                chain_list = CHAIN_LIST, rating_floor = 4.3 (or ratingFloorFor(appetite) when `appetite` is given),
 *                rating_offset = 0, season?, lat? })
 *   → { kept: [normalized record…], dropped: [{ place_id, reason_code, detail? }] }
 * `pool` may be raw records; `kept` carries normalized records (with `category`) for the scoring stage, and `flags`
 * (local_favourite, crowd_magnet) on the records that earn them. `season` is the trip's season sheet (C11) and `lat` the
 * fallback latitude for the bloom months when a record has no location (default: the first anchor's).
 */
export function screen(pool, opts = {}) {
  const records = normalizePool(pool);
  const { trip_dates, anchors = [], off_track_minutes = OFF_TRACK_MINUTES_DEFAULT, modes = MODES_DEFAULT, avoid_types = [], chain_list = CHAIN_LIST } = opts;
  const rating_floor = opts.rating_floor ?? (opts.appetite != null ? ratingFloorFor(opts.appetite) : RATING_FLOOR_DEFAULT);
  const rating_offset = opts.rating_offset ?? 0;
  if (!(Number.isFinite(rating_offset) && Math.abs(rating_offset) <= RATING_OFFSET_MAX)) throw new Error(`gems: rating_offset must be within ±${RATING_OFFSET_MAX}`);
  if (!Array.isArray(trip_dates) || !trip_dates.length || !trip_dates.every((d) => DATE_RE.test(String(d)))) throw new Error('gems: screen needs trip_dates as a non-empty array of YYYY-MM-DD');
  if (!Array.isArray(anchors) || !anchors.every(isLatLng)) throw new Error('gems: anchors must be an array of { lat, lng } (our own geocoded points)');
  if (!(Number.isFinite(off_track_minutes) && off_track_minutes >= 0)) throw new Error('gems: off_track_minutes must be a non-negative number');
  if (!(Number.isFinite(rating_floor) && rating_floor >= 0 && rating_floor <= 5)) throw new Error('gems: rating_floor must be 0–5');
  if (!Array.isArray(avoid_types)) throw new Error('gems: avoid_types must be an array');
  const avoid = new Set(avoid_types.map(String));
  if (opts.season != null && typeof opts.season !== 'object') throw new Error('gems: season must be the trip\'s season sheet object');
  const lat = Number.isFinite(opts.lat) ? opts.lat : anchors.length ? anchors[0].lat : undefined;
  const counts = nameCounts(records);
  const kept = [], dropped = [];
  for (const r of records) {
    const drop = (reason_code, detail) => dropped.push(detail ? { place_id: r.place_id, reason_code, detail } : { place_id: r.place_id, reason_code });
    if (CLOSED_STATUSES.includes(r.business_status)) { drop('not_operational', r.business_status); continue; }
    const hit = [r.primary_type, r.category, ...r.types].find((t) => t && avoid.has(t));
    if (hit) { drop('avoided_type', hit); continue; }
    const visit = groupOf(r) === 'activities' && !isOwnerSeed(r);
    const nav = visit ? notAVisit(r) : null;
    if (nav) { drop('not_a_visit', nav); continue; }
    if (visit && FACILITY_NAME_RE.test(String(r.name || ''))) { drop('facility'); continue; }
    const chain = chainReason(r, counts, chain_list);
    if (chain) { drop('chain', chain); continue; }
    const count = r.rating_count ?? 0;
    const favourite = isLocalFavourite(r);
    const tooFew = count < MIN_RATING_COUNT && mentionCount(r) < MIN_LOCAL_MENTIONS_TO_WAIVE_COUNT && !isOwnerSeed(r);
    const floor = favourite ? Math.min(rating_floor, LOCAL_FAVOURITE_RATING_FLOOR) : rating_floor;
    if (r.rating == null) { if (tooFew) { drop('too_few_ratings'); continue; } }
    else if (r.rating < Math.round((floor + rating_offset) * 100) / 100) { drop('low_rating'); continue; }
    else if (tooFew) { drop('too_few_ratings'); continue; }
    if (closedOnAll(r.hours, trip_dates)) { drop('closed_all_dates'); continue; }
    if (visit && outOfSeason(r, { season: opts.season, dates: trip_dates, lat })) { drop('out_of_season', bloomKindOf(r)); continue; }
    const minutes = minutesToNearestAnchor(r.location, anchors, modes);
    const limit = favourite ? off_track_minutes * LOCAL_FAVOURITE_OFF_TRACK_FACTOR : off_track_minutes;
    if (minutes !== null && minutes > limit) { drop('too_far', `${Math.round(minutes)} min`); continue; }
    kept.push(r);
  }
  const out = [];
  const magnets = crowdMagnetIds(records);
  for (const r of kept) {
    const parent = groupOf(r) === 'activities' && !isOwnerSeed(r) ? partOfParent(r, records) : null;
    if (parent) { dropped.push({ place_id: r.place_id, reason_code: 'part_of', detail: String(parent.name || parent.place_id).slice(0, 120) }); continue; }
    const flags = [];
    if (isLocalFavourite(r)) flags.push('local_favourite');
    if (magnets.has(r.place_id)) flags.push('crowd_magnet');
    out.push(flags.length ? { ...r, flags } : r);
  }
  return { kept: out, dropped };
}

// Developed by: LightAISolutions

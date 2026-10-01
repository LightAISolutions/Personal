/**
 * Gem Funnel — stage 2, free screening (proposal §4): no calls, one reason per dropped place, the first rule that
 * fires in this order: not_operational · avoided_type · chain · low_rating · too_few_ratings · closed_all_dates · too_far.
 * Unknowns are never treated as the bad case: BUSINESS_STATUS_UNSPECIFIED passes, unknown hours pass, a record
 * without a location passes the distance test (the skill resolves locations before the funnel in practice).
 */
import { RATING_FLOOR_DEFAULT, MIN_RATING_COUNT, MIN_LOCAL_MENTIONS_TO_WAIVE_COUNT, OFF_TRACK_MINUTES_DEFAULT, MODES_DEFAULT, ratingFloorFor } from './gems-weights.mjs';
import { CHAIN_LIST, nameCounts, chainReason } from './gems-chains.mjs';
import { normalizePool, mentionCount, isOwnerSeed } from './gems-record.mjs';
import { closedOnAll } from './gems-hours.mjs';
import { minutesToNearestAnchor, isLatLng } from './gems-geo.mjs';

export const DROP_REASONS = Object.freeze(['not_operational', 'avoided_type', 'chain', 'low_rating', 'too_few_ratings', 'closed_all_dates', 'too_far']);
const CLOSED_STATUSES = ['CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * screen(pool, { trip_dates, anchors = [], off_track_minutes = 25, modes = ['TRANSIT','WALK'], avoid_types = [],
 *                chain_list = CHAIN_LIST, rating_floor = 4.3 (or ratingFloorFor(appetite) when `appetite` is given) })
 *   → { kept: [normalized record…], dropped: [{ place_id, reason_code, detail? }] }
 * `pool` may be raw records; `kept` carries normalized records (with `category`) for the scoring stage.
 */
export function screen(pool, opts = {}) {
  const records = normalizePool(pool);
  const { trip_dates, anchors = [], off_track_minutes = OFF_TRACK_MINUTES_DEFAULT, modes = MODES_DEFAULT, avoid_types = [], chain_list = CHAIN_LIST } = opts;
  const rating_floor = opts.rating_floor ?? (opts.appetite != null ? ratingFloorFor(opts.appetite) : RATING_FLOOR_DEFAULT);
  if (!Array.isArray(trip_dates) || !trip_dates.length || !trip_dates.every((d) => DATE_RE.test(String(d)))) throw new Error('gems: screen needs trip_dates as a non-empty array of YYYY-MM-DD');
  if (!Array.isArray(anchors) || !anchors.every(isLatLng)) throw new Error('gems: anchors must be an array of { lat, lng } (our own geocoded points)');
  if (!(Number.isFinite(off_track_minutes) && off_track_minutes >= 0)) throw new Error('gems: off_track_minutes must be a non-negative number');
  if (!(Number.isFinite(rating_floor) && rating_floor >= 0 && rating_floor <= 5)) throw new Error('gems: rating_floor must be 0–5');
  if (!Array.isArray(avoid_types)) throw new Error('gems: avoid_types must be an array');
  const avoid = new Set(avoid_types.map(String));
  const counts = nameCounts(records);
  const kept = [], dropped = [];
  for (const r of records) {
    const drop = (reason_code, detail) => dropped.push(detail ? { place_id: r.place_id, reason_code, detail } : { place_id: r.place_id, reason_code });
    if (CLOSED_STATUSES.includes(r.business_status)) { drop('not_operational', r.business_status); continue; }
    const hit = [r.primary_type, r.category, ...r.types].find((t) => t && avoid.has(t));
    if (hit) { drop('avoided_type', hit); continue; }
    const chain = chainReason(r, counts, chain_list);
    if (chain) { drop('chain', chain); continue; }
    const count = r.rating_count ?? 0;
    const tooFew = count < MIN_RATING_COUNT && mentionCount(r) < MIN_LOCAL_MENTIONS_TO_WAIVE_COUNT && !isOwnerSeed(r);
    if (r.rating == null) { if (tooFew) { drop('too_few_ratings'); continue; } }
    else if (r.rating < rating_floor) { drop('low_rating'); continue; }
    else if (tooFew) { drop('too_few_ratings'); continue; }
    if (closedOnAll(r.hours, trip_dates)) { drop('closed_all_dates'); continue; }
    const minutes = minutesToNearestAnchor(r.location, anchors, modes);
    if (minutes !== null && minutes > off_track_minutes) { drop('too_far', `${Math.round(minutes)} min`); continue; }
    kept.push(r);
  }
  return { kept, dropped };
}

// Developed by: LightAISolutions

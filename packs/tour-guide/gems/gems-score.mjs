/**
 * Gem Funnel — stage 3, the gem score (proposal §4). Five components in 0–1 from fields already in hand, a weighted
 * sum × 100, and the 💎 rule. Every number comes from gems-weights.mjs. Pure: the input records are not mutated.
 */
import * as W from './gems-weights.mjs';
import { categoryOf, mentionCount, isOwnerSeed, PRICE_LEVELS } from './gems-record.mjs';
import { usableDates } from './gems-hours.mjs';
import { minutesToNearestAnchor } from './gems-geo.mjs';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const round4 = (x) => Math.round(x * 1e4) / 1e4;
const roundTo = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

/** categoryMeans(pool) → { [category]: mean rating } for categories with ≥ QUALITY_MU_MIN_MEMBERS rated members. */
export function categoryMeans(pool) {
  const acc = {};
  for (const r of pool) { if (r.rating == null) continue; const c = categoryOf(r); (acc[c] ||= []).push(r.rating); }
  const out = {};
  for (const [c, list] of Object.entries(acc)) if (list.length >= W.QUALITY_MU_MIN_MEMBERS) out[c] = round4(list.reduce((a, b) => a + b, 0) / list.length);
  return out;
}
/** muFor(category, means) → the category mean, or QUALITY_MU_DEFAULT. */
export const muFor = (category, means) => means[category] ?? W.QUALITY_MU_DEFAULT;

/** qualityScore(record, mu) → Q in 0–1: Bayesian-shrunk rating mapped QUALITY_MAP_LOW → 0 … QUALITY_MAP_HIGH → 1 (0 without a rating). */
export function qualityScore(record, mu = W.QUALITY_MU_DEFAULT) {
  if (record.rating == null) return 0;
  const n = record.rating_count ?? 0, m = W.QUALITY_PRIOR_WEIGHT_M;
  const shrunk = (n * record.rating + m * mu) / (n + m);
  return round4(clamp01((shrunk - W.QUALITY_MAP_LOW) / (W.QUALITY_MAP_HIGH - W.QUALITY_MAP_LOW)));
}

/** categoryMedianCounts(pool) → { [category]: median rating_count } (the "peers" figure for gem lines). */
export function categoryMedianCounts(pool) {
  const acc = {};
  for (const r of pool) { if (r.rating_count == null) continue; (acc[categoryOf(r)] ||= []).push(r.rating_count); }
  const out = {};
  for (const [c, list] of Object.entries(acc)) { list.sort((a, b) => a - b); const mid = list.length >> 1; out[c] = list.length % 2 ? list[mid] : Math.round((list[mid - 1] + list[mid]) / 2); }
  return out;
}

/** percentileRank(record, pool) → share of the other same-category members with a smaller count (ties count half); 0.5 alone. */
export function percentileRank(record, pool) {
  const c = categoryOf(record), n = record.rating_count ?? 0;
  const others = pool.filter((r) => r !== record && r.place_id !== record.place_id && categoryOf(r) === c && r.rating_count != null).map((r) => r.rating_count);
  if (!others.length) return 0.5;
  let less = 0, equal = 0;
  for (const x of others) { if (x < n) less++; else if (x === n) equal++; }
  return (less + 0.5 * equal) / others.length;
}

/** citySizeFor({ city_size?, aggregate_counts?, pool_size }) → 'large' | 'small' (explicit > aggregate counts > pool size > default). */
export function citySizeFor({ city_size, aggregate_counts, pool_size = 0 } = {}) {
  if (city_size != null) { if (!(city_size in W.OBSCURITY_BANDS)) throw new Error(`gems: city_size must be one of ${Object.keys(W.OBSCURITY_BANDS).join(', ')}`); return city_size; }
  if (aggregate_counts && typeof aggregate_counts === 'object') {
    const total = Object.values(aggregate_counts).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return total >= W.CITY_LARGE_AGGREGATE_MIN ? 'large' : 'small';
  }
  if (pool_size > 0) return pool_size >= W.CITY_LARGE_POOL_MIN ? 'large' : 'small';
  return W.CITY_SIZE_DEFAULT;
}

/** bucketFactor(count, city_size) → 1 inside the band, OBSCURITY_BELOW_BAND_FACTOR under it, a linear fall to 0 at OBSCURITY_ZERO_ABOVE, 0 beyond. */
export function bucketFactor(count, city_size = W.CITY_SIZE_DEFAULT) {
  const band = W.OBSCURITY_BANDS[city_size];
  if (count > W.OBSCURITY_ZERO_ABOVE) return 0;
  if (count > band.hi) return (W.OBSCURITY_ZERO_ABOVE - count) / (W.OBSCURITY_ZERO_ABOVE - band.hi);
  if (count >= band.lo) return 1;
  return W.OBSCURITY_BELOW_BAND_FACTOR;
}

/** obscurityScore(record, pool, city_size) → O in 0–1; owner seeds get OBSCURITY_OWNER_SEED. */
export function obscurityScore(record, pool, city_size = W.CITY_SIZE_DEFAULT) {
  if (isOwnerSeed(record)) return W.OBSCURITY_OWNER_SEED;
  const count = record.rating_count ?? 0;
  const factor = bucketFactor(count, city_size);
  if (factor === 0) return 0;
  const pct = percentileRank(record, pool);
  return round4(clamp01(factor * (W.OBSCURITY_PERCENTILE_FLOOR + (1 - W.OBSCURITY_PERCENTILE_FLOOR) * (1 - pct))));
}

/** localnessScore(record) → L in 0–1 from the point table (distinct ledger refs per kind; top-ten mass tourism penalty). */
export function localnessScore(record) {
  const ll = Math.min(W.LOCALNESS_LOCAL_LANGUAGE_CAP, W.LOCALNESS_POINTS['local-language'] * mentionCount(record, 'local-language'));
  let l = ll + W.LOCALNESS_POINTS.editorial * mentionCount(record, 'editorial') + W.LOCALNESS_POINTS.community * mentionCount(record, 'community');
  if (record.mass_tourism_rank != null && record.mass_tourism_rank <= W.MASS_TOURISM_TOP_N) l += W.LOCALNESS_MASS_TOURISM_PENALTY;
  return round4(clamp01(l));
}

/**
 * estimateFit(record, profile) → F in 0–1, the cheap pre-evidence estimate from types and price (the skill's model
 * overrides it through fit_estimates). profile: { interests: { [category]: 'high'|'normal'|'low' }, likes_types?: [],
 * avoid_types?: [], price_max?: 1–4 (1 inexpensive … 4 very expensive) }.
 */
export function estimateFit(record, profile = {}) {
  let f = W.FIT_DEFAULT;
  const cat = categoryOf(record);
  const interest = profile.interests && profile.interests[cat];
  if (interest in W.FIT_INTEREST) f += W.FIT_INTEREST[interest];
  const types = new Set([record.primary_type, ...(record.types || [])].filter(Boolean));
  const liked = (profile.likes_types || []).filter((t) => types.has(t)).length;
  f += Math.min(W.FIT_LIKED_TYPE_CAP, liked * W.FIT_LIKED_TYPE);
  if ((profile.avoid_types || []).some((t) => types.has(t) || t === cat)) f -= 0.3;
  if (Number.isFinite(profile.price_max) && record.price_level) {
    const level = PRICE_LEVELS.indexOf(record.price_level) - 1; // FREE → 0, INEXPENSIVE → 1 … VERY_EXPENSIVE → 4; UNSPECIFIED → −1
    if (level >= 0) f += level <= profile.price_max ? W.FIT_PRICE_MATCH : W.FIT_PRICE_OVER * (level - profile.price_max);
  }
  if (isOwnerSeed(record)) f += W.FIT_OWNER_SEED;
  return round4(clamp01(f));
}

/**
 * practicalityScore(record, { trip_dates, day_start, day_end, anchors, off_track_minutes, modes, rough_edges }) → P in 0–1:
 * 1 when open at a usable time on ≥ 1 trip day (PRACTICALITY_UNKNOWN_HOURS when hours are unknown, 0 when never) and
 * within off_track_minutes of an anchor; minus PRACTICALITY_FRICTION_PENALTY per rough edge the owner does not tolerate.
 */
export function practicalityScore(record, ctx = {}) {
  const { trip_dates, day_start, day_end, anchors, off_track_minutes = W.OFF_TRACK_MINUTES_DEFAULT, modes = W.MODES_DEFAULT, rough_edges = W.ROUGH_EDGES_DEFAULT } = ctx;
  let p = 1;
  if (Array.isArray(trip_dates) && trip_dates.length) {
    const usable = usableDates(record.hours, trip_dates, { day_start, day_end });
    p = usable === null ? W.PRACTICALITY_UNKNOWN_HOURS : usable.length ? 1 : 0;
  }
  if (Array.isArray(anchors) && anchors.length) {
    const minutes = minutesToNearestAnchor(record.location, anchors, modes);
    if (minutes !== null && minutes > off_track_minutes) p = 0;
  }
  const tolerated = new Set(rough_edges || []);
  for (const edge of record.friction || []) if (!tolerated.has(edge)) p -= W.PRACTICALITY_FRICTION_PENALTY;
  return round4(clamp01(p));
}

/** isGem({ q, o, l }) → the 💎 rule: O ≥ 0.6 and L ≥ 0.3 and Q ≥ 0.6 (GEM_RULE). */
export const isGem = ({ q, o, l }) => o >= W.GEM_RULE.O && l >= W.GEM_RULE.L && q >= W.GEM_RULE.Q;

/** scoringContext(kept, opts) → { appetite, city_size, weights, mu_by_category, median_count_by_category } (what scoreGems derives). */
export function scoringContext(kept, opts = {}) {
  const appetite = W.clampAppetite(opts.appetite ?? W.APPETITE_DEFAULT);
  return {
    appetite, city_size: citySizeFor({ city_size: opts.city_size, aggregate_counts: opts.aggregate_counts, pool_size: kept.length }),
    weights: W.weightsFor(appetite), mu_by_category: categoryMeans(kept), median_count_by_category: categoryMedianCounts(kept)
  };
}

/**
 * scoreGems(kept, { appetite = 3, aggregate_counts?, city_size?, fit_estimates?, profile?, trip_dates?, day_start?, day_end?,
 *                   anchors?, off_track_minutes?, modes?, rough_edges? })
 *   → [{ ...record, category, q, o, l, f, p, gem_score (0–100), gem }] in input order.
 * fit_estimates: { [place_id]: 0–1 } from the skill's model; a missing entry falls back to estimateFit(record, profile).
 */
export function scoreGems(kept, opts = {}) {
  if (!Array.isArray(kept)) throw new Error('gems: scoreGems needs the kept records as an array');
  const ctx = scoringContext(kept, opts);
  const fits = opts.fit_estimates || {};
  return kept.map((r) => {
    const category = categoryOf(r);
    const q = qualityScore(r, muFor(category, ctx.mu_by_category));
    const o = obscurityScore(r, kept, ctx.city_size);
    const l = localnessScore(r);
    const given = fits[r.place_id];
    if (given != null && !(Number.isFinite(given) && given >= 0 && given <= 1)) throw new Error(`gems: fit_estimates[${r.place_id}] must be 0–1`);
    const f = given != null ? round4(given) : estimateFit(r, opts.profile);
    const p = practicalityScore(r, opts);
    const w = ctx.weights;
    const gem_score = roundTo(100 * (w.F * f + w.Q * q + w.O * o + w.L * l + w.P * p), W.GEM_SCORE_DECIMALS);
    return { ...r, category, q, o, l, f, p, gem_score, gem: isGem({ q, o, l }) };
  });
}

// Developed by: LightAISolutions

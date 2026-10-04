/**
 * Tour Guide Scout — the pool record and the ranking (helpers/decisions/TG-SCOUT.md §4). Pure: the skill passes the
 * Text Search results, its judgments and the route-matrix minutes; nothing here fetches, reads a file or keeps state.
 * Google fields (rating, count, hours, editorial summary, photo reference) are in-run inputs; the payload built from
 * this ranking (scout-payload.mjs) carries none of them.
 */
import { fromSearchResult, normalizeRecord, mentionCount, groupOf } from '../gems/gems-record.mjs';
import { nameCounts, chainReason } from '../gems/gems-chains.mjs';
import { closedOnAll, closedDates } from '../gems/gems-hours.mjs';
import { haversineKm, isLatLng } from '../gems/gems-geo.mjs';
import { walkMinutes, railEstimate } from '../planner/planner-rail.mjs';
import { CATEGORY_TYPES } from '../gems/gems-record.mjs';
import { ratingBand, numberWord } from '../gems/gems-line.mjs';
import { guessGroup, CAFE_WORDS, isCafeTopic, foodKind } from './scout-text.mjs';
import { isDate } from '../schemas/tour-guide-dates.mjs';
import * as W from './scout-weights.mjs';

const EXTRA_KEYS = ['serves_vegetarian', 'editorial', 'photo'];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const clipText = (s, max) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t; };
const httpsOnly = (u) => {
  if (typeof u !== 'string') return undefined;
  const s = u.trim().replace(/^\/\//, 'https://');   // Places author URIs are often protocol-relative
  return /^https:\/\/[^\s<>"'`\\]+$/i.test(s) ? s : undefined;
};

/**
 * fromScoutResult(rawPlace, { query, local_mentions = [] }) → a gems pool record (fromSearchResult) plus, in-run only:
 *   serves_vegetarian  true | false | null   (Places `servesVegetarianFood`; null = Google does not say)
 *   editorial          string | null         (`editorialSummary.text`, clipped to 400; used for the on-topic test only)
 *   photo              { name, attributions:[{ name, uri? }] } | null   (the first photo; the board fetches and credits it)
 * `query` is accepted for symmetry with the contract and reserved; matching happens in rankScout.
 */
export function fromScoutResult(raw, { query, local_mentions = [] } = {}) { // eslint-disable-line no-unused-vars
  const rec = fromSearchResult(raw, { streams: [], local_mentions });
  rec.serves_vegetarian = raw.servesVegetarianFood === true ? true : raw.servesVegetarianFood === false ? false : null;
  const ed = raw.editorialSummary && typeof raw.editorialSummary === 'object' ? raw.editorialSummary.text : raw.editorialSummary;
  rec.editorial = typeof ed === 'string' && ed.trim() ? clipText(ed, 400) : null;
  const p = Array.isArray(raw.photos) ? raw.photos.find((x) => x && typeof x.name === 'string' && x.name) : null;
  rec.photo = p ? {
    name: String(p.name).slice(0, 500),
    attributions: (Array.isArray(p.authorAttributions) ? p.authorAttributions : []).slice(0, 5).map((a) => {
      const out = { name: clipText(a && (a.displayName ?? a.name), 120) || 'Google user' };
      const uri = httpsOnly(a && a.uri);
      if (uri) out.uri = uri;
      return out;
    })
  } : null;
  return rec;
}

/** Google types a query usually maps to, by activity word (food uses the cafe / restaurant lists). */
export const ACTIVITY_TYPES = Object.freeze({
  museum: CATEGORY_TYPES.museum, gallery: CATEGORY_TYPES.museum, galleries: CATEGORY_TYPES.museum, museums: CATEGORY_TYPES.museum,
  temple: CATEGORY_TYPES.temple, temples: CATEGORY_TYPES.temple, shrine: CATEGORY_TYPES.shrine, shrines: CATEGORY_TYPES.shrine,
  garden: CATEGORY_TYPES.garden, gardens: CATEGORY_TYPES.garden, park: CATEGORY_TYPES.park, hike: CATEGORY_TYPES.park, hiking: CATEGORY_TYPES.park, trail: CATEGORY_TYPES.park, beach: CATEGORY_TYPES.park,
  onsen: ['spa', 'public_bath'], bath: ['spa', 'public_bath'], baths: ['spa', 'public_bath'], sento: ['public_bath'], spa: ['spa'],
  view: CATEGORY_TYPES.viewpoint, views: CATEGORY_TYPES.viewpoint, viewpoint: CATEGORY_TYPES.viewpoint, castle: ['castle', 'historical_landmark'],
  ceremony: ['cultural_center', 'tea_house'], class: ['cultural_center'], workshop: ['cultural_center'], tour: ['tour_agency', 'tourist_attraction'], experience: ['cultural_center'],
  market: CATEGORY_TYPES.market, shop: CATEGORY_TYPES.shop, shopping: CATEGORY_TYPES.shop
});

/** tokens(text) → lower-case, diacritic-free words of ≥ 2 characters (Latin and other scripts kept as-is). */
export function tokens(text) {
  return String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2);
}
const mentionsAll = (text, words) => { if (!words.length) return false; const set = ' ' + tokens(text).join(' ') + ' '; return words.every((w) => set.includes(' ' + w + ' ') || set.includes(' ' + w + 's ')); };

/** usualTypes(what, group) → the Google types that mean "this kind of place" for the query. */
export function usualTypes(what, group) {
  const words = tokens(what);
  if (group === 'food') return words.some((w) => CAFE_WORDS.includes(w)) ? CATEGORY_TYPES.cafe : [...CATEGORY_TYPES.restaurant, ...CATEGORY_TYPES.bar, ...CATEGORY_TYPES.market];
  return [...new Set(words.flatMap((w) => ACTIVITY_TYPES[w] || []))];
}

/**
 * topicPart(record, { what, group, judgment }) → { value 0–1, source: 'judgment'|'name'|'type'|'editorial'|'none' }.
 * The judgment's `relevance` wins; else the name carrying every query word → 0.9, a type containing a query word or in
 * the query's usual types → 0.6, the editorial summary carrying every query word → 0.5, else 0.2.
 */
export function topicPart(record, { what, group, judgment = {} } = {}) {
  if (Number.isFinite(judgment.relevance)) return { value: clamp01(judgment.relevance), source: 'judgment' };
  const words = tokens(what);
  if (mentionsAll(record.name, words)) return { value: W.TOPIC.name, source: 'name' };
  const types = [record.primary_type, ...(record.types || [])].filter(Boolean);
  const usual = usualTypes(what, group);
  if (types.some((t) => usual.includes(t) || words.some((w) => w.length >= 3 && t.split('_').includes(w)))) return { value: W.TOPIC.type, source: 'type' };
  if (record.editorial && mentionsAll(record.editorial, words)) return { value: W.TOPIC.editorial, source: 'editorial' };
  return { value: W.TOPIC.none, source: 'none' };
}

/** muFor(group) → Q's fixed prior mean for the group (W.QUALITY_MU), else W.QUALITY.mu_default (change 1). */
export const muFor = (group) => (Object.prototype.hasOwnProperty.call(W.QUALITY_MU, group) ? W.QUALITY_MU[group] : W.QUALITY.mu_default);

/** qualityPart(record, mu) → Bayesian rating (v·r + m·μ)/(v+m) mapped 3.8 → 0 … 4.8 → 1. No rating → the prior. */
export function qualityPart(record, mu = W.QUALITY.mu_default) {
  const v = Number.isFinite(record.rating) && Number.isFinite(record.rating_count) ? record.rating_count : 0;
  const r = Number.isFinite(record.rating) ? record.rating : mu;
  const b = (v * r + W.QUALITY.m * mu) / (v + W.QUALITY.m);
  return clamp01((b - W.QUALITY.floor) / (W.QUALITY.ceil - W.QUALITY.floor));
}

/** reachValue(minutes) → 1 at ≤ 10, linear to 0.3 at 40, linear to 0.1 at 60, 0.1 beyond; 0.5 when unknown. */
export function reachValue(minutes) {
  const R = W.REACH;
  if (!Number.isFinite(minutes)) return R.unknown;
  if (minutes <= R.full) return 1;
  if (minutes <= R.mid) return 1 - ((1 - R.mid_value) * (minutes - R.full)) / (R.mid - R.full);
  if (minutes <= R.far) return R.mid_value - ((R.mid_value - R.far_value) * (minutes - R.mid)) / (R.far - R.mid);
  return R.far_value;
}

const MODES = ['WALK', 'TRANSIT', 'DRIVE'];
const pointOf = (p) => ({ lat: p.lat, lng: p.lng, ...(typeof p.name === 'string' ? { name: p.name } : {}) });

/**
 * estimateReach(from, to, { fromStations?, toStations? }) → { minutes, mode: 'WALK' | 'TRANSIT', estimated: true } | null —
 * the one estimate for a leg nobody measured (TG-PHASE-14 WP-14b change 7), from the planner's figures: the planner's
 * walking minutes (planner-rail `walkMinutes`) up to W.ESTIMATE_WALK_MAX_MINUTES, else the planner's rail estimate
 * (`railEstimate`: station walks + the ride + the wait). Without station lists, each end stands for its own station
 * (a one-minute walk at each end). railEstimate may still answer "walk" when walking is quicker; with real station
 * lists and no station in reach it may answer nothing, and then the end points stand in. null without two points.
 * The private driver uses this export instead of its own copy.
 */
export function estimateReach(from, to, { fromStations, toStations } = {}) {
  if (!isLatLng(from) || !isLatLng(to)) return null;
  const a = pointOf(from), b = pointOf(to);
  const walk = walkMinutes(haversineKm(a, b));
  if (walk <= W.ESTIMATE_WALK_MAX_MINUTES) return { minutes: walk, mode: 'WALK', estimated: true };
  const st = (x) => (Array.isArray(x) ? x.filter(isLatLng) : null);
  const fs = st(fromStations), ts = st(toStations);
  const e = (fs && ts ? railEstimate(a, b, fs, ts) : null) || railEstimate(a, b, [{ ...a, name: 'start' }], [{ ...b, name: 'end' }]);
  if (!e) return { minutes: walk, mode: 'WALK', estimated: true };   // unreachable in practice: two distinct points always give a ride
  return { minutes: e.minutes, mode: e.kind === 'walk' ? 'WALK' : 'TRANSIT', estimated: true };
}

/**
 * reachFor(record, { reach, anchors }) → { minutes, mode, estimated } | null — the route row first, else the quickest
 * estimateReach from any anchor (change 7: the same minutes the planner and the private driver give for that leg).
 */
export function reachFor(record, { reach = {}, anchors = [] } = {}) {
  const row = reach && Object.prototype.hasOwnProperty.call(reach, record.place_id) ? reach[record.place_id] : null;
  if (row && Number.isFinite(row.minutes) && row.minutes >= 0) {
    return { minutes: row.minutes, mode: MODES.includes(row.mode) ? row.mode : 'WALK', estimated: row.estimated === true };
  }
  const pts = (anchors || []).filter(isLatLng);
  if (!isLatLng(record.location) || !pts.length) return null;
  let best = null;
  for (const a of pts) {
    const e = estimateReach(a, record.location);
    if (e && (!best || e.minutes < best.minutes)) best = e;
  }
  return best;
}

export const isVegetarianDiet = (diet) => /\bvegetarian\b/i.test(String(diet ?? ''));
const MODE_WORDS = { WALK: 'walk', TRANSIT: 'by transit', DRIVE: 'drive' };
const TOPIC_WORDS = { judgment: (w) => `On topic for ${w}`, name: (w) => `Named for ${w}`, type: (w) => `The kind of place for ${w}`, editorial: (w) => `Known for ${w}`, none: (w) => `Loosely tied to ${w}`,
  list: (w) => `On your list ${w}`, named: () => 'One of the places you named' };   // list / named: compare boards (WP-14e)

/** whyLine(entry, what) → our own words: topic reason, rating band, local sources, reach. ≤ 200 chars. */
export function whyLine({ record, topic_source, reach, local_count }, what) {
  const parts = [TOPIC_WORDS[topic_source](clipText(what, 60))];
  if (Number.isFinite(record.rating) && record.rating_count > 0) parts.push(ratingBand(record.rating));
  if (local_count > 0) parts.push(`named by ${numberWord(local_count)} local source${local_count === 1 ? '' : 's'}`);
  if (reach) parts.push(`about ${Math.round(reach.minutes)} min ${MODE_WORDS[reach.mode]}${reach.estimated ? ' (estimated)' : ''}`);
  return clipText(parts.join('; ') + '.', 200);
}

/** ownName(x) → the place's own name from a judgment (its own site or a local source): cleaned, ≤ 120, or null. */
export const ownName = (x) => (typeof x === 'string' && x.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').trim()
  ? clipText(x.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, ' '), 120) || null : null);

const byRank = (a, b) => b.score - a.score || (b.record.rating_count ?? 0) - (a.record.rating_count ?? 0)
  || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.place_id < b.place_id ? -1 : a.place_id > b.place_id ? 1 : 0);

/** normalizeScoutRecord(raw) → normalizeRecord(raw) with the scout extras (serves_vegetarian, editorial, photo) kept. */
export function normalizeScoutRecord(raw) {
  const rec = normalizeRecord(raw);
  for (const k of EXTRA_KEYS) if (raw[k] !== undefined) rec[k] = raw[k];
  if (rec.serves_vegetarian !== true && rec.serves_vegetarian !== false) rec.serves_vegetarian = null;
  if (typeof rec.editorial !== 'string') rec.editorial = null;
  return rec;
}

/**
 * yourDates({ trip_dates, city_dates }) → the dates that count for "closed on your days": `city_dates` (the dates the
 * owner is in the searched city) when it is an array — valid dates only, sorted, each once, possibly none — else the
 * trip's dates as given (TG-PHASE-13 WP-13d, review fault 9).
 */
export function yourDates({ trip_dates, city_dates } = {}) {
  if (Array.isArray(city_dates)) return [...new Set(city_dates.filter(isDate))].sort();
  return Array.isArray(trip_dates) ? trip_dates : [];
}

/** dietRule(x) → the party's hidden-stock rule as a trimmed string ≤ 200, or null when absent / blank / not a string. */
export const dietRule = (x) => (typeof x === 'string' && x.trim() ? x.replace(/\s+/g, ' ').trim().slice(0, 200) : null);

/**
 * googleVegCounts({ diet, diet_rule, what }) → whether Google's `servesVegetarianFood` alone may stand for vegetarian
 * evidence: only for a vegetarian diet, and — when the party has a hidden-stock rule (fish stock in a broth, say) —
 * only for a drink or sweet topic (a café word), as before (review B11).
 */
export function googleVegCounts({ diet, diet_rule, what } = {}) {
  if (!isVegetarianDiet(diet)) return false;
  return !dietRule(diet_rule) || isCafeTopic(what);
}

/** vegOf(judgment) → the judgment's veg word: 'verified' | 'likely' | 'no' | 'unknown' ("none" reads as "no"). */
export const vegOf = (judgment) => {
  const v = judgment && typeof judgment === 'object' ? judgment.veg : undefined;
  return v === 'none' ? 'no' : W.VEG.includes(v) ? v : 'unknown';
};
export const isVeganDiet = (diet) => /\bvegan\b/i.test(String(diet ?? ''));

/**
 * kindLikely({ diet, record, what }) → true when, without a judgment, the place's kind alone makes it "likely" for the
 * party's diet (change 4): a drink place for a vegetarian or vegan party; a café, sweets or market place for a
 * vegetarian party only; never a meal place (meals keep the strict screen and Phase 13's hidden-stock rule), and never a
 * place Google marks as serving no vegetarian food (`serves_vegetarian === false`).
 */
export function kindLikely({ diet, record, what } = {}) {
  if (record && record.serves_vegetarian === false) return false;   // Google says no vegetarian food: the lists only fill silence
  const kind = foodKind(record, what);
  if (kind === 'drink') return isVegetarianDiet(diet) || isVeganDiet(diet);
  if (kind === 'cafe' || kind === 'market') return isVegetarianDiet(diet);
  return false;
}

/** rescued(judgment) → a judgment vouches for a new place: relevance ≥ W.RESCUE.relevance or veg verified (change 3). */
export const rescued = (judgment) => !!judgment && ((Number.isFinite(judgment.relevance) && judgment.relevance >= W.RESCUE.relevance) || vegOf(judgment) === 'verified');
const isNew = (record) => (Number.isFinite(record.rating_count) ? record.rating_count : 0) < W.SCREEN.unproven_below_count && mentionCount(record) === 0;

/**
 * screenReason(record, ctx) → the first drop reason (W.SCREEN_ORDER after `duplicate`) or null. ctx carries the
 * computed topic, reach, the judgment and the run's group / diet / diet_rule / what and dates (`city_dates` when
 * given, else `trip_dates`; see yourDates).
 */
export function screenReason(record, { topic, reach, judgment = {}, group, diet, diet_rule, what, trip_dates = [], city_dates }) {
  const S = W.SCREEN;
  const count = Number.isFinite(record.rating_count) ? record.rating_count : 0;
  const days = yourDates({ trip_dates, city_dates });
  if (record.business_status === 'CLOSED_PERMANENTLY' || record.business_status === 'CLOSED_TEMPORARILY') return 'closed';
  if (days.length && closedOnAll(record.hours, days)) return 'closed_on_trip';
  if (Number.isFinite(record.rating) && record.rating < S.low_rating_below && count >= S.low_rating_min_count) return 'low_rating';
  if (count < S.unproven_below_count && mentionCount(record) === 0 && !rescued(judgment)) return 'unproven';   // change 3
  if (topic < S.off_topic_below) return 'off_topic';
  if (group === 'food' && diet) {
    const veg = vegOf(judgment);
    if (veg === 'no') return 'diet';
    if (veg === 'unknown' && !(googleVegCounts({ diet, diet_rule, what }) && record.serves_vegetarian === true) && !kindLikely({ diet, record, what })) return 'diet_unproven';
  }
  if (reach && reach.minutes > S.too_far_minutes) return 'too_far';
  return null;
}

/**
 * screenFlags(record, ctx) → every screen this record fails, in W.SCREEN_ORDER, without `duplicate` and `off_topic` —
 * compare mode's flags (TG-PHASE-14 WP-14e). The same tests as screenReason, which stops at the first; ctx is the same.
 */
export function screenFlags(record, { reach, judgment = {}, group, diet, diet_rule, what, trip_dates = [], city_dates }) {
  const S = W.SCREEN, out = [];
  const count = Number.isFinite(record.rating_count) ? record.rating_count : 0;
  const days = yourDates({ trip_dates, city_dates });
  if (record.business_status === 'CLOSED_PERMANENTLY' || record.business_status === 'CLOSED_TEMPORARILY') out.push('closed');
  if (days.length && closedOnAll(record.hours, days)) out.push('closed_on_trip');
  if (Number.isFinite(record.rating) && record.rating < S.low_rating_below && count >= S.low_rating_min_count) out.push('low_rating');
  if (count < S.unproven_below_count && mentionCount(record) === 0 && !rescued(judgment)) out.push('unproven');
  if (group === 'food' && diet) {
    const veg = vegOf(judgment);
    if (veg === 'no') out.push('diet');
    else if (veg === 'unknown' && !(googleVegCounts({ diet, diet_rule, what }) && record.serves_vegetarian === true) && !kindLikely({ diet, record, what })) out.push('diet_unproven');
  }
  if (reach && reach.minutes > S.too_far_minutes) out.push('too_far');
  return out;
}

/** compareQuery(source) → the board's query: "compare: <list name>" or "compare: <a>, <b>…", ≤ 80 characters. */
export function compareQuery(source) {
  const text = source && typeof source.list === 'string' ? source.list : source && Array.isArray(source.names) ? source.names.join(', ') : '';
  return clipText('compare: ' + text, 80);
}
/** The compare source as given, cleaned: { list } or { names: [2–4] }; throws on anything else. */
function compareSource(src) {
  const clean = (x, max) => (typeof x === 'string' ? clipText(x, max) : '');
  if (src && typeof src === 'object' && src.names === undefined && clean(src.list, 80)) return { list: clean(src.list, 80) };
  const names = src && typeof src === 'object' && src.list === undefined && Array.isArray(src.names) ? src.names.map((n) => clean(n, 120)).filter(Boolean) : [];
  if (names.length >= 2 && names.length <= 4) return { names };
  throw new Error('scout: rankScout in compare mode needs `source` — { list } or { names: two to four }');
}
/**
 * The compare cut (WP-14e): the unique records cut to W.COMPARE_MAX — those in `where` first, then the most recently
 * listed (ISO dates, descending; undated last), then pool order. → { kept (in pool order), more }.
 */
function compareCut(unique, { in_where, listed_on }) {
  if (unique.length <= W.COMPARE_MAX) return { kept: unique, more: 0 };
  const where = in_where instanceof Set ? in_where : new Set(Array.isArray(in_where) ? in_where : []);
  const dates = listed_on && typeof listed_on === 'object' ? listed_on : {};
  const dateOf = (id) => (Object.prototype.hasOwnProperty.call(dates, id) && typeof dates[id] === 'string' ? dates[id] : '');
  const order = unique.map((rec, i) => ({ i, w: where.has(rec.place_id) ? 0 : 1, d: dateOf(rec.place_id) }))
    .sort((a, b) => a.w - b.w || (a.d > b.d ? -1 : a.d < b.d ? 1 : 0) || a.i - b.i);
  const keep = new Set(order.slice(0, W.COMPARE_MAX).map((x) => x.i));
  return { kept: unique.filter((_, i) => keep.has(i)), more: unique.length - W.COMPARE_MAX };
}

/**
 * rankScout(pool, { what, group, diet, diet_rule?, anchors, reach, judgments, trip_dates = [], city_dates?, known?, limit = 10 })
 *   → { items: [{ place_id, name, own_name, record, score, parts:{topic,quality,fit,local,reach} (0–1), labels, why, try, reach }],
 *       left_out: [{ place_id, name, reason }], more }
 * TG-PHASE-13 (WP-13d): `known` (place ids already in the owner's Places, an array or a Set) labels those picks
 * `seen_before`; `city_dates` (the dates the owner is in the searched city) replaces the trip's dates for the
 * closed-on-your-days screen and penalty; `diet_rule` (the party's hidden-stock rule) stops Google's vegetarian flag
 * alone from passing the food screen or earning `veg_likely`, except for a café-word topic; a judgment's `name` (the
 * place's own name, ≤ 120) becomes the item's `name` and `own_name` — else `name` is Google's and `own_name` null.
 * `pool` holds fromScoutResult records (or raw pool records; they are normalized here). Screens drop to left_out in
 * pool order; the rest are scored, sorted (score, then rating count, then name) and cut at `limit` (1–20); `more` is
 * how many ranked picks were cut. Ratings, counts and hours are read but never copied into an item's own fields — they
 * stay inside `record`, which the payload builder does not emit.
 *
 * Compare mode (TG-PHASE-14 WP-14e): `mode: "compare"` with `source` ({ list } or { names }), and optionally
 * `in_where` (place ids in the asked place, else the trip's destination), `listed_on` ({ place_id: ISO date }) and
 * `not_found` (names the lookup could not find). The pool is given: there is no topic screen and the topic part is 1;
 * every other screen but `duplicate` adds its code to the item's `flags` (screenFlags) instead of leaving it out; the
 * diet screens and veg labels apply to food places only (gems groupOf); a hard flag (W.HARD_FLAGS) sorts after every
 * place without one. The pool is cut to W.COMPARE_MAX before ranking (compareCut), `more` counts the cut places and
 * `limit` is ignored; not_found names lead left_out. `what` is optional (the list name or the names stand in) and
 * `group` defaults to the pool's: food when most places are food places. The result adds `mode` and `source`.
 */
export function rankScout(pool, opts = {}) {
  if (!Array.isArray(pool)) throw new Error('scout: rankScout needs a pool array');
  const compare = opts.mode === 'compare';
  const source = compare ? compareSource(opts.source) : null;
  const what = String(opts.what ?? '').trim() || (source ? source.list || source.names.join(', ') : '');
  if (!what) throw new Error('scout: rankScout needs `what`');
  const poolGroup = () => { const recs = pool.map(normalizeScoutRecord); return recs.filter((r) => groupOf(r) === 'food').length * 2 > recs.length ? 'food' : 'activities'; };
  const group = opts.group === 'food' || opts.group === 'activities' ? opts.group : compare ? poolGroup() : guessGroup(what);
  const diet = group === 'food' && typeof opts.diet === 'string' && opts.diet.trim() ? opts.diet.trim() : null;
  const trip_dates = yourDates({ trip_dates: opts.trip_dates, city_dates: opts.city_dates });
  const diet_rule = dietRule(opts.diet_rule);
  const known = opts.known instanceof Set ? opts.known : new Set(Array.isArray(opts.known) ? opts.known.filter((x) => typeof x === 'string') : []);
  const judgments = opts.judgments && typeof opts.judgments === 'object' ? opts.judgments : {};
  const limit = Math.min(W.LIMIT_MAX, Math.max(1, Number.isInteger(opts.limit) ? opts.limit : W.LIMIT_DEFAULT));

  const left_out = [], seen = new Set();
  let unique = [];
  if (compare && Array.isArray(opts.not_found)) {
    for (const n of opts.not_found) { const name = typeof n === 'string' ? clipText(n, 120) : ''; if (name) left_out.push({ place_id: null, name, reason: 'not_found' }); }
  }
  for (const raw of pool) {
    const rec = normalizeScoutRecord(raw);
    if (seen.has(rec.place_id)) { left_out.push({ place_id: rec.place_id, name: rec.name, reason: 'duplicate' }); continue; }
    seen.add(rec.place_id);
    unique.push(rec);
  }
  let cut = 0;
  if (compare) ({ kept: unique, more: cut } = compareCut(unique, opts));
  const mu = muFor(group);   // change 1: a fixed anchor per group, never the pool's mean
  const counts = nameCounts(unique);

  const ranked = [];
  for (const record of unique) {
    const judgment = judgments[record.place_id] && typeof judgments[record.place_id] === 'object' ? judgments[record.place_id] : {};
    const t = compare ? { value: 1, source: source.list ? 'list' : 'named' } : topicPart(record, { what, group, judgment });
    const reach = reachFor(record, { reach: opts.reach, anchors: opts.anchors });
    const own_name = ownName(judgment.name);
    const recGroup = compare ? groupOf(record) : group;   // compare: the diet screens and veg labels are for food places only
    const recDiet = !compare ? diet : recGroup === 'food' && typeof opts.diet === 'string' && opts.diet.trim() ? opts.diet.trim() : null;
    const flags = compare ? screenFlags(record, { reach, judgment, group: recGroup, diet: recDiet, diet_rule, what, trip_dates }) : null;
    const reason = compare ? null : screenReason(record, { topic: t.value, reach, judgment, group, diet, diet_rule, what, trip_dates });
    if (reason) { left_out.push({ place_id: record.place_id, name: own_name || record.name, reason }); continue; }

    const jLabels = Array.isArray(judgment.labels) ? judgment.labels.filter((l) => W.LABELS.includes(l)) : [];
    const chain = !!chainReason(record, counts) || jLabels.includes('chain');
    const local_count = mentionCount(record);
    const quality = qualityPart(record, mu);
    const judged = Number.isFinite(judgment.fit);
    const fit = judged ? clamp01(judgment.fit) : W.FIT_DEFAULT;   // change 5
    const local = chain ? 0 : Math.min(1, W.LOCAL_PER_MENTION * local_count);
    const closedSome = trip_dates.length ? closedDates(record.hours, trip_dates).length > 0 : false;
    const reachPart = clamp01(reachValue(reach ? reach.minutes : NaN) - (closedSome ? W.REACH.closed_some_penalty : 0));
    const parts = { topic: t.value, quality, fit, local, reach: reachPart };
    const crowd = Number.isFinite(record.rating_count) && record.rating_count >= W.CROWD_MIN_COUNT;
    const penalty = (chain ? W.PENALTY.chain : 0) + (crowd ? W.PENALTY.crowd : 0);   // change 2
    const score = Math.max(0, Math.round(100 * Object.entries(W.WEIGHTS).reduce((s, [k, w]) => s + w * parts[k], 0)) - penalty);

    const labels = new Set(jLabels);
    if (chain) labels.add('chain');
    if (reach && reach.minutes > W.LABEL.far_minutes) labels.add('far');
    if (!chain && local_count >= W.LABEL.gem_mentions && quality >= W.LABEL.gem_quality && (record.rating_count ?? 0) <= W.LABEL.gem_max_count) labels.add('gem');
    if (known.has(record.place_id)) labels.add('seen_before');
    if (isNew(record)) labels.add('new');   // change 3: kept only because a judgment vouched for it
    if (!judged) labels.add('not_judged');   // change 5
    if (recGroup === 'food') {
      const veg = vegOf(judgment);
      if (veg === 'verified') labels.add('veg_verified');
      else if (veg === 'likely' || (veg === 'unknown' && ((googleVegCounts({ diet: recDiet, diet_rule, what }) && record.serves_vegetarian === true) || (recDiet && kindLikely({ diet: recDiet, record, what }))))) labels.add('veg_likely');
      if (labels.has('veg_verified')) labels.delete('veg_likely');
    }
    const why = typeof judgment.why === 'string' && judgment.why.trim() ? clipText(judgment.why, 200) : whyLine({ record, topic_source: t.source, reach, local_count }, compare ? source.list || '' : what);
    const tryLine = typeof judgment.try === 'string' && judgment.try.trim() ? clipText(judgment.try, 120) : null;
    ranked.push({
      place_id: record.place_id, name: own_name || record.name, own_name, record, score, parts,
      labels: W.LABELS.filter((l) => labels.has(l)).slice(0, W.LABELS_MAX), why, try: tryLine,
      reach: reach ? { minutes: reach.minutes, mode: reach.mode, estimated: reach.estimated } : null,
      ...(compare ? { flags } : {})
    });
  }
  if (compare) {
    const hard = (x) => (x.flags.some((f) => W.HARD_FLAGS.includes(f)) ? 1 : 0);
    ranked.sort((a, b) => hard(a) - hard(b) || byRank(a, b));
    return { items: ranked, left_out, more: cut, group, diet, mode: 'compare', source };
  }
  ranked.sort(byRank);
  const items = ranked.slice(0, limit);
  return { items, left_out, more: ranked.length - items.length, group, diet };
}

// Developed by: LightAISolutions

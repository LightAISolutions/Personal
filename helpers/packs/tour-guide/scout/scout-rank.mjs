/**
 * Tour Guide Scout — the pool record and the ranking (helpers/decisions/TG-SCOUT.md §4). Pure: the skill passes the
 * Text Search results, its judgments and the route-matrix minutes; nothing here fetches, reads a file or keeps state.
 * Google fields (rating, count, hours, editorial summary, photo reference) are in-run inputs; the payload built from
 * this ranking (scout-payload.mjs) carries none of them.
 */
import { fromSearchResult, normalizeRecord, mentionCount } from '../gems/gems-record.mjs';
import { nameCounts, chainReason } from '../gems/gems-chains.mjs';
import { closedOnAll, closedDates } from '../gems/gems-hours.mjs';
import { haversineKm, straightLineMinutes, isLatLng } from '../gems/gems-geo.mjs';
import { CATEGORY_TYPES } from '../gems/gems-record.mjs';
import { ratingBand, numberWord } from '../gems/gems-line.mjs';
import { guessGroup, CAFE_WORDS, isCafeTopic } from './scout-text.mjs';
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
/** reachFor(record, { reach, anchors }) → { minutes, mode, estimated } | null (route row first, else a straight-line estimate). */
export function reachFor(record, { reach = {}, anchors = [] } = {}) {
  const row = reach && Object.prototype.hasOwnProperty.call(reach, record.place_id) ? reach[record.place_id] : null;
  if (row && Number.isFinite(row.minutes) && row.minutes >= 0) {
    return { minutes: row.minutes, mode: MODES.includes(row.mode) ? row.mode : 'WALK', estimated: row.estimated === true };
  }
  const pts = (anchors || []).filter(isLatLng);
  if (!isLatLng(record.location) || !pts.length) return null;
  const km = Math.min(...pts.map((a) => haversineKm(record.location, a)));
  const walk = straightLineMinutes(km, ['WALK']);
  if (walk <= W.ESTIMATE_WALK_MAX_MINUTES) return { minutes: walk, mode: 'WALK', estimated: true };
  return { minutes: straightLineMinutes(km, ['TRANSIT']), mode: 'TRANSIT', estimated: true };
}

export const isVegetarianDiet = (diet) => /\bvegetarian\b/i.test(String(diet ?? ''));
const MODE_WORDS = { WALK: 'walk', TRANSIT: 'by transit', DRIVE: 'drive' };
const TOPIC_WORDS = { judgment: (w) => `On topic for ${w}`, name: (w) => `Named for ${w}`, type: (w) => `The kind of place for ${w}`, editorial: (w) => `Known for ${w}`, none: (w) => `Loosely tied to ${w}` };

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
  if (count < S.unproven_below_count && mentionCount(record) === 0) return 'unproven';
  if (topic < S.off_topic_below) return 'off_topic';
  if (group === 'food' && diet) {
    const veg = W.VEG.includes(judgment.veg) ? judgment.veg : 'unknown';
    if (veg === 'no') return 'diet';
    if (veg === 'unknown' && !(googleVegCounts({ diet, diet_rule, what }) && record.serves_vegetarian === true)) return 'diet_unproven';
  }
  if (reach && reach.minutes > S.too_far_minutes) return 'too_far';
  return null;
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
 */
export function rankScout(pool, opts = {}) {
  if (!Array.isArray(pool)) throw new Error('scout: rankScout needs a pool array');
  const what = String(opts.what ?? '').trim();
  if (!what) throw new Error('scout: rankScout needs `what`');
  const group = opts.group === 'food' || opts.group === 'activities' ? opts.group : guessGroup(what);
  const diet = group === 'food' && typeof opts.diet === 'string' && opts.diet.trim() ? opts.diet.trim() : null;
  const trip_dates = yourDates({ trip_dates: opts.trip_dates, city_dates: opts.city_dates });
  const diet_rule = dietRule(opts.diet_rule);
  const known = opts.known instanceof Set ? opts.known : new Set(Array.isArray(opts.known) ? opts.known.filter((x) => typeof x === 'string') : []);
  const judgments = opts.judgments && typeof opts.judgments === 'object' ? opts.judgments : {};
  const limit = Math.min(W.LIMIT_MAX, Math.max(1, Number.isInteger(opts.limit) ? opts.limit : W.LIMIT_DEFAULT));

  const left_out = [], unique = [], seen = new Set();
  for (const raw of pool) {
    const rec = normalizeScoutRecord(raw);
    if (seen.has(rec.place_id)) { left_out.push({ place_id: rec.place_id, name: rec.name, reason: 'duplicate' }); continue; }
    seen.add(rec.place_id);
    unique.push(rec);
  }
  const rated = unique.filter((r) => Number.isFinite(r.rating));
  const mu = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : W.QUALITY.mu_default;
  const counts = nameCounts(unique);

  const ranked = [];
  for (const record of unique) {
    const judgment = judgments[record.place_id] && typeof judgments[record.place_id] === 'object' ? judgments[record.place_id] : {};
    const t = topicPart(record, { what, group, judgment });
    const reach = reachFor(record, { reach: opts.reach, anchors: opts.anchors });
    const own_name = ownName(judgment.name);
    const reason = screenReason(record, { topic: t.value, reach, judgment, group, diet, diet_rule, what, trip_dates });
    if (reason) { left_out.push({ place_id: record.place_id, name: own_name || record.name, reason }); continue; }

    const jLabels = Array.isArray(judgment.labels) ? judgment.labels.filter((l) => W.LABELS.includes(l)) : [];
    const chain = !!chainReason(record, counts) || jLabels.includes('chain');
    const local_count = mentionCount(record);
    const quality = qualityPart(record, mu);
    const fit = Number.isFinite(judgment.fit) ? clamp01(judgment.fit) : W.FIT_DEFAULT;
    const local = chain ? 0 : Math.min(1, W.LOCAL_PER_MENTION * local_count);
    const closedSome = trip_dates.length ? closedDates(record.hours, trip_dates).length > 0 : false;
    const reachPart = clamp01(reachValue(reach ? reach.minutes : NaN) - (closedSome ? W.REACH.closed_some_penalty : 0));
    const parts = { topic: t.value, quality, fit, local, reach: reachPart };
    const score = Math.round(100 * Object.entries(W.WEIGHTS).reduce((s, [k, w]) => s + w * parts[k], 0));

    const labels = new Set(jLabels);
    if (chain) labels.add('chain');
    if (reach && reach.minutes > W.LABEL.far_minutes) labels.add('far');
    if (!chain && local_count >= W.LABEL.gem_mentions && quality >= W.LABEL.gem_quality && (record.rating_count ?? 0) <= W.LABEL.gem_max_count) labels.add('gem');
    if (known.has(record.place_id)) labels.add('seen_before');
    if (group === 'food') {
      if (judgment.veg === 'verified') labels.add('veg_verified');
      else if (judgment.veg === 'likely' || ((judgment.veg === undefined || judgment.veg === 'unknown') && googleVegCounts({ diet, diet_rule, what }) && record.serves_vegetarian === true)) labels.add('veg_likely');
      if (labels.has('veg_verified')) labels.delete('veg_likely');
    }
    const why = typeof judgment.why === 'string' && judgment.why.trim() ? clipText(judgment.why, 200) : whyLine({ record, topic_source: t.source, reach, local_count }, what);
    const tryLine = typeof judgment.try === 'string' && judgment.try.trim() ? clipText(judgment.try, 120) : null;
    ranked.push({
      place_id: record.place_id, name: own_name || record.name, own_name, record, score, parts,
      labels: W.LABELS.filter((l) => labels.has(l)).slice(0, W.LABELS_MAX), why, try: tryLine,
      reach: reach ? { minutes: reach.minutes, mode: reach.mode, estimated: reach.estimated } : null
    });
  }
  ranked.sort(byRank);
  const items = ranked.slice(0, limit);
  return { items, left_out, more: ranked.length - items.length, group, diet };
}

// Developed by: LightAISolutions

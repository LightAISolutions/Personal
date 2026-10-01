/**
 * Maps kit — Places API (New): Place Details, Text Search and Nearby Search with the fixed masks of maps-masks.mjs.
 * One call = one request on exactly one SKU (the tier asked for). Pagination is the caller's choice: each page is a
 * new billed request, so `textSearch` returns `nextPageToken` and fetches one page only.
 */
import { PLACE_DETAILS_MASKS, PLACE_DETAILS_SKU, TEXT_SEARCH_MASKS, TEXT_SEARCH_SKU, NEARBY_SEARCH_MASKS, NEARBY_SEARCH_SKU } from './maps-masks.mjs';
import { MapsInputError } from './maps-errors.mjs';
import { guardedCall, PLACES_BASE } from './maps-http.mjs';

const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
const LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

function qs(opts) {
  const p = new URLSearchParams();
  if (opts.languageCode) { if (!LANG_RE.test(opts.languageCode)) throw new MapsInputError('maps: bad languageCode'); p.set('languageCode', opts.languageCode); }
  if (opts.regionCode) { if (!/^[A-Za-z]{2}$/.test(opts.regionCode)) throw new MapsInputError('maps: bad regionCode'); p.set('regionCode', opts.regionCode); }
  const s = p.toString();
  return s ? '?' + s : '';
}

/** placeDetails(ctx, placeId, { tier = 'enterprise', languageCode?, regionCode? }) → { place, sku, ms } */
export async function placeDetails(ctx, placeId, opts = {}) {
  const tier = opts.tier || 'enterprise';
  if (!(tier in PLACE_DETAILS_MASKS)) throw new MapsInputError(`maps: unknown Place Details tier "${tier}" (use ${Object.keys(PLACE_DETAILS_MASKS).join(', ')})`);
  if (!PLACE_ID_RE.test(String(placeId || ''))) throw new MapsInputError('maps: placeId must be a Google place id');
  const r = await guardedCall(ctx, { sku: PLACE_DETAILS_SKU[tier], method: 'GET', url: `${PLACES_BASE}/places/${encodeURIComponent(placeId)}${qs(opts)}`, mask: PLACE_DETAILS_MASKS[tier] });
  return { place: r.data, sku: r.sku, ms: r.ms };
}

/** Keys each search actually sends; anything else a caller passes is silently not sent and listed in `notSent`. */
const TEXT_KEYS = ['tier', 'pageSize', 'pageToken', 'languageCode', 'regionCode', 'includedType', 'strictTypeFiltering', 'openNow', 'minRating', 'priceLevels', 'rankPreference', 'locationBias', 'locationRestriction', 'includePureServiceAreaBusinesses'];
const NEARBY_KEYS = ['tier', 'center', 'radiusMeters', 'includedTypes', 'excludedTypes', 'includedPrimaryTypes', 'excludedPrimaryTypes', 'rankPreference', 'maxResultCount', 'languageCode', 'regionCode'];
export const PRICE_LEVELS = Object.freeze(['PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE']);
const TYPE_RE = /^[a-z][a-z0-9_]{0,63}$/;
export const NEARBY_MAX_RADIUS_M = 50000;
export const NEARBY_MAX_TYPES = 50;

const notSentKeys = (obj, allowed) => Object.keys(obj || {}).filter((k) => obj[k] !== undefined && !allowed.includes(k));

/** priceLevels(['MODERATE', 'PRICE_LEVEL_EXPENSIVE']) → ['PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE'] (deduped, validated). */
export function normalizePriceLevels(levels, allowed = PRICE_LEVELS) {
  if (!Array.isArray(levels)) throw new MapsInputError('maps: priceLevels must be an array');
  const out = [];
  for (const l of levels) {
    const v = String(l || '').toUpperCase();
    const full = v.startsWith('PRICE_LEVEL_') ? v : 'PRICE_LEVEL_' + v;
    if (!allowed.includes(full)) throw new MapsInputError(`maps: price level "${l}" is not one of ${allowed.join(', ')}`);
    if (!out.includes(full)) out.push(full);
  }
  return out;
}
function lang(body, opts) {
  if (opts.languageCode) { if (!LANG_RE.test(opts.languageCode)) throw new MapsInputError('maps: bad languageCode'); body.languageCode = opts.languageCode; }
}
function region(body, opts) {
  if (opts.regionCode) { if (!/^[A-Za-z]{2}$/.test(opts.regionCode)) throw new MapsInputError('maps: regionCode must be a two-letter CLDR code'); body.regionCode = String(opts.regionCode).toLowerCase(); }
}
function latLngOf(p, what) {
  if (!p || !isLatLng(p.lat, p.lng)) throw new MapsInputError(`maps: ${what} needs numeric lat and lng`);
  return { latitude: p.lat, longitude: p.lng };
}
/** { low: { lat, lng }, high: { lat, lng } } → Google's rectangle viewport (low = south-west, high = north-east). */
function rectangle(r, what) {
  if (!r || typeof r !== 'object' || !r.low || !r.high) throw new MapsInputError(`maps: ${what} must be a rectangle { low: { lat, lng }, high: { lat, lng } }`);
  const low = latLngOf(r.low, what + '.low'), high = latLngOf(r.high, what + '.high');
  if (low.latitude > high.latitude) throw new MapsInputError(`maps: ${what}.low must be south of ${what}.high`);
  return { rectangle: { low, high } };
}
function typeList(v, what) {
  if (v == null) return null;
  if (!Array.isArray(v) || v.length > NEARBY_MAX_TYPES || !v.every((t) => TYPE_RE.test(String(t)))) throw new MapsInputError(`maps: ${what} must be up to ${NEARBY_MAX_TYPES} place types (Table A names such as "restaurant")`);
  return v.length ? [...new Set(v.map(String))] : null;
}

/**
 * textSearch(ctx, query, { tier = 'pro', pageSize?, pageToken?, languageCode?, regionCode?, includedType?,
 *   strictTypeFiltering?, openNow?, minRating?, priceLevels?, rankPreference?, includePureServiceAreaBusinesses?,
 *   locationBias?: { lat, lng, radiusMeters } | { low, high }, locationRestriction?: { low: { lat, lng }, high: { lat, lng } } })
 *   → { places, nextPageToken, sku, ms, notSent }
 * Tiers: ids_only (free) · pro · enterprise · enterprise_atmosphere. `strictTypeFiltering` is sent only with `includedType`;
 * options Text Search does not take (e.g. Nearby's `center`, `maxResultCount`) are not sent and are listed in `notSent`.
 */
export async function textSearch(ctx, query, opts = {}) {
  const tier = opts.tier || 'pro';
  if (!(tier in TEXT_SEARCH_MASKS)) throw new MapsInputError(`maps: unknown Text Search tier "${tier}" (use ${Object.keys(TEXT_SEARCH_MASKS).join(', ')})`);
  const q = String(query || '').trim();
  if (!q || q.length > 500) throw new MapsInputError('maps: text query must be 1–500 characters');
  const notSent = notSentKeys(opts, TEXT_KEYS);
  const body = { textQuery: q };
  if (opts.pageSize != null) { if (!Number.isInteger(opts.pageSize) || opts.pageSize < 1 || opts.pageSize > 20) throw new MapsInputError('maps: pageSize must be 1–20'); body.pageSize = opts.pageSize; }
  if (opts.pageToken) body.pageToken = String(opts.pageToken);
  lang(body, opts);
  if (opts.regionCode) body.regionCode = String(opts.regionCode);
  if (opts.includedType) { if (!TYPE_RE.test(String(opts.includedType))) throw new MapsInputError('maps: includedType must be one Table A place type'); body.includedType = String(opts.includedType); }
  if (opts.strictTypeFiltering != null) { if (body.includedType) body.strictTypeFiltering = !!opts.strictTypeFiltering; else notSent.push('strictTypeFiltering'); }
  if (opts.openNow != null) body.openNow = !!opts.openNow;
  if (opts.minRating != null) {
    const r = Number(opts.minRating);
    if (!Number.isFinite(r) || r < 0 || r > 5 || Math.round(r * 2) !== r * 2) throw new MapsInputError('maps: minRating must be 0–5 in steps of 0.5');
    body.minRating = r;
  }
  if (opts.priceLevels != null) { const p = normalizePriceLevels(opts.priceLevels, PRICE_LEVELS); if (p.length) body.priceLevels = p; }
  if (opts.rankPreference != null) {
    if (!['RELEVANCE', 'DISTANCE'].includes(opts.rankPreference)) throw new MapsInputError('maps: Text Search rankPreference must be RELEVANCE or DISTANCE');
    body.rankPreference = opts.rankPreference;
  }
  if (opts.includePureServiceAreaBusinesses != null) body.includePureServiceAreaBusinesses = !!opts.includePureServiceAreaBusinesses;
  if (opts.locationBias && opts.locationRestriction) throw new MapsInputError('maps: give locationBias or locationRestriction, not both');
  if (opts.locationBias) {
    if (opts.locationBias.low || opts.locationBias.high) body.locationBias = rectangle(opts.locationBias, 'locationBias');
    else {
      const { lat, lng, radiusMeters = 5000 } = opts.locationBias;
      if (!isLatLng(lat, lng) || !(radiusMeters > 0 && radiusMeters <= 50000)) throw new MapsInputError('maps: locationBias needs lat, lng and radiusMeters ≤ 50000');
      body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters } };
    }
  }
  if (opts.locationRestriction) {
    if (opts.locationRestriction.radiusMeters != null || opts.locationRestriction.circle) throw new MapsInputError('maps: Text Search locationRestriction takes a rectangle only (use locationBias for a circle)');
    body.locationRestriction = rectangle(opts.locationRestriction, 'locationRestriction');
  }
  const r = await guardedCall(ctx, { sku: TEXT_SEARCH_SKU[tier], method: 'POST', url: `${PLACES_BASE}/places:searchText`, mask: TEXT_SEARCH_MASKS[tier], body });
  return { places: r.data.places || [], nextPageToken: r.data.nextPageToken || null, sku: r.sku, ms: r.ms, notSent };
}

/**
 * searchNearby(ctx, { center: { lat, lng }, radiusMeters, includedTypes?, excludedTypes?, includedPrimaryTypes?,
 *   excludedPrimaryTypes?, rankPreference?: 'POPULARITY'|'DISTANCE', maxResultCount? (1–20), languageCode?, regionCode? },
 *   { tier = 'pro' }) → { places, nextPageToken: null, sku, ms, notSent, notes }
 * Tiers: pro · enterprise · enterprise_atmosphere (Nearby Search has no IDs-only SKU). One request, up to 20 places, no
 * pagination. `radiusMeters` is clamped to Google's (0, 50000] (noted in `notes`). Text Search-only options (`minRating`,
 * `openNow`, `priceLevels`, `pageToken`, `includedType`, `strictTypeFiltering`, `locationBias`, …) are not sent and are
 * listed in `notSent`.
 */
export async function searchNearby(ctx, params = {}, opts = {}) {
  const tier = opts.tier || params.tier || 'pro';
  if (!(tier in NEARBY_SEARCH_MASKS)) throw new MapsInputError(`maps: unknown Nearby Search tier "${tier}" (use ${Object.keys(NEARBY_SEARCH_MASKS).join(', ')})`);
  const notSent = notSentKeys(params, NEARBY_KEYS), notes = [];
  const center = latLngOf(params.center, 'center');
  let radius = Number(params.radiusMeters);
  if (params.radiusMeters == null || !Number.isFinite(radius)) throw new MapsInputError('maps: radiusMeters is required (a number of metres)');
  if (radius > NEARBY_MAX_RADIUS_M) { notes.push(`radiusMeters ${radius} clamped to ${NEARBY_MAX_RADIUS_M}`); radius = NEARBY_MAX_RADIUS_M; }
  if (radius <= 0) { notes.push(`radiusMeters ${radius} clamped to 1`); radius = 1; }
  const body = { locationRestriction: { circle: { center, radius } } };
  const lists = {};
  for (const k of ['includedTypes', 'excludedTypes', 'includedPrimaryTypes', 'excludedPrimaryTypes']) { const v = typeList(params[k], k); if (v) lists[k] = body[k] = v; }
  const clash = (lists.includedTypes || []).filter((t) => (lists.excludedTypes || []).includes(t)).concat((lists.includedPrimaryTypes || []).filter((t) => (lists.excludedPrimaryTypes || []).includes(t)));
  if (clash.length) throw new MapsInputError('maps: a type is both included and excluded: ' + clash.join(', '));
  if (params.rankPreference != null) {
    if (!['POPULARITY', 'DISTANCE'].includes(params.rankPreference)) throw new MapsInputError('maps: Nearby Search rankPreference must be POPULARITY or DISTANCE');
    body.rankPreference = params.rankPreference;
  }
  if (params.maxResultCount != null) { if (!Number.isInteger(params.maxResultCount) || params.maxResultCount < 1 || params.maxResultCount > 20) throw new MapsInputError('maps: maxResultCount must be 1–20'); body.maxResultCount = params.maxResultCount; }
  lang(body, params);
  region(body, params);
  const r = await guardedCall(ctx, { sku: NEARBY_SEARCH_SKU[tier], method: 'POST', url: `${PLACES_BASE}/places:searchNearby`, mask: NEARBY_SEARCH_MASKS[tier], body });
  return { places: r.data.places || [], nextPageToken: null, sku: r.sku, ms: r.ms, notSent, notes };
}

const localized = (t) => (t && typeof t === 'object' ? { text: String(t.text ?? ''), languageCode: t.languageCode ?? null } : null);

/**
 * normalizeReviews(place) → up to 5 reviews as Google returned them (relevance order), flattened for evidence checks:
 * [{ rating, text, languageCode, originalText, originalLanguageCode, author: { displayName, uri, photoUri },
 *   publishTime, relativePublishTimeDescription, googleMapsUri, flagContentUri }]. The author block must be shown with
 * any review that is displayed; reviews are read in-run only and never persisted (Maps terms §3.2.3).
 */
export function normalizeReviews(place) {
  return (Array.isArray(place?.reviews) ? place.reviews : []).slice(0, 5).map((r) => ({
    rating: Number.isFinite(r.rating) ? r.rating : null,
    text: r.text?.text ?? null, languageCode: r.text?.languageCode ?? null,
    originalText: r.originalText?.text ?? null, originalLanguageCode: r.originalText?.languageCode ?? null,
    author: { displayName: r.authorAttribution?.displayName ?? null, uri: r.authorAttribution?.uri ?? null, photoUri: r.authorAttribution?.photoUri ?? null },
    publishTime: r.publishTime ?? null, relativePublishTimeDescription: r.relativePublishTimeDescription ?? null,
    googleMapsUri: r.googleMapsUri ?? null, flagContentUri: r.flagContentUri ?? null
  }));
}

/**
 * placeEvidence(place) → the fields the gem engine's checks read from a Details (or search) result, flattened:
 * { id, rating, userRatingCount, reviews (normalizeReviews), newestReviewTime, oldestReviewTime, reviewSummary,
 *   editorialSummary, generativeSummary, priceLevel, priceRange, regularOpeningHours, websiteUri, googleMapsUri }.
 * Absent fields are null (summaries are regional and "not guaranteed for all places"). Display rules: a summary needs its
 * `disclosureText` and the Maps link; a review needs its author block. Nothing here is meant to be stored.
 */
export function placeEvidence(place) {
  const reviews = normalizeReviews(place);
  const times = reviews.map((r) => r.publishTime).filter(Boolean).sort();
  const rs = place?.reviewSummary, gs = place?.generativeSummary;
  return {
    id: place?.id ?? null,
    rating: Number.isFinite(place?.rating) ? place.rating : null,
    userRatingCount: Number.isInteger(place?.userRatingCount) ? place.userRatingCount : null,
    reviews, newestReviewTime: times.at(-1) ?? null, oldestReviewTime: times[0] ?? null,
    reviewSummary: rs ? { ...localized(rs.text), disclosureText: rs.disclosureText?.text ?? null, reviewsUri: rs.reviewsUri ?? null, flagContentUri: rs.flagContentUri ?? null } : null,
    editorialSummary: localized(place?.editorialSummary),
    generativeSummary: gs ? { ...localized(gs.overview), disclosureText: gs.disclosureText?.text ?? null, flagContentUri: gs.overviewFlagContentUri ?? null } : null,
    priceLevel: place?.priceLevel ?? null, priceRange: place?.priceRange ?? null,
    regularOpeningHours: place?.regularOpeningHours ?? null, websiteUri: place?.websiteUri ?? null, googleMapsUri: place?.googleMapsUri ?? null
  };
}

export function isLatLng(lat, lng) { return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180; }

// Developed by: LightAISolutions

/**
 * Maps kit — Places Aggregate API (`computeInsights`, WP-2g-kits): how many places match an area + filters, and their
 * place ids when 100 or fewer match. One request = one `places.aggregate.compute_insights` unit, reserved on the ledger
 * before sending like every other call; the method takes no field mask.
 * Only CIRCLE areas are accepted for now (regions and custom polygons are refused): the Gem Funnel lays circles around
 * its own geocoded anchors and never runs point-in-polygon tests on Google coordinates (Maps terms §3.2.3(c)(iv)).
 * Host: areainsights.googleapis.com. Until the owner adds it to the credential's hosts (Phase 7) a live call fails at the
 * proxy (PROXY_REFUSED) or at Google without a key (AUTH); the ledger counts it as failed.
 * Request shape: https://developers.google.com/maps/documentation/places-aggregate/reference/rest/v1/TopLevel/computeInsights
 */
import { MapsInputError } from './maps-errors.mjs';
import { guardedCall } from './maps-http.mjs';
import { AGGREGATE_SKU } from './maps-masks.mjs';
import { PRICE_LEVELS, normalizePriceLevels, isLatLng } from './maps-places.mjs';

export const AGGREGATE_BASE = 'https://areainsights.googleapis.com/v1';
export const AGGREGATE_URL = AGGREGATE_BASE + ':computeInsights';
export const INSIGHTS = Object.freeze(['INSIGHT_COUNT', 'INSIGHT_PLACES']);
export const OPERATING_STATUSES = Object.freeze(['OPERATING_STATUS_OPERATIONAL', 'OPERATING_STATUS_PERMANENTLY_CLOSED', 'OPERATING_STATUS_TEMPORARILY_CLOSED']);
/** Google's area floor is 1,556.86 m² (a circle of radius ≈ 22.3 m); the kit's ceiling mirrors Nearby Search's 50 km. */
export const AGGREGATE_MIN_RADIUS_M = 23;
export const AGGREGATE_MAX_RADIUS_M = 50000;
/** Google returns place ids only when the count is at most this. */
export const AGGREGATE_MAX_PLACES = 100;
const TYPE_RE = /^[a-z][a-z0-9_]{0,63}$/;
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
const TYPE_KEYS = ['includedTypes', 'excludedTypes', 'includedPrimaryTypes', 'excludedPrimaryTypes'];

function circleOf(area) {
  if (!area || typeof area !== 'object') throw new MapsInputError('maps: computeInsights needs area: { circle: { center, radiusMeters } }');
  const other = Object.keys(area).filter((k) => k !== 'circle');
  if (other.length || !area.circle) throw new MapsInputError(`maps: computeInsights takes circle areas only for now (got ${other.concat(area.circle ? [] : ['no circle']).join(', ')}); regions and polygons are refused`);
  const { center, radiusMeters } = area.circle;
  const r = Number(radiusMeters);
  if (!Number.isFinite(r) || r < AGGREGATE_MIN_RADIUS_M || r > AGGREGATE_MAX_RADIUS_M) throw new MapsInputError(`maps: circle radiusMeters must be ${AGGREGATE_MIN_RADIUS_M}–${AGGREGATE_MAX_RADIUS_M}`);
  const circle = { radius: Math.round(r) };
  if (center && center.placeId != null) {
    if (!PLACE_ID_RE.test(String(center.placeId))) throw new MapsInputError('maps: circle center placeId must be a Google place id');
    circle.place = 'places/' + center.placeId;
  } else if (center && isLatLng(center.lat, center.lng)) circle.latLng = { latitude: center.lat, longitude: center.lng };
  else throw new MapsInputError('maps: circle center must be { lat, lng } or { placeId }');
  return circle;
}

function typeFilterOf(tf) {
  if (!tf || typeof tf !== 'object') throw new MapsInputError('maps: computeInsights needs a typeFilter');
  const out = {};
  for (const k of TYPE_KEYS) {
    if (tf[k] == null) continue;
    if (!Array.isArray(tf[k]) || tf[k].length > 50 || !tf[k].every((t) => TYPE_RE.test(String(t)))) throw new MapsInputError(`maps: typeFilter.${k} must be up to 50 place types`);
    if (tf[k].length) out[k] = [...new Set(tf[k].map(String))];
  }
  if (!Object.keys(out).length) throw new MapsInputError('maps: typeFilter needs at least one non-empty type list');
  return out;
}

function ratingFilterOf(rf) {
  const out = {};
  for (const k of ['minRating', 'maxRating']) {
    if (rf[k] == null) continue;
    const v = Number(rf[k]);
    if (!Number.isFinite(v) || v < 1 || v > 5) throw new MapsInputError(`maps: ratingFilter.${k} must be 1.0–5.0`);
    out[k] = v;
  }
  if (!Object.keys(out).length) throw new MapsInputError('maps: ratingFilter needs minRating and/or maxRating');
  if (out.minRating != null && out.maxRating != null && out.minRating > out.maxRating) throw new MapsInputError('maps: ratingFilter.minRating must be ≤ maxRating');
  return out;
}

/** 'OPERATIONAL' or 'OPERATING_STATUS_OPERATIONAL' → 'OPERATING_STATUS_OPERATIONAL'. */
function statusesOf(list) {
  if (!Array.isArray(list)) throw new MapsInputError('maps: operatingStatus must be an array');
  return [...new Set(list.map((s) => {
    const v = String(s || '').toUpperCase();
    const full = v.startsWith('OPERATING_STATUS_') ? v : 'OPERATING_STATUS_' + v;
    if (!OPERATING_STATUSES.includes(full)) throw new MapsInputError(`maps: operating status "${s}" is not one of ${OPERATING_STATUSES.join(', ')}`);
    return full;
  }))];
}

/** computeInsightsRequest(params) → the request body Google receives (validated; nothing sent). */
export function computeInsightsRequest({ insights, area, typeFilter, ratingFilter, operatingStatus, priceLevels } = {}) {
  if (!Array.isArray(insights) || !insights.length || !insights.every((i) => INSIGHTS.includes(i))) throw new MapsInputError(`maps: insights must be a non-empty list of ${INSIGHTS.join(', ')}`);
  const filter = { locationFilter: { circle: circleOf(area) }, typeFilter: typeFilterOf(typeFilter) };
  if (operatingStatus != null) { const s = statusesOf(operatingStatus); if (s.length) filter.operatingStatus = s; }
  if (priceLevels != null) { const p = normalizePriceLevels(priceLevels, PRICE_LEVELS); if (p.length) filter.priceLevels = p; }
  if (ratingFilter != null) filter.ratingFilter = ratingFilterOf(ratingFilter);
  return { insights: [...new Set(insights)], filter };
}

/** Google's answer → { count: number|null, placeIds: [string] } (`count` is an int64 string on the wire; ids lose `places/`). */
export function normalizeInsights(data) {
  const n = data && data.count != null ? Number(data.count) : NaN;
  const placeIds = (Array.isArray(data?.placeInsights) ? data.placeInsights : []).map((p) => String(p?.place || '').replace(/^places\//, '')).filter((id) => PLACE_ID_RE.test(id));
  return { count: Number.isFinite(n) ? n : null, placeIds };
}

/**
 * computeInsights(ctx, { insights: ['INSIGHT_COUNT' | 'INSIGHT_PLACES'], area: { circle: { center: { lat, lng } | { placeId }, radiusMeters } },
 *   typeFilter: { includedTypes?, excludedTypes?, includedPrimaryTypes?, excludedPrimaryTypes? },
 *   ratingFilter?: { minRating?, maxRating? }, operatingStatus?: ['OPERATIONAL', …], priceLevels?: ['MODERATE', …] })
 *   → { count, placeIds, sku, ms }
 * Ask INSIGHT_COUNT first: Google only lists ids when ≤ 100 places match.
 */
export async function computeInsights(ctx, params = {}) {
  const body = computeInsightsRequest(params); // throws MapsInputError before the ledger or the network is touched
  const r = await guardedCall(ctx, { sku: AGGREGATE_SKU, method: 'POST', url: AGGREGATE_URL, mask: null, body });
  return { ...normalizeInsights(r.data), sku: r.sku, ms: r.ms };
}

// Developed by: LightAISolutions

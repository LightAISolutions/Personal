/**
 * Maps kit — Places API (New): Place Details and Text Search with the fixed masks of maps-masks.mjs.
 * One call = one request on exactly one SKU (the tier asked for). Pagination is the caller's choice: each page is a
 * new billed request, so `textSearch` returns `nextPageToken` and fetches one page only.
 */
import { PLACE_DETAILS_MASKS, PLACE_DETAILS_SKU, TEXT_SEARCH_MASKS, TEXT_SEARCH_SKU } from './maps-masks.mjs';
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

/**
 * textSearch(ctx, query, { tier = 'pro', pageSize?, pageToken?, languageCode?, regionCode?, includedType?, openNow?,
 *   locationBias?: { lat, lng, radiusMeters } }) → { places, nextPageToken, sku, ms }
 */
export async function textSearch(ctx, query, opts = {}) {
  const tier = opts.tier || 'pro';
  if (!(tier in TEXT_SEARCH_MASKS)) throw new MapsInputError(`maps: unknown Text Search tier "${tier}" (use ${Object.keys(TEXT_SEARCH_MASKS).join(', ')})`);
  const q = String(query || '').trim();
  if (!q || q.length > 500) throw new MapsInputError('maps: text query must be 1–500 characters');
  const body = { textQuery: q };
  if (opts.pageSize != null) { if (!Number.isInteger(opts.pageSize) || opts.pageSize < 1 || opts.pageSize > 20) throw new MapsInputError('maps: pageSize must be 1–20'); body.pageSize = opts.pageSize; }
  if (opts.pageToken) body.pageToken = String(opts.pageToken);
  if (opts.languageCode) { if (!LANG_RE.test(opts.languageCode)) throw new MapsInputError('maps: bad languageCode'); body.languageCode = opts.languageCode; }
  if (opts.regionCode) body.regionCode = String(opts.regionCode);
  if (opts.includedType) body.includedType = String(opts.includedType);
  if (opts.openNow != null) body.openNow = !!opts.openNow;
  if (opts.locationBias) {
    const { lat, lng, radiusMeters = 5000 } = opts.locationBias;
    if (!isLatLng(lat, lng) || !(radiusMeters > 0 && radiusMeters <= 50000)) throw new MapsInputError('maps: locationBias needs lat, lng and radiusMeters ≤ 50000');
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters } };
  }
  const r = await guardedCall(ctx, { sku: TEXT_SEARCH_SKU[tier], method: 'POST', url: `${PLACES_BASE}/places:searchText`, mask: TEXT_SEARCH_MASKS[tier], body });
  return { places: r.data.places || [], nextPageToken: r.data.nextPageToken || null, sku: r.sku, ms: r.ms };
}

export function isLatLng(lat, lng) { return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180; }

// Developed by: LightAISolutions

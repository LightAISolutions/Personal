/**
 * Maps kit — Place Photos (New). Place Details lists `photos[]` ({ name, widthPx, heightPx, authorAttributions }) in
 * its IDs-only tier, so every Details mask carries them. Fetching one is two requests:
 *   1. GET https://places.googleapis.com/v1/{photo.name}/media?maxWidthPx=N&skipHttpRedirect=true → { photoUri }
 *      — billed once on SKU "Place Details Photos" (1,000 free a month; read 2026-10-01), counted on the ledger before
 *      sending (kit ceiling 800 by default). The places host gets its key from the egress proxy.
 *   2. GET photoUri (a googleusercontent image, no key, not a Places call) → bytes.
 * Photos are build-scoped content: inline them into the build's output, never into a reusable cache. The author
 * attribution MUST be shown with the photo (Places policy) — it is returned alongside the bytes for that reason.
 */
import { MapsInputError, MapsRequestError } from './maps-errors.mjs';
import { guardedCall, PLACES_BASE } from './maps-http.mjs';

export const PHOTOS_SKU = 'places.details.photos';
export const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]{1,300}\/photos\/[A-Za-z0-9_-]{1,400}$/;
export const PHOTO_MAX_PX = 4800;

/** The attribution list in the kit's shape: [{ displayName, uri, photoUri }] (strings, possibly empty). */
export function normalizeAttributions(list) {
  return (Array.isArray(list) ? list : []).map((a) => ({ displayName: String(a?.displayName || ''), uri: String(a?.uri || ''), photoUri: String(a?.photoUri || '') }));
}

/**
 * placePhoto(ctx, photo, { maxWidthPx?, maxHeightPx? }) → { bytes, contentType, name, widthPx, heightPx,
 *   authorAttributions, photoUri, sku, ms }. `photo` is a Details `photos[]` entry or its `name` string.
 */
export async function placePhoto(ctx, photo, { maxWidthPx, maxHeightPx } = {}) {
  const p = typeof photo === 'string' ? { name: photo } : (photo || {});
  if (!PHOTO_NAME_RE.test(String(p.name || ''))) throw new MapsInputError('maps: photo name must look like places/<place>/photos/<photo>');
  if (maxWidthPx == null && maxHeightPx == null) maxWidthPx = 1200;
  for (const [k, v] of [['maxWidthPx', maxWidthPx], ['maxHeightPx', maxHeightPx]]) if (v != null && !(Number.isInteger(v) && v >= 1 && v <= PHOTO_MAX_PX)) throw new MapsInputError(`maps: ${k} must be an integer 1–${PHOTO_MAX_PX}`);
  const q = new URLSearchParams({ skipHttpRedirect: 'true' });
  if (maxWidthPx != null) q.set('maxWidthPx', String(maxWidthPx));
  if (maxHeightPx != null) q.set('maxHeightPx', String(maxHeightPx));
  const r = await guardedCall(ctx, { sku: PHOTOS_SKU, method: 'GET', url: `${PLACES_BASE}/${p.name}/media?${q}`, mask: null });
  const uri = String(r.data?.photoUri || '');
  if (!/^https:\/\//.test(uri)) throw new MapsRequestError('BAD_JSON', 'maps: photo media answer carried no https photoUri', { sku: PHOTOS_SKU });
  let res;
  try { res = await ctx.transport({ method: 'GET', url: uri, headers: { Accept: 'image/*' }, timeoutMs: ctx.timeoutMs || 20000 }); }
  catch (e) { e.message = String(e.message).split(uri).join('[photoUri]'); throw e; }
  const type = String(res.headers?.['content-type'] || '').toLowerCase().split(';')[0];
  if (res.status < 200 || res.status >= 300 || !type.startsWith('image/')) throw new MapsRequestError(res.status >= 500 ? 'UPSTREAM' : 'HTTP_' + res.status, `maps: photo image answered HTTP ${res.status} (${type || 'no content type'})`, { status: res.status, sku: PHOTOS_SKU });
  const bytes = res.bytes ? Buffer.from(res.bytes) : Buffer.from(res.text || '', 'binary');
  return { bytes, contentType: type, name: p.name, widthPx: p.widthPx ?? null, heightPx: p.heightPx ?? null, authorAttributions: normalizeAttributions(p.authorAttributions), photoUri: uri, sku: PHOTOS_SKU, ms: (r.ms || 0) + (res.ms || 0) };
}

// Developed by: LightAISolutions

/**
 * Maps kit — Maps Static API (`GET https://maps.googleapis.com/maps/api/staticmap`, SKU "Static Maps", 10,000 free a
 * month, read 2026-10-01). Three parts:
 *   staticMapUrl(spec)       → the request URL WITHOUT a key (pure; validates; shortens polylines under URL_MAX_CHARS)
 *   signStaticMapUrl(u, s)   → the same URL with `signature=` last (HMAC-SHA1 over path+query, url-safe base64 secret)
 *   staticMap(ctx, spec)     → PNG bytes through the SKU ledger (hard stop) and the tunnel transport
 * The key is NOT injected by the egress proxy for this host (verified: a header-only key answers 403), so the client
 * appends `key=<MAPS_STATIC_KEY>` at send time only. The keyed URL is never returned, logged or put in an error.
 * Spec: { width, height (≤ 640 each), scale (1|2, default 2), format ('png'|'png32'|'jpg', default png),
 *         maptype, language, region, center {lat,lng}|string, zoom (0–21),
 *         markers: [{ lat, lng, label? ('A'–'Z' | '0'–'9', default/mid size only), color? (name or 0xRRGGBB), size? }],
 *         paths:   [{ points: [{lat,lng}] | polyline: '<encoded>', color? (0xRRGGBBAA or name), weight?, geodesic? }],
 *         styles:  ['feature:poi|visibility:off', …] }
 */
import { createHmac } from 'node:crypto';
import { MapsInputError, MapsRequestError, MapsError } from './maps-errors.mjs';
import { encodePolyline, decodePolyline, simplifyPoints } from './maps-polyline.mjs';

export const STATIC_MAPS_BASE = 'https://maps.googleapis.com/maps/api/staticmap';
export const STATIC_MAPS_SKU = 'static_maps';
export const STATIC_MAX_SIDE = 640;
export const URL_MAX_CHARS = 16384;

const COLOR_NAMES = new Set(['black', 'brown', 'green', 'purple', 'yellow', 'blue', 'gray', 'orange', 'red', 'white']);
const MARKER_SIZES = new Set(['tiny', 'small', 'mid']);
const MAPTYPES = new Set(['roadmap', 'satellite', 'terrain', 'hybrid']);
const bad = (m, d) => { throw new MapsInputError('maps: static map spec: ' + m, d); };
const isLatLng = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
const ll = (p) => `${+p.lat.toFixed(6)},${+p.lng.toFixed(6)}`;
/** Percent-encode a value; `:` and `,` stay literal (Google accepts them and they keep the URL short). */
const enc = (v) => encodeURIComponent(String(v)).replace(/%3A/gi, ':').replace(/%2C/gi, ',');
const color = (c, alpha) => {
  if (c === undefined) return null;
  const s = String(c);
  if (COLOR_NAMES.has(s) || new RegExp(`^0x[0-9A-Fa-f]{6}${alpha ? '([0-9A-Fa-f]{2})?' : ''}$`).test(s)) return s;
  return bad(`bad color "${s}" (a name or 0xRRGGBB${alpha ? '[AA]' : ''})`);
};
function markerParams(markers) {
  const groups = new Map();
  markers.forEach((m, i) => {
    if (!isLatLng(m)) bad(`markers[${i}] needs lat/lng`);
    const size = m.size === undefined ? '' : String(m.size);
    if (size && !MARKER_SIZES.has(size)) bad(`markers[${i}].size "${size}" (tiny, small, mid or omitted)`);
    const label = m.label === undefined || m.label === null || m.label === '' ? '' : String(m.label);
    if (label && !/^[A-Z0-9]$/.test(label)) bad(`markers[${i}].label "${label}" must be one character A–Z or 0–9`);
    if (label && (size === 'tiny' || size === 'small')) bad(`markers[${i}]: labels only show on default or mid markers`);
    const style = [size && `size:${size}`, color(m.color, false) && `color:${color(m.color, false)}`, label && `label:${label}`].filter(Boolean).join('|');
    if (!groups.has(style)) groups.set(style, []);
    groups.get(style).push(ll(m));
  });
  return [...groups].map(([style, pts]) => 'markers=' + enc((style ? style + '|' : '') + pts.join('|')));
}
/** Normalize paths to { style, points } so the length reducer can re-encode them. */
function pathSpecs(paths) {
  return paths.map((p, i) => {
    let points;
    if (typeof p.polyline === 'string' && p.polyline) { try { points = decodePolyline(p.polyline); } catch { bad(`paths[${i}].polyline is not an encoded polyline`); } }
    else if (Array.isArray(p.points) && p.points.length) { p.points.forEach((q, j) => { if (!isLatLng(q)) bad(`paths[${i}].points[${j}] needs lat/lng`); }); points = p.points.map((q) => ({ lat: q.lat, lng: q.lng })); }
    else bad(`paths[${i}] needs points or polyline`);
    if (p.weight !== undefined && !(Number.isInteger(p.weight) && p.weight >= 1 && p.weight <= 20)) bad(`paths[${i}].weight must be 1–20`);
    const style = [color(p.color, true) && `color:${color(p.color, true)}`, p.weight !== undefined && `weight:${p.weight}`, p.geodesic && 'geodesic:true'].filter(Boolean).join('|');
    return { style, points };
  });
}
const pathParam = (p, precision) => 'path=' + enc((p.style ? p.style + '|' : '') + (p.points.length === 1 ? ll(p.points[0]) : 'enc:' + encodePolyline(p.points, precision)));

/**
 * staticMapRequest(spec, { maxChars = URL_MAX_CHARS }) → { url, width, height, scale, pixelWidth, pixelHeight, notes }
 * `url` carries no key. Over the length limit, paths lose precision (5 → 4 decimals), then points (Douglas–Peucker at
 * growing tolerances); `notes` says what was done. Throws MapsInputError (code BAD_INPUT) when it still will not fit.
 */
export function staticMapRequest(spec = {}, { maxChars = URL_MAX_CHARS } = {}) {
  const width = spec.width ?? spec.size?.width, height = spec.height ?? spec.size?.height;
  for (const [k, v] of [['width', width], ['height', height]]) if (!(Number.isInteger(v) && v >= 1 && v <= STATIC_MAX_SIDE)) bad(`${k} must be an integer 1–${STATIC_MAX_SIDE}`);
  const scale = spec.scale ?? 2;
  if (![1, 2].includes(scale)) bad('scale must be 1 or 2');
  const format = spec.format ?? 'png';
  if (!['png', 'png8', 'png32', 'jpg', 'jpg-baseline', 'gif'].includes(format)) bad(`format "${format}"`);
  if (spec.maptype !== undefined && !MAPTYPES.has(spec.maptype)) bad(`maptype "${spec.maptype}"`);
  if (spec.zoom !== undefined && !(Number.isInteger(spec.zoom) && spec.zoom >= 0 && spec.zoom <= 21)) bad('zoom must be an integer 0–21');
  const markers = Array.isArray(spec.markers) ? spec.markers : [];
  const paths = pathSpecs(Array.isArray(spec.paths) ? spec.paths : []);
  const styles = Array.isArray(spec.styles) ? spec.styles.map(String) : [];
  if (spec.center === undefined && spec.zoom === undefined && !markers.length && !paths.length) bad('give center + zoom, or at least one marker or path');
  if (spec.center !== undefined && !(isLatLng(spec.center) || (typeof spec.center === 'string' && spec.center.trim()))) bad('center must be {lat,lng} or a string');
  const head = [`size=${width}x${height}`, `scale=${scale}`, `format=${format}`];
  for (const [k, v] of [['maptype', spec.maptype], ['language', spec.language], ['region', spec.region]]) if (v !== undefined) head.push(`${k}=${enc(v)}`);
  if (spec.center !== undefined) head.push('center=' + enc(isLatLng(spec.center) ? ll(spec.center) : spec.center.trim()));
  if (spec.zoom !== undefined) head.push('zoom=' + spec.zoom);
  styles.forEach((s) => head.push('style=' + enc(s)));
  head.push(...markerParams(markers));
  const notes = [];
  const build = (ps, precision) => STATIC_MAPS_BASE + '?' + head.concat(ps.map((p) => pathParam(p, precision))).join('&');
  let url = build(paths, 5), cur = paths;
  if (url.length > maxChars) { url = build(paths, 4); notes.push('path precision reduced to 4 decimals'); }
  for (const tol of [1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3]) {
    if (url.length <= maxChars) break;
    cur = paths.map((p) => ({ ...p, points: simplifyPoints(p.points, tol) }));
    url = build(cur, 4);
    notes.push(`paths simplified at ${tol}° (${cur.reduce((a, p) => a + p.points.length, 0)} points)`);
  }
  if (url.length > maxChars) bad(`URL would be ${url.length} characters even after simplifying paths (limit ${maxChars})`, { chars: url.length });
  return { url, width, height, scale, pixelWidth: width * scale, pixelHeight: height * scale, notes };
}
/** staticMapUrl(spec) → URL string without a key. */
export const staticMapUrl = (spec, opts) => staticMapRequest(spec, opts).url;

/**
 * signStaticMapUrl(keyedUrl, secret) — Google's URL signing (developers.google.com/maps/documentation/maps-static/
 * digital-signature): HMAC-SHA1 of `pathname + '?' + query` with the url-safe-base64 secret, url-safe-base64 result,
 * appended as the LAST parameter. The URL must already carry `key=`.
 */
export function signStaticMapUrl(url, secret) {
  const u = new URL(url);
  if (!u.search || !u.searchParams.has('key')) throw new MapsInputError('maps: sign the URL after adding key=');
  if (typeof secret !== 'string' || !secret.trim()) throw new MapsInputError('maps: signing secret missing');
  const key = Buffer.from(secret.trim().replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const sig = createHmac('sha1', key).update(u.pathname + u.search).digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
  return url + '&signature=' + sig;
}

/** Remove the key and any signature from text that might echo the request (never shown otherwise). */
function redact(text, secrets) {
  let s = String(text || '');
  for (const v of secrets) if (v) s = s.split(v).join('[redacted]');
  return s.replace(/([?&](?:key|signature)=)[^&\s"']*/gi, '$1[redacted]');
}

/**
 * staticMap(ctx, spec) → { bytes, contentType, status, ms, sku, units, url (no key), width, height, scale, notes }
 * ctx = { transport, ledger, staticKey, staticSigningSecret?, timeoutMs? }. Refuses (code NO_KEY, nothing counted)
 * without a key; the ledger's hard stop runs before the send; non-image answers become MapsRequestError.
 */
export async function staticMap(ctx, spec) {
  const req = staticMapRequest(spec);
  if (!ctx.staticKey) throw new MapsError('NO_KEY', 'maps: static maps need MAPS_STATIC_KEY (the egress proxy injects no key for maps.googleapis.com); nothing was sent');
  const secrets = [ctx.staticKey, ctx.staticSigningSecret];
  ctx.ledger.reserve(STATIC_MAPS_SKU, 1); // MapsBudgetError → nothing sent
  let url = req.url + '&key=' + encodeURIComponent(ctx.staticKey);
  if (ctx.staticSigningSecret) url = signStaticMapUrl(url, ctx.staticSigningSecret);
  let res;
  try { res = await ctx.transport({ method: 'GET', url, headers: { Accept: 'image/png,image/*' }, timeoutMs: ctx.timeoutMs || 20000 }); }
  catch (e) { ctx.ledger.markFailed(STATIC_MAPS_SKU); e.message = redact(e.message, secrets); throw e; }
  const type = String(res.headers?.['content-type'] || '').toLowerCase();
  if (res.status < 200 || res.status >= 300) {
    ctx.ledger.markFailed(STATIC_MAPS_SKU);
    const code = res.status === 401 || res.status === 403 ? 'AUTH' : res.status === 429 ? 'QUOTA' : res.status >= 500 ? 'UPSTREAM' : 'HTTP_' + res.status;
    const msg = type.startsWith('image/') ? '' : redact(res.text, secrets).replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new MapsRequestError(code, `maps: ${STATIC_MAPS_SKU} answered HTTP ${res.status}${msg ? ': ' + msg : ''}`, { status: res.status, sku: STATIC_MAPS_SKU });
  }
  const bytes = res.bytes ? Buffer.from(res.bytes) : Buffer.from(res.text || '', 'binary');
  if (!type.startsWith('image/') || bytes.length < 16) throw new MapsRequestError('BAD_IMAGE', `maps: ${STATIC_MAPS_SKU} did not return an image (${type || 'no content type'})`, { status: res.status, sku: STATIC_MAPS_SKU });
  return { bytes, contentType: type.split(';')[0], status: res.status, ms: res.ms ?? null, sku: STATIC_MAPS_SKU, units: 1, url: req.url, width: req.pixelWidth, height: req.pixelHeight, scale: req.scale, notes: req.notes };
}

// Developed by: LightAISolutions

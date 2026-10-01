/**
 * Maps kit — Routes API: Compute Routes and Compute Route Matrix. The kit decides the SKU from the request features it
 * allows (SKU details page, 2026-09-30): Compute Routes is **Pro** when it uses 11–25 intermediates, optimizeWaypointOrder
 * or a TRAFFIC_AWARE / TRAFFIC_AWARE_OPTIMAL routing preference, otherwise **Essentials**; Route Matrix is Pro per element
 * with a traffic-aware preference, otherwise Essentials. Enterprise features (two-wheeler, tolls, traffic on polylines)
 * and location modifiers (heading, side of road, vehicle stopover) are not exposed, so no call can bill Enterprise or
 * become Pro by accident.
 * Plan facts 4–6: ≤ 25 intermediates; TRANSIT takes no intermediates but takes departureTime / arrivalTime and
 * transitPreferences; optimizeWaypointOrder is incompatible with TRAFFIC_AWARE_OPTIMAL; a matrix holds ≤ 625 elements,
 * ≤ 100 for TRANSIT or TRAFFIC_AWARE_OPTIMAL, and ≤ 50 origins + destinations when any is a place id or address.
 */
import { ROUTE_MASKS, ROUTE_MATRIX_MASK } from './maps-masks.mjs';
import { MapsInputError, MapsBudgetError } from './maps-errors.mjs';
import { guardedCall, ROUTES_BASE } from './maps-http.mjs';
import { isLatLng } from './maps-places.mjs';

export const TRAVEL_MODES = Object.freeze(['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT']);
export const ROUTING_PREFERENCES = Object.freeze(['TRAFFIC_UNAWARE', 'TRAFFIC_AWARE', 'TRAFFIC_AWARE_OPTIMAL']);
export const TRANSIT_MODES = Object.freeze(['BUS', 'SUBWAY', 'TRAIN', 'LIGHT_RAIL', 'RAIL']);
export const MAX_INTERMEDIATES = 25;
export const ESSENTIALS_MAX_INTERMEDIATES = 10;
export const MATRIX_MAX_ELEMENTS = 625;
export const MATRIX_MAX_ELEMENTS_TRANSIT = 100;
export const MATRIX_MAX_WAYPOINTS_BY_ID = 50;

/** { placeId } | { lat, lng } | { address } → Routes API Waypoint. */
export function toWaypoint(w, label = 'waypoint') {
  if (w && typeof w.placeId === 'string' && /^[A-Za-z0-9_-]{6,300}$/.test(w.placeId)) return { placeId: w.placeId };
  if (w && isLatLng(w.lat, w.lng)) return { location: { latLng: { latitude: w.lat, longitude: w.lng } } };
  if (w && typeof w.address === 'string' && w.address.trim() && w.address.length <= 300) return { address: w.address.trim() };
  throw new MapsInputError(`maps: ${label} must be { placeId } or { lat, lng } or { address }`);
}
const isById = (w) => !!(w && (w.placeId || w.address));
const sec = (d) => (typeof d === 'string' && /^\d+(\.\d+)?s$/.test(d) ? Math.round(parseFloat(d)) : null);
function checkTime(name, v) {
  if (v == null) return null;
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) throw new MapsInputError(`maps: ${name} must be an ISO date-time`);
  return t.toISOString();
}
function commonMode(opts) {
  const travelMode = opts.travelMode || 'WALK';
  if (!TRAVEL_MODES.includes(travelMode)) throw new MapsInputError(`maps: travelMode must be one of ${TRAVEL_MODES.join(', ')}`);
  const routingPreference = opts.routingPreference || null;
  if (routingPreference && !ROUTING_PREFERENCES.includes(routingPreference)) throw new MapsInputError('maps: unknown routingPreference');
  if (routingPreference && travelMode !== 'DRIVE') throw new MapsInputError('maps: routingPreference is only allowed with DRIVE');
  const departureTime = checkTime('departureTime', opts.departureTime);
  const arrivalTime = checkTime('arrivalTime', opts.arrivalTime);
  if (departureTime && arrivalTime) throw new MapsInputError('maps: give departureTime or arrivalTime, not both');
  if (arrivalTime && travelMode !== 'TRANSIT') throw new MapsInputError('maps: arrivalTime is only allowed with TRANSIT');
  let transitPreferences = null;
  if (opts.transitPreferences) {
    if (travelMode !== 'TRANSIT') throw new MapsInputError('maps: transitPreferences need TRANSIT');
    const { allowedTravelModes, routingPreference: trp } = opts.transitPreferences;
    transitPreferences = {};
    if (allowedTravelModes) {
      if (!Array.isArray(allowedTravelModes) || !allowedTravelModes.every((m) => TRANSIT_MODES.includes(m))) throw new MapsInputError('maps: allowedTravelModes must be from ' + TRANSIT_MODES.join(', '));
      transitPreferences.allowedTravelModes = allowedTravelModes;
    }
    if (trp) { if (!['LESS_WALKING', 'FEWER_TRANSFERS'].includes(trp)) throw new MapsInputError('maps: transit routingPreference must be LESS_WALKING or FEWER_TRANSFERS'); transitPreferences.routingPreference = trp; }
  }
  return { travelMode, routingPreference, departureTime, arrivalTime, transitPreferences };
}

/** The SKU a Compute Routes request with these features bills (exported for tests and dry runs). */
export function computeRoutesSku({ intermediates = 0, optimizeWaypointOrder = false, routingPreference = null }) {
  const pro = optimizeWaypointOrder || intermediates > ESSENTIALS_MAX_INTERMEDIATES || routingPreference === 'TRAFFIC_AWARE' || routingPreference === 'TRAFFIC_AWARE_OPTIMAL';
  return pro ? 'routes.compute_routes.pro' : 'routes.compute_routes.essentials';
}
export function routeMatrixSku({ routingPreference = null }) {
  return routingPreference === 'TRAFFIC_AWARE' || routingPreference === 'TRAFFIC_AWARE_OPTIMAL' ? 'routes.route_matrix.pro' : 'routes.route_matrix.essentials';
}

/**
 * computeRoutes(ctx, { origin, destination, intermediates?, travelMode = 'WALK', optimizeWaypointOrder?, routingPreference?,
 *   departureTime?, arrivalTime?, transitPreferences?, units?, languageCode? }) → { route, sku, ms }
 * route = { durationSec, staticDurationSec, distanceMeters, polyline, optimizedOrder, warnings, legs: [{ durationSec,
 *   distanceMeters, start, end, steps? }] } or null when Google found no route.
 */
export async function computeRoutes(ctx, opts = {}) {
  const m = commonMode(opts);
  const inter = opts.intermediates || [];
  if (!Array.isArray(inter) || inter.length > MAX_INTERMEDIATES) throw new MapsInputError(`maps: at most ${MAX_INTERMEDIATES} intermediates`);
  if (m.travelMode === 'TRANSIT' && inter.length) throw new MapsInputError('maps: TRANSIT routes take no intermediate waypoints; fetch legs pair by pair');
  const optimize = !!opts.optimizeWaypointOrder;
  if (optimize && m.routingPreference === 'TRAFFIC_AWARE_OPTIMAL') throw new MapsInputError('maps: optimizeWaypointOrder is incompatible with TRAFFIC_AWARE_OPTIMAL');
  if (optimize && inter.length < 2) throw new MapsInputError('maps: optimizeWaypointOrder needs at least 2 intermediates (it would bill Pro for nothing)');
  const body = { origin: toWaypoint(opts.origin, 'origin'), destination: toWaypoint(opts.destination, 'destination'), travelMode: m.travelMode };
  if (inter.length) body.intermediates = inter.map((w, i) => toWaypoint(w, `intermediates[${i}]`));
  if (optimize) body.optimizeWaypointOrder = true;
  if (m.routingPreference) body.routingPreference = m.routingPreference;
  if (m.departureTime) body.departureTime = m.departureTime;
  if (m.arrivalTime) body.arrivalTime = m.arrivalTime;
  if (m.transitPreferences) body.transitPreferences = m.transitPreferences;
  if (opts.units) { if (!['METRIC', 'IMPERIAL'].includes(opts.units)) throw new MapsInputError('maps: units must be METRIC or IMPERIAL'); body.units = opts.units; }
  if (opts.languageCode) body.languageCode = String(opts.languageCode);
  const sku = computeRoutesSku({ intermediates: inter.length, optimizeWaypointOrder: optimize, routingPreference: m.routingPreference });
  const mask = m.travelMode === 'TRANSIT' ? ROUTE_MASKS.transit : ROUTE_MASKS.basic;
  const r = await guardedCall(ctx, { sku, method: 'POST', url: `${ROUTES_BASE}/directions/v2:computeRoutes`, mask, body });
  return { route: normalizeRoute(r.data.routes?.[0]), sku, ms: r.ms };
}

export function normalizeRoute(rt) {
  if (!rt) return null;
  const pt = (l) => (l?.latLng ? { lat: l.latLng.latitude, lng: l.latLng.longitude } : null);
  return {
    durationSec: sec(rt.duration),
    staticDurationSec: sec(rt.staticDuration),
    distanceMeters: rt.distanceMeters ?? null,
    polyline: rt.polyline?.encodedPolyline || null,
    optimizedOrder: rt.optimizedIntermediateWaypointIndex || null,
    warnings: rt.warnings || [],
    legs: (rt.legs || []).map((l) => ({
      durationSec: sec(l.duration), distanceMeters: l.distanceMeters ?? null, start: pt(l.startLocation), end: pt(l.endLocation),
      ...(l.steps ? { steps: l.steps.map((s) => ({ travelMode: s.travelMode || null, durationSec: sec(s.staticDuration), transit: s.transitDetails || null })) } : {})
    }))
  };
}

/**
 * Split an O × D matrix into requests that respect the element cap and the 50-waypoint cap for place ids / addresses.
 * planMatrixChunks(O, D, { elementCap, waypointCap }) → [{ o0, o1, d0, d1 }] (half-open ranges).
 */
export function planMatrixChunks(O, D, { elementCap, waypointCap = Infinity }) {
  const dSize = Math.max(1, Math.min(D, elementCap, waypointCap - 1));
  const oSize = Math.max(1, Math.min(O, Math.floor(elementCap / dSize), waypointCap - dSize));
  const out = [];
  for (let o0 = 0; o0 < O; o0 += oSize) for (let d0 = 0; d0 < D; d0 += dSize) out.push({ o0, o1: Math.min(O, o0 + oSize), d0, d1: Math.min(D, d0 + dSize) });
  return out;
}

/**
 * computeRouteMatrix(ctx, { origins, destinations, travelMode = 'WALK', routingPreference?, departureTime?, arrivalTime?,
 *   transitPreferences?, chunk = true }) → { elements, requests, units, sku }
 * elements: [{ originIndex, destinationIndex, durationSec, distanceMeters, condition, ok }] with GLOBAL indexes.
 * Over the per-request cap the matrix is split (chunk = true) or refused (chunk = false). The whole matrix is checked
 * against the remaining ceiling BEFORE the first request, so a matrix is never half-fetched for budget reasons.
 */
export async function computeRouteMatrix(ctx, opts = {}) {
  const m = commonMode(opts);
  const O = opts.origins || [], D = opts.destinations || [];
  if (!Array.isArray(O) || !Array.isArray(D) || !O.length || !D.length) throw new MapsInputError('maps: origins and destinations must be non-empty arrays');
  const oW = O.map((w, i) => toWaypoint(w, `origins[${i}]`)), dW = D.map((w, i) => toWaypoint(w, `destinations[${i}]`));
  const elementCap = m.travelMode === 'TRANSIT' || m.routingPreference === 'TRAFFIC_AWARE_OPTIMAL' ? MATRIX_MAX_ELEMENTS_TRANSIT : MATRIX_MAX_ELEMENTS;
  const waypointCap = O.some(isById) || D.some(isById) ? MATRIX_MAX_WAYPOINTS_BY_ID : Infinity;
  const total = O.length * D.length;
  const fits = total <= elementCap && O.length + D.length <= waypointCap;
  if (!fits && opts.chunk === false) throw new MapsInputError(`maps: ${O.length}×${D.length} matrix exceeds one request (≤ ${elementCap} elements${Number.isFinite(waypointCap) ? `, ≤ ${waypointCap} place-id/address waypoints` : ''})`, { elementCap, total });
  const sku = routeMatrixSku(m);
  const left = ctx.ledger.remaining(sku);
  if (total > left) throw new MapsBudgetError(sku, ctx.ledger.usage().month, ctx.ledger.ceilings[sku] - left, total, ctx.ledger.ceilings[sku]);
  const chunks = fits ? [{ o0: 0, o1: O.length, d0: 0, d1: D.length }] : planMatrixChunks(O.length, D.length, { elementCap, waypointCap });
  const elements = [];
  for (const c of chunks) {
    const body = { origins: oW.slice(c.o0, c.o1).map((waypoint) => ({ waypoint })), destinations: dW.slice(c.d0, c.d1).map((waypoint) => ({ waypoint })), travelMode: m.travelMode };
    if (m.routingPreference) body.routingPreference = m.routingPreference;
    if (m.departureTime) body.departureTime = m.departureTime;
    if (m.arrivalTime) body.arrivalTime = m.arrivalTime;
    if (m.transitPreferences) body.transitPreferences = m.transitPreferences;
    const units = (c.o1 - c.o0) * (c.d1 - c.d0);
    const r = await guardedCall(ctx, { sku, units, method: 'POST', url: `${ROUTES_BASE}/distanceMatrix/v2:computeRouteMatrix`, mask: ROUTE_MATRIX_MASK, body });
    for (const e of Array.isArray(r.data) ? r.data : []) {
      elements.push({
        originIndex: c.o0 + (e.originIndex || 0), destinationIndex: c.d0 + (e.destinationIndex || 0),
        durationSec: sec(e.duration), distanceMeters: e.distanceMeters ?? null, condition: e.condition || null,
        ok: (!e.status || !e.status.code) && e.condition === 'ROUTE_EXISTS'
      });
    }
  }
  elements.sort((a, b) => a.originIndex - b.originIndex || a.destinationIndex - b.destinationIndex);
  return { elements, requests: chunks.length, units: total, sku };
}

// Developed by: LightAISolutions

/**
 * Tour Guide planner — everything that touches the Maps kit: one Route Matrix per day (the solver's travel table),
 * one Compute Routes per consecutive pair of the solved order (real legs, with the transit line), the optional
 * optimizeWaypointOrder cross-check (DRIVE / WALK, ≥ 2 intermediates, one Pro request) and the Maps links.
 * Points are { placeId? , lat?, lng?, name } — place ids for places, coordinates for a lodging without one.
 */
import { directionsUrl, dayUrl, URL_MAX_WAYPOINTS } from '../../../kits/maps/index.mjs';
import { haversineKm, isLoc } from './planner-geo.mjs';

export const pointKey = (p) => (p.placeId ? 'id:' + p.placeId : `ll:${p.lat},${p.lng}`);
export const waypoint = (p) => (p.placeId ? { placeId: p.placeId } : { lat: p.lat, lng: p.lng });
const minutes = (sec) => Math.max(1, Math.ceil(sec / 60));

/**
 * Transit fallback (WP-3e). Google Routes returns no TRANSIT route in some countries (Japan, for one). When a TRANSIT
 * matrix element or a TRANSIT Compute Routes call yields no route, the planner does not switch to driving: it
 * estimates the leg from the straight-line distance × ROUTE_FACTOR at `kmh`, plus `overhead_min` (walk to the
 * station, waits). Estimated legs carry `estimated: true` and the day a `transit_estimated` warning.
 */
export const TRANSIT_FALLBACK_DEFAULT = Object.freeze({ kmh: 20, overhead_min: 12 });
export const ROUTE_FACTOR = 1.3;
export function transitFallback(trip) {
  const t = (trip && trip.transit_fallback) || {};
  return {
    kmh: Number.isFinite(t.kmh) && t.kmh > 0 ? t.kmh : TRANSIT_FALLBACK_DEFAULT.kmh,
    overhead_min: Number.isFinite(t.overhead_min) && t.overhead_min >= 0 ? t.overhead_min : TRANSIT_FALLBACK_DEFAULT.overhead_min
  };
}
/** estimateTransit(a, b, fallback) → { minutes, distance_m, line: null, estimated: true } or null without coordinates. */
export function estimateTransit(a, b, fallback) {
  if (!fallback || !isLoc(a) || !isLoc(b)) return null;
  const km = haversineKm(a, b) * ROUTE_FACTOR;
  return { minutes: Math.max(1, Math.ceil((km / fallback.kmh) * 60 + fallback.overhead_min)), distance_m: Math.round(km * 1000), line: null, estimated: true };
}

/**
 * fetchMatrix(maps, { points, mode, departureTime, transitPreferences, fallback }) → { travel: Map('from|to' → { minutes, distance_m, estimated? }), elements }
 * Identical points are sent once; the diagonal is 0 without asking. With `fallback` (TRANSIT only) a pair Google
 * answered with no route — element missing or not ROUTE_EXISTS — gets the distance estimate instead of Infinity.
 */
export async function fetchMatrix(maps, { points, mode, departureTime = null, transitPreferences = null, fallback = null }) {
  const uniq = [];
  const index = new Map();
  for (const p of points) { const k = pointKey(p); if (!index.has(k)) { index.set(k, uniq.length); uniq.push(p); } }
  const travel = new Map();
  for (const k of index.keys()) travel.set(k + '|' + k, { minutes: 0, distance_m: 0 });
  if (uniq.length < 2) return { travel, elements: 0, requests: 0 };
  const opts = { origins: uniq.map(waypoint), destinations: uniq.map(waypoint), travelMode: mode };
  if (departureTime) opts.departureTime = departureTime;
  if (mode === 'TRANSIT' && transitPreferences) opts.transitPreferences = transitPreferences;
  const r = await maps.computeRouteMatrix(opts);
  for (const e of r.elements) {
    const a = pointKey(uniq[e.originIndex]), b = pointKey(uniq[e.destinationIndex]);
    if (a === b) continue;
    travel.set(a + '|' + b, e.ok && e.durationSec != null ? { minutes: minutes(e.durationSec), distance_m: e.distanceMeters ?? null } : { minutes: Infinity, distance_m: null });
  }
  if (mode === 'TRANSIT' && fallback) {
    for (const p of uniq) for (const q of uniq) {
      const k = pointKey(p) + '|' + pointKey(q), cur = travel.get(k);
      if (cur && cur.minutes < Infinity) continue;
      const est = estimateTransit(p, q, fallback);
      if (est) travel.set(k, { minutes: est.minutes, distance_m: est.distance_m, estimated: true });
    }
  }
  return { travel, elements: r.units, requests: r.requests };
}

/**
 * One real leg: computeRoutes(from, to) at `departureTime` → { minutes, distance_m, line } (minutes Infinity when
 * Google found no route). With `fallback` (TRANSIT only) a missing route becomes the distance estimate ({ estimated: true }).
 */
export async function fetchLeg(maps, { from, to, mode, departureTime = null, transitPreferences = null, fallback = null }) {
  const opts = { origin: waypoint(from), destination: waypoint(to), travelMode: mode };
  if (departureTime) opts.departureTime = departureTime;
  if (mode === 'TRANSIT' && transitPreferences) opts.transitPreferences = transitPreferences;
  const { route } = await maps.computeRoutes(opts);
  if (!route || route.durationSec == null) return (mode === 'TRANSIT' && estimateTransit(from, to, fallback)) || { minutes: Infinity, distance_m: null, line: null };
  return { minutes: minutes(route.durationSec), distance_m: route.distanceMeters ?? null, line: transitLine(route) };
}
export function transitLine(route) {
  const names = [];
  for (const leg of route.legs || []) for (const s of leg.steps || []) {
    const tl = s.transit && s.transit.transitLine;
    const name = tl && (tl.nameShort || tl.name);
    if (name && !names.includes(name)) names.push(name);
  }
  return names.length ? names.join(' → ') : null;
}

/**
 * crossCheck(maps, { start, end, stops, mode }) → { asked, agrees, google_order, our_order, note? }
 * One Compute Routes (Pro) with optimizeWaypointOrder, DRIVE / WALK only, ≥ 2 intermediates. Google ignores opening
 * hours and bookings, so a disagreement is information, never an override.
 */
export async function crossCheck(maps, { start, end, stops, mode }) {
  const our_order = stops.map((s) => s.id);
  if (mode === 'TRANSIT' || stops.length < 2) return { asked: false, agrees: null, google_order: null, our_order, note: mode === 'TRANSIT' ? 'transit routes take no intermediates' : 'fewer than two intermediates' };
  const { route } = await maps.computeRoutes({ origin: waypoint(start), destination: waypoint(end), intermediates: stops.map((s) => waypoint(s.point)), travelMode: mode, optimizeWaypointOrder: true });
  const order = route && Array.isArray(route.optimizedOrder) && route.optimizedOrder.length === stops.length ? route.optimizedOrder.map((i) => stops[i].id) : null;
  return { asked: true, agrees: order ? order.every((id, i) => id === our_order[i]) : null, google_order: order, our_order };
}

const urlPoint = (p) => ({ ...(p.placeId ? { placeId: p.placeId } : {}), name: p.name, lat: p.lat, lng: p.lng });
export function legUrl(from, to, mode) { return directionsUrl({ origin: urlPoint(from), destination: urlPoint(to), travelMode: mode }); }
/** Whole-day link (null for TRANSIT, or when more than 9 intermediates would be silently ignored by Maps). */
export function dayLink(points, mode) {
  if (mode === 'TRANSIT' || points.length < 2 || points.length - 2 > URL_MAX_WAYPOINTS) return null;
  return dayUrl(points.map(urlPoint), mode);
}

// Developed by: LightAISolutions

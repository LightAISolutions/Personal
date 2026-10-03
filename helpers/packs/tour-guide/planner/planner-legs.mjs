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
 * Honest legs (Phase 10, WP-10b). The extra Compute Routes (Essentials) requests a planned day may spend on its walked
 * legs, through the same Maps-kit client, ledger and budget guard as every other call:
 *   · at most one WALK request per leg the rail estimator decided to walk (Google's own walking minutes and distance);
 *   · at most one DRIVE request per walked leg that is uphill, on a trail, or on a footpath with no hill-type end (the
 *     taxi time, and the hill test by route length);
 *   · at most LEG_EXTRA.MAX_PER_DAY extra requests per day; past it a walked leg keeps its estimate and gets no taxi time.
 * HILL_RATIO: a footpath walk whose driving route is at least this many times longer is hilly (no elevation service).
 */
export const LEG_EXTRA = Object.freeze({ MAX_PER_DAY: 12, PER_WALKED_LEG: 2, HILL_RATIO: 1.8 });
/** Route warnings that put a walk on a footpath (restricted-use or pedestrian-only ways, stairs, steps, trails). */
export const FOOTPATH_RE = /restricted|pedestrian(?:-only| only| path| way| walkway| street|s only)|footpath|foot path|walkway|stairs|steps|private road/i;
/** Google's WALK beta notice says a route may be MISSING pedestrian paths: that sentence is not a footpath. */
export const WALK_NOTICE_RE = /\bbeta\b|\bmissing\b|\bmay be missing\b|use caution/i;
export const TRAIL_RE = /\btrail\b|\bhiking\b|\bhike\b/i;
const HILL_CATEGORIES = ['viewpoint', 'hike', 'trail'];
const NOT_HILL_BY_NAME = ['restaurant', 'cafe', 'bar', 'shop', 'mall', 'market'];
export const HILL_NAME_RE = /\bhill\b|\bhills\b|\bmount\b|\bmt\.? |-yama\b|-san\b|\bpeak\b|\blookout\b|\bsummit\b/i;
/** isHillPoint(point) → true for a place (never a lodging) that is a viewpoint or summit, or whose name says hill, mount, -yama, -san, peak, lookout. */
export function isHillPoint(p) {
  if (!p || !p.id || !p.category) return false;
  if (HILL_CATEGORIES.includes(p.category)) return true;
  return !NOT_HILL_BY_NAME.includes(p.category) && HILL_NAME_RE.test(String(p.name || ''));
}
/** routeFlags({ from, to, warnings }) → the walk's character from what is known without elevation (sorted, unique). */
export function routeFlags({ from, to, warnings = [] }) {
  const f = new Set();
  const lines = warnings.map(String);
  if (lines.some((w) => FOOTPATH_RE.test(w) && !WALK_NOTICE_RE.test(w))) f.add('footpath');
  if ([from, to].some((p) => p && (p.category === 'hike' || p.category === 'trail')) || lines.some((w) => TRAIL_RE.test(w) && !WALK_NOTICE_RE.test(w))) f.add('trail');
  const up = isHillPoint(to), down = isHillPoint(from);
  if (up && !down) f.add('uphill');
  if (down && !up) f.add('downhill');
  return FLAG_ORDER.filter((x) => f.has(x));
}
export const FLAG_ORDER = Object.freeze(['footpath', 'trail', 'uphill', 'downhill']);
/** A per-day allowance of extra requests: { take() → boolean, used }. */
export function legAllowance(max = LEG_EXTRA.MAX_PER_DAY) {
  return { used: 0, max, take() { if (this.used >= this.max) return false; this.used += 1; return true; } };
}
/** One optional request: the route, or null when Google has none, refuses, fails or the ledger ceiling is reached. */
async function tryRoute(maps, opts) {
  try { const { route } = await maps.computeRoutes(opts); return route && route.durationSec != null ? route : null; } catch { return null; }
}
const transfersOf = (route) => Math.max(0, (route.legs || []).reduce((n, l) => n + (l.steps || []).filter((s) => s.travelMode === 'TRANSIT').length, 0) - 1);
const allWalk = (route) => { const steps = (route.legs || []).flatMap((l) => l.steps || []); return steps.length > 0 && steps.every((s) => s.travelMode === 'WALK'); };

/**
 * One real leg: computeRoutes(from, to) at `departureTime` →
 *   { minutes, distance_m, line, mode, transfers, requests, estimated?, warning?, flags?, taxi_minutes? }
 * minutes is Infinity when Google found no route. `mode` is how the leg is travelled: a TRANSIT leg the rail estimator
 * walks (or Google answers with walking only) is 'WALK'. `requests` counts every Compute Routes call made here.
 *   · a rail-estimated walk asks Google once for a WALK route and uses its minutes and distance; if that fails (or the
 *     day's allowance is spent) the leg keeps the estimate: estimated: true and the estimator's warning;
 *   · a rail-estimated train leg, or the distance fallback (`fallback`, TRANSIT only), is estimated: true;
 *   · a walked leg gets `flags` (routeFlags) and, when uphill or on a trail, `taxi_minutes` from one DRIVE request; a
 *     footpath walk with no hill-type end asks for the DRIVE route too and is hilly (uphill and downhill) when the
 *     drive is at least LEG_EXTRA.HILL_RATIO times longer.
 * from/to: { placeId?, lat?, lng?, name, id?, category? } — `id` and `category` only on places (never the lodging).
 */
export async function fetchLeg(maps, { from, to, mode, departureTime = null, transitPreferences = null, fallback = null, allowance = null }) {
  const extra = allowance || legAllowance(0);
  const opts = { origin: waypoint(from), destination: waypoint(to), travelMode: mode };
  if (departureTime) opts.departureTime = departureTime;
  if (mode === 'TRANSIT' && transitPreferences) opts.transitPreferences = transitPreferences;
  const { route } = await maps.computeRoutes(opts);
  let requests = 1;
  if (!route || route.durationSec == null) {
    const est = mode === 'TRANSIT' && estimateTransit(from, to, fallback);
    return est ? { ...est, mode, transfers: 0, requests } : { minutes: Infinity, distance_m: null, line: null, mode, transfers: 0, requests };
  }
  let leg = { minutes: minutes(route.durationSec), distance_m: route.distanceMeters ?? null, line: transitLine(route), mode, transfers: transitLine(route) ? transfersOf(route) : 0 };
  let warnings = route.warnings || [];
  if (route.estimated === 'walk') {
    leg = { ...leg, mode: 'WALK', line: null, transfers: 0 };
    const w = extra.take() ? (requests += 1, await tryRoute(maps, { origin: opts.origin, destination: opts.destination, travelMode: 'WALK' })) : null;
    if (w) { leg.minutes = minutes(w.durationSec); leg.distance_m = w.distanceMeters ?? leg.distance_m; warnings = w.warnings || []; }
    else { leg.estimated = true; leg.warning = warnings[0] || 'Estimated walk: Google returned no route'; warnings = []; }
  } else if (route.estimated) {
    leg.estimated = true; leg.warning = warnings[0] || 'Estimated transit leg';
    warnings = [];
  } else if (mode === 'TRANSIT' && allWalk(route)) {
    leg = { ...leg, mode: 'WALK', line: null, transfers: 0 };
  }
  if (leg.mode !== 'WALK') return { ...leg, requests };
  let flags = routeFlags({ from, to, warnings });
  const hillTest = flags.includes('footpath') && !flags.includes('uphill') && !flags.includes('downhill');
  if ((flags.includes('uphill') || flags.includes('trail') || hillTest) && extra.take()) {
    requests += 1;
    const d = await tryRoute(maps, { origin: opts.origin, destination: opts.destination, travelMode: 'DRIVE' });
    if (d && hillTest && leg.distance_m > 0 && d.distanceMeters >= LEG_EXTRA.HILL_RATIO * leg.distance_m) { const hilly = new Set([...flags, 'uphill', 'downhill']); flags = FLAG_ORDER.filter((x) => hilly.has(x)); }
    if (d && (flags.includes('uphill') || flags.includes('trail'))) leg.taxi_minutes = Math.min(1440, minutes(d.durationSec));
  }
  if (flags.length) leg.flags = flags;
  return { ...leg, requests };
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
/**
 * A leg's Maps link. C12: a leg from a shared location (`from.here`, the reserved point 'here') has no origin — Maps
 * starts from the viewer's current location — so the shared coordinates never appear in a link.
 */
export function legUrl(from, to, mode) { return directionsUrl({ ...(from.here ? {} : { origin: urlPoint(from) }), destination: urlPoint(to), travelMode: mode }); }
/** Whole-day link (null for TRANSIT, or when more than 9 intermediates would be silently ignored by Maps); from 'here' it has no origin. */
export function dayLink(points, mode) {
  if (mode === 'TRANSIT' || points.length < 2 || points.length - 2 > URL_MAX_WAYPOINTS) return null;
  if (points[0].here) return directionsUrl({ destination: urlPoint(points[points.length - 1]), waypoints: points.slice(1, -1).map(urlPoint), travelMode: mode });
  return dayUrl(points.map(urlPoint), mode);
}

// Developed by: LightAISolutions

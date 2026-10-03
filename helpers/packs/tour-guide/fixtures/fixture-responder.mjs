/**
 * Tour Guide fixtures — a responder for the Maps kit's createMockTransport(responder) that answers from one fixture in
 * the REAL API shapes (helpers/kits/maps/fixtures/*.json):
 *   GET  places/<id>                      Place Details rebuilt from the snapshot, filtered by the X-Goog-FieldMask
 *   POST distanceMatrix/v2:computeRouteMatrix   the element array, every element from fixtureTravel()
 *   POST directions/v2:computeRoutes            one route; legs = fixtureTravel() per consecutive pair (TRANSIT legs carry
 *                                               WALK + TRANSIT steps with transitLine.nameShort = the tabled line);
 *                                               optimizeWaypointOrder → nearest-neighbour order over fixtureTravel()
 * A fixture whose routes.no_route_modes names the mode gets Google's empty answer ({} — no route) from computeRoutes and
 * ROUTE_NOT_FOUND matrix elements. A route carries the tabled rows' `warnings` (deduplicated) as Route.warnings.
 * Waypoints resolve from { placeId }, { location: { latLng } } (nearest snapshot within 50 m) or { address } (exact
 * snapshot address). Anything unknown → HTTP 404 with Google's error body, which the kit raises as MapsRequestError
 * code HTTP_404. No network; durations never depend on the departure time.
 */
import { fixtureTravel, snapshotFor, noRoute } from './fixture-travel.mjs';
import { nearestSnapshot } from './fixture-geo.mjs';

export const SNAP_RADIUS_M = 50;

const notFound = (message) => ({ status: 404, body: { error: { code: 404, message: String(message).slice(0, 300), status: 'NOT_FOUND' } } });
const badRequest = (message) => ({ status: 400, body: { error: { code: 400, message, status: 'INVALID_ARGUMENT' } } });
class Unresolved extends Error {}

/** placeDetailsBody(snapshot) → a full Place Details (New) body (every field the enterprise mask can ask for that the snapshot holds). */
export function placeDetailsBody(snap) {
  const c = snap.content || {};
  const body = { id: snap.place_id };
  if (snap.location) body.location = { latitude: snap.location.lat, longitude: snap.location.lng };
  if (c.address) body.formattedAddress = c.address;
  if (c.display_name) body.displayName = { text: c.display_name, languageCode: 'en' };
  if (c.business_status) body.businessStatus = c.business_status;
  if (c.maps_uri) body.googleMapsUri = c.maps_uri;
  if (c.time_zone) body.timeZone = { id: c.time_zone };
  if (c.hours) body.regularOpeningHours = { periods: c.hours.periods.map((p) => JSON.parse(JSON.stringify(p))), weekdayDescriptions: [...c.hours.weekday_descriptions] };
  if (c.current_hours) body.currentOpeningHours = { openNow: c.current_hours.open_now, weekdayDescriptions: [...c.current_hours.weekday_descriptions] };
  if (c.rating != null) body.rating = c.rating;
  if (c.review_count != null) body.userRatingCount = c.review_count;
  if (c.website) body.websiteUri = c.website;
  return body;
}

/** Keep only the top-level fields a Places field mask names ('*' or no mask = everything). */
function applyMask(body, mask) {
  if (!mask || mask.trim() === '*') return body;
  const keep = new Set(mask.split(',').map((f) => f.trim().split('.')[0]).filter(Boolean));
  return Object.fromEntries(Object.entries(body).filter(([k]) => keep.has(k)));
}

function header(req, name) {
  const h = req.headers || {};
  const k = Object.keys(h).find((x) => x.toLowerCase() === name.toLowerCase());
  return k ? h[k] : null;
}

/** resolveWaypoint(fixture, waypoint) → snapshot, or throws Unresolved. */
function resolveWaypoint(fixture, w) {
  if (w && w.placeId) {
    try { return snapshotFor(fixture, w.placeId); } catch { throw new Unresolved(`Place ID ${w.placeId} was not found.`); }
  }
  const ll = w && w.location && w.location.latLng;
  if (ll && Number.isFinite(ll.latitude) && Number.isFinite(ll.longitude)) {
    const s = nearestSnapshot(fixture.snapshots, { lat: ll.latitude, lng: ll.longitude }, SNAP_RADIUS_M);
    if (s) return s;
    throw new Unresolved(`No fixture place within ${SNAP_RADIUS_M} m of that point.`);   // never echo a shared point's coordinates
  }
  if (w && typeof w.address === 'string') {
    const s = fixture.snapshots.find((x) => x.content && x.content.address && x.content.address.toLowerCase() === w.address.trim().toLowerCase());
    if (s) return s;
    throw new Unresolved('Address was not found.');
  }
  throw new Unresolved('Waypoint is not a place id, a location or an address.');
}

const latLng = (s) => ({ latLng: { latitude: s.location.lat, longitude: s.location.lng } });
const secs = (n) => `${n}s`;

/** Nearest-neighbour order of the intermediates from the origin over fixtureTravel durations (ties: lower index). */
export function nearestNeighbourOrder(fixture, mode, originId, intermediateIds) {
  const left = intermediateIds.map((id, i) => ({ id, i }));
  const order = [];
  let at = originId;
  while (left.length) {
    let best = 0, bestSec = Infinity;
    left.forEach((x, k) => {
      const d = fixtureTravel(fixture, mode, at, x.id).durationSec;
      if (d < bestSec) { bestSec = d; best = k; }
    });
    const [pick] = left.splice(best, 1);
    order.push(pick.i);
    at = pick.id;
  }
  return order;
}

function transitSteps(from, to, t, departureTime) {
  if (!t.line) return [{ travelMode: 'WALK', staticDuration: secs(t.durationSec) }];
  const walk1 = Math.min(300, Math.round(t.durationSec * 0.15));
  const walk2 = Math.min(240, Math.round(t.durationSec * 0.1));
  const ride = t.durationSec - walk1 - walk2;
  const details = {
    stopDetails: { departureStop: { name: `${from.content?.display_name || 'Origin'} stop` }, arrivalStop: { name: `${to.content?.display_name || 'Destination'} stop` } },
    headsign: to.content?.display_name || 'Destination',
    transitLine: { nameShort: t.line, vehicle: { type: /^tram/i.test(t.line) ? 'TRAM' : /^bus/i.test(t.line) ? 'BUS' : 'SUBWAY' } },
    stopCount: Math.max(1, Math.round(t.distanceMeters / 700))
  };
  if (departureTime) {
    const dep = Date.parse(departureTime) + walk1 * 1000;
    details.stopDetails.departureTime = new Date(dep).toISOString().replace('.000Z', 'Z');
    details.stopDetails.arrivalTime = new Date(dep + ride * 1000).toISOString().replace('.000Z', 'Z');
  }
  return [
    { travelMode: 'WALK', staticDuration: secs(walk1) },
    { travelMode: 'TRANSIT', staticDuration: secs(ride), transitDetails: details },
    { travelMode: 'WALK', staticDuration: secs(walk2) }
  ];
}

function computeRoutes(fixture, body) {
  const mode = body.travelMode || 'DRIVE';
  const origin = resolveWaypoint(fixture, body.origin);
  const destination = resolveWaypoint(fixture, body.destination);
  const inter = (body.intermediates || []).map((w) => resolveWaypoint(fixture, w));
  if (mode === 'TRANSIT' && inter.length) return badRequest('Intermediate waypoints are not supported for TRANSIT.');
  let order = inter.map((_, i) => i), optimized = null;
  if (body.optimizeWaypointOrder && inter.length) {
    order = nearestNeighbourOrder(fixture, mode, origin.place_id, inter.map((s) => s.place_id));
    optimized = order;
  }
  if (noRoute(fixture, mode)) return { status: 200, body: {} };
  const chain = [origin, ...order.map((i) => inter[i]), destination];
  const legs = [];
  const warnings = [];
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i], b = chain[i + 1];
    const t = fixtureTravel(fixture, mode, a.place_id, b.place_id);
    const leg = { distanceMeters: t.distanceMeters, duration: secs(t.durationSec), startLocation: latLng(a), endLocation: latLng(b) };
    if (mode === 'TRANSIT') leg.steps = transitSteps(a, b, t, body.departureTime);
    for (const x of t.warnings || []) if (!warnings.includes(x)) warnings.push(x);
    legs.push(leg);
  }
  const total = legs.reduce((s, l) => s + parseInt(l.duration, 10), 0);
  const route = {
    distanceMeters: legs.reduce((s, l) => s + l.distanceMeters, 0),
    duration: secs(total),
    polyline: { encodedPolyline: 'fixture' },
    legs
  };
  if (mode !== 'TRANSIT') route.staticDuration = secs(total);
  if (optimized) route.optimizedIntermediateWaypointIndex = optimized;
  if (warnings.length) route.warnings = warnings;
  return { status: 200, body: { routes: [route] } };
}

function computeRouteMatrix(fixture, body) {
  const mode = body.travelMode || 'DRIVE';
  const O = (body.origins || []).map((o) => resolveWaypoint(fixture, o.waypoint));
  const D = (body.destinations || []).map((d) => resolveWaypoint(fixture, d.waypoint));
  const out = [];
  const none = noRoute(fixture, mode);
  O.forEach((a, oi) => D.forEach((b, di) => {
    if (none && a.place_id !== b.place_id) { out.push({ originIndex: oi, destinationIndex: di, status: {}, condition: 'ROUTE_NOT_FOUND' }); return; }
    const t = fixtureTravel(fixture, mode, a.place_id, b.place_id);
    out.push({ originIndex: oi, destinationIndex: di, status: {}, condition: 'ROUTE_EXISTS', distanceMeters: t.distanceMeters, duration: secs(t.durationSec) });
  }));
  return { status: 200, body: out };
}

/** createFixtureResponder(fixture) → (req) => { status, body } for createMockTransport(). */
export function createFixtureResponder(fixture) {
  return function fixtureMapsResponder(req) {
    const u = new URL(req.url);
    try {
      if (u.hostname === 'places.googleapis.com' && u.pathname.startsWith('/v1/places/') && req.method === 'GET') {
        const id = decodeURIComponent(u.pathname.slice('/v1/places/'.length));
        let snap;
        try { snap = snapshotFor(fixture, id); } catch { return notFound(`Place ID ${id} was not found.`); }
        return { status: 200, body: applyMask(placeDetailsBody(snap), header(req, 'X-Goog-FieldMask')) };
      }
      const body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {};
      if (u.hostname === 'routes.googleapis.com' && u.pathname.endsWith('/v2:computeRoutes')) return computeRoutes(fixture, body);
      if (u.hostname === 'routes.googleapis.com' && u.pathname.endsWith('/v2:computeRouteMatrix')) return computeRouteMatrix(fixture, body);
    } catch (e) {
      if (e instanceof Unresolved) return notFound(e.message);
      throw e;
    }
    return notFound(`fixture ${fixture.name}: no recorded response for ${req.method} ${u.pathname}`);
  };
}

// Developed by: LightAISolutions

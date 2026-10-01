'use strict';
/**
 * Tour Guide planner tests — a tiny invented world (city "Minibury", reserved ids, no Google content) with a Maps
 * responder in the real API shapes, so the planner can be exercised without the pack fixtures (WP-3a builds those).
 * travel(mode, a, b) is the single source of truth the tests verify legs against.
 */
const L = { lat: 40.0, lng: -70.0 };
const PLACES = [
  { id: 'lantern-museum', place_id: 'FixtureMiniMuseum01', name: 'Lantern Museum', category: 'museum', priority: 1, lat: 40.012, lng: -70.004, typical: 120, hours: daily(10, 17) },
  { id: 'river-market', place_id: 'FixtureMiniMarket02', name: 'River Market', category: 'market', priority: 2, lat: 40.006, lng: -70.012, typical: 60, hours: except([2], 9, 15) },
  { id: 'hill-viewpoint', place_id: 'FixtureMiniView03', name: 'Hill Viewpoint', category: 'viewpoint', priority: 2, lat: 40.018, lng: -70.016, typical: 30, hours: null },
  { id: 'night-market', place_id: 'FixtureMiniNight04', name: 'Night Market', category: 'market', priority: 2, lat: 40.004, lng: -70.003, typical: 90, hours: daily(18, 23, 30) },
  { id: 'old-church', place_id: 'FixtureMiniChurch05', name: 'Old Church', category: 'church', priority: 1, lat: 40.002, lng: -70.006, typical: 45, hours: daily(9, 18), booking: { date: '2027-06-08', time: '14:00', ref: 'MINI-77' } },
  { id: 'far-lighthouse', place_id: 'FixtureMiniFar06', name: 'Far Lighthouse', category: 'viewpoint', priority: 3, lat: 41.8, lng: -70.0, typical: 30, hours: daily(8, 20) },
  { id: 'shut-gallery', place_id: 'FixtureMiniShut07', name: 'Shut Gallery', category: 'museum', priority: 2, lat: 40.009, lng: -70.009, typical: 60, hours: daily(10, 18), business_status: 'CLOSED_TEMPORARILY' },
  { id: 'green-park', place_id: 'FixtureMiniPark08', name: 'Green Park', category: 'park', priority: 3, lat: 40.015, lng: -70.001, typical: 60, hours: always() },
  { id: 'saturday-cafe', place_id: 'FixtureMiniCafe09', name: 'Saturday Cafe', category: 'cafe', priority: 3, lat: 40.007, lng: -70.007, typical: 30, hours: only([6], 8, 14) },
  { id: 'tile-workshop', place_id: 'FixtureMiniTiles10', name: 'Tile Workshop', category: 'shop', priority: 2, lat: 40.011, lng: -70.013, typical: 45, hours: daily(11, 17) }
];
function period(day, oh, ch, cm = 0) { return { open: { day, hour: oh, minute: 0 }, close: { day, hour: ch, minute: cm } }; }
function daily(oh, ch, cm = 0) { return [0, 1, 2, 3, 4, 5, 6].map((d) => period(d, oh, ch, cm)); }
function except(days, oh, ch) { return [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.includes(d)).map((d) => period(d, oh, ch)); }
function only(days, oh, ch) { return days.map((d) => period(d, oh, ch)); }
function always() { return [{ open: { day: 0, hour: 0, minute: 0 } }]; }
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function lines(periods) { return [1, 2, 3, 4, 5, 6, 0].map((d) => { const p = periods.find((x) => x.open.day === d); return `${WD[d]}: ${p ? (p.close ? `${p.open.hour}:00 – ${p.close.hour}:${String(p.close.minute).padStart(2, '0')}` : 'Open 24 hours') : 'Closed'}`; }); }

const km = (a, b) => { const r = (x) => (x * Math.PI) / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
const SPEED = { WALK: 4.5, TRANSIT: 14, DRIVE: 45 }, OVERHEAD = { WALK: 0, TRANSIT: 420, DRIVE: 180 };
/** Seconds and metres between two coordinates (deterministic, departure-time independent). */
function travel(mode, a, b) {
  const d = km(a, b) * 1.3;
  if (d < 0.001) return { durationSec: 0, distanceMeters: 0 };
  return { durationSec: Math.round((d / SPEED[mode]) * 3600) + OVERHEAD[mode], distanceMeters: Math.round(d * 1000) };
}
const byId = Object.fromEntries(PLACES.map((p) => [p.place_id, p]));
byId.FixtureMiniLodging01 = { ...L, name: 'Harbour Inn' };
function resolve(w) {
  if (w.placeId) { const p = byId[w.placeId]; if (!p) throw new Error('unknown place id ' + w.placeId); return { lat: p.lat, lng: p.lng }; }
  return { lat: w.location.latLng.latitude, lng: w.location.latLng.longitude };
}
function nearestNeighbour(mode, origin, inter, dest) {
  const left = inter.map((p, i) => ({ p, i })), order = [];
  let cur = origin;
  while (left.length) { left.sort((x, y) => travel(mode, cur, x.p).durationSec - travel(mode, cur, y.p).durationSec); const n = left.shift(); order.push(n.i); cur = n.p; }
  return order;
}
/** Responder for createMockTransport: Route Matrix and Compute Routes in the real API shapes. */
function responder(req) {
  const u = new URL(req.url), body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  try {
    if (u.pathname.endsWith('v2:computeRouteMatrix')) {
      const O = body.origins.map((o) => resolve(o.waypoint)), D = body.destinations.map((d) => resolve(d.waypoint)), out = [];
      O.forEach((o, oi) => D.forEach((d, di) => { const t = travel(body.travelMode, o, d); out.push({ originIndex: oi, destinationIndex: di, status: {}, condition: 'ROUTE_EXISTS', distanceMeters: t.distanceMeters, duration: `${t.durationSec}s` }); }));
      return { status: 200, body: out };
    }
    if (u.pathname.endsWith('v2:computeRoutes')) {
      const o = resolve(body.origin), d = resolve(body.destination), inter = (body.intermediates || []).map(resolve);
      const order = body.optimizeWaypointOrder ? nearestNeighbour(body.travelMode, o, inter, d) : inter.map((_, i) => i);
      const chain = [o, ...order.map((i) => inter[i]), d];
      const legs = [];
      for (let i = 0; i < chain.length - 1; i++) {
        const t = travel(body.travelMode, chain[i], chain[i + 1]);
        const leg = { duration: `${t.durationSec}s`, distanceMeters: t.distanceMeters, startLocation: { latLng: { latitude: chain[i].lat, longitude: chain[i].lng } }, endLocation: { latLng: { latitude: chain[i + 1].lat, longitude: chain[i + 1].lng } } };
        if (body.travelMode === 'TRANSIT') leg.steps = [{ travelMode: 'WALK', staticDuration: '120s' }, { travelMode: 'TRANSIT', staticDuration: `${Math.max(0, t.durationSec - 240)}s`, transitDetails: { transitLine: { nameShort: 'Line 1' } } }, { travelMode: 'WALK', staticDuration: '120s' }];
        legs.push(leg);
      }
      const total = legs.reduce((s, l) => s + parseInt(l.duration), 0), dist = legs.reduce((s, l) => s + l.distanceMeters, 0);
      const route = { duration: `${total}s`, distanceMeters: dist, polyline: { encodedPolyline: 'fixture' }, legs };
      if (body.optimizeWaypointOrder) route.optimizedIntermediateWaypointIndex = order;
      return { status: 200, body: { routes: [route] } };
    }
  } catch (e) { return { status: 404, body: { error: { code: 404, message: e.message, status: 'NOT_FOUND' } } }; }
  return { status: 404, body: { error: { code: 404, message: 'no route for ' + u.pathname, status: 'NOT_FOUND' } } };
}

function world({ mode = 'TRANSIT', pace = 'normal', day_end = '18:00' } = {}) {
  const trip = { v: 1, id: 'minibury-2027', title: 'Two days in Minibury', destination: 'Minibury', timezone: 'America/New_York', start_date: '2027-06-07', end_date: '2027-06-08', travelers: ['tester'], pace, day_start: '08:00', day_end,
    lodging: [{ id: 'harbour-inn', name: 'Harbour Inn', place_id: 'FixtureMiniLodging01', lat: L.lat, lng: L.lng, from: '2027-06-07', to: '2027-06-09' }],
    modes: { default: mode, allowed: ['TRANSIT', 'WALK', 'DRIVE'] }, status: 'intake' };
  const places = PLACES.map((p) => ({ v: 1, id: p.id, place_id: p.place_id, name: p.name, category: p.category, tags: [], status: 'candidate', activity: `${p.category} visit`, priority: p.priority, ...(p.booking ? { booking: p.booking } : {}) }));
  const snapshots = PLACES.map((p) => ({ build_id: 'b0', place_id: p.place_id, fetched_at: '2027-06-01T12:00:00.000Z', location: { lat: p.lat, lng: p.lng }, content: { display_name: p.name, address: `${p.name}, Minibury`, business_status: p.business_status || 'OPERATIONAL', hours: p.hours ? { weekday_descriptions: lines(p.hours), periods: p.hours } : null, current_hours: null, rating: null, review_count: null, website: null, maps_uri: null, time_zone: 'America/New_York' } }));
  const estimates = PLACES.map((p) => ({ v: 1, place_id: p.place_id, activity: `${p.category} visit`, category: p.category, range: { min: p.typical - 15, max: p.typical + 15 }, typical: p.typical, chosen_minutes: p.typical, sources: [{ url: 'https://guide.example.org/minibury/' + p.id, accessed: '2027-06-01' }], confidence: 'single-source', estimated_on: '2027-06-01' }));
  const profile = { pace, interests: { museum: 'high', park: 'low' } };
  const chooseMinutes = ({ typical, category }) => ({ minutes: typical || 60, confidence: 'single-source', factors: { pace: 1, interest: 1, calibration: 1, category } });
  return { trip, places, snapshots, estimates, profile, chooseMinutes, coords: Object.fromEntries(PLACES.map((p) => [p.id, { lat: p.lat, lng: p.lng }]).concat([['lodging', L]])) };
}
module.exports = { world, responder, travel, PLACES };

// Developed by: LightAISolutions

/**
 * Tour Guide planner — station-based train estimates where Google has no transit route (Japan: the Routes API returns
 * none there, while the Google Maps app does). withRailEstimates(maps, { points }) wraps a Maps-kit client: a TRANSIT
 * matrix element or route that Google could not find is filled with walk → nearest station → ride → station → walk,
 * from Google's own station places (Text Search Pro, one call per point, cached for this build). Everything else passes
 * through untouched. The ride time is an ESTIMATE (distance × detour at an average speed, plus a wait); the leg's
 * Google Maps link (travelmode=transit) shows the exact train. Points with no station within reach stay "no route".
 *   const maps2 = withRailEstimates(maps, { points: [{ placeId, lat, lng }, …] });  // waypoints by place id need a point here
 */
import { haversineKm } from './planner-geo.mjs';

export const RAIL = Object.freeze({
  STATION_RADIUS_M: 1300, // farthest station we walk to (~20 min); hillside hotels often sit 1–1.3 km from one
  STATIONS_PER_POINT: 3,
  WALK_M_PER_MIN: 80, // 4.8 km/h
  WALK_DETOUR: 1.25, // street distance ÷ straight line
  WALK_ONLY_KM: 1.2, // closer than this: walk, no train
  WAIT_MIN: 5, // ticket gate, platform, average wait
  RIDE_DETOUR: 1.3, // track distance ÷ straight line, city
  CITY_MIN_PER_KM: 2, // ~30 km/h with stops
  TRANSFER_KM: 6, // longer city rides usually change line once
  TRANSFER_MIN: 5,
  INTERCITY_KM: 40,
  INTERCITY_DETOUR: 1.15,
  REGIONAL_KMH: 75,
  SHINKANSEN_KM: 150,
  SHINKANSEN_KMH: 170,
  INTERCITY_EXTRA_MIN: 15
});
export const STATION_TYPES = Object.freeze(['train_station', 'subway_station', 'light_rail_station']);

const ll = (w) => (w && w.location && w.location.latLng ? { lat: w.location.latLng.latitude, lng: w.location.latLng.longitude } : w && Number.isFinite(w.lat) && Number.isFinite(w.lng) ? { lat: w.lat, lng: w.lng } : null);

/** Walking minutes for a straight-line distance. */
export const walkMinutes = (km) => Math.max(1, Math.ceil((km * 1000 * RAIL.WALK_DETOUR) / RAIL.WALK_M_PER_MIN));
/** Ride minutes (wait included) between two stations a straight-line `km` apart. */
export function rideMinutes(km) {
  if (km <= RAIL.INTERCITY_KM) return Math.ceil(RAIL.WAIT_MIN + km * RAIL.RIDE_DETOUR * RAIL.CITY_MIN_PER_KM + (km > RAIL.TRANSFER_KM ? RAIL.TRANSFER_MIN : 0));
  const kmh = km > RAIL.SHINKANSEN_KM ? RAIL.SHINKANSEN_KMH : RAIL.REGIONAL_KMH;
  return Math.ceil(RAIL.INTERCITY_EXTRA_MIN + ((km * RAIL.INTERCITY_DETOUR) / kmh) * 60);
}

/**
 * Best way from `from` to `to` given each end's nearby stations ([{ name, lat, lng }]) → null (no station at one end)
 * or { kind: 'walk' | 'train', minutes, distance_m, from_station?, to_station?, walk_to?, ride?, walk_from? }.
 */
export function railEstimate(from, to, fromStations, toStations) {
  const direct = haversineKm(from, to);
  const walk = { kind: 'walk', minutes: walkMinutes(direct), distance_m: Math.round(direct * 1000 * RAIL.WALK_DETOUR) };
  if (direct < RAIL.WALK_ONLY_KM) return walk;
  let best = null;
  for (const a of fromStations || []) for (const b of toStations || []) {
    const ab = haversineKm(a, b);
    if (ab < 0.3) continue; // the same station (or its other exit)
    const walk_to = walkMinutes(haversineKm(from, a)), ride = rideMinutes(ab), walk_from = walkMinutes(haversineKm(b, to));
    const minutes = walk_to + ride + walk_from;
    if (!best || minutes < best.minutes) best = { kind: 'train', minutes, from_station: a.name, to_station: b.name, walk_to, ride, walk_from,
      distance_m: Math.round((haversineKm(from, a) + haversineKm(b, to)) * 1000 * RAIL.WALK_DETOUR + ab * 1000 * (ab > RAIL.INTERCITY_KM ? RAIL.INTERCITY_DETOUR : RAIL.RIDE_DETOUR)) };
  }
  if (!best) return direct <= 2 * RAIL.WALK_ONLY_KM ? walk : null;
  return walk.minutes <= best.minutes ? walk : best;
}

/** The leg's line text: "Shibuya Station → Ueno Station (estimate)", ≤ 80 characters. */
export function railLine(e) {
  if (!e || e.kind !== 'train') return null;
  const cut = (s) => (s.length > 33 ? s.slice(0, 32) + '…' : s);
  return `${cut(e.from_station)} → ${cut(e.to_station)} (estimate)`;
}

export function withRailEstimates(maps, { points = [], radiusM = RAIL.STATION_RADIUS_M, languageCode = 'en' } = {}) {
  const byId = new Map();
  for (const p of points) if (p && p.placeId && Number.isFinite(p.lat) && Number.isFinite(p.lng)) byId.set(p.placeId, { lat: p.lat, lng: p.lng });
  const locate = (w) => ll(w) || (w && w.placeId ? byId.get(w.placeId) || null : null);
  const stations = new Map(); // 'lat,lng' → Promise<[{ name, lat, lng }]>
  const stats = { station_searches: 0, estimated: 0 };
  const nearby = (p) => {
    const k = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    if (!stations.has(k)) {
      stats.station_searches += 1;
      stations.set(k, maps.textSearch('train station', { tier: 'pro', pageSize: 10, languageCode, locationBias: { lat: p.lat, lng: p.lng, radiusMeters: radiusM } }).then(({ places }) => places
        .filter((s) => s.location && Array.isArray(s.types) && s.types.some((t) => STATION_TYPES.includes(t)))
        .map((s) => ({ name: (s.displayName && s.displayName.text) || 'Station', lat: s.location.latitude, lng: s.location.longitude }))
        .filter((s) => haversineKm(p, s) * 1000 <= radiusM)
        .sort((a, b) => haversineKm(p, a) - haversineKm(p, b))
        .slice(0, RAIL.STATIONS_PER_POINT)));
    }
    return stations.get(k);
  };
  async function estimate(o, d) {
    const a = locate(o), b = locate(d);
    if (!a || !b) return null;
    const [sa, sb] = haversineKm(a, b) < RAIL.WALK_ONLY_KM ? [[], []] : await Promise.all([nearby(a), nearby(b)]);
    const e = railEstimate(a, b, sa, sb);
    if (e) stats.estimated += 1;
    return e && { ...e, start: a, end: b };
  }
  return {
    ...maps,
    railStats: () => ({ ...stats }),
    async computeRouteMatrix(opts) {
      const r = await maps.computeRouteMatrix(opts);
      if (opts.travelMode !== 'TRANSIT') return r;
      const elements = [];
      for (const el of r.elements) {
        if (el.ok || el.originIndex === undefined) { elements.push(el); continue; }
        const e = await estimate(opts.origins[el.originIndex], opts.destinations[el.destinationIndex]);
        elements.push(e ? { ...el, ok: true, durationSec: e.minutes * 60, distanceMeters: e.distance_m, condition: 'ROUTE_ESTIMATED', estimated: e.kind } : el);
      }
      return { ...r, elements };
    },
    async computeRoutes(opts) {
      const r = await maps.computeRoutes(opts);
      if (opts.travelMode !== 'TRANSIT' || (r.route && r.route.durationSec != null) || (opts.intermediates && opts.intermediates.length)) return r;
      const e = await estimate(opts.origin, opts.destination);
      if (!e) return r;
      const step = (travelMode, min, transit = null) => ({ travelMode, durationSec: min * 60, transit });
      const steps = e.kind === 'walk' ? [step('WALK', e.minutes)] : [step('WALK', e.walk_to), step('TRANSIT', e.ride, { transitLine: { name: railLine(e) }, stopDetails: { departureStop: { name: e.from_station }, arrivalStop: { name: e.to_station } } }), step('WALK', e.walk_from)];
      const route = { durationSec: e.minutes * 60, staticDurationSec: e.minutes * 60, distanceMeters: e.distance_m, polyline: null, optimizedOrder: null,
        warnings: [e.kind === 'walk' ? 'Estimated walk: Google returned no route' : 'Estimated train leg: Google returned no transit route; check the exact train in Google Maps'],
        legs: [{ durationSec: e.minutes * 60, distanceMeters: e.distance_m, start: e.start, end: e.end, steps }], estimated: e.kind };
      return { ...r, route };
    }
  };
}

// Developed by: LightAISolutions

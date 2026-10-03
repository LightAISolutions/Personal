/**
 * Tour Guide fixtures — fixtureTravel(): THE travel time between two place ids in a fixture, the single source of
 * truth that the mock Maps responder answers from and that tests check planned legs against.
 *   1. routes.modes[mode]["<from>|<to>"] when tabled;
 *   2. else the reverse pair "<to>|<from>" (the tables are symmetric-ish, so an untabled direction reuses its twin);
 *   3. else derived from the snapshots' coordinates: distance = great-circle × 1.3, duration = distance / speed +
 *      overhead (routes.fallback; defaults WALK 4.5 km/h + 0 s, TRANSIT 14 km/h + 420 s, DRIVE 45 km/h + 180 s).
 * The same place to itself is 0 s / 0 m. Durations never depend on the departure time. A tabled row may carry
 * `warnings` (Google's Route.warnings strings, e.g. a WALK route on restricted-use paths): returned as given.
 * routes.no_route_modes (optional, e.g. ['TRANSIT']) makes the responder answer "no route" for that mode, as Google's
 * Routes API does for public transport in some countries; fixtureTravel still answers (the tests' reference).
 */
import { haversineMeters } from './fixture-geo.mjs';

export const DETOUR_FACTOR = 1.3;
export const DEFAULT_FALLBACK = Object.freeze({
  speed_kmh: Object.freeze({ WALK: 4.5, TRANSIT: 14, DRIVE: 45 }),
  overhead_sec: Object.freeze({ WALK: 0, TRANSIT: 420, DRIVE: 180 })
});
export const FIXTURE_MODES = Object.freeze(['TRANSIT', 'WALK', 'DRIVE']);

const indexes = new WeakMap();
function indexOf(fixture) {
  let ix = indexes.get(fixture);
  if (!ix) {
    ix = new Map(fixture.snapshots.map((s) => [s.place_id, s]));
    indexes.set(fixture, ix);
  }
  return ix;
}

/** snapshotFor(fixture, placeId) → the snapshot, or throws an Error with code NOT_FOUND. */
export function snapshotFor(fixture, placeId) {
  const s = indexOf(fixture).get(placeId);
  if (!s) throw Object.assign(new Error(`fixture ${fixture.name}: unknown place id ${placeId}`), { code: 'NOT_FOUND', place_id: placeId });
  return s;
}

/** noRoute(fixture, mode) → true when the fixture says Google has no route for that mode (routes.no_route_modes). */
export function noRoute(fixture, mode) {
  const m = fixture.routes && fixture.routes.no_route_modes;
  return Array.isArray(m) && m.includes(mode);
}

/** fixtureTravel(fixture, mode, fromPlaceId, toPlaceId) → { durationSec, distanceMeters, line?, warnings? } */
export function fixtureTravel(fixture, mode, fromPlaceId, toPlaceId) {
  if (!FIXTURE_MODES.includes(mode)) throw Object.assign(new Error(`fixture: travel mode must be one of ${FIXTURE_MODES.join(', ')}`), { code: 'BAD_INPUT' });
  const a = snapshotFor(fixture, fromPlaceId), b = snapshotFor(fixture, toPlaceId);
  if (fromPlaceId === toPlaceId) return { durationSec: 0, distanceMeters: 0 };
  const table = (fixture.routes && fixture.routes.modes && fixture.routes.modes[mode]) || {};
  const hit = table[`${fromPlaceId}|${toPlaceId}`] || table[`${toPlaceId}|${fromPlaceId}`];
  if (hit) {
    const out = { durationSec: hit.duration_sec, distanceMeters: hit.distance_m };
    if (hit.line) out.line = hit.line;
    if (Array.isArray(hit.warnings) && hit.warnings.length) out.warnings = [...hit.warnings];
    return out;
  }
  if (!a.location || !b.location) throw Object.assign(new Error(`fixture ${fixture.name}: no coordinates for ${a.location ? toPlaceId : fromPlaceId}`), { code: 'NOT_FOUND' });
  const fb = (fixture.routes && fixture.routes.fallback) || DEFAULT_FALLBACK;
  const distanceMeters = Math.round(haversineMeters(a.location, b.location) * DETOUR_FACTOR);
  const durationSec = Math.round((distanceMeters / 1000 / fb.speed_kmh[mode]) * 3600 + fb.overhead_sec[mode]);
  return { durationSec, distanceMeters };
}

// Developed by: LightAISolutions

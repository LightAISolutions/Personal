/**
 * Tour Guide — three invented fixture trips and their offline Maps answers (hill-town, Phase 10: a steep walking town
 * where Google has no public-transport route, with WALK route warnings and longer DRIVE routes).
 *   listFixtures() → ['transit-city', 'driving-loop', 'hill-town']
 *   loadFixture(name) → { name, trip, places, snapshots, estimates, notes, profile, calibration, routes }
 *   C11_FIXTURE_NAMES = ['moving-day'] (Phase 11): loadFixture('moving-day') also returns `dinners`; not in listFixtures()
 *   JOURNEY_FIXTURE_NAMES = ['two-stays'] (WP-11e): loads like a C11 fixture; not in listFixtures() or C11_FIXTURE_NAMES
 *   createFixtureResponder(fixture) → responder for the Maps kit's createMockTransport(responder)
 *   fixtureTravel(fixture, mode, fromPlaceId, toPlaceId) → { durationSec, distanceMeters, line? }  (single source of truth)
 * Everything here is invented: made-up cities and places, invented coordinates and ids, reserved domains only.
 */
export { listFixtures, loadFixture, fixturePath, FIXTURES_DIR, FIXTURE_NAMES, FIXTURE_PARTS, C11_FIXTURE_NAMES, C11_FIXTURE_PARTS, JOURNEY_FIXTURE_NAMES } from './fixture-load.mjs';
export { fixtureTravel, snapshotFor, noRoute, DEFAULT_FALLBACK, DETOUR_FACTOR, FIXTURE_MODES } from './fixture-travel.mjs';
export { createFixtureResponder, placeDetailsBody, nearestNeighbourOrder, SNAP_RADIUS_M } from './fixture-responder.mjs';
export { haversineMeters, nearestSnapshot } from './fixture-geo.mjs';

// Developed by: LightAISolutions

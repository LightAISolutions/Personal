'use strict';
// packs/tour-guide — station-based train estimates where Google has no transit route (Japan): the ride model, the
// station-pair choice, the Maps-client wrapper (matrix and single routes, pass-through when Google has a route or the
// mode is not TRANSIT, one station search per point) and a full planTrip on a fixture whose transit Google "cannot find".
const { test } = require('node:test');
const assert = require('node:assert/strict');
const rail = () => import('../packs/tour-guide/planner/index.mjs');

const KM_LAT = 1 / 111.2; // degrees of latitude per km
const north = (p, km) => ({ lat: p.lat + km * KM_LAT, lng: p.lng });

/** A fake Maps client: no transit anywhere, a station 300 m north of every searched point (unless `bare`). */
function fakeMaps({ bare = () => false, transit = null } = {}) {
  const calls = { textSearch: 0, matrix: 0, routes: 0 };
  return {
    calls,
    ledger: null,
    textSearch: async (q, o) => {
      calls.textSearch += 1;
      assert.equal(o.tier, 'pro');
      const c = { lat: o.locationBias.lat, lng: o.locationBias.lng };
      if (bare(c)) return { places: [] };
      const s = north(c, 0.3);
      return { places: [
        { displayName: { text: `Stn ${c.lat.toFixed(3)}` }, location: { latitude: s.lat, longitude: s.lng }, types: ['train_station', 'transit_station'] },
        { displayName: { text: 'Bus stop' }, location: { latitude: c.lat, longitude: c.lng }, types: ['bus_stop', 'transit_station'] },
        { displayName: { text: 'Far station' }, location: { latitude: c.lat + 0.05, longitude: c.lng }, types: ['train_station'] }
      ] };
    },
    computeRouteMatrix: async (o) => {
      calls.matrix += 1;
      const elements = [];
      o.origins.forEach((_, i) => o.destinations.forEach((__, j) => elements.push(transit && o.travelMode === 'TRANSIT' ? { originIndex: i, destinationIndex: j, ok: true, durationSec: 600, distanceMeters: 1, condition: 'ROUTE_EXISTS' } : { originIndex: i, destinationIndex: j, ok: o.travelMode !== 'TRANSIT', durationSec: o.travelMode !== 'TRANSIT' ? 60 : null, distanceMeters: null, condition: o.travelMode !== 'TRANSIT' ? 'ROUTE_EXISTS' : 'ROUTE_NOT_FOUND' })));
      return { elements, requests: 1, units: elements.length, sku: 'routes.route_matrix.essentials' };
    },
    computeRoutes: async (o) => { calls.routes += 1; return { route: transit && o.travelMode === 'TRANSIT' ? { durationSec: 600, legs: [] } : null, sku: 'x', ms: 1 }; }
  };
}

test('ride and walk models: city, transfer, regional and shinkansen bands', async () => {
  const { rideMinutes, walkMinutes, RAIL } = await rail();
  assert.equal(walkMinutes(0), 1);
  assert.equal(walkMinutes(0.8), Math.ceil((800 * RAIL.WALK_DETOUR) / RAIL.WALK_M_PER_MIN));
  assert.equal(rideMinutes(3), Math.ceil(RAIL.WAIT_MIN + 3 * RAIL.RIDE_DETOUR * RAIL.CITY_MIN_PER_KM));
  assert.equal(rideMinutes(8), Math.ceil(RAIL.WAIT_MIN + 8 * RAIL.RIDE_DETOUR * RAIL.CITY_MIN_PER_KM + RAIL.TRANSFER_MIN), 'a longer city ride allows one change');
  assert.ok(rideMinutes(100) < 120 && rideMinutes(100) > 80, 'regional ~75 km/h');
  assert.ok(rideMinutes(370) > 140 && rideMinutes(370) < 190, 'Tokyo–Kyoto by shinkansen lands near 2½–3 h');
});

test('railEstimate walks short hops, picks the fastest station pair, and gives up without stations', async () => {
  const { railEstimate, railLine } = await rail();
  const a = { lat: 35.66, lng: 139.70 };
  const near = north(a, 0.8);
  assert.equal(railEstimate(a, near, [], []).kind, 'walk');
  const b = north(a, 6);
  const e = railEstimate(a, b, [{ name: 'Far A', ...north(a, -0.9) }, { name: 'Near A', ...north(a, 0.2) }], [{ name: 'Near B', ...north(b, -0.1) }]);
  assert.equal(e.kind, 'train');
  assert.equal(e.from_station, 'Near A');
  assert.equal(e.to_station, 'Near B');
  assert.equal(e.minutes, e.walk_to + e.ride + e.walk_from);
  assert.equal(railLine(e), 'Near A → Near B (estimate)');
  assert.ok(railLine({ kind: 'train', from_station: 'x'.repeat(60), to_station: 'y'.repeat(60) }).length <= 80);
  assert.equal(railEstimate(a, north(a, 10), [], []), null, 'no stations and too far to walk: no route');
  assert.equal(railEstimate(a, north(a, 2), [], []).kind, 'walk', 'no stations but walkable: walk');
});

test('withRailEstimates fills TRANSIT gaps only, searches each point once, and resolves place ids from points', async () => {
  const { withRailEstimates } = await rail();
  const maps = fakeMaps();
  const A = { lat: 35.66, lng: 139.70 }, B = north(A, 7);
  const m = withRailEstimates(maps, { points: [{ placeId: 'PlaceAAAA', ...A }] });
  const r = await m.computeRouteMatrix({ origins: [{ placeId: 'PlaceAAAA' }, B], destinations: [{ placeId: 'PlaceAAAA' }, B], travelMode: 'TRANSIT' });
  const ab = r.elements.find((e) => e.originIndex === 0 && e.destinationIndex === 1);
  assert.equal(ab.ok, true);
  assert.equal(ab.condition, 'ROUTE_ESTIMATED');
  assert.equal(ab.estimated, 'train');
  assert.ok(ab.durationSec > 15 * 60 && ab.durationSec < 60 * 60);
  assert.equal(maps.calls.textSearch, 2, 'one station search per point, cached');
  const one = await m.computeRoutes({ origin: { placeId: 'PlaceAAAA' }, destination: B, travelMode: 'TRANSIT' });
  assert.equal(maps.calls.textSearch, 2);
  assert.equal(one.route.estimated, 'train');
  assert.deepEqual(one.route.legs[0].steps.map((s) => s.travelMode), ['WALK', 'TRANSIT', 'WALK']);
  assert.match(one.route.legs[0].steps[1].transit.transitLine.name, /^Stn .+ → Stn .+ \(estimate\)$/);
  assert.equal(one.route.durationSec, one.route.legs[0].steps.reduce((s, x) => s + x.durationSec, 0));
  assert.equal(m.railStats().station_searches, 2);
  // Pass-through: other modes, Google's own transit, unknown place ids, no stations far apart.
  const walk = await m.computeRouteMatrix({ origins: [A], destinations: [B], travelMode: 'WALK' });
  assert.equal(walk.elements[0].condition, 'ROUTE_EXISTS');
  assert.equal((await m.computeRoutes({ origin: { placeId: 'UnknownPlace' }, destination: B, travelMode: 'TRANSIT' })).route, null);
  const g = withRailEstimates(fakeMaps({ transit: true }), {});
  assert.equal((await g.computeRoutes({ origin: A, destination: B, travelMode: 'TRANSIT' })).route.durationSec, 600);
  assert.equal((await g.computeRouteMatrix({ origins: [A], destinations: [B], travelMode: 'TRANSIT' })).elements[0].condition, 'ROUTE_EXISTS');
  const rural = withRailEstimates(fakeMaps({ bare: () => true }), {});
  assert.equal((await rural.computeRoutes({ origin: A, destination: north(A, 20), travelMode: 'TRANSIT' })).route, null);
  assert.equal(typeof m.textSearch, 'function', 'the rest of the client is kept');
});

test('planTrip on a TRANSIT fixture with no Google transit: every leg is a station estimate or a walk, the plan validates', async () => {
  const fixtures = await import('../packs/tour-guide/fixtures/index.mjs');
  const mapsKit = await import('../kits/maps/index.mjs');
  const { planTrip } = await rail();
  const { validate } = await import('../packs/tour-guide/schemas/index.mjs');
  const fx = fixtures.loadFixture('transit-city');
  const real = mapsKit.createMapsClient({ transport: mapsKit.createMockTransport(fixtures.createFixtureResponder(fx)), ledger: mapsKit.createLedger() });
  const fake = fakeMaps();
  const maps = { ...real, textSearch: fake.textSearch, computeRouteMatrix: (o) => (o.travelMode === 'TRANSIT' ? fake.computeRouteMatrix(o) : real.computeRouteMatrix(o)), computeRoutes: (o) => (o.travelMode === 'TRANSIT' ? fake.computeRoutes(o) : real.computeRoutes(o)) };
  const plan = await planTrip({ ...fx, maps, build_id: 'rail-transit-city', now: '2027-04-30T09:00:00Z', seed: 7 });
  const v = validate(plan, 'plan');
  assert.deepEqual(v.errors, []);
  const transitLegs = plan.days.filter((d) => d.mode === 'TRANSIT').flatMap((d) => d.legs);
  assert.ok(transitLegs.length > 0);
  assert.ok(plan.days.some((d) => d.stops.length > 0), 'stops still get scheduled');
  for (const l of transitLegs) {
    assert.ok(Number.isFinite(l.minutes) && l.minutes >= 1);
    if (l.line) assert.match(l.line, /\(estimate\)$/);
    assert.match(l.maps_url, /travelmode=transit/);
  }
  assert.ok(transitLegs.some((l) => l.line), 'at least one leg is a train estimate');
  // With the rail estimates off, a leg Google could not route falls through to the distance fallback (WP-3e):
  // the day still times, every TRANSIT leg is a distance estimate and the day carries one transit_estimated warning.
  const off = await planTrip({ ...fx, maps, railEstimates: false, build_id: 'rail-off', now: '2027-04-30T09:00:00Z', seed: 7 });
  assert.deepEqual(validate(off, 'plan').errors, []);
  const offDays = off.days.filter((d) => d.mode === 'TRANSIT' && d.legs.length > 0);
  assert.ok(offDays.length > 0);
  for (const d of offDays) {
    assert.ok(d.legs.every((l) => l.estimated === true && l.estimate_basis === 'distance' && !l.line), 'distance estimates, no train line');
    assert.equal(d.warnings.filter((w) => w.code === 'transit_estimated').length, 1);
  }
});

// Developed by: LightAISolutions

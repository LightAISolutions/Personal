'use strict';
// packs/tour-guide — rail first on TRANSIT days: the default preference (trains, metro, trams), the trip's own list
// winning, and withBusFallback re-asking with buses only for pairs rail could not serve, never where Google has no
// transit at all (one probe element decides that).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const planner = () => import('../packs/tour-guide/planner/index.mjs');

const P = (n) => ({ lat: 40 + n / 100, lng: -3 });

/** Fake Maps: rail routes only where railOk(o, d); buses everywhere unless `noTransit`. Records every call's options. */
function fakeMaps({ railOk = () => true, noTransit = false } = {}) {
  const calls = [];
  const okFor = (o, prefs) => {
    if (noTransit) return false;
    const railOnly = prefs && prefs.allowedTravelModes && !prefs.allowedTravelModes.includes('BUS');
    return !railOnly || railOk(o.o, o.d);
  };
  return {
    calls,
    ledger: null,
    computeRouteMatrix: async (opts) => {
      calls.push({ kind: 'matrix', opts });
      const elements = [];
      opts.origins.forEach((o, i) => opts.destinations.forEach((d, j) => {
        const ok = opts.travelMode !== 'TRANSIT' || okFor({ o, d }, opts.transitPreferences);
        elements.push({ originIndex: i, destinationIndex: j, ok, durationSec: ok ? 600 + i * 60 + j : null, distanceMeters: ok ? 1000 : null, condition: ok ? 'ROUTE_EXISTS' : 'ROUTE_NOT_FOUND' });
      }));
      return { elements, requests: 1, units: elements.length, sku: 'routes.route_matrix.essentials' };
    },
    computeRoutes: async (opts) => {
      calls.push({ kind: 'route', opts });
      const ok = opts.travelMode !== 'TRANSIT' || okFor({ o: opts.origin, d: opts.destination }, opts.transitPreferences);
      return { route: ok ? { durationSec: 900, legs: [] } : null, sku: 'x', ms: 1 };
    }
  };
}

test('transitPrefs: rail first by default, the trip\'s own list wins, routingPreference kept', async () => {
  const { transitPrefs, railOnly, RAIL_MODES } = await planner();
  assert.deepEqual(transitPrefs({}).allowedTravelModes, [...RAIL_MODES]);
  assert.deepEqual(transitPrefs({ transit_preferences: { routingPreference: 'LESS_WALKING' } }), { routingPreference: 'LESS_WALKING', allowedTravelModes: [...RAIL_MODES] });
  assert.deepEqual(transitPrefs({ transit_preferences: { allowedTravelModes: ['BUS', 'TRAIN'] } }).allowedTravelModes, ['BUS', 'TRAIN']);
  assert.equal(railOnly(transitPrefs({})), true);
  assert.equal(railOnly({ allowedTravelModes: ['BUS', 'TRAIN'] }), false);
  assert.equal(railOnly(null), false);
});

test('withBusFallback re-asks only the pairs rail could not serve, with buses allowed', async () => {
  const { withBusFallback, transitPrefs } = await planner();
  const A = P(1), B = P(2), C = P(3);
  const maps = fakeMaps({ railOk: (o, d) => !(o === C || d === C) });
  const m = withBusFallback(maps);
  const tp = transitPrefs({ transit_preferences: { routingPreference: 'FEWER_TRANSFERS' } });
  const r = await m.computeRouteMatrix({ origins: [A, B, C], destinations: [A, B, C], travelMode: 'TRANSIT', transitPreferences: tp });
  assert.equal(maps.calls.length, 2, 'rail ask, then one bus ask (no probe: rail already found routes here)');
  const retry = maps.calls[1].opts;
  assert.deepEqual(retry.transitPreferences, { routingPreference: 'FEWER_TRANSFERS' }, 'mode limit lifted, routing preference kept');
  assert.equal(r.requests, 2);
  assert.equal(r.units, 9 + retry.origins.length * retry.destinations.length);
  for (const e of r.elements) assert.equal(e.ok, true, `element ${e.originIndex}→${e.destinationIndex} has a route`);
  const ab = r.elements.find((e) => e.originIndex === 0 && e.destinationIndex === 1);
  assert.equal(ab.bus, undefined, 'a rail route stays as it was');
  const ac = r.elements.find((e) => e.originIndex === 0 && e.destinationIndex === 2);
  assert.equal(ac.bus, true, 'a bus fills a pair rail could not serve');
  assert.equal(m.busStats().google_transit, true);
});

test('no transit anywhere (Japan): one probe element, then no more bus asks for matrices or single routes', async () => {
  const { withBusFallback, transitPrefs } = await planner();
  const maps = fakeMaps({ noTransit: true });
  const m = withBusFallback(maps);
  const tp = transitPrefs({});
  const r = await m.computeRouteMatrix({ origins: [P(1), P(2)], destinations: [P(1), P(2)], travelMode: 'TRANSIT', transitPreferences: tp });
  assert.equal(maps.calls.length, 2);
  assert.equal(maps.calls[1].opts.origins.length * maps.calls[1].opts.destinations.length, 1, 'the probe is one element');
  assert.equal(r.elements.filter((e) => e.ok).length, 0, 'gaps stay open for the train estimates');
  assert.equal(m.busStats().google_transit, false);
  await m.computeRouteMatrix({ origins: [P(3), P(4)], destinations: [P(3), P(4)], travelMode: 'TRANSIT', transitPreferences: tp });
  const one = await m.computeRoutes({ origin: P(1), destination: P(2), travelMode: 'TRANSIT', transitPreferences: tp });
  assert.equal(one.route, null);
  assert.equal(maps.calls.length, 4, 'no probe or bus ask after Google showed it has no transit here');
});

test('a bus-only place: the probe finds transit, so the failed pairs get buses', async () => {
  const { withBusFallback, transitPrefs } = await planner();
  const maps = fakeMaps({ railOk: () => false });
  const m = withBusFallback(maps);
  const r = await m.computeRouteMatrix({ origins: [P(1), P(2)], destinations: [P(1), P(2)], travelMode: 'TRANSIT', transitPreferences: transitPrefs({}) });
  assert.equal(maps.calls.length, 3, 'rail ask, probe, bus ask');
  const off = r.elements.filter((e) => e.originIndex !== e.destinationIndex);
  assert.ok(off.every((e) => e.ok && e.bus));
});

test('single routes: bus only when rail has none; non-TRANSIT, own bus list and multi-stop calls pass through', async () => {
  const { withBusFallback, transitPrefs } = await planner();
  const A = P(1), B = P(2), C = P(3);
  const maps = fakeMaps({ railOk: (o, d) => d !== C });
  const m = withBusFallback(maps);
  const tp = transitPrefs({});
  const rail = await m.computeRoutes({ origin: A, destination: B, travelMode: 'TRANSIT', transitPreferences: tp });
  assert.equal(rail.route.bus, undefined);
  assert.equal(maps.calls.length, 1);
  const bus = await m.computeRoutes({ origin: A, destination: C, travelMode: 'TRANSIT', transitPreferences: tp });
  assert.equal(bus.route.bus, true);
  assert.equal(maps.calls[2].opts.transitPreferences, undefined, 'the bus ask carries no mode limit');
  const n = maps.calls.length;
  await m.computeRoutes({ origin: A, destination: C, travelMode: 'WALK' });
  await m.computeRoutes({ origin: A, destination: C, travelMode: 'TRANSIT', transitPreferences: { allowedTravelModes: ['BUS', 'TRAIN'] } });
  await m.computeRouteMatrix({ origins: [A], destinations: [C], travelMode: 'DRIVE' });
  assert.equal(maps.calls.length, n + 3, 'one call each, no retries');
});

test('planTrip asks Google for rail first on TRANSIT days', async () => {
  const fixtures = await import('../packs/tour-guide/fixtures/index.mjs');
  const mapsKit = await import('../kits/maps/index.mjs');
  const { planTrip, RAIL_MODES } = await planner();
  const fx = fixtures.loadFixture('transit-city');
  fx.trip = { ...fx.trip };
  delete fx.trip.transit_preferences; // the fixture lists its own modes (buses included); without a list the planner asks rail first
  const responder = fixtures.createFixtureResponder(fx);
  const asked = [];
  const spy = (req) => { const b = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {}; if (b.travelMode === 'TRANSIT') asked.push(b.transitPreferences || null); return responder(req); };
  const maps = mapsKit.createMapsClient({ transport: mapsKit.createMockTransport(spy), ledger: mapsKit.createLedger() });
  const plan = await planTrip({ ...fx, maps, build_id: 'rail-first', now: '2027-04-30T09:00:00Z', seed: 7, railEstimates: false });
  assert.ok(plan.days.length > 0 && asked.length > 0);
  for (const tp of asked) assert.deepEqual(tp && tp.allowedTravelModes, [...RAIL_MODES], 'every TRANSIT ask is rail only (the fixture answers, so no bus re-ask)');
});

// Developed by: LightAISolutions

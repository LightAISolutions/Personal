'use strict';
// packs/tour-guide — WP-3e transit fallback. Google Routes returns no TRANSIT route in some countries; the planner then
// estimates the leg from distance (trip.transit_fallback, default 20 km/h + 12 min) instead of switching to driving.
// The fixture responder always answers, so a test-level wrapper strips every TRANSIT route and matrix element the
// way Google reports "no route": an empty Compute Routes body, and matrix elements that are missing or ROUTE_NOT_FOUND.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const NOW = '2027-04-30T09:00:00Z';
const TEXT = 'Transit times on this day are estimates; check the Maps link before you go';
const loadAll = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await import('../packs/tour-guide/planner/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs')
});

/** Wrap a responder: TRANSIT Compute Routes → `{}`; TRANSIT matrix → every other element dropped, the rest ROUTE_NOT_FOUND. */
function stripTransit(inner, seen) {
  return (req) => {
    const r = inner(req);
    const body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : {};
    if (body.travelMode !== 'TRANSIT' || r.status !== 200) return r;
    if (req.url.endsWith('/v2:computeRoutes')) { seen.routes++; return { status: 200, body: {} }; }
    if (req.url.endsWith('/v2:computeRouteMatrix')) {
      seen.matrices++;
      return { status: 200, body: r.body.filter((_, i) => i % 2 === 0).map((e) => ({ originIndex: e.originIndex, destinationIndex: e.destinationIndex, status: {}, condition: 'ROUTE_NOT_FOUND' })) };
    }
    return r;
  };
}

async function planWith(L, name, { strip = false, trip = null } = {}) {
  const fx = L.fixtures.loadFixture(name);
  if (trip) fx.trip = { ...fx.trip, ...trip };
  const seen = { routes: 0, matrices: 0 };
  const responder = L.fixtures.createFixtureResponder(fx);
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(strip ? stripTransit(responder, seen) : responder), ledger: L.maps.createLedger() });
  const input = { ...fx, maps, build_id: `tf-${name}`, now: NOW, seed: 7 };
  return { fx, input, seen, plan: await L.planner.planTrip(input) };
}

/** Coordinates of a leg end: a place's snapshot location or the day's lodging. */
function coordsOf(fx, ref, lodgingId) {
  if (ref === 'lodging') { const l = fx.trip.lodging.find((x) => x.id === lodgingId); return { lat: l.lat, lng: l.lng }; }
  const p = fx.places.find((x) => x.id === ref);
  const snaps = Array.isArray(fx.snapshots) ? fx.snapshots : Object.values(fx.snapshots);
  return snaps.find((s) => s.place_id === p.place_id).location;
}

function checkEstimatedPlan(L, fx, plan, fallback) {
  assert.deepEqual(L.schemas.validate(plan, 'plan').errors, [], 'the stripped plan validates');
  let legs = 0;
  for (const day of plan.days) {
    assert.equal(day.mode, 'TRANSIT', `${day.date}: still TRANSIT, never driving`);
    const est = day.legs.filter((l) => l.estimated);
    assert.equal(est.length, day.legs.length, `${day.date}: every transit leg is an estimate`);
    const warn = day.warnings.filter((w) => w.code === 'transit_estimated');
    if (day.legs.length) assert.deepEqual(warn, [{ severity: 'warn', code: 'transit_estimated', text: TEXT }], `${day.date}: the warning appears once`);
    else assert.equal(warn.length, 0);
    for (const leg of day.legs) {
      legs++;
      assert.equal(leg.mode, 'TRANSIT');
      assert.equal(leg.estimate_basis, 'distance');
      assert.equal(leg.line, undefined, 'an estimate names no line');
      assert.match(leg.maps_url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&.*travelmode=transit/);
      const a = coordsOf(fx, leg.from, day.lodging_start), b = coordsOf(fx, leg.to, day.lodging_end);
      const want = L.planner.estimateTransit(a, b, fallback);
      assert.equal(leg.minutes, want.minutes, `${day.date}: ${leg.from}→${leg.to} = distance × 1.3 at ${fallback.kmh} km/h + ${fallback.overhead_min} min`);
      assert.equal(leg.distance_m, want.distance_m);
    }
  }
  assert.ok(legs > 0, 'the plan has legs');
  return legs;
}

test('estimateTransit and transitFallback: formula, defaults, no coordinates', async () => {
  const { planner: P } = await loadAll();
  assert.deepEqual(P.TRANSIT_FALLBACK_DEFAULT, { kmh: 20, overhead_min: 12 });
  assert.deepEqual(P.transitFallback({}), { kmh: 20, overhead_min: 12 });
  assert.deepEqual(P.transitFallback({ transit_fallback: { kmh: 30, overhead_min: 5, source: 'researched' } }), { kmh: 30, overhead_min: 5 });
  const a = { lat: 10, lng: 20 }, b = { lat: 10.01, lng: 20 }; // ≈ 1.112 km apart
  const est = P.estimateTransit(a, b, { kmh: 20, overhead_min: 12 });
  assert.equal(est.estimated, true);
  assert.equal(est.minutes, Math.ceil((1.1119 * 1.3 / 20) * 60 + 12));
  assert.ok(Math.abs(est.distance_m - 1445) <= 2, `${est.distance_m} m`);
  assert.equal(P.estimateTransit(a, a, { kmh: 20, overhead_min: 0 }).minutes, 1, 'never zero minutes');
  assert.equal(P.estimateTransit({ name: 'no coordinates' }, b, { kmh: 20, overhead_min: 12 }), null);
});

test('no TRANSIT route from Google: the plan builds on distance estimates, one warning per day', async () => {
  const L = await loadAll();
  const { fx, plan, seen } = await planWith(L, 'transit-city', { strip: true });
  assert.ok(seen.matrices > 0 && seen.routes > 0, 'the wrapper stripped matrices and routes');
  checkEstimatedPlan(L, fx, plan, { kmh: 20, overhead_min: 12 });
  const scheduled = plan.days.reduce((n, d) => n + d.stops.length, 0);
  assert.ok(scheduled > 0, 'stops are still planned');
});

test('trip.transit_fallback {kmh 30, overhead_min 5} changes every estimate accordingly', async () => {
  const L = await loadAll();
  const base = await planWith(L, 'transit-city', { strip: true });
  const tuned = await planWith(L, 'transit-city', { strip: true, trip: { transit_fallback: { kmh: 30, overhead_min: 5, source: 'researched', note: 'invented: faster trains' } } });
  assert.deepEqual(L.schemas.validate(tuned.fx.trip, 'trip').errors, []);
  checkEstimatedPlan(L, tuned.fx, tuned.plan, { kmh: 30, overhead_min: 5 });
  const total = (p) => p.days.reduce((n, d) => n + d.legs.reduce((m, l) => m + l.minutes, 0), 0);
  const legsOf = (p) => p.days.flatMap((d) => d.legs);
  assert.ok(total(tuned.plan) / legsOf(tuned.plan).length < total(base.plan) / legsOf(base.plan).length, 'faster and less overhead → shorter legs on average');
});

test('re-planning one day of an estimated plan keeps the other days byte-identical', async () => {
  const L = await loadAll();
  const { plan, input } = await planWith(L, 'transit-city', { strip: true });
  const date = plan.days[1].date;
  const re = await L.planner.replanDays(plan, [date], input);
  for (let i = 0; i < plan.days.length; i++) if (plan.days[i].date !== date) assert.equal(JSON.stringify(re.days[i]), JSON.stringify(plan.days[i]));
  assert.ok(re.days[1].warnings.some((w) => w.code === 'transit_estimated'));
});

test('a DRIVE trip is untouched by the wrapper and the fallback: byte-identical plan, no estimate', async () => {
  const L = await loadAll();
  const plain = await planWith(L, 'driving-loop');
  const wrapped = await planWith(L, 'driving-loop', { strip: true });
  assert.equal(wrapped.seen.routes + wrapped.seen.matrices, 0, 'no TRANSIT request on a driving trip');
  assert.equal(JSON.stringify(wrapped.plan), JSON.stringify(plain.plan));
  for (const d of plain.plan.days) {
    assert.ok(d.legs.every((l) => l.estimated === undefined && l.estimate_basis === undefined));
    assert.ok(!d.warnings.some((w) => w.code === 'transit_estimated'));
  }
  const transit = await planWith(L, 'transit-city');
  assert.ok(transit.plan.days.every((d) => d.legs.every((l) => !l.estimated)), 'when Google answers, nothing is estimated');
});

test('schemas: transit_fallback on the trip, estimated legs and the warning on the day plan', async () => {
  const L = await loadAll();
  const { validate } = L.schemas;
  const { fx, plan } = await planWith(L, 'transit-city', { strip: true });
  const trip = (tf) => ({ ...fx.trip, transit_fallback: tf });
  assert.ok(validate(trip({ kmh: 25, overhead_min: 10 }), 'trip').ok);
  for (const bad of [{ kmh: 0, overhead_min: 10 }, { kmh: 25 }, { kmh: 25, overhead_min: 10, source: 'guess' }, { kmh: 25, overhead_min: 10, extra: 1 }, { kmh: 25, overhead_min: 1.5 }, { kmh: 25, overhead_min: 10, note: 'x'.repeat(201) }]) {
    assert.equal(validate(trip(bad), 'trip').ok, false, JSON.stringify(bad).slice(0, 80));
  }
  const day = plan.days.find((d) => d.legs.length > 1);
  assert.deepEqual(validate(day, 'day-plan').errors, []);
  const msg = (d) => validate(d, 'day-plan').errors.map((e) => `${e.path} ${e.message}`).join(' | ');
  const clone = () => JSON.parse(JSON.stringify(day));
  let d = clone(); d.warnings = d.warnings.filter((w) => w.code !== 'transit_estimated');
  assert.match(msg(d), /\/warnings .*exactly one "transit_estimated" warning \(found 0\)/);
  d = clone(); d.warnings.push({ severity: 'warn', code: 'transit_estimated', text: TEXT });
  assert.match(msg(d), /found 2/);
  d = clone(); delete d.legs[0].estimate_basis;
  assert.match(msg(d), /\/legs\/0\/estimate_basis estimated and estimate_basis go together/);
  d = clone(); d.legs[0].estimated = false;
  assert.match(msg(d), /\/legs\/0\/estimated/);
  d = clone(); d.legs[0].mode = 'DRIVE';
  assert.match(msg(d), /\/legs\/0\/estimated only a TRANSIT leg can be estimated/);
  d = clone(); for (const l of d.legs) { delete l.estimated; delete l.estimate_basis; }
  assert.match(msg(d), /"transit_estimated" on a day without an estimated leg/);
  d = clone(); d.legs[0].estimate_basis = 'schedule';
  assert.match(msg(d), /\/legs\/0\/estimate_basis/);
});

// Developed by: LightAISolutions

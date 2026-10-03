'use strict';
// Tour Guide Phase 10 (WP-10b) — honest travel legs on the invented hill-town fixture (Google has no transit there, so
// every leg is walked): a walked leg takes the recorded WALK route; an uphill leg gets taxi_minutes from the recorded
// DRIVE route; a failed WALK request falls back to an estimate that stays marked; buffers and spare_minutes; the
// request count per day stays under the recorded budget. Invented places, recorded fixture routes, no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await import('../packs/tour-guide/planner/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs')
});
const NOW = '2027-09-01T09:00:00Z';
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const ceilMin = (sec) => Math.max(1, Math.ceil(sec / 60));

/** Plan the hill fixture. `wrap(client)` may replace the Maps client (to make requests fail). */
async function planHill(L, { wrap = (c) => c, dates = null } = {}) {
  const fx = L.fixtures.loadFixture('hill-town');
  const ledger = L.maps.createLedger();
  const transport = L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx));
  const maps = wrap(L.maps.createMapsClient({ transport, ledger }));
  const input = { ...fx, maps, build_id: 'legs-hill', now: NOW, seed: 7 };
  const plan = await L.planner.planTrip(input);
  const byId = new Map(fx.places.map((p) => [p.id, p]));
  for (const l of fx.trip.lodging) byId.set(l.id, l);
  const pid = (ref, day, end) => byId.get(ref === 'lodging' ? (end ? day.lodging_end : day.lodging_start) : ref).place_id;
  return { fx, ledger, transport, maps, input, plan, pid, dates };
}
const legOf = (plan, from, to) => { for (const d of plan.days) for (const l of d.legs) if (l.from === from && l.to === to) return { day: d, leg: l }; return null; };

test('hill-town: every walked leg takes the recorded WALK route (minutes, distance) and a footpath warning flags it', async () => {
  const L = await load();
  const { fx, plan, pid } = await planHill(L);
  assert.ok(L.schemas.validate(plan, 'plan').ok);
  let walked = 0;
  for (const day of plan.days) {
    day.legs.forEach((leg, i) => {
      assert.equal(leg.mode, 'WALK', `${day.date} leg ${i}: no transit in hill-town, so the leg is walked`);
      assert.equal(leg.estimated, undefined, 'Google answered every WALK request');
      const want = L.fixtures.fixtureTravel(fx, 'WALK', pid(leg.from, day, false), pid(leg.to, day, i === day.legs.length - 1));
      assert.equal(leg.minutes, ceilMin(want.durationSec), `${leg.from}→${leg.to}: Google's walking minutes`);
      assert.equal(leg.distance_m, want.distanceMeters, `${leg.from}→${leg.to}: Google's walking distance`);
      assert.match(leg.maps_url, /travelmode=walking/);
      walked += 1;
    });
  }
  assert.ok(walked >= 6);
  const mg = legOf(plan, 'ember-lane-folk-museum', 'lantern-pond-garden').leg;
  assert.deepEqual([mg.minutes, mg.distance_m], [8, 640], 'the recorded 480 s / 640 m');
  assert.ok(mg.flags.includes('footpath'), 'a "restricted usage or private roads" warning is a footpath');
  const gt = legOf(plan, 'lantern-pond-garden', 'mossgate-temple').leg;
  assert.deepEqual(gt.flags, ['footpath'], 'a "pedestrian walkway" warning, both ends flat');
  assert.equal(gt.taxi_minutes, undefined, 'a flat footpath gets no taxi time');
});

test('hill-town: an uphill leg gets taxi_minutes from the recorded DRIVE route; a long drive marks a footpath hilly', async () => {
  const L = await load();
  const { fx, plan, pid } = await planHill(L);
  const { day, leg } = legOf(plan, 'reedmarsh-shrine', 'thornback-hill-lookout');
  assert.deepEqual(leg.flags, ['uphill'], 'to a lookout, from a shrine');
  const drive = L.fixtures.fixtureTravel(fx, 'DRIVE', pid(leg.from, day), pid(leg.to, day));
  assert.equal(leg.taxi_minutes, ceilMin(drive.durationSec));
  const down = legOf(plan, 'thornback-hill-lookout', 'willowmere-tea-house').leg;
  assert.deepEqual(down.flags, ['downhill']);
  assert.equal(down.taxi_minutes, undefined, 'downhill alone gets no taxi time');
  const mg = legOf(plan, 'ember-lane-folk-museum', 'lantern-pond-garden');
  const d2 = L.fixtures.fixtureTravel(fx, 'DRIVE', pid(mg.leg.from, mg.day), pid(mg.leg.to, mg.day));
  assert.ok(d2.distanceMeters >= L.planner.LEG_EXTRA.HILL_RATIO * mg.leg.distance_m, 'fixture: the drive is 1700 m for a 640 m walk');
  assert.deepEqual(mg.leg.flags, ['footpath', 'uphill', 'downhill'], 'a footpath whose drive is ≥ 1.8× longer is hilly');
  assert.equal(mg.leg.taxi_minutes, ceilMin(d2.durationSec));
});

test('hill-town: a failed WALK request keeps the estimate, marked through fetchLeg, and raises the day warning', async () => {
  const L = await load();
  const failWalk = (c) => ({ ...c, computeRoutes: async (o) => { if (o.travelMode === 'WALK') throw new Error('fixture: WALK request failed'); return c.computeRoutes(o); } });
  const { plan } = await planHill(L, { wrap: failWalk });
  for (const day of plan.days) {
    const est = day.legs.filter((l) => l.estimated);
    assert.equal(est.length, day.legs.length, `${day.date}: every walk is now an estimate`);
    for (const l of est) {
      assert.equal(l.mode, 'WALK'); assert.equal(l.estimate_basis, 'distance');
      assert.ok(l.note && l.note.length <= 300, 'the estimator says why');
    }
    const w = day.warnings.filter((x) => x.code === 'transit_estimated');
    assert.equal(w.length, 1);
    assert.equal(w[0].text, L.planner.WALK_ESTIMATED_TEXT);
    assert.match(w[0].text, /Walking times/);
    // checkDayPlan allows `estimated` on WALK legs too (WP-10b REQUEST, applied by the Phase 10 coordinator).
    assert.deepEqual(L.schemas.validate(day, 'day-plan').errors, [], 'an all-estimated walking day is a valid day plan');
  }
  // Directly: fetchLeg on a rail-walk route whose WALK request fails.
  const route = { durationSec: 600, distanceMeters: 700, warnings: ['Estimated walk (fixture)'], estimated: 'walk', legs: [] };
  let calls = 0;
  const maps = { computeRoutes: async (o) => { calls += 1; if (o.travelMode === 'WALK') throw new Error('down'); return { route }; } };
  const a = { placeId: 'FixtureLegA', name: 'A', lat: 30, lng: 150 }, b = { placeId: 'FixtureLegB', name: 'B', lat: 30.005, lng: 150 };
  const leg = await L.planner.fetchLeg(maps, { from: a, to: b, mode: 'TRANSIT', allowance: L.planner.legAllowance(4) });
  assert.deepEqual([leg.mode, leg.estimated, leg.warning, leg.minutes, leg.requests, calls], ['WALK', true, 'Estimated walk (fixture)', 10, 2, 2]);
  const spent = await L.planner.fetchLeg(maps, { from: a, to: b, mode: 'TRANSIT', allowance: L.planner.legAllowance(0) });
  assert.deepEqual([spent.estimated, spent.requests], [true, 1], 'no allowance left: no WALK request, the estimate stays marked');
});

test('hill-town: each stop starts no earlier than its leg arrival + buffer; spare_minutes is the free time left', async () => {
  const L = await load();
  const { plan, fx } = await planHill(L);
  for (const day of plan.days) {
    day.stops.forEach((s, i) => {
      const leg = day.legs[i];
      const ready = toMin(leg.arrive_at) + (leg.buffer_minutes || 0);
      assert.equal(leg.buffer_minutes, L.planner.bufferFor({ mode: leg.mode, minutes: leg.minutes, flags: leg.flags }) || undefined, `${leg.from}→${leg.to}: the buffer for its mode, length and flags`);
      assert.ok(toMin(s.arrive) >= ready, `${s.place} starts after the buffer`);
      if (!s.booked && !(s.window && toMin(s.window.open) > ready)) assert.equal(toMin(s.arrive), ready, `${s.place} starts right after the buffer`);
    });
    assert.equal(day.legs[day.legs.length - 1].buffer_minutes, undefined, 'nothing waits on the walk home');
    const free = day.free.reduce((n, f) => n + Math.min(toMin(f.end), toMin(fx.trip.day_end)) - toMin(f.start), 0);
    assert.equal(day.spare_minutes, free, `${day.date}: spare time = the free blocks`);
  }
  const up = legOf(plan, 'reedmarsh-shrine', 'thornback-hill-lookout').leg;
  assert.equal(up.buffer_minutes, 8, 'a 12-minute uphill walk: 3 + 5 for the climb');
  assert.deepEqual(plan.days.map((d) => d.spare_minutes), [262, 230]);
});

test('bufferFor: walks by length, transit per change, drive, climbs; capped', async () => {
  const { bufferFor, BUFFER } = (await load()).planner;
  assert.equal(bufferFor({ mode: 'WALK', minutes: 6 }), 2);
  assert.equal(bufferFor({ mode: 'WALK', minutes: 20 }), 3);
  assert.equal(bufferFor({ mode: 'WALK', minutes: 40 }), 5);
  assert.equal(bufferFor({ mode: 'WALK', minutes: 8, flags: ['footpath', 'uphill'] }), 7);
  assert.equal(bufferFor({ mode: 'WALK', minutes: 8, flags: ['downhill'] }), 2, 'downhill adds nothing');
  assert.equal(bufferFor({ mode: 'TRANSIT', minutes: 30, transfers: 1 }), 10);
  assert.equal(bufferFor({ mode: 'TRANSIT', minutes: 30, transfers: 5 }), BUFFER.MAX);
  assert.equal(bufferFor({ mode: 'DRIVE', minutes: 15 }), 5);
  assert.equal(bufferFor({ mode: 'WALK', minutes: Infinity }), 0);
  assert.equal(bufferFor(null), 0);
});

test('routeFlags / isHillPoint: footpath, trail, uphill, downhill; the WALK beta notice is not a footpath', async () => {
  const L = await load();
  const { routeFlags, isHillPoint } = L.planner;
  const fx = L.fixtures.loadFixture('hill-town');
  const notice = Object.values(fx.routes.modes.WALK).flatMap((r) => r.warnings || []).find((w) => /beta/i.test(w));
  assert.ok(notice, 'fixture carries the WALK beta notice');
  assert.deepEqual(routeFlags({ from: null, to: null, warnings: [notice] }), [], 'the notice alone gives no flag');
  assert.deepEqual(routeFlags({ warnings: [notice, 'This route uses pedestrian path with steps'] }), ['footpath']);
  assert.deepEqual(routeFlags({ warnings: ['Route includes a hiking trail'] }), ['trail']);
  const lookout = { id: 'x-lookout', category: 'viewpoint', name: 'X Lookout' }, cafe = { id: 'hill-cafe', category: 'cafe', name: 'Hill Cafe' };
  const temple = { id: 'pine-ji', category: 'temple', name: 'Pine-ji' };
  assert.deepEqual(routeFlags({ from: temple, to: lookout }), ['uphill']);
  assert.deepEqual(routeFlags({ from: lookout, to: temple }), ['downhill']);
  assert.deepEqual(routeFlags({ from: lookout, to: { id: 'y', category: 'park', name: 'Mount Y Park' } }), [], 'hill to hill: neither');
  assert.deepEqual(routeFlags({ from: { id: 'h', category: 'hike', name: 'Ridge' }, to: temple }), ['trail', 'downhill'], 'leaving a hike is a trail and downhill');
  assert.equal(isHillPoint(cafe), false, 'a café named hill is not a summit');
  assert.equal(isHillPoint({ category: 'viewpoint', name: 'Lodging' }), false, 'a lodging (no id) is never a hill');
  assert.equal(isHillPoint({ id: 'a', category: 'temple', name: 'Kurama-yama temple' }), true);
});

test('hill-town: the Compute Routes requests per day stay under the recorded budget, and every one is in the ledger', async () => {
  const L = await load();
  const { input, plan, ledger, fx } = await planHill(L);
  const budget = await L.planner.estimateBudget(input);
  const routesUnits = (lg) => lg.usage().skus.find((s) => s.sku === 'routes.compute_routes.essentials').units;
  assert.equal(routesUnits(ledger), plan.usage.route_calls, 'every Compute Routes request went through the ledger');
  for (const day of plan.days) {
    const b = budget.per_day[day.date];
    assert.equal(b.extra_calls, L.planner.extraCallsFor(day.mode, day.legs.length));
    assert.ok(b.extra_calls <= L.planner.LEG_EXTRA.MAX_PER_DAY);
    // Re-plan this day alone on a fresh ledger: what it spends is this day's requests.
    const lg = L.maps.createLedger();
    const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: lg });
    await L.planner.replanDays(plan, [day.date], { ...input, maps });
    const used = routesUnits(lg);
    assert.ok(used > day.legs.length, `${day.date}: honest legs cost extra requests (${used})`);
    assert.ok(used <= b.route_calls + b.extra_calls, `${day.date}: ${used} requests ≤ budget ${b.route_calls} + ${b.extra_calls}`);
  }
});

// Developed by: LightAISolutions

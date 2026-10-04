'use strict';
// Tour Guide planner — Phase 13 (WP-13a) timing on the invented moving-day fixture: a departure day's last leg leaves
// as late as its end allows, with the spare time before it (A8), and evening extras never start before the day's
// arrival (A12). Each test reproduced its fault before the fix.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadAll = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await import('../packs/tour-guide/planner/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs'),
  subset: await import('../kits/brochure/lib/validate.mjs')
});
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const NOW = '2027-10-01T09:00:00Z';
const D2 = '2027-10-19', D3 = '2027-10-20';
const STATION_ID = 'FixtureMdAshvaleStation';

/** Plan moving-day after `mut(fx)`, recording every request the transport sees. */
async function plan(L, mut = null) {
  const fx = L.fixtures.loadFixture('moving-day');
  if (mut) mut(fx);
  const ledger = L.maps.createLedger();
  const respond = L.fixtures.createFixtureResponder(fx), sent = [];
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport((req) => { sent.push(req); return respond(req); }), ledger });
  const p = await L.planner.planTrip({ ...fx, maps, build_id: 'p13a-timing', now: NOW, seed: 7 });
  return { fx, plan: p, ledger, sent, day: (date) => p.days.find((d) => d.date === date) };
}
const override = (fx, date) => fx.trip.day_overrides.find((o) => o.date === date);
function sound(L, p) {
  for (const d of p.days) {
    assert.deepEqual(L.subset.validate(d, L.schemas.loadSchema('day-plan')), [], `${d.date}: the day-plan schema accepts it`);
    assert.deepEqual(L.planner.checkDayChain(d), [], `${d.date}: chain and timeline hold`);
  }
}

/* ---------------- A8: the last leg of a hard-end day ---------------- */
test('A8: on a transit departure day the last leg leaves as late as allowed, the spare time is free time before it, and the re-timing request is counted', async () => {
  const L = await loadAll();
  const { fx, plan: p, sent, day } = await plan(L, (f) => { f.trip.modes.by_date = { [D3]: 'TRANSIT' }; });
  sound(L, p);
  const d = day(D3);
  const last = d.legs[d.legs.length - 1];
  assert.equal(last.to, 'day-end');
  assert.equal(last.arrive_at, '16:50', 'arrives END_MARGIN before the 17:00 departure, not right after the last stop');
  const lastStop = d.stops[d.stops.length - 1];
  assert.ok(toMin(last.depart_at) - toMin(lastStop.depart) >= 60, 'it no longer leaves right after the last stop');
  const before = d.free.find((f) => f.end === last.depart_at);
  assert.equal(before.note, `free time near ${'Lantern Quay Gallery'} before you leave for Ashvale Station`);
  assert.ok(!d.free.some((f) => f.note.startsWith(L.planner.END_SPARE_NOTE)), 'no time-to-spare note at the end point');
  // One request at the new departure, counted in the day's route calls and in its budget.
  const at = L.planner.localToIso(D3, toMin(last.depart_at), fx.trip.timezone);
  const asked = sent.filter((r) => /computeRoutes$/.test(r.url) && r.body.travelMode === 'TRANSIT' && r.body.destination.placeId === STATION_ID && r.body.departureTime === at);
  assert.equal(asked.length, 1, 'the leg is asked again once, at its new departure');
  assert.equal(d.solver.route_calls, d.legs.length + 1, 'the day counts it');
  const budget = L.planner.budgetFor({ days: L.planner.buildDays(fx.trip), byDate: {} });
  assert.equal(budget.per_day[D3].late_leg_calls, 1, 'the budget holds it');
  assert.equal(budget.per_day[D2].late_leg_calls, undefined, 'only on a day with an end');
});

test('A8: a walking departure day moves the same leg later with its own minutes and asks Google nothing more', async () => {
  const L = await loadAll();
  const { fx, day } = await plan(L);
  const d = day(D3);
  const last = d.legs[d.legs.length - 1];
  assert.equal(last.arrive_at, '16:50');
  assert.equal(toMin(last.arrive_at) - toMin(last.depart_at), last.minutes, 'the leg keeps its minutes');
  assert.equal(d.solver.route_calls, d.legs.length, 'no extra request on a walking day');
  assert.equal(L.planner.budgetFor({ days: L.planner.buildDays(fx.trip), byDate: {} }).per_day[D3].late_leg_calls, undefined);
});

/* ---------------- A12: evening extras after the arrival ---------------- */
test('A12: on a day that starts late no evening extra starts before the arrival and its bag step', async () => {
  const L = await loadAll();
  const { plan: p, day } = await plan(L, (fx) => { Object.assign(override(fx, D2), { day_end: '23:00' }); override(fx, D2).start.time = '18:40'; });
  sound(L, p);
  const d = day(D2);
  assert.ok((d.extras || []).length >= 1, 'the evening still offers extras');
  const ready = toMin(d.bags.end);   // the arrival at 18:40, then the bags at the hotel
  for (const x of d.extras) if (x.time) assert.ok(toMin(x.time) >= ready, `${x.name} at ${x.time} is not before ${d.bags.end}`);
  const fair = d.extras.find((x) => x.ref === 'ashvale-harvest-fair');
  assert.equal(fair.time, d.bags.end, 'an event under way at arrival is offered from the arrival (it runs 17:30–21:00)');
});

// Developed by: LightAISolutions

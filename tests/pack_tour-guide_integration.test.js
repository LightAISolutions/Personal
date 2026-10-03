'use strict';
// packs/tour-guide — integration: the planner runs on both fixture trips (schemas + estimator + fixtures from WP-3a,
// planner from WP-3b, brochure map from WP-3c) with the Maps kit's mock transport and the real estimator. Checks the
// Phase 3 property set on real output: no stop outside its hours, no visit on a closed day, every leg matches the
// fixture travel table, days stay inside start/end (or warn), every candidate is scheduled or in a Later list with a
// reason, re-planning one day leaves the others byte-identical, and the plan maps to a valid brochure model.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadAll = async () => {
  const fixtures = await import('../packs/tour-guide/fixtures/index.mjs');
  const maps = await import('../kits/maps/index.mjs');
  const planner = await import('../packs/tour-guide/planner/index.mjs');
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
  const brochure = await import('../kits/brochure/index.mjs');
  return { fixtures, maps, planner, schemas, bm, brochure };
};
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const NOW = '2027-04-30T09:00:00Z';

async function planFixture(L, name, extra = {}) {
  const fx = L.fixtures.loadFixture(name);
  const ledger = L.maps.createLedger();
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger });
  const input = { ...fx, maps, build_id: `integ-${name}`, now: NOW, seed: 7, ...extra };
  const plan = await L.planner.planTrip(input);
  const snaps = Array.isArray(fx.snapshots) ? fx.snapshots : Object.values(fx.snapshots);
  const byId = new Map(fx.places.map((p) => [p.id, p]));
  for (const l of fx.trip.lodging) byId.set(l.id, l);
  const snapOf = (id) => snaps.find((s) => s.place_id === byId.get(id).place_id);
  return { fx, ledger, maps, input, plan, byId, snapOf };
}

test('both fixtures plan end to end: schemas, hours, closed days, legs, day bounds, Later reasons', async () => {
  const L = await loadAll();
  assert.deepEqual(L.fixtures.listFixtures(), ['transit-city', 'driving-loop', 'hill-town']);
  const names = ['transit-city', 'driving-loop']; // hill-town (Phase 10, no Google transit) has its own test: pack_tour-guide_planner_legs.test.js
  for (const name of names) {
    const { fx, ledger, plan, byId, snapOf } = await planFixture(L, name);
    const v = L.schemas.validate(plan, 'plan');
    assert.ok(v.ok, `${name}: plan validates: ${JSON.stringify(v.errors.slice(0, 3))}`);
    assert.equal(plan.days.length, L.planner.dateRange(fx.trip.start_date, fx.trip.end_date).length, `${name}: one DayPlan per trip date`);
    const dayStart = toMin(fx.trip.day_start), dayEnd = toMin(fx.trip.day_end);
    const scheduled = new Set();
    for (const day of plan.days) {
      assert.ok(L.schemas.validate(day, 'day-plan').ok, `${name} ${day.date}: day-plan validates`);
      assert.ok(day.stops.length >= 1, `${name} ${day.date}: at least one stop`);
      for (const s of day.stops) {
        assert.ok(!scheduled.has(s.place), `${name}: ${s.place} scheduled once`);
        scheduled.add(s.place);
        const h = L.planner.hoursOn(snapOf(s.place), day.date);
        assert.ok(!['closed', 'closed_business'].includes(h.status), `${name} ${day.date}: ${s.place} is not visited on a closed day (${h.status})`);
        if (h.windows.length) {
          const a = toMin(s.arrive), d = toMin(s.depart);
          assert.ok(h.windows.some((w) => a >= w.open && d <= w.close), `${name} ${day.date}: ${s.place} ${s.arrive}-${s.depart} sits inside an opening window`);
        } else assert.ok(day.warnings.some((w) => w.code === 'hours_unknown' && w.place === s.place), `${name}: unknown hours for ${s.place} are flagged`);
        assert.ok(toMin(s.arrive) >= dayStart && toMin(s.depart) <= dayEnd, `${name} ${day.date}: ${s.place} inside the day`);
        const booking = byId.get(s.place).booking;
        if (booking) { assert.equal(day.date, booking.date, `${name}: ${s.place} on its booked date`); assert.equal(s.arrive, booking.time, `${name}: ${s.place} at its booked time`); }
      }
      assert.equal(day.legs.length, day.stops.length + 1, `${name} ${day.date}: legs = stops + 1`);
      const pid = (ref, lodging) => byId.get(ref === 'lodging' ? lodging : ref).place_id;
      for (const leg of day.legs) {
        assert.equal(leg.estimated, undefined, `${name} ${day.date}: the fixture answers every pair, so no leg is a transit estimate`);
        if (leg.estimated) continue; // estimated TRANSIT legs (WP-3e) are checked against the estimate, not the table
        const want = L.fixtures.fixtureTravel(fx, day.mode, pid(leg.from, day.lodging_start), pid(leg.to, day.lodging_end));
        assert.ok(Math.abs(leg.minutes - want.durationSec / 60) <= 1, `${name} ${day.date}: leg ${leg.from}→${leg.to} ${leg.minutes} min matches the recorded ${want.durationSec}s`);
        assert.equal(leg.source, 'route'); assert.match(leg.maps_url, /^https:\/\/www\.google\.com\/maps\/dir\//);
      }
      const last = day.legs[day.legs.length - 1];
      if (toMin(last.arrive_at) > dayEnd) assert.ok(day.warnings.some((w) => w.code === 'over_long_day'), `${name} ${day.date}: a late return carries over_long_day`);
    }
    const laterIds = new Map();
    for (const list of plan.later) for (const it of list.items) { assert.ok(it.code && it.reason, `${name}: Later item ${it.place} has a code and a reason`); laterIds.set(it.place, it.code); }
    for (const p of fx.places) {
      if (p.status === 'rejected') continue;
      assert.ok(scheduled.has(p.id) !== laterIds.has(p.id), `${name}: ${p.id} is scheduled xor in a Later list`);
    }
    const u = ledger.usage().skus.find((s) => s.sku === 'routes.route_matrix.essentials');
    assert.equal(u && u.units, plan.usage.matrix_elements, `${name}: usage matches the ledger`);
    assert.ok(plan.budget.within_ceiling && plan.budget.skus['routes.route_matrix.essentials'] >= plan.usage.matrix_elements, `${name}: budget was an upper bound`);
  }
});

test('fixture edge cases land where the Phase 3 prompt expects', async () => {
  const L = await loadAll();
  const tc = await planFixture(L, 'transit-city');
  const later = (plan) => new Map(plan.later.flatMap((l) => l.items.map((it) => [it.place, it.code])));
  const where = (plan, id) => plan.days.find((d) => d.stops.some((s) => s.place === id));
  const tcL = later(tc.plan);
  assert.equal(tcL.get('moonlight-night-market'), 'outside_day', 'opens only after the day ends → Later, outside_day');
  assert.equal(tcL.get('tram-depot-gallery'), 'closed_business', 'CLOSED_TEMPORARILY → Later, closed_business');
  const archive = where(tc.plan, 'maritime-archive');
  assert.ok(archive, 'a place closed on one trip date is still scheduled on another');
  assert.notEqual(L.planner.hoursOn(tc.snapOf('maritime-archive'), archive.date).status, 'closed');
  const climb = where(tc.plan, 'clock-tower-climb');
  assert.equal(climb && climb.date, '2027-05-13', 'the timed booking pins its date');
  assert.equal(climb.stops.find((s) => s.place === 'clock-tower-climb').arrive, '11:00');
  const studio = where(tc.plan, 'bluebell-ceramics-studio');
  assert.ok(studio && studio.warnings.some((w) => w.code === 'hours_unknown'), 'unknown hours: scheduled with a warning');
  assert.ok(tc.plan.days.every((d) => d.mode === 'TRANSIT' && d.solver.cross_check.asked === false), 'transit days ask no optimizeWaypointOrder');
  assert.ok(tc.plan.days.every((d) => d.day_url === null), 'transit days carry no multi-stop day link');
  const dl = await planFixture(L, 'driving-loop');
  const dlL = later(dl.plan);
  assert.equal(dlL.get('northcape-sea-stacks'), 'too_far', 'a priority-3 place far from every lodging → too_far before any Maps call');
  for (const id of ['gullhaven-lighthouse', 'brackenford-harbour-market']) {
    const day = where(dl.plan, id);
    assert.ok(day, `${id} is scheduled on an open date`);
    assert.equal(L.planner.hoursOn(dl.snapOf(id), day.date).status, 'open');
  }
  assert.ok(dl.plan.days.some((d) => d.solver.cross_check.asked === true), 'driving days ask Google for a waypoint order');
  assert.ok(dl.plan.days.every((d) => typeof d.day_url === 'string' && d.day_url.includes('travelmode=driving')), 'driving days carry a day link');
  const dates = new Set(dl.plan.days.map((d) => d.date));
  assert.ok(dl.plan.days.every((d) => [d.lodging_start, d.lodging_end].every((id) => dl.fx.trip.lodging.some((l) => l.id === id))), 'each day starts and ends at a lodging of the trip');
  assert.equal(dates.size, 4);
});

test('deterministic, and re-planning one day leaves the others byte-identical', async () => {
  const L = await loadAll();
  const a = await planFixture(L, 'transit-city');
  const b = await planFixture(L, 'transit-city');
  assert.equal(JSON.stringify(a.plan), JSON.stringify(b.plan), 'same input + seed → identical plan');
  const mid = a.plan.days[1].date;
  const re = await L.planner.replanDays(a.plan, [mid], a.input);
  for (const d of re.days) if (d.date !== mid) assert.equal(JSON.stringify(d), JSON.stringify(a.plan.days.find((x) => x.date === d.date)), `${d.date} unchanged`);
  assert.ok(L.schemas.validate(re, 'plan').ok, 're-planned plan validates');
  assert.ok(re.usage.matrix_elements > a.plan.usage.matrix_elements, 'usage accumulates across re-plans');
  const est = await L.planner.estimateBudget(a.input);
  assert.ok(est.skus['routes.route_matrix.essentials'] >= a.plan.usage.matrix_elements, 'the pre-call estimate bounds real usage');
});

test('both plans map to a valid brochure model and render to HTML', async () => {
  const L = await loadAll();
  for (const name of L.fixtures.listFixtures()) {
    const { fx, plan } = await planFixture(L, name);
    const options = { generator: 'integration test', built_on: '2027-04-30', verified_on: plan.days[0].verified_on };
    const model = L.bm.toBrochureModel({ ...fx, plan, options });
    assert.deepEqual(L.brochure.validate(model), [], `${name}: brochure model passes the kit's validator`);
    const out = L.bm.renderPlan({ ...fx, plan, options });
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    assert.ok(out.html.includes(esc(fx.trip.title)), `${name}: HTML carries the trip title`);
    assert.ok(out.html.length > 50000 && /^<!doctype html>/i.test(out.html), `${name}: self-contained HTML document`);
    assert.deepEqual(out.warnings, [], `${name}: renders without warnings`);
    for (const day of plan.days) for (const s of day.stops) assert.ok(out.html.includes(esc(fx.places.find((p) => p.id === s.place).name)), `${name}: ${s.place} appears in the brochure`);
  }
});

// Developed by: LightAISolutions

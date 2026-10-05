'use strict';
// Tour Guide planner — Contract C18 (WP-18b) end to end on the invented moving-day fixture: with `c18: true` every
// free window of 30 minutes or more has a title, the options obey the rules against the fixture's own snapshots, the
// DayPlans still pass the day-plan schema and the chain check, a re-plan keeps them, and without `c18` the plan is the
// same plan minus exactly those fields (old outputs stay byte-identical).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadAll = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await import('../packs/tour-guide/planner/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs'),
  subset: await import('../kits/brochure/lib/validate.mjs'),
  geo: await import('../packs/tour-guide/planner/planner-geo.mjs')
});
const NOW = '2027-10-01T09:00:00Z';
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const mapsFor = (L, fx) => L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });
async function plan(L, extra = {}) {
  const fx = L.fixtures.loadFixture('moving-day');
  return { fx, plan: await L.planner.planTrip({ ...fx, maps: mapsFor(L, fx), build_id: 'c18-moving-day', now: NOW, seed: 7, ...extra }) };
}
const strip = (p) => { const c = JSON.parse(JSON.stringify(p)); for (const d of c.days) d.free = d.free.map(({ title, options, ...w }) => w); return c; };

test('planTrip with c18: titled windows, options within the rules, schema and chain still hold', async () => {
  const L = await loadAll();
  const { fx, plan: p } = await plan(L, { c18: true });
  const snaps = new Map(fx.snapshots.map((s) => [s.place_id, s]));
  const byId = new Map(p.places.map((x) => [x.id, x]));
  let titled = 0, offered = 0;
  for (const d of p.days) {
    assert.deepEqual(L.subset.validate(d, L.schemas.loadSchema('day-plan')), [], `${d.date}: the day-plan schema accepts it`);
    assert.deepEqual(L.planner.checkDayChain(d), [], `${d.date}: chain and timeline hold`);
    const seen = new Set();
    const onDay = new Set([...d.stops.map((s) => s.place), ...d.meals.map((m) => m.at)]);
    for (const w of d.free) {
      const len = toMin(w.end) - toMin(w.start);
      if (len >= 30) { assert.ok(w.title && w.title.length <= 60, `${d.date} ${w.start}: titled`); titled++; } else assert.equal(w.title, undefined);
      for (const o of w.options || []) {
        offered++;
        assert.ok(!seen.has(o.ref), `${o.ref} is offered once on ${d.date}`); seen.add(o.ref);
        assert.ok(!onDay.has(o.ref) && byId.get(o.ref).status !== 'scheduled' && byId.get(o.ref).status !== 'rejected');
        assert.ok(snaps.get(byId.get(o.ref).place_id), 'a place with a snapshot');
        assert.ok(o.km <= 1.2 && o.walk_min <= L.planner.freeWalkMinutes(1.2) && Math.abs(o.walk_min - L.planner.freeWalkMinutes(o.km)) <= 1, `${o.ref}: ${o.km} km, ${o.walk_min} min`);
        assert.ok(2 * o.walk_min + 20 <= len, 'the round trip fits');
        assert.ok(!(d.extras || []).some((x) => x.kind === 'saved' && x.ref === o.ref), 'not that evening\'s extra');
      }
      assert.ok(!w.options || w.options.length <= 4);
    }
  }
  assert.ok(titled >= 2, 'the fixture has titled windows');
  assert.ok(offered >= 1, 'the fixture offers at least one place');
});

test('without c18 the plan is the c18 plan minus title and options; c18 output is deterministic; a re-plan keeps them', async () => {
  const L = await loadAll();
  const a = (await plan(L, { c18: true })).plan, b = (await plan(L, { c18: true })).plan;
  assert.deepEqual(a, b, 'deterministic');
  const off = (await plan(L)).plan;
  assert.ok(off.days.every((d) => d.free.every((w) => !('title' in w) && !('options' in w))), 'nothing C18 without the flag');
  assert.deepEqual(strip(a), off, 'c18 only adds');
  const { fx } = await plan(L);
  const last = a.days[a.days.length - 1].date;
  const re = await L.planner.replanDays(a, [last], { ...fx, maps: mapsFor(L, fx), build_id: 'c18-moving-day-2', now: NOW, seed: 7, c18: true });
  const d = re.days.find((x) => x.date === last);
  for (const w of d.free) if (toMin(w.end) - toMin(w.start) >= 30) assert.ok(w.title, 'a re-planned day is titled again');
  for (const x of re.days.filter((y) => y.date !== last)) assert.deepEqual(x, a.days.find((y) => y.date === x.date), 'other days untouched');
});

// Developed by: LightAISolutions

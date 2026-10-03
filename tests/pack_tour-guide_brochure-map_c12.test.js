'use strict';
// packs/tour-guide/brochure-map — Contract C12 (WP-12d): a day the planner re-planned from where you are (WP-12a,
// invented fixture rehearsal-day) reaches the brochure: the visited stops pass through as done and stay first, a leg
// from the shared location reads "from where you were" with the planner's origin-less link, and the point's coordinates
// appear nowhere in the model or the HTML. A re-plan from a place has no `here`; the plan before the re-plan has
// neither field and gets no C12 markup. Offline: the fixture responder answers every Maps request.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const NOW = '2027-10-30T09:00:00Z';
const DATE = '2027-11-08';
let world;
async function load() {
  if (!world) world = (async () => {
    const F = await import('../packs/tour-guide/fixtures/index.mjs');
    const maps = await import('../kits/maps/index.mjs');
    const planner = await import('../packs/tour-guide/planner/index.mjs');
    const bm = await import('../packs/tour-guide/brochure-map/index.mjs');
    const kit = await import('../kits/brochure/index.mjs');
    const fx = F.loadFixture('rehearsal-day');
    const client = () => maps.createMapsClient({ transport: maps.createMockTransport(F.createFixtureResponder(fx)), ledger: maps.createLedger() });
    const input = { ...fx, build_id: 'c12-brochure', now: NOW, seed: 7 };
    const plan = await planner.planTrip({ ...input, maps: client() });
    const replan = (extra) => planner.replanDays(plan, [DATE], { ...input, places: plan.places, maps: client(), ...extra });
    return { fx, plan, replan, bm, kit };
  })();
  return world;
}
const args = (w, plan) => ({ trip: w.fx.trip, plan, places: plan.places, snapshots: w.fx.snapshots, notes: w.fx.notes, estimates: w.fx.estimates, options: { built_on: '2027-10-30' } });
const pointNear = (w, slug) => {
  const p = w.plan.places.find((x) => x.id === slug);
  const loc = w.fx.snapshots.find((s) => s.place_id === p.place_id).location;
  return { lat: Number((loc.lat + 0.00021).toFixed(6)), lng: Number((loc.lng - 0.00013).toFixed(6)) };
};

test('a re-plan from a shared location: visited first and done, "here" mapped, no coordinate of the point anywhere', async () => {
  const w = await load();
  const first = w.plan.days.find((d) => d.date === DATE).stops[0].place;
  const point = pointNear(w, first);
  const plan = await w.replan({ from: { time: '11:40', point }, visited: [first] });
  const dp = plan.days.find((d) => d.date === DATE);
  const model = w.bm.toBrochureModel(args(w, plan));
  assert.deepEqual(w.kit.validate(model), []);
  assert.deepEqual(w.kit.semanticErrors(model), []);
  const day = model.days.find((d) => d.date === DATE);
  assert.deepEqual(day.stops.map((s) => s.place), dp.stops.map((s) => s.place), 'stops stay in the plan\'s order');
  assert.deepEqual(day.stops.map((s) => s.visited === true), dp.stops.map((s, i) => i === 0));
  const here = day.legs.filter((l) => l.from === 'here');
  assert.equal(here.length, 1);
  assert.equal(here[0].maps_url, dp.legs.find((l) => l.from === 'here').maps_url);
  assert.doesNotMatch(here[0].maps_url, /origin/);
  assert.equal(here[0].depart_at, '11:40');
  const { html, warnings } = w.bm.renderPlan(args(w, plan), { embedFonts: false });
  assert.deepEqual(warnings, []);
  const row = html.split('<div class="ti ').find((r) => r.startsWith('ti-leg"') && r.includes('from where you were'));
  assert.ok(row, 'the leg reads "from where you were"');
  assert.match(html, /Re-planned at 11:40 from where you were/, 'the planner\'s note reaches the day\'s Mind block');
  assert.doesNotMatch(row, /origin=/);
  assert.match(html, /class="ti ti-stop ti-done"/);
  assert.equal((html.match(/class="ti ti-stop ti-done"/g) || []).length, 1);
  for (const v of [point.lat, point.lng]) for (const s of [String(v), v.toFixed(5), v.toFixed(4)]) {
    assert.ok(!JSON.stringify(model).includes(s), `${s} is not in the model`);
    assert.ok(!html.includes(s), `${s} is not in the HTML`);
  }
});

test('a re-plan from a place: visited stops done, no "here"; the plan before it renders without C12 markup', async () => {
  const w = await load();
  const before = w.plan.days.find((d) => d.date === DATE);
  const [a, b] = before.stops.map((s) => s.place);
  const plan = await w.replan({ from: { time: before.stops[1].depart, place: b }, visited: [a, b] });
  const day = w.bm.toBrochureModel(args(w, plan)).days.find((d) => d.date === DATE);
  assert.deepEqual(day.stops.slice(0, 2).map((s) => [s.place, s.visited]), [[a, true], [b, true]]);
  assert.ok(day.stops.slice(2).every((s) => s.visited === undefined));
  assert.ok(!day.legs.some((l) => l.from === 'here' || l.to === 'here'));
  const { html } = w.bm.renderPlan(args(w, plan), { embedFonts: false });
  assert.equal((html.match(/class="ti ti-stop ti-done"/g) || []).length, 2);
  assert.doesNotMatch(html, /where you were/);
  const old = w.bm.renderPlan(args(w, w.plan), { embedFonts: false }).html;
  assert.doesNotMatch(old, /ti-done|tag-done|isdone|where you were|\.ti-done/);
});

test('mapDay: a leg end "here" is never a coordinate and never a "to"; visited only as true', async () => {
  const { mapDay } = await import('../packs/tour-guide/brochure-map/brochure-map-days.mjs');
  const cards = { a: { name: 'A' }, b: { name: 'B' } };
  const dp = {
    date: '2027-11-08', lodging_start: 'inn', lodging_end: 'inn',
    stops: [{ place: 'a', arrive: '09:00', depart: '10:00', visited: true }, { place: 'b', arrive: '11:00', depart: '12:00', visited: 'yes' }],
    legs: [{ from: 'lodging', to: 'a', mode: 'WALK', minutes: 10, depart_at: '08:50', arrive_at: '09:00' }, { from: 'here', to: 'b', mode: 'WALK', minutes: 10, depart_at: '10:50', arrive_at: '11:00' }, { from: 'b', to: 'here', mode: 'WALK', minutes: 5 }],
    meals: [], free: [], warnings: []
  };
  const out = mapDay(dp, { placesBySlug: new Map(), cards, lodgingName: () => 'Inn' });
  assert.deepEqual(out.stops.map((s) => s.visited), [true, undefined]);
  assert.equal(out.legs[1].from, 'here');
  assert.equal(out.legs[2].to, undefined, 'never a leg end');
  assert.ok(!('lat' in out.legs[1]) && !('lng' in out.legs[1]));
  const withPlace = mapDay(dp, { placesBySlug: new Map(), cards: { ...cards, here: { name: 'Here Gallery' } }, lodgingName: () => 'Inn' });
  assert.equal(withPlace.legs[1].from, 'here', 'a card keyed "here" is that place');
});

// Developed by: LightAISolutions

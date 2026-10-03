'use strict';
// Tour Guide planner — Phase 12 (WP-12a, Contract C12): the morning fields (leave_by, areas) and the re-plan from where
// you are (replanDays with `from`, `visited`, `rain`) on the invented fixture rehearsal-day (and moving-day for a day with
// a bag step). Everything is offline: the fixture responder answers every Maps request.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const NOW = '2027-10-30T09:00:00Z';
const load = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await import('../packs/tour-guide/planner/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs')
});
const mapsFor = (M, fx, ledger) => M.maps.createMapsClient({ transport: M.maps.createMockTransport(M.fixtures.createFixtureResponder(fx)), ledger: ledger || M.maps.createLedger() });
const copy = (x) => JSON.parse(JSON.stringify(x));

/** Plan a fixture once; every test gets a fresh copy of the plan. */
const built = new Map();
async function planned(name) {
  if (!built.has(name)) {
    built.set(name, (async () => {
      const M = await load();
      const fx = M.fixtures.loadFixture(name);
      const input = { ...fx, build_id: `c12-${name}`, now: NOW, seed: 7 };
      const plan = await M.planner.planTrip({ ...input, maps: mapsFor(M, fx) });
      return { M, fx, input, plan };
    })());
  }
  const w = await built.get(name);
  return { ...w, plan: copy(w.plan) };
}
/** Re-plan one date of `w.plan` (the plan's own places, so kept days' dinners stay known). */
const replan = (w, date, extra = {}, ledger) => w.M.planner.replanDays(w.plan, [date], { ...w.input, places: w.plan.places, maps: mapsFor(w.M, w.fx, ledger), ...extra });
const dayOf = (plan, date) => plan.days.find((d) => d.date === date);
const snapOf = (w, slug) => w.fx.snapshots.find((s) => s.place_id === w.plan.places.find((p) => p.id === slug).place_id).location;
const COVERED = new Set(['quillmere-tide-museum', 'quillmere-weavers-hall', 'quillmere-glass-arcade', 'quillmere-noodle-counter']);

test('C12 fixture: the trip, its places and dinners validate; it is in no older fixture list', async () => {
  const w = await planned('rehearsal-day');
  const F = w.M.fixtures;
  assert.deepEqual([...F.C12_FIXTURE_NAMES], ['rehearsal-day']);
  for (const list of [F.listFixtures(), F.C11_FIXTURE_NAMES, F.JOURNEY_FIXTURE_NAMES]) assert.ok(!list.includes('rehearsal-day'));
  assert.ok(w.M.schemas.validate(w.fx.trip, 'trip').ok);
  assert.equal(w.fx.trip.country_code, 'ZZ');
  for (const p of [...w.fx.places, ...w.fx.dinners]) assert.deepEqual(w.M.schemas.validate(p, 'place').errors, [], p.id);
  assert.ok(w.fx.places.some((p) => p.facts && p.facts.local_name && p.facts.address && p.facts.access), 'a place with every new fact');
  assert.ok(w.fx.trip.lodging.every((l) => l.area && l.access), 'every lodging has an area and access');
});

test('leave_by is the first leg\'s departure on every day; areas: the morning town, then the night\'s on a moving day', async () => {
  const w = await planned('rehearsal-day');
  assert.deepEqual(w.M.schemas.validate(w.plan, 'plan').errors, []);
  for (const d of w.plan.days) {
    assert.ok(d.legs.length, d.date);
    assert.equal(d.leave_by, d.legs[0].depart_at, `${d.date}: leave_by`);
    assert.deepEqual(w.M.planner.checkDayChain(d), [], d.date);
  }
  assert.deepEqual(w.plan.days.map((d) => d.areas), [['Quillmere'], ['Quillmere', 'Tarnwick'], ['Tarnwick']]);
  const moving = dayOf(w.plan, '2027-11-09');
  assert.ok(moving.start, 'the moving day starts at the station (a day override)');
  assert.equal(moving.leave_by, moving.start.time, 'it leaves the station when the day starts there');
});

test('dayAreas / withMorning: no area → none; one town once; a start or end override changes nothing; no legs → no leave_by', async () => {
  const { dayAreas, withMorning, leaveBy } = await import('../packs/tour-guide/planner/index.mjs');
  const trip = { lodging: [{ id: 'inn-a', area: 'Quillmere' }, { id: 'inn-b', area: '  Quillmere ' }, { id: 'inn-c' }, { id: 'inn-d', area: 'Tarnwick' }] };
  const day = (a, b, extra = {}) => ({ lodging_start: a, lodging_end: b, legs: [{ depart_at: '08:50' }], ...extra });
  assert.deepEqual(dayAreas(trip, day('inn-a', 'inn-b')), ['Quillmere'], 'the same town once (trimmed)');
  assert.deepEqual(dayAreas(trip, day('inn-a', 'inn-d')), ['Quillmere', 'Tarnwick']);
  assert.deepEqual(dayAreas(trip, day('inn-c', 'inn-d')), ['Tarnwick'], 'a lodging without an area adds nothing');
  assert.equal(dayAreas(trip, day('inn-c', 'inn-c')), null);
  assert.deepEqual(dayAreas(trip, day('inn-a', 'inn-a', { start: { name: 'Far Station', time: '12:00' }, end: { name: 'Port', time: '17:00' } })), ['Quillmere']);
  const stale = withMorning(trip, { lodging_start: 'inn-c', lodging_end: 'inn-c', legs: [], leave_by: '09:00', areas: ['Old'] });
  assert.equal(stale.leave_by, undefined); assert.equal(stale.areas, undefined);
  assert.equal(leaveBy({ legs: [] }), null);
  assert.equal(withMorning(trip, day('inn-a', 'inn-d')).leave_by, '08:50');
});

test('an old fixture has leave_by but no areas (no lodging has an area)', async () => {
  const w = await planned('transit-city');
  for (const d of w.plan.days) { assert.equal(d.leave_by, d.legs.length ? d.legs[0].depart_at : undefined); assert.equal(d.areas, undefined); }
  assert.deepEqual(w.M.schemas.validate(w.plan, 'plan').errors, []);
});

/** The shared checks of a re-planned day: the visited part verbatim, the rest from `time`, nothing repeated, the chain whole. */
function checkRestart(w, re, date, visited, time, { prefix = true } = {}) {
  const old = dayOf(w.plan, date), d = dayOf(re, date);
  assert.deepEqual(w.M.schemas.validate(re, 'plan').errors, [], 'the re-planned plan validates');
  assert.deepEqual(w.M.planner.checkDayChain(d), [], 'the chain and timeline hold');
  for (const o of w.plan.days) if (o.date !== date) assert.deepEqual(dayOf(re, o.date), o, `${o.date} is untouched`);
  visited.forEach((slug, k) => {
    assert.deepEqual(d.stops[k], { ...old.stops.find((s) => s.place === slug), visited: true }, `${slug} is kept verbatim`);
  });
  const rest = d.stops.slice(visited.length);
  assert.ok(rest.every((s) => !s.visited && !visited.includes(s.place)), 'no visited place is planned again');
  assert.equal(new Set(d.stops.map((s) => s.place)).size, d.stops.length, 'no stop twice');
  const k = d.legs.findIndex((l) => l.to === visited[visited.length - 1]) + 1;
  if (prefix) assert.deepEqual(d.legs.slice(0, k), old.legs.slice(0, k), 'the legs up to the last visited stop are kept');
  assert.equal(d.legs[k].depart_at, time, 'the rest of the day leaves at the re-plan time');
  assert.equal(d.leave_by, old.leave_by, 'the morning departure is history');
  const dayEnd = toMin(w.fx.trip.day_end);
  for (const s of rest) assert.ok(toMin(s.depart) <= dayEnd, `${s.place} ends by the day's end`);
  return { old, d, rest };
}

test('a midday re-plan from a place: visited stops kept verbatim, the rest from that place at that time, dinner kept', async () => {
  const w = await planned('rehearsal-day');
  const date = '2027-11-08', first = dayOf(w.plan, date).stops[0].place;
  assert.equal(first, 'quillmere-reed-gardens');
  const re = await replan(w, date, { from: { time: '11:40', place: first }, visited: [first] });
  const { d, rest } = checkRestart(w, re, date, [first], '11:40');
  assert.equal(d.legs.find((l) => l.depart_at === '11:40').from, first);
  assert.ok(rest.length >= 3, 'the afternoon is planned');
  const dinner = d.meals.find((m) => m.kind === 'dinner');
  assert.ok(dinner && dinner.at === 'quillmere-kelp-kitchen', 'the evening keeps its dinner');
  assert.ok(d.meals.some((m) => m.kind === 'breakfast'), 'breakfast is history');
  assert.match(d.warnings[0].text, /^Re-planned at 11:40 from Quillmere Reed Gardens$/);
  assert.ok(d.day_url && !/origin=Quillmere%20Reed%20House/.test(d.day_url), 'the day link covers the rest of the day');
});

test('a re-plan from a shared location: "here" starts the rest, its coordinates reach no link and no field', async () => {
  const w = await planned('rehearsal-day');
  const date = '2027-11-08', first = 'quillmere-reed-gardens';
  const loc = snapOf(w, first);
  const point = { lat: Number((loc.lat + 0.00021).toFixed(6)), lng: Number((loc.lng - 0.00013).toFixed(6)) };   // ~25 m off
  const re = await replan(w, date, { from: { time: '11:40', point }, visited: [first] });
  const { d } = checkRestart(w, re, date, [first], '11:40');
  const here = d.legs.filter((l) => l.from === 'here');
  assert.equal(here.length, 1);
  assert.equal(here[0].depart_at, '11:40');
  assert.ok(!/origin=/.test(here[0].maps_url), 'the leg link starts at the viewer\'s own location');
  assert.ok(!d.day_url || !/origin=/.test(d.day_url), 'so does the day link');
  assert.ok(!d.stops.some((s) => s.place === 'here') && !d.legs.some((l) => l.to === 'here'));
  assert.match(d.warnings[0].text, /^Re-planned at 11:40 from where you were$/);
  const json = JSON.stringify(re);
  for (const v of [point.lat, point.lng]) for (const s of [String(v), v.toFixed(5), v.toFixed(4)]) assert.ok(!json.includes(s), `${s} is not in the plan`);
});

test('a re-plan starts no earlier than the visited stop\'s arrival; a stop not visited is a candidate again', async () => {
  const w = await planned('rehearsal-day');
  const date = '2027-11-08', old = dayOf(w.plan, date);
  const [a, b] = old.stops.map((s) => s.place);
  // From the first stop at a time before its planned end: the rest leaves then.
  const early = await replan(w, date, { from: { time: '10:30', place: a }, visited: [a] });
  checkRestart(w, early, date, [a], '10:30');
  // The second stop skipped, the third visited: one kept leg passes over it, and it is a candidate again.
  const c = old.stops[2].place, t = old.stops[2].depart;
  const skip = await replan(w, date, { from: { time: t, place: c }, visited: [a, c] });
  const { d, rest } = checkRestart(w, skip, date, [a, c], t, { prefix: false });
  const over = d.legs.find((l) => l.from === a);
  assert.equal(over.to, c);
  assert.equal(over.note, w.M.planner.PASSED_OVER_NOTE);
  assert.equal(over.depart_at, old.legs.find((l) => l.from === a).depart_at, 'it leaves when the old leg left');
  assert.equal(over.arrive_at, old.legs.find((l) => l.to === c).arrive_at, 'and arrives when the old leg arrived');
  const later = skip.later.flatMap((l) => l.items.map((i) => i.place));
  assert.ok(rest.some((s) => s.place === b) || later.includes(b), `${b} is planned again or said not to fit`);
  assert.ok(rest.length, 'the afternoon is planned');
  // visited given out of order is read in the day's order; an unknown slug is ignored, and says so.
  const loose = await replan(w, date, { from: { time: old.stops[2].arrive, place: b }, visited: [b, 'no-such-place', a] });
  checkRestart(w, loose, date, [a, b], old.stops[2].arrive);
  assert.ok(dayOf(loose, date).warnings.some((x) => /no-such-place/.test(x.text)));
});

test('rain: covered places and the indoor lunch first, outdoor ones only where nothing covered fits; no rain swaps', async () => {
  const w = await planned('rehearsal-day');
  const date = '2027-11-08', a = 'quillmere-reed-gardens';
  const ask = { from: { time: '11:11', place: a }, visited: [a] };
  const dry = await replan(w, date, ask);
  const wet = await replan(w, date, { ...ask, rain: true });
  const restOf = (p) => dayOf(p, date).stops.slice(1).map((s) => s.place);
  const dryRest = restOf(dry), wetRest = restOf(wet);
  checkRestart(w, wet, date, [a], '11:11');
  assert.ok(dryRest.some((x) => !COVERED.has(x)), `the dry afternoon has an outdoor stop (${dryRest})`);
  assert.ok(wetRest.length && wetRest.every((x) => COVERED.has(x)), `the rainy afternoon is all covered (${wetRest})`);
  assert.ok(wetRest.includes('quillmere-weavers-hall'), 'a covered place the dry day left out comes in');
  assert.ok(wetRest.includes('quillmere-noodle-counter') && !wetRest.includes('quillmere-pier-stalls'), 'the indoor lunch counter, not the open-air stalls');
  assert.ok(Array.isArray(dayOf(dry, date).rain_swaps), 'the dry re-plan still suggests swaps');
  assert.equal(dayOf(wet, date).rain_swaps, undefined, 'the rainy re-plan already is the swap');
  assert.match(dayOf(wet, date).warnings[0].text, /, covered places first$/);
  // Every covered candidate of the day is planned before any outdoor one would be.
  for (const slug of COVERED) assert.ok(wetRest.includes(slug), `${slug} is planned in the rain`);
});

test('rain: the dinner is indoors when an indoor place is free that evening', async () => {
  const w = await planned('rehearsal-day');
  const date = '2027-11-09', a = dayOf(w.plan, date).stops[0].place;
  const ask = { from: { time: '15:00', place: a }, visited: [a], places: w.fx.places };
  const dinnerOf = (p) => dayOf(p, date).meals.find((m) => m.kind === 'dinner').at;
  assert.equal(dinnerOf(w.plan), 'tarnwick-terrace-grill', 'the planned dinner is on the open-air terrace');
  const dry = await replan(w, date, ask), wet = await replan(w, date, { ...ask, rain: true });
  assert.equal(dinnerOf(dry), 'tarnwick-terrace-grill');
  assert.equal(dinnerOf(wet), 'tarnwick-cellar-soup', 'the indoor place comes first in the rain');
  for (const p of [dry, wet]) assert.deepEqual(w.M.planner.checkDayChain(dayOf(p, date)), []);
});

test('without `from` a re-plan is exactly what it was (visited and rain are ignored)', async () => {
  const w = await planned('rehearsal-day');
  for (const date of ['2027-11-08', '2027-11-09']) {
    const plain = await replan(w, date);
    const extra = await replan(w, date, { visited: [dayOf(w.plan, date).stops[0].place], rain: true });
    const nulled = await replan(w, date, { from: null, rain: true });
    assert.equal(JSON.stringify(extra), JSON.stringify(plain), date);
    assert.equal(JSON.stringify(nulled), JSON.stringify(plain), date);
  }
});

test('lateAgain: a place the day dropped for time is a candidate again for a re-plan of that day only', async () => {
  const w = await planned('rehearsal-day');
  const { lateAgain } = w.M.planner;
  const items = w.plan.later.flatMap((l) => l.items);
  const late = items.find((i) => i.code === 'day_full' && i.from_date === '2027-11-08');
  assert.ok(late, 'the fixture drops a place from its first day for time');
  assert.equal(w.plan.places.find((p) => p.id === late.place).status, 'saved-for-later');
  const again = lateAgain(w.plan, '2027-11-08', w.plan.places);
  assert.equal(again.find((p) => p.id === late.place).status, 'candidate');
  assert.equal(w.plan.places.find((p) => p.id === late.place).status, 'saved-for-later', 'the input is not changed');
  assert.equal(lateAgain(w.plan, '2027-11-10', w.plan.places), w.plan.places, 'another day: nothing to take back');
  assert.equal(lateAgain({ later: [] }, '2027-11-08', w.plan.places), w.plan.places);
});

test('a late re-plan: what no longer fits goes to Later with the re-plan named; the day still ends with dinner', async () => {
  const w = await planned('rehearsal-day');
  const date = '2027-11-08', a = 'quillmere-reed-gardens';
  for (const time of ['17:30', '17:59']) {
    const re = await replan(w, date, { from: { time, place: a }, visited: [a] });
    const { d, rest } = checkRestart(w, re, date, [a], time);
    assert.ok(rest.length <= 1, `${time}: at most one short stop (${rest.map((s) => s.place)})`);
    assert.equal(d.legs[d.legs.length - 1].to, 'lodging');
    assert.ok(d.meals.some((m) => m.kind === 'dinner'), `${time}: dinner is still planned`);
    const items = re.later.flatMap((l) => l.items);
    for (const s of dayOf(w.plan, date).stops.slice(1)) {
      if (rest.some((x) => x.place === s.place)) continue;
      const item = items.find((i) => i.place === s.place);
      assert.ok(item, `${s.place} is on the Later list`);
      assert.match(item.reason, new RegExp(`^re-planned at ${time}: `));
    }
  }
});

test('restartErrors: the C12 request bounds', async () => {
  const { restartErrors, RESTART } = await import('../packs/tour-guide/planner/index.mjs');
  const ok = (r) => assert.deepEqual(restartErrors(r), [], JSON.stringify(r));
  const bad = (r, path) => { const e = restartErrors(r); assert.ok(e.some((x) => x.path === path), `${JSON.stringify(r)} → ${path}: ${JSON.stringify(e)}`); };
  const slugs = (n) => Array.from({ length: n }, (_, i) => `stop-${i}`);
  ok({ from: { time: '00:00', place: 'tide-museum' } });
  ok({ from: { time: '23:59', point: { lat: -90, lng: 180 } }, visited: slugs(RESTART.MAX_VISITED), rain: true });
  ok({ from: { time: '12:00', point: { lat: 90, lng: -180 } }, visited: [] });
  bad({}, '/from');
  bad({ from: null }, '/from');
  bad({ from: { place: 'a-place' } }, '/from/time');
  bad({ from: { time: '24:00', place: 'a-place' } }, '/from/time');
  bad({ from: { time: '9:00', place: 'a-place' } }, '/from/time');
  bad({ from: { time: '12:00' } }, '/from');
  bad({ from: { time: '12:00', place: 'a-place', point: { lat: 1, lng: 1 } } }, '/from');
  bad({ from: { time: '12:00', place: 'here' } }, '/from/place');
  bad({ from: { time: '12:00', place: 'Not A Slug' } }, '/from/place');
  bad({ from: { time: '12:00', place: 'a-place', when: 'now' } }, '/from/when');
  bad({ from: { time: '12:00', point: { lat: 90.0001, lng: 0 } } }, '/from/point/lat');
  bad({ from: { time: '12:00', point: { lat: 0, lng: -180.5 } } }, '/from/point/lng');
  bad({ from: { time: '12:00', point: { lat: '1', lng: 0 } } }, '/from/point/lat');
  bad({ from: { time: '12:00', point: { lat: 1, lng: 2, alt: 3 } } }, '/from/point/alt');
  bad({ from: { time: '12:00', point: [1, 2] } }, '/from/point');
  bad({ from: { time: '12:00', place: 'a-place' }, visited: slugs(RESTART.MAX_VISITED + 1) }, '/visited');
  bad({ from: { time: '12:00', place: 'a-place' }, visited: 'a-place' }, '/visited');
  bad({ from: { time: '12:00', place: 'a-place' }, visited: ['a-place', 'a-place'] }, '/visited/1');
  bad({ from: { time: '12:00', place: 'a-place' }, visited: ['A Place'] }, '/visited/0');
  bad({ from: { time: '12:00', place: 'a-place' }, rain: false }, '/rain');
  bad({ from: { time: '12:00', place: 'a-place' }, rain: 'yes' }, '/rain');
});

test('replanDays refuses a restart it cannot honour, before any Maps request', async () => {
  const w = await planned('rehearsal-day');
  const date = '2027-11-08', [a, b] = dayOf(w.plan, date).stops.map((s) => s.place);
  const ledger = w.M.maps.createLedger();
  const refuse = (extra, re, dates = [date]) => assert.rejects(w.M.planner.replanDays(w.plan, dates, { ...w.input, places: w.plan.places, maps: mapsFor(w.M, w.fx, ledger), ...extra }), re);
  await refuse({ from: { time: '12:00', place: a }, visited: [a] }, /exactly one date/, ['2027-11-08', '2027-11-09']);
  await refuse({ from: { time: '12:00', place: 'tarnwick-heron-park' } }, /not a stop of 2027-11-08/);
  await refuse({ from: { time: '12:00', place: a }, visited: [a, b] }, /start from the last one/);
  await refuse({ from: { time: '18:00', place: a }, visited: [a] }, /too late to re-plan 2027-11-08 at 18:00/);
  await refuse({ from: { time: '12:00', place: 'here' } }, /reserved/);
  await refuse({ from: { time: '12:00', place: a }, rain: false }, /\/rain/);
  assert.ok(ledger.usage().skus.every((r) => r.requests === 0), 'nothing was sent');
});

test('checkDayChain (C12): "here" only where the re-plan restarts, never a stop or a destination; visited stops first', async () => {
  const w = await planned('rehearsal-day');
  const date = '2027-11-08', a = 'quillmere-reed-gardens', loc = snapOf(w, a);
  const re = await replan(w, date, { from: { time: '11:40', point: { lat: loc.lat + 0.0002, lng: loc.lng } }, visited: [a] });
  const d = dayOf(re, date);
  const { checkDayChain } = w.M.planner;
  assert.deepEqual(checkDayChain(d), []);
  const k = d.legs.findIndex((l) => l.from === 'here');
  const has = (x, path) => assert.ok(checkDayChain(x).some((e) => e.path === path), `${path}: ${JSON.stringify(checkDayChain(x))}`);
  let x = copy(d); x.legs[k + 1].from = 'here'; has(x, `/legs/${k + 1}/from`);
  x = copy(d); x.legs[k].to = 'here'; has(x, `/legs/${k}/to`);
  x = copy(d); x.stops[1].place = 'here'; has(x, '/stops/1/place');
  x = copy(d); delete x.stops[0].visited; x.stops[1].visited = true; has(x, '/stops/1/visited');
  // An ordinary day may not start at "here" after its first leg either.
  const plain = copy(dayOf(w.plan, date));
  plain.legs[1].from = 'here'; has(plain, '/legs/1/from');
  const first = copy(dayOf(w.plan, date)); first.legs[0].from = 'here';
  assert.ok(!checkDayChain(first).some((e) => e.path === '/legs/0/from'), 'the first leg may start at "here"');
});

test('a re-plan from where you are: every Maps unit it spends is in its budget and recorded in the plan usage', async () => {
  const w = await planned('rehearsal-day');
  const date = '2027-11-08', a = 'quillmere-reed-gardens', loc = snapOf(w, a);
  for (const from of [{ time: '11:40', place: a }, { time: '11:40', point: { lat: loc.lat + 0.0002, lng: loc.lng } }]) {
    const ledger = w.M.maps.createLedger();
    const re = await replan(w, date, { from, visited: [a], rain: true }, ledger);
    const units = Object.fromEntries(ledger.usage().skus.map((r) => [r.sku, r.units]));
    const { SKU } = w.M.planner;
    assert.ok(re.budget.within_ceiling);
    for (const sku of Object.values(SKU)) assert.ok((units[sku] || 0) <= (re.budget.skus[sku] || 0) - (w.plan.budget.skus[sku] || 0), `${sku}: ${units[sku]} spent within the budget`);
    assert.equal(units[SKU.matrix], re.usage.matrix_elements - w.plan.usage.matrix_elements, 'matrix elements recorded');
    assert.equal((units[SKU.routes] || 0) + (units[SKU.pro] || 0), re.usage.route_calls - w.plan.usage.route_calls, 'route requests recorded');
  }
});

test('moving-day: a re-plan of the bag-step day keeps the hotel step and validates', async () => {
  const w = await planned('moving-day');
  const date = '2027-10-19', old = dayOf(w.plan, date);
  assert.equal(old.bags.kind, 'hotel');
  const a = old.stops[0].place;
  const re = await replan(w, date, { from: { time: old.stops[0].depart, place: a }, visited: [a] });
  const { d } = checkRestart(w, re, date, [a], old.stops[0].depart);
  assert.equal(d.bags.kind, 'hotel');
  assert.deepEqual(d.legs[0], old.legs[0], 'the bag leg is history');
  assert.deepEqual(d.start, old.start, 'the day still started at the station');
});
// Developed by: LightAISolutions

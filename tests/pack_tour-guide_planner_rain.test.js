'use strict';
// Tour Guide planner — rainy-day swaps: indoor places off the plan, near a day's outdoor stops, open that date.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_planner_world.js');
const planner = () => import('../packs/tour-guide/planner/index.mjs');
const schemas = () => import('../packs/tour-guide/schemas/index.mjs');

async function setup() {
  const k = await import('../kits/maps/index.mjs');
  const maps = k.createMapsClient({ transport: k.createMockTransport(W.responder), ledger: k.createLedger({}) });
  const w = W.world();
  return { w, input: { ...w, maps, build_id: 'rain-build-1', now: '2027-06-01T12:00:00Z', seed: 7 } };
}
// The owner picks everything but the tile workshop, which stays a plain candidate the swaps may offer.
const picksBut = (w, ...out) => ({ picks: w.places.map((p) => p.id).filter((id) => !out.includes(id)), later: [], skip: [] });

test('isIndoor: the place flag wins, then the category, else unknown', async () => {
  const { isIndoor } = await planner();
  assert.equal(isIndoor({ category: 'park', indoor: true }), true);
  assert.equal(isIndoor({ category: 'museum', indoor: false }), false);
  assert.equal(isIndoor({ category: 'museum' }), true);
  assert.equal(isIndoor({ category: 'viewpoint' }), false);
  assert.equal(isIndoor({ category: 'market' }), null);
  assert.equal(isIndoor(null), null);
});

test('planTrip: a day with outdoor stops gets a nearby open indoor place; an all-indoor day gets none', async () => {
  const { w, input } = await setup();
  const { planTrip } = await planner();
  const plan = await planTrip({ ...input, choices: picksBut(w, 'tile-workshop') });
  const d2 = plan.days.find((d) => d.stops.some((s) => s.place === 'green-park'));
  assert.deepEqual(d2.rain_swaps.map((r) => r.place), ['tile-workshop']);
  assert.ok(plan.days.filter((d) => d !== d2).every((d) => !d.rain_swaps), 'offered on one day only');
  const r = d2.rain_swaps[0];
  assert.ok(d2.stops.some((s) => s.place === r.instead_of), 'instead_of is a stop of that day');
  assert.ok(['green-park', 'hill-viewpoint'].includes(r.instead_of), 'it replaces an outdoor stop');
  assert.ok(r.km >= 0 && r.km <= 5); assert.equal(r.hours, 'open'); assert.equal(r.place_id, 'FixtureMiniTiles10');
  for (const d of plan.days) for (const x of d.rain_swaps || []) assert.ok(!d.stops.some((s) => s.place === x.place));
  const { validate } = await schemas();
  const v = validate(plan, 'plan');
  assert.ok(v.ok, JSON.stringify(v.errors));
});

test('rain swaps never offer a skipped, closed, rejected, outdoor or scheduled place', async () => {
  const { w, input } = await setup();
  const { planTrip } = await planner();
  const skipped = await planTrip({ ...input, choices: { ...picksBut(w, 'tile-workshop'), skip: ['tile-workshop'] } });
  assert.ok(skipped.days.every((d) => !(d.rain_swaps || []).length), 'a skipped place is not offered');
  const plain = await planTrip(input);
  const offered = plain.days.flatMap((d) => (d.rain_swaps || []).map((r) => r.place));
  assert.ok(!offered.includes('shut-gallery'), 'closed for business');
  assert.ok(!offered.includes('far-lighthouse'), 'outdoor');
  const scheduled = new Set(plain.days.flatMap((d) => d.stops.map((s) => s.place)));
  assert.ok(offered.every((p) => !scheduled.has(p)));
  const places = w.places.map((p) => (p.id === 'tile-workshop' ? { ...p, status: 'rejected' } : p));
  const rejected = await planTrip({ ...input, places, choices: picksBut(w, 'tile-workshop') });
  assert.ok(rejected.days.every((d) => !(d.rain_swaps || []).length), 'a rejected place is not offered');
});

test('rainSwaps: reach depends on the mode, nearest first, at most two, each offered once', async () => {
  const { rainSwaps, SWAP_KM } = await planner();
  const snap = (id, lat, lng) => [id, { place_id: id, location: { lat, lng }, content: { business_status: 'OPERATIONAL', hours: null } }];
  const snapshots = new Map([snap('PidPark0001', 40, -70), snap('PidMuseA001', 40.001, -70), snap('PidMuseB001', 40.002, -70), snap('PidMuseC001', 40.003, -70), snap('PidMuseF001', 40.15, -70)]);
  const P = (id, place_id, category) => ({ v: 1, id, place_id, name: id, category, tags: [], status: 'candidate', activity: 'visit', priority: 2 });
  const places = [P('park', 'PidPark0001', 'park'), P('mus-a', 'PidMuseA001', 'museum'), P('mus-b', 'PidMuseB001', 'museum'), P('mus-c', 'PidMuseC001', 'gallery'), P('mus-far', 'PidMuseF001', 'museum')];
  const day = { date: '2027-06-08', mode: 'TRANSIT', stops: [{ place: 'park', place_id: 'PidPark0001' }] };
  const used = new Set();
  const a = rainSwaps({ day, places, snapshots, used });
  assert.deepEqual(a.map((r) => r.place), ['mus-a', 'mus-b']);
  assert.equal(a[0].hours, 'unknown');
  assert.deepEqual(rainSwaps({ day, places, snapshots, used }).map((r) => r.place), ['mus-c'], 'already offered places are skipped');
  assert.ok(SWAP_KM.WALK < SWAP_KM.TRANSIT && SWAP_KM.TRANSIT < SWAP_KM.DRIVE);
  assert.deepEqual(rainSwaps({ day: { ...day, mode: 'DRIVE' }, places, snapshots, exclude: new Set(['mus-a', 'mus-b', 'mus-c']) }).map((r) => r.place), ['mus-far'], 'about 17 km is in reach by car only');
  assert.deepEqual(rainSwaps({ day: { ...day, stops: [{ place: 'mus-a', place_id: 'PidMuseA001' }] }, places, snapshots }), [], 'no outdoor stop, no swaps');
});

test('replanDays: a kept day keeps its swaps; the re-planned day gets fresh ones', async () => {
  const { w, input } = await setup();
  const { planTrip, replanDays } = await planner();
  const choices = picksBut(w, 'tile-workshop');
  const plan = await planTrip({ ...input, choices });
  const kept = plan.days.find((d) => d.rain_swaps), other = plan.days.find((d) => d !== kept);
  const plan2 = await replanDays(plan, [other.date], { ...input, places: plan.places, build_id: 'rain-build-2' });
  assert.deepEqual(plan2.days.find((d) => d.date === kept.date), kept, 'the kept day is byte-identical');
  const plan3 = await replanDays(plan, [kept.date], { ...input, places: plan.places, build_id: 'rain-build-3' });
  assert.deepEqual(plan3.days.find((d) => d.date === kept.date).rain_swaps.map((r) => r.place), ['tile-workshop']);
  const { validate } = await schemas();
  for (const p of [plan2, plan3]) { const v = validate(p, 'plan'); assert.ok(v.ok, JSON.stringify(v.errors)); }
});

test('plan checks: a rain swap must be a known, unscheduled place offered once, next to a stop of its day', async () => {
  const { w, input } = await setup();
  const { planTrip } = await planner();
  const { validate } = await schemas();
  const plan = await planTrip({ ...input, choices: picksBut(w, 'tile-workshop') });
  const i = plan.days.findIndex((d) => d.rain_swaps);
  const bad = JSON.parse(JSON.stringify(plan));
  const stop = bad.days[i].stops[0].place;
  bad.days[i].rain_swaps.push({ ...bad.days[i].rain_swaps[0], place: stop, instead_of: 'nowhere-here' });
  const msgs = validate(bad, 'plan').errors.map((e) => e.message).join('\n');
  assert.match(msgs, new RegExp(`"${stop}" is a rain swap but is scheduled`));
  assert.match(msgs, /"nowhere-here" is not a stop of/);
});

test('rain swaps follow a place\'s own facts: a weekday its own site says it is closed, it is not offered', async () => {
  const { w, input } = await setup();
  const { planTrip } = await planner();
  const plain = await planTrip({ ...input, choices: picksBut(w, 'tile-workshop') });
  const d = plain.days.find((x) => (x.rain_swaps || []).some((r) => r.place === 'tile-workshop'));
  const weekday = new Date(d.date + 'T12:00:00Z').getUTCDay();
  const facts = { checked: '2027-05-30', sources: [{ url: 'https://tile-workshop.example.com/hours', title: 'Hours (invented)', accessed: '2027-05-30' }], closed_weekdays: [weekday] };
  const places = w.places.map((p) => (p.id === 'tile-workshop' ? { ...p, facts } : p));
  const shut = await planTrip({ ...input, places, choices: picksBut(w, 'tile-workshop') });
  assert.ok(!(shut.days.find((x) => x.date === d.date).rain_swaps || []).some((r) => r.place === 'tile-workshop'), 'not on the weekday its own site closes it');
  const other = { ...facts, closed_weekdays: [(weekday + 1) % 7] };
  const open = await planTrip({ ...input, places: w.places.map((p) => (p.id === 'tile-workshop' ? { ...p, facts: other } : p)), choices: picksBut(w, 'tile-workshop') });
  assert.deepEqual(open.days.find((x) => x.date === d.date).rain_swaps.map((r) => r.place), ['tile-workshop'], 'another closed weekday changes nothing');
});

// Developed by: LightAISolutions

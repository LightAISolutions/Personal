'use strict';
// packs/tour-guide/brochure-map — Contract C18 wave 1 (WP-18b): with options.c18 the day carries fixed marks, field
// tips, a checklist, a prep countdown, the way out and the planner's free-window options; clock and temp go on the trip
// only when given; without c18 every model is byte-identical to before. Invented data only (brochure-map-sample-c18.mjs).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = async () => ({
  bm: await import('../packs/tour-guide/brochure-map/index.mjs'),
  kit: await import('../kits/brochure/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs'),
  ...(await import('../packs/tour-guide/brochure-map/brochure-map-sample.mjs')),
  ...(await import('../packs/tour-guide/brochure-map/brochure-map-sample-c11.mjs')),
  ...(await import('../packs/tour-guide/brochure-map/brochure-map-sample-c18.mjs'))
});
const C18_KEYS = new Set(['fixed', 'tip', 'checklist', 'prep', 'departure', 'title', 'options']);
const C18_TRIP = new Set(['clock', 'temp']);   // the trip already has a title
/** Every C18 key path in a brochure model (trip, days, stops, meals, free, start, end). */
function c18Paths(m) {
  const out = [];
  const look = (o, p, keys = C18_KEYS) => { for (const k of Object.keys(o || {})) if (keys.has(k)) out.push(p + '/' + k); };
  look(m.trip, '/trip', C18_TRIP);
  (m.days || []).forEach((d, i) => {
    const p = `/days/${i}`;
    look(d, p); look(d.start, p + '/start'); look(d.end, p + '/end');
    (d.stops || []).forEach((s, j) => look(s, `${p}/stops/${j}`));
    (d.meals || []).forEach((s, j) => look(s, `${p}/meals/${j}`));
    (d.free || []).forEach((s, j) => look(s, `${p}/free/${j}`));
  });
  return out;
}
/** The model with every C18 key removed (what the same input gives without c18). */
function withoutC18(m) {
  const c = JSON.parse(JSON.stringify(m));
  const drop = (o, keys = C18_KEYS) => { if (o) for (const k of keys) delete o[k]; };
  drop(c.trip, C18_TRIP);
  for (const d of c.days) { drop(d); drop(d.start); drop(d.end); for (const x of [...(d.stops || []), ...(d.meals || []), ...(d.free || [])]) drop(x); }
  return c;
}
const without = (input, keys = ['c18', 'clock', 'temp']) => { const o = { ...input.options }; for (const k of keys) delete o[k]; return { ...input, options: o }; };

test('the C18 sample is a valid trip; fallbacks need the day\'s end', async () => {
  const { schemas, sampleInputC11, sampleInputC18 } = await load();
  // the C11 sample's season carries its own findings on purpose, and the semantic checks only run on a schema-clean
  // trip; so: C18 adds no schema finding, and the checks are exercised on the trip without its season
  assert.deepEqual(schemas.validate(sampleInputC18().trip, 'trip').errors, schemas.validate(sampleInputC11().trip, 'trip').errors);
  const trip = sampleInputC18().trip;
  delete trip.season;
  const paths = (t) => schemas.validate(t, 'trip').errors.map((e) => e.path);
  assert.deepEqual(paths(trip), []);
  const bad = structuredClone(trip);
  bad.day_overrides[0].fallbacks = ['Next train 10:10'];
  assert.deepEqual(paths(bad), ['/day_overrides/0/fallbacks']);
  const long = structuredClone(trip);
  long.day_overrides[1].fallbacks = ['a', 'b', 'c', 'd', 'e'];
  assert.ok(paths(long).some((p) => p.startsWith('/day_overrides/1/fallbacks')), 'at most 4');
});

test('without c18 nothing changes: no C18 key in any model, and the sample HTML is the one before Phase 18', async () => {
  const { bm, sampleInput, sampleInputC11, sampleInputC18 } = await load();
  for (const input of [sampleInput(), sampleInputC11(), without(sampleInputC18())]) assert.deepEqual(c18Paths(bm.toBrochureModel(input)), []);
  // c18 only adds: the C18 model minus its C18 keys is the model without c18, byte for byte.
  const on = bm.toBrochureModel(sampleInputC18()), off = bm.toBrochureModel(without(sampleInputC18()));
  assert.equal(JSON.stringify(withoutC18(on)), JSON.stringify(off));
  // c18: false and a non-boolean are off
  for (const v of [false, 'true', 1]) assert.deepEqual(c18Paths(bm.toBrochureModel({ ...sampleInputC18(), options: { ...sampleInputC18().options, c18: v } })), []);
});

test('clock and temp go on the trip only when given and valid; times inside the texts follow the clock', async () => {
  const { bm, sampleInputC18 } = await load();
  const m0 = bm.toBrochureModel(sampleInputC18());
  assert.equal(m0.trip.clock, undefined); assert.equal(m0.trip.temp, undefined);
  const m1 = bm.toBrochureModel({ ...sampleInputC18(), options: { ...sampleInputC18().options, clock: '24h', temp: 'both' } });
  assert.equal(m1.trip.clock, '24h'); assert.equal(m1.trip.temp, 'both');
  assert.equal(m1.days[1].checklist.must[0], '17:30 Departure — Harrowmere Central Station');
  assert.deepEqual(m1.days[1].departure.fallbacks, ['Next train 18:10 from platform 2', 'Last coach 19:40 from the bus station forecourt']);
  assert.equal(m1.days[0].free[0].options[1].open, 'open until 16:00');
  const m2 = bm.toBrochureModel({ ...sampleInputC18(), options: { ...sampleInputC18().options, clock: '12h', temp: 'f' } });
  assert.equal(m2.trip.clock, '12h'); assert.equal(m2.trip.temp, 'f');
  assert.equal(m2.days[1].checklist.must[0], '5:30 pm Departure — Harrowmere Central Station');
  const m3 = bm.toBrochureModel({ ...sampleInputC18(), options: { ...sampleInputC18().options, clock: '25h', temp: 'k' } });
  assert.equal(m3.trip.clock, undefined); assert.equal(m3.trip.temp, undefined);
  // without c18 the display settings still pass (they are explicit options), and nothing else C18 appears
  const m4 = bm.toBrochureModel({ ...without(sampleInputC18()), options: { ...without(sampleInputC18()).options, clock: '24h' } });
  assert.deepEqual(c18Paths(m4), ['/trip/clock']);
});

test('fixed: a booked stop, a booked dinner, the real start and end; nothing else', async () => {
  const { bm, sampleInputC18 } = await load();
  const [d1, d2] = bm.toBrochureModel(sampleInputC18()).days;
  assert.equal(d1.start.fixed, true);
  assert.deepEqual(d1.stops.map((s) => s.fixed), [true, undefined]);
  assert.deepEqual(d1.meals.map((m) => [m.kind, m.fixed]), [['lunch', undefined], ['dinner', true]]);
  assert.equal(d2.end.fixed, true);
  assert.deepEqual(d2.stops.map((s) => s.fixed), [undefined]);
  assert.deepEqual(d2.meals.map((m) => m.fixed), [undefined], 'breakfast at the lodging slides');
  // a dinner whose record is only to book is not fixed
  const input = sampleInputC18();
  input.trip.bookings[1].status = 'todo';
  assert.equal(bm.toBrochureModel(input).days[0].meals[1].fixed, undefined);
});

test('tip: payment then gate from the place facts; a meal at one of the day\'s stops leaves it to the stop', async () => {
  const { bm, sampleInputC18 } = await load();
  const [d1, d2] = bm.toBrochureModel(sampleInputC18()).days;
  assert.deepEqual(d1.stops.map((s) => s.tip), ['Card only · Enter by Quarry Gate, on Ropewalk', 'Cash only · Enter by the east arcade gate']);
  assert.deepEqual(d1.meals.map((m) => m.tip), [undefined, 'Card or cash']);
  assert.equal(d2.stops[0].tip, undefined, 'no facts, no tip');
  assert.equal(bm.tipOf({ gate_name: 'Use the river door' }), 'Use the river door');
  assert.equal(bm.tipOf({ checked: '2027-01-01' }), undefined);
  assert.equal(bm.takesCashOnly({ payment: 'Cash at most stalls' }), true);
  assert.equal(bm.takesCashOnly({ payment: 'Card or cash' }), false);
});

test('checklist: fixed items in time order, what to carry, the limits of the day', async () => {
  const { bm, sampleInputC18 } = await load();
  const [d1, d2] = bm.toBrochureModel(sampleInputC18()).days;
  assert.deepEqual(d1.checklist, {
    must: ['8:55 am Arrive at Harrowmere Central Station', '10:00 am Timed entry — Slate Museum', '7:00 pm Table booked — Juniper Table'],
    carry: ['Slate Museum timed entry — QR code in the confirmation e-mail', 'Cash', 'Transit card, topped up', 'Leave your bags at Quayside Rooms'],
    constraints: ['Diet: vegetarian', 'Last entry 4:30 pm at Slate Museum']
  });
  assert.deepEqual(d2.checklist, {
    must: ['5:30 pm Departure — Harrowmere Central Station'],
    carry: ['Transit card, topped up', 'Check out by 11:00 am and carry your bags to the train'],
    constraints: ['Diet: vegetarian', 'Lark Hill: The hill path closes in high wind; check the board at 8:30 am']
  });
});

test('checklist: a booked stop without a ticket record carries its reference; empty groups and empty checklists go', async () => {
  const { bm, sampleInputC18 } = await load();
  const input = sampleInputC18();
  input.trip.bookings = [];
  delete input.options.diet;
  const [d1, d2] = bm.toBrochureModel(input).days;
  assert.equal(d1.checklist.carry[0], 'Slate Museum booking ref FX-1001');
  assert.equal(d1.meals[1].fixed, undefined, 'no record, no fixed dinner');
  assert.deepEqual(d1.checklist.constraints, ['Last entry 4:30 pm at Slate Museum']);
  // a day with nothing to say has no checklist: WALK, no booking, no facts, no bags, no override, no diet
  const bare = sampleInputC18();
  bare.trip.bookings = []; delete bare.options.diet; bare.trip.day_overrides = [bare.trip.day_overrides[0]];
  const p2 = bare.plan.days[1];
  delete p2.end; delete p2.bags; p2.stops[0] = { ...p2.stops[0], check_on_day: undefined, last_entry: undefined }; p2.legs = p2.legs.filter((l) => l.to !== 'day-end');
  const m = bm.toBrochureModel(bare).days[1];
  assert.equal(m.checklist, undefined);
  assert.equal(m.departure, undefined);
  assert.ok(d2.checklist);
});

test('checklist caps: must 6, carry 8, constraints 6', async () => {
  const { bm, sampleInputC18 } = await load();
  const input = sampleInputC18();
  const d1 = input.plan.days[0];
  input.trip.bookings.push(...Array.from({ length: 9 }, (_, i) => ({ id: `extra-${i}`, title: `Extra ticket ${i}`, kind: 'other', rule: 'fixture', status: 'booked', for_date: d1.date })));
  input.plan.days[0].stops = d1.stops.map((s) => ({ ...s, booked: 'booked', check_on_day: 'Check the board', last_entry: '16:00' }));
  input.plan.days[0].stops.push(...['lark-hill', 'fennel-park', 'ember-hall'].map((place, i) => ({ place, place_id: `FixtureCap${i}000001`, arrive: `15:0${i}`, depart: `15:3${i}`, minutes: 30, activity: 'x', window: null, confidence: 'unverified', booked: 'booked', check_on_day: 'Check the board', last_entry: '16:00' })));
  input.plan.days[0].extras = [];
  input.plan.days[0].free = [];
  input.plan.days[1].stops = [];   // lark-hill is now on day 1
  input.plan.later = [];
  const m = bm.toBrochureModel(input).days[0];
  assert.equal(m.checklist.must.length, 6);
  assert.equal(m.checklist.carry.length, 8);
  assert.equal(m.checklist.constraints.length, 6);
});

test('prep: only when the day leaves the lodging or has breakfast; wake from the earlier rule, steps in time order', async () => {
  const { bm, sampleInputC18 } = await load();
  assert.deepEqual({ ...bm.PREP }, { READY_MIN: 75, BREAKFAST_LEAD: 45, NEXT_WITHIN: 180 });
  const [d1, d2] = bm.toBrochureModel(sampleInputC18()).days;
  assert.equal(d1.prep, undefined, 'day 1 starts at the station with no breakfast');
  assert.deepEqual(d2.prep, {
    night_before: ['Set an alarm for 7:15 am', 'Pack tonight — Check out by 11:00 am and carry your bags to the train'],
    steps: [
      { time: '07:15', text: 'Wake up' }, { time: '08:00', text: 'Breakfast at Quayside Rooms' },
      { time: '09:00', text: 'Leave Quayside Rooms for Lark Hill (Walk 30 min)' }
    ]
  });
  // no breakfast: wake 75 min before leaving; tickets of the day are made ready the night before
  const input = sampleInputC18();
  input.plan.days[1].meals = [];
  input.trip.bookings.push({ id: 'hill-pass', title: 'Hill path pass', kind: 'experience', rule: 'fixture', status: 'booked', for_date: '2027-05-14', how: 'printed' });
  const p = bm.toBrochureModel(input).days[1].prep;
  assert.deepEqual(p.steps[0], { time: '07:45', text: 'Wake up' });
  assert.deepEqual(p.night_before.slice(0, 2), ['Set an alarm for 7:45 am', 'Have ready: Hill path pass']);
  for (let i = 1; i < p.steps.length; i++) assert.ok(p.steps[i - 1].time <= p.steps[i].time);
});

test('departure: the planned leg and the latest safe one, with the fallbacks; latest safe only when 10 min or more apart', async () => {
  const { bm, sampleInputC11, sampleInputC18 } = await load();
  const d2 = bm.toBrochureModel(sampleInputC18()).days[1];
  assert.deepEqual(d2.departure, {
    to: 'Harrowmere Central Station', at: '17:30', by: '16:30',
    scenarios: [
      { label: 'As planned', steps: ['Leave Quayside Rooms at 4:30 pm', 'Tram 5, 20 min', 'Arrive at Harrowmere Central Station 4:50 pm'], spare_min: 40 },
      { label: 'Latest safe', steps: ['Leave Quayside Rooms by 4:55 pm', 'Tram 5, 20 min', 'Arrive at Harrowmere Central Station 5:15 pm'], spare_min: 15 }
    ],
    fallbacks: ['Next train 6:10 pm from platform 2', 'Last coach 7:40 pm from the bus station forecourt']
  });
  // the C11 sample leaves at 16:50: latest safe would be 16:55, only 5 min apart — one scenario, no fallbacks
  const c11 = sampleInputC11();
  c11.options.c18 = true;
  const dep = bm.toBrochureModel(c11).days[1].departure;
  assert.deepEqual(dep.scenarios.map((s) => [s.label, s.spare_min]), [['As planned', 20]]);
  assert.equal(dep.fallbacks, undefined);
  assert.equal(bm.toBrochureModel(sampleInputC18()).days[0].departure, undefined, 'day 1 does not end at a departure');
  // an estimated leg says so
  const est = sampleInputC18();
  Object.assign(est.plan.days[1].legs[est.plan.days[1].legs.length - 1], { estimated: true });
  assert.match(bm.toBrochureModel(est).days[1].departure.note, /estimate/);
});

test('free: the planner\'s title and options; a card when there is one, else a Maps link; scheduled places never offered', async () => {
  const { bm, sampleInputC18 } = await load();
  const [d1, d2] = bm.toBrochureModel(sampleInputC18()).days;
  assert.deepEqual(d1.free, [{
    start: '14:15', end: '18:45', note: 'Rest, or wander the old quay.', title: 'Free time near Quayside Rooms',
    options: [
      { name: 'Weaver Gallery', km: 0.2, walk_min: 3, open: 'open until 7:00 pm', note: 'Tapestry rooms upstairs.', url: 'https://www.google.com/maps/search/?api=1&query=Weaver%20Gallery&query_place_id=FixtureWeaverGallery1' },
      { name: 'Ember Hall', place: 'ember-hall', km: 0.3, walk_min: 5, open: 'open until 4:00 pm' }
    ]
  }]);
  assert.deepEqual(d2.free, [{ start: '11:00', end: '16:30', title: 'Before you leave for Harrowmere Central Station' }]);
  const input = sampleInputC18();
  input.plan.days[1].stops.push({ place: 'weaver-gallery', place_id: 'FixtureWeaverGallery1', arrive: '11:30', depart: '12:30', minutes: 60, activity: 'tapestry rooms', window: null, confidence: 'unverified' });
  input.places.find((p) => p.id === 'weaver-gallery').status = 'scheduled';
  assert.deepEqual(bm.toBrochureModel(input).days[0].free[0].options.map((o) => o.name), ['Ember Hall'], 'scheduled on day 2 (a journey mix)');
});

test('the input is never mutated', async () => {
  const { bm, sampleInputC18 } = await load();
  const input = sampleInputC18();
  const before = JSON.stringify(input);
  bm.toBrochureModel(input);
  assert.equal(JSON.stringify(input), before);
});

test('the C18 model validates against the brochure kit schema (WP-18a)', async (t) => {
  const { bm, kit, sampleInputC18 } = await load();
  const model = bm.toBrochureModel({ ...sampleInputC18(), options: { ...sampleInputC18().options, clock: '24h', temp: 'both' } });
  const errs = kit.validate(model);
  if (errs.some((e) => e.message === 'unknown field')) { t.skip('needs WP-18a schema'); return; }
  assert.deepEqual(errs, []);
  assert.deepEqual(kit.semanticErrors(model), []);
  const { warnings } = bm.renderPlan({ ...sampleInputC18(), options: { ...sampleInputC18().options, clock: '24h', temp: 'both' } }, { embedFonts: false });
  assert.deepEqual(warnings, []);
});

// Developed by: LightAISolutions

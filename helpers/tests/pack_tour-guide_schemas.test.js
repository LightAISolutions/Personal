'use strict';
// packs/tour-guide/schemas — one JSON Schema per entity in the brochure validator's 2020-12 subset, plus semantic
// checks: pointer paths, lodging per night, the DayPlan timeline and the Plan's "scheduled or in a Later list" rule.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = () => import('../packs/tour-guide/schemas/index.mjs');
const F = () => import('../packs/tour-guide/fixtures/index.mjs');
const clone = (x) => JSON.parse(JSON.stringify(x));

const SUBSET = new Set(['$schema', '$id', 'title', 'description', '$comment', 'type', 'const', 'enum', 'properties', 'required', 'additionalProperties',
  'propertyNames', 'maxProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'anyOf', '$ref', '$defs']);
function walkSchema(node, path, out) {
  if (Array.isArray(node)) { node.forEach((x, i) => walkSchema(x, `${path}/${i}`, out)); return; }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (!SUBSET.has(k)) out.push(`${path}: keyword ${k}`);
    if (k === '$ref' && !/^#\/\$defs\/[A-Za-z0-9_]+$/.test(v)) out.push(`${path}: $ref ${v}`);
    if (k === 'properties' || k === '$defs') for (const [pk, pv] of Object.entries(v)) walkSchema(pv, `${path}/${k}/${pk}`, out);
    else if (['items', 'additionalProperties', 'propertyNames'].includes(k) && typeof v === 'object') walkSchema(v, `${path}/${k}`, out);
    else if (k === 'anyOf') v.forEach((x, i) => walkSchema(x, `${path}/anyOf/${i}`, out));
  }
}

function dayPlan() {
  return {
    v: 1, trip_id: 'port-sorrel-spring-2027', date: '2027-05-12', build_id: 'b1', mode: 'TRANSIT', lodging_start: 'harbour-lane-guesthouse', lodging_end: 'harbour-lane-guesthouse',
    stops: [
      { place: 'lantern-museum', place_id: 'FixtureTcLanternMuseum', arrive: '10:00', depart: '12:00', minutes: 120, activity: 'museum highlights', window: { open: '10:00', close: '18:00' }, confidence: 'confirmed' },
      { place: 'moonlight-night-market', place_id: 'FixtureTcMoonlightNightMarket', arrive: '22:30', depart: '00:15', minutes: 105, activity: 'evening street food', window: { open: '18:30', close: '01:00' }, confidence: 'confirmed' }
    ],
    legs: [
      { from: 'lodging', to: 'lantern-museum', mode: 'TRANSIT', depart_at: '09:50', arrive_at: '09:58', minutes: 8, distance_m: 600, source: 'route', maps_url: 'https://www.google.com/maps/dir/?api=1' },
      { from: 'lantern-museum', to: 'moonlight-night-market', mode: 'TRANSIT', depart_at: '12:00', arrive_at: '12:12', minutes: 12, distance_m: 1500, source: 'route', maps_url: 'https://www.google.com/maps/dir/?api=1', line: 'Line 2' },
      { from: 'moonlight-night-market', to: 'lodging', mode: 'WALK', depart_at: '00:15', arrive_at: '00:25', minutes: 10, distance_m: 700, source: 'matrix', maps_url: 'https://www.google.com/maps/dir/?api=1' }
    ],
    meals: [{ kind: 'lunch', start: '12:15', end: '13:00', at: 'saffron-row-market' }],
    free: [{ start: '13:00', end: '22:00', note: 'Free afternoon' }],
    warnings: [{ severity: 'warn', code: 'over_long_day', text: 'Late evening at the night market.', place: 'moonlight-night-market' }],
    day_url: null, verified_on: '2027-05-01',
    solver: { method: 'test', matrix_elements: 4, route_calls: 3, cross_check: null, seed: 1 }
  };
}

test('every kind has a schema file in the validator subset (only #/$defs refs) and listKinds() names them', async () => {
  const s = await S();
  assert.deepEqual(s.listKinds(), ['trip', 'place', 'google-snapshot', 'visit-estimate', 'place-note', 'calibration', 'day-plan', 'later-list', 'plan', 'profile-excerpt']);
  for (const kind of s.listKinds()) {
    const schema = s.loadSchema(kind);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', kind);
    assert.equal(schema.$id, `tour-guide-${kind}.schema.json`);
    const bad = [];
    walkSchema(schema, '', bad);
    assert.deepEqual(bad, [], kind);
    assert.equal(schema.additionalProperties, false, `${kind}: unknown keys are refused`);
  }
  assert.throws(() => s.validate({}, 'nope'), /unknown kind "nope"/);
});

test('trip: schema errors carry pointer paths; semantic checks catch nights, length and modes', async () => {
  const s = await S(), f = await F();
  const trip = f.loadFixture('driving-loop').trip;
  assert.deepEqual(s.validate(trip, 'trip'), { ok: true, errors: [] });
  const bad = clone(trip);
  bad.day_start = '9am'; bad.extra = 1; bad.lodging[0].lat = 'north';
  const r = s.validate(bad, 'trip');
  assert.equal(r.ok, false);
  const paths = r.errors.map((e) => e.path);
  assert.ok(paths.includes('/day_start') && paths.includes('/extra') && paths.includes('/lodging/0/lat'), JSON.stringify(r.errors));
  const gap = clone(trip); gap.lodging[1].from = '2027-06-11'; gap.lodging[1].to = '2027-06-11';
  assert.ok(s.validate(gap, 'trip').errors.some((e) => /no lodging covers the night of 2027-06-10/.test(e.message)));
  const dup = clone(trip); dup.lodging[2].from = '2027-06-10';
  assert.ok(s.validate(dup, 'trip').errors.some((e) => /2 lodgings cover the night of 2027-06-10/.test(e.message)));
  const long = clone(trip); long.end_date = '2027-07-15';
  assert.ok(s.validate(long, 'trip').errors.some((e) => e.path === '/end_date' && /at most 31/.test(e.message)));
  const mode = clone(trip); mode.modes.default = 'TRANSIT';
  assert.ok(s.validate(mode, 'trip').errors.some((e) => e.path === '/modes/default'));
  const cal = clone(trip); cal.start_date = '2027-02-30';
  assert.ok(s.validate(cal, 'trip').errors.some((e) => e.path === '/start_date' && /calendar/.test(e.message)));
  const tz = clone(trip); tz.timezone = 'Mars/Olympus_Mons';
  assert.ok(s.validate(tz, 'trip').errors.some((e) => e.path === '/timezone'));
});

test('night rule: [from, to) per night, the last date may belong to the lodging checked out that day', async () => {
  const s = await S();
  const trip = { start_date: '2027-01-01', end_date: '2027-01-03', lodging: [{ id: 'a', from: '2027-01-01', to: '2027-01-03' }] };
  assert.equal(s.lodgingForNight(trip, '2027-01-02').id, 'a');
  assert.equal(s.lodgingForNight(trip, '2027-01-03').id, 'a', 'checked out on the last day');
  assert.deepEqual(s.dayLodgings(trip, '2027-01-01'), { start: trip.lodging[0], end: trip.lodging[0] });
  assert.equal(s.weekdayOf('2027-05-13'), 4, 'Thursday is Google day 4');
});

test('place: no Google content allowed; booking and scheduled_hint are typed', async () => {
  const s = await S(), f = await F();
  const p = f.loadFixture('transit-city').places.find((x) => x.booking);
  assert.ok(s.validate(p, 'place').ok);
  assert.deepEqual(s.validate({ ...p, hours: [] }, 'place').errors, [{ path: '/hours', message: 'unknown field' }]);
  assert.ok(!s.validate({ ...p, booking: { date: '2027-05-13', time: '11:00:00' } }, 'place').ok);
  assert.ok(s.validate({ ...p, scheduled_hint: { date: '2027-05-14' } }, 'place').ok);
  assert.ok(!s.validate({ ...p, priority: 4 }, 'place').ok);
});

test('google-snapshot: exactly the Maps kit toSnapshot() shape, before and after a purge', async () => {
  const s = await S();
  const maps = await import('../kits/maps/index.mjs');
  const snap = maps.toSnapshot(maps.fixture('place-details-enterprise'), { buildId: 'b-1', fetchedAt: '2027-05-01T10:00:00Z' });
  assert.deepEqual(s.validate(snap, 'google-snapshot').errors, []);
  const store = maps.openSnapshotStore();
  store.put(clone(snap));
  store.purge({ now: '2027-05-02T10:00:00Z' });
  assert.deepEqual(s.validate(store.all()[0], 'google-snapshot').errors, [], 'content purged, content_purged_at stamped');
  const six = clone(snap); six.content.hours.weekday_descriptions.pop();
  assert.ok(s.validate(six, 'google-snapshot').errors.some((e) => /7 weekday lines/.test(e.message)));
  const day = clone(snap); day.content.hours.periods[0].open.day = 7;
  assert.ok(!s.validate(day, 'google-snapshot').ok);
});

test('day-plan: legs chain lodging → stops → lodging, windows hold, a night stop may run past midnight', async () => {
  const s = await S();
  assert.deepEqual(s.validate(dayPlan(), 'day-plan').errors, []);
  const chain = dayPlan(); chain.legs[1].to = 'signal-hill-lookout';
  assert.ok(s.validate(chain, 'day-plan').errors.some((e) => e.path === '/legs/1/to'));
  const early = dayPlan(); early.stops[0].arrive = '09:58'; early.stops[0].minutes = 100;
  assert.ok(s.validate(early, 'day-plan').errors.some((e) => e.path === '/stops/0/arrive' && /before it opens/.test(e.message)));
  const late = dayPlan(); late.stops[1].depart = '01:30'; late.legs[2].depart_at = '01:30'; late.legs[2].arrive_at = '01:40';
  assert.ok(s.validate(late, 'day-plan').errors.some((e) => e.path === '/stops/1/depart' && /after it closes/.test(e.message)));
  const count = dayPlan(); count.legs.pop();
  assert.ok(s.validate(count, 'day-plan').errors.some((e) => e.path === '/legs' && /expected 3 legs/.test(e.message)));
  const mins = dayPlan(); mins.legs[0].minutes = 20;
  assert.ok(s.validate(mins, 'day-plan').errors.some((e) => e.path === '/legs/0/minutes'));
  const order = dayPlan(); order.legs[1].depart_at = '11:50';
  assert.ok(s.validate(order, 'day-plan').errors.some((e) => e.path === '/legs/1' && /before the previous item ends/.test(e.message)));
  const code = dayPlan(); code.warnings[0].code = 'rain';
  assert.ok(s.validate(code, 'day-plan').errors.some((e) => e.path === '/warnings/0/code'));
  const empty = dayPlan(); empty.stops = []; empty.legs = [];
  assert.ok(s.validate(empty, 'day-plan').ok, 'a day without stops');
});

test('plan: parts validated with prefixed paths; every place scheduled or in exactly one Later list', async () => {
  const s = await S(), f = await F();
  const L = await import('../packs/tour-guide/later/index.mjs');
  const fx = f.loadFixture('transit-city');
  const day = dayPlan();
  const scheduled = new Set(day.stops.map((x) => x.place));
  let later = L.createLists(fx.trip.id);
  const places = fx.places.map((p) => ({ ...p, status: scheduled.has(p.id) ? 'scheduled' : 'saved-for-later' }));
  for (const p of places) if (!scheduled.has(p.id)) later = L.addItem(later, { place: p.id, place_id: p.place_id, reason: 'Did not fit.', code: 'day_full', added_on: '2027-05-01' });
  const plan = { v: 1, build_id: 'b1', trip_id: fx.trip.id, built_on: '2027-05-01', days: [day], later, places,
    budget: { skus: { 'routes.route_matrix.essentials': 4 }, usd_estimate: 0, within_ceiling: true }, usage: { matrix_elements: 4, route_calls: 3 } };
  assert.deepEqual(s.validate(plan, 'plan').errors, []);
  const both = clone(plan); both.later[0].items[0].place = 'lantern-museum';
  assert.ok(s.validate(both, 'plan').errors.some((e) => /both scheduled and in a Later list/.test(e.message)));
  const lost = clone(plan); lost.later[0].items.shift();
  assert.ok(s.validate(lost, 'plan').errors.some((e) => /neither scheduled nor in a Later list/.test(e.message)));
  const twice = clone(plan); twice.later[1].items.push(clone(twice.later[0].items[0]));
  assert.ok(s.validate(twice, 'plan').errors.some((e) => /already in another Later list/.test(e.message)));
  const part = clone(plan); part.days[0].stops[0].arrive = '25:00';
  assert.ok(s.validate(part, 'plan').errors.some((e) => e.path === '/days/0/stops/0/arrive'));
  const status = clone(plan); status.places.find((p) => p.id === 'lantern-museum').status = 'candidate';
  assert.ok(s.validate(status, 'plan').errors.some((e) => /status must be "scheduled"/.test(e.message)));
  const rejected = clone(lost); rejected.places.find((p) => p.id === plan.later[0].items[0].place).status = 'rejected';
  assert.ok(s.validate(rejected, 'plan').ok, 'a rejected place needs no list');
});

test('estimate, note, later-list, calibration and profile excerpt reject unknown keys and bad values', async () => {
  const s = await S(), f = await F();
  const fx = f.loadFixture('driving-loop');
  assert.ok(!s.validate({ ...fx.estimates[0], range: { min: 90, max: 60 } }, 'visit-estimate').ok);
  assert.ok(!s.validate({ ...fx.estimates[0], confidence: 'likely' }, 'visit-estimate').ok);
  assert.ok(!s.validate({ ...fx.notes[0], rating: 5 }, 'place-note').ok);
  assert.ok(!s.validate({ v: 1, trip_id: 't', name: 'x', items: [{ place: 'a', place_id: 'FixtureAaaaaa', reason: 'r', code: 'weather', added_on: '2027-01-01' }] }, 'later-list').ok);
  assert.ok(!s.validate({ v: 1, categories: { museum: { longer: 2, shorter: 0, about_right: 0, factor: 1 } } }, 'calibration').ok, 'factor must follow the counts');
  assert.ok(s.validate({ v: 1, categories: { museum: { longer: 2, shorter: 0, about_right: 3, factor: 1.2 } } }, 'calibration').ok);
  assert.ok(!s.validate({ ...fx.profile, interests: { museum: 'very' } }, 'profile-excerpt').ok);
  assert.throws(() => s.assertValid({ v: 2 }, 'place-note'), /place-note is invalid/);
});

// Developed by: LightAISolutions

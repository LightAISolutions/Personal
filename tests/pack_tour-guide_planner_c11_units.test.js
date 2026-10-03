'use strict';
// Tour Guide planner — Phase 11 (WP-11a) units: sunset against published references on both hemispheres and against an
// independent algorithm, country defaults, the own-hours conflict line, facts hours, crowd slots, day overrides, the
// dinner booking line, "running that evening", the generalised chain check, and that the old fixtures plan byte for byte
// as they did before Phase 11.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const P = () => import('../packs/tour-guide/planner/index.mjs');
const E = () => import('../packs/tour-guide/estimator/index.mjs');
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/**
 * Published sunset times (local clock time, to the minute), both hemispheres and both solstices. Source: the
 * timeanddate.com sun tables for each city and date (values as published there; recorded in
 * helpers/decisions/WP-11a.md — no network call is made by this test).
 */
const SUNSET_REFERENCES = [
  { place: 'London', date: '2021-06-21', lat: 51.5074, lng: -0.1278, tz: 'Europe/London', sunset: '21:21' },
  { place: 'London', date: '2021-12-21', lat: 51.5074, lng: -0.1278, tz: 'Europe/London', sunset: '15:53' },
  { place: 'Sydney', date: '2021-12-21', lat: -33.8688, lng: 151.2093, tz: 'Australia/Sydney', sunset: '20:05' },
  { place: 'Sydney', date: '2021-06-21', lat: -33.8688, lng: 151.2093, tz: 'Australia/Sydney', sunset: '16:53' },
  { place: 'Tokyo', date: '2021-06-21', lat: 35.6762, lng: 139.6503, tz: 'Asia/Tokyo', sunset: '19:00' },
  { place: 'Tokyo', date: '2021-12-21', lat: 35.6762, lng: 139.6503, tz: 'Asia/Tokyo', sunset: '16:32' },
  { place: 'Ushuaia', date: '2021-12-21', lat: -54.8019, lng: -68.303, tz: 'America/Argentina/Ushuaia', sunset: '22:10' }
];

test('sunset: within 2 minutes of published references on both hemispheres; none in the midnight sun', async () => {
  const { sunsetLocal } = await P();
  for (const r of SUNSET_REFERENCES) {
    const got = sunsetLocal(r.date, r.lat, r.lng, r.tz);
    assert.ok(Math.abs(toMin(got) - toMin(r.sunset)) <= 2, `${r.place} ${r.date}: ${got} vs published ${r.sunset}`);
  }
  assert.equal(sunsetLocal('2021-06-21', 69.6492, 18.9553, 'Europe/Oslo'), null, 'Tromsø in June: the sun does not set');
  assert.equal(sunsetLocal('2021-12-21', 69.6492, 18.9553, 'Europe/Oslo'), null, 'Tromsø in December: the sun does not rise');
});

/** An independent sunset algorithm: the US Naval Observatory's "Almanac for Computers" (1990) sunrise/sunset method. */
function almanacSunsetUtc(date, lat, lng) {
  const r = (d) => (d * Math.PI) / 180, dg = (x) => (x * 180) / Math.PI, n360 = (x) => ((x % 360) + 360) % 360;
  const [y, m, d] = date.split('-').map(Number);
  const N = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 864e5);
  const lh = lng / 15, t = N + (18 - lh) / 24, M = 0.9856 * t - 3.289;
  const L = n360(M + 1.916 * Math.sin(r(M)) + 0.020 * Math.sin(r(2 * M)) + 282.634);
  let RA = n360(dg(Math.atan(0.91764 * Math.tan(r(L)))));
  RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15;
  const sd = 0.39782 * Math.sin(r(L)), cd = Math.cos(Math.asin(sd));
  const ch = (Math.cos(r(90.833)) - sd * Math.sin(r(lat))) / (cd * Math.cos(r(lat)));
  if (ch > 1 || ch < -1) return null;
  const T = dg(Math.acos(ch)) / 15 + RA - 0.06571 * t - 6.622;
  return ((((T - lh) % 24) + 24) % 24) * 60;
}

test('sunset: agrees with an independent algorithm within 2 minutes across latitudes, longitudes and seasons', async () => {
  const { sunsetUtcMinutes } = await P();
  let worst = 0, n = 0;
  for (const lat of [-55, -40, -33.9, -20, 0, 15, 35, 51.5, 60]) for (const lng of [-120, -45, 0, 18.4, 139.7, 151.2, 175]) {
    for (const date of ['2027-01-15', '2027-03-20', '2027-05-01', '2027-06-21', '2027-08-10', '2027-09-23', '2027-11-05', '2027-12-21']) {
      const a = almanacSunsetUtc(date, lat, lng), b = sunsetUtcMinutes(date, lat, lng);
      assert.equal(a === null, b === null, `${lat},${lng} ${date}: both agree whether the sun sets`);
      if (a === null) continue;
      let diff = Math.abs((((b % 1440) + 1440) % 1440) - a);
      diff = Math.min(diff, 1440 - diff);
      worst = Math.max(worst, diff); n++;
      assert.ok(diff <= 2, `${lat},${lng} ${date}: ${diff.toFixed(2)} min apart`);
    }
  }
  assert.ok(n > 400 && worst <= 2);
});

test('estimator: country defaults apply only in that country, and never over a researched estimate', async () => {
  const { chooseMinutes, categoryDefault, countryCode } = await E();
  assert.equal(countryCode('Japan'), 'JP'); assert.equal(countryCode('jp'), 'JP'); assert.equal(countryCode('Fictional Isles'), null);
  for (const [category, jp] of [['temple', 60], ['shrine', 40], ['garden', 75]]) {
    assert.equal(chooseMinutes({ category, country: 'Japan' }).minutes, jp, `${category} in Japan`);
    assert.equal(chooseMinutes({ category, country: 'JP' }).minutes, jp);
    assert.equal(chooseMinutes({ category, country: 'France' }).minutes, categoryDefault(category), `${category} elsewhere: the generic default`);
    assert.equal(chooseMinutes({ category }).minutes, categoryDefault(category), `${category} with no country: as before`);
  }
  assert.equal(chooseMinutes({ category: 'museum', country: 'Japan' }).minutes, categoryDefault('museum'), 'a category Japan does not override');
  assert.equal(chooseMinutes({ category: 'temple', country: 'Japan', typical: 90 }).minutes, 90, 'a researched length wins');
  assert.equal(chooseMinutes({ category: 'temple', country: 'Japan', range: { min: 20, max: 40 } }).minutes, 30);
  const tea = chooseMinutes({ category: 'experience', activity: 'tea ceremony in the garden room', country: 'Japan' });
  assert.equal(tea.minutes, 45); assert.equal(tea.fixed, true);
  assert.notEqual(chooseMinutes({ category: 'experience', activity: 'tea ceremony in the garden room', country: 'France' }).minutes, 45);
  const kaiseki = chooseMinutes({ category: 'restaurant', activity: 'kaiseki dinner', country: 'Japan' });
  assert.equal(kaiseki.minutes, 120); assert.equal(kaiseki.fixed, true);
  assert.equal(chooseMinutes({ category: 'restaurant', activity: 'kaiseki dinner' }).minutes, categoryDefault('restaurant'));
  // The return shape is unchanged (old callers compare it whole).
  assert.deepEqual(Object.keys(chooseMinutes({ category: 'temple', country: 'Japan' })).sort(), ['confidence', 'factors', 'max', 'min', 'minutes']);
});

test('ownHoursConflict: the kinds and the 15-minute tolerance of WP-11b\'s factsConflict, one line ≤ 200', async () => {
  const { ownHoursConflict, placeFacts, CLOSE_TOLERANCE_MINUTES } = await P();
  const facts = (f) => placeFacts({ facts: { checked: '2027-09-28', sources: [], ...f } });
  const open = (o, c) => ({ status: 'open', windows: [{ open: toMin(o), close: toMin(c) }] });
  const MON = '2027-10-18';
  assert.equal(CLOSE_TOLERANCE_MINUTES, 15);
  assert.equal(ownHoursConflict(facts({ close: '17:15' }), open('09:00', '17:00'), MON, 'X'), null, '15 min apart: the same time');
  assert.equal(ownHoursConflict(facts({ close: '16:00' }), open('09:00', '17:00'), MON, 'X'), 'X: its own site says it closes at 16:00; Google says 17:00. Planned on its own hours');
  assert.match(ownHoursConflict(facts({ closed_weekdays: [1] }), open('09:00', '17:00'), MON, 'X'), /closed on Mondays; Google shows it open/);
  assert.match(ownHoursConflict(facts({ closed_weekdays: [2] }), { status: 'closed', windows: [] }, MON, 'X'), /Google shows it closed on Mondays; its own site does not/);
  assert.match(ownHoursConflict(facts({ last_entry: '17:00' }), open('09:00', '17:00'), MON, 'X'), /last entry at 17:00, after Google's closing time/);
  assert.equal(ownHoursConflict(facts({ last_entry: '16:30' }), open('09:00', '17:00'), MON, 'X'), null);
  assert.equal(ownHoursConflict(facts({ close: '12:00' }), { status: 'unknown', windows: [] }, MON, 'X'), null, 'unknown hours never conflict');
  assert.ok(ownHoursConflict(facts({ close: '12:00', last_entry: '18:00' }), open('09:00', '17:00'), MON, 'N'.repeat(190)).length <= 200);
});

test('factsHours: own close and last entry bound the windows, closed weekdays close the day, unknown hours get bounds', async () => {
  const { factsHours, placeFacts, earliestFit } = await P();
  const facts = (f) => placeFacts({ facts: { checked: '2027-09-28', sources: [], ...f } });
  const g = { status: 'open', windows: [{ open: 540, close: 1020 }] };
  const r = factsHours(g, facts({ close: '16:00', last_entry: '15:30' }), '2027-10-18', null, 'T');
  assert.deepEqual(r.hours.windows, [{ open: 540, close: 960, last: 930 }]);
  assert.ok(r.conflict);
  assert.deepEqual(g.windows, [{ open: 540, close: 1020 }], 'the input is not mutated');
  assert.equal(earliestFit(r.hours.windows, 940, 20, 1440), null, 'nothing may start after the last entry');
  assert.equal(earliestFit(r.hours.windows, 920, 20, 1440).start, 920);
  assert.equal(factsHours(g, facts({ closed_weekdays: [1] }), '2027-10-18', null).hours.status, 'closed');
  assert.equal(factsHours(g, facts({ closed_weekdays: [1] }), '2027-10-19', null).hours, g, 'another weekday: Google\'s hours as they were');
  const u = factsHours({ status: 'unknown', windows: [] }, facts({ close: '16:00' }), '2027-10-18', null).hours;
  assert.equal(u.status, 'unknown'); assert.deepEqual(u.bounds, [{ open: 0, close: 960 }]);
  assert.equal(factsHours(g, null, '2027-10-18', null).hours, g, 'no facts: unchanged');
});

test('crowd helpers: the profile rule, the opening and late slots, and which slot a start sits in', async () => {
  const { avoidsCrowds, crowdWindows, crowdSlotOf } = await P();
  for (const a of ['peak-hour crowds', 'crowded places', 'peak hours', 'rush hour', 'long queues', 'tour groups', 'mass tourism', 'busy times']) assert.equal(avoidsCrowds({ avoid: [a] }), true, a);
  for (const a of ['long hikes', 'spicy food', 'early mornings']) assert.equal(avoidsCrowds({ avoid: [a] }), false, a);
  assert.equal(avoidsCrowds({}), false); assert.equal(avoidsCrowds(null), false);
  assert.deepEqual(crowdWindows([{ open: 540, close: 1020 }]), [{ open: 540, close: 1020, last: 600, slot: 'opening' }, { open: 930, close: 1020, slot: 'late' }]);
  assert.deepEqual(crowdWindows([{ open: 540, close: 960, last: 930 }]).map((w) => [w.slot, w.open, w.last]), [['opening', 540, 600], ['late', 870, 930]]);
  const w = [{ open: 540, close: 1020 }];
  assert.equal(crowdSlotOf(560, w), 'opening'); assert.equal(crowdSlotOf(960, w), 'late'); assert.equal(crowdSlotOf(720, w), null); assert.equal(crowdSlotOf(500, w), null);
});

test('overrideFor and bagsText: well-formed parts only, the reserved slugs, the bag lines', async () => {
  const { overrideFor, bagsText } = await P();
  const trip = { day_overrides: [
    { date: '2027-10-19', day_start: '08:30', day_end: '19:00', start: { name: ' Ashvale Station ', lat: 34.4, lng: 160.5, time: '12:10' }, end: { name: 'No time', lat: 1, lng: 1 }, bags: 'hotel', bags_note: 'x'.repeat(200), note: 'Train day' },
    { date: '2027-10-20', bags: 'suitcase', day_start: '25:00' }
  ] };
  const o = overrideFor(trip, '2027-10-19');
  assert.deepEqual(o.start, { id: 'day-start', slug: 'day-start', name: 'Ashvale Station', placeId: null, lat: 34.4, lng: 160.5, time: 730 });
  assert.equal(o.end, undefined, 'an end without a time is ignored');
  assert.equal(o.day_start, 510); assert.equal(o.day_end, 1140); assert.equal(o.bags, 'hotel'); assert.equal(o.bags_note.length, 160); assert.equal(o.note, 'Train day');
  assert.equal(overrideFor(trip, '2027-10-20'), null, 'nothing usable');
  assert.equal(overrideFor(trip, '2027-10-21'), null); assert.equal(overrideFor({}, '2027-10-21'), null);
  assert.equal(bagsText('hotel', { lodging: 'Inn' }), 'Leave your bags at Inn before the first sight');
  assert.equal(bagsText('locker', { start: 'Station' }), 'Bags in a locker at Station; collect them on the way out');
  assert.equal(bagsText('forward', { lodging: 'Inn', note: 'by courier' }), 'Bags sent ahead to Inn · by courier');
  assert.equal(bagsText('carry'), 'Carry your bags today');
  assert.ok(bagsText('carry', { note: 'y'.repeat(300) }).length <= 160);
});

test('dinnerBooking and runsThatEvening', async () => {
  const { dinnerBooking, runsThatEvening } = await P();
  const trip = { bookings: [{ id: 'b1', title: 'Dinner', kind: 'meal', rule: 'opens 30 days ahead', status: 'todo', place: 'p1', for_date: '2027-10-19', how: 'online', party_min: 2 }, { id: 'b2', title: 'Dinner', kind: 'meal', rule: 'r', status: 'booked', place: 'p1', for_date: '2027-10-20' }] };
  assert.equal(dinnerBooking(trip, '2027-10-19', 'p1', null), 'To book: opens 30 days ahead · online · from 2 people');
  assert.equal(dinnerBooking(trip, '2027-10-20', 'p1', { booking: { text: 'ignored' } }), 'Booked');
  assert.equal(dinnerBooking(trip, '2027-10-21', 'p1', { booking: { text: 'Walk-ins welcome' } }), 'Walk-ins welcome');
  assert.equal(dinnerBooking({}, '2027-10-21', 'p1', { booking: { required: true, lead: '2 days ahead', how: 'by phone', party_min: 4 } }), 'Booking required · 2 days ahead · by phone · from 4 people');
  assert.equal(dinnerBooking({}, '2027-10-21', 'p1', { booking: { required: false } }), 'No booking needed');
  assert.equal(dinnerBooking({}, '2027-10-21', 'p1', { booking: {} }), null);
  assert.equal(dinnerBooking({}, '2027-10-21', 'p1', null), null);
  const ev = (x) => ({ id: 'e', name: 'E', kind: 'festival', from: '2027-10-18', to: '2027-10-20', ...x });
  assert.equal(runsThatEvening(ev({ start: '18:00', end: '21:00' }), '2027-10-19'), true);
  assert.equal(runsThatEvening(ev({ start: '10:00', end: '15:00' }), '2027-10-19'), false, 'a daytime event');
  assert.equal(runsThatEvening(ev({ start: '22:00', end: '01:00' }), '2027-10-19'), true, 'past midnight');
  assert.equal(runsThatEvening(ev({ start: '16:30' }), '2027-10-19'), true);
  assert.equal(runsThatEvening(ev({ kind: 'light_up' }), '2027-10-19'), true, 'a light-up with no times');
  assert.equal(runsThatEvening(ev({}), '2027-10-19'), false);
  assert.equal(runsThatEvening(ev({ start: '18:00', end: '21:00' }), '2027-10-21'), false, 'outside its dates');
  assert.equal(runsThatEvening(ev({ kind: 'closure', start: '18:00', end: '21:00' }), '2027-10-19'), false);
  assert.equal(runsThatEvening(ev({ kind: 'holiday' }), '2027-10-19'), false);
});

const loadPlanning = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await P(),
  schemas: await import('../packs/tour-guide/schemas/index.mjs')
});
const mapsFor = (L, fx) => L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });

test('checkDayChain: agrees with checkDayPlan on every old fixture day, and catches broken C11 chains', async () => {
  const L = await loadPlanning();
  for (const name of L.fixtures.listFixtures()) {
    const fx = L.fixtures.loadFixture(name);
    const plan = await L.planner.planTrip({ ...fx, maps: mapsFor(L, fx), build_id: `chain-${name}`, now: '2027-04-30T09:00:00Z', seed: 7 });
    assert.ok(L.schemas.validate(plan, 'plan').ok, `${name}: the old plan still validates`);
    for (const d of plan.days) assert.deepEqual(L.planner.checkDayChain(d), [], `${name} ${d.date}`);
  }
  const fx = L.fixtures.loadFixture('moving-day');
  const plan = await L.planner.planTrip({ ...fx, maps: mapsFor(L, fx), build_id: 'chain-md', now: '2027-10-01T09:00:00Z', seed: 7 });
  const day = (date) => JSON.parse(JSON.stringify(plan.days.find((d) => d.date === date)));
  const msgs = (d) => L.planner.checkDayChain(d).map((x) => x.message).join(' | ');
  let d = day('2027-10-19'); delete d.start;
  assert.match(msgs(d), /the first leg starts at "lodging"/);
  d = day('2027-10-20'); d.legs[d.legs.length - 1].to = 'lodging';
  assert.match(msgs(d), /the last leg ends at "day-end"/);
  d = day('2027-10-20'); Object.assign(d.legs[d.legs.length - 1], { depart_at: '17:00', arrive_at: '17:05', minutes: 5 });
  assert.match(msgs(d), /reaches day-end after 17:00/);
  d = day('2027-10-18'); d.stops.reverse();
  assert.match(msgs(d), /must be the stops in order/);
  d = day('2027-10-18'); d.meals.find((m) => m.kind === 'dinner').start = '18:00';
  assert.match(msgs(d), /before the previous item ends/, 'dinner before its leg arrives');
  d = day('2027-10-18'); const t = d.stops.find((s) => s.place === 'ninefold-temple'); t.arrive = '15:40';
  assert.match(msgs(d), /after the last entry \(15:30\)/);
  d = day('2027-10-19'); d.bags.start = '12:15';
  assert.match(msgs(d), /starts at 12:15, before the previous item ends/, 'the bag step cannot start before reaching the hotel');
  d = day('2027-10-19'); d.legs[1].from = 'day-start';
  assert.match(msgs(d), /must be "lodging", where leg 1 ended/);
});

/**
 * Old inputs plan byte for byte as before Phase 11: SHA-256 of JSON.stringify of planTrip, replanDays (last day) and
 * estimateBudget on the three fixtures, and planTrip on the mini world in each mode — generated with the planner at
 * commit 683c9e6 (before WP-11a) and compared here with the current planner.
 */
const GOLDEN_683C9E6 = {
  'transit-city:plan': 'd97862ba1fdc17df849a68ab2bae8db24b96c927f1a3862ee2665d6b5c3dd336',
  'transit-city:replan': 'da7e177acbe4abb05d67dea3f4c05184aa0f12a8fc47c781e39c9812856d116d',
  'transit-city:budget': '6690502622995fe7522d114522ee75832e9da61d17784331ffdd2ee21335e33d',
  'driving-loop:plan': 'c837214acefda5999c04adb5c6d8518b55d8cb7f8eb916500a2b543bbd3bab34',
  'driving-loop:replan': 'c5606b9e1fac8c0bd202e6f2f1b5077ea29a33ac5594c7281b0725e8e76eb12a',
  'driving-loop:budget': '981334c53bdc3d217365fa23a961db372214d520f97e740588fa12376624d58a',
  'hill-town:plan': '54230314ef6da640a5fcc29defe1dbc186c9b28c6fc36b653c91f6bc305ced92',
  'hill-town:replan': 'ec65d78ac8553285016c312915d37180718e3a523449e696a3d446a31f508abc',
  'hill-town:budget': '8cf9aea835b818791ce375060da8667954e85502643344091e0ed6d54c66b498',
  'mini-TRANSIT:plan': '590a9f4ff2fa2614a4996ae6068805682c478be47d43ac7447283df08175efcb',
  'mini-DRIVE:plan': '0c35e1a20ea05464011ffc4524bfa12327a2a29793f695e347e5700306528541',
  'mini-WALK:plan': '8decf5d322d6cfede233d3bdb0878641bc597a61005726e58272d1e851b71160'
};

test('assign: a place near a day it is closed and far from every day it is open is closed_day for that date, not too_far', async () => {
  const { assign } = await P();
  const { createRng } = await import('../packs/tour-guide/planner/planner-rng.mjs');
  const town = { id: 'inn-town', lat: 10, lng: 20 }, city = { id: 'inn-city', lat: 10.3, lng: 20.2 };   // about 40 km apart
  const day = (date, lodging) => ({ date, mode: 'WALK', dayStart: 600, dayEnd: 1080, pace: { breakfast: 0 }, lodging_start: lodging, lodging_end: lodging });
  const days = [day('2027-10-18', town), day('2027-10-19', city)];
  const open = { status: 'open', windows: [{ open: 540, close: 1020 }] }, shut = { status: 'closed', windows: [] };
  const cand = (id, loc, h1, h2) => ({ id, name: id, loc, minutes: 60, priority: 2, hours: { '2027-10-18': h1, '2027-10-19': h2 } });
  const nearTown = { lat: 10.002, lng: 20.002 }, nowhere = { lat: 11, lng: 21 };
  const { later } = assign({ days, rng: createRng(7), cands: [
    cand('museum', nearTown, shut, open),     // shut on the town day, open only on the city day 40 km off
    cand('chapel', nearTown, shut, shut),     // shut on both days
    cand('beacon', nowhere, open, open),      // open, far from both
    cand('cellar', nowhere, shut, open)] });  // shut on the town day too, but near neither day
  const why = Object.fromEntries(later.map((x) => [x.cand.id, [x.code, x.reason]]));
  assert.deepEqual(why.museum, ['closed_day', 'museum is closed on 2027-10-18, the day you are near it']);
  assert.deepEqual(why.chapel, ['closed_day', 'chapel is closed on every day of the trip']);
  assert.equal(why.beacon[0], 'too_far');
  assert.equal(why.cellar[0], 'too_far');
  assert.ok(later.every((x) => x.from_date === null), 'never "taken off the plan" for a date it was never on');
});

test('an old fixture plans exactly as before Phase 11 (plans, re-plans and budgets byte-identical)', async () => {
  const L = await loadPlanning();
  const W = require('./pack_tour-guide_planner_world.js');
  const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
  const got = {};
  for (const name of ['transit-city', 'driving-loop', 'hill-town']) {
    const fx = L.fixtures.loadFixture(name);
    const input = { ...fx, build_id: `golden-${name}`, now: '2027-04-30T09:00:00Z', seed: 7 };
    const plan = await L.planner.planTrip({ ...input, maps: mapsFor(L, fx) });
    got[`${name}:plan`] = h(plan);
    got[`${name}:replan`] = h(await L.planner.replanDays(plan, [plan.days[plan.days.length - 1].date], { ...input, maps: mapsFor(L, fx), build_id: `golden-${name}-2` }));
    got[`${name}:budget`] = h(await L.planner.estimateBudget({ ...input, maps: mapsFor(L, fx) }));
  }
  for (const mode of ['TRANSIT', 'DRIVE', 'WALK']) {
    const w = W.world({ mode });
    const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(W.responder), ledger: L.maps.createLedger() });
    got[`mini-${mode}:plan`] = h(await L.planner.planTrip({ ...w, maps, build_id: 'golden-mini', now: '2027-06-01T12:00:00Z', seed: 7 }));
  }
  assert.deepEqual(got, GOLDEN_683C9E6);
});

// Developed by: LightAISolutions

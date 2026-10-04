'use strict';
// Tour Guide planner — Phase 13 (WP-13a) trip-breakers on the invented moving-day fixture: an unreachable hard end
// (A1), an override whose end is not after its start (A2), a booking at the edge of its day (A3) and a booking dated
// outside the trip (A13). Each test reproduced its fault (a throw or a wrong Later item) before the fix.
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
const D1 = '2027-10-18', D2 = '2027-10-19', D3 = '2027-10-20';
const STATION = { name: 'Ashvale Station', place_id: 'FixtureMdAshvaleStation', lat: 34.4462, lng: 160.5458 };

/** Plan the moving-day fixture after `mut(fx)`; returns { fx, plan, day(date), later(id) }. */
async function plan(L, mut = null) {
  const fx = L.fixtures.loadFixture('moving-day');
  if (mut) mut(fx);
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });
  const p = await L.planner.planTrip({ ...fx, maps, build_id: 'p13a-moving-day', now: NOW, seed: 7 });
  const items = p.later.flatMap((l) => l.items);
  return { fx, plan: p, day: (date) => p.days.find((d) => d.date === date), later: (id) => items.find((i) => i.place === id) };
}
const override = (fx, date) => fx.trip.day_overrides.find((o) => o.date === date);
const place = (fx, id) => fx.places.find((p) => p.id === id);

/** Every day: the day-plan schema and the chain and timeline check. */
function sound(L, p) {
  for (const d of p.days) {
    assert.deepEqual(L.subset.validate(d, L.schemas.loadSchema('day-plan')), [], `${d.date}: the day-plan schema accepts it`);
    assert.deepEqual(L.planner.checkDayChain(d), [], `${d.date}: chain and timeline hold`);
  }
}

/* ---------------- A1: an unreachable hard end ---------------- */
// The last day ends at an invented airport at 11:30: from 09:00, breakfast (the start step) and a transit leg of about
// 110 minutes reach it a few minutes after the 11:20 it needs (END_MARGIN before the departure).
const AIRPORT = { name: 'Fernmouth Airport', place_id: 'FixtureP13aAirport', lat: 34.6165, lng: 160.55 };
const toAirport = (fx) => {
  override(fx, D3).end = { ...AIRPORT, time: '11:30' };
  const station = fx.snapshots.find((s) => s.place_id === STATION.place_id);
  fx.snapshots.push({ ...JSON.parse(JSON.stringify(station)), place_id: AIRPORT.place_id, location: { lat: AIRPORT.lat, lng: AIRPORT.lng } });
  fx.trip.modes.by_date = { [D3]: 'TRANSIT' };
};

test('A1: a departure day whose end even an empty day cannot reach builds: no stops, start to end, an over_long_day alert with the fix', async () => {
  const L = await loadAll();
  // Two Ashvale sights are set aside in both plans: with them, a last day without room would send them to day 2.
  const hint = (fx) => { for (const id of ['lantern-quay-gallery', 'mistral-shrine']) place(fx, id).status = 'rejected'; };
  const base = await plan(L, (fx) => { hint(fx); fx.trip.modes.by_date = { [D3]: 'TRANSIT' }; });
  const { plan: p, day } = await plan(L, (fx) => { hint(fx); toAirport(fx); });   // before Phase 13: "planner: no feasible day …" and no plan at all
  sound(L, p);
  const d = day(D3);
  assert.equal(d.stops.length, 0, 'the day comes back without stops');
  assert.deepEqual(d.legs.map((l) => [l.from, l.to]), [['lodging', 'day-end']], 'one leg, start to end point');
  const leg = d.legs[0];
  assert.ok(toMin(leg.arrive_at) - toMin(leg.depart_at) >= 100, 'a leg of about 110 minutes');
  assert.ok(toMin(leg.arrive_at) > toMin('11:30') - L.planner.END_MARGIN, 'it overruns the time the end needs');
  const alerts = d.warnings.filter((w) => w.severity === 'alert' && w.code === 'over_long_day');
  assert.equal(alerts.length, 1, 'one over_long_day alert');
  const over = toMin(leg.arrive_at) - (toMin('11:30') - L.planner.END_MARGIN);
  assert.ok(alerts[0].text.length <= 200, 'at most 200 characters');
  assert.match(alerts[0].text, new RegExp(`^Reaches Fernmouth Airport at ${leg.arrive_at}, ${over} min after the 11:20 needed for 11:30\\. `), 'by how much');
  assert.match(alerts[0].text, /Start earlier: \/dates 2027-10-20 hours \d\d:\d\d 11:30$/, 'and the fix');
  const [, fixStart] = alerts[0].text.match(/hours (\d\d:\d\d) 11:30$/);
  assert.ok(toMin(fixStart) <= toMin('09:00') - over && toMin(fixStart) % 5 === 0, 'the fix starts early enough, on a five-minute mark');
  assert.equal(d.spare_minutes || 0, 0, 'no time to spare on an overrun day');
  for (const date of [D1, D2]) assert.deepEqual(day(date), base.day(date), `${date} unchanged`);
});

test('A1: solveDay returns an empty result instead of throwing; a start that cannot reach its end at all still throws', async () => {
  const L = await loadAll();
  const r = L.planner.solveDay({ stops: [{ minutes: 60, priority: 1, windows: [], booking: null }], travel: (a, b) => (a === 'S' && b === 'E' ? 120 : 30), departAt: 9 * 60, dayEnd: 10 * 60, maxSpill: 0 });
  assert.deepEqual([r.order, r.items, r.finish, r.overrun], [[], [], 11 * 60, true]);
  assert.throws(() => L.planner.solveDay({ stops: [], travel: () => Infinity, departAt: 540, dayEnd: 600 }), /no feasible day/);
});

/* ---------------- A2: an override whose end is not after its start ---------------- */
test('A2: an inverted override is clamped (end kept, start two hours before it) with a warn warning naming the date, the values and the fix', async () => {
  const L = await loadAll();
  const { plan: p, day } = await plan(L, (fx) => { Object.assign(override(fx, D1), { day_start: '15:00', day_end: '12:00' }); });   // threw before Phase 13
  sound(L, p);
  const d = day(D1);
  assert.deepEqual(d.meals[0], { kind: 'breakfast', start: '10:00', end: '10:35', at: 'lodging', note: 'at Brindle Quay Inn' }, 'the day starts two hours before its 12:00 end');
  const warn = d.warnings.filter((w) => w.severity === 'warn' && w.code === 'other');
  assert.deepEqual(warn.map((w) => w.text), ['Mon 18 Oct: the hours given end at 12:00, before they start at 15:00; planned 10:00–12:00. To change it: /dates 2027-10-18 hours 10:00 12:00']);
  // Never before 00:00: an end at 01:00 starts at 00:00.
  const early = await plan(L, (fx) => { Object.assign(override(fx, D1), { day_start: '15:00', day_end: '01:00' }); });
  assert.match(early.day(D1).warnings.find((w) => w.severity === 'warn').text, /planned 00:00–01:00\. To change it: \/dates 2027-10-18 hours 00:00 01:00$/);
});

test('A2: with a hard start too, the day is planned without stops and an alert says so; a hard start alone keeps its start', async () => {
  const L = await loadAll();
  const { plan: p, day, later } = await plan(L, (fx) => { override(fx, D3).start = { ...STATION, time: '18:00' }; });   // start 18:00, end 17:00: both fixed
  sound(L, p);
  const d = day(D3);
  assert.equal(d.stops.length, 0, 'no stops');
  assert.deepEqual(d.warnings.filter((w) => w.severity === 'alert').map((w) => [w.code, w.text]),
    [['over_long_day', 'Wed 20 Oct: the day must end at 17:00, before it starts at 18:00, so it is planned without stops. Fix the times with /dates 2027-10-20']]);
  assert.ok(day(D2).stops.some((s) => s.place === 'lantern-quay-gallery') || later('lantern-quay-gallery'), 'the last day\'s sight goes elsewhere');
  // Only the start fixed (day 2 arrives at 19:00, after the trip's 18:00 end): the start stays, the end moves two hours later.
  const late = await plan(L, (fx) => { override(fx, D2).start.time = '19:00'; });
  sound(L, late.plan);
  const d2 = late.day(D2);
  assert.equal(d2.legs[0].depart_at, '19:00', 'the arrival time is kept');
  assert.match(d2.warnings.find((w) => w.severity === 'warn').text, /^Tue 19 Oct: the hours given end at 18:00, before they start at 19:00; planned 19:00–21:00\. /);
});

test('A2: trip-level hours under two hours still fail', async () => {
  const L = await loadAll();
  await assert.rejects(plan(L, (fx) => { fx.trip.day_start = '12:00'; fx.trip.day_end = '13:00'; }), /day_end must be at least two hours after day_start/);
});

/* ---------------- A3: a booking at the edge of its day ---------------- */
test('A3: a booking that ends at the day\'s end is kept at its time; the day widens to bring you back, with an info warning', async () => {
  const L = await loadAll();
  const { plan: p, day, later } = await plan(L, (fx) => { place(fx, 'ashvale-castle-ruins').booking = { date: D2, time: '17:00', minutes: 60 }; });
  sound(L, p);
  assert.equal(later('ashvale-castle-ruins'), undefined, 'not dropped to Later (before Phase 13: outside_day)');
  const d = day(D2);
  const stop = d.stops.find((s) => s.place === 'ashvale-castle-ruins');
  assert.deepEqual([stop.arrive, stop.depart, stop.booked], ['17:00', '18:00', 'booked for 17:00']);
  const info = d.warnings.find((w) => w.severity === 'info' && /^Day hours widened/.test(w.text));
  const [, end] = info.text.match(/^Day hours widened to 12:10–(\d\d:\d\d) to hold your booking at Ashvale Castle Ruins$/);
  assert.ok(toMin(end) > toMin('18:00') && toMin(end) <= toMin('18:15'), 'the end moves past the booking\'s end by the walk back to the lodging');
  assert.ok(!d.warnings.some((w) => w.code === 'over_long_day'), 'no overrun warning for a booking the day was widened for');
});

test('A3: a booking that starts before the day\'s start plus its start step is kept; the day starts earlier', async () => {
  const L = await loadAll();
  const { plan: p, day, later } = await plan(L, (fx) => { place(fx, 'ninefold-temple').booking = { date: D1, time: '10:00', minutes: 60 }; });   // day 1 starts 10:00, breakfast to 10:35
  sound(L, p);
  assert.equal(later('ninefold-temple'), undefined, 'not dropped to Later');
  const d = day(D1);
  const stop = d.stops.find((s) => s.place === 'ninefold-temple');
  assert.deepEqual([stop.arrive, stop.booked], ['10:00', 'booked for 10:00']);
  const leg = d.legs.find((l) => l.to === 'ninefold-temple');
  const breakfast = d.meals.find((m) => m.kind === 'breakfast');
  assert.ok(toMin(breakfast.start) <= toMin('10:00') - 35 - (toMin(leg.arrive_at) - toMin(leg.depart_at)), 'the start is no later than the booking minus the start step and the leg');
  assert.equal(toMin(breakfast.end) - toMin(breakfast.start), 35, 'the start step is kept');
  assert.match(d.warnings.find((w) => /^Day hours widened/.test(w.text)).text, new RegExp(`^Day hours widened to ${breakfast.start}–18:00 to hold your booking at Ninefold Temple$`));
});

test('A3: a hard end never moves: a booking that cannot finish before it goes to Later, naming that day and that end', async () => {
  const L = await loadAll();
  const { plan: p, day, later } = await plan(L, (fx) => { place(fx, 'ashvale-castle-ruins').booking = { date: D3, time: '16:30', minutes: 60 }; });
  sound(L, p);
  assert.deepEqual(day(D3).end, { name: 'Ashvale Station', time: '17:00' });
  const item = later('ashvale-castle-ruins');
  assert.equal(item.code, 'outside_day');
  assert.equal(item.reason, "Ashvale Castle Ruins's 16:30 booking on Wed 20 Oct cannot finish before 17:00, when the day ends at Ashvale Station");
});

test('A3: an outside_day reason quotes the window of the day it names, or of the whole trip, never another day\'s', async () => {
  const L = await loadAll();
  const pace = { breakfast: 0, lunch: 60, dinner: 60 };
  const inn = { id: 'brindle-quay-inn', lat: 34.2, lng: 160.3 };
  const days = [{ date: D1, dayStart: 600, dayEnd: 1080, pace, mode: 'WALK', lodging_start: inn, lodging_end: inn }, { date: D2, dayStart: 540, dayEnd: 1020, pace, mode: 'WALK', lodging_start: inn, lodging_end: inn }];
  const early = { status: 'open', windows: [{ open: 360, close: 420 }] };   // 06:00–07:00 only
  const cand = (id, extra = {}) => ({ id, name: id, loc: { lat: 34.2, lng: 160.3 }, minutes: 45, priority: 2, hours: { [D1]: early, [D2]: early }, booking: null, ...extra });
  const rng = { key: () => 0 };
  const r = L.planner.assign({ days, cands: [cand('dawn-pier'), cand('dawn-hut', { anchor: D2 })], rng });
  assert.deepEqual(r.later.map((x) => [x.cand.id, x.code, x.reason]), [
    ['dawn-pier', 'outside_day', 'dawn-pier only opens outside your planning day (09:00–18:00 across the trip)'],
    ['dawn-hut', 'outside_day', 'dawn-hut only opens outside your planning day (09:00–17:00 on Tue 19 Oct)']]);
  // Days with one window keep the old wording.
  const same = L.planner.assign({ days: [days[0], { ...days[1], dayStart: 600, dayEnd: 1080 }], cands: [cand('dawn-pier')], rng });
  assert.equal(same.later[0].reason, 'dawn-pier only opens outside your planning day (10:00–18:00)');
});

/* ---------------- A13: a booking dated outside the trip ---------------- */
test('A13: a booking dated outside the trip goes to Later with code other and says so', async () => {
  const L = await loadAll();
  const { plan: p, later } = await plan(L, (fx) => { place(fx, 'ashvale-castle-ruins').booking = { date: '2027-10-25', time: '10:00', minutes: 60 }; });
  sound(L, p);
  const item = later('ashvale-castle-ruins');
  assert.equal(item.code, 'other', 'before Phase 13: closed_day, "closed on every day of the trip"');
  assert.equal(item.reason, "Ashvale Castle Ruins is booked for Mon 25 Oct, outside the trip's dates");
  const next = await plan(L, (fx) => { place(fx, 'ashvale-castle-ruins').booking = { date: '2028-10-19', time: '10:00', minutes: 60 }; });
  assert.equal(next.later('ashvale-castle-ruins').reason, "Ashvale Castle Ruins is booked for Thu 19 Oct 2028, outside the trip's dates", 'another year names it');
});

// Developed by: LightAISolutions

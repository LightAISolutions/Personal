'use strict';
// Tour Guide planner — planTrip / replanDays / estimateBudget on the mini world: feasibility properties, Later reasons,
// bookings, the budget hard stop, determinism and that re-planning one day leaves the others byte-identical.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_planner_world.js');
const kit = () => import('../kits/maps/index.mjs');
const planner = () => import('../packs/tour-guide/planner/index.mjs');

async function setup(opts = {}, ceilings) {
  const k = await kit();
  const transport = k.createMockTransport(W.responder);
  const ledger = k.createLedger({ ceilings });
  const maps = k.createMapsClient({ transport, ledger });
  const w = W.world(opts);
  return { k, transport, ledger, maps, w, input: { ...w, maps, build_id: 'test-build-1', now: '2027-06-01T12:00:00Z', seed: 7 } };
}
const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3);
const minutesOf = (mode, a, b) => Math.max(1, Math.ceil(W.travel(mode, a, b).durationSec / 60));

function checkDay(day, w, mode) {
  const ds = toMin(w.trip.day_start), de = toMin(w.trip.day_end);
  for (const s of day.stops) {
    assert.ok(toMin(s.arrive) >= ds && toMin(s.depart) <= de, `${day.date} ${s.place} inside the day`);
    assert.equal(toMin(s.depart) - toMin(s.arrive), s.minutes);
    if (s.window) assert.ok(toMin(s.arrive) >= toMin(s.window.open) && toMin(s.depart) <= toMin(s.window.close), `${s.place} inside its window`);
  }
  for (let i = 1; i < day.stops.length; i++) assert.ok(toMin(day.stops[i].arrive) >= toMin(day.stops[i - 1].depart), 'stops in clock order');
  const chain = ['lodging', ...day.stops.map((s) => s.place), 'lodging'];
  assert.equal(day.legs.length, chain.length - 1 || 0);
  day.legs.forEach((leg, i) => {
    assert.equal(leg.from, chain[i]); assert.equal(leg.to, chain[i + 1]);
    assert.equal(leg.minutes, minutesOf(mode, w.coords[leg.from], w.coords[leg.to]), `leg ${leg.from}→${leg.to} matches the recorded route`);
    assert.equal(toMin(leg.arrive_at) - toMin(leg.depart_at), leg.minutes);
    assert.equal(leg.source, 'route');
    assert.match(leg.maps_url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
    if (mode === 'TRANSIT') assert.equal(leg.line, 'Line 1');
  });
  const back = day.legs[day.legs.length - 1];
  if (back && toMin(back.arrive_at) > de) assert.ok(day.warnings.some((x) => x.code === 'over_long_day'), 'late return is warned');
  for (const wn of day.warnings) assert.ok(['closed_day', 'tight_connection', 'over_long_day', 'hours_unknown', 'order_disagreement', 'budget', 'other'].includes(wn.code));
}

test('planTrip: feasible transit days, every candidate scheduled or in a Later list with a reason', async () => {
  const { w, input, ledger } = await setup();
  const { planTrip } = await planner();
  const plan = await planTrip(input);
  assert.equal(plan.v, 1); assert.equal(plan.trip_id, 'minibury-2027'); assert.equal(plan.built_on, '2027-06-01');
  assert.deepEqual(plan.days.map((d) => d.date), ['2027-06-07', '2027-06-08']);
  for (const d of plan.days) { assert.equal(d.mode, 'TRANSIT'); assert.equal(d.day_url, null, 'transit days have no whole-day link'); checkDay(d, w, 'TRANSIT'); assert.equal(d.solver.cross_check.asked, false); }
  const scheduled = plan.days.flatMap((d) => d.stops.map((s) => s.place));
  const later = Object.fromEntries(plan.later.flatMap((l) => l.items.map((it) => [it.place, it])));
  for (const p of w.places) assert.ok(scheduled.includes(p.id) !== (p.id in later), `${p.id} is scheduled xor in a Later list`);
  assert.equal(later['night-market'].code, 'outside_day');
  assert.equal(later['far-lighthouse'].code, 'too_far');
  assert.equal(later['shut-gallery'].code, 'closed_business');
  assert.equal(later['saturday-cafe'].code, 'closed_day');
  for (const it of Object.values(later)) { assert.ok(it.reason.length > 10); assert.equal(it.added_on, '2027-06-01'); }
  assert.ok(scheduled.includes('lantern-museum') && scheduled.includes('old-church'), 'must-sees are scheduled');
  const church = plan.days[1].stops.find((s) => s.place === 'old-church');
  assert.ok(church, 'the booking pins Old Church to its date');
  assert.equal(church.arrive, '14:00'); assert.equal(church.booked, 'MINI-77 (14:00)');
  assert.ok(!plan.days[1].stops.some((s) => s.place === 'river-market'), 'closed on Tuesday → not that day');
  const view = plan.days.flatMap((d) => d.stops).find((s) => s.place === 'hill-viewpoint');
  assert.ok(view && view.window === null && plan.days.some((d) => d.warnings.some((x) => x.code === 'hours_unknown' && x.place === 'hill-viewpoint')));
  for (const d of plan.days) { assert.deepEqual(d.meals.map((m) => m.kind), ['breakfast', 'lunch', 'dinner']); assert.equal(d.lodging_start, 'harbour-inn'); assert.equal(d.verified_on, '2027-06-01'); }
  const st = Object.fromEntries(plan.places.map((p) => [p.id, p.status]));
  assert.equal(st['lantern-museum'], 'scheduled'); assert.equal(st['far-lighthouse'], 'saved-for-later');
  assert.equal(plan.usage.matrix_elements, plan.days.reduce((s, d) => s + d.solver.matrix_elements, 0));
  assert.equal(ledger.usage().skus.find((r) => r.sku === 'routes.route_matrix.essentials').units, plan.usage.matrix_elements);
  assert.equal(ledger.usage().skus.find((r) => r.sku === 'routes.compute_routes.essentials').units, plan.usage.route_calls);
  assert.ok(plan.budget.within_ceiling && plan.budget.skus['routes.route_matrix.essentials'] >= plan.usage.matrix_elements, 'the estimate is an upper bound');
});

test('DRIVE days get a Google order cross-check and a whole-day link; the solver keeps hours, Google does not', async () => {
  const { w, input } = await setup({ mode: 'DRIVE', pace: 'relaxed' });
  const { planTrip } = await planner();
  const plan = await planTrip(input);
  for (const d of plan.days) {
    checkDay(d, w, 'DRIVE');
    if (d.stops.length >= 2) { assert.equal(d.solver.cross_check.asked, true); assert.deepEqual(d.solver.cross_check.our_order, d.stops.map((s) => s.place)); assert.match(d.day_url, /travelmode=driving/); }
    if (d.solver.cross_check.agrees === false) assert.ok(d.warnings.some((x) => x.code === 'order_disagreement'));
  }
  assert.ok(plan.usage.route_calls >= plan.days.filter((d) => d.stops.length >= 2).length);
});

test('deterministic: the same input and seed give the same plan; estimateBudget makes no call', async () => {
  const a = await setup(), b = await setup();
  const { planTrip, estimateBudget } = await planner();
  const p1 = await planTrip(a.input), p2 = await planTrip(b.input);
  assert.deepEqual(p1, p2);
  const c = await setup();
  const budget = await estimateBudget(c.input);
  assert.equal(c.transport.calls.length, 0);
  assert.ok(budget.within_ceiling && budget.skus['routes.route_matrix.essentials'] > 0 && budget.usd_estimate === 0);
});

test('the budget hard stop refuses before any call when the ledger cannot carry the build', async () => {
  const { input, transport } = await setup({}, { 'routes.route_matrix.essentials': 10 });
  const { planTrip, PlanBudgetError } = await planner();
  await assert.rejects(planTrip(input), (e) => e instanceof PlanBudgetError && e.code === 'PLAN_BUDGET' && e.budget.within_ceiling === false);
  assert.equal(transport.calls.length, 0, 'nothing was sent');
});

test('replanDays: one day changes, the other is byte-identical, Later items outside the pool are kept', async () => {
  const { w, input } = await setup();
  const { planTrip, replanDays } = await planner();
  const plan = await planTrip(input);
  const before = JSON.stringify(plan.days[0]);
  // the owner promotes Green Park onto day 2 and demotes the museum from wherever it was
  const places = plan.places.map((p) => (p.id === 'green-park' ? { ...p, status: 'candidate', scheduled_hint: { date: '2027-06-08' } } : p.id === 'lantern-museum' ? { ...p, status: 'saved-for-later' } : p));
  const museumDay = plan.days.find((d) => d.stops.some((s) => s.place === 'lantern-museum')).date;
  const dates = [...new Set(['2027-06-08', museumDay])];
  const plan2 = await replanDays(plan, dates, { ...input, places, build_id: 'test-build-2' });
  if (!dates.includes('2027-06-07')) assert.equal(JSON.stringify(plan2.days[0]), before, 'day 1 untouched byte for byte');
  for (const d of plan2.days) if (dates.includes(d.date)) { checkDay(d, w, 'TRANSIT'); assert.equal(d.build_id, 'test-build-2'); }
  assert.ok(!plan2.days.flatMap((d) => d.stops).some((s) => s.place === 'lantern-museum'));
  const later = Object.fromEntries(plan2.later.flatMap((l) => l.items.map((it) => [it.place, it])));
  assert.equal(later['lantern-museum'].code, 'owner');
  assert.equal(later['far-lighthouse'].code, 'too_far', 'kept from the first build');
  assert.ok(plan2.usage.matrix_elements > plan.usage.matrix_elements, 'usage accumulates');
  assert.ok(!plan2.places.some((p) => 'scheduled_hint' in p));
  await assert.rejects(replanDays(plan, ['2027-06-09'], input), /not in the plan/);
});

test('late start and a chosen lunch spot: no breakfast, the spot is the lunch, starting in lunchtime', async () => {
  const { w, input } = await setup();
  const { planTrip } = await planner();
  input.trip = { ...input.trip, day_start: '11:30' };
  input.places = input.places.map((p) => (p.id === 'tile-workshop' ? { ...p, category: 'restaurant', activity: 'set lunch', priority: 1 } : p));
  const plan = await planTrip(input);
  for (const d of plan.days) { assert.ok(!d.meals.some((m) => m.kind === 'breakfast'), `${d.date}: no breakfast after an 11:30 start`); checkDay(d, { ...w, trip: input.trip }, 'TRANSIT'); }
  const day = plan.days.find((d) => d.stops.some((s) => s.place === 'tile-workshop'));
  assert.ok(day, 'the lunch spot is scheduled');
  const spot = day.stops.find((s) => s.place === 'tile-workshop');
  assert.ok(toMin(spot.arrive) >= 11 * 60 + 30 && toMin(spot.arrive) <= 14 * 60, `lunch spot starts in lunchtime (${spot.arrive})`);
  assert.deepEqual(spot.window, { open: '11:00', close: '17:00' }, 'the reported window is the place\'s own hours');
  assert.ok(!day.meals.some((m) => m.kind === 'lunch'), 'no second lunch on the day with the lunch spot');
  for (const d of plan.days) if (d !== day) assert.ok(d.meals.some((m) => m.kind === 'lunch'), `${d.date} still gets a lunch slot`);
});

test('input validation: bad trip, missing lodging night, unknown mode', async () => {
  const { input } = await setup();
  const { planTrip } = await planner();
  await assert.rejects(planTrip({ ...input, trip: { ...input.trip, lodging: [{ ...input.trip.lodging[0], to: '2027-06-07' }] } }), /no lodging covers/);
  await assert.rejects(planTrip({ ...input, trip: { ...input.trip, modes: { default: 'BICYCLE' } } }), /unsupported mode/);
  await assert.rejects(planTrip({ ...input, build_id: '' }), /build_id/);
  await assert.rejects(planTrip({ ...input, trip: { ...input.trip, timezone: 'Mars/Olympus' } }), /time zone/);
});

test('a booking with its own length is booked exactly that long (Phase 8: a ceremony is not a stroll)', async () => {
  const { input } = await setup();
  const { planTrip } = await planner();
  const places = input.places.map((p) => (p.id === 'old-church' ? { ...p, booking: { ...p.booking, minutes: 75 } } : p));
  const plan = await planTrip({ ...input, places });
  const church = plan.days[1].stops.find((s) => s.place === 'old-church');
  assert.equal(church.arrive, '14:00');
  assert.equal(church.minutes, 75);   // 45 without the booked length
  assert.equal(church.depart, '15:15');
});

// Developed by: LightAISolutions

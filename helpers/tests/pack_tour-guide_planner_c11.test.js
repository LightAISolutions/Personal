'use strict';
// Tour Guide planner — Phase 11 (WP-11a, Contract C11) on the invented moving-day fixture: a day that starts at an
// arrival with each bag step, per-date hours, a day that ends at a departure, real dinners, evening extras, sunset,
// place facts in the schedule, country defaults and crowd slots. Every DayPlan is checked against the day-plan schema
// (subset validator) and the generalised chain check (planner-chain.mjs).
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
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const NOW = '2027-10-01T09:00:00Z';
const D1 = '2027-10-18', D2 = '2027-10-19', D3 = '2027-10-20';

/** Plan the moving-day fixture after `mut(fx)`; returns { fx, plan, ledger, day(date) }. */
async function plan(L, mut = null, extra = {}) {
  const fx = L.fixtures.loadFixture('moving-day');
  if (mut) mut(fx);
  const ledger = L.maps.createLedger();
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger });
  const p = await L.planner.planTrip({ ...fx, maps, build_id: 'c11-moving-day', now: NOW, seed: 7, ...extra });
  return { fx, plan: p, ledger, day: (date) => p.days.find((d) => d.date === date) };
}
const override = (fx, date) => fx.trip.day_overrides.find((o) => o.date === date);

/** Every day: the C11 day-plan schema and the generalised chain and timeline. */
function sound(L, p) {
  for (const d of p.days) {
    const errs = L.subset.validate(d, L.schemas.loadSchema('day-plan'));
    assert.deepEqual(errs, [], `${d.date}: the day-plan schema accepts it`);
    assert.deepEqual(L.planner.checkDayChain(d), [], `${d.date}: chain and timeline hold`);
  }
}

test('moving day, bags to the hotel: starts at the arrival point and time, drops the bags at the lodging, no breakfast', async () => {
  const L = await loadAll();
  const { plan: p, day } = await plan(L);
  sound(L, p);
  const d = day(D2);
  assert.deepEqual(d.start, { name: 'Ashvale Station', time: '12:10' });
  assert.equal(d.end, undefined);
  assert.ok(!d.meals.some((m) => m.kind === 'breakfast'), 'an arrival day has no breakfast at the lodging');
  assert.equal(d.legs[0].from, 'day-start'); assert.equal(d.legs[0].to, 'lodging');
  assert.equal(d.legs[0].depart_at, '12:10', 'the first leg leaves at the arrival time');
  assert.equal(d.bags.kind, 'hotel'); assert.equal(d.bags.at, 'lodging');
  assert.equal(d.bags.start, d.legs[0].arrive_at);
  assert.equal(toMin(d.bags.end) - toMin(d.bags.start), L.planner.BAGS.HOTEL_MIN);
  assert.equal(d.bags.text, 'Leave your bags at Ashvale Lantern Hotel before the first sight');
  assert.equal(d.legs[1].from, 'lodging');
  assert.ok(toMin(d.legs[1].depart_at) >= toMin(d.bags.end), 'the sights start after the bag step');
  assert.ok(d.stops.length >= 1 && d.stops.every((s) => toMin(s.arrive) >= toMin(d.bags.end)));
});

test('moving day, bags in a locker: stored at the start point, the sights loop back through it, then on to the lodging', async () => {
  const L = await loadAll();
  const { plan: p, day } = await plan(L, (fx) => { override(fx, D2).bags = 'locker'; });
  sound(L, p);
  const d = day(D2), legs = d.legs;
  assert.equal(d.bags.kind, 'locker'); assert.equal(d.bags.at, 'day-start');
  assert.equal(d.bags.start, '12:10', 'stored on arrival');
  assert.equal(legs[0].from, 'day-start'); assert.notEqual(legs[0].to, 'lodging', 'no detour to the hotel');
  assert.ok(toMin(legs[0].depart_at) >= toMin('12:10') + L.planner.BAGS.LOCKER_MIN);
  const back = legs.findIndex((l, i) => i > 0 && l.to === 'day-start');
  assert.ok(back > 0, 'the day comes back to the start point');
  assert.equal(legs[back + 1].from, 'day-start'); assert.equal(legs[back + 1].to, 'lodging');
  assert.equal(toMin(d.bags.end) - toMin(legs[back].arrive_at), L.planner.BAGS.COLLECT_MIN, 'collected on the way out');
  assert.equal(legs[back + 1].depart_at, d.bags.end);
  assert.match(d.bags.text, /^Bags in a locker at Ashvale Station/);
});

test('moving day, bags sent ahead or carried: only the bag line; straight from the arrival point to the first sight', async () => {
  const L = await loadAll();
  for (const [kind, at, text] of [['forward', 'lodging', 'Bags sent ahead to Ashvale Lantern Hotel'], ['carry', 'day-start', 'Carry your bags today']]) {
    const { plan: p, day } = await plan(L, (fx) => { override(fx, D2).bags = kind; });
    sound(L, p);
    const d = day(D2);
    assert.deepEqual(d.bags, { kind, at, text }, `${kind}: no bag step times`);
    assert.equal(d.legs[0].from, 'day-start'); assert.ok(toMin(d.legs[0].depart_at) >= toMin('12:10'));
    assert.notEqual(d.legs[0].to, 'lodging', `${kind}: no stop at the hotel first`);
    const lunch = d.meals.find((m) => m.kind === 'lunch');
    if (lunch.end === d.legs[0].depart_at) assert.deepEqual([lunch.start, lunch.at, lunch.note], ['12:10', 'day-start', 'near Ashvale Station'], 'lunch where the day starts');
  }
});

test('a day that ends at a departure reaches the end point in time: no dinner, no extras, the time to spare named', async () => {
  const L = await loadAll();
  const { plan: p, day } = await plan(L);
  const d = day(D3);
  assert.deepEqual(d.end, { name: 'Ashvale Station', time: '17:00' });
  const last = d.legs[d.legs.length - 1];
  assert.equal(last.to, 'day-end');
  assert.ok(toMin(last.arrive_at) <= toMin('17:00') - L.planner.END_MARGIN, 'arrives END_MARGIN before the departure');
  assert.ok(!d.meals.some((m) => m.kind === 'dinner'), 'no dinner on a departure day');
  assert.equal(d.extras, undefined);
  assert.ok(!d.free.some((f) => f.note === L.planner.BACK_EARLY_NOTE));
  // A8 (Phase 13): the last leg leaves as late as the end allows (arriving 16:50), and the time to spare is free time
  // near the last stop before that leg, not a note at the station.
  assert.equal(last.arrive_at, '16:50', 'A8: the leg to the end arrives END_MARGIN before the departure');
  assert.ok(!d.free.some((f) => f.note.startsWith(L.planner.END_SPARE_NOTE)), 'A8: no time-to-spare note at the end point');
  const spare = d.free[d.free.length - 1];
  assert.deepEqual(spare, { start: spare.start, end: last.depart_at, note: 'free time near Lantern Quay Gallery before you leave for Ashvale Station' }, 'A8: free time before the last leg');
  assert.deepEqual(d.bags, { kind: 'carry', at: 'lodging', text: 'Carry your bags today · Check out by 10:00' });
  // A departure too early for any sight: the stops go, the day still reaches the train.
  const early = await plan(L, (fx) => { override(fx, D3).end.time = '10:00'; });
  sound(L, early.plan);
  const e = early.day(D3);
  assert.equal(e.stops.length, 0);
  assert.ok(toMin(e.legs[e.legs.length - 1].arrive_at) <= toMin('09:50'));
});

test('per-date day_start / day_end change only that day; a trip without overrides plans as it did', async () => {
  const L = await loadAll();
  const base = await plan(L);
  const d1 = base.day(D1);
  assert.deepEqual(d1.meals[0], { kind: 'breakfast', start: '10:00', end: '10:35', at: 'lodging', note: 'at Brindle Quay Inn' }, 'day 1 starts at its own 10:00');
  assert.ok(toMin(d1.legs[0].depart_at) >= toMin('10:35'));
  assert.equal(d1.start, undefined); assert.equal(d1.bags, undefined);
  assert.equal(base.day(D3).meals[0].start, '09:00', 'day 3 keeps the trip day start');
  // Moving only day 1's start leaves the other days byte-identical.
  const moved = await plan(L, (fx) => { override(fx, D1).day_start = '09:30'; });
  assert.equal(moved.day(D1).meals[0].start, '09:30');
  for (const date of [D2, D3]) assert.deepEqual(moved.day(date), base.day(date), `${date} unchanged`);
  // A per-date day_end: day 2 ends at 16:30, so the late saved-place extra goes (events still show).
  const short = await plan(L, (fx) => { override(fx, D2).day_end = '16:30'; });
  sound(L, short.plan);
  const s2 = short.day(D2);
  assert.ok(s2.legs.every((l) => l.to === 'hearth-and-barley' || l.from === 'hearth-and-barley' || toMin(l.arrive_at) <= toMin('16:30')));
  assert.ok(!(s2.extras || []).some((x) => x.kind === 'saved'));
  assert.deepEqual(short.day(D1), base.day(D1));
});

/** Three nights in the first town: one lodging, day 1's own start kept, the moving and departure days gone. */
const stayInTown = (fx) => {
  fx.trip.lodging = [{ ...fx.trip.lodging[0], to: '2027-10-21' }];
  fx.trip.day_overrides = fx.trip.day_overrides.filter((o) => o.date === D1);
};

test('dinner: the near, open, diet-compatible saved place, with its booking line and honest legs; never "fits: no"', async () => {
  const L = await loadAll();
  const { plan: p, day, ledger } = await plan(L);
  const d1 = day(D1), d2 = day(D2);
  const dinner1 = d1.meals.find((m) => m.kind === 'dinner'), dinner2 = d2.meals.find((m) => m.kind === 'dinner');
  assert.equal(dinner1.at, 'juniper-table', 'the ✅ pick that fits the diet — not the nearer Quayside Grill (menu does not fit)');
  assert.equal(dinner1.booking, 'Walk-ins welcome; book for 6 or more', 'facts.booking');
  assert.equal(dinner2.at, 'hearth-and-barley', 'Rowan Noodle Bar is picked but closed on Tuesdays; the Later list is next');
  assert.equal(dinner2.booking, 'To book: book a day ahead · by phone · from 2 people', 'trip.bookings wins over facts.booking');
  assert.match(dinner2.note, /partly fits/);
  const pts = Object.fromEntries(p.places.map((x) => [x.id, x]));
  const base = { fx: L.fixtures.loadFixture('moving-day') };
  const snap = (id) => base.fx.snapshots.find((s) => s.place_id === pts[id].place_id).location;
  for (const [d, m] of [[d1, dinner1], [d2, dinner2]]) {
    const into = d.legs.find((l) => l.to === m.at), out = d.legs.find((l) => l.from === m.at);
    assert.ok(into && out, `${d.date}: legs to dinner and back`);
    assert.ok(toMin(into.arrive_at) <= toMin(m.start) && toMin(out.depart_at) >= toMin(m.end));
    assert.equal(into.source, 'route'); assert.equal(out.to, 'lodging');
    const lodging = base.fx.trip.lodging.find((l) => l.id === d.lodging_end);
    const lastStop = d.stops.length ? snap(d.stops[d.stops.length - 1].place) : null;
    const km = Math.min(L.geo.haversineKm(snap(m.at), lodging), lastStop ? L.geo.haversineKm(snap(m.at), lastStop) : Infinity);
    assert.ok(km <= L.planner.DINNER.RADIUS_KM, `${d.date}: within ${L.planner.DINNER.RADIUS_KM} km`);
    const open = L.planner.hoursOn(base.fx.snapshots.find((s) => s.place_id === pts[m.at].place_id), d.date).windows;
    assert.ok(open.some((w) => toMin(m.start) >= w.open && toMin(m.end) <= w.close), `${d.date}: open for dinner`);
  }
  assert.equal(pts['juniper-table'].status, 'scheduled'); assert.equal(pts['hearth-and-barley'].status, 'scheduled');
  assert.ok(!pts['quayside-grill'] && !pts['rowan-noodle-bar'], 'unused dinner places do not enter plan.places');
  assert.ok(!p.later.some((l) => l.items.some((it) => it.place === 'hearth-and-barley')), 'a dinner place is scheduled, not Later');
  assert.equal(ledger.usage().skus.find((r) => r.sku === 'routes.compute_routes.essentials').units + ((ledger.usage().skus.find((r) => r.sku === 'routes.compute_routes.pro') || {}).units || 0), p.usage.route_calls, 'every dinner request is counted');
  // The budget counts the dinner legs: with a dinner pool it is higher than without.
  const fx = L.fixtures.loadFixture('moving-day');
  const mk = () => L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });
  const withPool = await L.planner.estimateBudget({ ...fx, maps: mk(), build_id: 'b', now: NOW, seed: 7 });
  const { dinners, ...noPool } = fx;
  const without = await L.planner.estimateBudget({ ...noPool, maps: mk(), build_id: 'b', now: NOW, seed: 7 });
  assert.ok(withPool.skus['routes.compute_routes.essentials'] > without.skus['routes.compute_routes.essentials']);
  assert.ok(withPool.skus['routes.compute_routes.essentials'] + (withPool.skus['routes.compute_routes.pro'] || 0) >= p.usage.route_calls, 'the estimate is an upper bound');
});

test('dinner: never the same place on two days, falls back to "near <lodging>", and no dinner pool plans the old line', async () => {
  const L = await loadAll();
  const { plan: p } = await plan(L, stayInTown);
  sound(L, p);
  const dinners = p.days.map((d) => d.meals.find((m) => m.kind === 'dinner'));
  assert.equal(dinners[0].at, 'juniper-table');
  for (const m of dinners.slice(1)) {
    assert.equal(m.at, 'lodging', 'Juniper Table is used; Quayside Grill fits no; the town-B places are too far');
    assert.equal(m.note, 'near Brindle Quay Inn'); assert.equal(m.booking, undefined);
  }
  assert.equal(new Set(dinners.filter((m) => m.at !== 'lodging').map((m) => m.at)).size, dinners.filter((m) => m.at !== 'lodging').length);
  assert.ok(!p.days.some((d) => d.meals.some((m) => m.at === 'quayside-grill')));
  // No pool: every dinner is the old line, no dinner legs.
  const none = await plan(L, (fx) => { delete fx.dinners; });
  for (const d of none.plan.days) {
    const m = d.meals.find((x) => x.kind === 'dinner');
    if (m) assert.equal(m.at, 'lodging');
    assert.ok(d.legs.every((l) => !['juniper-table', 'hearth-and-barley'].includes(l.to)));
  }
  assert.ok(!none.plan.places.some((x) => x.id === 'juniper-table'));
});

test('dinner with shortlist choices: the planner runs, a skipped or kept-for-later dinner place is left out, a pick ranks first', async () => {
  const L = await loadAll();
  const { applyChoices } = await import('../packs/tour-guide/planner/planner-choices.mjs');
  // Shortlist picks of sights only: dinner still comes from the saved pool (this threw before the fix).
  const picked = await plan(L, null, { choices: { picks: ['copperleaf-garden', 'ninefold-temple'], later: [], skip: [] } });
  sound(L, picked.plan);
  assert.equal(picked.day(D1).meals.find((m) => m.kind === 'dinner').at, 'juniper-table');
  // A dinner place that is also on the shortlist follows the owner's word.
  const fx = L.fixtures.loadFixture('moving-day');
  const snapshots = new Map(fx.snapshots.map((s) => [s.place_id, s]));
  const places = [...fx.places, ...fx.dinners.map((d) => ({ ...d, status: 'candidate' }))];
  const pool = (choices) => {
    const ch = applyChoices(places, choices, { explicit: true });
    return L.planner.prepareDinners(fx.dinners, { snapshots, dates: [D1, D2, D3], places: ch.places, choices: ch });
  };
  const kept = pool({ picks: [], later: ['juniper-table'], skip: ['hearth-and-barley'] }).map((d) => d.id);
  assert.ok(!kept.includes('juniper-table') && !kept.includes('hearth-and-barley'), JSON.stringify(kept));
  assert.ok(kept.includes('rowan-noodle-bar'), 'the other dinner places stay');
  assert.deepEqual(pool({ picks: ['rowan-noodle-bar'], later: [], skip: [] }).map((d) => [d.id, d.rank]), [['rowan-noodle-bar', 0]], 'picks are the whole pool and rank first');
});

test('evening extras: season events near the route, a saved place on an early finish, events first, never more than 3', async () => {
  const L = await loadAll();
  const { plan: p, day } = await plan(L);
  const d1 = day(D1), d2 = day(D2);
  assert.deepEqual(d1.extras, [{ kind: 'event', ref: 'copperleaf-light-up', name: 'Copperleaf Garden evening light-up', km: 0, time: '18:00', note: 'Separate evening ticket.' }], 'located by its place');
  assert.deepEqual(d2.extras.map((x) => [x.kind, x.ref]), [['event', 'ashvale-harvest-fair'], ['saved', 'glassblowers-yard']]);
  const saved = d2.extras[1];
  const finish = Math.max(...d2.legs.filter((l) => l.to === 'lodging' && !d2.meals.some((m) => m.kind === 'dinner' && l.from === m.at)).map((l) => toMin(l.arrive_at)));
  assert.ok(toMin(saved.time) >= finish, 'offered after the day is back');
  assert.ok(saved.km <= L.planner.EXTRAS.RADIUS_KM);
  for (const d of p.days) {
    for (const ref of ['far-cape-fireworks', 'harbour-night-market', 'gallery-closure']) assert.ok(!(d.extras || []).some((x) => x.ref === ref), `${d.date}: ${ref} is too far, has no location, or is a closure`);
    if (d.extras) assert.ok(!d.free.some((f) => f.note === L.planner.BACK_EARLY_NOTE), `${d.date}: extras replace the back-early line`);
  }
  // Four more light-ups beside the route on day 2: three extras, all events, nearest first; the saved place gives way.
  const busy = await plan(L, (fx) => {
    for (let i = 0; i < 4; i++) fx.trip.season.events.push({ id: `quay-lanterns-${i}`, name: `Quay lanterns ${i}`, kind: 'light_up', from: D2, to: D2, start: '18:30', lat: 34.4505 + i * 0.002, lng: 160.5505 });
  });
  const b2 = busy.day(D2);
  assert.equal(b2.extras.length, L.planner.EXTRAS.MAX);
  assert.ok(b2.extras.every((x) => x.kind === 'event'));
  assert.deepEqual(b2.extras.map((x) => x.km), [...b2.extras.map((x) => x.km)].sort((a, b) => a - b));
  // Nothing to offer: the old "back early" line stays.
  const quiet = await plan(L, (fx) => { delete fx.trip.season; fx.places.find((x) => x.id === 'glassblowers-yard').status = 'rejected'; });
  const q2 = quiet.day(D2);
  assert.equal(q2.extras, undefined);
  assert.ok(q2.free.some((f) => f.note === L.planner.BACK_EARLY_NOTE));
});

test('sunset on every day, at the night\'s lodging in the trip\'s zone', async () => {
  const L = await loadAll();
  const { plan: p, fx } = await plan(L);
  for (const d of p.days) {
    const l = fx.trip.lodging.find((x) => x.id === d.lodging_end);
    assert.match(d.sunset, /^\d\d:\d\d$/);
    assert.equal(d.sunset, L.planner.sunsetLocal(d.date, l.lat, l.lng, fx.trip.timezone));
  }
  assert.ok(toMin(p.days[0].sunset) > toMin(p.days[2].sunset), 'October evenings draw in (northern hemisphere)');
});

test('facts in the schedule: last entry and own close win over Google, visit_minutes sets the length, closed weekdays move or drop a stop', async () => {
  const L = await loadAll();
  const { plan: p, day } = await plan(L);
  const t = day(D1).stops.find((s) => s.place === 'ninefold-temple');
  assert.equal(t.last_entry, '15:30');
  assert.equal(t.minutes_source, 'official');
  assert.ok(t.minutes >= 45 && t.minutes <= 60, 'inside its own 45–60 minutes');
  assert.deepEqual(t.window, { open: '08:00', close: '16:00' }, 'its own 16:00 close, not Google\'s 17:00');
  assert.ok(toMin(t.arrive) <= toMin('15:30') && toMin(t.depart) <= toMin('16:00'));
  assert.ok(day(D1).warnings.some((w) => w.severity === 'info' && w.place === 'ninefold-temple' && /own site says it closes at 16:00; Google says 17:00/.test(w.text)));
  for (const d of p.days) for (const s of d.stops) if (!['ninefold-temple', 'saltmarsh-craft-museum'].includes(s.place)) {
    assert.equal(s.minutes_source, undefined, `${s.place}: no facts, no new field`); assert.equal(s.last_entry, undefined);
  }
  // A last entry well before Google's close: the stop starts by it.
  const early = await plan(L, (fx) => { const f = fx.places.find((x) => x.id === 'ninefold-temple').facts; f.last_entry = '11:00'; delete f.close; });
  const e = early.day(D1).stops.find((s) => s.place === 'ninefold-temple');
  assert.ok(e && toMin(e.arrive) <= toMin('11:00'), 'starts by its 11:00 last entry');
  assert.equal(e.window.close, '17:00', 'Google\'s close stands when its own site gives none');
  // closed_weekdays: closed on Mondays by its own site → never on Monday 18 October.
  assert.ok(!day(D1).stops.some((s) => s.place === 'saltmarsh-craft-museum'));
  assert.ok(p.later.some((l) => l.items.some((it) => it.place === 'saltmarsh-craft-museum')), 'dropped to a Later list when no other day can take it');
  const hinted = (fx) => { stayInTown(fx); fx.places.find((x) => x.id === 'saltmarsh-craft-museum').scheduled_hint = { date: D1 }; };
  const stay = await plan(L, hinted);
  const museumDay = stay.plan.days.find((d) => d.stops.some((s) => s.place === 'saltmarsh-craft-museum'));
  assert.ok(museumDay && museumDay.date !== D1, 'moved to another day of the stay');
  const m = museumDay.stops.find((s) => s.place === 'saltmarsh-craft-museum');
  assert.equal(m.minutes_source, 'research', 'facts without a visit length: the researched estimate');
  const noFacts = await plan(L, (fx) => { hinted(fx); delete fx.places.find((x) => x.id === 'saltmarsh-craft-museum').facts; });
  const noFactsDay = noFacts.plan.days.find((d) => d.stops.some((s) => s.place === 'saltmarsh-craft-museum'));
  assert.equal(noFactsDay && noFactsDay.date, D1, 'without its own facts it keeps its day 1 slot (Google shows it open on Mondays)');
  // A category default with facts: 'estimate'.
  const est = await plan(L, (fx) => { fx.places.find((x) => x.id === 'mistral-shrine').facts = { checked: '2027-09-28', sources: [{ url: 'https://mistral-shrine.example.com/', title: 'Shrine', accessed: '2027-09-28' }] }; });
  const sh = est.plan.days.flatMap((d) => d.stops).find((s) => s.place === 'mistral-shrine');
  assert.equal(sh.minutes_source, 'estimate');
});

test('country defaults apply only in that country', async () => {
  const L = await loadAll();
  const base = await plan(L);
  const jp = await plan(L, (fx) => { fx.trip.country = 'Japan'; });
  const stop = (pl, id) => pl.plan.days.flatMap((d) => d.stops).find((s) => s.place === id);
  assert.equal(stop(base, 'mistral-shrine').minutes, 30, 'Fictional Isles: the generic shrine default');
  assert.equal(stop(jp, 'mistral-shrine').minutes, 40, 'Japan: the country\'s shrine default');
  assert.equal(stop(jp, 'copperleaf-garden').minutes, stop(base, 'copperleaf-garden').minutes, 'a researched estimate is not replaced');
  const fr = await plan(L, (fx) => { fx.trip.country = 'France'; });
  assert.equal(stop(fr, 'mistral-shrine').minutes, 30);
});

test('crowd timing: a crowd magnet gets a quiet slot when the profile avoids crowds, none without the rule, a warning when none fits', async () => {
  const L = await loadAll();
  const { day } = await plan(L);
  const g = day(D1).stops.find((s) => s.place === 'copperleaf-garden');
  assert.equal(g.crowd_slot, 'late');
  assert.ok(toMin(g.arrive) >= toMin('17:00') - L.planner.CROWD_SLOT.LATE_MIN && toMin(g.depart) <= toMin('17:00'));
  assert.ok(day(D1).free.some((f) => f.end === g.arrive && /quieter time at Copperleaf Garden/.test(f.note)));
  // A plain boolean on a hand-written place works like the C11 flag the fixture carries.
  const flagged = await plan(L, (fx) => { const x = fx.places.find((q) => q.id === 'copperleaf-garden'); delete x.flags; x.crowd_magnet = true; });
  assert.equal(flagged.day(D1).stops.find((s) => s.place === 'copperleaf-garden').crowd_slot, 'late');
  // No crowd rule in the profile: no slot, no warning.
  const free = await plan(L, (fx) => { fx.profile.avoid = ['long hikes']; });
  const fg = free.plan.days.flatMap((d) => d.stops).find((s) => s.place === 'copperleaf-garden');
  assert.equal(fg.crowd_slot, undefined);
  assert.ok(!free.plan.days.some((d) => d.warnings.some((w) => /quieter slot/.test(w.text))));
  // A visit too long for either slot (95 min with high interest): kept where it fits, with a warning.
  const long = await plan(L, (fx) => { fx.profile.interests = { garden: 'high' }; });
  const lg = long.day(D1).stops.find((s) => s.place === 'copperleaf-garden');
  assert.ok(lg, 'never dropped for this rule');
  assert.equal(lg.crowd_slot, undefined);
  assert.ok(long.day(D1).warnings.some((w) => w.place === 'copperleaf-garden' && /no quieter slot fitted/.test(w.text)));
});

test('the moving-day fixture: loads with its dinner pool, stays out of listFixtures, invented ids and reserved domains only', async () => {
  const L = await loadAll();
  assert.deepEqual(L.fixtures.listFixtures(), ['transit-city', 'driving-loop', 'hill-town']);
  assert.deepEqual(L.fixtures.C11_FIXTURE_NAMES, ['moving-day']);
  const fx = L.fixtures.loadFixture('moving-day');
  assert.deepEqual(Object.keys(fx).sort(), ['calibration', 'dinners', 'estimates', 'name', 'notes', 'places', 'profile', 'routes', 'snapshots', 'trip']);
  fx.trip.title = 'changed';
  assert.notEqual(L.fixtures.loadFixture('moving-day').trip.title, 'changed', 'fresh copies');
  const text = JSON.stringify(fx);
  for (const url of text.match(/https?:\/\/[^"]+/g)) assert.match(url, /^https:\/\/[a-z0-9.-]+\.example\.(com|org)\//, url);
  for (const s of fx.snapshots) assert.match(s.place_id, /^FixtureMd/);
  assert.equal(fx.trip.country, 'Fictional Isles');
  const ids = new Set(fx.snapshots.map((s) => s.place_id));
  for (const p of [...fx.places, ...fx.dinners]) assert.ok(ids.has(p.place_id), `${p.id} has a snapshot`);
});

// Developed by: LightAISolutions

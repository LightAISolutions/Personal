'use strict';
// packs/tour-guide planner — the owner's shortlist choices (input.choices = { picks, later, skip }) on both fixture
// trips: skipped places are never scheduled, kept places land in "Saved by you" with code owner_choice, picks-only
// plans stay feasible under the Phase 3 property set, un-picked candidates enter no day, replanDays keeps the choices,
// and without choices the plan is exactly what it was before choices existed.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadAll = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await import('../packs/tour-guide/planner/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs'),
  later: await import('../packs/tour-guide/later/index.mjs')
});
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const NOW = '2027-04-30T09:00:00Z';
const json = (x) => JSON.stringify(x);

/** Per fixture: picks (incl. edge-case carriers), kept for later, skipped; the rest is not picked. */
const CHOICES = {
  'transit-city': { picks: ['lantern-museum', 'maritime-archive', 'clock-tower-climb', 'saffron-row-market', 'moonlight-night-market', 'bluebell-ceramics-studio', 'old-town-lanes'],
    later: ['signal-hill-lookout', 'tidewater-botanic-garden'], skip: ['harbour-district', 'tram-depot-gallery'] },
  'driving-loop': { picks: ['heron-ridge-trail', 'cairn-point-overlook', 'gullhaven-lighthouse', 'brackenford-harbour-market', 'marrow-bay-abbey', 'northcape-sea-stacks', 'blackwater-falls'],
    later: ['seal-cove', 'kestrel-farm-shop'], skip: ['wrenwick-village', 'tollby-village'] }
};

async function plan(L, name, extra = {}) {
  const fx = L.fixtures.loadFixture(name);
  const ledger = L.maps.createLedger();
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger });
  const input = { ...fx, maps, build_id: `choices-${name}`, now: NOW, seed: 7, ...extra };
  return { fx, ledger, input, plan: await L.planner.planTrip(input) };
}

/** The Phase 3 property set (integration test) on a plan built with choices. */
function properties(L, name, fx, p) {
  const v = L.schemas.validate(p, 'plan');
  assert.ok(v.ok, `${name}: plan validates: ${json(v.errors.slice(0, 3))}`);
  const byId = new Map(fx.places.map((x) => [x.id, x]));
  for (const l of fx.trip.lodging) byId.set(l.id, l);
  const snaps = Array.isArray(fx.snapshots) ? fx.snapshots : Object.values(fx.snapshots);
  const snapOf = (id) => snaps.find((s) => s.place_id === byId.get(id).place_id);
  const dayStart = toMin(fx.trip.day_start), dayEnd = toMin(fx.trip.day_end);
  for (const day of p.days) {
    for (const s of day.stops) {
      const h = L.planner.hoursOn(snapOf(s.place), day.date);
      assert.ok(!['closed', 'closed_business'].includes(h.status), `${name} ${day.date}: ${s.place} not on a closed day`);
      if (h.windows.length) assert.ok(h.windows.some((w) => toMin(s.arrive) >= w.open && toMin(s.depart) <= w.close), `${name}: ${s.place} inside its hours`);
      else assert.ok(day.warnings.some((w) => w.code === 'hours_unknown' && w.place === s.place));
      assert.ok(toMin(s.arrive) >= dayStart && toMin(s.depart) <= dayEnd, `${name}: ${s.place} inside the day`);
      const booking = byId.get(s.place).booking;
      if (booking) { assert.equal(day.date, booking.date); assert.equal(s.arrive, booking.time); }
    }
    if (day.stops.length) assert.equal(day.legs.length, day.stops.length + 1); else assert.ok(day.legs.length <= 1, 'a day without stops has at most the lodging move');
    const pid = (ref, lodging) => byId.get(ref === 'lodging' ? lodging : ref).place_id;
    for (const leg of day.legs) {
      if (leg.estimated) continue; // estimated TRANSIT legs (WP-3e) are not in the travel table
      const want = L.fixtures.fixtureTravel(fx, day.mode, pid(leg.from, day.lodging_start), pid(leg.to, day.lodging_end));
      assert.ok(Math.abs(leg.minutes - want.durationSec / 60) <= 1, `${name}: leg ${leg.from}→${leg.to} matches the recorded time`);
    }
    const last = day.legs[day.legs.length - 1];
    if (last && toMin(last.arrive_at) > dayEnd) assert.ok(day.warnings.some((w) => w.code === 'over_long_day'));
  }
}

const scheduledIn = (p) => new Set(p.days.flatMap((d) => d.stops.map((s) => s.place)));
const listed = (p) => new Map(p.later.flatMap((l) => l.items.map((it) => [it.place, { list: l.name, code: it.code, reason: it.reason }])));

test('choices on both fixtures: picks are the pool, kept places go to "Saved by you", skipped places are rejected', async () => {
  const L = await loadAll();
  for (const name of L.fixtures.listFixtures()) {
    const choices = CHOICES[name];
    const { fx, plan: p } = await plan(L, name, { choices });
    properties(L, name, fx, p);
    const sched = scheduledIn(p), lists = listed(p);
    const status = new Map(p.places.map((x) => [x.id, x.status]));
    for (const id of choices.skip) {
      assert.ok(!sched.has(id) && !lists.has(id), `${name}: skipped ${id} is in no day and no list`);
      assert.equal(status.get(id), 'rejected');
    }
    for (const id of choices.later) {
      assert.deepEqual(lists.get(id), { list: L.later.SAVED_BY_YOU, code: 'owner_choice', reason: L.planner.OWNER_CHOICE_REASON }, `${name}: ${id}`);
      assert.equal(status.get(id), 'saved-for-later');
      assert.ok(!sched.has(id));
    }
    for (const id of choices.picks) {
      assert.ok(sched.has(id) !== lists.has(id), `${name}: pick ${id} is scheduled xor in a Later list`);
      if (lists.has(id)) assert.equal(lists.get(id).list, L.planner.DIDNT_FIT, `${name}: a pick that did not fit says why`);
      assert.equal(status.get(id), sched.has(id) ? 'scheduled' : 'saved-for-later');
    }
    const chosen = new Set([...choices.picks, ...choices.later, ...choices.skip]);
    const unpicked = fx.places.filter((x) => !chosen.has(x.id));
    assert.ok(unpicked.length >= 3, 'the fixture leaves places un-picked');
    for (const x of unpicked) {
      assert.ok(!sched.has(x.id) && !lists.has(x.id), `${name}: un-picked ${x.id} enters no day and no list`);
      assert.equal(status.get(x.id), 'candidate');
    }
    assert.ok(sched.size >= 3, `${name}: picks-only plan schedules places`);
    assert.deepEqual(p.choices, { picks: [...choices.picks].sort(), later: [...choices.later].sort(), skip: [...choices.skip].sort() });
    assert.ok(!p.places.some((x) => x.status === 'chosen'), 'chosen is an input status; the plan resolves it');
  }
  const tc = await plan(L, 'transit-city', { choices: CHOICES['transit-city'] });
  const tl = listed(tc.plan);
  assert.equal(tl.get('moonlight-night-market').code, 'outside_day', 'a picked place keeps the planner\'s own reason when it cannot fit');
  assert.equal(scheduledIn(tc.plan).has('clock-tower-climb') && tc.plan.days.find((d) => d.date === '2027-05-13').stops.some((s) => s.place === 'clock-tower-climb'), true, 'a picked booking keeps its date');
  const dl = await plan(L, 'driving-loop', { choices: CHOICES['driving-loop'] });
  assert.equal(listed(dl.plan).get('northcape-sea-stacks').code, 'too_far');
});

test('without choices the plan is unchanged; null equals absent; empty choices change nothing but the record', async () => {
  const L = await loadAll();
  for (const name of L.fixtures.listFixtures()) {
    const a = (await plan(L, name)).plan;
    const b = (await plan(L, name, { choices: null })).plan;
    const c = (await plan(L, name, { choices: {} })).plan;
    assert.equal(json(a), json(b), `${name}: choices null = absent`);
    assert.ok(!('choices' in a), `${name}: no choices key without choices`);
    assert.deepEqual(c.choices, { picks: [], later: [], skip: [] });
    const { choices, ...rest } = c;
    assert.equal(json(rest), json(a), `${name}: empty choices pool every candidate exactly as before`);
  }
});

test('a picked place may come from any status; "chosen" input status is pooled; a pick-only list narrows the budget', async () => {
  const L = await loadAll();
  const base = await plan(L, 'transit-city');
  const fx = L.fixtures.loadFixture('transit-city');
  const places = fx.places.map((x) => (x.id === 'signal-hill-lookout' ? { ...x, status: 'saved-for-later' } : x.id === 'lantern-museum' ? { ...x, status: 'chosen' } : x));
  const resurrect = await plan(L, 'transit-city', { places, choices: { picks: ['signal-hill-lookout', 'lantern-museum', 'old-town-lanes'] } });
  const sched = scheduledIn(resurrect.plan);
  assert.ok(sched.has('signal-hill-lookout') && sched.has('lantern-museum') && sched.has('old-town-lanes'));
  assert.equal(sched.size, 3);
  const noChoices = await plan(L, 'transit-city', { places });
  assert.ok(scheduledIn(noChoices.plan).has('lantern-museum'), 'status "chosen" is pooled without choices too');
  assert.equal(listed(noChoices.plan).get('signal-hill-lookout').list, L.planner.NEXT_TIME);
  const small = await L.planner.estimateBudget({ ...resurrect.input });
  const full = await L.planner.estimateBudget({ ...base.input });
  assert.ok(small.skus['routes.route_matrix.essentials'] < full.skus['routes.route_matrix.essentials'], 'estimateBudget honours the picks');
});

test('replanDays keeps the recorded choices; explicit choices win; promoted places join the picks', async () => {
  const L = await loadAll();
  for (const name of L.fixtures.listFixtures()) {
    const { input, plan: p } = await plan(L, name, { choices: CHOICES[name] });
    const date = p.days.find((d) => d.stops.length).date;
    const { choices, ...noChoiceInput } = input;
    const re = await L.planner.replanDays(p, [date], { ...noChoiceInput, places: p.places });
    for (const d of re.days) if (d.date !== date) assert.equal(json(d), json(p.days.find((x) => x.date === d.date)), `${name} ${d.date} byte-identical`);
    assert.deepEqual(re.choices, p.choices, `${name}: recorded choices carried over`);
    assert.ok(L.schemas.validate(re, 'plan').ok, `${name}: re-planned plan validates`);
    const unpicked = re.places.filter((x) => x.status === 'candidate').map((x) => x.id);
    for (const id of unpicked) assert.ok(!scheduledIn(re).has(id), `${name}: un-picked ${id} stays out after a re-plan`);
    assert.equal(listed(re).get(CHOICES[name].later[0]).code, 'owner_choice', `${name}: kept item survives the re-plan`);
  }
  // promote a kept place onto a date: it joins the picks and the day is re-planned with it
  const { input, plan: p } = await plan(L, 'transit-city', { choices: CHOICES['transit-city'] });
  const { choices, ...rest } = input;
  const to = '2027-05-12';
  const moved = L.later.promote({ lists: p.later, places: p.places, place: 'signal-hill-lookout', to_date: to });
  const re = await L.planner.replanDays({ ...p, later: moved.lists, places: moved.places }, moved.affected_days, { ...rest, places: moved.places });
  assert.ok(re.days.find((d) => d.date === to).stops.some((s) => s.place === 'signal-hill-lookout'), 'the promoted place is scheduled on its date');
  assert.ok(re.choices.picks.includes('signal-hill-lookout') && !re.choices.later.includes('signal-hill-lookout'));
  assert.ok(L.schemas.validate(re, 'plan').ok, json(L.schemas.validate(re, 'plan').errors.slice(0, 3)));
  // explicit choices on a re-plan: skip a place of the re-planned day
  const day = p.days.find((d) => d.stops.length >= 2);
  const victim = day.stops[0].place;
  const explicit = { picks: CHOICES['transit-city'].picks.filter((x) => x !== victim), later: CHOICES['transit-city'].later, skip: [...CHOICES['transit-city'].skip, victim] };
  const re2 = await L.planner.replanDays(p, [day.date], { ...rest, places: p.places, choices: explicit });
  assert.ok(!scheduledIn(re2).has(victim) && !listed(re2).has(victim));
  assert.equal(re2.places.find((x) => x.id === victim).status, 'rejected');
  assert.ok(L.schemas.validate(re2, 'plan').ok);
  const other = p.days.find((d) => d.date !== day.date && d.stops.length).stops[0].place;
  await assert.rejects(L.planner.replanDays(p, [day.date], { ...rest, places: p.places, choices: { skip: [other] } }), /planner: choices keep or skip ".*", which is scheduled on .*re-plan that day too/);
  const off = await L.planner.replanDays(p, [day.date], { ...rest, places: p.places, choices: null });
  assert.ok(!('choices' in off), 'choices: null drops the recorded choices');
});

test('bad choices are refused with planner: errors naming the slugs', async () => {
  const L = await loadAll();
  const bad = async (choices, re) => assert.rejects(plan(L, 'transit-city', { choices }), re);
  await bad({ picks: ['lantern-museum', 'no-such-place', 'nor-this'] }, /planner: choices name unknown place\(s\): no-such-place, nor-this/);
  await bad({ picks: ['lantern-museum'], skip: ['lantern-museum'] }, /planner: "lantern-museum" is in both choices.picks and choices.skip/);
  await bad({ picks: 'lantern-museum' }, /planner: choices.picks must be an array/);
  await bad({ picks: ['Lantern Museum'] }, /not a place slug/);
  await bad({ pick: [] }, /unknown key\(s\) pick/);
  await bad(['lantern-museum'], /choices must be an object/);
  const dup = await plan(L, 'transit-city', { choices: { picks: ['lantern-museum', 'lantern-museum'] } });
  assert.deepEqual(dup.plan.choices.picks, ['lantern-museum'], 'a repeated slug within one list counts once');
});

// Developed by: LightAISolutions

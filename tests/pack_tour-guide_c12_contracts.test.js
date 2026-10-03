'use strict';
// Tour Guide schemas — Contract C12 (WP-12a): every new field is accepted at its bounds and refused one past them or
// with an unknown key — trip `country_code`, lodging `area` and `access`, place facts `local_name`, `address`, `access`
// (the schema and normalizeFacts), DayPlan `leave_by`, `areas`, a stop's `visited` and the reserved point "here" — and
// every older record still validates. factsLines reads none of the new fields.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const S = () => import('../packs/tour-guide/schemas/index.mjs');
const F = () => import('../packs/tour-guide/facts/index.mjs');
const FX = () => import('../packs/tour-guide/fixtures/index.mjs');
const copy = (x) => JSON.parse(JSON.stringify(x));
const str = (n, c = 'x') => c.repeat(n);
const ACCESS_MAX = [{ station: str(60, 's'), line: str(60, 'l'), exit: str(20, 'e'), walk_minutes: 60 }, { station: 'B', walk_minutes: 0 }];
const ACCESS_BAD = [
  ['three entries', [{ station: 'A' }, { station: 'B' }, { station: 'C' }]],
  ['no station', [{ line: 'Coastal Line' }]],
  ['empty station', [{ station: '' }]],
  ['station 61', [{ station: str(61) }]],
  ['line 61', [{ station: 'A', line: str(61) }]],
  ['empty line', [{ station: 'A', line: '' }]],
  ['exit 21', [{ station: 'A', exit: str(21) }]],
  ['walk 61', [{ station: 'A', walk_minutes: 61 }]],
  ['walk -1', [{ station: 'A', walk_minutes: -1 }]],
  ['walk 1.5', [{ station: 'A', walk_minutes: 1.5 }]],
  ['walk as text', [{ station: 'A', walk_minutes: '5' }]],
  ['unknown key', [{ station: 'A', platform: '3' }]],
  ['not an array', { station: 'A' }],
  ['same station and line', [{ station: 'Quillmere Central', line: 'Coastal Line' }, { station: ' quillmere  central', line: 'COASTAL LINE', exit: 'East' }]],
  ['same station, no line twice', [{ station: 'Tarnwick' }, { station: 'tarnwick', walk_minutes: 3 }]]
];

async function base() {
  const fx = (await FX()).loadFixture('rehearsal-day');
  return { trip: fx.trip, place: fx.places.find((p) => p.id === 'quillmere-tide-museum'), fx };
}
const ok = (r, what) => assert.deepEqual(r.errors, [], what);
const bad = (r, what) => assert.equal(r.ok, false, `${what} must be refused`);

test('trip: country_code is two capital letters; a lodging area is 1–60 characters', async () => {
  const { validate } = await S();
  const { trip } = await base();
  ok(validate(trip, 'trip'), 'the fixture trip');
  const t = (fn) => { const x = copy(trip); fn(x); return validate(x, 'trip'); };
  ok(t((x) => { x.country_code = 'AA'; }), 'AA');
  ok(t((x) => { delete x.country_code; }), 'no country_code');
  for (const v of ['zz', 'Z', 'ZZZ', 'Z1', '', 12, null]) bad(t((x) => { x.country_code = v; }), `country_code ${JSON.stringify(v)}`);
  ok(t((x) => { x.lodging[0].area = 'Q'; x.lodging[1].area = str(60); }), 'area 1 and 60');
  ok(t((x) => { delete x.lodging[0].area; }), 'no area');
  for (const v of ['', str(61), 7]) bad(t((x) => { x.lodging[0].area = v; }), `area ${JSON.stringify(v)}`);
  bad(t((x) => { x.lodging[0].town = 'Quillmere'; }), 'an unknown lodging key');
});

test('trip: a lodging access list at its bounds passes; one past any bound, an unknown key or a repeated station is refused', async () => {
  const { validate } = await S();
  const { trip } = await base();
  const t = (access) => { const x = copy(trip); x.lodging[0].access = access; return validate(x, 'trip'); };
  ok(t(ACCESS_MAX), 'the largest access list');
  ok(t([]), 'an empty list');
  ok(t([{ station: 'Quillmere Central', line: 'Coastal Line' }, { station: 'Quillmere Central', line: 'Harbour Line' }]), 'one station, two lines');
  for (const [what, v] of ACCESS_BAD) bad(t(v), `lodging access: ${what}`);
  const dup = t(ACCESS_BAD.find(([w]) => w === 'same station and line')[1]);
  assert.ok(dup.errors.some((e) => e.path === '/lodging/0/access/1'), JSON.stringify(dup.errors));
});

test('place facts: local_name 1–80, address 1–160, access as for a lodging — in the Place schema and in normalizeFacts', async () => {
  const { validate } = await S();
  const { normalizeFacts } = await F();
  const { place } = await base();
  ok(validate(place, 'place'), 'the fixture place');
  assert.ok(normalizeFacts(place.facts).ok);
  const both = (fn, want, what) => {
    const p = copy(place); fn(p.facts);
    const viaPlace = validate(p, 'place'), viaFacts = normalizeFacts(p.facts);
    if (want) { ok(viaPlace, what); assert.deepEqual(viaFacts.errors, [], what); } else { bad(viaPlace, what); bad(viaFacts, what); }
  };
  both((f) => { f.local_name = 'q'; f.address = 'a'; }, true, 'one character each');
  both((f) => { f.local_name = str(80, '汐'); f.address = str(160); }, true, 'local_name 80, address 160');
  both((f) => { f.local_name = str(81, '汐'); }, false, 'local_name 81');
  both((f) => { f.address = str(161); }, false, 'address 161');
  both((f) => { f.local_name = 7; }, false, 'local_name as a number');
  both((f) => { f.access = ACCESS_MAX; }, true, 'the largest access list');
  for (const [what, v] of ACCESS_BAD) both((f) => { f.access = v; }, false, `facts access: ${what}`);
  both((f) => { f.station = 'Quillmere Central'; }, false, 'an unknown facts key');
  const dup = normalizeFacts({ ...copy(place.facts), access: ACCESS_BAD.find(([w]) => w === 'same station and line')[1] });
  assert.deepEqual(dup.errors.map((e) => e.path), ['/access/1']);
});

test('normalizeFacts trims the new strings and keeps them; factsLines reads none of them', async () => {
  const { normalizeFacts, factsLines } = await F();
  const { place } = await base();
  const r = normalizeFacts({ ...copy(place.facts), local_name: '  潮見記念館 ', address: ' 4 Tide Row ', access: [{ station: ' Quillmere Central ', walk_minutes: 4 }] });
  assert.ok(r.ok);
  assert.equal(r.facts.local_name, '潮見記念館');
  assert.equal(r.facts.address, '4 Tide Row');
  assert.deepEqual(r.facts.access, [{ station: 'Quillmere Central', walk_minutes: 4 }]);
  const FULL = JSON.parse(readFileSync(join(__dirname, '../packs/tour-guide/facts/fixtures/facts-fixture-full.json'), 'utf8'));
  const opts = { now: '2027-10-30', diet: ['vegetarian'] };
  for (const facts of [FULL.garden, FULL.restaurant, place.facts]) {
    const old = copy(facts); delete old.local_name; delete old.address; delete old.access;
    const added = { ...copy(old), local_name: 'ローカル', address: '9 Any Row', access: ACCESS_MAX };
    assert.deepEqual(factsLines(added, opts), factsLines(old, opts), 'the display lines do not change');
  }
});

/** A planned day of the C12 fixture and the same day re-planned from a shared location (visited stop + "here"). */
let days = null;
async function plannedDays() {
  if (days) return days;
  const fixtures = await FX(), maps = await import('../kits/maps/index.mjs'), planner = await import('../packs/tour-guide/planner/index.mjs');
  const fx = fixtures.loadFixture('rehearsal-day');
  const client = () => maps.createMapsClient({ transport: maps.createMockTransport(fixtures.createFixtureResponder(fx)), ledger: maps.createLedger() });
  const input = { ...fx, build_id: 'c12-contracts', now: '2027-10-30T09:00:00Z', seed: 7 };
  const plan = await planner.planTrip({ ...input, maps: client() });
  const day = plan.days[0], a = day.stops[0].place;
  const loc = fx.snapshots.find((s) => s.place_id === fx.places.find((p) => p.id === a).place_id).location;
  const re = await planner.replanDays(plan, [day.date], { ...input, places: plan.places, maps: client(), from: { time: '11:40', point: { lat: loc.lat + 0.0002, lng: loc.lng } }, visited: [a] });
  days = { plan, day, restarted: re.days[0] };
  return days;
}

test('DayPlan: leave_by (the first leg\'s departure), areas (1–2 towns of 1–60), visited stops and "here" legs', async () => {
  const { validate } = await S();
  const { day, restarted } = await plannedDays();
  ok(validate(day, 'day-plan'), 'a planned day');
  ok(validate(restarted, 'day-plan'), 'a re-planned day (visited stop, a leg from "here")');
  assert.equal(restarted.stops[0].visited, true);
  assert.ok(restarted.legs.some((l) => l.from === 'here'));
  const d = (fn, src = day) => { const x = copy(src); fn(x); return validate(x, 'day-plan'); };
  ok(d((x) => { delete x.leave_by; delete x.areas; }), 'without the new fields (an older day)');
  bad(d((x) => { x.leave_by = '09:36'; }), 'a leave_by that is not the first leg\'s departure');
  bad(d((x) => { x.leave_by = '9:35'; }), 'leave_by 9:35');
  bad(d((x) => { x.legs = []; x.stops = []; }), 'leave_by on a day without legs');
  ok(d((x) => { x.areas = ['Q']; }), 'one area of one character');
  ok(d((x) => { x.areas = [str(60), 'Tarnwick']; }), 'two areas, 60 characters');
  for (const v of [[], ['A', 'B', 'C'], [''], [str(61)], ['Quillmere', 'Quillmere'], 'Quillmere', [7]]) bad(d((x) => { x.areas = v; }), `areas ${JSON.stringify(v)}`);
  ok(d((x) => { x.stops[0].visited = true; }), 'a visited first stop');
  bad(d((x) => { x.stops[0].visited = false; }), 'visited false');
  bad(d((x) => { x.stops[1].visited = true; }), 'a visited stop after one that was not');
  bad(d((x) => { x.stops[0].done = true; }), 'an unknown stop key');
  bad(d((x) => { x.morning = '09:35'; }), 'an unknown day key');
  bad(d((x) => { x.legs[0].to = 'here'; }, restarted), '"here" as a destination');
  bad(d((x) => { const k = x.legs.findIndex((l) => l.from === 'here'); x.legs[k + 1].from = 'here'; }, restarted), 'a second "here"');
  bad(d((x) => { x.stops[1].place = 'here'; }, restarted), '"here" as a stop');
});

test('every older trip, place and dinner record still validates', async () => {
  const { validate } = await S();
  const fixtures = await FX();
  for (const name of [...fixtures.FIXTURE_NAMES, ...fixtures.C11_FIXTURE_NAMES, ...fixtures.JOURNEY_FIXTURE_NAMES]) {
    const fx = fixtures.loadFixture(name);
    ok(validate(fx.trip, 'trip'), `${name} trip`);
    for (const p of [...fx.places, ...(fx.dinners || [])]) ok(validate(p, 'place'), `${name} ${p.id}`);
  }
});

test('an older plan validates as it was (no leave_by, no areas)', async () => {
  const { validate } = await S();
  const { plan } = await plannedDays();
  const old = copy(plan);
  for (const x of old.days) { delete x.leave_by; delete x.areas; }
  ok(validate(old, 'plan'), 'the plan without the C12 fields');
  ok(validate(plan, 'plan'), 'and with them');
});

// Developed by: LightAISolutions

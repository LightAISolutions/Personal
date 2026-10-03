'use strict';
// C11 inputs (WP-11b): the trip schema's day_overrides and season, the place schema's facts and the two new flags, and the
// checkTrip / checkPlace rules (override dates unique and inside the trip, a day at least 2 hours long, event ids unique,
// from ≤ to, visit_minutes.min ≤ max). Every old fixture trip and place still validates.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const S = () => import('../packs/tour-guide/schemas/index.mjs');
const FX = () => import('../packs/tour-guide/fixtures/index.mjs');
const FACTS = JSON.parse(readFileSync(join(__dirname, '../packs/tour-guide/facts/fixtures/facts-fixture-full.json'), 'utf8'));
const SEASON = JSON.parse(readFileSync(join(__dirname, '../packs/tour-guide/season/fixtures/season-fixture-full.json'), 'utf8')).season;
const copy = (x) => JSON.parse(JSON.stringify(x));

async function c11Trip() {
  const { loadFixture } = await FX();
  const trip = copy(loadFixture('driving-loop').trip); // 2027-06-08 … 2027-06-11, 09:00–18:30
  trip.day_overrides = [
    { date: '2027-06-08', start: { name: 'Fernhallow Station', lat: 52.1, lng: -3.2, time: '12:10' }, bags: 'hotel', bags_note: 'Leave the bags at the inn first' },
    { date: '2027-06-10', day_start: '07:30', day_end: '16:00', note: 'Early start for the tide walk' },
    { date: '2027-06-11', end: { name: 'Fernhallow Station', place_id: 'FixtureStationFern', lat: 52.1, lng: -3.2, time: '15:40' }, bags: 'locker' }
  ];
  trip.season = copy(SEASON);
  return trip;
}

test('C11 trip: a trip with day overrides and a season sheet validates; every old fixture trip and place still validates', async () => {
  const { validate } = await S(), { listFixtures, loadFixture } = await FX();
  const trip = await c11Trip();
  assert.deepEqual(validate(trip, 'trip'), { ok: true, errors: [] });
  for (const name of listFixtures()) {
    const f = loadFixture(name);
    assert.equal(validate(f.trip, 'trip').ok, true, name + ' trip');
    for (const p of f.places) assert.equal(validate(p, 'place').ok, true, `${name} place ${p.id}`);
  }
});

test('C11 trip: each out-of-bounds override or season value and each unknown key is refused; checkTrip enforces the cross-field rules', async () => {
  const { validate } = await S();
  const base = await c11Trip();
  const o = (x, i = 0) => x.day_overrides[i];
  const cases = [
    ['/day_overrides', (x) => { x.day_overrides = Array.from({ length: 32 }, () => ({ date: '2027-06-09' })); }],
    ['/day_overrides/0', (x) => { delete o(x).date; }],
    ['/day_overrides/0/date', (x) => { o(x).date = '2027-06-31'; }],
    ['/day_overrides/0/start', (x) => { delete o(x).start.time; }],
    ['/day_overrides/0/start/name', (x) => { o(x).start.name = ''; }],
    ['/day_overrides/0/start/name', (x) => { o(x).start.name = 'n'.repeat(121); }],
    ['/day_overrides/0/start/lat', (x) => { o(x).start.lat = -91; }],
    ['/day_overrides/0/start/time', (x) => { o(x).start.time = '12.10'; }],
    ['/day_overrides/0/start/address', (x) => { o(x).start.address = '1 Quay Road'; }],
    ['/day_overrides/0/bags', (x) => { o(x).bags = 'porter'; }],
    ['/day_overrides/0/bags_note', (x) => { o(x).bags_note = 'b'.repeat(161); }],
    ['/day_overrides/1/note', (x) => { o(x, 1).note = 'n'.repeat(201); }],
    ['/day_overrides/1/day_start', (x) => { o(x, 1).day_start = '7:30'; }],
    ['/day_overrides/1/pace', (x) => { o(x, 1).pace = 'relaxed'; }],
    ['/season', (x) => { delete x.season.checked; }],
    ['/season/sources', (x) => { x.season.sources = []; }],
    ['/season/weather/rain_days', (x) => { x.season.weather.rain_days = 40; }],
    ['/season/bloom', (x) => { x.season.bloom = Array.from({ length: 7 }, () => x.season.bloom[1]); }],
    ['/season/events/0/kind', (x) => { x.season.events[0].kind = 'parade'; }],
    ['/season/events/0/url', (x) => { x.season.events[0].url = 'http://gull-hollow-garden.example.org/'; }],
    ['/season/extra', (x) => { x.season.extra = true; }],
    // checkTrip (cross-field)
    ['/day_overrides/1/date', (x) => { o(x, 1).date = o(x).date; }],
    ['/day_overrides/0/date', (x) => { o(x).date = '2027-06-12'; }],
    ['/day_overrides/0/date', (x) => { o(x).date = '2027-06-07'; }],
    ['/day_overrides/1/day_end', (x) => { o(x, 1).day_end = '09:29'; }],
    ['/day_overrides/0/day_end', (x) => { o(x).day_end = '14:00'; }],
    ['/day_overrides/2/end/time', (x) => { o(x, 2).end.time = '10:59'; }],
    ['/season/checked', (x) => { x.season.checked = '2031-02-29'; }],
    ['/season/events/1/id', (x) => { x.season.events[1].id = 'lantern-walk'; }],
    ['/season/events/0/to', (x) => { x.season.events[0].to = '2031-11-09'; }],
    ['/season/bloom/0/to', (x) => { x.season.bloom[0].to = '2031-11-14'; }]
  ];
  for (const [path, mutate] of cases) {
    const x = copy(base);
    mutate(x);
    const r = validate(x, 'trip');
    assert.equal(r.ok, false, `${path} should be refused`);
    assert.ok(r.errors.some((e) => e.path === path), `${path}: got ${JSON.stringify(r.errors)}`);
  }
  // the 2-hour rule counts from the day's real start: 12:10 start, trip end 18:30 is fine; an override's own hours win
  const ok = copy(base);
  o(ok, 1).day_end = '09:30';
  assert.equal(validate(ok, 'trip').ok, true, '07:30–09:30 is exactly two hours');
  const anchor = copy(base);
  o(anchor).day_start = '17:00';
  assert.equal(validate(anchor, 'trip').ok, true, 'start.time wins over the override\'s day_start');
});

test('C11 place: facts and the two new flags validate; checkPlace refuses min > max and a repeated weekday; old places unchanged', async () => {
  const { validate } = await S(), { loadFixture } = await FX();
  const old = loadFixture('transit-city').places[0];
  const place = { ...copy(old), facts: copy(FACTS.restaurant), flags: ['local_favourite', 'crowd_magnet', 'unproven'] };
  assert.deepEqual(validate(place, 'place'), { ok: true, errors: [] });
  assert.deepEqual(validate({ ...copy(old), facts: copy(FACTS.garden) }, 'place'), { ok: true, errors: [] });
  const cases = [
    ['/facts/visit_minutes', (x) => { x.facts.visit_minutes = { min: 120, max: 90 }; }],
    ['/facts/closed_weekdays', (x) => { x.facts.closed_weekdays = [3, 3]; }],
    ['/facts/checked', (x) => { x.facts.checked = '2031-04-31'; }],
    ['/facts/menu/checked', (x) => { x.facts.menu.checked = '2031-02-30'; }],
    ['/facts/sources/0/accessed', (x) => { x.facts.sources[0].accessed = '2031-06-31'; }],
    ['/facts/visit_minutes/max', (x) => { x.facts.visit_minutes.max = 800; }],
    ['/facts/menu/fits', (x) => { x.facts.menu.fits = 'mostly'; }],
    ['/facts/hours', (x) => { x.facts.hours = '09:00–17:00'; }],
    ['/flags/0', (x) => { x.flags = ['famous']; }],
    ['/flags', (x) => { x.flags = ['unproven', 'tourist_oriented', 'closed_day_conflict', 'local_favourite', 'crowd_magnet', 'unproven']; }]
  ];
  for (const [path, mutate] of cases) {
    const x = copy(place);
    mutate(x);
    const r = validate(x, 'place');
    assert.equal(r.ok, false, `${path} should be refused`);
    assert.ok(r.errors.some((e) => e.path === path), `${path}: got ${JSON.stringify(r.errors)}`);
  }
});

// Developed by: LightAISolutions

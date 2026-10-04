'use strict';
// packs/tour-guide/season — the C11 season sheet (WP-11b): the normaliser accepts a full invented sheet and refuses every
// out-of-bounds value and unknown key; events and bloom on a date; single-bloom gardens out of season on both hemispheres.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const S = () => import('../packs/tour-guide/season/index.mjs');
const SEASON = JSON.parse(readFileSync(join(__dirname, '../packs/tour-guide/season/fixtures/season-fixture-full.json'), 'utf8')).season;
const copy = (x) => JSON.parse(JSON.stringify(x));

test('normalizeSeason: the full invented sheet passes unchanged; strings trimmed, nulls dropped, enum words lower-cased; input untouched', async () => {
  const s = await S();
  const r = s.normalizeSeason(SEASON);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.season, SEASON);
  const raw = copy(SEASON);
  raw.weather.text = '  Cool  ';
  raw.bloom[0].kind = 'Autumn_Leaves';
  raw.bloom[0].status = 'PEAK';
  raw.events[1].kind = 'Market';
  raw.events[1].note = null;
  const before = copy(raw);
  const n = s.normalizeSeason(raw);
  assert.equal(n.ok, true, JSON.stringify(n.errors));
  assert.equal(n.season.weather.text, 'Cool');
  assert.equal(n.season.bloom[0].kind, 'autumn_leaves');
  assert.equal(n.season.bloom[0].status, 'peak');
  assert.equal(n.season.events[1].kind, 'market');
  assert.equal('note' in n.season.events[1], false);
  assert.deepEqual(raw, before);
  assert.equal(s.normalizeSeason('autumn').ok, false);
});

test('normalizeSeason: each out-of-bounds value and each unknown key is refused at its path', async () => {
  const s = await S();
  const long = (n) => 'x'.repeat(n);
  const ev = (x) => x.events[0];
  const cases = [
    ['/', (x) => { delete x.sources; }],
    ['/checked', (x) => { x.checked = '2031-13-01'; }],
    ['/sources', (x) => { x.sources = []; }],
    ['/sources', (x) => { x.sources = Array.from({ length: 11 }, () => x.sources[0]); }],
    ['/sources/0/url', (x) => { x.sources[0].url = 'ftp://weather.example.org/'; }],
    ['/sources/0/title', (x) => { x.sources[0].title = long(121); }],
    ['/weather/text', (x) => { x.weather.text = long(201); }],
    ['/weather', (x) => { delete x.weather.text; }],
    ['/weather/high_c', (x) => { x.weather.high_c = 61; }],
    ['/weather/low_c', (x) => { x.weather.low_c = 'cold'; }],
    ['/weather/rain_days', (x) => { x.weather.rain_days = 32; }],
    ['/weather/rain_days', (x) => { x.weather.rain_days = -1; }],
    ['/weather/wind', (x) => { x.weather.wind = 'breezy'; }],
    ['/bloom', (x) => { x.bloom = Array.from({ length: 7 }, () => x.bloom[1]); }],
    ['/bloom/0/kind', (x) => { x.bloom[0].kind = 'tulip'; }],
    ['/bloom/0/status', (x) => { x.bloom[0].status = 'full'; }],
    ['/bloom/0/note', (x) => { x.bloom[0].note = long(161); }],
    ['/bloom/1', (x) => { delete x.bloom[1].note; }],
    ['/bloom/0/url', (x) => { x.bloom[0].url = 'http://leaves.example.org/'; }],
    ['/bloom/0/to', (x) => { x.bloom[0].to = '2031-11-01'; }],
    ['/events', (x) => { x.events = Array.from({ length: 41 }, (_, i) => ({ ...x.events[1], id: 'e' + i })); }],
    ['/events/0/id', (x) => { ev(x).id = 'Lantern Walk'; }],
    ['/events/1/id', (x) => { x.events[1].id = ev(x).id; }],
    ['/events/0/name', (x) => { ev(x).name = long(121); }],
    ['/events/0/kind', (x) => { ev(x).kind = 'parade'; }],
    ['/events/0/to', (x) => { ev(x).to = '2031-11-01'; }],
    ['/events/0/start', (x) => { ev(x).start = '5:30pm'; }],
    ['/events/0/place', (x) => { ev(x).place = 'Gull Hollow'; }],
    ['/events/0/lat', (x) => { ev(x).lat = 91; }],
    ['/events/0/lng', (x) => { delete ev(x).lng; }],
    ['/events/0/area', (x) => { ev(x).area = long(81); }],
    ['/events/0/note', (x) => { ev(x).note = long(161); }],
    ['/events/0/url', (x) => { ev(x).url = 'javascript:alert(1)'; }],
    ['/events/0/ticket', (x) => { ev(x).ticket = 'yes'; }],
    ['/forecast', (x) => { x.forecast = 'fine'; }]
  ];
  for (const [path, mutate] of cases) {
    const x = copy(SEASON);
    mutate(x);
    const r = s.normalizeSeason(x);
    assert.equal(r.ok, false, `${path} should be refused`);
    assert.ok(r.errors.some((e) => e.path === path), `${path}: got ${JSON.stringify(r.errors)}`);
  }
});

test('eventsOn and bloomOn: the day\'s events by start time (optionally by kind) and one short forecast line', async () => {
  const s = await S();
  assert.deepEqual(s.eventsOn(SEASON, '2031-11-22').map((e) => e.id), ['harvest-market', 'lantern-walk', 'tower-closed']);
  assert.deepEqual(s.eventsOn(SEASON, '2031-11-23').map((e) => e.id), ['harvest-market', 'lantern-walk', 'tower-closed', 'thanks-day'], 'untimed events after timed ones, by name');
  assert.deepEqual(s.eventsOn(SEASON, '2031-11-23', { kinds: ['light_up', 'special_opening'] }).map((e) => e.id), ['lantern-walk']);
  assert.deepEqual(s.eventsOn(SEASON, '2031-12-15').map((e) => e.id), ['tower-closed']);
  assert.deepEqual(s.eventsOn({}, '2031-11-22'), []);
  assert.throws(() => s.eventsOn(SEASON, 'Saturday'), /season: date/);
  assert.equal(s.bloomOn(SEASON, '2031-11-20'), 'Autumn leaves at their peak · Roses past their best');
  assert.equal(s.bloomOn(SEASON, '2031-11-01'), 'Autumn leaves expected from 15 Nov · Roses past their best');
  assert.equal(s.bloomOn(SEASON, '2031-12-10'), 'Autumn leaves past their best · Roses past their best');
  assert.equal(s.bloomOn({ bloom: [{ kind: 'cherry', from: '2032-03-25', to: '2032-04-08', note: 'x' }] }, '2032-03-30'), 'Cherry blossom in season');
  assert.equal(s.bloomOn({ bloom: [{ kind: 'other', note: 'Camellias' }] }, '2032-03-30'), '', 'nothing known for the date → no line');
  assert.equal(s.bloomOn(undefined, '2031-11-20'), '');
});

test('outOfSeason: single-bloom gardens by hemisphere, the trip\'s forecast wins, unknowns keep the place', async () => {
  const s = await S();
  const nov = ['2031-11-18', '2031-11-24'], dec = ['2031-12-08', '2031-12-12'];   // A6 (Phase 13): roses run to November, so December shows "out"
  const north = { lat: 40.1, lng: 10.2 }, south = { lat: -35.2, lng: 149.1 }, tropics = { lat: 10, lng: 100 };
  const rose = (location) => ({ name: 'Saltmere Rose Garden', category: 'garden', location });
  const hyd = (location) => ({ name: 'Ajisai Hollow', types: ['park'], location });
  assert.equal(s.bloomKindOf(rose(north)), 'roses');
  assert.equal(s.bloomKindOf(hyd(north)), 'hydrangea');
  assert.equal(s.bloomKindOf({ name: 'Plum and Cherry Garden', category: 'garden' }), null, 'two blooms: not mainly one');
  assert.equal(s.bloomKindOf({ name: 'Rose Street Bakery', category: 'cafe' }), null, 'not a garden or park');
  assert.equal(s.bloomKindOf({ name: 'Upper Terrace', category: 'garden', tags: ['lavender'] }), 'lavender', 'tags count');
  // northern November: hydrangeas are out, roses still in (A6, Phase 13); northern December: roses out too
  assert.equal(s.outOfSeason(rose(north), { dates: nov }), false, 'A6 (Phase 13): the autumn flush runs into November');
  assert.equal(s.outOfSeason(rose(north), { dates: dec }), true, 'A6 (Phase 13): was November');
  assert.equal(s.outOfSeason(hyd(north), { dates: nov }), true);
  assert.equal(s.outOfSeason(rose(south), { dates: nov }), false, 'November is late spring in the south');
  assert.equal(s.outOfSeason(hyd(south), { dates: nov }), true, 'southern hydrangeas flower Dec–Feb');
  assert.equal(s.outOfSeason(hyd(south), { dates: ['2031-12-28'] }), false);
  assert.equal(s.outOfSeason(rose(north), { dates: ['2031-06-04'] }), false);
  assert.equal(s.outOfSeason(rose(north), { dates: ['2031-04-28', '2031-05-02'] }), false, 'one date in season is enough');
  // the forecast speaks for its bloom: peak keeps, past drops even in the usual months
  assert.equal(s.outOfSeason(rose(north), { dates: dec, season: { bloom: [{ kind: 'roses', status: 'peak', note: 'A late flush' }] } }), false, 'A6 (Phase 13): December, was November');
  assert.equal(s.outOfSeason(rose(north), { dates: dec, season: { bloom: [{ kind: 'roses', from: '2031-12-10', to: '2031-12-20', note: 'x' }] } }), false, 'a window over a trip date keeps (A6, Phase 13: December, was November)');
  assert.equal(s.outOfSeason(rose(north), { dates: ['2031-06-04'], season: { bloom: [{ kind: 'roses', status: 'past', note: 'Over early' }] } }), true);
  assert.equal(s.outOfSeason(rose(north), { dates: nov, season: SEASON }), true, 'the fixture says roses are past');
  assert.equal(s.outOfSeason(rose(north), { dates: dec, season: { bloom: [{ kind: 'cherry', status: 'peak', note: 'x' }] } }), true, 'another bloom says nothing about roses (A6, Phase 13: December, was November)');
  // unknowns never drop: no latitude, the tropics; the lat option is the fallback
  assert.equal(s.outOfSeason(rose(null), { dates: nov }), false);
  assert.equal(s.outOfSeason(rose(null), { dates: dec, lat: 40 }), true, 'A6 (Phase 13): December, was November');
  assert.equal(s.outOfSeason(rose(tropics), { dates: nov }), false);
  assert.equal(s.outOfSeason({ name: 'Harbour Park', category: 'park', location: north }, { dates: nov }), false);
  assert.deepEqual(s.usualMonths('lotus', -30), [12, 1, 2]);
  assert.equal(s.usualMonths('autumn_leaves', 40), null);
  assert.throws(() => s.outOfSeason(rose(north), {}), /season: outOfSeason needs/);
});

// Developed by: LightAISolutions

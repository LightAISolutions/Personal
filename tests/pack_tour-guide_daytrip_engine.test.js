'use strict';
// Tour Guide — Day trip engine (TG-PHASE-15 WP-15a, `daytrip/`): the owner's words, the reach part, every screen in its
// order, the score and its ties, `more` and the labels, the board's id and payload (through the schema and the pack
// validator), and a kept trip's outline entry through the planner's normalizeOutline. Invented towns only; no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DT = () => import('../packs/tour-guide/daytrip/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');
const P = () => import('../packs/tour-guide/planner/index.mjs');

const CASES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'tour-guide', 'daytrip', 'fixtures', 'daytrip-parse-cases.json'), 'utf8'));
const MAPS = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

/** A private driver's candidate record (invented): fit 70, a 45-minute estimated ride, in season, food likely. */
const cand = (slug, o = {}) => ({ slug, name: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), area: 'Wyvern Vale',
  ride: { minutes: 45, estimated: true, from_station: 'Bramblecombe Central', to_station: slug.split('-')[0] + ' Halt' }, length: 'full',
  why: 'Quiet lanes and a long walk along the reed beds, good for an unhurried day.', see: ['The old lock', 'The reed-bed walk'],
  eat: 'A bakery by the lock marks its vegetarian pies.', food: 'likely', season: 'in', season_line: 'Water lilies flower on the canal in June.',
  closed: [], fit: 70, labels: [], stops: [{ name: 'The old lock' }, { name: 'Reed-bed walk', place_id: 'FixtureDtReedWalk01' }],
  place_id: 'FixtureDt' + slug.replace(/-/g, '').slice(0, 20), maps_url: MAPS(slug), ...o });

test('parseDaytripText: every case of the shared list', async () => {
  const { parseDaytripText } = await DT();
  assert.ok(CASES.cases.length >= 25);
  for (const c of CASES.cases) assert.deepEqual(parseDaytripText(c.text, { today: CASES.today }), c.want, JSON.stringify(c.text));
  assert.throws(() => parseDaytripText('x', { today: 'tomorrow' }), /today must be a calendar date/);
});

test('reachPart: 100 up to 30 minutes, linear to 40 at the limit, null beyond it', async () => {
  const { reachPart } = await DT();
  assert.equal(reachPart(10, 90), 100);
  assert.equal(reachPart(30, 90), 100);
  assert.equal(reachPart(60, 90), 70);
  assert.equal(reachPart(90, 90), 40);
  assert.equal(reachPart(91, 90), null);
  assert.equal(reachPart(30, 30), 100, 'a 30-minute limit: a 30-minute ride is full marks');
  assert.equal(reachPart(31, 30), null);
  assert.equal(reachPart(105, 180), 70);
  assert.equal(reachPart(NaN, 90), null);
});

test('rankDayTrips: the screens in order — duplicate, no_rail, too_far, closed_on_dates, out_of_season', async () => {
  const { rankDayTrips } = await DT();
  const r = rankDayTrips([
    cand('lockford'),
    cand('lockford-again', { name: 'LÖCKFORD' }),               // the same name ignoring case and accents
    cand('lockford', { name: 'Another Lockford' }),               // the same slug
    cand('saltmarsh', { ride: null }),                            // no train or bus found
    cand('farhaven', { ride: { minutes: 95, estimated: true } }), // beyond the 90-minute limit
    cand('millbrook', { closed: ['2027-05-12'] }),                // closed on the asked date
    cand('cherryfield', { season: 'out' }),                       // its season is over
    cand('reedly', { ride: null, season: 'out', closed: ['2027-05-12'] })   // first screen wins: no_rail
  ], { maxMinutes: 90, date: '2027-05-12' });
  assert.deepEqual(r.items.map((x) => x.slug), ['lockford']);
  assert.deepEqual(r.left_out, [
    { name: 'LÖCKFORD', reason: 'duplicate' }, { name: 'Another Lockford', reason: 'duplicate' },
    { name: 'Saltmarsh', reason: 'no_rail' }, { name: 'Farhaven', reason: 'too_far' }, { name: 'Millbrook', reason: 'closed_on_dates' },
    { name: 'Cherryfield', reason: 'out_of_season' }, { name: 'Reedly', reason: 'no_rail' }]);
  assert.equal(r.more, 0);
});

test('rankDayTrips: closed_on_dates without a date means closed on every trip day; closed days shown are the asked ones', async () => {
  const { rankDayTrips } = await DT();
  const days = ['2027-05-12', '2027-05-13'];
  const r = rankDayTrips([cand('millbrook', { closed: ['2027-05-12', '2027-05-13', '2027-06-01'] }), cand('lockford', { closed: ['2027-05-13', '2027-06-01'] })],
    { maxMinutes: 90, tripDays: days });
  assert.deepEqual(r.left_out, [{ name: 'Millbrook', reason: 'closed_on_dates' }]);
  assert.deepEqual(r.items[0].closed, ['2027-05-13'], 'only trip days are named');
  const d = rankDayTrips([cand('lockford', { closed: ['2027-05-13'] })], { maxMinutes: 90, date: '2027-05-12', tripDays: days });
  assert.equal(d.items[0].closed, undefined, 'with an asked date, only that date counts');
  const none = rankDayTrips([cand('lockford', { closed: ['2027-05-13'] })], { maxMinutes: 90 });
  assert.equal(none.items.length, 1, 'no date and no trip days: nothing to be closed on');
  assert.equal(none.items[0].closed, undefined);
});

test('rankDayTrips: the score is the rounded weighted sum of fit, reach, season and food; parts are 0–100', async () => {
  const { rankDayTrips } = await DT();
  // fit 70, reach at 45 of 90 → 85, season in → 100, food likely → 70: 0.45·70 + 0.25·85 + 0.15·100 + 0.15·70 = 78.25
  const [a] = rankDayTrips([cand('lockford')], { maxMinutes: 90 }).items;
  assert.equal(a.score, 78);
  assert.deepEqual(a.parts, { fit: 70, reach: 85, season: 100, food: 70 });
  const [b] = rankDayTrips([cand('lockford', { fit: 100, ride: { minutes: 20, estimated: false }, season: 'neutral', food: 'none' })], { maxMinutes: 90 }).items;
  assert.deepEqual(b.parts, { fit: 100, reach: 100, season: 60, food: 0 });
  assert.equal(b.score, 79);   // 45 + 25 + 9 + 0
  const [c] = rankDayTrips([cand('lockford', { food: 'unknown', fit: 0, ride: { minutes: 75, estimated: true } })], { maxMinutes: 90 }).items;
  assert.deepEqual(c.parts, { fit: 0, reach: 55, season: 100, food: 40 });
  assert.equal(c.score, 35);   // 0 + 13.75 + 15 + 6 = 34.75
});

test('rankDayTrips: best first, ties to the shorter ride then the name; the top 8 numbered and the rest counted in more', async () => {
  const { rankDayTrips } = await DT();
  const pool = [
    cand('zeal', { fit: 60 }), cand('abbey', { fit: 60 }),                                   // a tie on everything: the name
    cand('quick', { fit: 60, ride: { minutes: 30, estimated: true }, food: 'unknown' }),      // reach 100, food 40 → 75 + …
    cand('top', { fit: 94 })
  ];
  const ids = rankDayTrips(pool, { maxMinutes: 90 }).items.map((x) => [x.slug, x.score]);
  // top 89 (42.3+21.25+15+10.5); quick 0.45·60+25+15+6 = 73; abbey/zeal 27+21.25+15+10.5 = 73.75 → 74
  assert.deepEqual(ids, [['top', 89], ['abbey', 74], ['zeal', 74], ['quick', 73]]);
  const tie = rankDayTrips([cand('slow', { ride: { minutes: 40, estimated: true }, fit: 74 }), cand('fast', { ride: { minutes: 30, estimated: true }, fit: 68 })], { maxMinutes: 90 }).items;
  assert.equal(tie[0].score, tie[1].score, 'the same score');
  assert.deepEqual(tie.map((x) => x.slug), ['fast', 'slow'], 'the shorter ride first');
  const many = rankDayTrips(Array.from({ length: 11 }, (_, i) => cand('town-' + String.fromCharCode(97 + i), { fit: 50 + i })), { maxMinutes: 90 });
  assert.equal(many.items.length, 8);
  assert.deepEqual(many.items.map((x) => x.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(many.items[0].slug, 'town-k');
  assert.equal(many.more, 3);
});

test('rankDayTrips: veg_easy only when the food is confirmed; labels unique, known and at most 4', async () => {
  const { rankDayTrips } = await DT();
  const r = rankDayTrips([
    cand('lockford', { food: 'confirmed', labels: ['gem', 'crowded', 'rain_ok', 'booking', 'gem', 'sparkly'] }),
    cand('millbrook', { food: 'likely', labels: ['veg_easy', 'gem'] })
  ], { maxMinutes: 90 }).items;
  const lock = r.find((x) => x.slug === 'lockford'), mill = r.find((x) => x.slug === 'millbrook');
  assert.ok(lock.labels.includes('veg_easy'));
  assert.equal(lock.labels.length, 4);
  assert.equal(new Set(lock.labels).size, 4);
  assert.ok(!lock.labels.includes('sparkly'));
  assert.deepEqual(mill.labels, ['gem'], 'veg_easy is the engine\'s word, not the judgment\'s');
});

test('rankDayTrips: own words only — the item carries the brief\'s fields and no Google field', async () => {
  const { rankDayTrips } = await DT();
  const [it] = rankDayTrips([cand('lockford', { rating: 4.7, location: { lat: 1, lng: 2 }, see: ['a', 'b', 'c', 'd', 'e'] })], { maxMinutes: 90 }).items;
  assert.deepEqual(Object.keys(it).sort(), ['area', 'eat', 'labels', 'length', 'maps_url', 'n', 'name', 'parts', 'place_id', 'ride', 'score', 'season', 'see', 'slug', 'stops', 'why'].sort());
  assert.equal(it.see.length, 4);
  assert.equal(it.season, 'Water lilies flower on the canal in June.');
  assert.deepEqual(it.ride, { minutes: 45, estimated: true, from_station: 'Bramblecombe Central', to_station: 'lockford Halt' });
});

test('dayTripId and daytripPayload: a payload the schema and the pack validator accept', async () => {
  const { dayTripId, daytripPayload, rankDayTrips, validateDaytripPayload } = await DT();
  const { validatePayload } = await S();
  assert.equal(dayTripId('2027-05-10', 'bramblecombe'), 'dt-20270510-bramblecombe');
  assert.equal(dayTripId('2027-05-10', 'x'.repeat(60)), 'dt-20270510-' + 'x'.repeat(40));
  assert.equal(dayTripId('2027-05-10', ''), 'dt-20270510-base');
  assert.throws(() => dayTripId('10 May', 'x'), /calendar date/);
  const ranked = rankDayTrips(Array.from({ length: 10 }, (_, i) => cand('town-' + String.fromCharCode(97 + i), { fit: 50 + i })).concat([cand('saltmarsh', { ride: null })]), { maxMinutes: 90, date: '2027-05-12' });
  const p = daytripPayload({ trip: 'quillmere-2027', base: { label: 'Bramblecombe' }, createdOn: '2027-05-10', maxMinutes: 90, date: '2027-05-12', ranked });
  assert.equal(p.id, 'dt-20270510-bramblecombe');
  assert.deepEqual(p.base, { label: 'Bramblecombe', slug: 'bramblecombe' });
  assert.equal(p.trip, 'quillmere-2027');
  assert.equal(p.more, 2);
  assert.equal(p.items.length, 8);
  assert.deepEqual(p.left_out, [{ name: 'Saltmarsh', reason: 'no_rail' }]);
  assert.deepEqual(validateDaytripPayload(p), []);
  assert.deepEqual(validatePayload('daytrip', p).errors, []);
  const off = daytripPayload({ trip: null, base: { label: 'Wyvern Cross', slug: 'wyvern-cross' }, createdOn: '2027-05-10', maxMinutes: 60, ranked: rankDayTrips([], { maxMinutes: 60 }) });
  assert.equal(off.trip, null);
  assert.equal(off.date, undefined);
  assert.equal(off.more, undefined, 'more only when something did not make the board');
  assert.deepEqual(validatePayload('daytrip', off).errors, []);
  assert.throws(() => daytripPayload({ base: { label: 'X' }, createdOn: '2027-05-10', maxMinutes: 200, ranked: { items: [], left_out: [] } }), /max_minutes out of range/);
});

test('dayTripOutlineEntry: a full day around the destination with at most 3 anchors, accepted by normalizeOutline', async () => {
  const { dayTripOutlineEntry } = await DT();
  const { normalizeOutline } = await P();
  const e = dayTripOutlineEntry({ name: 'Lockford', center: { lat: 51.2, lng: -1.4 }, anchors: ['old-lock', 'reed-walk', 'lock-bakery', 'mill-museum'] });
  assert.deepEqual(e, { kind: 'full', area: { name: 'Lockford', lat: 51.2, lng: -1.4, radius_km: 3 }, anchors: ['old-lock', 'reed-walk', 'lock-bakery'] });
  const o = normalizeOutline({ by_date: { '2027-05-12': e } }, ['2027-05-12', '2027-05-13']);
  assert.deepEqual(o.byDate.get('2027-05-12'), { kind: 'full', area: { name: 'Lockford', lat: 51.2, lng: -1.4, radius_km: 3 }, anchors: ['old-lock', 'reed-walk', 'lock-bakery'] });
  const long = dayTripOutlineEntry({ name: 'L'.repeat(120), center: { lat: 0, lng: 0 }, anchors: [] });
  assert.ok(long.area.name.length <= 60);
  assert.doesNotThrow(() => normalizeOutline({ by_date: { '2027-05-12': long } }, ['2027-05-12']));
  assert.throws(() => dayTripOutlineEntry({ name: 'Lockford', center: { lat: 'x' }, anchors: [] }), /center/);
});

// Developed by: LightAISolutions

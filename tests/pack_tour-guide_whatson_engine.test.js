'use strict';
// packs/tour-guide/whatson — the What's on engine (C15, TG-PHASE-15 WP-15b): the owner's words read into a place and a
// window, stable event ids, the board's clean-up (duplicates, the window, the order, the cap), the payload, and the bridge
// from a chosen item to the season sheet. Invented towns, events and pages on reserved domains; no network, no clock.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'packs', 'tour-guide', 'whatson');
const W = () => import('../packs/tour-guide/whatson/index.mjs');
const SEASON = () => import('../packs/tour-guide/season/index.mjs');
const FIX = JSON.parse(fs.readFileSync(path.join(DIR, 'fixtures', 'whatson-sample.json'), 'utf8'));
const CASES = JSON.parse(fs.readFileSync(path.join(DIR, 'fixtures', 'whatson-parse-cases.json'), 'utf8')).cases;
const J = (v) => JSON.parse(JSON.stringify(v));
const BOARD = FIX.valid[0];
const [EXHIBITION, MARKET, LANTERNS, HOLIDAY] = BOARD.items;
const WINDOW = { from: BOARD.from, to: BOARD.to };
/** A raw find as the research step hands it over: the board item without its id (an `over` key set to undefined is removed). */
const raw = (it, over = {}) => { const r = Object.assign(J(it), over); delete r.id; for (const k of Object.keys(r)) if (r[k] === undefined) delete r[k]; return r; };

/* ---------------- parseWhatsonText ---------------- */

test('parseWhatsonText: every <when> form, the defaults and the refusals, read by hand (2027-05-12 is a Wednesday)', async () => {
  const w = await W();
  const T = '2027-05-12';
  const ok = (place, from, to) => ({ ok: true, place, from, to, dates_given: from !== null });
  const no = (reason, place = null) => ({ ok: false, reason, place });
  const want = [
    ['/whatson', T, ok(null, null, null)],
    ['in Quillmere', T, ok('Quillmere', null, null)],
    ['/whatson@TourGuideBot in Old Quay tomorrow', T, ok('Old Quay', '2027-05-13', '2027-05-13')],
    ['today', T, ok(null, T, T)],
    ['this week', T, ok(null, T, '2027-05-16')],
    ['next week', T, ok(null, '2027-05-17', '2027-05-23')],
    ['next week', '2027-05-17', ok(null, '2027-05-24', '2027-05-30')],
    ['this weekend', T, ok(null, '2027-05-15', '2027-05-16')],
    ['this weekend', '2027-05-16', ok(null, '2027-05-16', '2027-05-16')],
    ['Fernby Cross 2027-06-01', T, ok('Fernby Cross', '2027-06-01', '2027-06-01')],
    ['6/3', T, ok(null, '2027-06-03', '2027-06-03')],
    ['8 Jun', T, ok(null, '2027-06-08', '2027-06-08')],
    ['June 8th', T, ok(null, '2027-06-08', '2027-06-08')],
    ['3 May', T, ok(null, '2028-05-03', '2028-05-03')],
    ['8-10 Jun', T, ok(null, '2027-06-08', '2027-06-10')],
    ['Jun 8-10', T, ok(null, '2027-06-08', '2027-06-10')],
    ['8 Jun to 10 Jun', T, ok(null, '2027-06-08', '2027-06-10')],
    ['8 jun..10 jun', T, ok(null, '2027-06-08', '2027-06-10')],
    ['6/8-6/10', T, ok(null, '2027-06-08', '2027-06-10')],
    ['2027-06-08-2027-06-10', T, ok(null, '2027-06-08', '2027-06-10')],
    ['Quillmere 28 Dec to 3 Jan', T, ok('Quillmere', '2027-12-28', '2028-01-03')],
    ['2027-05-01 to 2027-05-20', T, ok(null, T, '2027-05-20')],
    ['1 Jun to 1 Jul', T, ok(null, '2027-06-01', '2027-07-01')],
    ['in Quillmere 10-8 Jun', T, no('reversed', 'Quillmere')],
    ['May 20-10', T, no('reversed')],
    ['2027-05-01 to 2027-05-11', T, no('past')],
    ['1 Jun to 2 Jul', T, no('too_long')],
    ['x'.repeat(81), T, no('long_place')]
  ];
  for (const [text, today, expected] of want) {
    assert.deepEqual(w.parseWhatsonText(text, { today }), expected, text + ' on ' + today);
    const shared = CASES.find((c) => c.text === text && c.today === today);
    if (shared) assert.deepEqual(shared.want, expected, 'the shared case list agrees on ' + text);
  }
  assert.throws(() => w.parseWhatsonText('today', {}), /today/);
});

test('parseWhatsonText: the shared case list (the core\'s tgWhatsonParse gives the same answers)', async () => {
  const w = await W();
  assert.ok(CASES.length >= 40);
  for (const c of CASES) assert.deepEqual(w.parseWhatsonText(c.text, { today: c.today }), c.want, c.text + ' on ' + c.today);
  // every <when> form of the brief appears in the list
  for (const form of ['today', 'tomorrow', 'this week', 'next week', 'this weekend', '2027-06-01', '6/3', '8 Jun', 'Jun 8', ' to ', '..', '8-10 Jun', 'Jun 8-10']) {
    assert.ok(CASES.some((c) => c.text.indexOf(form) >= 0), form);
  }
  for (const reason of ['past', 'reversed', 'too_long', 'long_place']) assert.ok(CASES.some((c) => c.want.reason === reason), reason);
});

/* ---------------- eventId, normalizeWhatson, newItems ---------------- */

test('eventId: the slug of the name plus the start\'s mmdd — the same from run to run, accents and case aside', async () => {
  const w = await W();
  assert.equal(w.eventId('Fête des Lumières', '2027-12-08'), 'fete-des-lumieres-1208');
  assert.equal(w.eventId('  FÊTE des lumières! ', '2027-12-08'), 'fete-des-lumieres-1208');
  assert.equal(w.eventId('Lantern Walk on the Mere', LANTERNS.from), LANTERNS.id);
  assert.notEqual(w.eventId('Fête des Lumières', '2028-12-08'), w.eventId('Fête des Lumières', '2027-12-09'));
  const a = w.eventId('灯籠まつり', '2027-08-15'), b = w.eventId('花火大会', '2027-08-15');
  assert.match(a, /^e[0-9a-f]{8}-0815$/);
  assert.notEqual(a, b);
  assert.equal(w.eventId('灯籠まつり', '2027-08-15'), a, 'a name with no Latin letters still keeps its id');
  const long = w.eventId('The Very Long Annual Festival of Reeds, Rushes, Lanterns and Boats by the Mere', '2027-05-13');
  assert.ok(long.length <= 64 && w.SLUG_RE.test(long) && /-0513$/.test(long), long);
});

test('normalizeWhatson: duplicates keep the confirmed one, else the fuller one; out-of-window and broken finds are left out', async () => {
  const w = await W();
  const finds = [
    raw(HOLIDAY), raw(LANTERNS), raw(EXHIBITION), raw(MARKET),
    raw(LANTERNS, { name: 'LANTERN walk on the Mère', confidence: 'confirmed', food: undefined, booking: undefined, labels: ['evening'] }),
    raw(EXHIBITION, { name: 'Reed and rush: weavers of the mere', price: undefined, venue: undefined }),
    raw(MARKET, { name: 'Thursday Quay Market', from: '2027-06-03', to: '2027-06-24', days: ['2027-06-03', '2027-06-10'] }),
    raw(EXHIBITION, { name: 'Boat Concert', kind: 'concert' }),
    raw(EXHIBITION, { name: 'Pier Fair', url: 'http://fair.example.org/' }),
    raw(EXHIBITION, { name: 'Quiet Fair', why: '   ' }),
    raw(EXHIBITION, { name: '   ' }),
    'not a find'
  ];
  const before = J(finds);
  const n = w.normalizeWhatson(finds, WINDOW);
  assert.deepEqual(finds, before, 'the input is untouched');
  assert.deepEqual(n.items.map((x) => x.name), ['Reed and Rush: Weavers of the Mere', 'Thursday Quay Market', 'LANTERN walk on the Mère', 'Quillmere Founders\' Day']);
  assert.equal(n.items[2].confidence, 'confirmed', 'the confirmed duplicate wins over the likely one');
  assert.deepEqual(n.items[0], EXHIBITION, 'the fuller duplicate wins, unchanged');
  assert.equal(n.items[2].id, LANTERNS.id, 'the same id whichever spelling won');
  assert.deepEqual(n.left_out, [
    { name: 'Lantern Walk on the Mere', reason: 'duplicate' },
    { name: 'Reed and rush: weavers of the mere', reason: 'duplicate' },
    { name: 'Boat Concert', reason: 'other' },
    { name: 'Pier Fair', reason: 'other' },
    { name: 'Quiet Fair', reason: 'other' },
    { name: 'Thursday Quay Market', reason: 'outside_dates' }
  ]);
  assert.equal(n.more, 0);
  assert.throws(() => w.normalizeWhatson([], { from: '2027-05-14', to: '2027-05-12' }), /window/);
});

test('normalizeWhatson: strings trimmed and cut, unknown labels and broken times dropped, ids made unique, sorted, capped at 20', async () => {
  const w = await W();
  const n = w.normalizeWhatson([
    raw(LANTERNS, { name: '  Lantern   Walk on the Mere ', start: '7pm', end: '25:00', labels: ['free', 'cheap', 'Evening', 'evening'], why: 'w'.repeat(250) }),
    raw(LANTERNS, { name: 'Lantern Walk on the Mere 夜', start: '20:00' })
  ], WINDOW);
  assert.equal(n.items.length, 2);
  const [a, b] = n.items;
  assert.equal(a.name, 'Lantern Walk on the Mere');
  assert.equal(a.start, undefined);
  assert.equal(a.end, undefined);
  assert.deepEqual(a.labels, ['evening', 'free']);
  assert.equal(a.why.length, 200);
  assert.ok(a.why.endsWith('…'));
  assert.equal(a.id, LANTERNS.id);
  assert.equal(b.id, LANTERNS.id + '-2', 'a second item with the same slug and date gets -2');
  const many = Array.from({ length: 25 }, (_, i) => raw(EXHIBITION, { name: 'Gallery Talk ' + String.fromCharCode(97 + i), start: '1' + (i % 10) + ':00' }));
  const m = w.normalizeWhatson(many, WINDOW);
  assert.equal(m.items.length, 20);
  assert.equal(m.more, 5);
  for (let i = 1; i < m.items.length; i++) assert.ok(w.compareItems(m.items[i - 1], m.items[i], WINDOW.from, WINDOW.to) <= 0);
  assert.equal(m.items[0].start, '10:00');
});

test('newItems: the items whose id the previous board did not have', async () => {
  const w = await W();
  const next = J(BOARD);
  next.items.push({ ...J(EXHIBITION), id: 'mere-night-swim-0513', name: 'Mere Night Swim' });
  assert.deepEqual(w.newItems(BOARD, next).map((x) => x.id), ['mere-night-swim-0513']);
  assert.deepEqual(w.newItems(null, BOARD).map((x) => x.id), BOARD.items.map((x) => x.id));
  assert.deepEqual(w.newItems(BOARD.items, BOARD), []);
});

/* ---------------- whatsonPayload and the validators ---------------- */

test('whatsonPayload: builds the board from raw finds — the fixture\'s board, valid for the pack validator, checkWhatson and the schema', async () => {
  const w = await W();
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  const p = w.whatsonPayload({ created_on: BOARD.created_on, place: { label: '  Quillmere ' }, trip: BOARD.trip, from: BOARD.from, to: BOARD.to,
    items: [raw(HOLIDAY), raw(LANTERNS), raw(MARKET), raw(EXHIBITION), raw(EXHIBITION, { name: 'Spring Regatta', from: '2027-06-01', to: '2027-06-02' })],
    sources: [...BOARD.sources, BOARD.sources[0], { title: 'Plain', url: 'http://plain.example.org/' }],
    left_out: [{ name: 'Night Ferry Concert', reason: 'sold_out' }, { name: 'Odd one', reason: 'boring' }] });
  assert.deepEqual(p, BOARD);
  assert.deepEqual(w.validateWhatsonPayload(J(p)), []);
  assert.deepEqual(w.checkWhatson(J(p)), []);
  assert.equal(schemas.validatePayload('whatson', J(p)).ok, true);
  const free = w.whatsonPayload({ created_on: '2027-05-10', place: { label: 'Fernby Cross' }, from: '2027-05-10', to: '2027-05-10', items: [] });
  assert.deepEqual(free, { ...FIX.valid[1], v: 1 });
  const auto = w.whatsonPayload({ created_on: '2027-05-05', place: { label: 'Quillmere', slug: 'quillmere' }, trip: BOARD.trip, from: BOARD.from, to: BOARD.to, items: [], auto: true });
  assert.equal(auto.auto, true);
  assert.equal(auto.id, 'wo-20270505-quillmere');
  assert.equal(w.placeSlug('Ōmi Hachiman — old town'), 'omi-hachiman-old-town');
  assert.equal(w.placeSlug('東京'), 'place');
  assert.throws(() => w.whatsonPayload({ created_on: '2027-05-10', place: { label: '' }, from: '2027-05-10', to: '2027-05-10', items: [] }), /place\.label/);
  assert.throws(() => w.whatsonPayload({ created_on: 'soon', place: { label: 'X' }, from: '2027-05-10', to: '2027-05-10' }), /created_on/);
});

test('whatsonPayload: a board past 40 000 characters loses items from its end, counted in `more`', async () => {
  const w = await W();
  const finds = Array.from({ length: 20 }, (_, i) => raw(EXHIBITION, { name: 'Reed Talk ' + String(i).padStart(2, '0'), why: 'w'.repeat(200),
    food: 'f'.repeat(160), price: 'p'.repeat(80), booking: 'b'.repeat(120), url: 'https://whatson.example.org/' + 'u'.repeat(1500) }));
  const p = w.whatsonPayload({ created_on: '2027-05-01', place: { label: 'Quillmere' }, trip: BOARD.trip, ...WINDOW, items: finds });
  assert.ok(JSON.stringify(p).length <= w.PAYLOAD_MAX);
  assert.ok(p.items.length < 20 && p.items.length > 10, String(p.items.length));
  assert.equal(p.more, 20 - p.items.length);
  assert.equal(p.items[p.items.length - 1].name, 'Reed Talk ' + String(p.items.length - 1).padStart(2, '0'), 'the end of the board went');
});

test('validators: every fixture — valid accepted; invalid refused by the pack and the schema; semantic refused by the pack and checkWhatson', async () => {
  const w = await W();
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  const { validate: subset } = await import('../kits/brochure/lib/validate.mjs');
  for (const p of FIX.valid) {
    assert.deepEqual(w.validateWhatsonPayload(J(p)), [], JSON.stringify(p).slice(0, 80));
    assert.deepEqual(w.checkWhatson(J(p)), []);
    assert.deepEqual(schemas.validatePayload('whatson', J(p)).errors, []);
  }
  for (const p of FIX.invalid) {
    assert.ok(w.validateWhatsonPayload(J(p)).length > 0, 'pack accepts ' + JSON.stringify(p).slice(0, 200));
    assert.equal(schemas.validatePayload('whatson', J(p)).ok, false, 'schema accepts ' + JSON.stringify(p).slice(0, 200));
  }
  for (const p of FIX.semantic) {
    assert.ok(w.validateWhatsonPayload(J(p)).length > 0, 'pack accepts ' + JSON.stringify(p).slice(0, 200));
    assert.ok(w.checkWhatson(J(p)).length > 0, 'checkWhatson accepts ' + JSON.stringify(p).slice(0, 200));
    assert.deepEqual(subset(J(p), schemas.loadSchema('whatson')), [], 'the JSON schema itself cannot say this rule');
    assert.equal(schemas.validatePayload('whatson', J(p)).ok, false, 'validatePayload runs checkWhatson too (C15: KINDS.whatson)');
  }
});

test('validators: a Google field anywhere is refused by name; an oversize board by its size', async () => {
  const w = await W();
  const p = J(BOARD);
  p.items[2].venue.formattedAddress = '1 Shore Road';
  p.items[0].Rating = 4.4;
  p.left_out[0].opening_hours = 'all day';
  const errs = w.validateWhatsonPayload(p);
  for (const k of ['items[0].Rating', 'items[2].venue.formattedAddress', 'left_out[0].opening_hours']) assert.ok(errs.includes(k + ': Google field refused (own data only)'), k + ' in ' + errs.join(' / '));
  const big = J(BOARD);
  big.items = Array.from({ length: 20 }, (_, i) => ({ ...J(EXHIBITION), id: 'reed-talk-' + String(i).padStart(2, '0'), name: 'Reed Talk ' + String(i).padStart(2, '0'),
    why: 'w'.repeat(200), food: 'f'.repeat(160), price: 'p'.repeat(80), booking: 'b'.repeat(120), url: 'https://whatson.example.org/' + 'u'.repeat(1500) }));
  const n = JSON.stringify(big).length;
  assert.ok(n > 40000 && n < 60000);
  assert.deepEqual(w.validateWhatsonPayload(big), ['payload is ' + n + ' chars (max 40000 for one cell)']);
  assert.deepEqual(w.checkWhatson(big), [{ path: '/', message: 'payload is ' + n + ' chars (max 40000)' }]);
});

/* ---------------- toSeasonEvent and mergeChosen ---------------- */

const SHEET = (events) => ({ checked: '2027-04-20', sources: [{ url: 'https://whatson.example.org/quillmere', title: 'Quillmere what\'s on', accessed: '2027-04-20' }], events });

test('toSeasonEvent: a season_event that passes the trip schema and checkSeason; days narrow it to the chosen day', async () => {
  const w = await W();
  const s = await SEASON();
  const planner = await import('../packs/tour-guide/planner/index.mjs');
  const ex = w.toSeasonEvent(EXHIBITION, { chosen_on: '2027-05-13' });
  assert.deepEqual(ex, { id: 'wo-' + EXHIBITION.id, name: EXHIBITION.name, kind: 'exhibition', from: '2027-04-01', to: '2027-06-30', start: '10:00', end: '17:00',
    area: 'Old Quay', note: EXHIBITION.why, url: EXHIBITION.url, chosen_on: '2027-05-13' });
  const lan = w.toSeasonEvent(LANTERNS, { chosen_on: '2027-05-14' });
  assert.equal(lan.place_id, 'QmereBoardwalk01', 'the planner locates an event by its place_id');
  const mk = w.toSeasonEvent(MARKET, { chosen_on: '2027-05-13' });
  assert.deepEqual([mk.from, mk.to, mk.chosen_on], ['2027-05-13', '2027-05-13', '2027-05-13']);
  const first = w.toSeasonEvent(MARKET);
  assert.deepEqual([first.from, first.to, first.chosen_on], ['2027-05-06', '2027-05-06', undefined]);
  const r = s.normalizeSeason(SHEET([ex, lan, mk]));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.season.events, [ex, lan, mk]);
  assert.equal(planner.isEveningChoice(lan), true, 'a chosen 19:30 light-up is an evening choice');
  assert.equal(planner.isEveningChoice(ex), false, 'a chosen 10:00 exhibition is a daytime choice');
  assert.throws(() => w.toSeasonEvent(MARKET, { chosen_on: '2027-05-14' }), /does not run on 2027-05-14/);
  assert.throws(() => w.toSeasonEvent(LANTERNS, { chosen_on: '2027-05-15' }), /does not run/);
  assert.throws(() => w.toSeasonEvent({ name: 'No id' }), /board item/);
  const longer = w.toSeasonEvent({ ...J(EXHIBITION), id: 'a'.repeat(59) + '-0401', why: 'w'.repeat(200) }, { chosen_on: '2027-05-12' });
  assert.equal(longer.id.length, 64);
  assert.ok(w.SLUG_RE.test(longer.id));
  assert.equal(longer.note.length, 160);
  assert.equal(s.normalizeSeason(SHEET([longer])).ok, true);
});

test('mergeChosen: a match in the sheet is marked, others are added; un-chosen ones unmarked or dropped; holidays never added', async () => {
  const w = await W();
  const own = { id: 'lanterns', name: 'Lantern walk on the MERE', kind: 'light_up', from: '2027-05-10', to: '2027-05-20', start: '19:30', note: 'Our own line.' };
  const fair = { id: 'reed-fair', name: 'Reed Fair', kind: 'festival', from: '2027-05-01', to: '2027-05-03' };
  const season = SHEET([own, fair]);
  const before = J(season);
  const snap = { board: BOARD.id, item: EXHIBITION.id, trip: BOARD.trip, place: 'Quillmere', name: EXHIBITION.name, kind: EXHIBITION.kind,
    from: EXHIBITION.from, to: EXHIBITION.to, start: EXHIBITION.start, end: EXHIBITION.end, venue: EXHIBITION.venue, url: EXHIBITION.url,
    chosen_on: '2027-05-12', chosen_at: '2027-05-02T09:00:00Z' };
  const r = w.mergeChosen(season, [{ item: LANTERNS, chosen_on: '2027-05-13' }, snap, { item: HOLIDAY, chosen_on: '2027-05-14' }],
    { tripStart: '2027-05-12', tripEnd: '2027-05-14' });
  assert.deepEqual(season, before, 'the input is untouched');
  assert.deepEqual(r.marked, ['lanterns']);
  assert.deepEqual(r.added, ['wo-' + EXHIBITION.id]);
  assert.deepEqual([r.unmarked, r.dropped], [[], []]);
  assert.deepEqual(r.season.events[0], { ...own, chosen_on: '2027-05-13' }, 'the sheet\'s own words stay');
  assert.equal(r.season.events[2].chosen_on, '2027-05-12');
  assert.equal(r.season.events.length, 3);
  const again = w.mergeChosen(r.season, [{ item: LANTERNS, chosen_on: '2027-05-14' }], { tripStart: '2027-05-12', tripEnd: '2027-05-14' });
  assert.deepEqual(again.marked, ['lanterns']);
  assert.equal(again.season.events[0].chosen_on, '2027-05-14');
  assert.deepEqual(again.dropped, ['wo-' + EXHIBITION.id], 'an event a choice added leaves with the choice');
  const none = w.mergeChosen(again.season, []);
  assert.deepEqual(none.unmarked, ['lanterns']);
  assert.deepEqual(none.season.events, [own, fair], 'an event of the sheet stays, unmarked');
});

test('mergeChosen: with no sheet one is started; over 40 events the unchosen ones outside the trip go first, then the latest', async () => {
  const w = await W();
  const s = await SEASON();
  assert.deepEqual(w.mergeChosen(null, []), { season: null, added: [], marked: [], unmarked: [], dropped: [] });
  const started = w.mergeChosen(null, [{ item: LANTERNS, chosen_on: '2027-05-13' }], { tripStart: '2027-05-12', tripEnd: '2027-05-14' });
  assert.deepEqual(started.season, { checked: '2027-05-13', sources: [{ url: LANTERNS.url, title: LANTERNS.name, accessed: '2027-05-13' }],
    events: [w.toSeasonEvent(LANTERNS, { chosen_on: '2027-05-13' })] });
  assert.equal(w.mergeChosen(null, [{ item: LANTERNS, chosen_on: '2027-05-13' }], { checked: '2027-05-02' }).season.checked, '2027-05-02');
  const ev = (i, from, to) => ({ id: 'ev-' + String(i).padStart(2, '0'), name: 'Event ' + i, kind: 'market', from, to });
  const events = [];
  for (let i = 0; i < 37; i++) events.push(ev(i, '2027-05-12', '2027-05-14'));
  events.push(ev(37, '2027-04-01', '2027-04-02'), ev(38, '2027-05-14', '2027-05-14'), ev(39, '2027-05-13', '2027-05-30'));
  events[5].chosen_on = '2027-05-12';
  const r = w.mergeChosen(SHEET(events), [{ item: EXHIBITION, chosen_on: '2027-05-12' }, { item: LANTERNS, chosen_on: '2027-05-13' }, { item: MARKET, chosen_on: '2027-05-13' },
    { item: { id: 'ev-05', name: 'Event 5', kind: 'market', from: '2027-05-12', to: '2027-05-14' }, chosen_on: '2027-05-12' }],
    { tripStart: '2027-05-12', tripEnd: '2027-05-14' });
  assert.equal(r.season.events.length, 40);
  assert.deepEqual(r.added, ['wo-' + EXHIBITION.id, 'wo-' + LANTERNS.id, 'wo-' + MARKET.id]);
  assert.deepEqual(r.dropped, ['ev-37', 'ev-38', 'ev-39'], 'outside the trip first, then the latest starting');
  assert.ok(r.season.events.some((e) => e.id === 'ev-05' && e.chosen_on === '2027-05-12'), 'a chosen event is never dropped');
  assert.equal(s.normalizeSeason(r.season).ok, true);
});

// Developed by: LightAISolutions

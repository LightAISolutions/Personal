'use strict';
// TG-PHASE-14 WP-14e — Compare (item 12): two to four named places, or one of the owner's lists, side by side with the
// scores, parts, labels and warnings Scout shows. A compare board is a `scout` payload with `mode: "compare"`, its
// `source`, item `flags` and the `not_found` reason (Contract C14, wave 2). This file: both validators and their parity,
// the engine's compare mode, the payload builder and the board. Brindlewick is an invented town; every place, id,
// rating and list below is invented and nothing is fetched.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');
const SC = () => import('../packs/tour-guide/scout/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');

const J = (v) => JSON.parse(JSON.stringify(v));
const clone = J;
const MAPS = (id) => 'https://www.google.com/maps/search/?api=1&query=Fixture&query_place_id=' + id;
const MANIFEST = JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'helper.json'), 'utf8'));

function core() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: '2027-06-01T12:00:00Z', manifest: MANIFEST });
  H.bootstrap(ctx, state);
  return { ctx, state };
}

/* ---------------- payload fixtures ---------------- */
const item = (n, over = {}) => ({ n, slug: 'brindle-pick-' + n, name: 'Brindle Pick ' + n, area: 'Mill Lane', category: 'restaurant', score: 80 - n,
  parts: { topic: 100, quality: 70, fit: 30, local: 25, reach: 60 }, why_you: 'One of the places you named.', labels: ['not_judged'],
  maps_url: MAPS('FixtureBrindle' + n), place_id: 'FixtureBrindle' + n, ...over });
const scoutBoard = (over = {}) => ({ v: 1, kind: 'scout', scout_id: 'sc-20270601-dinner', query: 'dinner', destination: 'brindlewick',
  place_label: 'Brindlewick', group: 'food', created_on: '2027-06-01', diet: 'vegetarian', items: [item(1, { parts: { topic: 90, quality: 70, fit: 30, local: 25, reach: 60 } })],
  left_out: [{ name: 'Brindle Grill', reason: 'off_topic' }], ...over });
const compareBoard = (over = {}) => ({ v: 1, kind: 'scout', mode: 'compare', source: { names: ['Brindle Pick 1', 'Brindle Pick 2', 'Lost Lantern'] },
  scout_id: 'sc-20270601-compare', query: 'compare: Brindle Pick 1, Brindle Pick 2, Lost Lantern', destination: 'brindlewick', place_label: 'Brindlewick',
  group: 'food', created_on: '2027-06-01', diet: 'vegetarian',
  items: [item(1), item(2, { flags: ['diet_unproven', 'too_far'] })],
  left_out: [{ name: 'Lost Lantern', reason: 'not_found' }], ...over });

/** [label, payload, valid?] — each case must get the same answer from the pack's validator and the core's mirror. */
function cases() {
  const withItems = (items) => compareBoard({ items });
  return [
    ['a scout board without mode (an old pin) passes', scoutBoard(), true],
    ['a scout board with mode "scout" passes', scoutBoard({ mode: 'scout' }), true],
    ['a compare board of names with flags and not_found passes', compareBoard(), true],
    ['a compare board of a list passes', compareBoard({ source: { list: 'Dinner list' }, query: 'compare: Dinner list' }), true],
    ['every flag from SCREEN_ORDER except duplicate and off_topic passes', withItems([item(1, { flags: ['closed', 'closed_on_trip', 'low_rating', 'unproven', 'diet', 'diet_unproven', 'too_far'] })]), true],
    ['a compare board without left_out entries or flags passes', compareBoard({ items: [item(1)], left_out: [] }), true],
    ['source without compare mode is refused', scoutBoard({ source: { list: 'Dinner list' } }), false],
    ['source with mode "scout" is refused', scoutBoard({ mode: 'scout', source: { names: ['A one', 'B two'] } }), false],
    ['a compare board without source is refused', (() => { const p = compareBoard(); delete p.source; return p; })(), false],
    ['an unknown mode is refused', scoutBoard({ mode: 'versus' }), false],
    ['an unknown flag is refused', withItems([item(1, { flags: ['sponsored'] })]), false],
    ['off_topic is not a flag', withItems([item(1, { flags: ['off_topic'] })]), false],
    ['duplicate is not a flag', withItems([item(1, { flags: ['duplicate'] })]), false],
    ['more than 8 flags are refused', withItems([item(1, { flags: ['closed', 'closed_on_trip', 'low_rating', 'unproven', 'diet', 'diet_unproven', 'too_far', 'closed', 'low_rating'] })]), false],
    ['flags must be an array', withItems([item(1, { flags: 'too_far' })]), false],
    ['flags on a scout board are refused', scoutBoard({ items: [item(1, { flags: ['too_far'] })] }), false],
    ['not_found on a scout board is refused', scoutBoard({ left_out: [{ name: 'Lost Lantern', reason: 'not_found' }] }), false],
    ['a source with both names and list is refused', compareBoard({ source: { names: ['A one', 'B two'], list: 'Dinner list' } }), false],
    ['a source with neither is refused', compareBoard({ source: {} }), false],
    ['a source with another key is refused', compareBoard({ source: { names: ['A one', 'B two'], url: 'https://example.invalid' } }), false],
    ['one name is refused', compareBoard({ source: { names: ['A one'] } }), false],
    ['five names are refused', compareBoard({ source: { names: ['A one', 'B two', 'C three', 'D four', 'E five'] } }), false],
    ['an empty name is refused', compareBoard({ source: { names: ['A one', ''] } }), false],
    ['a name past 120 characters is refused', compareBoard({ source: { names: ['A one', 'x'.repeat(121)] } }), false],
    ['an empty list name is refused', compareBoard({ source: { list: '' } }), false],
    ['a list name past 80 characters is refused', compareBoard({ source: { list: 'x'.repeat(81) } }), false],
    ['a list name that is not a string is refused', compareBoard({ source: { list: 7 } }), false]
  ];
}

test('validators (C14 wave 2): mode, source, flags and not_found — the pack and the core agree on every case', async () => {
  const s = await S();
  const { ctx } = core();
  const coreErrs = (p) => J(ctx.tgEnvCleaned(ctx.tgEnvValidateScout)(clone(p)));
  for (const [label, p, valid] of cases()) {
    const pack = s.validatePayload('scout', clone(p));
    assert.equal(pack.ok, valid, `pack: ${label}: ${s.formatErrors(pack.errors)}`);
    const errs = coreErrs(p);
    assert.equal(errs.length === 0, valid, `core: ${label}: ${errs.join('; ')}`);
  }
});

test('validators: the core names what is wrong', () => {
  const { ctx } = core();
  const errs = (p) => J(ctx.tgEnvValidateScout(clone(p))).join('\n');
  assert.match(errs(scoutBoard({ source: { list: 'Dinner list' } })), /source.*compare/);
  assert.match(errs((() => { const p = compareBoard(); delete p.source; return p; })()), /source required/);
  assert.match(errs(compareBoard({ items: [item(1, { flags: ['sponsored'] })] })), /items\[0\]\.flags\[0\] must be one of/);
  assert.match(errs(scoutBoard({ items: [item(1, { flags: ['too_far'] })] })), /items\[0\]\.flags.*compare/);
  assert.match(errs(scoutBoard({ left_out: [{ name: 'Lost Lantern', reason: 'not_found' }] })), /left_out\[0\]\.reason.*compare/);
});

/* ---------------- the engine: an invented Brindlewick pool ---------------- */
const INN = { label: 'your inn', lat: 52.3, lng: 4.1 };
const at = (kmNorth) => ({ latitude: INN.lat + kmNorth / 111, longitude: INN.lng });
const week = (days) => ({ periods: days.map((day) => ({ open: { day, hour: 9, minute: 0 }, close: { day, hour: 21, minute: 0 } })) });
const EVERYDAY = week([0, 1, 2, 3, 4, 5, 6]);
const TRIP = ['2027-06-07', '2027-06-08', '2027-06-09'];   // Monday to Wednesday
const LOCAL = [{ ref: 'B1', language: 'xx', kind: 'local-language', publisher: 'brindle-weekly.example' }, { ref: 'B2', language: 'en', kind: 'editorial', publisher: 'mill-lane-eats.example' }];
function place(id, name, o = {}) {
  const types = o.types || ['restaurant'];
  return { id: 'FixtureBrindle' + id, displayName: { text: name }, types, primaryType: types[0], rating: o.rating === undefined ? 4.5 : o.rating,
    userRatingCount: o.count === undefined ? 100 : o.count, businessStatus: o.status || 'OPERATIONAL', location: at(o.km === undefined ? 0.5 : o.km),
    regularOpeningHours: o.hours === undefined ? EVERYDAY : o.hours, servesVegetarianFood: o.veg };
}
/** One place per screen, a pass or two, and a duplicate: Brindlewick noodles for a vegetarian party. */
const RAW = [
  place('Ladle', 'Brindle Noodle Ladle', { rating: 4.6, count: 220, km: 0.4 }),
  place('Steam', 'Steam Noodle Bar', { types: ['bar'], rating: 4.4, count: 90, km: 1.0 }),
  place('Shut', 'Shut Noodle House', { status: 'CLOSED_PERMANENTLY' }),
  place('Sunday', 'Sunday Noodles', { hours: week([0]) }),
  place('Sour', 'Sour Noodle Stall', { rating: 3.5, count: 80 }),
  place('Tiny', 'Tiny Noodle Cart', { rating: 5, count: 2 }),
  place('Gear', 'Brindle Bike Shop', { types: ['bicycle_store'] }),
  place('Broth', 'Bone Broth Noodles'),
  place('Plain', 'Plain Noodle Diner'),
  place('Ridge', 'Ridge Noodles'),
  place('Ladle', 'Brindle Noodle Ladle', { rating: 4.6, count: 220, km: 0.4 })
];
const JUDGED = { FixtureBrindleLadle: { veg: 'verified', fit: 0.7 }, FixtureBrindleSteam: { veg: 'likely', relevance: 0.8 }, FixtureBrindleBroth: { veg: 'no' },
  FixtureBrindleRidge: { veg: 'verified' } };
const REACH = { FixtureBrindleRidge: { minutes: 120, mode: 'TRANSIT' } };
const scoutOpts = () => ({ what: 'noodle', group: 'food', diet: 'vegetarian', anchors: [{ lat: INN.lat, lng: INN.lng }], reach: REACH, judgments: JUDGED, trip_dates: TRIP });
const pool = (sc, raw = RAW) => raw.map((r) => sc.fromScoutResult(r, { local_mentions: r.id === 'FixtureBrindleLadle' ? LOCAL : [] }));
const sha = (v) => require('node:crypto').createHash('sha256').update(JSON.stringify(v)).digest('hex');
const scoutPayloadOf = (sc, ranked) => sc.scoutPayload({ scout_id: 'sc-20270601-noodle', query: 'noodle', destination: 'brindlewick', place_label: 'Brindlewick',
  group: 'food', created_on: '2027-06-01', from: 'your inn', diet: 'vegetarian', ranked });

test('engine: scout mode is unchanged — today\'s board for this pool, pinned (ranking and the whole payload)', async () => {
  const sc = await SC();
  const r = sc.rankScout(pool(sc), scoutOpts());
  assert.deepEqual(J({ items: r.items.map((i) => [i.place_id, i.score, i.labels, i.why]), left_out: r.left_out.map((l) => [l.place_id, l.reason]), more: r.more }), {
    items: [
      ['FixtureBrindleLadle', 81, ['gem', 'veg_verified'], 'Named for noodle; very well rated; named by two local sources; about 7 min walk (estimated).'],
      ['FixtureBrindleSteam', 59, ['veg_likely', 'not_judged'], 'On topic for noodle; well rated; about 16 min walk (estimated).']
    ],
    left_out: [['FixtureBrindleLadle', 'duplicate'], ['FixtureBrindleShut', 'closed'], ['FixtureBrindleSunday', 'closed_on_trip'], ['FixtureBrindleSour', 'low_rating'],
      ['FixtureBrindleTiny', 'unproven'], ['FixtureBrindleGear', 'off_topic'], ['FixtureBrindleBroth', 'diet'], ['FixtureBrindlePlain', 'diet_unproven'], ['FixtureBrindleRidge', 'too_far']],
    more: 0
  });
  assert.ok(r.items.every((i) => !('flags' in i)), 'a scout item carries no flags');
  assert.equal(r.mode, undefined, 'a scout ranking names no mode');
  const p = scoutPayloadOf(sc, r);
  assert.equal(sha(p), 'ce2e81c0004e6215ceb5634addfbad49c54e239320fd45602e038b4af54ab52c', 'the scout payload, byte for byte as before compare');
  assert.ok(!('mode' in p) && !('source' in p));
  // An explicit mode "scout" is the same run.
  assert.equal(sha(scoutPayloadOf(sc, sc.rankScout(pool(sc), { ...scoutOpts(), mode: 'scout' }))), sha(p));
});

const compareOpts = (over = {}) => ({ ...scoutOpts(), what: undefined, mode: 'compare', source: { list: 'Noodle list' }, ...over });
const flagsBy = (r) => Object.fromEntries(r.items.map((i) => [i.place_id, i.flags]));

test('engine (compare): no topic screen — the pool is given, the topic part is 1 for every place', async () => {
  const sc = await SC();
  const r = sc.rankScout(pool(sc), compareOpts());
  assert.equal(r.mode, 'compare');
  assert.deepEqual(J(r.source), { list: 'Noodle list' });
  assert.ok(r.items.some((i) => i.place_id === 'FixtureBrindleGear'), 'the bike shop is compared, not dropped');
  assert.ok(r.items.every((i) => i.parts.topic === 1), 'topic is 1 for every place');
  assert.ok(!r.left_out.some((l) => l.reason === 'off_topic'));
  assert.ok(!flagsBy(r).FixtureBrindleGear.includes('off_topic'));
  assert.match(r.items.find((i) => i.place_id === 'FixtureBrindleGear').why, /^On your list Noodle list/);
  // what is not needed in compare mode; the named form says so in its own words.
  const named = sc.rankScout(pool(sc, RAW.slice(0, 2)), compareOpts({ source: { names: ['Brindle Noodle Ladle', 'Steam Noodle Bar'] } }));
  assert.match(named.items[0].why, /^One of the places you named/);
  assert.throws(() => sc.rankScout(pool(sc), { mode: 'compare' }), /source/);
});

test('engine (compare): every screen but duplicate becomes a flag; a place can carry several', async () => {
  const sc = await SC();
  const r = sc.rankScout(pool(sc), compareOpts());
  // Shut, Sunday, Sour and Tiny have no veg judgment: for a vegetarian party they are also "vegetarian not confirmed".
  assert.deepEqual(J(flagsBy(r)), {
    FixtureBrindleLadle: [], FixtureBrindleSteam: [], FixtureBrindleShut: ['closed', 'diet_unproven'], FixtureBrindleSunday: ['closed_on_trip', 'diet_unproven'], FixtureBrindleSour: ['low_rating', 'diet_unproven'],
    FixtureBrindleTiny: ['unproven', 'diet_unproven'], FixtureBrindleGear: [], FixtureBrindleBroth: ['diet'], FixtureBrindlePlain: ['diet_unproven'], FixtureBrindleRidge: ['too_far']
  });
  assert.deepEqual(J(r.left_out), [{ place_id: 'FixtureBrindleLadle', name: 'Brindle Noodle Ladle', reason: 'duplicate' }], 'a duplicate still leaves');
  // Several at once, in SCREEN_ORDER: closed, low rating, too far.
  const worst = place('Worst', 'Worst Noodle Hall', { status: 'CLOSED_TEMPORARILY', rating: 3.2, count: 60, hours: week([0]) });
  const w = sc.rankScout(pool(sc, [worst]), compareOpts({ reach: { FixtureBrindleWorst: { minutes: 130, mode: 'TRANSIT' } }, judgments: { FixtureBrindleWorst: { veg: 'verified' } } }));
  assert.deepEqual(J(w.items[0].flags), ['closed', 'closed_on_trip', 'low_rating', 'too_far']);
  // The diet screens apply to food places only: a museum on the list is not "vegetarian not confirmed".
  const museum = place('Mus', 'Brindle Lantern Museum', { types: ['museum'] });
  assert.deepEqual(J(sc.rankScout(pool(sc, [museum]), compareOpts()).items[0].flags), []);
});

test('engine (compare): a hard flag (closed, closed on your days, diet) sorts after every place without one; soft flags only show', async () => {
  const sc = await SC();
  const r = sc.rankScout(pool(sc), compareOpts());
  const HARD = ['closed', 'closed_on_trip', 'diet'];
  const hard = r.items.map((i) => i.flags.some((f) => HARD.includes(f)));
  assert.deepEqual(hard, [...hard].sort((a, b) => a - b), 'no hard-flagged place above a clean or soft-flagged one');
  assert.deepEqual(r.items.filter((_, k) => hard[k]).map((i) => i.place_id).sort(), ['FixtureBrindleBroth', 'FixtureBrindleShut', 'FixtureBrindleSunday']);
  // Inside each half, the scout order holds (score first).
  for (const half of [false, true]) {
    const s = r.items.filter((_, k) => hard[k] === half).map((i) => i.score);
    assert.deepEqual(s, [...s].sort((a, b) => b - a));
  }
  // A soft-flagged place with a higher score stays above a clean one.
  const soft = sc.rankScout(pool(sc, [place('Clean', 'Clean Noodle Room', { rating: 4.0, count: 60 }), place('Far', 'Far Noodle Room', { rating: 4.9, count: 400 })]),
    compareOpts({ reach: { FixtureBrindleFar: { minutes: 100, mode: 'TRANSIT' } }, judgments: { FixtureBrindleClean: { veg: 'verified' }, FixtureBrindleFar: { veg: 'verified', fit: 1 } } }));
  assert.deepEqual(soft.items.map((i) => [i.place_id, i.flags]), [['FixtureBrindleFar', ['too_far']], ['FixtureBrindleClean', []]]);
});

test('engine (compare): ten places at most — those in `where` first, then the most recently listed; `more` counts the rest', async () => {
  const sc = await SC();
  const raw = Array.from({ length: 13 }, (_, k) => place('L' + k, 'Listed Noodle ' + k, { count: 100 + k }));
  const listed_on = Object.fromEntries(raw.map((r, k) => [r.id, '2027-0' + (1 + (k % 5)) + '-1' + (k % 9)]));
  delete listed_on.FixtureBrindleL12;   // no date: after every dated place
  const in_where = ['FixtureBrindleL0', 'FixtureBrindleL7', 'FixtureBrindleL12'];
  const r = sc.rankScout(pool(sc, raw), compareOpts({ in_where, listed_on, judgments: {} }));
  assert.equal(r.items.length, 10);
  assert.equal(r.more, 3);
  const kept = new Set(r.items.map((i) => i.place_id));
  in_where.forEach((id) => assert.ok(kept.has(id), id + ' is in where: kept'));
  // Of the other ten, the seven most recently listed are kept (dates descending, pool order on a tie).
  const others = raw.map((x) => x.id).filter((id) => !in_where.includes(id)).sort((a, b) => (listed_on[b] < listed_on[a] ? -1 : listed_on[b] > listed_on[a] ? 1 : 0));
  assert.deepEqual([...kept].filter((id) => !in_where.includes(id)).sort(), others.slice(0, 7).sort());
  // Without where or dates: pool order.
  const plain = sc.rankScout(pool(sc, raw), compareOpts({ judgments: {} }));
  assert.deepEqual(plain.items.map((i) => i.place_id).sort(), raw.slice(0, 10).map((x) => x.id).sort());
  assert.equal(plain.more, 3);
  assert.equal(sc.WEIGHTS.COMPARE_MAX, 10);
});

test('engine (compare): names the lookup could not find are left out as not_found, first', async () => {
  const sc = await SC();
  const r = sc.rankScout(pool(sc, RAW.slice(0, 2)), compareOpts({ source: { names: ['Brindle Noodle Ladle', 'Steam Noodle Bar', 'Lost Lantern'] }, not_found: ['Lost Lantern', '  '] }));
  assert.deepEqual(J(r.left_out), [{ place_id: null, name: 'Lost Lantern', reason: 'not_found' }]);
});

test('payload (compare): mode, source, the query "compare: …", item flags; validated; a scout ranking gains none of them', async () => {
  const sc = await SC();
  const s = await S();
  const r = sc.rankScout(pool(sc), compareOpts({ not_found: ['Lost Lantern'] }));
  const p = sc.scoutPayload({ scout_id: 'sc-20270601-compare', destination: 'brindlewick', place_label: 'Brindlewick', created_on: '2027-06-01', diet: 'vegetarian', ranked: r });
  assert.equal(p.mode, 'compare');
  assert.deepEqual(p.source, { list: 'Noodle list' });
  assert.equal(p.query, 'compare: Noodle list');
  assert.equal(p.group, 'food');
  assert.ok(s.validatePayload('scout', p).ok);
  assert.deepEqual(p.items.find((i) => i.place_id === 'FixtureBrindlePlain').flags, ['diet_unproven']);
  assert.ok(!('flags' in p.items.find((i) => i.place_id === 'FixtureBrindleLadle')), 'no flags, no key');
  assert.deepEqual(p.left_out[0], { name: 'Lost Lantern', reason: 'not_found' });
  // The named form: the names joined, clipped to 80.
  const long = ['Brindle Noodle Ladle With A Very Long Name Indeed', 'Steam Noodle Bar Of The Mill Lane Quarter', 'Third Place'];
  const q = sc.compareQuery({ names: long });
  assert.ok(q.startsWith('compare: Brindle Noodle Ladle') && q.length <= 80, q);
  assert.equal(sc.compareQuery({ names: ['A one', 'B two'] }), 'compare: A one, B two');
});

/* ---------------- the board ---------------- */
const comparePayload = (sc, over = {}) => sc.scoutPayload({ scout_id: 'sc-20270601-compare', destination: 'brindlewick', place_label: 'Brindlewick', created_on: '2027-06-01',
  diet: 'vegetarian', from: 'your inn', ranked: sc.rankScout(pool(sc), compareOpts({ not_found: ['Lost Lantern'], ...over })) });
const cardOf = (html, name) => { const i = html.indexOf('>' + name + '<'); return html.slice(html.lastIndexOf('<li class="card"', i), html.indexOf('</li>', i)); };

test('board (compare): titled "Compare — <source>", one "⚠️ <words>" line per flag with REASON_TEXT\'s words, no topic bar', async () => {
  const sc = await SC();
  const { html } = sc.renderScoutBoard({ payload: comparePayload(sc), trip_dates: TRIP, options: { built_on: '2027-06-01' } });
  assert.match(html, /<div class="kicker">Compare<\/div><h1>Compare — Noodle list<\/h1>/);
  assert.match(html, /<title>Compare — Noodle list<\/title>/);
  const plain = cardOf(html, 'Plain Noodle Diner');
  assert.match(plain, /<div class="warn">⚠️ vegetarian not confirmed<\/div>/);
  const shut = cardOf(html, 'Shut Noodle House');
  assert.deepEqual([...shut.matchAll(/<div class="warn">⚠️ ([^<]+)<\/div>/g)].map((m) => m[1]), ['closed', 'vegetarian not confirmed']);
  assert.match(cardOf(html, 'Sunday Noodles'), /⚠️ closed on every trip day/);
  assert.doesNotMatch(cardOf(html, 'Brindle Noodle Ladle'), /⚠️/, 'a clean place has no warning');
  assert.doesNotMatch(html, /on topic<i>/, 'the topic part is 1 for every place: no bar');
  assert.match(html, /quality<i>/);
  assert.match(html, /<li>Lost Lantern — not found<\/li>/);
  assert.doesNotMatch(html, /Every pick has something vegetarian/, 'a compare board makes no such promise');
  assert.match(html, /<th>Warnings<\/th>/);
  assert.equal(sc.REASON_TEXT.not_found, 'not found');
  // REASON_TEXT keeps every word it had.
  assert.deepEqual({ ...sc.REASON_TEXT, not_found: undefined }, { off_topic: 'not really about it', diet: 'nothing vegetarian-safe', diet_unproven: 'vegetarian not confirmed',
    low_rating: 'poorly rated', unproven: 'too few ratings and no local word', closed: 'closed', closed_on_trip: 'closed on every trip day',
    too_far: 'too far', duplicate: 'listed twice', other: 'other', not_found: undefined });
  // The named form, and the city-dates wording for closed on your days.
  const named = sc.renderScoutBoard({ payload: comparePayload(sc, { source: { names: ['Sunday Noodles', 'Brindle Noodle Ladle'] } }), city_dates: TRIP }).html;
  assert.match(named, /<h1>Compare — Sunday Noodles, Brindle Noodle Ladle<\/h1>/);
  assert.match(named, /⚠️ closed on every day you are there/);
});

test('board (scout): unchanged — Scout kicker, the topic bar, no warnings', async () => {
  const sc = await SC();
  const { html } = sc.renderScoutBoard({ payload: scoutPayloadOf(sc, sc.rankScout(pool(sc), scoutOpts())), trip_dates: TRIP });
  assert.match(html, /<div class="kicker">Scout<\/div><h1>Noodle in Brindlewick<\/h1>/);
  assert.match(html, /on topic<i>/);
  assert.doesNotMatch(html, /⚠️|class="warn"|<th>Warnings<\/th>/);
  assert.match(html, /Every pick has something vegetarian/);
});

/* ---------------- the core: store, chat card, /scouts, the app ---------------- */
const SHELL = 'https://app.example.invalid/helper-app.html';
function coreTrip() {
  const { ctx, state } = core();
  state.props[ctx.PROP.APP_SHELL_URL] = SHELL;
  ctx.tgTripUpsert({ slug: 'brindlewick', title: 'Brindlewick', destination: 'Brindlewick', start: '2027-06-07', end: '2027-06-09', status: 'planned' });
  return { ctx, state };
}
const deliver = (ctx, state, payload) => { H.putEnvelope(state, H.envelope('scout', payload)); return J(ctx.pollFromBrain()); };
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const buttonsOf = (m) => (m && m.reply_markup ? m.reply_markup.inline_keyboard.flat() : []);
const appOp = (ctx, state, op, args) => J(H.appPost(ctx, state, 'app', { op, args }));
const say = (ctx, state, text) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text })));

test('core: a compare board is stored with its mode, source and flags; the chat card is "⚖️ Compare — <source>" with one "⚠️ <words>" line per flag', () => {
  const { ctx, state } = coreTrip();
  const res = deliver(ctx, state, compareBoard({ trip: 'brindlewick', items: [item(1), item(2, { flags: ['diet_unproven', 'closed_on_trip', 'too_far'] })] }));
  assert.equal(res.processed, 1, JSON.stringify(res));
  const rec = J(ctx.tgScoutGet('sc-20270601-compare'));
  assert.equal(rec.mode, 'compare');
  assert.deepEqual(rec.source, { names: ['Brindle Pick 1', 'Brindle Pick 2', 'Lost Lantern'] });
  assert.deepEqual(rec.items[1].flags, ['diet_unproven', 'closed_on_trip', 'too_far']);
  assert.ok(!('flags' in rec.items[0]));
  const m = sends(state).pop();
  const lines = m.text.split('\n');
  assert.equal(lines[0], '⚖️ <b>Compare — Brindle Pick 1, Brindle Pick 2, Lost Lantern</b> — 2 places, side by side');
  const at = lines.findIndex((l) => l.startsWith('<b>2.</b>'));
  // The words are TG_SCOUT_LEFT_WORDS', as the left-out line uses them.
  assert.deepEqual(lines.slice(at + 1, at + 4), ['⚠️ vegetarian not confirmed', '⚠️ closed on your days', '⚠️ too far']);
  assert.ok(!lines.slice(lines.findIndex((l) => l.startsWith('<b>1.</b>')) + 1, at).some((l) => l.startsWith('⚠️')), 'a clean place has no warning');
  assert.ok(lines.includes('<i>Left out: Lost Lantern — not found</i>'), 'a compare board names what it left out');
  // ➕ works as on a scout board.
  const plus = buttonsOf(m).filter((b) => /^➕/.test(b.text));
  assert.deepEqual(plus.map((b) => b.text), ['➕ 1', '➕ 2']);
  ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ callback: plus[1].callback_data })));
  assert.deepEqual(J(ctx.tgLaterList('brindlewick')).map((e) => e.place_slug), ['brindle-pick-2']);
  // The list form.
  deliver(ctx, state, compareBoard({ scout_id: 'sc-20270601-dinner-list', source: { list: 'Dinner list' }, query: 'compare: Dinner list' }));
  assert.match(sends(state).pop().text, /^⚖️ <b>Compare — Dinner list<\/b>/);
});

test('core: an old scout board (no mode) is stored, shown and listed exactly as before', () => {
  const { ctx, state } = coreTrip();
  deliver(ctx, state, scoutBoard({ trip: 'brindlewick' }));
  const rec = J(ctx.tgScoutGet('sc-20270601-dinner'));
  assert.equal(rec.mode, 'scout');
  assert.ok(!('source' in rec));
  const text = sends(state).pop().text;
  assert.match(text, /^🔎 <b>Dinner in Brindlewick<\/b> — 1 pick, ranked for you/);
  assert.doesNotMatch(text, /⚠️|⚖️/);
  assert.match(text, /<i>Left out: 1 off topic<\/i>/);
  // A row from before the mode column (blank) reads as a scout board.
  ctx.storeUpsertById('Scouts', { id: 'sc-20270601-dinner', mode: '', source_json: '' });
  assert.equal(J(ctx.tgScoutGet('sc-20270601-dinner')).mode, 'scout');
  const head = appOp(ctx, state, 'scout.get', { id: 'sc-20270601-dinner' }).scout;
  assert.ok(!('mode' in head) && !('source' in head), 'the app sees an old board as it always did');
});

test('core: /scouts marks a compare board with ⚖️', () => {
  const { ctx, state } = coreTrip();
  deliver(ctx, state, scoutBoard());
  deliver(ctx, state, compareBoard());
  say(ctx, state, '/scouts');
  const m = sends(state).pop();
  const lines = m.text.split('\n');
  assert.equal(lines[1], '<b>1.</b> ⚖️ Compare — Brindle Pick 1, Brindle Pick 2, Lost Lantern · 2 places · ' + ctx.tgCmdDate('2027-06-01'));
  assert.equal(lines[2], '<b>2.</b> Dinner in Brindlewick · 1 pick · ' + ctx.tgCmdDate('2027-06-01'));
  assert.deepEqual(buttonsOf(m).filter((b) => b.callback_data).map((b) => b.text), ['⚖️ 1', '🔎 2']);
});

test('app: scout.get and scout.list pass a compare board\'s mode, source and flags through', () => {
  const { ctx, state } = coreTrip();
  deliver(ctx, state, compareBoard());
  const g = appOp(ctx, state, 'scout.get', { id: 'sc-20270601-compare' });
  assert.equal(g.ok, true);
  assert.equal(g.scout.mode, 'compare');
  assert.deepEqual(g.scout.source, { names: ['Brindle Pick 1', 'Brindle Pick 2', 'Lost Lantern'] });
  assert.deepEqual(g.scout.items[1].flags, ['diet_unproven', 'too_far']);
  assert.deepEqual(g.scout.left_out, [{ name: 'Lost Lantern', reason: 'not_found' }]);
  const l = appOp(ctx, state, 'scout.list');
  assert.equal(l.scouts[0].mode, 'compare');
  assert.deepEqual(l.scouts[0].source, { names: ['Brindle Pick 1', 'Brindle Pick 2', 'Lost Lantern'] });
});

/* ---------------- the app page's Scout screen, run in a vm with a tiny DOM (as pack_tour-guide_p14b_scout.test.js) ---------------- */
// The page lives outside helpers/; a vendored copy of these tests (helpers only) has no page to read, so these tests skip there.
const vm = require('node:vm');
const PAGE_FILE = path.join(__dirname, '..', '..', 'live-site-pages', 'helper-app.html');
const PAGE = fs.existsSync(PAGE_FILE) ? fs.readFileSync(PAGE_FILE, 'utf8') : null;
const NO_PAGE = { skip: PAGE === null ? 'the app page is not part of this copy of the helpers' : false };
function node(tag, attrs = {}, children) {
  const n = { tag, attrs, children: [], text: attrs.text === undefined ? '' : String(attrs.text),
    appendChild(c) { if (c) this.children.push(c); return c; }, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, addEventListener() {} };
  [].concat(children || []).forEach((c) => n.appendChild(typeof c === 'string' ? node('#text', { text: c }) : c));
  return n;
}
const walk = (n, f, out = []) => { if (!n) return out; if (f(n)) out.push(n); n.children.forEach((c) => walk(c, f, out)); return out; };
const textOf = (n) => n.text + n.children.map(textOf).join('');
/** Run the Scout screen's code with `answers` as the app ops' answers; open one scout (id) or the list (''). → the rendered view. */
function runApp(answers, id) {
  const start = PAGE.indexOf('    /* ---------- scout:'), end = PAGE.indexOf('\n    }\n', PAGE.indexOf('    function showScoutOne(id) {')) + 7;
  let rendered = null;
  const box = { str: (v, max) => { v = v === undefined || v === null ? '' : String(v); return max && v.length > max ? v.slice(0, max - 1) + '…' : v; },
    num: (v) => (isFinite(Number(v)) ? Number(v) : 0), list: (v) => (Array.isArray(v) ? v : []), obj: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}),
    el: node, clear: (n) => { n.children.length = 0; return n; }, linkBtn: () => null, render: (v) => { rendered = v; }, stateView: () => null, why: () => '',
    call: (op, args, ok) => { if (answers[op]) ok(answers[op]); }, setMain() {}, haptic() {}, go() {}, setStatus() {}, mainProgress() {}, httpsUrl: () => '',
    S: { scout: id }, SCOUT_ID_RE: /^sc-/, setTimeout, clearTimeout };
  vm.runInNewContext(PAGE.slice(start, end) + '\n' + (id ? 'showScoutOne(' + JSON.stringify(id) + ');' : 'showScout();'), box);
  return rendered;
}
const appCards = (view) => walk(view, (n) => n.attrs && n.attrs.class === 'item reveal').map((card) => ({
  bars: walk(card, (n) => n.attrs && n.attrs['data-part']).map((b) => b.attrs['data-part']),
  warns: walk(card, (n) => n.attrs && n.attrs.class === 'warn').map((w) => w.text)
}));
const appItem = (n, flags) => ({ n, name: 'Brindle Pick ' + n, why_you: 'One of the places you named.', parts: { topic: 100, quality: 70, fit: 30, local: 25, reach: 60 },
  labels: [], maps_url: 'https://www.google.com/maps/', ...(flags ? { flags } : {}) });

test('app (compare): the Scout screen shows "⚖️ Compare — <source>", a "⚠️ <words>" line per flag (SCOUT_LEFT\'s words) and no topic bar', NO_PAGE, () => {
  const view = runApp({ 'scout.get': { scout: { id: 'sc-20270601-compare', mode: 'compare', source: { list: 'Noodle list' }, query: 'compare: Noodle list', place_label: 'Brindlewick',
    created_on: '2027-06-01', items: [appItem(1), appItem(2, ['closed_on_trip', 'diet_unproven', 'not_a_flag'])], left_out: [{ name: 'Lost Lantern', reason: 'not_found' }] } } }, 'sc-20270601-compare');
  assert.equal(walk(view, (n) => n.tag === 'h2')[0].text, '⚖️ Compare — Noodle list');
  assert.match(textOf(view), /2 places, side by side/);
  const cards = appCards(view);
  assert.deepEqual(cards.map((c) => c.bars), [['quality', 'fit', 'local', 'reach'], ['quality', 'fit', 'local', 'reach']]);
  assert.deepEqual(cards.map((c) => c.warns), [[], ['⚠️ closed on your days', '⚠️ vegetarian not confirmed', '⚠️ not_a_flag']]);
  assert.match(textOf(view), /Lost Lantern — not found/);
  // The named form.
  const named = runApp({ 'scout.get': { scout: { id: 'sc-20270601-compare', mode: 'compare', source: { names: ['Reed Mill', 'Pear Press'] }, items: [], left_out: [] } } }, 'sc-20270601-compare');
  assert.equal(walk(named, (n) => n.tag === 'h2')[0].text, '⚖️ Compare — Reed Mill, Pear Press');
});

test('app (scout): an old board keeps its title, its topic bar and no warnings; the past list marks a compare board ⚖️', NO_PAGE, () => {
  const view = runApp({ 'scout.get': { scout: { id: 'sc-20270601-dinner', query: 'dinner', place_label: 'Brindlewick, Fictland', items: [appItem(1, ['too_far'])], left_out: [] } } }, 'sc-20270601-dinner');
  assert.equal(walk(view, (n) => n.tag === 'h2')[0].text, 'Dinner in Brindlewick');
  assert.deepEqual(appCards(view), [{ bars: ['topic', 'quality', 'fit', 'local', 'reach'], warns: [] }], 'flags on a scout board are not shown');
  const past = runApp({ 'scout.list': { scouts: [{ id: 'sc-20270601-compare', mode: 'compare', source: { list: 'Noodle list' }, count: 3, created_on: '2027-06-01' },
    { id: 'sc-20270601-dinner', query: 'dinner', place_label: 'Brindlewick', count: 1, created_on: '2027-06-01' }] } }, '');
  const names = walk(past, (n) => n.attrs && n.attrs.class === 'name').map((n) => n.text);
  assert.deepEqual(names, ['⚖️ Compare — Noodle list', 'Dinner in Brindlewick']);
  assert.match(textOf(past), /3 places/);
});

// Developed by: LightAISolutions

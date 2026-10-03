'use strict';
// packs/tour-guide — Scout engine (helpers/decisions/TG-SCOUT.md §3, §4, §5, §7): parsing the ask, the search strings,
// the pool record, the ranking math, every screen reason, ties, the vegetarian hard rule for food, the `scout` payload
// and its checks, the Place fields, and the board (escaping, attribution, map, app mode, PDF when a browser exists).
// Wrenmouth is an invented harbour town; every place, id, rating and mention below is invented and nothing is fetched.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SC = () => import('../packs/tour-guide/scout/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');

const HOTEL = { label: 'your inn', lat: 41.5, lng: -70.2 };
const at = (kmNorth, kmEast = 0) => ({ latitude: HOTEL.lat + kmNorth / 111, longitude: HOTEL.lng + kmEast / 83 });
const week = (days, open = 9, close = 18) => ({ periods: days.map((day) => ({ open: { day, hour: open, minute: 0 }, close: { day, hour: close, minute: 0 } })) });
const EVERYDAY = week([0, 1, 2, 3, 4, 5, 6]);
const TRIP = ['2027-06-07', '2027-06-08', '2027-06-09'];   // Monday, Tuesday, Wednesday
const MENTIONS = [{ ref: 'L101', language: 'ja', kind: 'local-language', publisher: 'wren-weekly.example' }, { ref: 'L102', language: 'en', kind: 'editorial', publisher: 'coast-eats.example' }];
function place(id, name, o = {}) {
  const types = o.types || ['cafe'];
  return { id: 'FixtureWren' + id, displayName: { text: name }, types, primaryType: types[0], rating: o.rating === undefined ? 4.5 : o.rating,
    userRatingCount: o.count === undefined ? 100 : o.count, businessStatus: o.status || 'OPERATIONAL', location: at(o.km === undefined ? 0.5 : o.km),
    regularOpeningHours: o.hours === undefined ? EVERYDAY : o.hours, servesVegetarianFood: o.veg, editorialSummary: o.editorial ? { text: o.editorial } : undefined,
    photos: o.photos, priceLevel: o.price };
}
const RAW = [
  place('MatchaHouse', 'Wren Matcha House', { rating: 4.7, count: 320, veg: true, km: 0.4, price: 'PRICE_LEVEL_MODERATE' }),
  place('TeaRoom', 'Harbour Tea Room', { types: ['tea_house'], rating: 4.5, count: 120, editorial: 'Known for its ceremonial matcha and quiet garden.', km: 1.2 }),
  place('Saltmarsh', 'Saltmarsh Café', { rating: 4.4, count: 80, veg: true, km: 0.9, hours: week([0, 1, 3, 4, 5, 6]) }),
  place('OldMill', 'Old Mill Matcha', { status: 'CLOSED_PERMANENTLY' }),
  place('Weekend', 'Weekend Matcha Bar', { hours: week([0, 6]) }),
  place('Gull', 'Gull Matcha Stand', { rating: 3.6, count: 150 }),
  place('Cart', 'Tiny Matcha Cart', { rating: 5, count: 3 }),
  place('Burger', 'Wrenmouth Burger Bar', { types: ['restaurant'], veg: true }),
  place('Kelp', 'Kelp Matcha Kitchen', { veg: true }),
  place('Driftwood', 'Driftwood Matcha', {}),
  place('FarPoint', 'Far Point Matcha', { km: 3 }),
  place('MatchaHouse', 'Wren Matcha House', { rating: 4.7, count: 320, veg: true, km: 0.4 })
];
const JUDGE = {
  FixtureWrenMatchaHouse: { veg: 'verified', try: 'Matcha parfait with red bean', fit: 0.8 },
  FixtureWrenTeaRoom: { veg: 'likely', try: 'Usucha and a seasonal sweet', labels: ['booking'] },
  FixtureWrenSaltmarsh: { relevance: 0.7 },
  FixtureWrenKelp: { veg: 'no' }, FixtureWrenFarPoint: { veg: 'verified' }, FixtureWrenGull: { veg: 'verified' }, FixtureWrenCart: { veg: 'verified' }
};
const REACH = { FixtureWrenMatchaHouse: { minutes: 6, mode: 'WALK', estimated: false }, FixtureWrenFarPoint: { minutes: 95, mode: 'WALK', estimated: false } };

async function world(over = {}) {
  const sc = await SC();
  const pool = RAW.map((r) => sc.fromScoutResult(r, { query: 'matcha', local_mentions: r.id === 'FixtureWrenMatchaHouse' ? MENTIONS : [] }));
  const ranked = sc.rankScout(pool, { what: 'matcha', group: 'food', diet: 'vegetarian', anchors: [HOTEL], reach: REACH, judgments: JUDGE, trip_dates: TRIP, ...over });
  return { sc, pool, ranked };
}

test('parseScoutText: in / comma / @ / near, a leading /scout, no place, and clipping', async () => {
  const { parseScoutText } = await SC();
  assert.deepEqual(parseScoutText('matcha in Kyoto'), { what: 'matcha', where: 'Kyoto' });
  assert.deepEqual(parseScoutText('matcha, Kyoto'), { what: 'matcha', where: 'Kyoto' });
  assert.deepEqual(parseScoutText('matcha @ Kyoto'), { what: 'matcha', where: 'Kyoto' });
  assert.deepEqual(parseScoutText('matcha@Wrenmouth'), { what: 'matcha', where: 'Wrenmouth' });
  assert.deepEqual(parseScoutText('matcha near Gion, Kyoto'), { what: 'matcha', where: 'Gion, Kyoto' });
  assert.deepEqual(parseScoutText('/scout   yuzu   sweets  IN  Wrenmouth?'), { what: 'yuzu sweets', where: 'Wrenmouth' });
  assert.deepEqual(parseScoutText('/scout@TourGuideBot tea ceremony in a temple in Wrenmouth'), { what: 'tea ceremony in a temple', where: 'Wrenmouth' });
  assert.deepEqual(parseScoutText('yuzu'), { what: 'yuzu', where: '' });
  assert.deepEqual(parseScoutText(''), { what: '', where: '' });
  const long = parseScoutText('x'.repeat(200) + ' in ' + 'y'.repeat(200));
  assert.equal(long.what.length, 80);
  assert.equal(long.where.length, 80);
});

test('scoutId: date + slug, -2/-3 on repeats, long slugs trimmed, a CJK query falls back to "scout", bad dates throw', async () => {
  const { scoutId } = await SC();
  assert.equal(scoutId('2026-10-03', 'matcha'), 'sc-20261003-matcha');
  assert.equal(scoutId('2026-10-03', 'Matcha Café!'), 'sc-20261003-matcha-cafe');
  assert.equal(scoutId('2026-10-03', 'matcha', ['sc-20261003-matcha']), 'sc-20261003-matcha-2');
  assert.equal(scoutId('2026-10-03', 'matcha', new Set(['sc-20261003-matcha', 'sc-20261003-matcha-2'])), 'sc-20261003-matcha-3');
  const id = scoutId('2026-10-03', 'a'.repeat(39) + ' b', ['sc-20261003-' + ('a'.repeat(39) + '-b').slice(0, 40).replace(/-+$/, '')]);
  assert.match(id, /^sc-\d{8}-[a-z0-9-]{1,40}$/);
  assert.ok(id.endsWith('-2'));
  assert.equal(scoutId('2026-10-03', '抹茶'), 'sc-20261003-scout');
  assert.throws(() => scoutId('2026-02-30', 'matcha'), /calendar date/);
  assert.throws(() => scoutId('20261003', 'matcha'), /calendar date/);
});

test('guessGroup and scoutQueries: food words, activity words win, ≤ 3 distinct strings, a diet variant for food', async () => {
  const { guessGroup, scoutQueries } = await SC();
  assert.equal(guessGroup('matcha'), 'food');
  assert.equal(guessGroup('ramen'), 'food');
  assert.equal(guessGroup('tea ceremony'), 'activities');
  assert.equal(guessGroup('pottery class'), 'activities');
  assert.equal(guessGroup('lighthouses'), 'activities');
  assert.deepEqual(scoutQueries({ what: 'matcha', where: 'Wrenmouth', group: 'food', diet: 'vegetarian' }), ['matcha in Wrenmouth', 'matcha cafe Wrenmouth', 'vegetarian matcha Wrenmouth']);
  assert.deepEqual(scoutQueries({ what: 'ramen', where: 'Wrenmouth', group: 'food' }), ['ramen in Wrenmouth', 'ramen restaurant Wrenmouth']);
  assert.deepEqual(scoutQueries({ what: 'vegetarian ramen', where: 'Wrenmouth', group: 'food', diet: 'vegetarian' }), ['vegetarian ramen in Wrenmouth', 'vegetarian ramen restaurant Wrenmouth']);
  assert.deepEqual(scoutQueries({ what: 'pottery class', where: 'Wrenmouth', group: 'activities', extra_terms: ['workshop', 'studio', 'kiln'] }), ['pottery class in Wrenmouth', 'pottery class workshop Wrenmouth', 'pottery class studio Wrenmouth']);
  assert.deepEqual(scoutQueries({ what: 'matcha', group: 'food' }), ['matcha', 'matcha cafe']);
  assert.throws(() => scoutQueries({ where: 'Wrenmouth' }), /needs `what`/);
});

test('fromScoutResult: a gems record plus serves_vegetarian, editorial and the first photo (https credits only)', async () => {
  const { fromScoutResult } = await SC();
  const raw = place('Photo', 'Wren Matcha House', { veg: true, editorial: '  Matcha   since 1950. ', photos: [
    { name: 'places/FixtureWrenPhoto/photos/FixturePhotoRef01', widthPx: 1200, authorAttributions: [{ displayName: 'A. Walker', uri: '//maps.google.com/maps/contrib/fixture01' }, { displayName: 'B. Bad', uri: 'javascript:alert(1)' }] },
    { name: 'places/FixtureWrenPhoto/photos/FixturePhotoRef02' }] });
  const rec = fromScoutResult(raw, { query: 'matcha' });
  assert.equal(rec.place_id, 'FixtureWrenPhoto');
  assert.equal(rec.name, 'Wren Matcha House');
  assert.equal(rec.serves_vegetarian, true);
  assert.equal(rec.editorial, 'Matcha since 1950.');
  assert.deepEqual(rec.photo, { name: 'places/FixtureWrenPhoto/photos/FixturePhotoRef01', attributions: [{ name: 'A. Walker', uri: 'https://maps.google.com/maps/contrib/fixture01' }, { name: 'B. Bad' }] });
  const bare = fromScoutResult({ id: 'FixtureWrenBare', displayName: { text: 'Bare' } });
  assert.equal(bare.serves_vegetarian, null);
  assert.equal(bare.editorial, null);
  assert.equal(bare.photo, null);
  assert.equal(fromScoutResult({ ...raw, servesVegetarianFood: false }).serves_vegetarian, false);
  assert.throws(() => fromScoutResult({ displayName: { text: 'No id' } }), /needs a place with an id/);
});

test('ranking math: score = round(100 × (0.35T + 0.25Q + 0.15F + 0.10L + 0.15R)) with the Bayesian rating and the reach curve', async () => {
  const sc = await SC();
  const pool = [
    sc.fromScoutResult(place('Lantern', 'Lantern Matcha Bar', { rating: 4.6, count: 100 }), { local_mentions: [MENTIONS[0]] }),
    sc.fromScoutResult(place('Quay', 'Quay Coffee', { rating: 4.2, count: 50 }))
  ];
  const r = sc.rankScout(pool, { what: 'matcha', group: 'food', reach: { FixtureWrenLantern: { minutes: 25, mode: 'WALK', estimated: false } }, judgments: { FixtureWrenLantern: { fit: 0.8 } } });
  const it = r.items.find((x) => x.place_id === 'FixtureWrenLantern');
  const mu = (4.6 + 4.2) / 2, b = (100 * 4.6 + 30 * mu) / 130, Q = (b - 3.8) / 1.0, R = 1 - (0.7 * 15) / 30;
  assert.ok(Math.abs(it.parts.quality - Q) < 1e-9);
  assert.equal(it.parts.topic, 0.9);
  assert.equal(it.parts.fit, 0.8);
  assert.equal(it.parts.local, 0.25);
  assert.ok(Math.abs(it.parts.reach - R) < 1e-9);
  assert.equal(it.score, Math.round(100 * (0.35 * 0.9 + 0.25 * Q + 0.15 * 0.8 + 0.10 * 0.25 + 0.15 * R)));
  assert.equal(it.score, 75);
  assert.deepEqual(it.reach, { minutes: 25, mode: 'WALK', estimated: false });
  const W = sc.WEIGHTS.WEIGHTS;
  assert.equal(Object.values(W).reduce((s, x) => s + x, 0).toFixed(10), '1.0000000000');
  // the reach curve, the quality band and its prior
  for (const [m, v] of [[0, 1], [10, 1], [25, 0.65], [40, 0.3], [50, 0.2], [60, 0.1], [75, 0.1], [NaN, 0.5]]) assert.ok(Math.abs(sc.reachValue(m) - v) < 1e-9, `reach ${m}`);
  assert.equal(sc.qualityPart({ rating: 4.8, rating_count: 1e9 }, 4.2).toFixed(6), '1.000000');
  assert.equal(sc.qualityPart({ rating: 3.5, rating_count: 1e9 }, 4.2), 0);
  assert.ok(Math.abs(sc.qualityPart({}, 4.2) - 0.4) < 1e-9, 'no rating → the prior (4.2 → 0.4)');
  assert.ok(Math.abs(sc.qualityPart({ rating: 5 }, 4.2) - 0.4) < 1e-9, 'a rating without a count weighs nothing');
});

test('on-topic part: judgment wins, then name, usual type, editorial, else 0.2', async () => {
  const { topicPart } = await SC();
  const rec = (o) => ({ name: 'Plain Place', types: [], editorial: null, ...o });
  assert.deepEqual(topicPart(rec({ name: 'Wren Matcha House' }), { what: 'matcha', group: 'food', judgment: { relevance: 0.35 } }), { value: 0.35, source: 'judgment' });
  assert.deepEqual(topicPart(rec({ name: 'WREN MATCHA HOUSE' }), { what: 'matcha', group: 'food' }), { value: 0.9, source: 'name' });
  assert.deepEqual(topicPart(rec({ types: ['tea_house'] }), { what: 'matcha', group: 'food' }), { value: 0.6, source: 'type' });
  assert.deepEqual(topicPart(rec({ types: ['ramen_restaurant'] }), { what: 'ramen', group: 'food' }), { value: 0.6, source: 'type' });
  assert.deepEqual(topicPart(rec({ types: ['museum'] }), { what: 'lantern museum', group: 'activities' }), { value: 0.6, source: 'type' });
  assert.deepEqual(topicPart(rec({ editorial: 'Ceremonial matcha by the harbour.' }), { what: 'matcha', group: 'food' }), { value: 0.5, source: 'editorial' });
  assert.deepEqual(topicPart(rec({ types: ['restaurant'] }), { what: 'matcha', group: 'food' }), { value: 0.2, source: 'none' });
  assert.equal(topicPart(rec({}), { what: 'matcha', judgment: { relevance: 7 } }).value, 1, 'clamped');
});

test('screens: every drop reason, in pool order, each place once; the kept three are ranked', async () => {
  const { ranked } = await world();
  const reasons = Object.fromEntries(ranked.left_out.filter((l) => l.reason !== 'duplicate').map((l) => [l.place_id, l.reason]));
  assert.deepEqual(reasons, {
    FixtureWrenOldMill: 'closed', FixtureWrenWeekend: 'closed_on_trip', FixtureWrenGull: 'low_rating', FixtureWrenCart: 'unproven',
    FixtureWrenBurger: 'off_topic', FixtureWrenKelp: 'diet', FixtureWrenDriftwood: 'diet_unproven', FixtureWrenFarPoint: 'too_far'
  });
  assert.deepEqual(ranked.left_out.filter((l) => l.reason === 'duplicate'), [{ place_id: 'FixtureWrenMatchaHouse', name: 'Wren Matcha House', reason: 'duplicate' }]);
  assert.deepEqual(ranked.items.map((i) => i.place_id), ['FixtureWrenMatchaHouse', 'FixtureWrenTeaRoom', 'FixtureWrenSaltmarsh']);
  assert.deepEqual(ranked.items.map((i) => i.score), [...ranked.items.map((i) => i.score)].sort((a, b) => b - a));
  assert.equal(ranked.more, 0);
  const SCR = (await SC()).WEIGHTS.SCREEN_ORDER;
  assert.deepEqual(new Set(ranked.left_out.map((l) => l.reason)), new Set(SCR));
  // a temporarily closed place is "closed" too; an unknown status is not
  const { screenReason } = await SC();
  const base = { rating: 4.5, rating_count: 100, local_mentions: [], hours: null };
  assert.equal(screenReason({ ...base, business_status: 'CLOSED_TEMPORARILY' }, { topic: 1 }), 'closed');
  assert.equal(screenReason({ ...base, business_status: 'BUSINESS_STATUS_UNSPECIFIED' }, { topic: 1 }), null);
  assert.equal(screenReason({ ...base, rating: 3.9, rating_count: 19 }, { topic: 1 }), null, 'a low rating needs ≥ 20 ratings');
  assert.equal(screenReason({ ...base, rating_count: 4, local_mentions: [MENTIONS[0]] }, { topic: 1 }), null, 'a local mention proves a new place');
  assert.equal(screenReason({ ...base, rating_count: undefined }, { topic: 1 }), 'unproven', 'no count counts as zero');
  assert.equal(screenReason(base, { topic: 0.29 }), 'off_topic');
  assert.equal(screenReason(base, { topic: 0.3, reach: { minutes: 90 } }), null, '90 minutes is still in reach');
  assert.equal(screenReason(base, { topic: 0.3, reach: { minutes: 91 } }), 'too_far');
});

test('ties: score, then rating count (more first), then name; limit cuts and `more` counts the rest', async () => {
  const sc = await SC();
  const pool = [['Beta', 200], ['Alpha', 200], ['Gamma', 300], ['Delta', 50]].map(([n, c]) => sc.fromScoutResult(place(n, `${n} Matcha`, { rating: 4.5, count: c })));
  const r = sc.rankScout(pool, { what: 'matcha', group: 'food' });
  assert.equal(new Set(r.items.map((i) => i.score)).size, 1, 'every μ = 4.5, so every score ties');
  assert.deepEqual(r.items.map((i) => i.name), ['Gamma Matcha', 'Alpha Matcha', 'Beta Matcha', 'Delta Matcha']);
  const cut = sc.rankScout(pool, { what: 'matcha', group: 'food', limit: 2 });
  assert.deepEqual(cut.items.map((i) => i.name), ['Gamma Matcha', 'Alpha Matcha']);
  assert.equal(cut.more, 2);
  assert.equal(sc.rankScout(pool, { what: 'matcha', limit: 0 }).items.length, 1, 'limit is clamped to ≥ 1');
  assert.equal(sc.rankScout(pool, { what: 'matcha', limit: 99 }).items.length, 4, 'limit is clamped to ≤ 20');
  assert.throws(() => sc.rankScout(pool, {}), /needs `what`/);
  assert.throws(() => sc.rankScout('nope', { what: 'x' }), /pool array/);
});

test('reach: a route row wins, else a straight-line estimate (walk ≤ 30 min, else transit); closed on some trip days costs 0.3', async () => {
  const { ranked } = await world();
  const by = Object.fromEntries(ranked.items.map((i) => [i.place_id, i]));
  assert.deepEqual(by.FixtureWrenMatchaHouse.reach, { minutes: 6, mode: 'WALK', estimated: false });
  const tea = by.FixtureWrenTeaRoom.reach;
  assert.equal(tea.mode, 'WALK');
  assert.equal(tea.estimated, true);
  assert.ok(Math.abs(tea.minutes - (1.2 / 4.5) * 60) < 0.2, `~16 min on foot, got ${tea.minutes}`);
  const sc = await SC();
  const salt = by.FixtureWrenSaltmarsh;
  assert.ok(Math.abs(salt.parts.reach - (sc.reachValue(salt.reach.minutes) - 0.3)) < 1e-9, 'closed on the Tuesday → −0.3');
  const far = sc.reachFor({ place_id: 'X', location: { lat: HOTEL.lat + 9 / 111, lng: HOTEL.lng } }, { anchors: [HOTEL] });
  assert.equal(far.mode, 'TRANSIT');
  assert.ok(Math.abs(far.minutes - 36) < 0.5);
  assert.equal(sc.reachFor({ place_id: 'X', location: null }, { anchors: [HOTEL] }), null);
  const unknown = sc.rankScout([sc.fromScoutResult(place('Nowhere', 'Nowhere Matcha'))], { what: 'matcha' });
  assert.equal(unknown.items[0].reach, null);
  assert.equal(unknown.items[0].parts.reach, 0.5);
});

test('diet: vegetarian is a hard rule for food — veg no → diet; unknown needs Google servesVegetarianFood; other diets need a judgment', async () => {
  const sc = await SC();
  const pool = [
    sc.fromScoutResult(place('VegNo', 'Matcha One', { veg: true })),
    sc.fromScoutResult(place('VegGoogle', 'Matcha Two', { veg: true })),
    sc.fromScoutResult(place('VegNothing', 'Matcha Three', { veg: false })),
    sc.fromScoutResult(place('VegVerified', 'Matcha Four', { veg: false })),
    sc.fromScoutResult(place('VegLikely', 'Matcha Five'))
  ];
  const judgments = { FixtureWrenVegNo: { veg: 'no' }, FixtureWrenVegVerified: { veg: 'verified' }, FixtureWrenVegLikely: { veg: 'likely' } };
  const veg = sc.rankScout(pool, { what: 'matcha', group: 'food', diet: 'vegetarian', judgments });
  assert.deepEqual(Object.fromEntries(veg.left_out.map((l) => [l.place_id, l.reason])), { FixtureWrenVegNo: 'diet', FixtureWrenVegNothing: 'diet_unproven' });
  const labels = Object.fromEntries(veg.items.map((i) => [i.place_id, i.labels]));
  assert.deepEqual(labels, { FixtureWrenVegGoogle: ['veg_likely'], FixtureWrenVegVerified: ['veg_verified'], FixtureWrenVegLikely: ['veg_likely'] });
  const vegan = sc.rankScout(pool, { what: 'matcha', group: 'food', diet: 'vegan', judgments });
  assert.equal(vegan.left_out.find((l) => l.place_id === 'FixtureWrenVegGoogle').reason, 'diet_unproven', 'Google vegetarian evidence does not prove vegan');
  const none = sc.rankScout(pool, { what: 'matcha', group: 'food', judgments });
  assert.equal(none.left_out.length, 0, 'no diet → no diet screen');
  assert.equal(none.diet, null);
  const acts = sc.rankScout(pool, { what: 'matcha', group: 'activities', diet: 'vegetarian', judgments });
  assert.equal(acts.left_out.length, 0, 'activities ignore the diet');
  assert.ok(acts.items.every((i) => !i.labels.some((l) => l.startsWith('veg_'))));
});

test('labels and why: gem, chain, far, judgment labels; our own why line; the judgment why/try win', async () => {
  const { ranked, sc } = await world();
  const house = ranked.items[0];
  assert.deepEqual(house.labels, ['gem', 'veg_verified']);
  assert.equal(house.try, 'Matcha parfait with red bean');
  assert.equal(house.why, 'Named for matcha; exceptionally well rated; named by two local sources; about 6 min walk.');
  const tea = ranked.items[1];
  assert.deepEqual(tea.labels, ['veg_likely', 'booking']);
  assert.match(tea.why, /^The kind of place for matcha; very well rated; about \d+ min walk \(estimated\)\.$/);
  const chainPool = ['Tidewater', 'Tidewater', 'Tidewater', 'Starbucks Harbour'].map((n, i) => sc.fromScoutResult(place('Chain' + i, n + ' Matcha', { km: 12 }), { local_mentions: MENTIONS }));
  const chained = sc.rankScout(chainPool, { what: 'matcha', anchors: [HOTEL], judgments: { FixtureWrenChain0: { why: '  Our own   words.  ', labels: ['queue', 'not-a-label', 'queue'] } } });
  for (const it of chained.items) {
    assert.ok(it.labels.includes('chain'), it.name);
    assert.ok(it.labels.includes('far'), `${it.name}: ${it.reach.minutes} min`);
    assert.ok(!it.labels.includes('gem'), 'a chain is never a gem');
    assert.equal(it.parts.local, 0, 'a chain scores no local credit');
  }
  const c0 = chained.items.find((i) => i.place_id === 'FixtureWrenChain0');
  assert.equal(c0.why, 'Our own words.');
  assert.deepEqual(c0.labels, ['queue', 'chain', 'far']);
});

async function payloadOf(over = {}) {
  const { sc, ranked } = await world();
  return { sc, ranked, payload: sc.scoutPayload({ scout_id: 'sc-20270601-matcha', query: 'matcha', destination: 'wrenmouth', place_label: 'Wrenmouth', trip: 'wrenmouth-june-2027',
    group: 'food', created_on: '2027-06-01', from: 'your inn', diet: 'vegetarian', ranked,
    slugs: { FixtureWrenMatchaHouse: 'wren-matcha-house', FixtureWrenTeaRoom: 'wren-matcha-house' }, areas: { FixtureWrenMatchaHouse: 'Old harbour', FixtureWrenTeaRoom: 'Quayside' },
    categories: { FixtureWrenTeaRoom: 'cafe', FixtureWrenSaltmarsh: 'NOT A CATEGORY' }, drive: { board_html: 'fixtureDriveScoutBoard01', board_pdf: null, extra: 'dropped' }, ...over }) };
}

test('scoutPayload: own data only, validated, slugs de-duplicated, band words, reach rounded, left_out with reasons', async () => {
  const { payload } = await payloadOf();
  const s = await S();
  assert.deepEqual(s.validatePayload('scout', payload).errors, []);
  assert.equal(payload.kind, 'scout');
  assert.deepEqual(payload.items.map((i) => [i.n, i.slug]), [[1, 'wren-matcha-house'], [2, 'wren-matcha-house-2'], [3, 'saltmarsh-cafe']]);
  const [house, tea, salt] = payload.items;
  assert.deepEqual(house.parts, { topic: 90, quality: house.parts.quality, fit: 80, reach: 100 });
  assert.equal(house.rated, 'exceptionally well rated');
  assert.deepEqual(house.reach, { minutes: 6, mode: 'WALK', estimated: false });
  assert.equal(house.area, 'Old harbour');
  assert.equal(house.category, 'cafe');
  assert.equal(house.maps_url, 'https://www.google.com/maps/search/?api=1&query=Wren%20Matcha%20House&query_place_id=FixtureWrenMatchaHouse');
  assert.equal(Number.isInteger(tea.reach.minutes), true);
  assert.equal(salt.category, 'cafe', 'an invalid category falls back to the record\'s');
  assert.equal(payload.left_out.length, 9);
  assert.deepEqual(payload.drive, { board_html: 'fixtureDriveScoutBoard01', board_pdf: null });
  assert.equal(payload.diet, 'vegetarian');
  assert.equal(payload.more, undefined);
  const json = JSON.stringify(payload);
  for (const k of ['rating', 'rating_count', 'userRatingCount', 'hours', 'regularOpeningHours', 'location', 'website', 'address', 'photo', 'photos', 'editorial', 'serves_vegetarian', 'price_level', 'record']) assert.ok(!json.includes(`"${k}"`), k);
  assert.doesNotMatch(json, /4\.7|"320"|\b320\b/, 'no Google digit');
  const { sc, ranked } = await world();
  const acts = sc.scoutPayload({ scout_id: 'sc-20270601-matcha-2', query: 'matcha', destination: 'wrenmouth', place_label: 'Wrenmouth', group: 'activities', created_on: '2027-06-01', diet: 'vegetarian', ranked: { ...ranked, more: 4 } });
  assert.equal(acts.diet, undefined, 'diet is kept for food only');
  assert.equal(acts.more, 4);
});

test('scoutPayload refuses a Google field anywhere and an invalid result; the schema and hand checks refuse the rest', async () => {
  const { sc, ranked, payload } = await payloadOf();
  assert.throws(() => sc.assertNoGoogleKeys({ items: [{ name: 'ok', rating: 4.7 }] }), /Google content at \/items\/0\/rating/);
  assert.throws(() => sc.assertNoGoogleKeys({ left_out: [{ name: 'x', photo: {} }] }), /\/left_out\/0\/photo/);
  assert.doesNotThrow(() => sc.assertNoGoogleKeys(payload));
  assert.throws(() => sc.scoutPayload({ ranked, scout_id: 'bad id', query: 'matcha', destination: 'wrenmouth', place_label: 'W', group: 'food', created_on: '2027-06-01' }), /scout_id/);
  assert.throws(() => sc.scoutPayload({ ranked, scout_id: 'sc-20270601-m', query: 'matcha', destination: 'Wrenmouth!', place_label: 'W', group: 'food', created_on: '2027-06-01' }), /destination/);
  assert.throws(() => sc.scoutPayload({ query: 'x' }), /needs `ranked`/);
  const s = await S();
  const refuse = (mutate, pathPrefix, re) => {
    const x = JSON.parse(JSON.stringify(payload));
    mutate(x);
    const r = s.validatePayload('scout', x);
    assert.equal(r.ok, false, pathPrefix);
    assert.ok(r.errors.some((e) => e.path.startsWith(pathPrefix) && (!re || re.test(e.message))), `${pathPrefix}: ${JSON.stringify(r.errors)}`);
  };
  refuse((x) => { x.items[0].rating = 4.7; }, '/items/0/rating');
  refuse((x) => { x.items[0].photo = { name: 'p' }; }, '/items/0/photo');
  refuse((x) => { x.address = 'somewhere'; }, '/address');
  refuse((x) => { x.items[0].rated = '4.7 stars'; }, '/items/0/rated');
  refuse((x) => { x.items[0].labels = ['sponsored']; }, '/items/0/labels/0');
  refuse((x) => { x.items[0].labels = ['gem', 'gem']; }, '/items/0/labels', /duplicate label/);
  refuse((x) => { x.items[0].maps_url = 'http://maps.example.com/x'; }, '/items/0/maps_url');
  refuse((x) => { x.items[0].maps_url = 'javascript:alert(1)'; }, '/items/0/maps_url');
  refuse((x) => { x.items[1].n = 5; }, '/items/1/n', /out of order/);
  refuse((x) => { x.items[1].slug = x.items[0].slug; }, '/items', /duplicate slug/);
  refuse((x) => { x.items[1].place_id = x.items[0].place_id; }, '/items', /duplicate place id/);
  refuse((x) => { x.items[0].parts.topic = 101; }, '/items/0/parts/topic');
  refuse((x) => { delete x.items[0].parts.reach; }, '/items/0/parts');
  refuse((x) => { x.items[0].parts.local = 50; }, '/items/0/parts/local');
  refuse((x) => { x.items[0].why_you = ''; }, '/items/0/why_you');
  refuse((x) => { x.items[0].reach.mode = 'BICYCLE'; }, '/items/0/reach/mode');
  refuse((x) => { x.left_out[0].reason = 'sponsored'; }, '/left_out/0/reason');
  refuse((x) => { x.created_on = '2027-02-30'; }, '/created_on', /calendar date/);
  refuse((x) => { x.scout_id = 'sc-20270230-matcha'; }, '/scout_id', /calendar date/);
  refuse((x) => { x.group = 'shopping'; }, '/group');
  refuse((x) => { x.more = 1001; }, '/more');
  refuse((x) => { x.drive.board_html = 'x'; }, '/drive/board_html');
  refuse((x) => { x.items = Array.from({ length: 21 }, (_, i) => ({ ...x.items[0], n: i + 1, slug: `p-${i}`, place_id: `FixtureWrenP${i}x` })); }, '/items');
  refuse((x) => { x.left_out = Array.from({ length: 21 }, () => x.left_out[0]); }, '/left_out');
  refuse((x) => { x.items = Array.from({ length: 20 }, (_, i) => ({ ...x.items[0], n: i + 1, slug: `p-${i}`, place_id: `P${i}` + 'x'.repeat(290), area: 'a'.repeat(80), why_you: 'w'.repeat(200), try: 't'.repeat(120), name: 'n'.repeat(120), maps_url: 'https://example.com/' + 'u'.repeat(1970) })); x.left_out = Array.from({ length: 20 }, () => ({ name: 'n'.repeat(120), reason: 'other' })); }, '/', /characters/);
});

test('scoutPlaceFields: a new candidate place, an existing place kept and tagged, one scouted entry, idempotent', async () => {
  const { sc, payload } = await payloadOf();
  const s = await S();
  const opts = { query: 'matcha', trip: 'wrenmouth-june-2027', scout_id: payload.scout_id, on: '2027-06-01', destination: 'wrenmouth' };
  const fresh = sc.scoutPlaceFields(payload.items[0], opts);
  assert.equal(fresh.changed, true);
  assert.deepEqual(fresh.entry, { trip: 'wrenmouth-june-2027', on: '2027-06-01', event: 'scouted', note: 'matcha #1' });
  assert.deepEqual(fresh.place, { v: 1, id: 'wren-matcha-house', place_id: 'FixtureWrenMatchaHouse', name: 'Wren Matcha House', category: 'cafe', tags: ['scout', 'matcha'],
    status: 'candidate', activity: 'Matcha parfait with red bean', priority: 2, why_fit: payload.items[0].why_you, destination: 'wrenmouth', source_trip: 'wrenmouth-june-2027',
    gem: true, history: [fresh.entry] });
  assert.ok(s.validate(fresh.place, 'place').ok);
  const saltFresh = sc.scoutPlaceFields(payload.items[2], { ...opts, trip: undefined });
  assert.equal(saltFresh.place.activity, 'matcha', 'no try line → the query');
  assert.equal(saltFresh.entry.trip, payload.scout_id, 'no trip → the scout id');
  assert.equal(saltFresh.place.source_trip, undefined);
  assert.equal(saltFresh.place.gem, undefined);
  const existing = { v: 1, id: 'wren-matcha-house', place_id: 'FixtureWrenMatchaHouse', name: 'Wren Matcha House', category: 'cafe', tags: ['tea', 'scout'],
    status: 'chosen', activity: 'Afternoon tea', priority: 1, why_fit: 'The owner liked it last spring.', gem: false,
    history: [{ trip: 'wrenmouth-spring-2027', on: '2027-04-02', event: 'chosen' }] };
  const kept = sc.scoutPlaceFields(payload.items[0], { ...opts, existing });
  assert.equal(kept.changed, true);
  assert.deepEqual(kept.place.tags, ['tea', 'scout', 'matcha']);
  for (const k of ['status', 'activity', 'priority', 'why_fit', 'gem', 'category']) assert.deepEqual(kept.place[k], existing[k], k);
  assert.equal(kept.place.destination, 'wrenmouth', 'a missing field is filled');
  assert.equal(kept.place.history.length, 2);
  assert.equal(existing.history.length, 1, 'the input is not mutated');
  const again = sc.scoutPlaceFields(payload.items[0], { ...opts, existing: kept.place });
  assert.equal(again.changed, false, 're-running the same scout changes nothing');
  assert.equal(again.place.history.length, 2);
  const noId = { ...payload.items[0] }; delete noId.place_id;
  assert.throws(() => sc.scoutPlaceFields(noId, opts), /needs the item's place_id/);
  assert.throws(() => sc.scoutPlaceFields(payload.items[0], { ...opts, existing: { ...existing, place_id: 'FixtureWrenOther' } }), /another place id/);
  assert.throws(() => sc.scoutPlaceFields(payload.items[0], { ...opts, on: '2027-13-01' }), /calendar date/);
  assert.throws(() => sc.scoutPlaceFields(payload.items[0], { ...opts, trip: undefined, scout_id: undefined }), /trip slug or the scout_id/);
});

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const LOCATIONS = Object.fromEntries(RAW.map((r) => [r.id, { lat: r.location.latitude, lng: r.location.longitude }]));
const GOOGLE = {
  FixtureWrenMatchaHouse: { rating: 4.7, count: 320, price_level: 'PRICE_LEVEL_MODERATE', hours: EVERYDAY, website: 'https://wren-matcha.example.com/', address: '1 Quay Lane, Wrenmouth',
    photo: { data_uri: PNG, width: 320, attributions: [{ name: 'A. Walker', uri: 'https://maps.google.com/maps/contrib/fixture01' }] } },
  FixtureWrenTeaRoom: { rating: 4.5, count: 120, hours: week([0, 1, 3, 4, 5, 6]), website: 'javascript:alert(1)', photo: { data_uri: PNG, width: 800, attributions: [{ name: 'C. Shore' }] } },
  FixtureWrenSaltmarsh: { website: 'http://saltmarsh.example.com/', photo: { data_uri: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', attributions: [] } }
};
async function board(over = {}, options = {}) {
  const { sc, payload } = await payloadOf();
  const { fitView } = await import('../kits/brochure/lib/mapframe.mjs');
  const pts = [HOTEL, ...payload.items.map((i) => LOCATIONS[i.place_id])];
  const map = { data_uri: PNG, width: 640, height: 400, view: fitView(pts, { width: 640, height: 400 }) };
  return { sc, payload, ...sc.renderScoutBoard({ payload, google: GOOGLE, map, anchor: HOTEL, locations: LOCATIONS, trip_dates: TRIP, options: { built_on: '2027-06-01', ...options }, ...over }) };
}

test('board: masthead, numbered map, cards with build-scoped Google facts, compare table, left-out list, attribution and photo credits', async () => {
  const { html } = await board();
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data:;/);
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /<title>Scout — Matcha in Wrenmouth<\/title>/);
  assert.match(html, /3 picks, ranked for you · reach from your inn · built 2027-06-01/);
  assert.match(html, /Every pick has something vegetarian/);
  assert.match(html, /class="gmap"[^>]*><img src="data:image\/png;base64,/);
  assert.match(html, /class="gmap-marks"/);
  for (const n of [1, 2, 3]) assert.match(html, new RegExp(`font-weight="700" fill="#fff">${n}</text>`), `marker ${n}`);
  assert.match(html, /M-6 1\.5V-2\.5L0 -7\.5/, 'the inn is drawn as the house');
  assert.match(html, /★ 4\.7 \(320\) · moderate · 6 min walk from your inn/);
  assert.match(html, /Tue 8 Jun <span class="closed">closed<\/span>/);
  assert.match(html, /Mon 7 Jun <span>09:00–18:00<\/span>/);
  assert.match(html, /<b>Try:<\/b> Matcha parfait with red bean/);
  assert.match(html, /<span class="chip">💎 hidden gem<\/span><span class="chip">🌱 vegetarian verified<\/span>/);
  assert.match(html, /<b style="width:90%"><\/b>/);
  assert.match(html, /<a href="https:\/\/wren-matcha\.example\.com\/">wren-matcha\.example\.com<\/a>/);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /http:\/\/saltmarsh/);
  assert.doesNotMatch(html, /image\/svg\+xml/);
  assert.match(html, /1 Quay Lane, Wrenmouth/);
  assert.match(html, /<th>Open on your days<\/th>/);
  assert.match(html, /<td>Wren Matcha House<\/td><td>4\.7 \(320\)<\/td><td>moderate<\/td><td>6 min<\/td><td>all 3<\/td><td>verified<\/td>/);
  assert.match(html, /<td>Harbour Tea Room<\/td><td>4\.5 \(120\)<\/td><td>—<\/td><td>\d+ min<\/td><td>2 of 3<\/td><td>likely<\/td>/);
  assert.match(html, /Far Point Matcha — too far/);
  assert.match(html, /Wren Matcha House — listed twice/);
  assert.match(html, /Kelp Matcha Kitchen — nothing vegetarian-safe/);
  assert.match(html, /viewBox="0 0 98 18"/, 'the Google Maps logo is inlined');
  assert.match(html, /© Google/);
  assert.match(html, /Photo credits:<\/div><ol><li value="1">Wren Matcha House: <a href="https:\/\/maps\.google\.com\/maps\/contrib\/fixture01">A\. Walker<\/a><\/li><li value="2">Harbour Tea Room: C\. Shore<\/li><\/ol>/);
  assert.match(html, /Photo: <a href="https:\/\/maps\.google\.com\/maps\/contrib\/fixture01">A\. Walker<\/a> · via Google/);
  assert.match(html, /@media print\{[\s\S]*?\.cards\{grid-template-columns:1fr 1fr/, 'two columns in print');
  assert.match(html, /\.cards\{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr;/, 'one column on screen');
  assert.match(html, /@page\{size:Letter;/);
  const fonts = (await import('../kits/brochure/lib/fonts.mjs')).fontFaceCss().embedded;
  assert.equal(html.includes('@font-face'), fonts > 0, 'fonts are embedded by default when the kit has them');
});

test('board: app mode has no embedded fonts and drops photos wider than 360 px; no map image → a drawn sketch; no points → no map', async () => {
  const { html } = await board({}, { app: true });
  assert.ok(!html.includes('@font-face'));
  assert.equal((html.match(/<figure class="ph">/g) || []).length, 1, 'only the 320 px photo survives');
  assert.doesNotMatch(html, /Harbour Tea Room: C\. Shore/, 'a dropped photo is not credited');
  const sketch = (await board({ map: null })).html;
  assert.match(sketch, /<svg class="sketch"/);
  assert.match(sketch, /A drawn sketch/);
  assert.doesNotMatch(sketch, /class="gmap"/);
  const noView = (await board({ map: { data_uri: PNG, width: 640, height: 400 } })).html;
  assert.match(noView, /<svg class="sketch"/, 'an image without a view cannot carry exact markers → sketch');
  const svgMap = (await board({ map: { data_uri: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', width: 640, height: 400, view: { center: HOTEL, zoom: 14, width: 640, height: 400 } } })).html;
  assert.doesNotMatch(svgMap, /image\/svg\+xml/);
  const none = (await board({ locations: {}, anchor: null })).html;
  assert.doesNotMatch(none, /<section class="map">/);
  const a4 = (await board({}, { page: 'a4', embedFonts: false })).html;
  assert.match(a4, /@page\{size:A4;/);
  assert.ok(!a4.includes('@font-face'));
  const { sc, payload } = await payloadOf();
  assert.throws(() => sc.renderScoutBoard({ payload: { ...payload, items: [{ ...payload.items[0], rating: 4.7 }] } }), /valid scout payload/);
});

test('board: a 10-pick app board with photos and a map stays well under 900 000 characters', async () => {
  const sc = await SC();
  const pool = Array.from({ length: 12 }, (_, i) => sc.fromScoutResult(place('Ten' + i, `Matcha Spot ${i + 1}`, { rating: 4.3 + (i % 5) / 10, count: 60 + i * 10, km: 0.3 + i * 0.2, veg: true })));
  const ranked = sc.rankScout(pool, { what: 'matcha', group: 'food', diet: 'vegetarian', anchors: [HOTEL], trip_dates: TRIP, limit: 10 });
  assert.equal(ranked.items.length, 10);
  assert.equal(ranked.more, 2);
  const payload = sc.scoutPayload({ scout_id: 'sc-20270601-matcha', query: 'matcha', destination: 'wrenmouth', place_label: 'Wrenmouth', group: 'food', created_on: '2027-06-01', diet: 'vegetarian', ranked });
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(sc.APP_PHOTO_MAX_CHARS - 40);
  const google = Object.fromEntries(payload.items.map((it) => [it.place_id, { rating: 4.5, count: 99, hours: EVERYDAY, photo: { data_uri: photo, width: 360, attributions: [{ name: 'Fixture Photographer' }] } }]));
  const locations = Object.fromEntries(pool.map((r) => [r.place_id, r.location]));
  const map = { data_uri: 'data:image/png;base64,' + 'B'.repeat(sc.APP_MAP_MAX_CHARS - 40), width: 640, height: 400, view: { center: HOTEL, zoom: 14, width: 640, height: 400 } };
  const { html } = sc.renderScoutBoard({ payload, google, map, anchor: HOTEL, locations, trip_dates: TRIP, options: { app: true } });
  assert.equal((html.match(/<figure class="ph">/g) || []).length, 10);
  assert.match(html, /class="gmap"/);
  assert.ok(html.length < 750000, `${html.length} chars (worst case at the caps)`);
  const heavy = sc.renderScoutBoard({ payload, google, map: { ...map, data_uri: map.data_uri + 'B'.repeat(100) }, anchor: HOTEL, locations, options: { app: true } }).html;
  assert.match(heavy, /<svg class="sketch"/, 'a map image over the app cap falls back to the sketch');
  assert.match(html, /2 more ranked picks not shown/);
});

test('renderScoutBoardPdf: a PDF through the brochure kit\'s Chromium, or HTML only when no browser is available', async () => {
  const sc = await SC();
  const { payload } = await payloadOf();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-scout-'));
  try {
    const out = path.join(dir, 'board.pdf');
    const r = await sc.renderScoutBoardPdf({ payload, google: GOOGLE, anchor: HOTEL, locations: LOCATIONS, trip_dates: TRIP, options: { embedFonts: false } }, out);
    assert.match(r.html, /<title>Scout — Matcha in Wrenmouth<\/title>/);
    if (!sc.pdfAvailable()) { assert.equal(r.pdf, null); assert.equal(r.available, false); return; }
    assert.equal(r.error, undefined, r.error);
    assert.equal(r.pdf, out);
    assert.equal(fs.readFileSync(out).subarray(0, 5).toString(), '%PDF-');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Developed by: LightAISolutions

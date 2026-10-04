'use strict';
// Tour Guide — Quiet engine (TG-PHASE-16 WP-16a, `quiet/`, Contract C16): the owner's words, quietRatio, quietPart,
// quieterWord, isBusy, pickRadius, every screen in its order, the score and its ties, `more`, the labels, quietLine's
// four cases, and the board's id and payload (the fixture's first board is rebuilt from the same invented candidates).
// Invented places only; no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Q = () => import('../packs/tour-guide/quiet/index.mjs');
const V = () => import('../kits/brochure/lib/validate.mjs');

const DIR = path.join(__dirname, '..', 'packs', 'tour-guide', 'quiet', 'fixtures');
const CASES = JSON.parse(fs.readFileSync(path.join(DIR, 'quiet-parse-cases.json'), 'utf8'));
const FIX = JSON.parse(fs.readFileSync(path.join(DIR, 'quiet-sample.json'), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

const MAGNET = { place_id: 'FixtureQmLantern01', name: 'Lantern Shrine', rating: 4.6, rating_count: 18000, business_status: 'OPERATIONAL' };
const men = (pub, ref) => ({ ref, language: 'en', kind: 'community', publisher: pub });
const rec = (id, name, count, extra = {}) => ({ place_id: id, name, rating: 4.6, rating_count: count, business_status: 'OPERATIONAL', ...extra });
const walk = (minutes, estimated = true) => ({ minutes, mode: 'WALK', estimated });
/** The candidates the fixture's first board was made from (one per screen the board shows). */
const BOARD = () => [
  { record: rec('FixtureQmReedwater1', 'Reedwater Shrine', 900, { local_mentions: [men('quillmere-walks.example', 'https://quillmere-walks.example/reedwater'), men('old-quay-notes.example', 'https://old-quay-notes.example/shrines')] }), reach: walk(12, false), judgment: { same_kind: true, fit: 0.8, why: 'Same lantern-lit approach, a tenth of the crowd', best: 'Early morning, before 09:30' } },
  { record: rec('FixtureQmMossStep1', 'Moss Step Shrine', 2400), reach: { minutes: 18, mode: 'TRANSIT', estimated: true }, judgment: { same_kind: true, fit: 0.6, why: 'Moss garden and a covered hall', rain_ok: true } },
  { record: rec('FixtureQmHeronGate1', 'Heron Gate Shrine', 5200), reach: walk(9), judgment: { same_kind: true, fit: 0.5 } },
  { record: rec('FixtureQmWillowBk1', 'Willow Bank Shrine', 4100), reach: { minutes: 25, mode: 'TRANSIT', estimated: true }, judgment: { same_kind: true, fit: 0.3, why: 'A small riverside shrine' } },
  { record: rec('FixtureQmLanternUp', 'Lantern Shrine Upper Hall', 3000), reach: walk(3), judgment: { same_kind: true, part_of_magnet: true } },
  { record: rec('FixtureQmTealeaf01', 'Tealeaf Cafe', 700), reach: walk(4), judgment: { same_kind: false } },
  { record: rec('FixtureQmGrandGat1', 'Grand Gate Shrine', 15000), reach: walk(10), judgment: { same_kind: true, fit: 0.7 } },
  { record: rec('FixtureQmFarCliff1', 'Far Cliff Shrine', 300, { local_mentions: [men('quillmere-walks.example', 'https://quillmere-walks.example/far-cliff')] }), reach: { minutes: 45, mode: 'TRANSIT', estimated: true }, judgment: { same_kind: true, fit: 0.9 } }
];
const OPTS = { magnet: { record: MAGNET, kind: 'shrine' }, group: 'activities', date: '2027-05-13' };
/** A plain passing candidate: same kind, a twentieth of the magnet's count, 8 minutes' walk. */
const ok = (id, name, o = {}) => ({ record: rec(id, name, 900, o.record || {}), reach: o.reach === undefined ? walk(8) : o.reach, judgment: { same_kind: true, fit: 0.5, ...(o.judgment || {}) } });

test('parseQuietText: every case of the shared list', async () => {
  const { parseQuietText, PLACE_MAX } = await Q();
  assert.equal(PLACE_MAX, 80);
  assert.ok(CASES.cases.length >= 20);
  for (const c of CASES.cases) assert.deepEqual(parseQuietText(c.text, { today: CASES.today }), c.want, JSON.stringify(c.text));
  assert.throws(() => parseQuietText('x', { today: 'tomorrow' }), /today/);
});

test('quietRatio, quietPart and quieterWord: the bounds and the log scale', async () => {
  const { quietRatio, quietPart, quieterWord, QUIET } = await Q();
  assert.equal(quietRatio(900, 18000), 0.05);
  for (const bad of [undefined, null, -3, NaN, '900']) assert.equal(quietRatio(bad, 18000), 0, String(bad));
  for (const bad of [0, -1, null, undefined, NaN, '18000']) assert.throws(() => quietRatio(10, bad), /positive number/, String(bad));
  assert.deepEqual([0, 0.01, 0.05, 0.1, 0.25, 0.4999, 0.5, 0.9, 3].map(quietPart), [100, 100, 100, 70, 30, 0, 0, 0, 0]);
  for (const bad of [-0.1, NaN, null, '0.1', Infinity]) assert.throws(() => quietPart(bad), /ratio must be a number/, String(bad));
  assert.deepEqual([0, 0.1, 0.1001, 0.25, 0.2501, 0.5].map(quieterWord), ['much', 'much', 'clearly', 'clearly', 'somewhat', 'somewhat']);
  assert.equal(QUIET.MAX_RATIO, 0.5); assert.equal(QUIET.MAX_MINUTES, 30); assert.equal(QUIET.ITEMS, 3);
  const w = QUIET.WEIGHTS; assert.equal(Math.round((w.quiet + w.quality + w.fit + w.local + w.reach) * 100), 100);
  assert.ok(Object.isFrozen(QUIET) && Object.isFrozen(QUIET.WEIGHTS) && Object.isFrozen(QUIET.RADII));
});

test('isBusy: Phase 11\'s crowd-magnet rule over the magnet and the places found', async () => {
  const { isBusy } = await Q();
  const pool = BOARD().map((c) => c.record);
  assert.equal(isBusy(MAGNET, pool), true, 'the top decile with at least 2000 ratings');
  assert.equal(isBusy({ ...MAGNET, rating_count: 1500 }, pool.map((r) => ({ ...r, rating_count: 100 }))), false, 'top, but under 2000 ratings');
  assert.equal(isBusy({ ...MAGNET, rating_count: 300 }, pool), false, 'not among the most rated');
  assert.equal(isBusy({ ...MAGNET, rating_count: 300, mass_tourism_rank: 4 }, pool), true, 'on a mass-tourism list');
  assert.equal(isBusy({ ...MAGNET, rating_count: 300, mass_tourism_rank: 11 }, pool), false);
  assert.equal(isBusy(MAGNET, [{ ...MAGNET, rating_count: 99 }, { place_id: 'FixtureQmBigOne01', name: 'Big One', rating_count: 40000 }]), false,
    'the magnet is counted once, as itself (its copy in the pool is ignored)');
  assert.equal(isBusy(MAGNET, []), true, 'alone: it is its own top decile');
  assert.equal(isBusy({ name: 'No id', rating_count: 50000 }, pool), false);
  assert.equal(isBusy(null, pool), false);
  assert.equal(isBusy(MAGNET, 'not a list'), true);
});

test('pickRadius: the nearest radius with enough places, else the widest with any, else null', async () => {
  const { pickRadius, QUIET } = await Q();
  assert.deepEqual(QUIET.RADII, [1000, 2000, 3500]); assert.equal(QUIET.MIN_POOL, 6);
  assert.equal(pickRadius([{ radius: 1000, count: 4 }, { radius: 2000, count: 9 }, { radius: 3500, count: 20 }]), 2000);
  assert.equal(pickRadius([{ radius: 3500, count: 20 }, { radius: 1000, count: 6 }]), 1000, 'order given does not matter');
  assert.equal(pickRadius([{ radius: 1000, count: 2 }, { radius: 2000, count: 3 }, { radius: 3500, count: 0 }]), 2000);
  assert.equal(pickRadius([{ radius: 1000, count: 0 }]), null);
  assert.equal(pickRadius([]), null);
  assert.equal(pickRadius(null), null);
  assert.equal(pickRadius([{ radius: -5, count: 9 }, { radius: 'x', count: 9 }, null, { radius: 2000, count: 1 }]), 2000);
});

test('rankQuiet rebuilds the fixture\'s first board from the same invented candidates', async () => {
  const { rankQuiet, quietLine, quietPayload, isBusy } = await Q();
  const ranked = rankQuiet(BOARD(), OPTS);
  const p = quietPayload({ trip: 'quillmere-2027', createdOn: '2027-05-12', date: '2027-05-13', ranked,
    magnet: { name: 'Lantern Shrine', place_id: 'FixtureQmLantern01', kind: 'shrine', busy: isBusy(MAGNET, BOARD().map((c) => c.record)),
      quiet: quietLine({ hours: { open: '09:00', close: '17:00', last_entry: '16:30' }, tip: 'weekday mornings are calmest' }),
      source: { title: 'Lantern Shrine visitor page', url: 'https://lantern-shrine.example/visit' } } });
  assert.deepEqual(p, FIX.valid[0]);
  assert.deepEqual(p.items.map((i) => [i.n, i.slug, i.quieter]), [[1, 'reedwater-shrine', 'much'], [2, 'moss-step-shrine', 'clearly'], [3, 'heron-gate-shrine', 'somewhat']]);
  assert.equal(p.more, 1, 'Willow Bank passed every screen but did not make the top 3');
  assert.deepEqual(p.left_out.map((l) => l.reason), ['the_magnet', 'not_same_kind', 'not_quieter', 'too_far']);
  const W = { quiet: 0.35, quality: 0.2, fit: 0.2, local: 0.1, reach: 0.15 };
  for (const it of p.items) {
    const est = Object.keys(W).reduce((s, k) => s + W[k] * it.parts[k], 0);
    assert.ok(Math.abs(it.score - est) <= 1, `${it.slug}: score ${it.score} is the weighted parts (${est.toFixed(1)})`);
  }
});

test('rankQuiet: every screen, in its order, with the edges that pass', async () => {
  const { rankQuiet } = await Q();
  const cands = [
    ok('FixtureQmLantern01', 'Lantern Shrine main hall'),                                     // the magnet's own id
    ok('FixtureQmPartOf001', 'Lantern Shrine Gate', { judgment: { part_of_magnet: true } }),   // part of it
    ok('FixtureQmSameNm001', 'Lantern  shrine!'),                                             // the magnet's name
    ok('FixtureQmAlder0001', 'Alder Shrine'),                                                 // passes
    ok('FixtureQmAlder0001', 'Alder Shrine copy'),                                            // the same id again
    ok('FixtureQmAlder0002', 'ALDER shrine'),                                                 // the same name again
    ok('FixtureQmNotKind01', 'Plum Tea Room', { judgment: { same_kind: false } }),
    ok('FixtureQmNoJudge01', 'No Word Shrine', { judgment: { same_kind: 'yes' } }),            // same_kind must be true
    ok('FixtureQmClosed001', 'Shut Shrine', { record: { business_status: 'CLOSED_PERMANENTLY' } }),
    ok('FixtureQmShutDay01', 'Thursday-Shut Shrine', { record: { hours: { by_date: { '2027-05-13': [] } } } }),
    ok('FixtureQmLowRate01', 'Low Shrine', { record: { rating: 3.5 } }),
    { record: rec('FixtureQmNewOne001', 'New Shrine', 2), reach: walk(5), judgment: { same_kind: true } },
    ok('FixtureQmMassTr001', 'Listed Shrine', { record: { mass_tourism_rank: 3 } }),
    { record: rec('FixtureQmLoud00001', 'Loud Shrine', 9001), reach: walk(5), judgment: { same_kind: true } },
    { record: rec('FixtureQmHalf00001', 'Half Shrine', 9000), reach: walk(5), judgment: { same_kind: true } },   // exactly half passes
    ok('FixtureQmFar000001', 'Far Shrine', { reach: walk(31) }),
    ok('FixtureQmNoReach01', 'Unknown Shrine', { reach: null }),
    ok('FixtureQmEdge00001', 'Edge Shrine', { reach: walk(30) })                               // exactly 30 passes
  ];
  const r = rankQuiet(cands, OPTS);
  assert.deepEqual(r.left_out.map((l) => [l.name, l.reason]), [
    ['Lantern Shrine main hall', 'the_magnet'], ['Lantern Shrine Gate', 'the_magnet'], ['Lantern shrine!', 'duplicate'],
    ['Alder Shrine copy', 'duplicate'], ['ALDER shrine', 'duplicate'], ['Plum Tea Room', 'not_same_kind'], ['No Word Shrine', 'not_same_kind'],
    ['Shut Shrine', 'closed'], ['Thursday-Shut Shrine', 'closed_on_dates']
  ].concat([['Low Shrine', 'low_rating'], ['New Shrine', 'unproven'], ['Listed Shrine', 'also_busy']]).slice(0, 12));
  assert.equal(r.left_out.length, 12, 'left_out keeps the first 12');
  assert.deepEqual(r.items.map((i) => i.name).sort(), ['Alder Shrine', 'Edge Shrine', 'Half Shrine']);
  assert.equal(r.more, 0);
  const rest = rankQuiet(cands.slice(13), OPTS);
  assert.deepEqual(rest.left_out.map((l) => l.reason), ['not_quieter', 'too_far', 'too_far']);
  const half = rest.items.find((i) => i.name === 'Half Shrine');
  assert.equal(half.parts.quiet, 0); assert.equal(half.quieter, 'somewhat');
  // Without a date, the city's dates count for "closed"; with neither, hours do not screen.
  const shut = [ok('FixtureQmShutDay01', 'Thursday-Shut Shrine', { record: { hours: { by_date: { '2027-05-13': [] } } } })];
  assert.equal(rankQuiet(shut, { ...OPTS, date: null, cityDates: ['2027-05-13'] }).left_out[0].reason, 'closed_on_dates');
  assert.equal(rankQuiet(shut, { ...OPTS, date: null }).items.length, 1);
  assert.equal(rankQuiet(shut, { ...OPTS, date: '2027-05-14' }).items.length, 1, 'only the day asked for counts');
});

test('rankQuiet: a food board screens on the party\'s diet and labels veg', async () => {
  const { rankQuiet } = await Q();
  const opts = { magnet: { record: { ...MAGNET, name: 'Copper Noodle House' }, kind: 'noodle house' }, group: 'food', diet: 'vegetarian' };
  const r = rankQuiet([
    ok('FixtureQmVegNo0001', 'Pork Bowl', { judgment: { veg: 'no' } }),
    ok('FixtureQmVegUnk001', 'Mystery Bowl', { judgment: { veg: 'unknown' } }),
    ok('FixtureQmVegYes001', 'Green Bowl', { judgment: { veg: 'verified' } }),
    ok('FixtureQmVegLik001', 'Leaf Bowl', { judgment: { veg: 'likely' } })
  ], opts);
  assert.deepEqual(r.left_out.map((l) => l.reason), ['diet', 'diet']);
  assert.deepEqual(r.items.map((i) => [i.name, i.labels]).sort(), [['Green Bowl', ['veg_verified']], ['Leaf Bowl', ['veg_likely']]]);
  assert.ok(r.items.every((i) => i.kind === 'noodle house'));
  const act = rankQuiet([ok('FixtureQmVegYes001', 'Green Bowl', { judgment: { veg: 'verified' } })], OPTS);
  assert.deepEqual(act.items[0].labels, [], 'veg labels are for food boards only');
});

test('rankQuiet: the score orders the board; ties go to the quieter, then the nearer, then the name', async () => {
  const { rankQuiet } = await Q();
  const at = (id, name, count, minutes, fit = 0.5) => ({ record: rec(id, name, count, { rating: 4.3 }), reach: walk(minutes), judgment: { same_kind: true, fit } });
  const names = (list) => rankQuiet(list, OPTS).items.map((i) => i.name);
  assert.deepEqual(names([at('FixtureQmT1aaaaa', 'Alpha Shrine', 800, 8), at('FixtureQmT2aaaaa', 'Beta Shrine', 500, 8)]), ['Beta Shrine', 'Alpha Shrine'], 'equal score: the lower ratio first');
  assert.deepEqual(names([at('FixtureQmT1aaaaa', 'Alpha Shrine', 500, 8), at('FixtureQmT2aaaaa', 'Beta Shrine', 500, 4)]), ['Beta Shrine', 'Alpha Shrine'], 'equal score and ratio: the nearer first');
  assert.deepEqual(names([at('FixtureQmT2aaaaa', 'beta Shrine', 500, 8), at('FixtureQmT1aaaaa', 'Alpha Shrine', 500, 8)]), ['Alpha Shrine', 'beta Shrine'], 'then the name, ignoring case');
  assert.deepEqual(names([at('FixtureQmT1aaaaa', 'Alpha Shrine', 500, 8, 0.1), at('FixtureQmT2aaaaa', 'Beta Shrine', 500, 8, 0.9)]), ['Beta Shrine', 'Alpha Shrine'], 'the better fit scores higher');
  const many = Array.from({ length: 25 }, (_, i) => at('FixtureQmMany' + String(i).padStart(4, '0'), 'Shrine ' + String(i).padStart(2, '0'), 500 + i, 8));
  const r = rankQuiet(many, OPTS);
  assert.deepEqual(r.items.map((i) => i.n), [1, 2, 3]);
  assert.equal(r.more, 20, 'more counts the rest, up to 20');
  assert.equal(rankQuiet(many.slice(0, 5), OPTS).more, 2);
  assert.deepEqual(rankQuiet([], OPTS), { items: [], more: 0, left_out: [] });
  assert.deepEqual(rankQuiet([null, 'x', { record: null }], OPTS), { items: [], more: 0, left_out: [] });
});

test('rankQuiet: an item is rebuilt from our own words — labels, defaults, and no Google field', async () => {
  const { rankQuiet, LABELS } = await Q();
  const [it] = rankQuiet([{
    record: rec('FixtureQmLabels01', 'Lotus Pond Shrine', 600, { location: { lat: 1.5, lng: 2.5 }, types: ['tourist_attraction'], website: 'https://lotus.example/',
      local_mentions: [men('a.example', 'https://a.example/1'), men('b.example', 'https://b.example/2'), men('b.example', 'https://b.example/3')] }),
    reach: { minutes: 14.4, mode: 'DRIVE', estimated: true },
    judgment: { same_kind: true, booking: true, rain_ok: true, kind: '  pond   shrine ', best: 'x'.repeat(130) }
  }], { ...OPTS, visited: ['lotus-pond-shrine'] }).items;
  assert.deepEqual(Object.keys(it), ['n', 'slug', 'name', 'place_id', 'kind', 'reach', 'quieter', 'why', 'best', 'score', 'parts', 'labels', 'maps_url']);
  assert.deepEqual(it.labels, ['local_favourite', 'booking', 'rain_ok', 'seen_before']);
  assert.deepEqual(it.labels, LABELS.filter((l) => it.labels.includes(l)), 'in LABELS order');
  assert.deepEqual(it.reach, { minutes: 14, mode: 'TRANSIT', estimated: true }, 'anything but a walk reads as transit');
  assert.equal(it.kind, 'pond shrine');
  assert.equal(it.why, 'Much quieter than Lantern Shrine', 'no why: our own line');
  assert.equal(it.best.length, 120); assert.ok(it.best.endsWith('…'));
  assert.equal(it.parts.fit, 30, 'no fit: Scout\'s default');
  assert.equal(it.parts.local, 50, 'one publisher counts once');
  assert.equal(it.maps_url, 'https://www.google.com/maps/search/?api=1&query=Lotus%20Pond%20Shrine&query_place_id=FixtureQmLabels01');
  const s = JSON.stringify(it);
  for (const k of ['rating', 'location', 'lat', 'types', 'website', 'rating_count', 'local_mentions']) assert.ok(!s.includes('"' + k + '"'), k);
});

test('rankQuiet: refuses a magnet without a positive rating count or a kind', async () => {
  const { rankQuiet } = await Q();
  assert.throws(() => rankQuiet([], { magnet: { record: { ...MAGNET, rating_count: 0 }, kind: 'shrine' } }), /positive number/);
  assert.throws(() => rankQuiet([], { magnet: { record: MAGNET, kind: '  ' } }), /kind/);
  assert.throws(() => rankQuiet([], {}), /needs the magnet/);
});

test('quietLine: hours, a tip, always open, nothing — and the cut at 160', async () => {
  const { quietLine } = await Q();
  assert.equal(quietLine({ hours: { open: '09:00', close: '17:00', last_entry: '16:30' } }), 'Quietest at opening (09:00–10:00) or late (from 15:30; last entry 16:30)');
  assert.equal(quietLine({ hours: { open: '09:00', close: '17:00' }, tip: 'weekdays are calmer' }), 'Quietest at opening (09:00–10:00) or late (from 15:30); weekdays are calmer');
  assert.equal(quietLine({ hours: { open: '09:00', close: '17:00', last_entry: '15:00' } }), 'Quietest at opening (09:00–10:00)', 'no late slot before the last entry');
  assert.equal(quietLine({ hours: { open: '18:00', close: '01:00' } }), 'Quietest at opening (18:00–19:00) or late (from 23:30)', 'closes after midnight');
  assert.equal(quietLine({ hours: { open: '9am', close: '17:00' }, tip: '  go  early ' }), 'go early', 'unreadable hours: the tip');
  assert.equal(quietLine({ always_open: true }), 'Open all day; early morning is usually quietest');
  assert.equal(quietLine({ always_open: 'yes' }), 'No quiet hours found; early is usually quieter');
  assert.equal(quietLine(), 'No quiet hours found; early is usually quieter');
  const long = quietLine({ hours: { open: '09:00', close: '17:00', last_entry: '16:30' }, tip: 'y'.repeat(200) });
  assert.equal(long.length, 160); assert.ok(long.endsWith('…'));
});

test('quietId, magnetSlugOf and quietPayload', async () => {
  const { quietId, magnetSlugOf, quietPayload, rankQuiet, ID_RE } = await Q();
  assert.equal(quietId('2027-05-12', 'lantern-shrine'), 'qt-20270512-lantern-shrine');
  assert.equal(quietId('2027-05-12', 'a'.repeat(50) + '-b'), 'qt-20270512-' + 'a'.repeat(40));
  assert.equal(quietId('2027-05-12', '---'), 'qt-20270512-place');
  assert.ok(ID_RE.test(quietId('2027-05-12', 'x'.repeat(39) + '-y')));
  assert.throws(() => quietId('2027-02-30', 'x'), /calendar date/);
  assert.equal(magnetSlugOf('Sanctuaire Élise — Porte Haute'), 'sanctuaire-elise-porte-haute');
  assert.equal(magnetSlugOf('!!!'), 'place');
  const ranked = rankQuiet([], OPTS);
  const p = quietPayload({ createdOn: '2027-05-12', magnet: { name: '  Lantern   Shrine ', kind: 'shrine', busy: 'yes', quiet: 'Go early' }, ranked });
  assert.deepEqual(p, { v: 1, id: 'qt-20270512-lantern-shrine', trip: null, created_on: '2027-05-12',
    magnet: { name: 'Lantern Shrine', slug: 'lantern-shrine', kind: 'shrine', busy: false, quiet: 'Go early' }, items: [], left_out: [] });
  assert.throws(() => quietPayload({ createdOn: '2027-05-12', magnet: { name: 'Lantern Shrine', kind: 'shrine', quiet: '' }, ranked }), /magnet\.quiet must not be empty/);
  assert.throws(() => quietPayload({ createdOn: '2027-05-12', trip: 'Not A Slug', magnet: { name: 'X', kind: 'k', quiet: 'q' }, ranked }), /trip has the wrong format/);
});

test('the fixture: the schema and validateQuietPayload accept and refuse alike; checkQuiet wraps the validator', async () => {
  const { validateQuietPayload, checkQuiet, QUIET_SCHEMA } = await Q().then(async (m) => ({ ...m, QUIET_SCHEMA: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'tour-guide', 'schemas', 'tour-guide-quiet.schema.json'), 'utf8')) }));
  const { validate } = await V();
  assert.ok(FIX.valid.length >= 2 && FIX.invalid.length >= 15);
  for (const p of FIX.valid) { assert.deepEqual(validateQuietPayload(p), [], JSON.stringify(p).slice(0, 80)); assert.deepEqual(validate(p, QUIET_SCHEMA), []); assert.deepEqual(checkQuiet(p), []); }
  for (const p of FIX.invalid) {
    assert.ok(validateQuietPayload(p).length > 0, 'validator: ' + JSON.stringify(p).slice(0, 120));
    assert.ok(validate(p, QUIET_SCHEMA).length > 0, 'schema: ' + JSON.stringify(p).slice(0, 120));
  }
  const bad = clone(FIX.valid[0]); bad.items[0].rating = 4.6;
  assert.ok(validateQuietPayload(bad).includes('items[0].rating: Google field refused (own data only)'));
  assert.deepEqual(checkQuiet(bad)[0], { path: '/', message: validateQuietPayload(bad)[0] });
});

// Developed by: LightAISolutions

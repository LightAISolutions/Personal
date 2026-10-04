'use strict';
// packs/tour-guide — Phase 13 WP-13d, the Scout engine's faults (helpers/prompts/TG-PHASE-13.md "WP-13d"; review §4
// faults 8, 9 and 11, B9 and B11): "been before" lights for places already in the owner's Places; the board's hours
// cover every date the owner is in the searched city and the closed-on-your-days screen uses only those dates; one
// grammar for the owner's words, "<what> near <area>, <city>" belonging to the city; Google's vegetarian flag alone is
// not enough for a party with a hidden-stock rule (café topics excepted); a place file takes the place's own name,
// never Google's. Every town, place, id, date and hour is invented (fixtures/p13d-scout); nothing is fetched.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const SC = () => import('../packs/tour-guide/scout/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');
const FX = () => import('../packs/tour-guide/fixtures/p13d-scout/tg-fixture-p13d-scout.mjs');

const payloadArgs = (ranked, over = {}) => ({ scout_id: 'sc-20310301-matcha', query: 'matcha', destination: 'wrenmouth', place_label: 'Wrenmouth',
  group: 'food', created_on: '2031-03-01', diet: 'vegetarian', ranked, ...over });

// ── 1. Been before (review fault 8) ──
test('been before: a pick whose place id is already in the owner\'s Places carries seen_before, in the ranking and the payload', async () => {
  const sc = await SC(); const fx = await FX(); const s = await S();
  const pool = [fx.rawPlace('Known', 'Quayside Matcha', { veg: true, km: 0.3 }), fx.rawPlace('Fresh', 'Kiln Row Matcha', { veg: true, km: 0.5 })].map((r) => sc.fromScoutResult(r));
  const opts = { what: 'matcha', group: 'food', diet: 'vegetarian', anchors: [fx.HOTEL] };
  const before = sc.rankScout(pool, opts);
  assert.ok(before.items.every((i) => !i.labels.includes('seen_before')), 'without `known` nothing is labelled (as before)');
  for (const known of [['FixtureP13dKnown'], new Set(['FixtureP13dKnown'])]) {
    const r = sc.rankScout(pool, { ...opts, known });
    const by = Object.fromEntries(r.items.map((i) => [i.place_id, i.labels]));
    assert.deepEqual(by.FixtureP13dKnown, ['veg_likely', 'seen_before', 'not_judged']);   // WP-14b change 5: no fit → not_judged
    assert.deepEqual(by.FixtureP13dFresh, ['veg_likely', 'not_judged']);   // WP-14b change 5
    assert.deepEqual(r.items.map((i) => i.score), before.items.map((i) => i.score), 'the label does not move the score');
  }
  const viaRank = sc.scoutPayload(payloadArgs(sc.rankScout(pool, { ...opts, known: ['FixtureP13dKnown'] })));
  const viaPayload = sc.scoutPayload(payloadArgs(before, { known: ['FixtureP13dKnown'] }));
  for (const p of [viaRank, viaPayload]) {
    assert.deepEqual(s.validatePayload('scout', p).errors, []);
    const it = p.items.find((i) => i.place_id === 'FixtureP13dKnown');
    assert.deepEqual(it.labels, ['veg_likely', 'seen_before', 'not_judged']);   // WP-14b change 5
    assert.ok(!p.items.find((i) => i.place_id === 'FixtureP13dFresh').labels.includes('seen_before'));
  }
  const { renderScoutBoard } = sc;
  assert.match(renderScoutBoard({ payload: viaRank }).html, /<span class="chip">been before<\/span>/);
});

// ── 2. City dates (review fault 9) ──
test('city dates: ten Wrenmouth dates all show hours on the board, identical consecutive days share a row', async () => {
  const sc = await SC(); const fx = await FX();
  const rows = sc.hoursRows(fx.MON_CLOSED_SHORT_SUNDAY, fx.CITY);
  assert.deepEqual(rows.map((r) => [r.label, r.text, r.days]), [
    ['Wed 5 – Sat 8 Mar', '09:00–18:00', 4], ['Sun 9 Mar', '10:00–16:00', 1], ['Mon 10 Mar', 'closed', 1], ['Tue 11 – Fri 14 Mar', '09:00–18:00', 4]]);
  assert.equal(rows.reduce((n, r) => n + r.days, 0), 10, 'every city date is covered');
  assert.equal(sc.tripHours(fx.MON_CLOSED_SHORT_SUNDAY, fx.TRIP).length, 14, 'no seven-date cap');
  assert.deepEqual(sc.hoursRows(fx.EVERYDAY, ['2031-03-30', '2031-03-31', '2031-04-01']).map((r) => r.label), ['Sun 30 Mar – Tue 1 Apr'], 'a range across months');
  assert.deepEqual(sc.hoursRows(fx.EVERYDAY, ['2031-03-12', '2031-03-05', '2031-03-06', '2031-03-05']).map((r) => r.label), ['Wed 5 – Thu 6 Mar', 'Wed 12 Mar'], 'sorted, each once; a gap breaks the row');
  assert.equal(sc.hoursRows(null, fx.CITY), null);

  const pool = [sc.fromScoutResult(fx.rawPlace('Board', 'Saltpan Matcha', { veg: true, hours: fx.MON_CLOSED_SHORT_SUNDAY }))];
  const payload = sc.scoutPayload(payloadArgs(sc.rankScout(pool, { what: 'matcha', group: 'food', diet: 'vegetarian', trip_dates: fx.TRIP, city_dates: fx.CITY })));
  const google = { FixtureP13dBoard: { rating: 4.5, count: 120, hours: fx.MON_CLOSED_SHORT_SUNDAY } };
  const { html } = sc.renderScoutBoard({ payload, google, trip_dates: fx.TRIP, city_dates: fx.CITY });
  assert.match(html, /<div class="hours">Wed 5 – Sat 8 Mar <span>09:00–18:00<\/span> · Sun 9 Mar <span>10:00–16:00<\/span> · Mon 10 Mar <span class="closed">closed<\/span> · Tue 11 – Fri 14 Mar <span>09:00–18:00<\/span><\/div>/);
  assert.doesNotMatch(html, /Sat 1 Mar|Tue 4 Mar/, 'the Gullhaven days are not on the Wrenmouth board');
  assert.match(html, /<td>9 of 10<\/td>/, '"open on your days" counts the city dates');
  // without city dates: the trip's dates, every one of them (no cap)
  const trip = sc.renderScoutBoard({ payload, google, trip_dates: fx.TRIP }).html;
  assert.match(trip, /<div class="hours">Sat 1 Mar <span>09:00–18:00<\/span> · Sun 2 Mar <span>10:00–16:00<\/span> · Mon 3 Mar <span class="closed">closed<\/span> · Tue 4 – Sat 8 Mar <span>09:00–18:00<\/span>[\s\S]*Tue 11 – Fri 14 Mar <span>09:00–18:00<\/span><\/div>/);
  assert.match(trip, /<td>12 of 14<\/td>/);
});

test('city dates: a place closed only on a day spent in another town is not penalised; closed on every city day is screened', async () => {
  const sc = await SC(); const fx = await FX();
  const pool = [
    fx.rawPlace('MonClosed', 'Monday-shut Matcha', { veg: true, hours: fx.week([0, 2, 3, 4, 5, 6]) }),
    fx.rawPlace('MonOnly', 'Monday Matcha Stall', { veg: true, hours: fx.week([1]) })
  ].map((r) => sc.fromScoutResult(r));
  const opts = { what: 'matcha', group: 'food', diet: 'vegetarian', trip_dates: fx.SHORT_TRIP };
  const tripWide = sc.rankScout(pool, opts);
  const monClosed = tripWide.items.find((i) => i.place_id === 'FixtureP13dMonClosed');
  assert.ok(Math.abs(monClosed.parts.reach - (0.5 - 0.3)) < 1e-9, 'trip dates: penalised for the Gullhaven Mondays (the fault)');
  assert.ok(tripWide.items.some((i) => i.place_id === 'FixtureP13dMonOnly'), 'trip dates: open on the Gullhaven Mondays, so kept');
  const city = sc.rankScout(pool, { ...opts, city_dates: fx.SHORT_CITY });
  const kept = city.items.find((i) => i.place_id === 'FixtureP13dMonClosed');
  assert.equal(kept.parts.reach, 0.5, 'city dates: no Monday in Wrenmouth, no penalty');
  assert.ok(kept.score > monClosed.score);
  assert.deepEqual(city.left_out, [{ place_id: 'FixtureP13dMonOnly', name: 'Monday Matcha Stall', reason: 'closed_on_trip' }], 'closed on every Wrenmouth day');
  const empty = sc.rankScout(pool, { ...opts, city_dates: [] });
  assert.equal(empty.left_out.length, 0, 'an empty city_dates list means no day in that city: no closed screen');
  assert.ok(empty.items.every((i) => i.parts.reach === 0.5));
  assert.deepEqual(sc.yourDates({ trip_dates: fx.SHORT_TRIP, city_dates: ['2031-03-05', 'bad', '2031-03-04', '2031-03-05'] }), ['2031-03-04', '2031-03-05']);
  assert.equal(sc.screenReason({ rating: 4.5, rating_count: 100, local_mentions: [], hours: fx.week([1]) }, { topic: 1, trip_dates: fx.SHORT_TRIP, city_dates: fx.SHORT_CITY }), 'closed_on_trip');
  const payload = sc.scoutPayload(payloadArgs(city));
  assert.match(sc.renderScoutBoard({ payload, city_dates: fx.SHORT_CITY }).html, /Monday Matcha Stall — closed on every day you are there/);
  assert.match(sc.renderScoutBoard({ payload, trip_dates: fx.SHORT_TRIP }).html, /Monday Matcha Stall — closed on every trip day/);
});

// ── 3. One grammar (review fault 11) ──
test('grammar: one table of the owner\'s words — the /scout prefix, near <area>, <city> belongs to the city, in / @ / comma name the city', async () => {
  const { parseScoutText } = await SC(); const fx = await FX();
  assert.ok(fx.GRAMMAR.length >= 15);
  for (const c of fx.GRAMMAR) {
    assert.deepEqual(parseScoutText(c.text), { what: c.what, where: c.where, city: c.city, area: c.area }, JSON.stringify(c.text));
  }
  // the core's order of separators: the last " in ", then the first " near ", "@", ","
  assert.equal(parseScoutText('green tea, matcha near Old Harbour').what, 'green tea, matcha', 'near wins over an earlier comma');
  assert.equal(parseScoutText('kelp crisps, seaweed @ Gullhaven').city, 'Gullhaven', '@ wins over an earlier comma');
  // every field is clipped to 80, the area and the city each on their own
  const long = parseScoutText('matcha near ' + 'a'.repeat(120) + ', ' + 'c'.repeat(120));
  assert.equal(long.area.length, 80);
  assert.equal(long.city.length, 80);
  assert.ok(long.where.length <= 80);
  assert.deepEqual(parseScoutText('/scouting trip'), { what: '/scouting trip', where: '', city: '', area: '' }, 'only the command itself is stripped');
});

// ── 4. The vegetarian flag and the hidden-stock rule (B11) ──
test('vegetarian flag: with a hidden-stock rule Google\'s flag alone is "vegetarian not confirmed"; café topics and no rule keep today\'s behaviour', async () => {
  const sc = await SC(); const fx = await FX();
  const RULE = 'No fish or meat stock in broths or sauces';
  const pool = (topic) => [
    fx.rawPlace('Flag', `Harbour ${topic}`, { veg: true, types: ['restaurant'] }),
    fx.rawPlace('Judged', `Kiln ${topic}`, { veg: true, types: ['restaurant'] }),
    fx.rawPlace('Verified', `Saltpan ${topic}`, { types: ['restaurant'] })
  ].map((r) => sc.fromScoutResult(r));
  const judgments = { FixtureP13dJudged: { veg: 'likely' }, FixtureP13dVerified: { veg: 'verified' } };
  const run = (what, diet_rule) => sc.rankScout(pool(what), { what, group: 'food', diet: 'vegetarian', judgments, diet_rule });
  const labels = (r) => Object.fromEntries(r.items.map((i) => [i.place_id, i.labels]));

  const ruled = run('ramen', RULE);
  assert.deepEqual(ruled.left_out, [{ place_id: 'FixtureP13dFlag', name: 'Harbour ramen', reason: 'diet_unproven' }], 'the flag alone no longer passes');
  assert.deepEqual(labels(ruled), { FixtureP13dJudged: ['veg_likely', 'not_judged'], FixtureP13dVerified: ['veg_verified', 'not_judged'] }, 'a judgment still counts');   // WP-14b change 5
  const free = run('ramen');
  assert.equal(free.left_out.length, 0, 'without a rule nothing changes');
  assert.deepEqual(labels(free).FixtureP13dFlag, ['veg_likely', 'not_judged']);   // WP-14b change 5
  for (const blank of ['', '   ', 42, null]) assert.equal(run('ramen', blank).left_out.length, 0, `a ${JSON.stringify(blank)} rule is no rule`);
  const cafe = run('matcha', RULE);
  assert.equal(cafe.left_out.length, 0, 'a café-word topic keeps today\'s behaviour');
  assert.deepEqual(labels(cafe).FixtureP13dFlag, ['veg_likely', 'not_judged']);   // WP-14b change 5
  assert.equal(run('ice cream', RULE).left_out.length, 0, 'a two-word café topic too');
  assert.equal(sc.googleVegCounts({ diet: 'vegan', what: 'matcha' }), false, 'vegan never takes the flag');
  assert.equal(sc.screenReason({ rating: 4.5, rating_count: 100, local_mentions: [], serves_vegetarian: true }, { topic: 1, group: 'food', diet: 'vegetarian', diet_rule: RULE, what: 'udon' }), 'diet_unproven');
  const payload = sc.scoutPayload(payloadArgs(ruled, { query: 'ramen', scout_id: 'sc-20310301-ramen' }));
  assert.match(sc.renderScoutBoard({ payload }).html, /Harbour ramen — vegetarian not confirmed/);
});

// ── 5. Own names (B9) ──
test('own names: the place file takes the judgment\'s own name, never Google\'s; a new pick without one is not saved', async () => {
  const sc = await SC(); const fx = await FX(); const s = await S();
  const GOOGLE_NAME = 'Best Matcha Wrenmouth | Cafe & Sweets | Open Late';
  const pool = [fx.rawPlace('Own', GOOGLE_NAME, { veg: true, km: 0.3 }), fx.rawPlace('Nameless', 'Matcha Spot Wrenmouth Harbour View', { veg: true, km: 0.5 })].map((r) => sc.fromScoutResult(r));
  const ranked = sc.rankScout(pool, { what: 'matcha', group: 'food', diet: 'vegetarian', judgments: { FixtureP13dOwn: { name: '  Tidewell   Tea\u202e House ' } } });
  const own = ranked.items.find((i) => i.place_id === 'FixtureP13dOwn');
  assert.equal(own.own_name, 'Tidewell Tea House');
  assert.equal(own.name, 'Tidewell Tea House', 'the item shows the own name');
  const nameless = ranked.items.find((i) => i.place_id === 'FixtureP13dNameless');
  assert.equal(nameless.own_name, null);
  assert.equal(nameless.name, 'Matcha Spot Wrenmouth Harbour View', 'no own name → Google\'s, for this board only');
  const payload = sc.scoutPayload(payloadArgs(ranked));
  const [pOwn, pNameless] = ['FixtureP13dOwn', 'FixtureP13dNameless'].map((id) => payload.items.find((i) => i.place_id === id));
  assert.equal(pOwn.name, 'Tidewell Tea House');
  assert.equal(pOwn.slug, 'tidewell-tea-house', 'the slug follows the own name');
  assert.equal(pNameless.name, 'Matcha Spot Wrenmouth Harbour View');

  const opts = { query: 'matcha', scout_id: payload.scout_id, on: '2031-03-01', destination: 'wrenmouth' };
  const saved = sc.scoutPlaceFields(pOwn, { ...opts, own_name: own.own_name });
  assert.equal(saved.place.name, 'Tidewell Tea House');
  assert.ok(s.validate(saved.place, 'place').ok);
  assert.ok(!JSON.stringify(saved.place).includes('Best Matcha'), 'nothing of Google\'s name is written');
  assert.deepEqual(sc.scoutPlaceFields(pNameless, opts), { place: null, reason: 'no_own_name' });
  assert.deepEqual(sc.scoutPlaceFields(pNameless, { ...opts, own_name: ' \u200b ' }), { place: null, reason: 'no_own_name' }, 'a blank own name is none');
  const long = sc.scoutPlaceFields(pOwn, { ...opts, own_name: 'Tea '.repeat(60) });
  assert.ok(long.place.name.length <= 120);
  // a place already in places/ keeps its own name and still gains the scouted entry and the tags
  const existing = { v: 1, id: 'matcha-spot', place_id: 'FixtureP13dNameless', name: 'Harbour View Tea Stand', category: 'cafe', tags: [], status: 'chosen', activity: 'Tea', priority: 1 };
  const kept = sc.scoutPlaceFields(pNameless, { ...opts, existing });
  assert.equal(kept.place.name, 'Harbour View Tea Stand');
  assert.equal(kept.place.history.length, 1);
  assert.deepEqual(kept.place.tags, ['scout', 'matcha']);
});

// Developed by: LightAISolutions

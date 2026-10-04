'use strict';
// packs/tour-guide/gems — the WP-11b screen rules on invented pools: local favourites (two or more independent local
// sources, allowed below the star floor and a little further off track), out-of-season single-bloom gardens on both
// hemispheres (owner seeds stay), crowd magnets, and how the two flags travel to the evidence stage and the projections.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = () => import('../packs/tour-guide/gems/index.mjs');

const ANCHOR = { lat: 40, lng: 10 };
const kmNorth = (km, from = ANCHOR) => ({ lat: from.lat + km / 111.195, lng: from.lng });
const pub = (...publishers) => publishers.map((p, i) => ({ ref: `L${String(101 + i)}`, language: 'xx', kind: 'local-language', publisher: p }));
const P = (id, o = {}) => ({ place_id: 'FixtureC11' + id, name: id + ' Place', rating: 4.6, rating_count: 120, business_status: 'OPERATIONAL', types: ['tourist_attraction'], location: kmNorth(1), ...o });
const OPTS = { trip_dates: ['2031-11-18', '2031-11-19'], anchors: [ANCHOR], modes: ['TRANSIT', 'WALK'], rating_floor: 4.3 };
const reasons = (r) => Object.fromEntries(r.dropped.map((d) => [d.place_id.slice(10), d.reason_code + (d.detail ? ':' + d.detail : '')]));
const keptIds = (r) => r.kept.map((x) => x.place_id.slice(10)).sort();

test('local favourite: two distinct publishers lower the floor to 3.8 (+ offset) and stretch the off-track limit by half; one publisher does not', async () => {
  const g = await G();
  assert.equal(g.LOCAL_FAVOURITE_RATING_FLOOR, 3.8);
  assert.equal(g.LOCAL_FAVOURITE_OFF_TRACK_FACTOR, 1.5);
  const pool = [
    P('Fav40', { rating: 4.0, local_mentions: pub('harbour-weekly.example', 'tide-notes.example') }),
    P('OnePub', { rating: 4.0, local_mentions: pub('harbour-weekly.example', 'harbour-weekly.example') }),
    P('RefsOnly', { rating: 4.0, local_mentions: [{ ref: 'L201', language: 'xx', kind: 'editorial' }, { ref: 'L202', language: 'xx', kind: 'community' }] }),
    P('SameRef', { rating: 4.0, local_mentions: [{ ref: 'L301', language: 'xx', kind: 'editorial' }, { ref: 'L301', language: 'xx', kind: 'editorial' }] }),
    P('Fav37', { rating: 3.7, local_mentions: pub('a.example', 'b.example') }),
    P('Plain40', { rating: 4.0 }),
    P('FavFar', { rating: 4.5, location: kmNorth(8.5), local_mentions: pub('a.example', 'b.example') }),  // 34 min by transit
    P('PlainFar', { rating: 4.5, location: kmNorth(8.5) }),
    P('FavTooFar', { rating: 4.5, location: kmNorth(10), local_mentions: pub('a.example', 'b.example') }) // 40 min > 37.5
  ];
  const r = g.screen(pool, OPTS);
  assert.deepEqual(reasons(r), { OnePub: 'low_rating', SameRef: 'low_rating', Fav37: 'low_rating', Plain40: 'low_rating', PlainFar: 'too_far:34 min', FavTooFar: 'too_far:40 min' });
  assert.deepEqual(keptIds(r), ['Fav40', 'FavFar', 'RefsOnly']);
  for (const x of r.kept) assert.deepEqual(x.flags, ['local_favourite'], x.place_id);
  // the country's offset still applies on top of the favourite's floor
  assert.ok(g.screen(pool, { ...OPTS, rating_offset: -0.2 }).kept.some((x) => x.place_id === 'FixtureC11Fav37'), '3.7 ≥ 3.8 − 0.2');
  assert.ok(g.screen(pool, { ...OPTS, rating_offset: 0.3 }).dropped.some((d) => d.place_id === 'FixtureC11Fav40' && d.reason_code === 'low_rating'), '4.0 < 3.8 + 0.3');
  // a stricter-than-favourite floor the owner set lower still wins (min of the two)
  assert.ok(g.screen(pool, { ...OPTS, rating_floor: 3.5 }).kept.some((x) => x.place_id === 'FixtureC11Plain40'));
  assert.equal(g.isLocalFavourite(g.normalizeRecord(pool[0])), true);
  assert.equal(g.isLocalFavourite(g.normalizeRecord(pool[1])), false);
});

test('out_of_season: single-bloom gardens drop in the wrong months on both hemispheres; the forecast keeps them; owner seeds and food stay', async () => {
  const g = await G();
  assert.ok(g.DROP_REASONS.includes('out_of_season'));
  const garden = (id, name, o = {}) => P(id, { name, types: ['garden'], primary_type: 'garden', ...o });
  const pool = [
    garden('Rose', 'Saltmere Rose Garden'),
    garden('Hydrangea', 'Ajisai Hollow', { types: ['park'], primary_type: 'park' }),
    garden('Moss', 'Moss Garden'),
    garden('Mixed', 'Plum and Cherry Garden'),
    garden('SeedRose', 'Owner Rosarium', { streams: ['owner_seed'] }),
    P('RoseCafe', { name: 'Rose Corner Cafe', types: ['cafe'], primary_type: 'cafe' }),
    garden('NoLoc', 'Lavender Terrace', { location: null })
  ];
  const nov = g.screen(pool, OPTS);
  assert.deepEqual(reasons(nov), { Hydrangea: 'out_of_season:hydrangea', NoLoc: 'out_of_season:lavender' }, 'no location: the first anchor\'s latitude decides (A6, Phase 13: roses stay in season through November)');
  assert.deepEqual(keptIds(nov), ['Mixed', 'Moss', 'Rose', 'RoseCafe', 'SeedRose'], 'two blooms, no bloom, food and owner seeds stay (A6, Phase 13: the rose garden too in November)');
  // A6 (Phase 13): December drops the rose garden, as November did before
  const dec = g.screen(pool, { ...OPTS, trip_dates: ['2031-12-09', '2031-12-10'] });
  assert.deepEqual(reasons(dec), { Rose: 'out_of_season:roses', Hydrangea: 'out_of_season:hydrangea', NoLoc: 'out_of_season:lavender' });
  assert.deepEqual(keptIds(dec), ['Mixed', 'Moss', 'RoseCafe', 'SeedRose']);
  // June: the same gardens are in season
  assert.deepEqual(reasons(g.screen(pool, { ...OPTS, trip_dates: ['2031-06-10'] })), {});
  // the southern hemisphere's November is late spring: roses in, hydrangeas and lavender (Dec–Feb there) out
  const south = { lat: -35.3, lng: 149.1 };
  const southPool = pool.map((r) => ({ ...r, location: r.location === null ? null : kmNorth(1, south) }));
  assert.deepEqual(reasons(g.screen(southPool, { ...OPTS, anchors: [south] })), { Hydrangea: 'out_of_season:hydrangea', NoLoc: 'out_of_season:lavender' }, 'southern lavender flowers Dec–Feb');
  // the trip's forecast wins: roses at their peak keep the rose garden in December (A6, Phase 13: was November)
  const season = { checked: '2031-10-20', sources: [{ url: 'https://leaves.example.org/', title: 'Forecast', accessed: '2031-10-20' }], bloom: [{ kind: 'roses', status: 'peak', note: 'A late flush this year' }] };
  assert.deepEqual(reasons(g.screen(pool, { ...OPTS, trip_dates: ['2031-12-09', '2031-12-10'], season })), { Hydrangea: 'out_of_season:hydrangea', NoLoc: 'out_of_season:lavender' });
  // no anchors and no location: nothing is known, nothing drops; the lat option is the fallback
  assert.ok(!reasons(g.screen([pool[6]], { ...OPTS, anchors: [] })).NoLoc);
  assert.equal(reasons(g.screen([pool[6]], { ...OPTS, anchors: [], lat: 40 })).NoLoc, 'out_of_season:lavender');
  assert.throws(() => g.screen(pool, { ...OPTS, season: 'autumn' }), /gems: season must be/);
});

test('crowd_magnet: a mass-tourism top-ten place, or the pool\'s top decile of rating counts above the minimum; never a drop', async () => {
  const g = await G();
  assert.equal(g.CROWD_MAGNET_MIN_COUNT, 2000);
  assert.equal(g.CROWD_MAGNET_TOP_SHARE, 0.1);
  const counts = [9000, 6500, 2400, 1800, 900, 700, 500, 400, 300, 250, 220, 200, 180, 160, 150, 140, 130, 120, 110, 100];
  const pool = counts.map((n, i) => P('Pool' + String(i).padStart(2, '0'), { rating_count: n, location: kmNorth(1 + i * 0.1) }));
  pool.push(P('Listed', { rating_count: 300, mass_tourism_rank: 3 }), P('ListedLow', { rating_count: 300, mass_tourism_rank: 14 }));
  const r = g.screen(pool, OPTS);
  assert.equal(r.dropped.length, 0, 'flags never drop');
  const magnets = r.kept.filter((x) => (x.flags || []).includes('crowd_magnet')).map((x) => x.place_id.slice(10)).sort();
  assert.deepEqual(magnets, ['Listed', 'Pool00', 'Pool01', 'Pool02'], '22 counted → top 3 by rank (ceil 2.2), all ≥ 2000; rank 3 on a list; rank 14 is not top ten');
  assert.equal(r.kept.find((x) => x.place_id === 'FixtureC11Pool03').flags, undefined, 'no flag → no flags key: an unflagged record is unchanged');
  // a small pool whose busiest place is under the minimum has no crowd magnet
  assert.deepEqual([...g.crowdMagnetIds(g.normalizePool(pool.slice(3, 12)))], []);
  // both flags on one place, in the screen's order
  const both = g.screen([P('Both', { rating_count: 5000, local_mentions: pub('a.example', 'b.example') })], OPTS).kept[0];
  assert.deepEqual(both.flags, ['local_favourite', 'crowd_magnet']);
});

test('the flags travel: flagEvidence keeps them after its own, toPlaceFields persists them, the shortlist item says local_favourite, the line says it in words', async () => {
  const g = await G();
  const both = g.screen([P('Both', { rating_count: 5000, local_mentions: pub('a.example', 'b.example'), signals: { visitor_wording: true } })], OPTS).kept;
  const [scored] = g.scoreGems(both, { trip_dates: OPTS.trip_dates });
  const { flags, record } = g.flagEvidence(scored, { trip_dates: OPTS.trip_dates, today: '2031-10-01' });
  assert.deepEqual(flags, ['tourist_oriented', 'local_favourite', 'crowd_magnet']);
  assert.deepEqual(g.flagEvidence(record, { trip_dates: OPTS.trip_dates, today: '2031-10-01' }).flags, flags, 'idempotent: no repeats on a second pass');
  assert.deepEqual(g.toPlaceFields(record).flags, flags);
  assert.deepEqual(g.toShortlistFields(record), { gem: record.gem, gem_line: g.gemLine(record), local_favourite: true });
  const line = g.gemLine(record);
  assert.match(line, /a local favourite named by two local-language guides/);
  assert.match(line, /busy at peak hours/);
  assert.doesNotMatch(line, /\d/, 'R3: still no digit');
  assert.equal(g.FLAG_LABELS.local_favourite, 'Local favourite');
  assert.equal(g.FLAG_LABELS.crowd_magnet, 'Busy at peak hours');
  assert.deepEqual([...g.SCREEN_FLAGS], ['local_favourite', 'crowd_magnet']);
  // a stray screen flag on an input record does not survive normalisation: the screen decides afresh
  assert.equal('flags' in g.normalizeRecord({ ...P('Forged'), flags: ['local_favourite'] }), false);
  const { groups } = g.selectShortlist([record], { per_group: { activities: 1, food: 0 } });
  assert.deepEqual(groups[0].items[0].flags, flags, 'shortlist items keep the flags for the routine');
});

// Developed by: LightAISolutions

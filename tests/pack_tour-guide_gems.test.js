'use strict';
// packs/tour-guide/gems — the Gem Funnel engine (proposal §4 stages 2–5) on the invented Port Sorrel pool: screening
// reasons, deterministic scoring in range, the 💎 rule and appetite weight shift, city-size buckets, evidence flags,
// gem lines without review text, shortlist floors and `decided`, the Later list and the persisted projections.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = () => import('../packs/tour-guide/gems/index.mjs');
const FX = () => import('../packs/tour-guide/gems/fixtures/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');

function deepFreeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; }
async function world(appetite = 3, extra = {}) {
  const g = await G(), { loadGemFixture } = await FX();
  const fx = loadGemFixture('port-sorrel');
  const screenOpts = { trip_dates: fx.trip.dates, anchors: fx.anchors, modes: fx.trip.modes, ...fx.screen_options };
  const scoreOpts = { appetite, trip_dates: fx.trip.dates, day_start: fx.trip.day_start, day_end: fx.trip.day_end, anchors: fx.anchors, modes: fx.trip.modes, profile: fx.profile, rough_edges: fx.rough_edges, city_size: 'large', ...extra };
  const { kept, dropped } = g.screen(fx.pool, screenOpts);
  const scored = g.scoreGems(kept, scoreOpts);
  return { g, fx, screenOpts, scoreOpts, kept, dropped, scored, byId: (id) => scored.find((r) => r.place_id === id) };
}

test('fixture: 53 invented places, every record normalizes, duplicate ids and nonsense are refused with gems: errors', async () => {
  const g = await G(), { loadGemFixture, listGemFixtures } = await FX();
  assert.deepEqual(listGemFixtures(), ['port-sorrel']);
  const fx = loadGemFixture();
  assert.equal(fx.pool.length, 53);
  const pool = g.normalizePool(fx.pool);
  assert.equal(pool.length, 53);
  assert.ok(pool.every((r) => r.category && Array.isArray(r.local_mentions) && Array.isArray(r.friction)));
  assert.throws(() => g.normalizePool([fx.pool[0], fx.pool[0]]), /^Error: gems: pool\[1\]: duplicate place_id/);
  assert.throws(() => g.normalizeRecord({ place_id: 'x', name: 'Too short id' }), /^Error: gems: place_id/);
  assert.throws(() => g.normalizeRecord({ place_id: 'FixtureGemX', name: 'N', streams: ['facebook'] }), /gems: .*streams/);
  assert.throws(() => g.normalizeRecord({ place_id: 'FixtureGemX', name: 'N', local_mentions: [{ ref: 'L001', language: 'portuguese', kind: 'editorial' }] }), /gems: .*language/);
  assert.throws(() => g.normalizeRecord({ place_id: 'FixtureGemX', name: 'N', local_mentions: [{ ref: 'L001', language: 'pt', kind: 'blog' }] }), /gems: .*kind/);
  assert.throws(() => g.normalizeRecord({ place_id: 'FixtureGemX', name: 'N', rating: 7 }), /gems: .*rating/);
  assert.throws(() => g.normalizeRecord({ place_id: 'FixtureGemX', name: 'N', location: { lat: 1 } }), /gems: .*location/);
  // review text never survives normalization; the language subtag is lower-cased
  const r = g.normalizeRecord({ place_id: 'FixtureGemX', name: 'N', reviews: [{ publish_time: '2027-01-01T00:00:00Z', rating: 5, text: 'SECRET TEXT' }], local_mentions: [{ ref: 'L002.3', language: 'PT-br', kind: 'local-language' }] });
  assert.deepEqual(r.reviews, [{ publish_time: '2027-01-01T00:00:00Z', rating: 5 }]);
  assert.equal(r.local_mentions[0].language, 'pt-br');
  // a raw Places (New) search result maps to a record
  const fromRaw = g.fromSearchResult({ id: 'FixtureGemRaw', displayName: { text: 'Raw Place' }, types: ['cafe'], primaryType: 'cafe', rating: 4.5, userRatingCount: 80, businessStatus: 'OPERATIONAL', location: { latitude: 36.41, longitude: -33.8 }, regularOpeningHours: { periods: [{ open: { day: 0, hour: 0, minute: 0 } }] }, websiteUri: 'https://raw.example.com/', reviews: [{ publishTime: '2027-02-02T00:00:00Z', rating: 4, text: 'hidden', authorAttribution: { displayName: 'Reviewer' } }] }, { streams: ['taste'] });
  assert.equal(fromRaw.category, 'cafe');
  assert.deepEqual(fromRaw.location, { lat: 36.41, lng: -33.8 });
  assert.equal(fromRaw.reviews[0].text, undefined);
  assert.equal(g.categoryOf({ types: ['ramen_restaurant', 'restaurant'] }), 'restaurant');
  assert.equal(g.groupOf({ category: 'museum' }), 'activities');
  assert.equal(g.groupOf({ types: ['wine_bar'] }), 'food');
});

test('screen: each rule drops its carrier once with the right reason; waivers and unknowns pass; inputs untouched', async () => {
  const { g, fx, kept, dropped, screenOpts } = await world();
  const c = fx.carriers;
  const reasonOf = (id) => dropped.find((d) => d.place_id === id);
  for (const id of c.chain_repeated) assert.deepEqual(reasonOf(id), { place_id: id, reason_code: 'chain', detail: 'repeated' });
  assert.deepEqual(reasonOf(c.chain_listed), { place_id: c.chain_listed, reason_code: 'chain', detail: 'listed' });
  assert.deepEqual(reasonOf(c.not_operational), { place_id: c.not_operational, reason_code: 'not_operational', detail: 'CLOSED_TEMPORARILY' });
  assert.deepEqual(reasonOf(c.low_rating), { place_id: c.low_rating, reason_code: 'low_rating' });
  assert.deepEqual(reasonOf(c.too_few_ratings), { place_id: c.too_few_ratings, reason_code: 'too_few_ratings' });
  assert.deepEqual(reasonOf(c.closed_all_dates), { place_id: c.closed_all_dates, reason_code: 'closed_all_dates' });
  assert.equal(reasonOf(c.too_far).reason_code, 'too_far');
  assert.deepEqual(reasonOf(c.avoided_type), { place_id: c.avoided_type, reason_code: 'avoided_type', detail: 'night_club' });
  const counts = dropped.reduce((m, d) => ({ ...m, [d.reason_code]: (m[d.reason_code] || 0) + 1 }), {});
  assert.deepEqual(counts, { chain: 4, not_operational: 1, low_rating: 1, too_few_ratings: 1, closed_all_dates: 1, too_far: 1, avoided_type: 1 });
  assert.equal(kept.length + dropped.length, fx.pool.length);
  assert.ok(dropped.every((d) => g.DROP_REASONS.includes(d.reason_code)));
  // waivers: 12 ratings with two local mentions stays; an owner seed with 12 ratings stays; unknown hours and UNSPECIFIED status stay
  for (const id of [c.too_few_waived_by_mentions, c.owner_seeds[0], c.unknown_hours]) assert.ok(kept.some((r) => r.place_id === id), id + ' kept');
  const unspecified = g.screen([{ place_id: 'FixtureGemUnspecified', name: 'Status Unknown', rating: 4.6, rating_count: 90, business_status: 'BUSINESS_STATUS_UNSPECIFIED' }], screenOpts);
  assert.equal(unspecified.kept.length, 1);
  // the floor follows the appetite when no rating_floor is given; the kept pool carries normalized records
  const strict = g.screen(fx.pool, { ...screenOpts, rating_floor: undefined, appetite: 4 });
  assert.equal(g.ratingFloorFor(4), 4.5);
  assert.ok(strict.dropped.filter((d) => d.reason_code === 'low_rating').length > 1);
  assert.ok(kept.every((r) => r.category));
  // input not mutated
  const frozen = deepFreeze(JSON.parse(JSON.stringify(fx.pool)));
  assert.doesNotThrow(() => g.screen(frozen, screenOpts));
  assert.throws(() => g.screen(fx.pool, { ...screenOpts, trip_dates: [] }), /gems: screen needs trip_dates/);
  assert.throws(() => g.screen(fx.pool, { ...screenOpts, anchors: [{ lat: 1 }] }), /gems: anchors/);
  assert.throws(() => g.screen(fx.pool, { ...screenOpts, modes: ['BOAT'] }), /gems: no usable travel mode/);
});

test('geo + hours: straight-line minutes at the conservative speeds; period, snapshot and by_date hours agree on closed and usable days', async () => {
  const g = await G();
  assert.equal(Math.round(g.straightLineMinutes(6.25, ['TRANSIT'])), 25);
  assert.equal(Math.round(g.straightLineMinutes(4.5, ['WALK'])), 60);
  assert.equal(Math.round(g.straightLineMinutes(15, ['WALK', 'DRIVE'])), 30, 'the fastest mode counts');
  assert.ok(Math.abs(g.haversineKm({ lat: 36.41, lng: -33.8 }, { lat: 36.42, lng: -33.8 }) - 1.112) < 0.01);
  assert.equal(g.minutesToNearestAnchor({ lat: 36.41, lng: -33.8 }, [], ['WALK']), null);
  const periods = { periods: [{ open: { day: 3, hour: 9, minute: 0 }, close: { day: 3, hour: 17, minute: 0 } }, { open: { day: 5, hour: 20, minute: 0 }, close: { day: 6, hour: 1, minute: 0 } }] };
  const dates = ['2027-05-12', '2027-05-13', '2027-05-14']; // Wed Thu Fri
  assert.deepEqual(g.openWindows(periods, '2027-05-12'), [{ open: 540, close: 1020 }]);
  assert.deepEqual(g.openWindows(periods, '2027-05-14'), [{ open: 1200, close: 1440 }], 'a window over midnight is cut at 24:00');
  assert.deepEqual(g.closedDates(periods, dates), ['2027-05-13']);
  assert.equal(g.closedOnAll(periods, dates), false);
  assert.deepEqual(g.usableDates(periods, dates, { day_start: '09:00', day_end: '18:00' }), ['2027-05-12']);
  assert.equal(g.usableDates(null, dates), null, 'unknown hours are null, never closed');
  assert.equal(g.closedOnAll(null, dates), false);
  const snapshotShape = { weekday_descriptions: [], periods: periods.periods };
  assert.deepEqual(g.closedDates(snapshotShape, dates), ['2027-05-13']);
  const byDate = { by_date: { '2027-05-12': [], '2027-05-13': [{ open: '10:00', close: '12:00' }], '2027-05-14': [{ open: '17:45', close: '23:00' }] } };
  assert.deepEqual(g.closedDates(byDate, dates), ['2027-05-12']);
  assert.deepEqual(g.usableDates(byDate, dates, { day_start: '09:00', day_end: '18:00' }), ['2027-05-13'], '15 minutes of overlap is not usable');
  assert.ok(g.usableOn({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] }, '2027-05-13'), '24/7 shape');
  assert.throws(() => g.openWindows(periods, '12 May'), /gems: date/);
});

test('scoreGems: deterministic, every component and the score in range, components follow the proposal formulas', async () => {
  const { g, fx, kept, scored, scoreOpts, byId } = await world();
  const again = g.scoreGems(kept, scoreOpts);
  assert.deepEqual(scored, again, 'same input, same output');
  for (const r of scored) {
    for (const k of ['q', 'o', 'l', 'f', 'p']) assert.ok(r[k] >= 0 && r[k] <= 1, `${r.name} ${k}=${r[k]}`);
    assert.ok(r.gem_score >= 0 && r.gem_score <= 100 && Number.isFinite(r.gem_score));
    assert.equal(typeof r.gem, 'boolean');
    assert.equal(r.gem, r.o >= g.GEM_RULE.O && r.l >= g.GEM_RULE.L && r.q >= g.GEM_RULE.Q, '💎 rule');
    const w = g.weightsFor(3);
    assert.ok(Math.abs(r.gem_score - 100 * (w.F * r.f + w.Q * r.q + w.O * r.o + w.L * r.l + w.P * r.p)) < 0.06, 'weighted sum');
  }
  assert.ok(kept.every((r) => !('gem_score' in r)), 'inputs not mutated');
  // Quality: (n·r + m·μ)/(n+m) with μ 4.2 (the fixture has < 20 rated members per category), mapped 4.0→0 … 4.9→1
  const fig = byId(fx.carriers.gem_candidates[0]);
  const shrunk = (180 * 4.7 + 30 * 4.2) / 210;
  assert.ok(Math.abs(fig.q - (shrunk - 4.0) / 0.9) < 1e-3);
  assert.deepEqual(g.categoryMeans(kept), {}, 'no category reaches 20 rated members');
  assert.equal(g.qualityScore({ rating: 5, rating_count: 100000 }), 1);
  assert.ok(g.qualityScore({ rating: 4.0, rating_count: 100000 }) < 1e-3, 'shrinkage toward μ keeps it a hair above 4.0');
  assert.equal(g.qualityScore({ rating_count: 50 }), 0, 'no rating → 0');
  // Obscurity: > 2 000 → 0; owner seeds fixed at 0.5; mass-tourism top ten → L penalty
  for (const id of fx.carriers.over_two_thousand) assert.equal(byId(id).o, 0, id);
  for (const id of fx.carriers.owner_seeds) assert.equal(byId(id).o, g.OBSCURITY_OWNER_SEED, id);
  const aquarium = byId(fx.carriers.mass_tourism);
  assert.equal(aquarium.l, 0, '+0.3 editorial − 0.5 mass tourism, clamped');
  assert.equal(aquarium.gem, false);
  // Local-ness: two local-language sources → 1.0 (cap); one local-language + one community → 0.7; one editorial → 0.3
  assert.equal(fig.l, 1);
  assert.equal(byId(fx.carriers.gem_candidates[2]).l, 0.7);
  assert.equal(byId('FixtureGemSaltmarshReadingRoom').l, 0.3);
  assert.equal(g.localnessScore({ local_mentions: [{ ref: 'L001', kind: 'local-language' }, { ref: 'L001', kind: 'local-language' }] }), 0.5, 'the same ref counts once');
  // Practicality: unknown hours 0.5; never open in the day window 0; friction the owner does not tolerate −0.25
  assert.equal(byId(fx.carriers.unknown_hours).p, 0.5);
  assert.equal(byId('FixtureGemSaffronRowSupperClub').p, 0, 'opens at 18:00, the day ends at 18:00');
  assert.equal(byId('FixtureGemMillQuarterGinRoom').p, 0.75, 'no-reservations is not tolerated');
  assert.equal(fig.p, 1, 'no-english-menu is tolerated');
  // Fit: the skill's estimate wins; a cheap estimate otherwise
  const forced = g.scoreGems(kept, { ...scoreOpts, fit_estimates: { [fig.place_id]: 0.95 } }).find((r) => r.place_id === fig.place_id);
  assert.equal(forced.f, 0.95);
  assert.throws(() => g.scoreGems(kept, { ...scoreOpts, fit_estimates: { [fig.place_id]: 1.5 } }), /gems: fit_estimates/);
  assert.equal(g.estimateFit({ types: ['museum'] }, { interests: { museum: 'high' } }), 0.7);
  assert.equal(g.estimateFit({ types: ['store'], price_level: 'PRICE_LEVEL_VERY_EXPENSIVE' }, { interests: { shop: 'low' }, price_max: 2 }), 0);
  assert.equal(g.estimateFit({ types: ['cafe'] }), g.FIT_DEFAULT);
  // the 💎 set on this pool
  assert.deepEqual(scored.filter((r) => r.gem).map((r) => r.place_id).sort(), ['FixtureGemFigTreeCourtyard', 'FixtureGemLanternmakersWorkshop', 'FixtureGemMillQuarterGinRoom', 'FixtureGemTidewaterBoathouseGallery']);
});

test('appetite: weights shift 0.10 from Q+F to O+L at 5 and back at 1; rankings follow; the 💎 rule itself does not move', async () => {
  const g = await G();
  assert.deepEqual(g.weightsFor(3), { F: 0.35, Q: 0.25, O: 0.2, L: 0.15, P: 0.05 });
  assert.deepEqual(g.weightsFor(5), { F: 0.3, Q: 0.2, O: 0.25, L: 0.2, P: 0.05 });
  assert.deepEqual(g.weightsFor(1), { F: 0.4, Q: 0.3, O: 0.15, L: 0.1, P: 0.05 });
  assert.deepEqual(g.weightsFor(4), { F: 0.325, Q: 0.225, O: 0.225, L: 0.175, P: 0.05 });
  for (const a of [1, 2, 3, 4, 5]) assert.ok(Math.abs(Object.values(g.weightsFor(a)).reduce((x, y) => x + y, 0) - 1) < 1e-9);
  assert.deepEqual(g.weightsFor(9), g.weightsFor(5), 'clamped');
  const w1 = await world(1), w3 = await world(3), w5 = await world(5);
  const obscureLocal = 'FixtureGemThreeLanternsTasca', famous = 'FixtureGemSignalHillSummitDeck';
  assert.ok(w5.byId(obscureLocal).gem_score > w3.byId(obscureLocal).gem_score && w3.byId(obscureLocal).gem_score > w1.byId(obscureLocal).gem_score, 'obscure + local climbs with appetite');
  assert.ok(w5.byId(famous).gem_score < w3.byId(famous).gem_score && w3.byId(famous).gem_score < w1.byId(famous).gem_score, 'famous + well-rated falls with appetite');
  const gems = (w) => w.scored.filter((r) => r.gem).map((r) => r.place_id).sort();
  assert.deepEqual(gems(w1), gems(w3));
  assert.deepEqual(gems(w3), gems(w5));
});

test('obscurity buckets: 40–400 score highest in a large city, 15–150 in a small one, > 2 000 is 0; city size is derived when not given', async () => {
  const g = await G();
  assert.equal(g.bucketFactor(40, 'large'), 1); assert.equal(g.bucketFactor(400, 'large'), 1);
  assert.equal(g.bucketFactor(39, 'large'), g.OBSCURITY_BELOW_BAND_FACTOR); assert.equal(g.bucketFactor(39, 'small'), 1);
  assert.equal(g.bucketFactor(15, 'small'), 1); assert.equal(g.bucketFactor(14, 'small'), g.OBSCURITY_BELOW_BAND_FACTOR);
  assert.ok(g.bucketFactor(300, 'small') < 1 && g.bucketFactor(300, 'small') > 0.9);
  assert.equal(g.bucketFactor(2000, 'large'), 0); assert.equal(g.bucketFactor(2001, 'small'), 0);
  assert.ok(Math.abs(g.bucketFactor(1200, 'large') - 0.5) < 1e-9, 'linear fall from the band top to 2 000');
  const pool = [30, 60, 120, 250, 600, 1500, 3000].map((n, i) => ({ place_id: 'FixtureGemO' + i, name: 'O' + i, types: ['cafe'], rating: 4.5, rating_count: n }));
  const large = pool.map((r) => g.obscurityScore(r, pool, 'large')), small = pool.map((r) => g.obscurityScore(r, pool, 'small'));
  assert.equal(large[6], 0); assert.equal(small[6], 0);
  assert.ok(large[0] < large[1], 'under the band in a large city scores below the band');
  assert.ok(small[0] > small[1], 'inside the band in a small city the rarer count wins');
  assert.ok(large[1] > large[2] && large[2] > large[3], 'inside the band: rarer is more obscure');
  assert.ok(large[3] > large[4] && large[4] > large[5], 'above the band: falling');
  assert.ok(large.slice(1, 4).every((o) => o >= g.GEM_RULE.O), 'every in-band place can satisfy the 💎 O threshold');
  assert.equal(g.percentileRank(pool[0], pool), 0);
  assert.equal(g.percentileRank(pool[6], pool), 1);
  assert.equal(g.percentileRank(pool[0], [pool[0]]), 0.5, 'alone in its category');
  assert.equal(g.citySizeFor({ city_size: 'small' }), 'small');
  assert.equal(g.citySizeFor({ aggregate_counts: { restaurant: 250, cafe: 80 } }), 'large');
  assert.equal(g.citySizeFor({ aggregate_counts: { restaurant: 90 } }), 'small');
  assert.equal(g.citySizeFor({ pool_size: 60 }), 'small');
  assert.equal(g.citySizeFor({ pool_size: 200 }), 'large');
  assert.equal(g.citySizeFor({}), g.CITY_SIZE_DEFAULT);
  assert.throws(() => g.citySizeFor({ city_size: 'medium' }), /gems: city_size/);
  const { g: g2, fx, kept, scoreOpts } = await world();
  assert.equal(g2.scoringContext(kept, { ...scoreOpts, city_size: undefined, aggregate_counts: fx.aggregate_counts }).city_size, 'small');
});

test('flagEvidence: unproven clears the gem, tourist_oriented from the skill\'s booleans, closed_day_conflict from hours; outputs carry no review text', async () => {
  const { g, fx, byId } = await world();
  const ramen = byId(fx.carriers.unproven);
  const forcedGem = { ...ramen, gem: true };
  const u = g.flagEvidence(forcedGem, { trip_dates: fx.trip.dates, today: fx.today });
  assert.deepEqual(u.flags, ['unproven'], 'closed Tuesdays, but the trip runs Wed–Fri: no closed-day conflict');
  assert.equal(u.record.gem, false, 'unproven clears the gem');
  assert.equal(forcedGem.gem, true, 'input untouched');
  assert.equal(g.isUnproven({ ...ramen, rating_count: 50 }, fx.today), false, '50 ratings is not under 50');
  assert.equal(g.isUnproven({ ...ramen, local_mentions: [{ ref: 'L001', language: 'pt', kind: 'local-language' }] }, fx.today), false, 'a local mention vouches');
  assert.equal(g.isUnproven({ ...ramen, reviews: [] }, fx.today), false, 'no reviews → nothing to judge');
  assert.equal(g.isUnproven(ramen, '2027-07-30'), false, 'ninety days later the same reviews are no longer fresh');
  assert.throws(() => g.flagEvidence(ramen, { trip_dates: fx.trip.dates }), /gems: flagEvidence needs today/);
  const fig = byId(fx.carriers.gem_candidates[0]);
  const f = g.flagEvidence(fig, { trip_dates: fx.trip.dates, today: fx.today });
  assert.deepEqual(f.flags, [], 'old reviews, 180 ratings, local mentions, open on every trip date');
  assert.equal(f.record.gem, true);
  const sunset = byId(fx.carriers.tourist_oriented);
  assert.deepEqual(g.flagEvidence(sunset, { trip_dates: fx.trip.dates, today: fx.today }).flags, ['tourist_oriented']);
  assert.deepEqual(g.flagEvidence({ ...sunset, signals: {} }, { trip_dates: fx.trip.dates, today: fx.today }).flags, []);
  assert.deepEqual(g.flagEvidence({ ...sunset, signals: { english_only_menu: true } }, { trip_dates: fx.trip.dates, today: fx.today }).flags, [], 'an English menu alone is not tourist-oriented');
  assert.deepEqual(g.flagEvidence({ ...sunset, signals: {} }, { trip_dates: fx.trip.dates, today: fx.today, signals: { visitor_wording: true } }).flags, ['tourist_oriented']);
  assert.ok(g.flagEvidence(byId(fx.carriers.mass_tourism), { trip_dates: fx.trip.dates, today: fx.today }).flags.includes('tourist_oriented'), 'a mass-tourism listing');
  // closed_day_conflict: the Reading Room is closed Sat/Sun (not on the trip); the Gin Room is closed Monday; the Pier Walk has an empty by_date on the 14th
  assert.deepEqual(g.flagEvidence(byId('FixtureGemSaltmarshReadingRoom'), { trip_dates: fx.trip.dates, today: fx.today }).flags, []);
  assert.deepEqual(g.flagEvidence(byId(fx.carriers.by_date_hours), { trip_dates: fx.trip.dates, today: fx.today }).flags, ['closed_day_conflict']);
  assert.deepEqual(g.flagEvidence(byId(fx.carriers.by_date_hours), { trip_dates: fx.trip.dates, today: fx.today, visit_date: '2027-05-13' }).flags, [], 'with a visit date only that day counts');
  assert.deepEqual(g.flagEvidence(byId(fx.carriers.unknown_hours), { trip_dates: fx.trip.dates, today: fx.today }).flags, [], 'unknown hours never conflict');
  assert.ok(!JSON.stringify(u.record).includes('text'), 'no review text anywhere');
  assert.deepEqual(Object.keys(g.FLAG_LABELS).sort(), [...g.FLAGS].sort());
});

test('gemLine: numbers and source kinds only, ≤ 200 chars, deterministic, trims whole clauses first', async () => {
  const { g, fx, byId, scored, kept } = await world();
  const medians = g.categoryMedianCounts(kept);
  const fig = byId(fx.carriers.gem_candidates[0]);
  const line = g.gemLine(fig, { category_median_count: medians[fig.category] });
  assert.equal(line, '4.7 from 180 ratings where peers typically have 145; named by two local-language guides; no English menu.');
  assert.equal(g.gemLine(fig, { category_median_count: medians[fig.category] }), line);
  const lantern = byId(fx.carriers.gem_candidates[1]);
  assert.equal(g.gemLine(lantern), '4.8 from 95 ratings; named by one local-language guide and one local editorial list.');
  const seeds = g.gemLine(byId(fx.carriers.owner_seeds[0]));
  assert.ok(seeds.includes('one of your own seeds'), seeds);
  const flagged = g.flagEvidence(byId(fx.carriers.unproven), { trip_dates: fx.trip.dates, today: fx.today }).record;
  assert.ok(g.gemLine(flagged).includes('new: all its ratings are recent'));
  assert.ok(g.gemLine(byId(fx.carriers.mass_tourism)).includes('on a mass-tourism top-ten list'));
  assert.ok(g.gemLine(byId(fx.carriers.tourist_oriented)).includes('English-only menu'));
  for (const r of scored) {
    const s = g.gemLine(r, { category_median_count: medians[r.category] });
    assert.ok(s.length <= g.GEM_LINE_MAX && s.endsWith('.'), s);
    assert.ok(!/SECRET|hidden/.test(s));
  }
  const many = { rating: 4.6, rating_count: 77, local_mentions: Array.from({ length: 9 }, (_, i) => ({ ref: 'L' + String(100 + i), language: 'pt', kind: ['local-language', 'editorial', 'community'][i % 3] })), friction: ['cash-only', 'no-english-menu', 'queues', 'no-reservations', 'standing-room'], mass_tourism_rank: 3, flags: ['tourist_oriented', 'closed_day_conflict'], streams: ['owner_seed'] };
  const long = g.gemLine(many, { category_median_count: 1900000 });
  assert.ok(long.length <= 200 && long.endsWith('.'), long);
  assert.ok(g.gemLineClauses(many).join('; ').length > 200, 'the full set of clauses was longer');
  assert.equal(g.gemLine(many, { max: 20 }), '4.6 from 77 ratings.', 'the first clause alone fits');
  assert.equal(g.gemLine(many, { max: 15 }), '4.6 from 77 ra…', 'a hard cut only when even the first clause is too long');
  assert.equal(g.gemLine({}), '');
  assert.equal(g.numberWord(2), 'two'); assert.equal(g.numberWord(12), '12');
});

test('selectShortlist: floors by appetite, gems first then score order, decided excluded, unmet floor reported, not_shown reasons', async () => {
  const { g, fx, scored } = await world();
  const sel = g.selectShortlist(scored, { appetite: 3 });
  assert.deepEqual(sel.groups.map((x) => [x.id, x.items.length, x.gems_wanted, x.gems_shown, x.floor_met]), [['activities', 8, 2, 2, true], ['food', 6, 2, 2, true]]);
  for (const grp of sel.groups) {
    for (let i = 1; i < grp.items.length; i++) assert.ok(grp.items[i - 1].gem_score >= grp.items[i].gem_score, 'ordered by score');
    assert.deepEqual(grp.items.map((x) => x.rank), grp.items.map((_, i) => i + 1));
    assert.ok(grp.items.every((x) => g.groupOf(x) === grp.id));
  }
  assert.equal(sel.groups[0].items.length + sel.groups[1].items.length + sel.not_shown.length, scored.length);
  assert.ok(sel.not_shown.every((x) => x.place_id && x.slug && /^(Gem r|R)anked \d+(st|nd|rd|th) of \d+ in (activities|food) \(score [\d.]+\); the round showed \d+\.$/.test(x.reason)));
  // the floor pulls a lower-scored gem in: with 4 activity slots the top four by score hold one gem (Boathouse Gallery);
  // at appetite 3 (floor 2) the Lanternmakers Workshop (6th by score) displaces the 4th; at appetite 1 (no floor) it does not
  const lantern = 'FixtureGemLanternmakersWorkshop';
  const top4 = scored.filter((r) => g.groupOf(r) === 'activities').sort(g.byScore).slice(0, 4).map((r) => r.place_id);
  assert.ok(!top4.includes(lantern));
  const four3 = g.selectShortlist(scored, { appetite: 3, per_group: { activities: 4, food: 6 } }).groups[0];
  assert.ok(four3.items.some((x) => x.place_id === lantern), 'pulled in by the floor');
  assert.deepEqual(four3.items.map((x) => x.place_id), [...top4.slice(0, 3), lantern], 'the lowest non-gem gave way; order stays by score');
  assert.deepEqual([four3.gems_wanted, four3.gems_shown, four3.floor_met], [2, 2, true]);
  const four1 = g.selectShortlist(scored, { appetite: 1, per_group: { activities: 4, food: 6 } }).groups[0];
  assert.deepEqual(four1.items.map((x) => x.place_id), top4, 'no floor at appetite 1: pure score order');
  // appetite 1: no floor; appetite 4 and 5 want more gems than the pool holds (2 + 2) → floor not met, nothing invented
  const sel1 = g.selectShortlist(scored, { appetite: 1 });
  assert.deepEqual(sel1.groups.map((x) => x.gems_wanted), [0, 0]);
  const top8 = scored.filter((r) => g.groupOf(r) === 'activities').sort(g.byScore).slice(0, 8).map((r) => r.place_id);
  assert.deepEqual(sel1.groups[0].items.map((x) => x.place_id), top8);
  const sel4 = g.selectShortlist(scored, { appetite: 4 });
  assert.deepEqual(sel4.groups.map((x) => [x.gems_wanted, x.gems_shown, x.floor_met]), [[3, 2, false], [2, 2, true]]);
  const sel5 = g.selectShortlist(scored, { appetite: 5 });
  assert.deepEqual(sel5.groups.map((x) => [x.gems_wanted, x.gems_shown, x.floor_met]), [[4, 2, false], [3, 2, false]]);
  assert.equal(sel5.groups[0].items.length, 8);
  assert.equal(sel5.groups[1].items.length, 6);
  // decided: by slug or by place id, case-sensitive; excluded places are reported, never listed as not_shown
  const dec = g.selectShortlist(scored, { appetite: 3, decided: ['fig-tree-courtyard', 'FixtureGemTidewaterBoathouseGallery', 'FIXTUREGEMMILLQUARTERGINROOM'] });
  assert.deepEqual(dec.excluded.sort(), ['FixtureGemFigTreeCourtyard', 'FixtureGemTidewaterBoathouseGallery']);
  assert.ok(!dec.groups.flatMap((x) => x.items).some((x) => dec.excluded.includes(x.place_id)));
  assert.ok(!dec.not_shown.some((x) => dec.excluded.includes(x.place_id)));
  assert.deepEqual(dec.groups.map((x) => [x.gems_wanted, x.gems_shown, x.floor_met]), [[2, 1, false], [2, 1, false]], 'one gem left per group after the decided ones');
  // custom groups and sizes; errors
  const small = g.selectShortlist(scored, { appetite: 3, per_group: { activities: 2, food: 1 } });
  assert.deepEqual(small.groups.map((x) => [x.items.length, x.gems_wanted]), [[2, 2], [1, 1]]);
  assert.throws(() => g.selectShortlist(scored, { per_group: { food: 6 } }), /gems: group_of returned "activities"/);
  assert.throws(() => g.selectShortlist(scored.map((r) => ({ ...r, gem_score: undefined }))), /gems: record .* has no gem_score/);
  assert.throws(() => g.selectShortlist(scored, { per_group: { activities: -1, food: 6 } }), /gems: per_group/);
  assert.ok(scored.every((r) => !('rank' in r)), 'inputs not mutated');
});

test('gemsNotChosenList: a LaterList "Gems not chosen" with code not_shown, highest score first, unique slugs', async () => {
  const { g, fx, scored } = await world();
  const s = await S();
  const { not_shown } = g.selectShortlist(scored, { appetite: 3 });
  const list = g.gemsNotChosenList({ trip_id: fx.trip.id, not_shown, today: fx.today });
  assert.equal(list.v, 1); assert.equal(list.trip_id, fx.trip.id); assert.equal(list.name, g.GEMS_NOT_CHOSEN_LIST);
  assert.equal(list.items.length, not_shown.length);
  assert.ok(list.items.every((it) => it.code === 'not_shown' && it.added_on === fx.today && /^[a-z0-9][a-z0-9-]{0,63}$/.test(it.place) && /^[A-Za-z0-9_-]{6,300}$/.test(it.place_id) && it.reason.length > 0 && it.reason.length <= 300));
  assert.equal(new Set(list.items.map((it) => it.place)).size, list.items.length, 'slugs unique');
  const scoreOf = (id) => scored.find((r) => r.place_id === id).gem_score;
  for (let i = 1; i < list.items.length; i++) assert.ok(scoreOf(list.items[i - 1].place_id) >= scoreOf(list.items[i].place_id));
  assert.deepEqual(s.validate(list, 'later-list').errors, [], 'the Gems not chosen list validates against the Later list schema');
  const dup = g.gemsNotChosenList({ trip_id: 't1', today: '2027-05-01', not_shown: [{ place_id: 'FixtureGemA1', slug: 'same', gem_score: 50, reason: 'r' }, { place_id: 'FixtureGemA2', slug: 'same', gem_score: 60, reason: 'r' }] });
  assert.deepEqual(dup.items.map((it) => [it.place, it.place_id]), [['same', 'FixtureGemA2'], ['same-2', 'FixtureGemA1']]);
  assert.throws(() => g.gemsNotChosenList({ trip_id: 'Bad Trip', not_shown, today: fx.today }), /gems: trip_id/);
  assert.throws(() => g.gemsNotChosenList({ trip_id: 't1', not_shown, today: 'today' }), /gems: today/);
});

test('toPlaceFields / toShortlistFields: exactly the WP-3d field names, our own numbers only, never a Google field', async () => {
  const { g, fx, byId } = await world();
  const fig = g.flagEvidence(byId(fx.carriers.gem_candidates[0]), { trip_dates: fx.trip.dates, today: fx.today }).record;
  const fields = g.toPlaceFields(fig);
  assert.deepEqual(Object.keys(fields).sort(), [...g.PLACE_FIELDS].sort());
  assert.deepEqual(fields, { gem_score: fig.gem_score, gem: true, obscurity: fig.o, local_mentions: [{ ref: 'L003', language: 'pt', kind: 'local-language' }, { ref: 'L007.2', language: 'pt', kind: 'local-language' }], flags: [] });
  assert.ok(fields.gem_score >= 0 && fields.gem_score <= 100 && fields.obscurity >= 0 && fields.obscurity <= 1);
  for (const k of g.GOOGLE_FIELDS) assert.ok(!(k in fields), k);
  assert.ok(!JSON.stringify(fields).includes('Fig Tree') && !JSON.stringify(fields).includes('180') && !JSON.stringify(fields).includes('4.7'), 'no name, count or rating leaks');
  const unproven = g.flagEvidence({ ...byId(fx.carriers.unproven), gem: true }, { trip_dates: fx.trip.dates, today: fx.today }).record;
  assert.deepEqual(g.toPlaceFields(unproven).flags, ['unproven']);
  assert.equal(g.toPlaceFields(unproven).gem, false);
  // caps: ≤ 20 mentions, ref ≤ 120, ≤ 5 flags; bad tags refused
  const many = { ...fig, local_mentions: Array.from({ length: 25 }, (_, i) => ({ ref: 'L' + String(100 + i).padStart(3, '0') + '-' + 'x'.repeat(130), language: 'pt', kind: 'editorial' })), flags: ['unproven', 'tourist_oriented', 'closed_day_conflict', 'bogus', 'unproven', 'unproven'] };
  const capped = g.toPlaceFields(many);
  assert.equal(capped.local_mentions.length, g.LOCAL_MENTIONS_MAX);
  assert.ok(capped.local_mentions.every((m) => m.ref.length <= g.LOCAL_MENTION_REF_MAX && g.LANGUAGE_RE.test(m.language)));
  assert.deepEqual(capped.flags, ['unproven', 'tourist_oriented', 'closed_day_conflict', 'unproven', 'unproven']);
  assert.throws(() => g.toPlaceFields({ ...fig, local_mentions: [{ ref: 'L001', language: 'Portuguese', kind: 'editorial' }] }), /gems: local mention language/);
  assert.throws(() => g.toPlaceFields(byId(fx.carriers.gem_candidates[0]) && { name: 'unscored' }), /gems: toPlaceFields needs a scored record/);
  const sl = g.toShortlistFields(fig, { category_median_count: 145 });
  assert.deepEqual(Object.keys(sl).sort(), [...g.SHORTLIST_FIELDS].sort());
  assert.equal(sl.gem, true);
  assert.ok(sl.gem_line.length <= 200 && sl.gem_line.startsWith('4.7 from 180 ratings'));
  assert.throws(() => g.assertNoGoogleFields({ gem: true, rating: 4.7 }), /gems: projection carries Google content \(rating\)/);
  // every exported constant the tests depend on is a number or frozen object, not a literal in the code
  assert.ok(Object.isFrozen(g.WEIGHTS_BASE) && Object.isFrozen(g.GEM_RULE) && Object.isFrozen(g.OBSCURITY_BANDS) && Object.isFrozen(g.GEM_FLOORS));
});

// Developed by: LightAISolutions

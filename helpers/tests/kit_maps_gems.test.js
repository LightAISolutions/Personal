'use strict';
// Maps kit — the Gem Funnel additions (WP-2g-kits): Nearby Search tiers, Text Search filters (sent / not sent), Place
// Details Atmosphere evidence (reviews with author attribution and dates), the Places Aggregate client, ledger
// reservation and the hard stop on the new SKUs, and the `nearby` / `aggregate` CLI commands on fixtures. No network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const kit = () => import('../kits/maps/index.mjs');
const CLI = path.join(__dirname, '../kits/maps/index.mjs');

async function setup(ceilings, responder) {
  const k = await kit();
  const transport = responder ? k.createMockTransport(responder) : k.createMockTransport();
  const ledger = k.createLedger({ ceilings });
  return { k, transport, ledger, maps: k.createMapsClient({ transport, ledger }) };
}
const units = (ledger, sku) => ledger.usage().skus.find((r) => r.sku === sku).units;
const CENTER = { lat: 12.3471, lng: -45.6772 };

test('searchNearby: fixed tier mask, body, normalized like textSearch, one unit on the tier SKU', async () => {
  const { k, transport, ledger, maps } = await setup();
  const r = await maps.searchNearby({ center: CENTER, radiusMeters: 450, includedTypes: ['cafe', 'restaurant', 'cafe'], excludedTypes: ['fast_food_restaurant'], rankPreference: 'DISTANCE', maxResultCount: 20, languageCode: 'en', regionCode: 'XX' }, { tier: 'enterprise' });
  assert.equal(r.sku, 'places.nearby_search.enterprise');
  assert.equal(r.nextPageToken, null);
  assert.equal(r.places.length, 3);
  const ts = await maps.textSearch('cafe', { tier: 'enterprise' });
  assert.deepEqual(Object.keys(r).filter((x) => x in ts).sort(), ['ms', 'nextPageToken', 'notSent', 'places', 'sku'], 'same result keys as textSearch');
  assert.deepEqual(Object.keys(r.places[0]).sort(), Object.keys(ts.places[0]).sort(), 'places carry the same fields at the same tier');
  const c = transport.calls[0];
  assert.equal(c.url, 'https://places.googleapis.com/v1/places:searchNearby');
  assert.equal(c.headers['X-Goog-FieldMask'], k.NEARBY_SEARCH_MASKS.enterprise);
  assert.deepEqual(c.body, { locationRestriction: { circle: { center: { latitude: 12.3471, longitude: -45.6772 }, radius: 450 } }, includedTypes: ['cafe', 'restaurant'], excludedTypes: ['fast_food_restaurant'], rankPreference: 'DISTANCE', maxResultCount: 20, languageCode: 'en', regionCode: 'xx' });
  assert.ok(!('X-Goog-Api-Key' in c.headers));
  assert.equal(units(ledger, 'places.nearby_search.enterprise'), 1);
  for (const tier of ['pro', 'enterprise_atmosphere']) assert.equal((await maps.searchNearby({ center: CENTER, radiusMeters: 300 }, { tier })).sku, 'places.nearby_search.' + tier);
  assert.equal((await maps.searchNearby({ center: CENTER, radiusMeters: 300 })).sku, 'places.nearby_search.pro', 'default tier is the cheapest');
});

test('searchNearby: radius clamped to Google limits, Text Search-only options not sent, bad input refused before the ledger', async () => {
  const { transport, ledger, maps } = await setup();
  const big = await maps.searchNearby({ center: CENTER, radiusMeters: 80000, minRating: 4.5, openNow: true, priceLevels: ['MODERATE'], pageToken: 'x', strictTypeFiltering: true, locationBias: { lat: 1, lng: 1 } }, { tier: 'pro' });
  assert.equal(transport.calls[0].body.locationRestriction.circle.radius, 50000);
  assert.match(big.notes[0], /clamped to 50000/);
  assert.deepEqual(big.notSent.sort(), ['locationBias', 'minRating', 'openNow', 'pageToken', 'priceLevels', 'strictTypeFiltering']);
  for (const k of ['minRating', 'openNow', 'priceLevels', 'pageToken', 'strictTypeFiltering', 'locationBias']) assert.ok(!(k in transport.calls[0].body), k + ' is not sent');
  await maps.searchNearby({ center: CENTER, radiusMeters: -5 });
  assert.equal(transport.calls[1].body.locationRestriction.circle.radius, 1);
  const before = transport.calls.length;
  await assert.rejects(maps.searchNearby({ center: CENTER }), (e) => e.code === 'BAD_INPUT' && /radiusMeters/.test(e.message));
  await assert.rejects(maps.searchNearby({ center: { lat: 99, lng: 0 }, radiusMeters: 100 }), /center/);
  await assert.rejects(maps.searchNearby({ center: CENTER, radiusMeters: 100, maxResultCount: 21 }), /maxResultCount/);
  await assert.rejects(maps.searchNearby({ center: CENTER, radiusMeters: 100, rankPreference: 'RELEVANCE' }), /POPULARITY or DISTANCE/);
  await assert.rejects(maps.searchNearby({ center: CENTER, radiusMeters: 100, includedTypes: ['Cafe; DROP'] }), /place types/);
  await assert.rejects(maps.searchNearby({ center: CENTER, radiusMeters: 100, includedTypes: Array.from({ length: 51 }, (_, i) => 't' + i) }), /up to 50/);
  await assert.rejects(maps.searchNearby({ center: CENTER, radiusMeters: 100, includedTypes: ['cafe'], excludedTypes: ['cafe'] }), /both included and excluded/);
  await assert.rejects(maps.searchNearby({ center: CENTER, radiusMeters: 100 }, { tier: 'ids_only' }), /unknown Nearby Search tier/);
  assert.equal(transport.calls.length, before, 'bad input never reaches the network');
  assert.equal(units(ledger, 'places.nearby_search.pro'), 2, 'nor the ledger');
});

test('Text Search: Gem Funnel filters are sent; strictTypeFiltering only with includedType; Nearby-only options are not sent', async () => {
  const { k, transport, ledger, maps } = await setup();
  const area = { low: { lat: 12.30, lng: -45.72 }, high: { lat: 12.40, lng: -45.62 } };
  const r = await maps.textSearch('noodle bar in Velmora', { tier: 'enterprise', minRating: 4.5, pageSize: 20, locationRestriction: area, includedType: 'restaurant', strictTypeFiltering: true, openNow: false, priceLevels: ['inexpensive', 'PRICE_LEVEL_MODERATE', 'MODERATE'], rankPreference: 'RELEVANCE', languageCode: 'en', center: CENTER, maxResultCount: 5 });
  assert.deepEqual(transport.calls[0].body, {
    textQuery: 'noodle bar in Velmora', pageSize: 20, languageCode: 'en', includedType: 'restaurant', strictTypeFiltering: true, openNow: false, minRating: 4.5,
    priceLevels: ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE'], rankPreference: 'RELEVANCE',
    locationRestriction: { rectangle: { low: { latitude: 12.3, longitude: -45.72 }, high: { latitude: 12.4, longitude: -45.62 } } }
  });
  assert.deepEqual(r.notSent.sort(), ['center', 'maxResultCount']);
  assert.equal(r.places[0].userRatingCount, 96, 'enterprise fixture: rating and count in hand');
  assert.equal(r.nextPageToken, 'fixture-enterprise-page-2');
  const p2 = await maps.textSearch('noodle bar in Velmora', { tier: 'enterprise', pageToken: r.nextPageToken, strictTypeFiltering: true, locationBias: area });
  assert.equal(transport.calls[1].body.pageToken, 'fixture-enterprise-page-2');
  assert.ok(!('strictTypeFiltering' in transport.calls[1].body));
  assert.deepEqual(p2.notSent, ['strictTypeFiltering']);
  assert.deepEqual(transport.calls[1].body.locationBias, { rectangle: { low: { latitude: 12.3, longitude: -45.72 }, high: { latitude: 12.4, longitude: -45.62 } } });
  const atm = await maps.textSearch('ramen', { tier: 'enterprise_atmosphere' });
  assert.equal(atm.sku, 'places.text_search.enterprise_atmosphere');
  assert.equal(transport.calls[2].headers['X-Goog-FieldMask'], k.TEXT_SEARCH_MASKS.enterprise_atmosphere);
  const ids = await maps.textSearch('Saltmarsh Noodle Bar, Velmora', { tier: 'ids_only' });
  assert.equal(ids.sku, 'places.text_search.ids_only', 'stream 2 name resolution stays on the free SKU');
  assert.equal(units(ledger, 'places.text_search.enterprise'), 2);
  const n = transport.calls.length;
  await assert.rejects(maps.textSearch('x', { minRating: 4.3 }), /steps of 0.5/);
  await assert.rejects(maps.textSearch('x', { minRating: 6 }), /0–5/);
  await assert.rejects(maps.textSearch('x', { priceLevels: ['CHEAP'] }), /price level/);
  await assert.rejects(maps.textSearch('x', { priceLevels: 'MODERATE' }), /array/);
  await assert.rejects(maps.textSearch('x', { rankPreference: 'POPULARITY' }), /RELEVANCE or DISTANCE/);
  await assert.rejects(maps.textSearch('x', { locationRestriction: { lat: 1, lng: 1, radiusMeters: 500 } }), /rectangle only/);
  await assert.rejects(maps.textSearch('x', { locationRestriction: { low: area.high, high: area.low } }), /south of/);
  await assert.rejects(maps.textSearch('x', { locationRestriction: area, locationBias: area }), /not both/);
  await assert.rejects(maps.textSearch('x', { includedType: 'two words' }), /Table A/);
  assert.equal(transport.calls.length, n);
});

test('Place Details Enterprise + Atmosphere: reviews with author attribution and dates, summaries, price range', async () => {
  const { k, transport, maps } = await setup();
  const { place, sku } = await maps.placeDetails('FixtureVelmoraMuseum01', { tier: 'enterprise_atmosphere' });
  assert.equal(sku, 'places.details.enterprise_atmosphere');
  assert.equal(transport.calls[0].headers['X-Goog-FieldMask'], k.PLACE_DETAILS_MASKS.enterprise_atmosphere);
  assert.equal(place.reviews[0].authorAttribution.displayName, 'Quay Wanderer', 'raw result keeps Google\'s shape');
  const ev = k.placeEvidence(place);
  assert.equal(ev.userRatingCount, 812);
  assert.equal(ev.reviews.length, 3);
  for (const r of ev.reviews) {
    assert.ok(r.author.displayName && /^https:\/\//.test(r.author.uri), 'author attribution present');
    assert.match(r.publishTime, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(r.relativePublishTimeDescription);
  }
  assert.deepEqual([ev.oldestReviewTime, ev.newestReviewTime], ['2025-11-20T09:05:00Z', '2026-08-14T10:12:00Z']);
  assert.equal(ev.reviewSummary.disclosureText, 'Summarized with Gemini');
  assert.ok(ev.reviewSummary.reviewsUri);
  assert.match(ev.editorialSummary.text, /lanterns/);
  assert.equal(ev.generativeSummary, null, 'regional summaries may be absent');
  assert.equal(ev.priceRange.startPrice.units, '5');
  const plain = k.placeEvidence((await maps.placeDetails('FixtureVelmoraMuseum01', { tier: 'enterprise' })).place);
  assert.deepEqual([plain.reviews, plain.reviewSummary], [[], null], 'the Enterprise mask carries no reviews');
});

test('computeInsights: circle body, count and ids normalized, no field mask, one unit reserved', async () => {
  const { k, transport, ledger, maps } = await setup();
  const q = { area: { circle: { center: { lat: 12.3456, lng: -45.6789 }, radiusMeters: 600.4 } }, typeFilter: { includedTypes: ['restaurant', 'cafe'] }, ratingFilter: { minRating: 4.5 }, operatingStatus: ['OPERATIONAL'], priceLevels: ['inexpensive'] };
  const c = await maps.computeInsights({ insights: ['INSIGHT_COUNT'], ...q });
  assert.deepEqual(c, { count: 37, placeIds: [], sku: 'places.aggregate.compute_insights', ms: 1 });
  const call = transport.calls[0];
  assert.equal(call.method, 'POST');
  assert.equal(call.url, 'https://areainsights.googleapis.com/v1:computeInsights');
  assert.ok(!('X-Goog-FieldMask' in call.headers) && !('X-Goog-Api-Key' in call.headers));
  assert.deepEqual(call.body, { insights: ['INSIGHT_COUNT'], filter: { locationFilter: { circle: { radius: 600, latLng: { latitude: 12.3456, longitude: -45.6789 } } }, typeFilter: { includedTypes: ['restaurant', 'cafe'] }, operatingStatus: ['OPERATING_STATUS_OPERATIONAL'], priceLevels: ['PRICE_LEVEL_INEXPENSIVE'], ratingFilter: { minRating: 4.5 } } });
  const p = await maps.computeInsights({ insights: ['INSIGHT_PLACES'], ...q, area: { circle: { center: { placeId: 'FixtureVelmoraTower02' }, radiusMeters: 400 } } });
  assert.deepEqual(p.placeIds, ['FixtureVelmoraCafe03', 'FixtureVelmoraCafe04', 'FixtureVelmoraNoodle06']);
  assert.equal(transport.calls[1].body.filter.locationFilter.circle.place, 'places/FixtureVelmoraTower02');
  assert.equal(units(ledger, 'places.aggregate.compute_insights'), 2);
  assert.deepEqual(k.normalizeInsights({ count: '12', placeInsights: [{ place: 'places/FixtureVelmoraCafe03' }, { place: 'places/bad id' }] }), { count: 12, placeIds: ['FixtureVelmoraCafe03'] });
  assert.deepEqual(k.normalizeInsights({}), { count: null, placeIds: [] });
});

test('computeInsights: only circles; polygons, regions and bad filters refused before the ledger', async () => {
  const { transport, ledger, maps } = await setup();
  const ok = { insights: ['INSIGHT_COUNT'], area: { circle: { center: CENTER, radiusMeters: 500 } }, typeFilter: { includedTypes: ['bar'] } };
  const bad = [
    [{ ...ok, area: { customArea: { coordinates: [] } } }, /circle areas only/],
    [{ ...ok, area: { region: { place: 'places/FixtureRegion01' } } }, /circle areas only/],
    [{ ...ok, area: { circle: { center: CENTER, radiusMeters: 500 }, polygon: [] } }, /circle areas only/],
    [{ ...ok, area: { circle: { center: CENTER, radiusMeters: 10 } } }, /radiusMeters/],
    [{ ...ok, area: { circle: { center: CENTER, radiusMeters: 60000 } } }, /radiusMeters/],
    [{ ...ok, area: { circle: { center: {}, radiusMeters: 500 } } }, /center/],
    [{ ...ok, insights: [] }, /insights/],
    [{ ...ok, insights: ['INSIGHT_EVERYTHING'] }, /insights/],
    [{ ...ok, typeFilter: {} }, /at least one/],
    [{ ...ok, ratingFilter: { minRating: 0.5 } }, /1\.0–5\.0/],
    [{ ...ok, ratingFilter: { minRating: 4.5, maxRating: 4 } }, /≤ maxRating/],
    [{ ...ok, ratingFilter: {} }, /minRating and\/or maxRating/],
    [{ ...ok, operatingStatus: ['OPEN'] }, /operating status/],
    [{ ...ok, priceLevels: ['CHEAP'] }, /price level/]
  ];
  for (const [q, re] of bad) await assert.rejects(maps.computeInsights(q), (e) => e.name === 'MapsInputError' && e.code === 'BAD_INPUT' && re.test(e.message), re);
  assert.equal(transport.calls.length, 0);
  assert.equal(units(ledger, 'places.aggregate.compute_insights'), 0);
});

test('hard stop on every new SKU at ceiling 0; MAPS_SKU_CEILINGS env reaches the new names', async () => {
  const k = await kit();
  const zero = { 'places.nearby_search.pro': 0, 'places.nearby_search.enterprise': 0, 'places.nearby_search.enterprise_atmosphere': 0, 'places.text_search.enterprise_atmosphere': 0, 'places.aggregate.compute_insights': 0 };
  const { transport, maps } = await setup(zero);
  for (const tier of ['pro', 'enterprise', 'enterprise_atmosphere']) await assert.rejects(maps.searchNearby({ center: CENTER, radiusMeters: 300 }, { tier }), (e) => e instanceof k.MapsBudgetError && e.sku === 'places.nearby_search.' + tier);
  await assert.rejects(maps.textSearch('x', { tier: 'enterprise_atmosphere' }), k.MapsBudgetError);
  await assert.rejects(maps.computeInsights({ insights: ['INSIGHT_COUNT'], area: { circle: { center: CENTER, radiusMeters: 300 } }, typeFilter: { includedTypes: ['cafe'] } }), (e) => e.code === 'SKU_CEILING');
  assert.equal(transport.calls.length, 0, 'nothing sent');
  const viaEnv = k.createMapsClient({ transport: k.createMockTransport(), allowMemoryLedger: true, env: { MAPS_SKU_CEILINGS: 'places.aggregate.compute_insights=0,places.nearby_search.enterprise=1' } });
  assert.deepEqual([viaEnv.ledger.ceilings['places.aggregate.compute_insights'], viaEnv.ledger.ceilings['places.nearby_search.enterprise']], [0, 1]);
});

test('Aggregate host not yet allowed: a proxy refusal or a keyless 403 surfaces as a typed error and is counted as failed', async () => {
  const k = await kit();
  const q = { insights: ['INSIGHT_COUNT'], area: { circle: { center: CENTER, radiusMeters: 500 } }, typeFilter: { includedTypes: ['cafe'] } };
  const refuse = k.createMapsClient({ ledger: k.createLedger(), transport: async () => { throw new k.MapsRequestError('PROXY_REFUSED', 'maps: proxy refused CONNECT to areainsights.googleapis.com (HTTP 403)', { status: 403 }); } });
  await assert.rejects(refuse.computeInsights(q), (e) => e.code === 'PROXY_REFUSED');
  const row = refuse.usage().skus.find((s) => s.sku === 'places.aggregate.compute_insights');
  assert.deepEqual([row.units, row.failed], [1, 1]);
  const keyless = k.createMapsClient({ ledger: k.createLedger(), transport: k.createMockTransport(() => ({ status: 403, body: { error: { code: 403, message: 'Method doesn\'t allow unregistered callers', status: 'PERMISSION_DENIED' } } })) });
  await assert.rejects(keyless.computeInsights(q), (e) => e.code === 'AUTH' && e.apiStatus === 'PERMISSION_DENIED');
});

function cli(args) {
  const env = { ...process.env };
  delete env.MAPS_USAGE_LEDGER;
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env, timeout: 20000 });
}

test('CLI: nearby and aggregate answer from fixtures by default; --live still needs a ledger; masks list the new tiers', () => {
  const n = cli(['nearby', '--tier', 'enterprise', '--json', JSON.stringify({ center: CENTER, radiusMeters: 500, includedTypes: ['cafe'], rankPreference: 'DISTANCE' })]);
  assert.equal(n.status, 0, n.stderr);
  const nj = JSON.parse(n.stdout);
  assert.equal(nj.source, 'fixtures');
  assert.equal(nj.sku, 'places.nearby_search.enterprise');
  assert.equal(nj.places[0].id, 'FixtureVelmoraCafe03');
  const a = cli(['aggregate', '--json', JSON.stringify({ insights: ['INSIGHT_COUNT', 'INSIGHT_PLACES'], area: { circle: { center: CENTER, radiusMeters: 600 } }, typeFilter: { includedTypes: ['restaurant'] }, ratingFilter: { minRating: 4.5 } })]);
  assert.equal(a.status, 0, a.stderr);
  assert.deepEqual(JSON.parse(a.stdout).placeIds.length, 3);
  const poly = cli(['aggregate', '--json', JSON.stringify({ insights: ['INSIGHT_COUNT'], area: { customArea: {} }, typeFilter: { includedTypes: ['bar'] } })]);
  assert.equal(poly.status, 1);
  assert.match(poly.stderr, /BAD_INPUT/);
  assert.equal(cli(['nearby', '--json', '{}', '--live']).status, 2);
  assert.equal(cli(['aggregate']).status, 2);
  const m = JSON.parse(cli(['masks']).stdout);
  assert.equal(m.nearby_search.enterprise_atmosphere.sku, 'places.nearby_search.enterprise_atmosphere');
  assert.equal(m.text_search.enterprise_atmosphere.sku, 'places.text_search.enterprise_atmosphere');
  assert.equal(m.aggregate.sku, 'places.aggregate.compute_insights');
});

// Developed by: LightAISolutions

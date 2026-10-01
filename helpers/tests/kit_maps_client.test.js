'use strict';
// Maps kit — Places + Routes client against the fixture transport: fixed masks on the wire, one SKU per call,
// hard stop before sending, no key unless the caller passes one, typed errors, Route Matrix caps and chunking.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const kit = () => import('../kits/maps/index.mjs');

async function setup(ceilings, responder) {
  const k = await kit();
  const transport = responder ? k.createMockTransport(responder) : k.createMockTransport();
  const ledger = k.createLedger({ ceilings });
  return { k, transport, ledger, maps: k.createMapsClient({ transport, ledger }) };
}
const units = (ledger, sku) => ledger.usage().skus.find((r) => r.sku === sku).units;

test('a live client cannot be built without a persistent ledger', async () => {
  const k = await kit();
  assert.throws(() => k.createMapsClient({ transport: k.createMockTransport(), env: {} }), /ledger path is required/);
});

test('Place Details sends the fixed tier mask, no key by default, and counts one request on that tier SKU', async () => {
  const { k, transport, ledger, maps } = await setup();
  const r = await maps.placeDetails('FixtureVelmoraMuseum01', { tier: 'enterprise', languageCode: 'en' });
  assert.equal(r.place.displayName.text, 'Velmora Lantern Museum');
  assert.equal(r.sku, 'places.details.enterprise');
  const c = transport.calls[0];
  assert.equal(c.method, 'GET');
  assert.equal(c.url, 'https://places.googleapis.com/v1/places/FixtureVelmoraMuseum01?languageCode=en');
  assert.equal(c.headers['X-Goog-FieldMask'], k.PLACE_DETAILS_MASKS.enterprise);
  assert.ok(!('X-Goog-Api-Key' in c.headers), 'Claude Code cloud: the proxy injects the key');
  assert.equal(units(ledger, 'places.details.enterprise'), 1);
  await assert.rejects(maps.placeDetails('FixtureVelmoraMuseum01', { tier: 'everything' }), (e) => e.code === 'BAD_INPUT');
  await assert.rejects(maps.placeDetails('bad id/../x'), (e) => e.code === 'BAD_INPUT');
  assert.equal(transport.calls.length, 1, 'bad input never reaches the network');
});

test('an explicit caller key is sent as X-Goog-Api-Key and never leaks into results or errors', async () => {
  const k = await kit();
  const key = ['fixture', 'key', 'value'].join('-');
  const transport = k.createMockTransport(() => ({ status: 403, body: k.fixture('error-403') }));
  const maps = k.createMapsClient({ transport, ledger: k.createLedger(), apiKey: key });
  const err = await maps.placeDetails('FixtureVelmoraMuseum01').catch((e) => e);
  assert.equal(transport.calls[0].headers['X-Goog-Api-Key'], key);
  assert.equal(err.code, 'AUTH');
  assert.equal(err.status, 403);
  assert.equal(err.apiStatus, 'PERMISSION_DENIED');
  assert.ok(!JSON.stringify({ m: err.message, ...err }).includes(key));
  const row = maps.usage().skus.find((s) => s.sku === 'places.details.enterprise');
  assert.deepEqual([row.units, row.failed], [1, 1], 'counted on send, failure annotated');
});

test('Text Search: Pro and Enterprise masks, body validation, one page per call', async () => {
  const { k, transport, ledger, maps } = await setup();
  const r = await maps.textSearch('lantern museum in Velmora', { tier: 'pro', pageSize: 5, locationBias: { lat: 12.3, lng: -45.6, radiusMeters: 3000 } });
  assert.equal(r.places.length, 2);
  assert.equal(r.nextPageToken, 'fixture-page-2');
  assert.equal(transport.calls[0].headers['X-Goog-FieldMask'], k.TEXT_SEARCH_MASKS.pro);
  assert.deepEqual(transport.calls[0].body, { textQuery: 'lantern museum in Velmora', pageSize: 5, locationBias: { circle: { center: { latitude: 12.3, longitude: -45.6 }, radius: 3000 } } });
  await maps.textSearch('tower', { tier: 'enterprise' });
  assert.equal(transport.calls[1].headers['X-Goog-FieldMask'], k.TEXT_SEARCH_MASKS.enterprise);
  assert.equal(units(ledger, 'places.text_search.pro'), 1);
  assert.equal(units(ledger, 'places.text_search.enterprise'), 1);
  await assert.rejects(maps.textSearch('x', { pageSize: 50 }), /pageSize/);
  await assert.rejects(maps.textSearch('', {}), /1–500/);
});

test('the hard stop refuses BEFORE anything is sent', async () => {
  const { transport, maps } = await setup({ 'places.details.enterprise': 1 });
  await maps.placeDetails('FixtureVelmoraMuseum01');
  const err = await maps.placeDetails('FixtureVelmoraMuseum01').catch((e) => e);
  assert.equal(err.code, 'SKU_CEILING');
  assert.equal(err.name, 'MapsBudgetError');
  assert.equal(transport.calls.length, 1);
});

test('Compute Routes: Essentials by default, Pro for optimize / >10 intermediates / traffic-aware (plan fact 4)', async () => {
  const { k, transport, maps } = await setup();
  const a = { lat: 12.3456, lng: -45.6789 }, b = { placeId: 'FixtureVelmoraTower02' };
  const walk = await maps.computeRoutes({ origin: a, destination: b, travelMode: 'WALK' });
  assert.equal(walk.sku, 'routes.compute_routes.essentials');
  assert.equal(walk.route.durationSec, 1032);
  assert.equal(walk.route.legs[0].end.lat, 12.3512);
  assert.deepEqual(transport.calls[0].body, { origin: { location: { latLng: { latitude: 12.3456, longitude: -45.6789 } } }, destination: { placeId: 'FixtureVelmoraTower02' }, travelMode: 'WALK' });
  assert.equal(transport.calls[0].headers['X-Goog-FieldMask'], k.ROUTE_MASKS.basic);
  const opt = await maps.computeRoutes({ origin: a, destination: a, intermediates: [b, { address: 'Harbour Steps, Velmora' }], optimizeWaypointOrder: true });
  assert.equal(opt.sku, 'routes.compute_routes.pro');
  assert.deepEqual(opt.route.optimizedOrder, [1, 0]);
  assert.equal(k.computeRoutesSku({ intermediates: 10 }), 'routes.compute_routes.essentials');
  assert.equal(k.computeRoutesSku({ intermediates: 11 }), 'routes.compute_routes.pro');
  assert.equal(k.computeRoutesSku({ routingPreference: 'TRAFFIC_AWARE' }), 'routes.compute_routes.pro');
  assert.equal(k.computeRoutesSku({ routingPreference: 'TRAFFIC_UNAWARE' }), 'routes.compute_routes.essentials');
  const many = Array.from({ length: 26 }, (_, i) => ({ lat: 12 + i / 100, lng: -45 }));
  await assert.rejects(maps.computeRoutes({ origin: a, destination: b, intermediates: many }), /at most 25/);
  await assert.rejects(maps.computeRoutes({ origin: a, destination: b, intermediates: [b, b], optimizeWaypointOrder: true, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE_OPTIMAL' }), /incompatible/);
  await assert.rejects(maps.computeRoutes({ origin: a, destination: b, optimizeWaypointOrder: true }), /at least 2/);
  await assert.rejects(maps.computeRoutes({ origin: a, destination: b, travelMode: 'WALK', routingPreference: 'TRAFFIC_AWARE' }), /only allowed with DRIVE/);
  await assert.rejects(maps.computeRoutes({ origin: a, destination: b, travelMode: 'TWO_WHEELER' }), /travelMode/);
  await assert.rejects(maps.computeRoutes({ origin: {}, destination: b }), /origin must be/);
});

test('TRANSIT: no intermediates, departure/arrival time and transit preferences pass through (plan fact 5)', async () => {
  const { k, transport, maps } = await setup();
  const a = { lat: 12.3456, lng: -45.6789 }, b = { lat: 12.3901, lng: -45.6402 };
  const r = await maps.computeRoutes({ origin: a, destination: b, travelMode: 'TRANSIT', departureTime: '2026-10-06T13:00:00Z', transitPreferences: { allowedTravelModes: ['LIGHT_RAIL', 'BUS'], routingPreference: 'LESS_WALKING' } });
  assert.equal(r.sku, 'routes.compute_routes.essentials');
  assert.equal(r.route.legs[0].steps[1].transit.transitLine.nameShort, 'L2');
  const body = transport.calls[0].body;
  assert.equal(body.departureTime, '2026-10-06T13:00:00.000Z');
  assert.deepEqual(body.transitPreferences, { allowedTravelModes: ['LIGHT_RAIL', 'BUS'], routingPreference: 'LESS_WALKING' });
  assert.equal(transport.calls[0].headers['X-Goog-FieldMask'], k.ROUTE_MASKS.transit);
  await assert.rejects(maps.computeRoutes({ origin: a, destination: b, travelMode: 'TRANSIT', intermediates: [a] }), /no intermediate/);
  await assert.rejects(maps.computeRoutes({ origin: a, destination: b, travelMode: 'TRANSIT', departureTime: 'soon' }), /ISO/);
  await assert.rejects(maps.computeRoutes({ origin: a, destination: b, travelMode: 'WALK', arrivalTime: '2026-10-06T13:00:00Z' }), /only allowed with TRANSIT/);
  await assert.rejects(maps.computeRoutes({ origin: a, destination: b, travelMode: 'TRANSIT', transitPreferences: { allowedTravelModes: ['FERRY'] } }), /allowedTravelModes/);
});

test('Route Matrix: counts per element, splits a 12×12 TRANSIT matrix under the 100-element cap with global indexes', async () => {
  const { k, transport, ledger, maps } = await setup();
  const pts = Array.from({ length: 12 }, (_, i) => ({ lat: 12.3 + i / 1000, lng: -45.6 }));
  const r = await maps.computeRouteMatrix({ origins: pts, destinations: pts, travelMode: 'TRANSIT', departureTime: '2026-10-06T09:00:00Z' });
  assert.equal(r.units, 144);
  assert.equal(r.requests, 2);
  assert.equal(r.elements.length, 144);
  assert.deepEqual(r.elements.map((e) => `${e.originIndex},${e.destinationIndex}`).slice(-1), ['11,11']);
  assert.equal(r.elements.find((e) => e.originIndex === 9 && e.destinationIndex === 3).durationSec, 60 * (1 + 3), 'chunk-local index 1 remapped to global 9');
  for (const c of transport.calls) assert.ok(c.body.origins.length * c.body.destinations.length <= k.MATRIX_MAX_ELEMENTS_TRANSIT);
  assert.equal(units(ledger, 'routes.route_matrix.essentials'), 144);
  await assert.rejects(maps.computeRouteMatrix({ origins: pts, destinations: pts, travelMode: 'TRANSIT', chunk: false }), (e) => e.code === 'BAD_INPUT' && e.elementCap === 100);
  const small = await maps.computeRouteMatrix({ origins: pts.slice(0, 2), destinations: pts.slice(0, 2), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE' });
  assert.equal(small.sku, 'routes.route_matrix.pro');
  assert.equal(small.requests, 1);
});

test('Route Matrix: 625 elements otherwise, ≤ 50 place-id waypoints per request, whole matrix checked against the ceiling first', async () => {
  const k = await kit();
  assert.deepEqual(k.planMatrixChunks(25, 25, { elementCap: 625 }), [{ o0: 0, o1: 25, d0: 0, d1: 25 }]);
  const chunks = k.planMatrixChunks(30, 30, { elementCap: 625, waypointCap: 50 });
  for (const c of chunks) assert.ok((c.o1 - c.o0) + (c.d1 - c.d0) <= 50 && (c.o1 - c.o0) * (c.d1 - c.d0) <= 625);
  assert.equal(chunks.reduce((n, c) => n + (c.o1 - c.o0) * (c.d1 - c.d0), 0), 900, 'every element covered once');
  const { transport, maps } = await setup({ 'routes.route_matrix.essentials': 100 });
  const ids = Array.from({ length: 11 }, (_, i) => ({ placeId: 'FixturePlace' + String(i).padStart(2, '0') }));
  const err = await maps.computeRouteMatrix({ origins: ids, destinations: ids }).catch((e) => e);
  assert.equal(err.code, 'SKU_CEILING');
  assert.equal(transport.calls.length, 0, 'no half-fetched matrix');
});

// Developed by: LightAISolutions

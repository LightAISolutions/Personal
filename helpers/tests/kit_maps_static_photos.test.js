'use strict';
// Maps kit — Maps Static API (key appended at send time, never echoed; length reducer; signing; hard stop) and
// Place Photos (two requests, one SKU unit, author attribution returned) against the mock transport.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const kit = () => import('../kits/maps/index.mjs');
const KEY = 'TESTKEYabc123';

async function setup(opts = {}, responder) {
  const k = await kit();
  const transport = responder ? k.createMockTransport(responder) : k.createMockTransport();
  const ledger = k.createLedger({ ceilings: opts.ceilings });
  const maps = k.createMapsClient({ transport, ledger, env: {}, staticKey: opts.noKey ? null : KEY, staticSigningSecret: opts.secret });
  return { k, transport, ledger, maps };
}
const units = (ledger, sku) => (ledger.usage().skus.find((r) => r.sku === sku) || { units: 0 }).units;
const spec = { width: 300, height: 200, center: { lat: 40.7, lng: -74 }, zoom: 13, paths: [{ points: [{ lat: 40.70, lng: -74.01 }, { lat: 40.71, lng: -74.00 }], color: '0xB5482DE6', weight: 4 }], styles: ['feature:poi.business|visibility:off'] };

test('staticMapUrl builds a keyless URL with size, scale, centre, zoom, style and an encoded path', async () => {
  const k = await kit();
  const u = new URL(k.staticMapUrl(spec));
  assert.equal(u.origin + u.pathname, k.STATIC_MAPS_BASE);
  assert.equal(u.searchParams.get('size'), '300x200');
  assert.equal(u.searchParams.get('scale'), '2');
  assert.equal(u.searchParams.get('center'), '40.7,-74');
  assert.equal(u.searchParams.get('zoom'), '13');
  assert.equal(u.searchParams.get('style'), 'feature:poi.business|visibility:off');
  assert.match(u.searchParams.get('path'), /^color:0xB5482DE6\|weight:4\|enc:/);
  assert.ok(!u.searchParams.has('key'));
});

test('staticMapRequest rejects bad input before anything is sent', async () => {
  const k = await kit();
  for (const s of [{ ...spec, width: 641 }, { ...spec, scale: 3 }, { ...spec, zoom: 22 }, { width: 10, height: 10 },
    { ...spec, paths: [{ polyline: '!!' }] }, { ...spec, paths: [{ points: [{ lat: 1, lng: 1 }], color: 'pink' }] },
    { ...spec, markers: [{ lat: 1, lng: 1, label: 'AB' }] }]) {
    assert.throws(() => k.staticMapRequest(s), (e) => e.code === 'BAD_INPUT', JSON.stringify(s).slice(0, 80));
  }
});

test('long paths are shortened under the URL limit and the notes say how', async () => {
  const k = await kit();
  const pts = Array.from({ length: 3000 }, (_, i) => ({ lat: 40 + i * 1e-4 + (i % 7) * 3e-5, lng: -74 + Math.sin(i / 30) * 1e-2 }));
  const r = k.staticMapRequest({ width: 200, height: 200, paths: [{ points: pts }] }, { maxChars: 4000 });
  assert.ok(r.url.length <= 4000);
  assert.ok(r.notes.length >= 1);
  assert.equal(r.pixelWidth, 400);
});

test('encodePolyline and decodePolyline round-trip at precision 5', async () => {
  const k = await kit();
  const pts = [{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }];
  assert.equal(k.encodePolyline(pts), '_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.deepEqual(k.decodePolyline(k.encodePolyline(pts)), pts);
});

test('signing appends signature= last over path and query (Google URL-signing scheme)', async () => {
  const k = await kit();
  const u = k.staticMapUrl(spec) + '&key=' + KEY;
  const signed = k.signStaticMapUrl(u, 'dGVzdHNlY3JldA==');
  assert.match(signed, /&signature=[A-Za-z0-9_-]+=*$/);
  assert.equal(k.signStaticMapUrl(u, 'dGVzdHNlY3JldA=='), signed, 'deterministic');
  assert.throws(() => k.signStaticMapUrl(k.staticMapUrl(spec), 'x'), /after adding key/);
});

test('staticMap sends the key only on the wire, counts one unit and returns PNG bytes', async () => {
  const { k, transport, ledger, maps } = await setup();
  assert.equal(maps.hasStaticKey(), true);
  const r = await maps.staticMap(spec);
  assert.equal(r.contentType, 'image/png');
  assert.equal(r.bytes.subarray(1, 4).toString(), 'PNG');
  assert.equal(r.sku, k.STATIC_MAPS_SKU);
  assert.ok(!r.url.includes(KEY), 'returned URL carries no key');
  assert.equal(new URL(transport.calls[0].url).searchParams.get('key'), KEY);
  assert.equal(units(ledger, k.STATIC_MAPS_SKU), 1);
});

test('staticMap without a key refuses with NO_KEY and sends and counts nothing', async () => {
  const { k, transport, ledger, maps } = await setup({ noKey: true });
  assert.equal(maps.hasStaticKey(), false);
  await assert.rejects(maps.staticMap(spec), (e) => e.code === 'NO_KEY');
  assert.equal(transport.calls.length, 0);
  assert.equal(units(ledger, k.STATIC_MAPS_SKU), 0);
});

test('an error answer never echoes the key', async () => {
  const { maps } = await setup({}, (req) => ({ status: 403, contentType: 'text/plain', body: 'denied for ' + req.url }));
  await assert.rejects(maps.staticMap(spec), (e) => { assert.equal(e.code, 'AUTH'); assert.ok(!e.message.includes(KEY), e.message); return true; });
});

test('the ledger hard stop runs before a static map is sent', async () => {
  const { k, transport, maps } = await setup({ ceilings: { static_maps: 1 } });
  await maps.staticMap(spec);
  await assert.rejects(maps.staticMap(spec), (e) => e instanceof k.MapsBudgetError || e.code === 'BUDGET');
  assert.equal(transport.calls.length, 1);
});

test('placePhoto: media lookup then image download, one SKU unit, attribution passed through', async () => {
  const { k, transport, ledger, maps } = await setup();
  const r = await maps.placePhoto({ name: 'places/FixtureA/photos/PhotoB', authorAttributions: [{ displayName: 'A. Person', uri: 'https://maps.google.com/contrib/1' }] }, { maxWidthPx: 800 });
  assert.equal(r.contentType, 'image/png');
  assert.equal(r.authorAttributions[0].displayName, 'A. Person');
  assert.equal(transport.calls.length, 2);
  assert.match(transport.calls[0].url, /\/v1\/places\/FixtureA\/photos\/PhotoB\/media\?skipHttpRedirect=true&maxWidthPx=800$/);
  assert.equal(transport.calls[1].url.startsWith('https://photos.example.com/'), true);
  assert.equal(units(ledger, k.PHOTOS_SKU), 1);
  await assert.rejects(maps.placePhoto('not/a/photo'), (e) => e.code === 'BAD_INPUT');
  await assert.rejects(maps.placePhoto('places/A/photos/B', { maxWidthPx: 99999 }), (e) => e.code === 'BAD_INPUT');
});

test('real-length photo names (ids of ~450 characters) are accepted; over-long or odd ones are not', async () => {
  const { k, maps } = await setup();
  const long = 'places/ChIJ' + 'a'.repeat(16) + '/photos/' + 'AUc7tXy-_'.repeat(55);
  assert.ok(long.split('/photos/')[1].length > 400);
  assert.match(long, k.PHOTO_NAME_RE);
  const r = await maps.placePhoto(long, { maxWidthPx: 400 });
  assert.equal(r.contentType, 'image/png');
  assert.doesNotMatch('places/A/photos/' + 'x'.repeat(2001), k.PHOTO_NAME_RE);
  assert.doesNotMatch('places/A/photos/B?c=1', k.PHOTO_NAME_RE);
});

test('photos are in the IDs-only tier, so every Details mask already lists them', async () => {
  const k = await kit();
  for (const mask of Object.values(k.PLACE_DETAILS_MASKS)) assert.ok(mask.split(',').includes('photos'), mask);
  assert.ok(k.STATIC_MAPS_SKU in k.SKUS && k.PHOTOS_SKU in k.SKUS);
});

// Developed by: LightAISolutions

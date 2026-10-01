'use strict';
// Maps kit — fixed field masks bill as declared; SKU table and ceilings; the usage ledger's hard stop and file format.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const kit = () => import('../kits/maps/index.mjs');

test('every fixed Places mask bills exactly the tier it is named for (plan fact 2)', async () => {
  const k = await kit();
  for (const [tier, mask] of Object.entries(k.PLACE_DETAILS_MASKS)) {
    assert.equal(k.highestTier(mask), tier, 'details ' + tier);
    assert.ok(mask.split(',').every((f) => k.fieldTier(f)), 'every field is known: ' + tier);
    assert.ok(k.PLACE_DETAILS_SKU[tier] in k.SKUS);
  }
  for (const [tier, mask] of Object.entries(k.TEXT_SEARCH_MASKS)) {
    assert.equal(k.highestTier(mask), tier, 'text search ' + tier);
    assert.ok(mask.split(',').includes('nextPageToken'));
    assert.ok(k.TEXT_SEARCH_SKU[tier] in k.SKUS);
  }
  for (const [tier, mask] of Object.entries(k.NEARBY_SEARCH_MASKS)) {
    assert.equal(k.highestTier(mask), tier, 'nearby search ' + tier);
    assert.ok(mask.split(',').every((f) => k.fieldTier(f)), 'every field is known: nearby ' + tier);
    assert.ok(!mask.split(',').includes('nextPageToken'), 'Nearby Search has no pagination');
    assert.ok(k.NEARBY_SEARCH_SKU[tier] in k.SKUS);
  }
  assert.deepEqual(Object.keys(k.NEARBY_SEARCH_MASKS), ['pro', 'enterprise', 'enterprise_atmosphere'], 'Nearby Search has no IDs-only or Essentials SKU');
  assert.ok(k.TEXT_SEARCH_MASKS.enterprise_atmosphere.split(',').includes('places.reviews'));
  assert.ok(k.AGGREGATE_SKU in k.SKUS);
  for (const t of ['enterprise', 'enterprise_atmosphere']) assert.equal(k.NEARBY_SEARCH_MASKS[t], k.TEXT_SEARCH_MASKS[t].replace(',nextPageToken', ''), 'Nearby and Text Search return places of the same shape: ' + t);
  assert.ok(!k.PLACE_DETAILS_MASKS.enterprise.includes('reviews'), 'reviews only in the Atmosphere mask');
  assert.ok(k.PLACE_DETAILS_MASKS.enterprise_atmosphere.includes('reviews'));
  for (const f of ['reviewSummary', 'editorialSummary', 'generativeSummary', 'priceRange', 'regularOpeningHours', 'websiteUri']) assert.ok(k.PLACE_DETAILS_MASKS.enterprise_atmosphere.split(',').includes(f), 'atmosphere details carry ' + f);
  assert.ok(Object.isFrozen(k.PLACE_DETAILS_MASKS) && Object.isFrozen(k.TEXT_SEARCH_MASKS) && Object.isFrozen(k.NEARBY_SEARCH_MASKS));
});

test('default ceilings sit at or below every free cap; overrides are validated', async () => {
  const k = await kit();
  for (const [sku, s] of Object.entries(k.SKUS)) assert.ok(k.DEFAULT_CEILINGS[sku] <= s.free, sku);
  assert.equal(k.DEFAULT_CEILINGS['places.details.enterprise'], 800);
  assert.deepEqual(['places.nearby_search.pro', 'places.nearby_search.enterprise', 'places.nearby_search.enterprise_atmosphere', 'places.text_search.enterprise_atmosphere', 'places.aggregate.compute_insights'].map((s) => [k.SKUS[s].free, k.SKUS[s].usdPer1000, k.DEFAULT_CEILINGS[s]]),
    [[5000, 32, 4000], [1000, 35, 800], [1000, 40, 800], [1000, 40, 800], [5000, 10, 4000]], 'Gem Funnel SKUs: free cap, list price, 80 % ceiling');
  assert.deepEqual(k.resolveCeilings(k.parseCeilingsEnv('places.nearby_search.enterprise=15,places.aggregate.compute_insights=0'))['places.aggregate.compute_insights'], 0, 'MAPS_SKU_CEILINGS covers the new names');
  assert.equal(k.resolveCeilings({ 'places.details.enterprise': 5 })['places.details.enterprise'], 5);
  assert.throws(() => k.resolveCeilings({ 'nope.sku': 1 }), /unknown SKU/);
  assert.throws(() => k.resolveCeilings({ 'places.details.pro': -1 }), /non-negative/);
  assert.deepEqual(k.parseCeilingsEnv('places.details.pro=10, routes.compute_routes.pro=2'), { 'places.details.pro': 10, 'routes.compute_routes.pro': 2 });
  assert.equal(k.estimateUsd('places.details.enterprise', 10, 995), (5 / 1000) * 20);
  assert.equal(k.estimateUsd('places.details.enterprise', 10, 0), 0);
});

test('month keys follow the Pacific billing month by default', async () => {
  const k = await kit();
  assert.equal(k.monthKey(new Date('2026-11-01T03:00:00Z')), '2026-10');
  assert.equal(k.monthKey(new Date('2026-11-01T09:00:00Z')), '2026-11');
  assert.equal(k.monthKey(new Date('2026-11-01T03:00:00Z'), 'Etc/UTC'), '2026-11');
});

test('ledger: counts units per SKU, refuses BEFORE passing the ceiling, and persists atomically to the named file', async () => {
  const k = await kit();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maps-ledger-'));
  const file = path.join(dir, 'usage', 'ledger.json');
  let now = new Date('2026-10-15T12:00:00Z');
  const led = k.createLedger({ path: file, ceilings: { 'places.details.enterprise': 2, 'routes.route_matrix.essentials': 10 }, now: () => now });
  assert.equal(led.reserve('places.details.enterprise'), 1);
  assert.equal(led.reserve('places.details.enterprise'), 2);
  assert.throws(() => led.reserve('places.details.enterprise'), (e) => e.code === 'SKU_CEILING' && e.used === 2 && e.ceiling === 2 && e.month === '2026-10');
  assert.equal(led.reserve('routes.route_matrix.essentials', 9), 9);
  assert.throws(() => led.reserve('routes.route_matrix.essentials', 2), k.MapsBudgetError);
  led.markFailed('places.details.enterprise');
  // a second process reading the same file sees the same counts
  const again = k.createLedger({ path: file, ceilings: { 'places.details.enterprise': 2 }, now: () => now });
  assert.equal(again.remaining('places.details.enterprise'), 0);
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(doc.kind, 'maps-usage-ledger');
  assert.deepEqual(doc.months['2026-10']['places.details.enterprise'], { units: 2, requests: 2, failed: 1 });
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['ledger.json'], 'no temp files left behind');
  // a new billing month starts from zero
  now = new Date('2026-11-15T12:00:00Z');
  assert.equal(again.reserve('places.details.enterprise'), 1);
  const u = again.usage();
  assert.equal(u.month, '2026-11');
  assert.equal(u.skus.length, Object.keys(k.SKUS).length);
  assert.throws(() => led.reserve('places.unknown'), /unknown SKU/);
  fs.writeFileSync(file, '{"v":2}');
  assert.throws(() => k.createLedger({ path: file }).usage(), /not a v1/);
});

test('a ceiling of 0 blocks a SKU entirely', async () => {
  const k = await kit();
  const led = k.createLedger({ ceilings: { 'places.details.enterprise_atmosphere': 0 } });
  assert.throws(() => led.reserve('places.details.enterprise_atmosphere'), /SKU_CEILING|ceiling/);
});

// Developed by: LightAISolutions

'use strict';
// packs/tour-guide/estimator — buildEstimate() on the research kit's durationRange(), chooseMinutes() with pace,
// interest and calibration factors, 5-minute rounding and clamps, and bounded, reversible calibration taps.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = () => import('../packs/tour-guide/estimator/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');

const PID = 'FixtureEstimatorPlace01';
const src = (ref, host) => ({ url: `https://${host}.example.org/page`, title: host, accessed: '2027-04-01', ref });

test('category defaults are the contract table; unknown categories fall back to "other"', async () => {
  const e = await E();
  assert.deepEqual({ ...e.CATEGORY_DEFAULTS }, { museum: 120, viewpoint: 30, market: 60, hike: 180, park: 60, church: 30, neighbourhood: 90, restaurant: 75, cafe: 30, shop: 45, other: 60 });
  assert.equal(e.categoryDefault('museum'), 120);
  assert.equal(e.categoryDefault('aquarium'), 60);
});

test('buildEstimate: two publishers → confirmed range, chosen = typical, valid VisitEstimate', async () => {
  const e = await E(), s = await S();
  const est = e.buildEstimate({
    place_id: PID, activity: 'museum highlights', category: 'museum', now: new Date('2027-04-02T15:00:00Z'),
    mentions: [{ min: 90, max: 120, ref: 'L001', source_key: 'guide' }, { min: 60, max: 120, ref: 'L002', source_key: 'notes' }],
    sources: [src('L001', 'guide'), src('L002', 'notes')]
  });
  assert.deepEqual(est.range, { min: 75, max: 120 });
  assert.equal(est.typical, 100);
  assert.equal(est.chosen_minutes, 100);
  assert.equal(est.confidence, 'confirmed');
  assert.equal(est.estimated_on, '2027-04-02');
  assert.equal(est.calibration, null);
  assert.deepEqual(s.validate(est, 'visit-estimate').errors, []);
});

test('buildEstimate: one publisher, conflicting spread, nothing usable, injection-suspect mentions', async () => {
  const e = await E();
  const base = { place_id: PID, activity: 'a', category: 'viewpoint', now: '2027-04-02' };
  const one = e.buildEstimate({ ...base, mentions: [{ min: 20, max: 30, ref: 'L1', source_key: 'a' }, { min: 30, max: 30, ref: 'L2', source_key: 'a' }] });
  assert.equal(one.confidence, 'single-source');
  const far = e.buildEstimate({ ...base, mentions: [{ min: 20, max: 30, ref: 'L1', source_key: 'a' }, { min: 120, max: 150, ref: 'L2', source_key: 'b' }] });
  assert.equal(far.confidence, 'conflicting');
  const none = e.buildEstimate({ ...base, mentions: [] });
  assert.deepEqual([none.range, none.typical, none.chosen_minutes, none.confidence], [null, null, 30, 'unverified']);
  const flagged = e.buildEstimate({
    ...base, mentions: [{ min: 20, max: 30, ref: 'L1', source_key: 'a' }, { min: 600, max: 700, ref: 'L2', source_key: 'b', injection_suspect: true }],
    sources: [src('L1', 'a'), src('L2', 'b'), { url: 'https://c.example.org/x', accessed: '2027-04-01' }]
  });
  assert.equal(flagged.confidence, 'single-source', 'the flagged mention never counts');
  assert.deepEqual(flagged.sources.map((x) => x.url), ['https://a.example.org/page', 'https://c.example.org/x'], 'a flagged source is not cited');
  assert.throws(() => e.buildEstimate({ ...base, place_id: 'bad id' }), /place_id/);
  assert.throws(() => e.buildEstimate({ ...base, category: 'Museum' }), /category/);
  assert.throws(() => e.buildEstimate({ ...base, sources: [{ url: 'ftp://x.example.org', accessed: '2027-01-01' }] }), /sources\[0\]\.url/);
});

test('chooseMinutes: pace × interest × calibration, rounded to 5, clamped to [max(15, ½·min), 2·max]', async () => {
  const e = await E();
  const est = { range: { min: 60, max: 120 }, typical: 90, chosen_minutes: 90, category: 'museum', confidence: 'confirmed' };
  const plain = e.chooseMinutes({ estimate: est });
  assert.deepEqual(plain, { minutes: 90, min: 60, max: 120, confidence: 'confirmed', factors: { pace: 1, interest: 1, calibration: 1 } });
  const keen = e.chooseMinutes({ estimate: est, pace: 'relaxed', interest: 'high' });
  assert.equal(keen.minutes, 130, '90 × 1.15 × 1.25 = 129.4 → 130');
  assert.deepEqual(keen.factors, { pace: 1.15, interest: 1.25, calibration: 1 });
  const brisk = e.chooseMinutes({ estimate: est, pace: 'packed', interest: 'low' });
  assert.equal(brisk.minutes, 60, '90 × 0.85 × 0.8 = 61.2 → 60');
  assert.equal(e.chooseMinutes({ range: { min: 100, max: 100 }, typical: 100, category: 'museum', calibration: 0.3 }).minutes, 50, 'lower clamp ½·min');
  assert.equal(e.chooseMinutes({ range: { min: 10, max: 20 }, typical: 15, category: 'cafe', calibration: 3 }).minutes, 40, 'upper clamp 2·max');
  assert.equal(e.chooseMinutes({ range: { min: 10, max: 20 }, typical: 15, category: 'cafe', pace: 'packed', interest: 'low' }).minutes, 15, 'never below 15');
  const r = e.chooseMinutes({ range: { min: 45, max: 75 }, category: 'park' });
  assert.equal(r.minutes, 60, 'no typical → midpoint');
  assert.equal(r.confidence, 'unverified');
  for (const x of [plain, keen, brisk, r]) assert.ok(x.minutes % 5 === 0 && x.min <= x.minutes && x.minutes <= x.max);
});

test('chooseMinutes without a range uses the category default; interest can come from the profile', async () => {
  const e = await E();
  const d = e.chooseMinutes({ category: 'hike', pace: 'relaxed' });
  assert.deepEqual([d.minutes, d.min, d.max], [205, 205, 205], '180 × 1.15 = 207 → 205');
  const profile = { pace: 'normal', interests: { viewpoint: 'high' } };
  assert.equal(e.chooseMinutes({ category: 'viewpoint', profile }).minutes, 40, '30 × 1.25 = 37.5 → 40');
  assert.equal(e.chooseMinutes({ category: 'viewpoint', profile, interest: 'low' }).minutes, 25, 'explicit interest wins');
  assert.throws(() => e.chooseMinutes({ category: 'park', pace: 'fast' }), /pace must be one of/);
  assert.throws(() => e.chooseMinutes({ category: 'park', interest: 'medium' }), /interest must be one of/);
});

test('calibration: bounded to [0.7, 1.4], reversible, about-right counts without moving, inputs never mutated', async () => {
  const e = await E(), s = await S();
  const s0 = e.createCalibration();
  const s1 = e.applyTap(s0, { category: 'museum', tap: 'longer' });
  assert.deepEqual(s0, { v: 1, categories: {} }, 'input untouched');
  assert.equal(e.calibrationFactor(s1, 'museum'), 1.1);
  const s2 = e.applyTap(s1, { category: 'museum', tap: 'shorter' });
  assert.equal(e.calibrationFactor(s2, 'museum'), 1, 'a longer and a shorter tap cancel');
  assert.deepEqual(s2.categories.museum, { longer: 1, shorter: 1, about_right: 0, factor: 1 });
  let up = s0; for (let i = 0; i < 10; i++) up = e.applyTap(up, { category: 'hike', tap: 'longer' });
  assert.equal(e.calibrationFactor(up, 'hike'), 1.4);
  let down = s0; for (let i = 0; i < 10; i++) down = e.applyTap(down, { category: 'hike', tap: 'shorter' });
  assert.equal(e.calibrationFactor(down, 'hike'), 0.7);
  const ok = e.applyTap(e.applyTap(s1, { category: 'museum', tap: 'about-right' }), { category: 'park', tap: 'about-right' });
  assert.equal(e.calibrationFactor(ok, 'museum'), 1.1);
  assert.equal(e.calibrationFactor(ok, 'park'), 1);
  assert.equal(e.calibrationFactor(null, 'park'), 1);
  for (const st of [s1, s2, up, down, ok]) assert.deepEqual(s.validate(st, 'calibration').errors, []);
  assert.throws(() => e.applyTap(s0, { category: 'museum', tap: 'way-longer' }), /tap must be/);
  assert.throws(() => e.applyTap(s0, { category: 'Museum!', tap: 'longer' }), /bad category/);
  const est = { range: { min: 60, max: 120 }, typical: 90, chosen_minutes: 90, category: 'museum', confidence: 'confirmed' };
  assert.equal(e.chooseMinutes({ estimate: est, calibration: s1 }).minutes, 100, '90 × 1.1 = 99 → 100');
});

test('every fixture estimate feeds chooseMinutes with the fixture profile and an empty calibration', async () => {
  const e = await E();
  const f = await import('../packs/tour-guide/fixtures/index.mjs');
  for (const name of f.listFixtures()) {
    const fx = f.loadFixture(name);
    for (const est of fx.estimates) {
      const r = e.chooseMinutes({ estimate: est, pace: fx.profile.pace, profile: fx.profile, calibration: fx.calibration });
      assert.ok(Number.isInteger(r.minutes) && r.minutes >= 15 && r.minutes % 5 === 0, `${name} ${est.place_id}`);
      assert.equal(r.factors.calibration, 1);
    }
  }
});

// Developed by: LightAISolutions

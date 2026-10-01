'use strict';
// kits/brochure — the JSON Schema + semantic checks reject bad models with pointer paths; the fixture passes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const KIT = path.resolve(__dirname, '..', 'kits', 'brochure');
const fixture = () => JSON.parse(fs.readFileSync(path.join(KIT, 'fixtures', 'sample-trip.json'), 'utf8'));

test('the invented fixture validates, prepares, and is built from reserved domains only', async () => {
  const { validate, semanticErrors, prepare } = await import('../kits/brochure/index.mjs');
  const m = fixture();
  assert.deepEqual(validate(m), []);
  assert.deepEqual(semanticErrors(m), []);
  const p = prepare(m);
  assert.equal(p.days.length, 3);
  assert.ok(p.days.every((d) => d.timeline.length > 0 && d.stats.stops > 0));
  for (const u of JSON.stringify(m).match(/https?:\/\/[^"\s]+/g)) assert.match(u, /^https?:\/\/([a-z0-9-]+\.)*example\.(com|org)(\/|$)/, u);
});

test('schema errors carry JSON-pointer paths and a readable message', async () => {
  const { validate, formatErrors } = await import('../kits/brochure/index.mjs');
  const m = fixture();
  delete m.trip.title;
  m.days[0].stops[0].arrive = '25:99';
  m.places['tide-museum'].rating = 'five';
  m.unexpected = 1;
  const errs = validate(m);
  const text = formatErrors(errs);
  assert.match(text, /^\/trip: .*title/m);
  assert.match(text, /\/days\/0\/stops\/0\/arrive/);
  assert.match(text, /\/places\/tide-museum\/rating/);
  assert.match(text, /^\/unexpected: unknown field/m);
  assert.ok(errs.every((e) => typeof e.path === 'string' && e.path.startsWith('/') && e.message));
});

test('semantic checks: unknown place keys, days outside the trip, inverted times; prepare throws ModelError', async () => {
  const { semanticErrors, prepare, ModelError } = await import('../kits/brochure/index.mjs');
  const m = fixture();
  m.days[0].stops[1].place = 'nowhere';
  m.days[1].date = '2027-01-01';
  m.days[2].stops[0].depart = '06:00';
  const errs = semanticErrors(m);
  assert.match(errs.map((e) => e.path).join(' '), /\/days\/0\/stops\/1\/place .*\/days\/1\/date .*\/days\/2\/stops\/0/);
  assert.throws(() => prepare(m), (e) => e instanceof ModelError && e.errors.length === errs.length && /nowhere/.test(e.message));
  assert.throws(() => prepare({ version: 1, trip: {}, days: [], places: {} }), ModelError);
});

// Developed by: LightAISolutions

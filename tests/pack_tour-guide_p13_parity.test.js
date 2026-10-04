'use strict';
// TG-PHASE-13 coordinator step 2 (WP-13d REQUEST 3): the core's acknowledgement parse and the engine's grammar agree on
// what the owner asked for and where, on every case of the engine's grammar fixture marked `core_same` (invented towns).
// The core words the acknowledgement; the engine files the places. A drift between the two would acknowledge one search
// and file another.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const J = (v) => JSON.parse(JSON.stringify(v));

test('scout parse parity: tgScoutParse and parseScoutText give the same what and where on every core_same case', async () => {
  const { GRAMMAR } = await import('../packs/tour-guide/fixtures/p13d-scout/tg-fixture-p13d-scout.mjs');
  const { parseScoutText } = await import('../packs/tour-guide/scout/index.mjs');
  const { ctx } = H.loadGas({ pack: 'tour-guide', now: '2027-05-01T12:00:00Z' });
  const same = GRAMMAR.filter((c) => c.core_same);
  assert.ok(same.length >= 10, 'the fixture marks enough cases for the check to mean something');
  for (const c of same) {
    const core = J(ctx.tgScoutParse(c.text));
    const engine = parseScoutText(c.text);
    assert.deepEqual(core, { what: engine.what, where: engine.where }, c.text);
    assert.deepEqual({ what: engine.what, where: engine.where }, { what: c.what, where: c.where }, 'the engine still reads ' + c.text + ' as the fixture says');
  }
});

// Developed by: LightAISolutions

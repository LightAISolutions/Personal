'use strict';
// Tour Guide planner — Phase 13 (WP-13a): the old fixtures plan byte for byte as before. The hashes were taken from the
// planner before Phase 13 (origin/main at v01.63r). Only days with a hard end change (A8: the last leg leaves as late as
// the end allows), so those days are left out here and tested in pack_tour-guide_p13a_timing.test.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const BEFORE = {
  'transit-city': { plan: 'b9f531dac014d421' },
  'driving-loop': { plan: 'd2168e4207447754' },
  'hill-town': { plan: 'c62a943404d0fbe9' },
  'rehearsal-day': { plan: '600f20e246c40605' },
  'two-stays': { days: { '2027-11-08': '20587bd8067c56a4', '2027-11-09': '484edc618453585f', '2027-11-10': 'ebe018045e457e22', '2027-11-11': '8fb7a73b0eaaf0cd', '2027-11-12': 'eb3a5fde001bff11', '2027-11-13': '7cab644ed13fbe6d' } },
  'moving-day': { days: { '2027-10-18': '9a8a1328712e0e0a', '2027-10-19': '068e21450bce85cd' } }
};

test('old fixtures plan exactly as before Phase 13 (days with a hard end aside)', async () => {
  const F = await import('../packs/tour-guide/fixtures/index.mjs');
  const M = await import('../kits/maps/index.mjs');
  const P = await import('../packs/tour-guide/planner/index.mjs');
  for (const [name, want] of Object.entries(BEFORE)) {
    const fx = F.loadFixture(name);
    const maps = M.createMapsClient({ transport: M.createMockTransport(F.createFixtureResponder(fx)), ledger: M.createLedger() });
    const p = await P.planTrip({ ...fx, maps, build_id: 'p13a-' + name, now: '2027-10-01T09:00:00Z', seed: 7 });
    if (want.plan) assert.equal(h(p), want.plan, `${name}: the whole plan`);
    for (const [date, hash] of Object.entries(want.days || {})) assert.equal(h(p.days.find((d) => d.date === date)), hash, `${name} ${date}`);
  }
});

// Developed by: LightAISolutions

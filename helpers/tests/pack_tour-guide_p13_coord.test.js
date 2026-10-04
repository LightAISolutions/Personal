'use strict';
// TG-PHASE-13 coordinator wiring, on invented fixtures: a place whose own facts say its opening days vary is not read as
// closed when the journey clusters the candidates (WP-13b REQUEST 5).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  journey: await import('../packs/tour-guide/journey/index.mjs')
});
const CLOSED_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => d + ': Closed');
const FACTS = { checked: '2027-10-20', sources: [{ url: 'https://example.org/visit', title: 'Visit', accessed: '2027-10-20' }] };

test('journeyCandidates: facts.irregular keeps a place Google lists as closed open on every journey day (B7)', async () => {
  const L = await load();
  const fx = L.fixtures.loadFixture('two-stays');
  const p = fx.places.find((x) => ['candidate', 'scheduled', 'chosen'].includes(x.status) && x.opening_days !== 'irregular' && fx.snapshots.some((s) => s.place_id === x.place_id && s.location));
  assert.ok(p, 'the fixture has a plain candidate with a located snapshot');
  const snapshots = fx.snapshots.map((s) => (s.place_id === p.place_id ? { ...s, content: { ...s.content, hours: { periods: [], weekday_descriptions: CLOSED_WEEK } } } : s));
  const run = (facts) => {
    const places = fx.places.map((x) => (x.id === p.id ? { ...x, facts } : x));
    return L.journey.journeyCandidates({ trip: fx.trip, places, snapshots }).find((c) => c.id === p.id);
  };
  const plain = run({ ...FACTS });
  assert.ok(Object.values(plain.open).every((v) => v === false), 'without the flag, Google\'s "Closed" closes every day');
  const varies = run({ ...FACTS, irregular: true, irregular_note: 'Open days are posted each month' });
  assert.ok(Object.keys(varies.open).length > 0);
  assert.ok(Object.values(varies.open).every((v) => v === true), 'facts.irregular: no day is read as closed');
});

// Developed by: LightAISolutions

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

/* ---------------- The planner reads both new parts (TG-PHASE-13 coordinator wiring) ---------------- */
const loadPlanner = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await import('../packs/tour-guide/planner/index.mjs')
});
const NOW = '2027-10-01T09:00:00Z';
const D1 = '2027-10-18';
/** Plan the invented moving-day fixture after `mut(fx)`. */
async function planMoving(L, mut) {
  const fx = L.fixtures.loadFixture('moving-day');
  mut(fx);
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });
  return L.planner.planTrip({ ...fx, maps, build_id: 'p13-coord', now: NOW, seed: 7 });
}
const GARDEN = 'copperleaf-garden';
/** The garden's own facts say its days vary; Google lists it as closed every day. */
const variesAtGarden = (extra = {}) => (fx) => {
  const p = fx.places.find((x) => x.id === GARDEN);
  Object.assign(p, extra, { facts: { checked: '2027-09-28', sources: [{ url: 'https://copperleaf.example.org/visit', title: 'Visit', accessed: '2027-09-28' }], irregular: true, irregular_note: 'Open days are posted each month' } });
  const s = fx.snapshots.find((x) => x.place_id === p.place_id);
  s.content = { ...s.content, hours: { periods: [], weekday_descriptions: CLOSED_WEEK }, current_hours: null };
};
const stopOf = (plan, id) => plan.days.flatMap((d) => d.stops).find((s) => s.place === id);

test('planner: facts.irregular_note is the stop\'s check line; the place\'s own opening_note still comes first (B7)', async () => {
  const L = await loadPlanner();
  const varies = stopOf(await planMoving(L, variesAtGarden()), GARDEN);
  assert.ok(varies, 'a place whose own site says its days vary is planned although Google lists it as closed');
  assert.equal(varies.check_on_day, 'Open days are posted each month', 'its own words, not the default text');
  const noted = stopOf(await planMoving(L, variesAtGarden({ opening_note: 'Phone the gate before you go' })), GARDEN);
  assert.ok(noted);
  assert.equal(noted.check_on_day, 'Phone the gate before you go', 'opening_note first, then irregular_note, then the default');
});

const stayInTown = (fx) => {
  fx.trip.lodging = [{ ...fx.trip.lodging[0], to: '2027-10-21' }];
  fx.trip.day_overrides = fx.trip.day_overrides.filter((o) => o.date === D1);
};
const dinnerOn = (plan, date) => plan.days.find((d) => d.date === date).meals.find((m) => m.kind === 'dinner');

test('planner: the dinner pool gets the plan\'s day and the party\'s diet (A4, A5)', async () => {
  const L = await loadPlanner();
  const juniper = (fx) => fx.dinners.find((d) => d.id === 'juniper-table');
  const unchecked = await planMoving(L, (fx) => { stayInTown(fx); fx.profile.diet = 'vegetarian'; delete juniper(fx).facts.menu; });
  assert.equal(dinnerOn(unchecked, D1).at, 'juniper-table');
  assert.equal(dinnerOn(unchecked, D1).note, 'Juniper Table · menu not checked for vegetarian', 'the diet named, not "your diet"');
  const stale = await planMoving(L, (fx) => { stayInTown(fx); juniper(fx).facts.menu.checked = '2027-08-01'; });
  assert.equal(dinnerOn(stale, D1).note, 'Juniper Table · menu last checked 2027-08-01', 'checked 61 days before the plan\'s day');
  const current = await planMoving(L, stayInTown);
  assert.equal(dinnerOn(current, D1).note, 'Juniper Table', 'a menu checked three days before needs no caveat');
});

// Developed by: LightAISolutions

'use strict';
// Tour Guide planner — Phase 13 (WP-13a, A5 hours) on the invented moving-day fixture: a place's own facts older than
// FACTS_MAX_AGE_DAYS still set its times, judged on the plan's day (the trip-zone date of `now`); each stop or dinner
// using them carries an info warning, and the stop a check line. Reproduced (no warning at any age) before the fix.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadAll = async () => ({
  fixtures: await import('../packs/tour-guide/fixtures/index.mjs'),
  maps: await import('../kits/maps/index.mjs'),
  planner: await import('../packs/tour-guide/planner/index.mjs'),
  facts: await import('../packs/tour-guide/facts/index.mjs'),
  schemas: await import('../packs/tour-guide/schemas/index.mjs'),
  subset: await import('../kits/brochure/lib/validate.mjs')
});
const NOW = '2027-10-01T09:00:00Z';   // 20:00 on 1 Oct in the trip's zone (UTC+11)
const D1 = '2027-10-18';

/** moving-day with the temple's and every dinner's facts checked on `checked` (the dinners also get an own close). */
async function plan(L, checked, now = NOW) {
  const fx = L.fixtures.loadFixture('moving-day');
  fx.places.find((p) => p.id === 'ninefold-temple').facts.checked = checked;
  for (const d of fx.dinners) Object.assign(d.facts, { checked, close: '22:00' });
  const maps = L.maps.createMapsClient({ transport: L.maps.createMockTransport(L.fixtures.createFixtureResponder(fx)), ledger: L.maps.createLedger() });
  const p = await L.planner.planTrip({ ...fx, maps, build_id: 'p13a-facts-age', now, seed: 7 });
  for (const d of p.days) assert.deepEqual(L.subset.validate(d, L.schemas.loadSchema('day-plan')), [], `${d.date}: the day-plan schema accepts it`);
  return { plan: p, day: (date) => p.days.find((d) => d.date === date) };
}
const old = (d) => d.warnings.filter((w) => /^facts are old: /.test(w.text));

test('A5: facts checked 100 days before now still apply, with the warning on the stop and the dinner and the stop\'s check line', async () => {
  const L = await loadAll();
  assert.equal(L.facts.FACTS_MAX_AGE_DAYS, 90);
  const { day } = await plan(L, '2027-06-23');   // 100 days before 1 Oct
  const d = day(D1);
  const temple = d.stops.find((s) => s.place === 'ninefold-temple');
  assert.equal(temple.check_on_day, 'Hours last checked 2027-06-23 — check before you go');
  assert.equal(temple.last_entry, '15:30', 'its own facts still set its times');
  const dinner = d.meals.find((m) => m.kind === 'dinner');
  assert.deepEqual(old(d).map((w) => [w.severity, w.code, w.text, w.place]), [
    ['info', 'other', 'facts are old: Ninefold Temple, checked 2027-06-23', 'ninefold-temple'],
    ['info', 'other', 'facts are old: Juniper Table, checked 2027-06-23', dinner.at]]);
  assert.ok(d.warnings.some((w) => /its own site says it closes at 16:00/.test(w.text)), 'the place\'s own hours still win');
  const copper = d.stops.find((s) => s.place === 'copperleaf-garden');
  assert.equal(copper.check_on_day, undefined, 'a place without facts is untouched');
});

test('A5: facts checked 80 days before now give neither the warning nor the check line', async () => {
  const L = await loadAll();
  const { plan: p, day } = await plan(L, '2027-07-13');   // 80 days before 1 Oct
  for (const d of p.days) assert.deepEqual(old(d), [], `${d.date}: no old-facts warning`);
  assert.equal(day(D1).stops.find((s) => s.place === 'ninefold-temple').check_on_day, undefined);
});

test('A5: the age is judged on the trip-zone date of now', async () => {
  const L = await loadAll();
  // Checked 3 Jul: 90 days before 1 Oct (not old), 91 before 2 Oct (old). 14:00 UTC is already 2 Oct in the trip's zone.
  const utcDay = await plan(L, '2027-07-03', '2027-10-01T12:00:00Z');
  assert.deepEqual(old(utcDay.day(D1)), [], '23:00 on 1 Oct in the trip zone: 90 days');
  const zoneDay = await plan(L, '2027-07-03', '2027-10-01T14:00:00Z');
  assert.equal(old(zoneDay.day(D1)).length, 2, '01:00 on 2 Oct in the trip zone: 91 days');
});

test('A5: oldFactsDate counts only facts that set hours or length', async () => {
  const L = await loadAll();
  const f = (extra) => ({ checked: '2027-01-01', sources: [], ...extra });
  assert.equal(L.planner.oldFactsDate(f({ close: '17:00' }), '2027-10-01'), '2027-01-01');
  assert.equal(L.planner.oldFactsDate(f({ closed_weekdays: [1] }), '2027-10-01'), '2027-01-01');
  assert.equal(L.planner.oldFactsDate(f({ visit_minutes: { min: 30, max: 60 } }), '2027-10-01'), '2027-01-01');
  assert.equal(L.planner.oldFactsDate(f({ visit_minutes: { min: 30, max: 60 } }), '2027-10-01', { visit: false }), null, 'a booked length wins over the facts');
  assert.equal(L.planner.oldFactsDate(f({ menu: { checked: '2027-01-01', fits: 'yes' } }), '2027-10-01'), null, 'menus are not hours');
  assert.equal(L.planner.oldFactsDate(f({ close: '17:00' }), '2027-03-01'), null, 'fresh');
});

// Developed by: LightAISolutions

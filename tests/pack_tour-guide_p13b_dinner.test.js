'use strict';
// Tour Guide Phase 13 (WP-13b) — dinner menus that were never checked or were checked long ago (A4, A5 menus) and the
// local day of a check date (A15). Each test reproduces the fault first. Invented places only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dinner = () => import('../packs/tour-guide/planner/planner-dinner.mjs');
const facts = () => import('../packs/tour-guide/facts/index.mjs');

const TODAY = '2027-06-01';                      // the plan's day (the trip-zone date of `now`)
const DATES = ['2027-06-14', '2027-06-15', '2027-06-16'];
const LODGING = { lat: 40.0, lng: -70.0 };
const KM_LAT = 1 / 111.2;
const at = (km) => ({ lat: LODGING.lat + km * KM_LAT, lng: LODGING.lng });
const evening = (d) => [0, 1, 2, 3, 4, 5, 6].map((day) => ({ open: { day, hour: 17, minute: 0 }, close: { day, hour: 22, minute: 0 } }))[d];
const snap = (place_id, loc) => ({ build_id: 'b0', place_id, fetched_at: '2027-05-30T12:00:00.000Z', location: loc,
  content: { display_name: 'Fixture', address: 'Minibury', business_status: 'OPERATIONAL', hours: { periods: [0, 1, 2, 3, 4, 5, 6].map(evening), weekday_descriptions: [] }, current_hours: null, rating: null, review_count: null, website: null, maps_uri: null, time_zone: 'America/New_York' } });
const OWN = (menu) => ({ checked: '2027-05-20', sources: [{ url: 'https://table.example.org/', title: 'Own site', accessed: '2027-05-20' }], ...(menu ? { menu } : {}) });
/** Five dinner places, nearest first: unchecked, stale yes, current partly, current yes, current no. All status `candidate`. */
const PLACES = [
  { id: 'ash-table', km: 0.2, facts: OWN(null) },                                          // never checked
  { id: 'birch-kitchen', km: 0.4, facts: OWN({ checked: '2027-04-22', fits: 'yes' }) },   // checked 40 days before
  { id: 'cedar-room', km: 0.6, facts: OWN({ checked: '2027-05-25', fits: 'partly' }) },
  { id: 'dune-bistro', km: 0.8, facts: OWN({ checked: '2027-05-25', fits: 'yes' }) },
  { id: 'elm-grill', km: 0.1, facts: OWN({ checked: '2027-05-25', fits: 'no' }) }
].map((p, i) => ({ v: 1, id: p.id, place_id: `FixtureP13bDin0${i}`, name: p.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), category: 'restaurant', tags: [], status: 'candidate', activity: 'dinner', priority: 2, facts: p.facts, loc: at(p.km) }));
const SNAPS = new Map(PLACES.map((p) => [p.place_id, snap(p.place_id, p.loc)]));
const list = () => PLACES.map(({ loc, ...p }) => p);

/** A fake Maps client: every leg is a 10-minute drive. */
const MAPS = { computeRoutes: async () => ({ route: { durationSec: 600, distanceMeters: 2000, legs: [], warnings: [] } }) };
const TRIP = { timezone: 'America/New_York', bookings: [] };
/** Three evenings back at the lodging by 17:00, one per date, then addDinners → the dinner meal of each date. */
async function dinners(pool) {
  const { addDinners } = await dinner();
  const lodging = { placeId: 'FixtureP13bLodge1', lat: LODGING.lat, lng: LODGING.lng, name: 'Harbour Inn', id: 'lodging' };
  const built = DATES.map((date) => ({ day: { date, mode: 'DRIVE' }, evening: { ends: false, direct: false, last: null, lodging, finish: 17 * 60 }, dayPlan: { date, legs: [], free: [], meals: [], warnings: [], solver: { route_calls: 0 } } }));
  await addDinners({ built, pool, used: new Set(), exclude: new Set(), maps: MAPS, trip: TRIP, pace: { dinner: 60 } });
  return built.map((b) => b.dayPlan.meals.find((m) => m.kind === 'dinner') || null);
}

test('A4/A5: unchecked and stale menus rank after current ones within the same rank, and carry their notes; no stays excluded', async () => {
  const { prepareDinners } = await dinner();
  // without the plan's day (the planner's call as it stands): an unchecked menu still ranks after checked ones, nothing is judged stale
  const plain = prepareDinners(list(), { snapshots: SNAPS, dates: DATES });
  assert.ok(!plain.some((c) => c.id === 'elm-grill'), '`no` stays excluded');
  const before = await dinners(plain);
  assert.deepEqual(before.map((m) => m.at), ['birch-kitchen', 'dune-bistro', 'cedar-room'], 'no plan day: the old check counts as current; the unchecked place last');
  // after: the plan's day and the party's diet
  const pool = prepareDinners(list(), { snapshots: SNAPS, dates: DATES, today: TODAY, diet: 'vegetarian' });
  assert.deepEqual(pool.map((c) => [c.id, c.menu_rank]), [['ash-table', 2], ['birch-kitchen', 2], ['cedar-room', 1], ['dune-bistro', 0]]);
  const meals = await dinners(pool);
  assert.deepEqual(meals.map((m) => m.at), ['dune-bistro', 'cedar-room', 'ash-table'], 'a current yes, a current partly, then the nearest of the rest');
  assert.deepEqual(meals.map((m) => m.note), ['Dune Bistro', 'Cedar Room · the menu partly fits your diet', 'Ash Table · menu not checked for vegetarian']);
  // a menu checked 40 days before the plan's day reads "menu last checked"
  const stale = prepareDinners(list().filter((p) => p.id === 'birch-kitchen'), { snapshots: SNAPS, dates: DATES, today: TODAY, diet: 'vegetarian' });
  assert.equal((await dinners(stale))[0].note, 'Birch Kitchen · menu last checked 2027-04-22');
  // without a diet: "your diet"; a menu whose fit is unknown counts as not checked
  const unknown = list().filter((p) => p.id === 'cedar-room').map((p) => ({ ...p, facts: OWN({ checked: '2027-05-25', fits: 'unknown' }) }));
  const u = prepareDinners(unknown, { snapshots: SNAPS, dates: DATES, today: TODAY });
  assert.equal(u[0].menu_rank, 2);
  assert.equal((await dinners(u))[0].note, 'Cedar Room · menu not checked for your diet');
});

test('A4/A5: the menu order sits inside the owner\'s ranks — a stale pick still comes before a current "rest" place', async () => {
  const { prepareDinners } = await dinner();
  const picks = list().map((p) => (p.id === 'birch-kitchen' ? { ...p, status: 'chosen' } : p));
  const pool = prepareDinners(picks, { snapshots: SNAPS, dates: DATES, today: TODAY, diet: 'vegan' });
  const meals = await dinners(pool);
  assert.deepEqual(meals.map((m) => m.at), ['birch-kitchen', 'dune-bistro', 'cedar-room']);
  assert.equal(meals[0].note, 'Birch Kitchen · menu last checked 2027-04-22');
});

test('A4/A5: dinnerMenu — the menu group and the caveat', async () => {
  const { dinnerMenu } = await dinner();
  assert.deepEqual(dinnerMenu({ menu_fits: 'yes', menu_checked: '2027-05-02' }, { today: TODAY }), { rank: 0, caveat: null }, '30 days: current');
  assert.deepEqual(dinnerMenu({ menu_fits: 'yes', menu_checked: '2027-05-01' }, { today: TODAY }), { rank: 2, caveat: 'menu last checked 2027-05-01' }, '31 days: stale');
  assert.deepEqual(dinnerMenu({ menu_fits: 'partly', menu_checked: '2027-05-25' }, { today: TODAY }), { rank: 1, caveat: null });
  assert.deepEqual(dinnerMenu({ menu_fits: 'partly', menu_checked: '2027-03-01' }, { today: TODAY, diet: 'vegetarian' }), { rank: 2, caveat: 'menu last checked 2027-03-01' });
  assert.deepEqual(dinnerMenu(null, { diet: 'vegetarian' }), { rank: 2, caveat: 'menu not checked for vegetarian' });
  assert.deepEqual(dinnerMenu({ menu_fits: null, menu_checked: null }, {}), { rank: 2, caveat: 'menu not checked for your diet' });
  assert.deepEqual(dinnerMenu({ menu_fits: 'yes', menu_checked: '2027-01-01' }, {}), { rank: 0, caveat: null }, 'no plan day: age not judged');
});

// ---- A15: the local day of a check ------------------------------------------------------------------------------------

test('A15: dateOf and factsStale take the local day in a zone; without one, exactly as before', async () => {
  const { dateOf, factsStale } = await facts();
  const evening = '2027-06-01T02:30:00Z';      // 22:30 on 31 May in New York
  assert.equal(dateOf(evening), '2027-06-01', 'no zone: the UTC day, as before');
  assert.equal(dateOf(evening, 'America/New_York'), '2027-05-31');
  assert.equal(dateOf(new Date(evening), 'America/New_York'), '2027-05-31');
  assert.equal(dateOf(new Date(evening)), '2027-06-01');
  assert.equal(dateOf('2027-06-01', 'America/New_York'), '2027-06-01', 'a calendar date stays that date');
  assert.equal(dateOf('2027-05-31T20:00:00+09:00', 'Asia/Tokyo'), '2027-05-31');
  assert.equal(dateOf('2027-05-31T20:00:00+09:00'), '2027-05-31', 'no zone: its UTC day');
  assert.throws(() => dateOf(evening, 'Not/AZone'), /time zone/);
  const f = { checked: '2027-03-02', sources: [], menu: { checked: '2027-05-01', fits: 'yes' } };
  assert.deepEqual(factsStale(f, evening), { facts: true, menu: true, any: true, facts_age_days: 91, menu_age_days: 31 }, 'UTC day 1 June: the menu is 31 days old');
  assert.deepEqual(factsStale(f, evening, 'America/New_York'), { facts: false, menu: false, any: false, facts_age_days: 90, menu_age_days: 30 }, 'the evening of 31 May in New York');
});

// Developed by: LightAISolutions

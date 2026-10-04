'use strict';
// Tour Guide Phase 13 (WP-13b) — a conventional-line ride between two towns (A9) and the bloom seasons of roses and
// autumn-flowering cherries (A6). Each test reproduces the fault first. Invented places only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const rail = () => import('../packs/tour-guide/planner/planner-rail.mjs');
const season = () => import('../packs/tour-guide/season/index.mjs');

// ---- A9: between INTERCITY_KM and SHINKANSEN_KM is a conventional line ------------------------------------------------

test('A9: a ride of about 85 km in a straight line between two towns comes to 115–130 minutes with the waits', async () => {
  const { rideMinutes, RAIL } = await rail();
  for (const km of [80, 85, 90]) {
    const m = rideMinutes(km);
    assert.ok(m >= (km === 85 ? 115 : 105) && m <= (km === 85 ? 130 : 140), `${km} km → ${m} min (fault: about 90 min at 75 km/h)`);
  }
  // rising with distance across the whole band, and never below the old regional figure
  let prev = 0;
  for (let km = RAIL.INTERCITY_KM + 1; km <= RAIL.SHINKANSEN_KM; km += 7) {
    const m = rideMinutes(km);
    assert.ok(m > prev, `monotone at ${km} km`);
    assert.ok(m >= Math.ceil(RAIL.INTERCITY_EXTRA_MIN + ((km * RAIL.INTERCITY_DETOUR) / RAIL.REGIONAL_KMH) * 60), `${km} km: not faster than the old regional estimate`);
    prev = m;
  }
});

test('A9: city rides and rides past SHINKANSEN_KM keep their numbers', async () => {
  const { rideMinutes, RAIL } = await rail();
  // the formulas as they stood before this phase, for the bands this finding leaves alone
  const city = (km) => Math.ceil(RAIL.WAIT_MIN + km * RAIL.RIDE_DETOUR * RAIL.CITY_MIN_PER_KM + (km > RAIL.TRANSFER_KM ? RAIL.TRANSFER_MIN : 0));
  const fast = (km) => Math.ceil(RAIL.INTERCITY_EXTRA_MIN + ((km * RAIL.INTERCITY_DETOUR) / RAIL.SHINKANSEN_KMH) * 60);
  for (const km of [0.5, 3, 8, 15]) assert.equal(rideMinutes(km), city(km), `city ${km} km`);   // C15 (WP-15a, change R): city rides up to CITY_FULL_KM keep their numbers; 15–40 km is the new band below
  for (const km of [151, 200, 370, 600]) assert.equal(rideMinutes(km), fast(km), `high-speed ${km} km`);
  assert.ok(rideMinutes(370) > 140 && rideMinutes(370) < 190, 'the long-distance high-speed range holds');
  assert.deepEqual([RAIL.WAIT_MIN, RAIL.RIDE_DETOUR, RAIL.CITY_MIN_PER_KM, RAIL.TRANSFER_KM, RAIL.TRANSFER_MIN, RAIL.INTERCITY_KM, RAIL.INTERCITY_DETOUR, RAIL.REGIONAL_KMH, RAIL.SHINKANSEN_KM, RAIL.SHINKANSEN_KMH, RAIL.INTERCITY_EXTRA_MIN],
    [5, 1.3, 2, 6, 5, 40, 1.15, 75, 150, 170, 15], 'the existing calibration numbers stay');
});

// ---- R (Phase 15, WP-15a): a 15–40 km ride rises steadily from the city formula to the conventional line ----------------

// The two formulas as rideMinutes computed them before change R (city: up to INTERCITY_KM; conventional: above it).
const cityOld = (R, km) => Math.ceil(R.WAIT_MIN + km * R.RIDE_DETOUR * R.CITY_MIN_PER_KM + (km > R.TRANSFER_KM ? R.TRANSFER_MIN : 0));

test('R: the fault was a cliff at INTERCITY_KM (40 km cost 114 minutes, 41 km cost 70); now 40 km costs 68', async () => {
  const { rideMinutes, RAIL } = await rail();
  assert.equal(cityOld(RAIL, 40), 114, 'the city formula alone gave 114 minutes for 40 km (the fault)');
  assert.equal(rideMinutes(41), 70, '41 km is a conventional-line ride, unchanged');
  assert.equal(rideMinutes(40), 68, '40 km no longer costs more than 41 km');
  assert.ok(rideMinutes(35) <= 65, `a 35 km day trip reads about an hour (${rideMinutes(35)} min), not 101`);
});

test('R: CITY_FULL_KM is 15, and the band\'s pinned figures', async () => {
  const { rideMinutes, RAIL } = await rail();
  assert.equal(RAIL.CITY_FULL_KM, 15);
  const want = { 0.5: cityOld(RAIL, 0.5), 3: cityOld(RAIL, 3), 8: 31, 15: 49, 17: 49, 25: 50, 30: 56, 35: 62, 40: 68, 41: 70 };
  for (const [km, m] of Object.entries(want)) assert.equal(rideMinutes(Number(km)), m, `${km} km`);
});

test('R: across 0.5–150 km the minutes never fall, the 40 → 41 km step is at most 3, and no ride costs more than the city formula did', async () => {
  const { rideMinutes, RAIL } = await rail();
  let prev = 0;
  for (let i = 1; i <= 300; i++) {
    const km = i * 0.5, m = rideMinutes(km);
    assert.ok(m >= prev, `${km} km → ${m} min, below ${prev} at ${km - 0.5} km`);
    if (km <= RAIL.INTERCITY_KM) assert.ok(m <= cityOld(RAIL, km), `${km} km → ${m} min, more than the city formula's ${cityOld(RAIL, km)}`);
    prev = m;
  }
  assert.ok(rideMinutes(41) - rideMinutes(40) <= 3, `40 → 41 km: ${rideMinutes(40)} → ${rideMinutes(41)}`);
  assert.ok(rideMinutes(41) - rideMinutes(40) >= 0);
});

// ---- A6: roses through November; autumn-flowering cherries in October–December -----------------------------------------

const north = { lat: 41.2, lng: 9.0 }, south = { lat: -38.4, lng: 146.0 };
const garden = (name, location = north, extra = {}) => ({ name, category: 'garden', location, ...extra });
const NOV = ['2031-11-10', '2031-11-14'];

test('A6: a rose garden passes the season screen in November', async () => {
  const s = await season();
  assert.equal(s.outOfSeason(garden('Saltmere Rose Garden'), { dates: NOV }), false, 'fault: roses were cut at October');
  assert.equal(s.outOfSeason(garden('Saltmere Rose Garden'), { dates: ['2031-12-08'] }), true, 'December is still out');
  assert.equal(s.outOfSeason(garden('Saltmere Rose Garden'), { dates: ['2031-04-08'] }), true, 'April is still out');
  assert.equal(s.outOfSeason(garden('Saltmere Rose Garden', south), { dates: ['2031-05-10'] }), false, 'the southern May mirrors the northern November');
  assert.ok(s.BLOOM_MONTHS_NORTH.roses.includes(11));
});

test('A6: a cherry park fails in November unless it names an autumn-flowering cherry (English and the local terms)', async () => {
  const s = await season();
  assert.equal(s.outOfSeason(garden('Brackwater Cherry Park'), { dates: NOV }), true, 'a spring cherry park stays out in November');
  assert.equal(s.outOfSeason(garden('Brackwater Cherry Park'), { dates: ['2031-04-02'] }), false);
  for (const name of ['Brackwater Autumn Cherry Park', 'Brackwater Autumn-flowering Cherry Grove', 'Shikizakura Cherry Hill', 'Jugatsu-zakura Cherry Walk', '四季桜の丘', '十月桜の庭', '冬桜の里']) {
    assert.equal(s.outOfSeason(garden(name), { dates: NOV }), false, `${name}: autumn cherry in November`);
    assert.equal(s.outOfSeason(garden(name), { dates: ['2031-10-20'] }), false, `${name}: October`);
    assert.equal(s.outOfSeason(garden(name), { dates: ['2031-12-15'] }), false, `${name}: December`);
    assert.equal(s.outOfSeason(garden(name), { dates: ['2031-08-01'] }), true, `${name}: not in August`);
  }
  assert.equal(s.outOfSeason(garden('Brackwater Cherry Park', north, { tags: ['autumn cherry'] }), { dates: NOV }), false, 'a tag names it too');
  assert.equal(s.outOfSeason(garden('Brackwater Autumn Cherry Park', south), { dates: ['2031-05-10'] }), false, 'shifted six months in the south');
  assert.equal(s.autumnCherry(garden('Brackwater Cherry Park')), false);
  assert.equal(s.autumnCherry(garden('Brackwater Autumn Cherry Park')), true);
  // the trip's forecast still wins when it speaks for cherry
  const sheet = { bloom: [{ kind: 'cherry', status: 'past', note: 'Over' }] };
  assert.equal(s.outOfSeason(garden('Brackwater Autumn Cherry Park'), { dates: NOV, season: sheet }), true);
});

// Developed by: LightAISolutions

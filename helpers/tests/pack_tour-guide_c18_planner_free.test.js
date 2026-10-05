'use strict';
// Tour Guide planner — Contract C18 (WP-18b): free windows get a title and nearby saved / Later / shortlisted places
// (planner-free.mjs): the radius, the open time inside the window, the round trip, the cap, no repeats in a day, the
// anchor, the day's evening extras and determinism; and planTrip only adds them with `c18: true`. Invented data only.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = async () => ({
  free: await import('../packs/tour-guide/planner/planner-free.mjs'),
  geo: await import('../packs/tour-guide/planner/planner-geo.mjs')
});
const DATE = '2027-05-13';   // a Thursday
const KM_PER_DEG = (2 * Math.PI * 6371) / 360;
const STOP = { lat: 41.5, lng: 12.3 };
const LODGE = { id: 'fixture-lodge', name: 'Fixture Lodge', lat: 41.48, lng: 12.3 };
/** A point `km` north of `from` (straight line). */
const north = (km, from = STOP) => ({ lat: from.lat + km / KM_PER_DEG, lng: from.lng });
/** Periods for every weekday: [open, close] in HH, or 'always'. */
const periods = (h) => (h === 'always' ? [{ open: { day: 0, hour: 0, minute: 0 } }] : [0, 1, 2, 3, 4, 5, 6].map((day) => ({ open: { day, hour: h[0], minute: h[2] || 0 }, close: { day, hour: h[1], minute: h[3] || 0 } })));
const pid = (slug) => ('Fx' + slug.replace(/[^a-z0-9]/gi, '') + '000000').slice(0, 24);

/** A world: one stop, the lodging, and `spots` = [{ id, km, hours, status?, from? }]. */
function world(spots, { free = [{ start: '11:00', end: '15:00', note: 'free time near Stop A before lunch' }], extras = null } = {}) {
  const places = [{ v: 1, id: 'stop-a', place_id: pid('stop-a'), name: 'Stop A', category: 'museum', status: 'scheduled' }];
  const snapshots = new Map([[pid('stop-a'), { location: STOP, content: { business_status: 'OPERATIONAL', hours: { periods: periods([9, 17]), weekday_descriptions: [] } } }]]);
  for (const s of spots) {
    places.push({ v: 1, id: s.id, place_id: pid(s.id), name: s.name || s.id, category: 'gallery', status: s.status || 'saved-for-later', ...(s.facts ? { facts: s.facts } : {}) });
    snapshots.set(pid(s.id), { location: north(s.km, s.from || STOP), content: s.hours === null ? null : { business_status: 'OPERATIONAL', hours: { periods: periods(s.hours || [9, 20]), weekday_descriptions: [] } } });
  }
  const dayPlan = {
    date: DATE, stops: [{ place: 'stop-a', place_id: pid('stop-a'), arrive: '10:00', depart: '11:00' }],
    legs: [{ from: 'lodging', to: 'stop-a', depart_at: '09:30', arrive_at: '09:55' }, { from: 'stop-a', to: 'lodging', depart_at: '15:00', arrive_at: '15:25' }],
    meals: [], free: free.map((f) => ({ ...f })), ...(extras ? { extras } : {})
  };
  const day = { date: DATE, lodging_start: LODGE, lodging_end: LODGE };
  return { dayPlan, day, places, snapshots };
}
const refs = (r, i = 0) => r[i].options.map((o) => o.ref);

test('walk minutes: distance × 1.25 at 4.8 km/h, rounded up; constants as the contract states', async () => {
  const { free } = await load();
  assert.deepEqual({ ...free.FREE }, { MIN_WINDOW: 30, RADIUS_KM: 1.2, MIN_OPEN: 30, STAY_MIN: 20, ROUTE_FACTOR: 1.25, WALK_KMH: 4.8, MAX: 4, TITLE_MAX: 60 });
  assert.equal(free.freeWalkMinutes(0), 0);
  assert.equal(free.freeWalkMinutes(0.3), 5);     // 4.69 → 5
  assert.equal(free.freeWalkMinutes(1.2), 19);    // 18.75 → 19
  assert.equal(free.freeWalkMinutes(0.384), 6);   // exactly 6.0
});

test('radius: within 1.2 km in a straight line of the anchor, nearest first, with km and walk minutes', async () => {
  const { free } = await load();
  const w = world([{ id: 'far', km: 1.3 }, { id: 'edge', km: 1.15 }, { id: 'near', km: 0.3 }, { id: 'mid', km: 0.6, status: 'candidate' }]);
  const r = free.freeOptions({ ...w, later: new Set() });
  assert.equal(r.length, 1);
  assert.deepEqual(refs(r), ['near', 'mid', 'edge']);
  assert.deepEqual(r[0].options[0], { kind: 'saved', ref: 'near', name: 'near', km: 0.3, walk_min: 5, open: 'open until 20:00' });
  assert.equal(r[0].options[1].kind, 'shortlist');
  assert.equal(r[0].options[2].walk_min, free.freeWalkMinutes(1.15));
});

test('open at least 30 minutes inside the window; the open line says until when, from when, or all day', async () => {
  const { free } = await load();
  const w = world([
    { id: 'late-short', km: 0.2, hours: [14, 18, 45] },   // 14:45 → only 15 min inside 11:00–15:00
    { id: 'late-ok', km: 0.25, hours: [14, 20] },          // 60 min inside
    { id: 'closed-early', km: 0.3, hours: [8, 11, 0, 20] }, // 08:00–11:20 → 20 min inside
    { id: 'all-day', km: 0.35, hours: 'always' },
    { id: 'no-hours', km: 0.1, hours: null }                // unknown: never offered
  ]);
  const r = free.freeOptions({ ...w });
  assert.deepEqual(refs(r), ['late-ok', 'all-day']);
  assert.equal(r[0].options[0].open, 'open 14:00–20:00');
  assert.equal(r[0].options[1].open, 'open all day');
});

test('own facts win over the snapshot: a weekday the facts close is not offered', async () => {
  const { free } = await load();
  const w = world([{ id: 'facts-closed', km: 0.2, facts: { checked: '2027-04-01', closed_weekdays: [4] } }, { id: 'open', km: 0.4 }]);
  assert.deepEqual(refs(free.freeOptions({ ...w })), ['open']);
});

test('round trip: walk there and back plus 20 minutes must fit the window', async () => {
  const { free } = await load();
  // 45-minute window: 0.6 km = 10 min each way → 40 fits; 0.8 km = 13 min → 46 does not.
  const w = world([{ id: 'fits', km: 0.6 }, { id: 'too-far', km: 0.8 }], { free: [{ start: '11:00', end: '11:45', note: 'free time near Stop A before lunch' }] });
  // the open-time rule alone would take both: everything is open 09:00–20:00
  const r = free.freeOptions({ ...w });
  assert.deepEqual(refs(r), ['fits']);
});

test('at most 4 per window, none twice in a day, windows under 30 minutes untouched', async () => {
  const { free } = await load();
  const spots = Array.from({ length: 7 }, (_, i) => ({ id: `spot-${i}`, km: 0.1 + i * 0.1 }));
  const w = world(spots, { free: [{ start: '11:00', end: '13:00' }, { start: '13:00', end: '13:25' }, { start: '13:30', end: '15:00' }] });
  const r = free.freeOptions({ ...w });
  assert.deepEqual(r.map((x) => x.index), [0, 2], 'the 25-minute window gets nothing');
  assert.deepEqual(refs(r, 0), ['spot-0', 'spot-1', 'spot-2', 'spot-3']);
  assert.deepEqual(refs(r, 1), ['spot-4', 'spot-5', 'spot-6'], 'the next window takes the rest, never a repeat');
});

test('never offered: scheduled, rejected, the day\'s stops and meal places, the day\'s evening extras; Later items count', async () => {
  const { free } = await load();
  const w = world([{ id: 'sched', km: 0.1, status: 'scheduled' }, { id: 'rej', km: 0.1, status: 'rejected' }, { id: 'extra', km: 0.2 }, { id: 'in-later', km: 0.3, status: 'candidate' }, { id: 'chosen', km: 0.4, status: 'chosen' }],
    { extras: [{ kind: 'saved', ref: 'extra', name: 'extra', km: 0.2 }] });
  w.dayPlan.meals.push({ kind: 'lunch', start: '12:00', end: '13:00', at: 'chosen' });
  const r = free.freeOptions({ ...w, later: new Set(['in-later', 'rej']) });
  assert.deepEqual(r[0].options.map((o) => [o.ref, o.kind]), [['in-later', 'later']]);
});

test('the anchor is where the day stands: after the leg back to the lodging, places near the lodging', async () => {
  const { free } = await load();
  const w = world([{ id: 'by-stop', km: 0.3 }, { id: 'by-lodge', km: 0.3, from: LODGE }], { free: [{ start: '15:25', end: '19:00', note: 'back early; the rest of the day is free' }] });
  const r = free.freeOptions({ ...w });
  assert.deepEqual(refs(r), ['by-lodge']);
  assert.equal(r[0].title, 'Back early: free time near Fixture Lodge');
  // before any leg has arrived: the stop after the window
  const w2 = world([{ id: 'by-stop', km: 0.3 }, { id: 'by-lodge', km: 0.3, from: LODGE }], { free: [{ start: '09:00', end: '09:50', note: 'until Stop A opens at 10:00' }] });
  w2.dayPlan.legs[0] = { ...w2.dayPlan.legs[0], depart_at: '09:50', arrive_at: '09:58' };
  assert.deepEqual(refs(free.freeOptions({ ...w2 })), ['by-stop']);
});

test('titles: named after the window, at most 60 characters', async () => {
  const { free } = await load();
  const t = (note, name = 'Slate Museum') => free.freeTitle({ note }, name);
  assert.equal(t('before your 18:30 booking at Juniper Table'), 'Before your 18:30 booking');
  assert.equal(t('until Ember Hall opens at 10:00'), 'Until Ember Hall opens');
  assert.equal(t('until 15:00, a quieter time at Slate Museum'), 'Until 15:00, when Slate Museum is quieter');
  assert.equal(t('free time near Slate Museum before lunch'), 'Free time before lunch');
  assert.equal(t('free time near Juniper Table before dinner'), 'Free time before dinner');
  assert.equal(t('free time near Lark Hill before you leave for Harrowmere Central Station'), 'Before you leave for Harrowmere Central Station');
  assert.equal(t('time to spare near Harrowmere Central Station before 17:30'), 'Time to spare near Harrowmere Central Station');
  assert.equal(t('a free day: nothing planned'), 'A free day');
  assert.equal(t('Rest, or wander the old quay.'), 'Free time near Slate Museum');
  assert.equal(t(undefined, null), 'Free time');
  const long = t(`free time near X before you leave for ${'Very Long Station Name '.repeat(5)}`);
  assert.ok(long.length <= 60 && long.endsWith('…'), long);
});

test('deterministic: the same input gives the same output, whatever the order of the places', async () => {
  const { free } = await load();
  const spots = Array.from({ length: 6 }, (_, i) => ({ id: `p-${i}`, km: 0.5 }));   // all at the same distance: slug order
  const a = world(spots), b = world(spots.slice().reverse());
  const ra = free.freeOptions({ ...a }), rb = free.freeOptions({ ...b });
  assert.deepEqual(ra, rb);
  assert.deepEqual(refs(ra), ['p-0', 'p-1', 'p-2', 'p-3']);
  assert.deepEqual(free.freeOptions({ ...a }), ra);
});

test('applyFreeOptions: title on every listed window, options only when there are any', async () => {
  const { free } = await load();
  const w = world([{ id: 'near', km: 0.2 }], { free: [{ start: '11:00', end: '13:00' }, { start: '13:00', end: '15:00', note: 'x' }] });
  free.applyFreeOptions(w.dayPlan, free.freeOptions({ ...w }));
  assert.equal(w.dayPlan.free[0].title, 'Free time near Stop A');
  assert.equal(w.dayPlan.free[0].options.length, 1);
  assert.equal(w.dayPlan.free[1].title, 'Free time near Stop A');
  assert.equal('options' in w.dayPlan.free[1], false);
});

// Developed by: LightAISolutions

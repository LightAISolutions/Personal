'use strict';
// packs/tour-guide/later — named Later lists with reasons, one list per place, promote / demote that name the only
// days to re-plan, statuses, and no mutation of the caller's data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = () => import('../packs/tour-guide/later/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');
const F = () => import('../packs/tour-guide/fixtures/index.mjs');

function deepFreeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; }
const item = (place, code = 'day_full') => ({ place, place_id: 'Fixture' + place.replace(/-/g, ''), reason: `Reason for ${place}.`, code, added_on: '2027-05-01' });

test('createLists: "Didn\'t fit" and "Next time", both valid LaterLists', async () => {
  const l = await L(), s = await S();
  const lists = l.createLists('port-sorrel-spring-2027');
  assert.deepEqual(lists.map((x) => x.name), ["Didn't fit", 'Next time']);
  for (const x of lists) assert.deepEqual(s.validate(x, 'later-list').errors, []);
  assert.throws(() => l.createLists('Bad Trip'), /trip_id/);
});

test('addItem: default list by code, one list per place (re-adding moves it), named lists created, inputs untouched', async () => {
  const l = await L(), s = await S();
  const start = deepFreeze(l.createLists('t1'));
  const a = l.addItem(start, { ...item('alpha-hall'), from_date: '2027-05-12' });
  assert.equal(a[0].items[0].place, 'alpha-hall');
  assert.equal(a[0].items[0].from_date, '2027-05-12');
  assert.equal(start[0].items.length, 0);
  const b = l.addItem(deepFreeze(a), { ...item('alpha-hall', 'owner'), reason: 'Saved for next time.' });
  assert.deepEqual(b.map((x) => x.items.map((i) => i.place)), [[], ['alpha-hall']], 'moved to Next time');
  const c = l.addItem(b, { ...item('beta-park'), list: 'Rainy day' });
  assert.equal(c.length, 3);
  assert.deepEqual(c[2], { v: 1, trip_id: 't1', name: 'Rainy day', items: [item('beta-park')] });
  for (const x of c) assert.ok(s.validate(x, 'later-list').ok);
  assert.deepEqual(l.findItem(c, 'beta-park'), { list: 'Rainy day', index: 0, item: item('beta-park') });
  assert.throws(() => l.addItem(c, { ...item('gamma'), code: 'weather' }), /code must be one of/);
  assert.throws(() => l.addItem(c, { ...item('gamma'), reason: '' }), /reason/);
  assert.throws(() => l.addItem(c, { ...item('gamma'), added_on: 'today' }), /added_on/);
});

test('promote: off the list, back to candidate with a scheduled_hint, only that date re-planned', async () => {
  const l = await L(), s = await S(), f = await F();
  const fx = f.loadFixture('transit-city');
  const p = fx.places.find((x) => x.id === 'maritime-archive');
  let lists = l.addItem(l.createLists(fx.trip.id), { place: p.id, place_id: p.place_id, reason: 'Closed on Thursday.', code: 'closed_day', added_on: '2027-05-01', from_date: '2027-05-13' });
  const places = deepFreeze(l.setStatus(fx.places, p.id, 'saved-for-later'));
  const r = l.promote({ lists: deepFreeze(lists), places, place: p.id, to_date: '2027-05-14' });
  assert.deepEqual(r.affected_days, ['2027-05-14']);
  assert.equal(l.findItem(r.lists, p.id), null);
  const moved = r.places.find((x) => x.id === p.id);
  assert.deepEqual([moved.status, moved.scheduled_hint], ['candidate', { date: '2027-05-14' }]);
  assert.deepEqual(s.validate(moved, 'place').errors, []);
  assert.equal(places.find((x) => x.id === p.id).status, 'saved-for-later', 'input untouched');
  assert.throws(() => l.promote({ lists, places, place: 'nowhere', to_date: '2027-05-14' }), /unknown place/);
  assert.throws(() => l.promote({ lists, places, place: p.id, to_date: '14 May' }), /to_date/);
});

test('demote: the stop leaves its day (only that date re-planned), saved-for-later, listed with its reason', async () => {
  const l = await L(), s = await S(), f = await F();
  const fx = f.loadFixture('transit-city');
  const places = deepFreeze(fx.places.map((p) => (p.id === 'lantern-museum' ? { ...p, status: 'scheduled', scheduled_hint: { date: '2027-05-12' } } : p)));
  const days = deepFreeze([
    { date: '2027-05-12', stops: [{ place: 'lantern-museum' }] },
    { date: '2027-05-13', stops: [{ place: 'old-town-lanes' }] }
  ]);
  const r = l.demote({ lists: l.createLists(fx.trip.id), places, days, place: 'lantern-museum', reason: 'Owner: next trip.', added_on: '2027-05-02' });
  assert.deepEqual(r.affected_days, ['2027-05-12']);
  const it = l.findItem(r.lists, 'lantern-museum');
  assert.equal(it.list, 'Next time');
  assert.deepEqual(it.item, { place: 'lantern-museum', place_id: 'FixtureTcLanternMuseum', reason: 'Owner: next trip.', code: 'owner', added_on: '2027-05-02', from_date: '2027-05-12' });
  const p = r.places.find((x) => x.id === 'lantern-museum');
  assert.equal(p.status, 'saved-for-later');
  assert.ok(!('scheduled_hint' in p));
  assert.ok(s.validate(p, 'place').ok);
  const full = l.demote({ lists: r.lists, places: r.places, days, place: 'old-town-lanes', reason: 'Day too long.', code: 'day_full', added_on: '2027-05-02' });
  assert.deepEqual(full.affected_days, ['2027-05-13']);
  assert.equal(l.findItem(full.lists, 'old-town-lanes').list, "Didn't fit");
  const none = l.demote({ lists: full.lists, places: full.places, days, place: 'signal-hill-lookout', reason: 'Not this time.', added_on: '2027-05-02' });
  assert.deepEqual(none.affected_days, [], 'a place in no day plan changes no day');
});

test('setStatus: one place changes, unknown slugs and statuses are refused', async () => {
  const l = await L(), f = await F();
  const places = deepFreeze(f.loadFixture('driving-loop').places);
  const out = l.setStatus(places, 'seal-cove', 'rejected');
  assert.equal(out.find((p) => p.id === 'seal-cove').status, 'rejected');
  assert.equal(out.filter((p) => p.status === 'candidate').length, places.length - 1);
  assert.throws(() => l.setStatus(places, 'seal-cove', 'maybe'), /status must be one of/);
  assert.throws(() => l.setStatus(places, 'nowhere', 'rejected'), /unknown place/);
});

// Developed by: LightAISolutions

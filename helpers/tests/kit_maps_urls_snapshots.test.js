'use strict';
// Maps kit — Maps URL builder (encoding, place ids, waypoints) and GoogleSnapshot retention classes + purge.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const kit = () => import('../kits/maps/index.mjs');

test('directionsUrl: api=1, encoded text, place ids, travel mode, %7C-joined waypoints', async () => {
  const k = await kit();
  const u = k.directionsUrl({
    origin: { name: 'Velmora Lantern Museum', placeId: 'FixtureVelmoraMuseum01' },
    destination: { name: 'Old Signal Tower & Steps', placeId: 'FixtureVelmoraTower02' },
    waypoints: [{ name: 'Café Ñandú', placeId: 'FixtureCafe03' }, { name: 'Harbour/Steps', placeId: 'FixtureSteps04' }],
    travelMode: 'WALK'
  });
  assert.equal(u, 'https://www.google.com/maps/dir/?api=1&origin=Velmora%20Lantern%20Museum&origin_place_id=FixtureVelmoraMuseum01&destination=Old%20Signal%20Tower%20%26%20Steps&destination_place_id=FixtureVelmoraTower02&travelmode=walking&waypoints=Caf%C3%A9%20%C3%91and%C3%BA%7CHarbour%2FSteps&waypoint_place_ids=FixtureCafe03%7CFixtureSteps04');
  for (const kv of u.split('?')[1].split('&')) assert.match(kv, /^[a-z_]+=[^ |&=]+$/, 'one key=value pair, no raw space or pipe: ' + kv);
  assert.equal(k.directionsUrl({ destination: { lat: 12.3456, lng: -45.6789 } }), 'https://www.google.com/maps/dir/?api=1&destination=12.3456%2C-45.6789');
  assert.match(k.directionsUrl({ destination: 'Tower Hill, Velmora', travelMode: 'TRANSIT', navigate: true }), /travelmode=transit&dir_action=navigate$/);
  // mixed waypoints: ids only when every waypoint has one
  assert.ok(!k.directionsUrl({ destination: 'X', waypoints: [{ name: 'A', placeId: 'FixtureA1' }, { name: 'B' }] }).includes('waypoint_place_ids'));
});

test('directionsUrl refuses transit waypoints, > 9 waypoints and unknown modes; dayUrl links a whole day', async () => {
  const k = await kit();
  assert.throws(() => k.directionsUrl({ destination: 'B', waypoints: ['A'], travelMode: 'transit' }), /transit/);
  assert.throws(() => k.directionsUrl({ destination: 'B', waypoints: Array(10).fill('A') }), /at most 9/);
  assert.throws(() => k.directionsUrl({ destination: 'B', travelMode: 'teleport' }), /unknown travelMode/);
  assert.throws(() => k.directionsUrl({}), /destination/);
  const d = k.dayUrl([{ name: 'Hotel Fixture' }, { name: 'Museum' }, { name: 'Tower' }], 'WALK');
  assert.equal(d, 'https://www.google.com/maps/dir/?api=1&origin=Hotel%20Fixture&destination=Tower&travelmode=walking&waypoints=Museum');
});

test('placeUrl: query text plus query_place_id', async () => {
  const k = await kit();
  assert.equal(k.placeUrl({ name: 'Velmora Lantern Museum', placeId: 'FixtureVelmoraMuseum01' }), 'https://www.google.com/maps/search/?api=1&query=Velmora%20Lantern%20Museum&query_place_id=FixtureVelmoraMuseum01');
  assert.equal(k.placeUrl({ lat: 1.5, lng: 2.25 }), 'https://www.google.com/maps/search/?api=1&query=1.5%2C2.25');
  assert.throws(() => k.placeUrl({}), /needs a name/);
});

test('toSnapshot keeps the plan §4.4 fields in three retention classes', async () => {
  const k = await kit();
  const s = k.toSnapshot(k.fixture('place-details-enterprise'), { buildId: 'b1', fetchedAt: '2026-10-01T10:00:00Z' });
  assert.equal(s.place_id, 'FixtureVelmoraMuseum01');
  assert.deepEqual(s.location, { lat: 12.3456, lng: -45.6789 });
  assert.equal(s.content.rating, 4.6);
  assert.equal(s.content.review_count, 812);
  assert.equal(s.content.business_status, 'OPERATIONAL');
  assert.equal(s.content.website, 'https://velmora-museum.example.com/');
  assert.equal(s.content.hours.weekday_descriptions.length, 7);
  assert.throws(() => k.toSnapshot({ id: 'x' }), /buildId/);
});

test('purge: content is build-scoped by default, records go after 30 days, the window cannot be widened', async () => {
  const k = await kit();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maps-snap-'));
  const file = path.join(dir, 'snapshots.json');
  const store = k.openSnapshotStore({ path: file });
  const place = k.fixture('place-details-enterprise');
  store.put(k.toSnapshot(place, { buildId: 'old', fetchedAt: '2026-08-25T00:00:00Z' }));
  store.put(k.toSnapshot(place, { buildId: 'recent', fetchedAt: '2026-09-30T00:00:00Z' }));
  store.put(k.toSnapshot(place, { buildId: 'now', fetchedAt: '2026-10-01T11:00:00Z' }));
  assert.equal(store.latest('FixtureVelmoraMuseum01').build_id, 'now');
  // a build that wants to keep its own content for a few hours passes contentMaxAgeHours explicitly
  let r = store.purge({ now: new Date('2026-10-01T12:00:00Z'), contentMaxAgeHours: 6 });
  assert.deepEqual(r, { dropped: 1, stripped: 1, kept: 2 });
  assert.ok(store.latest('FixtureVelmoraMuseum01', { buildId: 'now' }).content, 'fresh content kept inside the window');
  r = k.openSnapshotStore({ path: file }).purge({ now: new Date('2026-10-01T12:00:00Z') });
  assert.equal(r.stripped, 1, 'default: every purge strips content');
  const after = k.openSnapshotStore({ path: file }).all();
  assert.ok(after.every((x) => x.content === null && x.content_purged_at && x.location && x.place_id));
  r = k.openSnapshotStore({ path: file }).purge({ now: new Date('2026-11-05T00:00:00Z') });
  assert.deepEqual(r, { dropped: 2, stripped: 0, kept: 0 });
  assert.throws(() => store.purge({ latLngMaxDays: 31 }), /0–30/);
});

// Developed by: LightAISolutions

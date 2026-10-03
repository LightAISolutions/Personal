'use strict';
// packs/tour-guide/fixtures — the two invented trips validate, carry every edge case the planner must meet, use
// reserved domains only, and answer Place Details / Route Matrix / Compute Routes through the REAL Maps kit
// (createMapsClient + createMockTransport) with fixtureTravel() as the single source of truth.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = () => import('../packs/tour-guide/fixtures/index.mjs');
const S = () => import('../packs/tour-guide/schemas/index.mjs');
const K = () => import('../kits/maps/index.mjs');

const PART_KIND = { trip: 'trip', places: 'place', snapshots: 'google-snapshot', estimates: 'visit-estimate', notes: 'place-note', profile: 'profile-excerpt', calibration: 'calibration' };
const hhmm = (h, m) => String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Google weekday line "Monday: 9:00 AM – 12:30 PM, 2:00 PM – 5:00 PM" → { day, slots: ['09:00-12:30', …] | '24h' } */
function parseLine(line) {
  const [name, rest] = line.split(': ');
  const day = DAYS.indexOf(name);
  if (rest === 'Open 24 hours') return { day, slots: '24h' };
  if (rest === 'Closed') return { day, slots: [] };
  const t = (s) => { const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(s.trim()); let h = +m[1] % 12; if (m[3] === 'PM') h += 12; return hhmm(h, +m[2]); };
  return { day, slots: rest.split(', ').map((r) => r.split(' – ').map(t).join('-')) };
}
/** periods → per day 0..6 the same slot strings ('24h' for the always-open shape). */
function slotsFromPeriods(periods) {
  if (periods.length === 1 && !periods[0].close) return Array(7).fill('24h');
  const out = Array.from({ length: 7 }, () => []);
  for (const p of periods) out[p.open.day].push(`${hhmm(p.open.hour, p.open.minute)}-${hhmm(p.close.hour, p.close.minute)}`);
  return out;
}
const openWindows = (snap, date, weekdayOf) => {
  const h = snap.content.hours;
  if (!h) return null;
  return slotsFromPeriods(h.periods)[weekdayOf(date)];
};

async function client(fx) {
  const k = await K(), f = await F();
  const transport = k.createMockTransport(f.createFixtureResponder(fx));
  const ledger = k.createLedger();
  return { k, transport, ledger, maps: k.createMapsClient({ transport, ledger }) };
}

test('listFixtures / loadFixture: three fixtures, every part, fresh copies on each load', async () => {
  const f = await F();
  assert.deepEqual(f.listFixtures(), ['transit-city', 'driving-loop', 'hill-town']);
  const a = f.loadFixture('transit-city');
  assert.deepEqual(Object.keys(a), ['name', 'trip', 'places', 'snapshots', 'estimates', 'notes', 'profile', 'calibration', 'routes']);
  a.trip.title = 'changed';
  assert.notEqual(f.loadFixture('transit-city').trip.title, 'changed');
  assert.throws(() => f.loadFixture('moon-base'), /unknown fixture/);
});

test('every fixture entity validates against its schema; estimates for every place, notes for at least half', async () => {
  const f = await F(), s = await S();
  for (const name of f.listFixtures()) {
    const fx = f.loadFixture(name);
    for (const [part, kind] of Object.entries(PART_KIND)) {
      for (const [i, entity] of (Array.isArray(fx[part]) ? fx[part] : [fx[part]]).entries()) {
        assert.deepEqual(s.validate(entity, kind).errors, [], `${name} ${part}[${i}]`);
      }
    }
    const ids = fx.places.map((p) => p.place_id);
    assert.equal(new Set(fx.places.map((p) => p.id)).size, fx.places.length, 'unique keys');
    assert.deepEqual(fx.estimates.map((e) => e.place_id), ids, 'one estimate per place, same order');
    assert.ok(fx.notes.length * 2 >= fx.places.length, `${name}: notes for at least half the places`);
    assert.ok(fx.notes.every((n) => ids.includes(n.place_id)));
    const snapIds = new Set(fx.snapshots.map((x) => x.place_id));
    for (const id of ids.concat(fx.trip.lodging.map((l) => l.place_id))) assert.ok(snapIds.has(id), `${name}: snapshot for ${id}`);
    assert.ok(fx.places.every((p) => p.status === 'candidate'));
    assert.deepEqual(fx.calibration, { v: 1, categories: {} });
    const labels = new Set(fx.estimates.map((e) => e.confidence));
    assert.ok(labels.size >= 3, `${name}: mixed confidence (${[...labels]})`);
    assert.ok(Object.keys(fx.profile.interests).length >= 3 && Object.keys(fx.profile.interests).length <= 4);
    assert.equal(fx.profile.pace, fx.trip.pace);
  }
});

test('trip shape: transit-city 3 days / 1 lodging / TRANSIT / normal; driving-loop 4 days / A A B C / DRIVE / relaxed', async () => {
  const f = await F(), s = await S();
  const tc = f.loadFixture('transit-city').trip, dl = f.loadFixture('driving-loop').trip;
  for (const t of [tc, dl]) for (const d of s.tripDates(t)) assert.equal(s.lodgingsForNight(t, d).length, 1, `${t.id} night ${d}`);
  assert.equal(s.tripDates(tc).length, 3);
  assert.equal(tc.lodging.length, 1);
  assert.deepEqual([tc.modes.default, tc.modes.allowed, tc.pace], ['TRANSIT', ['TRANSIT', 'WALK'], 'normal']);
  assert.equal(s.tripDates(dl).length, 4);
  assert.deepEqual(s.tripDates(dl).map((d) => s.lodgingForNight(dl, d).id), ['brackenford-inn', 'brackenford-inn', 'gullhaven-lodge', 'marrow-bay-hotel']);
  assert.deepEqual([dl.modes.default, dl.pace], ['DRIVE', 'relaxed']);
  assert.deepEqual(s.tripDates(dl).map((d) => { const x = s.dayLodgings(dl, d); return `${x.start.id}>${x.end.id}`; }),
    ['brackenford-inn>brackenford-inn', 'brackenford-inn>brackenford-inn', 'brackenford-inn>gullhaven-lodge', 'gullhaven-lodge>marrow-bay-hotel']);
  for (const t of [tc, dl]) assert.ok(t.start_date.startsWith('2027-'));
});

test('snapshot hours: Google periods (day 0 = Sunday) and weekday lines say the same thing', async () => {
  const f = await F();
  for (const name of f.listFixtures()) {
    for (const snap of f.loadFixture(name).snapshots) {
      const h = snap.content.hours;
      if (!h) continue;
      assert.equal(h.weekday_descriptions.length, 7);
      assert.equal(h.weekday_descriptions[0].split(':')[0], 'Monday', 'Google lists Monday first');
      const fromPeriods = slotsFromPeriods(h.periods);
      for (const line of h.weekday_descriptions) {
        const { day, slots } = parseLine(line);
        assert.deepEqual(slots, fromPeriods[day], `${name} ${snap.place_id} ${line}`);
      }
    }
  }
});

test('transit-city edge cases: night market after day end, closed on a trip date, one booking, CLOSED_TEMPORARILY, hours unknown', async () => {
  const f = await F(), s = await S();
  const fx = f.loadFixture('transit-city');
  const snap = (id) => fx.snapshots.find((x) => x.place_id === fx.places.find((p) => p.id === id).place_id);
  const dates = s.tripDates(fx.trip);
  const dayEnd = toMin(fx.trip.day_end);
  const night = dates.map((d) => openWindows(snap('moonlight-night-market'), d, s.weekdayOf));
  assert.ok(night.some((w) => w.length), 'open on some trip date');
  assert.ok(night.every((w) => w.every((slot) => toMin(slot.split('-')[0]) >= dayEnd)), 'only ever opens at or after day_end');
  const closed = fx.places.filter((p) => { const sn = snap(p.id); return sn.content.hours && sn.content.hours.periods.length && dates.some((d) => !openWindows(sn, d, s.weekdayOf).length && openWindows(sn, d, s.weekdayOf) !== '24h'); });
  assert.ok(closed.map((p) => p.id).includes('maritime-archive'), 'closed on Thursday 2027-05-13');
  assert.deepEqual(openWindows(snap('maritime-archive'), '2027-05-13', s.weekdayOf), []);
  assert.ok(openWindows(snap('maritime-archive'), '2027-05-12', s.weekdayOf).length, 'but open another trip day');
  const booked = fx.places.filter((p) => p.booking);
  assert.equal(booked.length, 1);
  const b = booked[0].booking;
  assert.ok(dates.includes(b.date));
  assert.ok(openWindows(snap(booked[0].id), b.date, s.weekdayOf).some((slot) => { const [o, c] = slot.split('-').map(toMin); return o <= toMin(b.time) && toMin(b.time) < c; }), 'booking falls inside opening hours');
  assert.deepEqual(fx.snapshots.filter((x) => x.content.business_status === 'CLOSED_TEMPORARILY').map((x) => x.place_id), ['FixtureTcTramDepotGallery']);
  assert.deepEqual(fx.snapshots.filter((x) => !x.content.hours).map((x) => x.place_id), ['FixtureTcBluebellCeramicsStudio']);
  const cats = fx.places.map((p) => p.category);
  for (const c of ['museum', 'market', 'viewpoint', 'park', 'church']) assert.ok(cats.includes(c), c);
  assert.equal(cats.filter((c) => c === 'neighbourhood').length, 2);
  assert.ok(fx.places.length >= 12 && fx.places.length <= 14);
  const home = fx.trip.lodging[0];
  for (const x of fx.snapshots) assert.ok(f.haversineMeters(home, x.location) < 5000, `${x.place_id} within a few km`);
});

test('driving-loop edge cases: hike, viewpoint, two small towns, closed on a trip date, a far-off priority-3 place', async () => {
  const f = await F(), s = await S();
  const fx = f.loadFixture('driving-loop');
  const snapOf = (p) => fx.snapshots.find((x) => x.place_id === p.place_id);
  const dates = s.tripDates(fx.trip);
  const cats = fx.places.map((p) => p.category);
  assert.ok(cats.includes('hike') && cats.includes('viewpoint'));
  assert.equal(cats.filter((c) => c === 'neighbourhood').length, 2, 'two small towns');
  assert.ok(fx.places.length >= 12 && fx.places.length <= 16);
  const lighthouse = snapOf(fx.places.find((p) => p.id === 'gullhaven-lighthouse'));
  assert.deepEqual(openWindows(lighthouse, '2027-06-10', s.weekdayOf), [], 'closed Thursday 2027-06-10');
  assert.ok(openWindows(lighthouse, '2027-06-11', s.weekdayOf).length);
  const p3 = fx.places.filter((p) => p.priority === 3);
  assert.deepEqual(p3.map((p) => p.id), ['northcape-sea-stacks']);
  const far = snapOf(p3[0]).location;
  for (const l of fx.trip.lodging) assert.ok(f.haversineMeters(l, far) > 150000, `150+ km from ${l.id}`);
  const near = fx.places.filter((p) => p.priority !== 3).map((p) => snapOf(p).location);
  for (const loc of near) assert.ok(fx.trip.lodging.some((l) => f.haversineMeters(l, loc) < 60000), 'on the loop');
  const L = fx.trip.lodging;
  assert.ok(f.haversineMeters(L[0], L[1]) > 20000 && f.haversineMeters(L[1], L[2]) > 20000, 'lodgings tens of km apart');
  assert.ok(dates.length === 4);
});

test('reserved domains only, invented ids, no e-mail addresses in any fixture file', async () => {
  const f = await F();
  for (const name of f.listFixtures()) {
    const dir = path.join(f.FIXTURES_DIR, name);
    for (const file of fs.readdirSync(dir)) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      assert.ok(file.startsWith(`tg-fixture-${name}-`), file);
      for (const u of text.match(/https?:\/\/[^"\s]+/g) || []) assert.match(u, /^https:\/\/([a-z0-9-]+\.)*example\.(com|org|net)(\/|$)/, `${file}: ${u}`);
      assert.ok(!text.includes('@'), `${file}: no e-mail`);
      for (const id of text.match(/"place_id": "[^"]+"/g) || []) assert.match(id, /"Fixture(Tc|Dl|Ht)[A-Za-z]+"/, `${file}: ${id}`);
    }
  }
});

test('fixtureTravel: table, reverse twin, haversine fallback, zero to itself, symmetric-ish, unknown id', async () => {
  const f = await F();
  const tc = f.loadFixture('transit-city');
  const L0 = tc.trip.lodging[0].place_id;
  const key = Object.keys(tc.routes.modes.TRANSIT).find((k) => tc.routes.modes.TRANSIT[k].line);
  const [a, b] = key.split('|');
  const row = tc.routes.modes.TRANSIT[key];
  assert.deepEqual(f.fixtureTravel(tc, 'TRANSIT', a, b), { durationSec: row.duration_sec, distanceMeters: row.distance_m, line: row.line });
  assert.match(row.line, /^(Line \d|Tram \d)$/);
  assert.deepEqual(f.fixtureTravel(tc, 'WALK', L0, L0), { durationSec: 0, distanceMeters: 0 });
  // An untabled pair falls back to great-circle × 1.3 at the fallback speed plus overhead.
  const sig = 'FixtureTcSignalHillLookout', bot = 'FixtureTcTidewaterBotanicGarden';
  assert.ok(!tc.routes.modes.TRANSIT[`${sig}|${bot}`] && !tc.routes.modes.TRANSIT[`${bot}|${sig}`]);
  const gc = f.haversineMeters(f.snapshotFor(tc, sig).location, f.snapshotFor(tc, bot).location);
  const dist = Math.round(gc * 1.3);
  assert.deepEqual(f.fixtureTravel(tc, 'TRANSIT', sig, bot), { durationSec: Math.round((dist / 1000 / 14) * 3600 + 420), distanceMeters: dist });
  // The reverse twin: drop one direction and the other answers for both.
  const twin = f.loadFixture('transit-city');
  delete twin.routes.modes.TRANSIT[`${b}|${a}`];
  assert.deepEqual(f.fixtureTravel(twin, 'TRANSIT', b, a), f.fixtureTravel(twin, 'TRANSIT', a, b));
  for (const name of f.listFixtures()) {
    const fx = f.loadFixture(name);
    const ids = fx.snapshots.map((x) => x.place_id);
    for (const mode of fx.trip.modes.allowed) for (const x of ids) for (const y of ids) {
      if (x >= y) continue;
      const there = f.fixtureTravel(fx, mode, x, y).durationSec, back = f.fixtureTravel(fx, mode, y, x).durationSec;
      assert.ok(there > 0 && back / there > 0.75 && back / there < 1.33, `${name} ${mode} ${x}↔${y}: ${there}/${back}`);
    }
    for (const k of Object.keys(fx.routes.modes.TRANSIT).concat(Object.keys(fx.routes.modes.WALK), Object.keys(fx.routes.modes.DRIVE))) {
      for (const id of k.split('|')) assert.ok(ids.includes(id), `${name}: tabled id ${id}`);
    }
  }
  assert.throws(() => f.fixtureTravel(tc, 'TRANSIT', L0, 'FixtureNowhere'), (e) => e.code === 'NOT_FOUND');
  assert.throws(() => f.fixtureTravel(tc, 'BICYCLE', L0, L0), (e) => e.code === 'BAD_INPUT');
});

test('Place Details through the real Maps kit round-trips every snapshot (toSnapshot of the answer = the fixture)', async () => {
  const f = await F();
  for (const name of f.listFixtures()) {
    const fx = f.loadFixture(name);
    const { k, transport, ledger, maps } = await client(fx);
    for (const snap of fx.snapshots) {
      const { place, sku } = await maps.placeDetails(snap.place_id, { tier: 'enterprise' });
      assert.equal(sku, 'places.details.enterprise');
      assert.deepEqual(k.toSnapshot(place, { buildId: snap.build_id, fetchedAt: snap.fetched_at }), snap, `${name} ${snap.place_id}`);
    }
    assert.equal(transport.calls.length, fx.snapshots.length);
    assert.equal(ledger.usage().skus.find((r) => r.sku === 'places.details.enterprise').units, fx.snapshots.length);
    const { place } = await maps.placeDetails(fx.snapshots[1].place_id, { tier: 'essentials' });
    assert.deepEqual(Object.keys(place).sort(), ['formattedAddress', 'id', 'location'], 'the field mask is honoured');
  }
});

test('Route Matrix 2×2 through the kit: every element equals fixtureTravel', async () => {
  const f = await F();
  const fx = f.loadFixture('transit-city');
  const { maps, transport } = await client(fx);
  const ids = [fx.trip.lodging[0].place_id, fx.places[0].place_id];
  const others = [fx.places[3].place_id, fx.places[0].place_id];
  const r = await maps.computeRouteMatrix({ origins: ids.map((placeId) => ({ placeId })), destinations: others.map((placeId) => ({ placeId })), travelMode: 'TRANSIT', departureTime: '2027-05-12T11:00:00Z' });
  assert.equal(r.elements.length, 4);
  assert.equal(r.units, 4);
  for (const el of r.elements) {
    const t = f.fixtureTravel(fx, 'TRANSIT', ids[el.originIndex], others[el.destinationIndex]);
    assert.deepEqual([el.durationSec, el.distanceMeters, el.ok], [t.durationSec, t.distanceMeters, true]);
  }
  assert.equal(r.elements.find((e) => e.originIndex === 1 && e.destinationIndex === 1).durationSec, 0);
  assert.equal(JSON.parse(JSON.stringify(transport.calls[0].body)).travelMode, 'TRANSIT');
});

test('Compute Routes TRANSIT through the kit: leg = fixtureTravel, steps carry the tabled line', async () => {
  const f = await F();
  const fx = f.loadFixture('transit-city');
  const { maps } = await client(fx);
  const from = fx.trip.lodging[0].place_id;
  const to = fx.places.find((p) => p.id === 'tram-depot-gallery').place_id;
  const t = f.fixtureTravel(fx, 'TRANSIT', from, to);
  assert.ok(t.line, 'a tabled transit pair');
  for (const departureTime of ['2027-05-12T11:00:00Z', '2027-05-13T20:00:00Z']) {
    const { route } = await maps.computeRoutes({ origin: { placeId: from }, destination: { placeId: to }, travelMode: 'TRANSIT', departureTime });
    assert.deepEqual([route.durationSec, route.distanceMeters, route.legs.length], [t.durationSec, t.distanceMeters, 1], 'independent of departure time');
    const steps = route.legs[0].steps;
    assert.deepEqual(steps.map((x) => x.travelMode), ['WALK', 'TRANSIT', 'WALK']);
    assert.equal(steps.reduce((sum, x) => sum + x.durationSec, 0), t.durationSec);
    assert.equal(steps[1].transit.transitLine.nameShort, t.line);
  }
});

test('Compute Routes DRIVE with optimizeWaypointOrder: nearest-neighbour order, legs = fixtureTravel, lat/lng waypoints snap within 50 m', async () => {
  const f = await F();
  const fx = f.loadFixture('driving-loop');
  const { maps } = await client(fx);
  const inn = fx.trip.lodging[0];
  const stops = ['blackwater-falls', 'heron-ridge-trail', 'brackenford-old-mill', 'kestrel-farm-shop'].map((id) => fx.places.find((p) => p.id === id).place_id);
  const r = await maps.computeRoutes({ origin: { lat: inn.lat + 0.0002, lng: inn.lng }, destination: { placeId: inn.place_id }, intermediates: stops.map((placeId) => ({ placeId })), optimizeWaypointOrder: true, travelMode: 'DRIVE' });
  assert.equal(r.sku, 'routes.compute_routes.pro');
  const want = f.nearestNeighbourOrder(fx, 'DRIVE', inn.place_id, stops);
  assert.deepEqual(r.route.optimizedOrder, want);
  assert.deepEqual(want.slice(0, 1), [2], 'the mill is nearest the inn');
  const chain = [inn.place_id, ...want.map((i) => stops[i]), inn.place_id];
  assert.equal(r.route.legs.length, chain.length - 1);
  r.route.legs.forEach((leg, i) => assert.equal(leg.durationSec, f.fixtureTravel(fx, 'DRIVE', chain[i], chain[i + 1]).durationSec));
  assert.equal(r.route.durationSec, r.route.legs.reduce((s, l) => s + l.durationSec, 0));
  const plain = await maps.computeRoutes({ origin: { placeId: inn.place_id }, destination: { placeId: stops[0] }, intermediates: [{ placeId: stops[1] }, { placeId: stops[2] }], travelMode: 'DRIVE' });
  assert.equal(plain.route.optimizedOrder, null, 'no order unless asked');
  assert.equal(plain.route.legs[0].durationSec, f.fixtureTravel(fx, 'DRIVE', inn.place_id, stops[1]).durationSec, 'given order kept');
});

test('unknown ids and unresolvable waypoints → the kit\'s not-found error (HTTP_404, NOT_FOUND)', async () => {
  const f = await F();
  const fx = f.loadFixture('driving-loop');
  const { maps } = await client(fx);
  const inn = fx.trip.lodging[0];
  const isNotFound = (e) => e.name === 'MapsRequestError' && e.code === 'HTTP_404' && e.status === 404 && e.apiStatus === 'NOT_FOUND';
  await assert.rejects(maps.placeDetails('FixtureDlNowhere'), isNotFound);
  await assert.rejects(maps.computeRoutes({ origin: { placeId: 'FixtureDlNowhere' }, destination: { placeId: inn.place_id }, travelMode: 'DRIVE' }), isNotFound);
  await assert.rejects(maps.computeRoutes({ origin: { lat: inn.lat + 0.01, lng: inn.lng }, destination: { placeId: inn.place_id }, travelMode: 'DRIVE' }),
    (e) => isNotFound(e) && /within 50 m of that point/.test(e.message) && !/\d\.\d{3,}/.test(e.message), '1 km away does not snap, and the error never echoes the point');
  await assert.rejects(maps.computeRouteMatrix({ origins: [{ placeId: inn.place_id }], destinations: [{ placeId: 'FixtureDlNowhere' }], travelMode: 'DRIVE' }), isNotFound);
  const { route } = await maps.computeRoutes({ origin: { address: inn.address }, destination: { placeId: 'FixtureDlSealCove' }, travelMode: 'DRIVE' });
  assert.equal(route.durationSec, f.fixtureTravel(fx, 'DRIVE', inn.place_id, 'FixtureDlSealCove').durationSec, 'address waypoints resolve too');
});

// Developed by: LightAISolutions

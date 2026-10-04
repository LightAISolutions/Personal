'use strict';
// Tour Guide — the daytrip branch (TG-PHASE-15 WP-15a, Contract C15), core side, part 1: the command, the kind's routing
// and the tab are registered; the core's parse agrees with the engine's on the shared case list; the core validator, the
// pack validator and the schema agree on every fixture, refuse every Google field and an oversize payload; /daytrip with
// a base, without one and with no trip. Part 2 (the handler, the card, keep and replan, the snapshot, the app ops):
// tests/pack_tour-guide_daytrip_gas.test.js. Invented data only; no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const PACK_DIR = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide');
const FIX = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'daytrip', 'fixtures', 'daytrip-sample.json'), 'utf8'));
const CASES = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'daytrip', 'fixtures', 'daytrip-parse-cases.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'helper.json'), 'utf8'));
const NOW = '2027-05-01T12:00:00Z';
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW, manifest: o.manifest || MANIFEST });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'RESEARCH');
  if (o.trip !== false) ctx.tgTripUpsert(FIX.trip);
  return { ctx, state };
}
const say = (ctx, state, text) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text })));
const texts = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text);
const requests = (state) => (state.drive.listFiles(MANIFEST.drive_root + '/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile(MANIFEST.drive_root + '/mailbox/to-brain', n)));
const ask = (r) => { const o = { ...r.payload }; ['kind', 'text', 'chat', 'requested_at', 'upload_key'].forEach((k) => delete o[k]); return o; };

test('daytrip: the commands and the kind\'s routing are registered, the tab with its C15 columns, the handler, the snapshot provider and the four app ops', () => {
  const { ctx } = fresh();
  for (const c of ['/daytrip', '/daytrips']) assert.equal(typeof ctx.getCommand(c), 'function', c);
  assert.ok(J(ctx.HB_REGISTRY.help).some((l) => l.indexOf('/daytrip — ') === 0), 'a help line');
  assert.equal(ctx.TG_KIND_ROUTINE['daytrip'], 'RESEARCH');
  assert.equal(ctx.tgKindRoutine('daytrip'), 'RESEARCH');
  assert.deepEqual(J(ctx.allSheetSchemas()).DayTrips, ['id', 'trip', 'base_label', 'created_on', 'max_minutes', 'date', 'count', 'payload_json', 'kept_json', 'received_at']);
  assert.ok(MANIFEST.envelope_types.includes('daytrip'));
  assert.ok(ctx.getEnvelopeHandler('daytrip'));
  assert.equal(typeof ctx.HB_REGISTRY.snapshot.daytrips_kept, 'function');
  assert.deepEqual(['daytrip.list', 'daytrip.get', 'daytrip.keep', 'daytrip.new'].filter((op) => !ctx.TG_APP_OPS[op]), []);
  assert.deepEqual(['daytrip.keep', 'daytrip.new'].filter((op) => ctx.TG_APP_OPS[op].write !== true), [], 'the two write ops take the lock');
});

test('parse parity: the core\'s tgDaytripParse and the engine\'s parseDaytripText give every shared case its answer', async () => {
  const { ctx } = fresh();
  const { parseDaytripText } = await import('../packs/tour-guide/daytrip/index.mjs');
  assert.ok(CASES.cases.length >= 25, 'a real case list');
  for (const c of CASES.cases) {
    assert.deepEqual(parseDaytripText(c.text, { today: CASES.today }), c.want, 'engine: ' + JSON.stringify(c.text));
    assert.deepEqual(J(ctx.tgDaytripParse(c.text, CASES.today)), c.want, 'core: ' + JSON.stringify(c.text));
  }
  // the M/D rule counts from the day given: on the last day of the year 1/1 is tomorrow
  assert.deepEqual(J(ctx.tgDaytripParse('Bramblecombe on 1/1', '2027-12-31')), parseDaytripText('Bramblecombe on 1/1', { today: '2027-12-31' }));
  assert.equal(parseDaytripText('Bramblecombe on 1/1', { today: '2027-12-31' }).date, '2028-01-01');
});

test('own data only: the pack\'s Google field list is the core\'s (TG_GOOGLE_FIELDS + TG_SCOUT_GOOGLE_EXTRA, normalised)', async () => {
  const { ctx } = fresh();
  const { GOOGLE_KEYS } = await import('../packs/tour-guide/daytrip/index.mjs');
  const core = J(ctx.TG_GOOGLE_FIELDS).map((k) => ctx.tgScoutNormKey(k)).concat(J(ctx.TG_SCOUT_GOOGLE_EXTRA));
  assert.deepEqual([...new Set(GOOGLE_KEYS)].sort(), [...new Set(core)].sort());
});

test('daytrip parity: the core validator, the pack validator and the schema agree on every fixture', async () => {
  const { ctx } = fresh();
  const pack = await import('../packs/tour-guide/daytrip/index.mjs');
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  assert.ok(FIX.valid.length >= 2 && FIX.invalid.length >= 20);
  for (const p of FIX.valid) {
    assert.deepEqual(J(ctx.tgEnvValidateDaytrip(J(p))), [], JSON.stringify(p));
    assert.deepEqual(pack.validateDaytripPayload(J(p)), [], JSON.stringify(p));
    assert.deepEqual(schemas.validatePayload('daytrip', J(p)).errors, [], JSON.stringify(p));
  }
  for (const p of FIX.invalid) {
    const core = J(ctx.tgEnvValidateDaytrip(J(p)));
    assert.ok(core.length > 0, 'core accepts ' + JSON.stringify(p));
    assert.deepEqual(pack.validateDaytripPayload(J(p)), core, 'the same words for ' + JSON.stringify(p));
    assert.equal(schemas.validatePayload('daytrip', J(p)).ok, false, 'schema accepts ' + JSON.stringify(p));
  }
});

/** A payload both validators refuse with the given words (and the schema subset may not see: rank order, size, dates). */
async function bothRefuse(ctx, p, re) {
  const pack = await import('../packs/tour-guide/daytrip/index.mjs');
  const core = J(ctx.tgEnvValidateDaytrip(J(p)));
  assert.deepEqual(pack.validateDaytripPayload(J(p)), core);
  assert.ok(core.some((m) => re.test(m)), core.join(' | ') + ' should match ' + re);
  return core;
}

test('both validators refuse a Google field by name anywhere, in any spelling, and say so', async () => {
  const { ctx } = fresh();
  const p = J(FIX.valid[0]);
  p.items[0].rating = 4.6;
  p.items[1].stops[0].displayName = { text: 'Lighthouse path' };
  p.left_out[0].userRatingCount = 120;
  const errs = await bothRefuse(ctx, p, /^items\[0\]\.rating: Google field refused \(own data only\)$/);
  assert.ok(errs.includes('items[1].stops[0].displayName: Google field refused (own data only)'));
  assert.ok(errs.includes('left_out[0].userRatingCount: Google field refused (own data only)'));
  const top = J(FIX.valid[0]);
  top.geometry = { location: { lat: 1, lng: 2 } };
  await bothRefuse(ctx, top, /^geometry: Google field refused/);
});

test('both validators refuse what the schema subset cannot say: rank order, a duplicate slug or label, an unreal date, over 20 000 characters', async () => {
  const { ctx } = fresh();
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  const swapped = J(FIX.valid[0]);
  swapped.items.reverse();
  await bothRefuse(ctx, swapped, /^items\[0\]\.n must be 1 \(rank order\)$/);
  const twice = J(FIX.valid[0]);
  twice.items[1].slug = twice.items[0].slug;
  await bothRefuse(ctx, twice, /^items\[1\]: duplicate slug lockford$/);
  const label = J(FIX.valid[0]);
  label.items[0].labels = ['gem', 'gem'];
  await bothRefuse(ctx, label, /^items\[0\]\.labels\[1\]: duplicate label$/);
  const feb = J(FIX.valid[0]);
  feb.items[1].closed = ['2027-02-30'];
  feb.date = '2027-04-31';
  const ferrs = await bothRefuse(ctx, feb, /^items\[1\]\.closed\[0\] must be a calendar date YYYY-MM-DD$/);
  assert.ok(ferrs.includes('date must be a calendar date YYYY-MM-DD'));
  // eight items at every field's longest: valid item by item, too big as a whole
  const big = J(FIX.valid[0]);
  const long = (n, c) => c.repeat(n);
  big.items = Array.from({ length: 8 }, (_, i) => ({ ...J(FIX.valid[0].items[0]), n: i + 1, slug: 'town-' + (i + 1), name: long(120, 'N'), area: long(80, 'A'),
    why: long(200, 'w'), see: [long(80, 's'), long(80, 't'), long(80, 'u'), long(80, 'v')], eat: long(160, 'e'), season: long(120, 'z'),
    stops: Array.from({ length: 6 }, (__, j) => ({ name: long(120, 'S'), place_id: 'FixtureDt' + j + long(280, 'p') })) }));
  const size = JSON.stringify(big).length;
  assert.ok(size > 20000 && size < 60000, String(size));
  await bothRefuse(ctx, big, new RegExp('^payload is ' + size + ' chars \\(max 20000\\)$'));
  // C15 (coordinator, WP-15a's REQUEST): validatePayload runs checkDaytrip as KINDS.daytrip, so the envelope tool sees the size too
  const vp = schemas.validatePayload('daytrip', J(big));
  assert.equal(vp.ok, false);
  assert.ok(vp.errors.some((e) => e.message === 'payload is ' + size + ' chars (max 20000)'), JSON.stringify(vp.errors));
  assert.equal(schemas.validatePayload('daytrip', J(swapped)).ok, false, 'and the rank order');
});

test('/daytrip with a base: the owner\'s words become C15\'s payload, the request carries the current trip, and the acknowledgement names the base', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/daytrip from Bramblecombe under 1.5 h on 5/13');
  const reqs = requests(state);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].payload.kind, 'daytrip');
  assert.equal(reqs[0].payload.text, '/daytrip from Bramblecombe under 1.5 h on 5/13', 'the owner\'s words as typed');
  assert.deepEqual(ask(reqs[0]), { trip: FIX.trip.slug, from: 'Bramblecombe', date: '2027-05-13', max_minutes: 90 });
  assert.equal(J(ctx.storeAll('Requests'))[0].routine, 'RESEARCH');
  assert.match(texts(state).join('\n'), /🚆 Looking for day trips from <b>Bramblecombe<\/b> · under 90 min · Thu 13 May/);
  // a base far from the trip still goes with the trip: the routine decides whether the base belongs to it
  say(ctx, state, '/daytrip Wyvern Cross under 4 h');
  assert.deepEqual(ask(requests(state).find((r) => r.payload.from === 'Wyvern Cross')), { trip: FIX.trip.slug, from: 'Wyvern Cross', max_minutes: 180 });
});

test('/daytrip without a base: from where the current trip stays; with no trip a one-line how-to and no request', () => {
  let { ctx, state } = fresh();
  say(ctx, state, '/daytrip');
  say(ctx, state, '/daytrip under 45 min on tomorrow');
  const reqs = requests(state).map(ask);
  assert.deepEqual(reqs.sort((a, b) => a.max_minutes - b.max_minutes), [{ trip: FIX.trip.slug, date: '2027-05-02', max_minutes: 45 }, { trip: FIX.trip.slug, max_minutes: 90 }]);
  assert.match(texts(state).join('\n'), /🚆 Looking for day trips from where you stay · under 90 min…/);

  ({ ctx, state } = fresh({ trip: false }));
  say(ctx, state, '/daytrip');
  say(ctx, state, '/daytrip under 1 h');
  assert.equal(requests(state).length, 0);
  const said = texts(state);
  assert.equal(said.length, 2);
  for (const t of said) { assert.match(t, /^🚆 From where\? <code>\/daytrip from /); assert.ok(!t.includes('\n'), 'one line'); }
  // with no trip a named base is enough: the request goes without a trip
  say(ctx, state, '/daytrip from Wyvern Cross');
  assert.deepEqual(requests(state).map(ask), [{ from: 'Wyvern Cross', max_minutes: 90 }]);
});

test('/daytrip refuses a bad date, a past date and a long base in words, and asks nothing', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/daytrip Bramblecombe on 2/30');
  say(ctx, state, '/daytrip Bramblecombe on 2027-04-01');
  say(ctx, state, '/daytrip ' + 'B'.repeat(81));
  assert.equal(requests(state).length, 0);
  const said = texts(state);
  assert.match(said[0], /could not read that date/);
  assert.match(said[1], /already passed/);
  assert.match(said[2], /under 80 characters/);
  assert.ok(said.every((t) => /nothing was asked/i.test(t)));
});

test('/daytrip: `daytrip` is a discovery kind (--discover): listed once, and a configured DISCOVER routine gets the request', () => {
  const { ctx, state } = fresh();
  assert.equal(ctx.TG_DISCOVER_KINDS.filter((k) => k === 'daytrip').length, 1);
  H.configureRoutine(ctx, state, 'DISCOVER');
  assert.equal(ctx.tgKindRoutine('daytrip'), 'DISCOVER');
  say(ctx, state, '/daytrip');
  assert.equal(requests(state).length, 1);
  assert.equal(J(ctx.storeAll('Requests'))[0].routine, 'DISCOVER');
});

// Developed by: LightAISolutions

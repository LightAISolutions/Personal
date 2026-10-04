'use strict';
// Tour Guide — the quiet branch (TG-PHASE-16 WP-16a, Contract C16), core side, part 1: registration; the parse parity
// (tgQuietParse and parseQuietText on the shared case list); the three validators (tgEnvValidateQuiet,
// validateQuietPayload, the schema) on the fixture and on what only the validators can see, a Google field and an
// oversize payload among them; /quiet with and without a date; the `quiet` envelope's handler and card, an empty board, a
// magnet that is not busy, and a re-delivery that keeps an added entry. Part 2: pack_tour-guide_quiet_gas.test.js.
// Invented data only (Quillmere, Lantern Shrine); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const PACK_DIR = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide');
const FIX = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'quiet', 'fixtures', 'quiet-sample.json'), 'utf8'));
const CASES = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'quiet', 'fixtures', 'quiet-parse-cases.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'helper.json'), 'utf8'));
const NOW = '2027-05-01T12:00:00Z';
const SHELL = 'https://app.example.invalid/helper-app.html';
const TRIP = FIX.trip.slug;
const BOARD = FIX.valid[0].id;
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW, manifest: o.manifest || MANIFEST });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'RESEARCH');
  if (o.shell !== false) state.props[ctx.PROP.APP_SHELL_URL] = SHELL;
  if (o.trip !== false) ctx.tgTripUpsert(FIX.trip);
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const tap = (ctx, state, data) => post(ctx, state, H.tgUpdate({ callback: data }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const requests = (state) => (state.drive.listFiles(MANIFEST.drive_root + '/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile(MANIFEST.drive_root + '/mailbox/to-brain', n)));
const ask = (r) => { const o = { ...r.payload }; ['kind', 'text', 'chat', 'requested_at', 'upload_key', 'lodging_fp', 'trip_update'].forEach((k) => delete o[k]); return o; };
const deliver = (ctx, state, payload, over) => { H.putEnvelope(state, H.envelope('quiet', payload, over)); return J(ctx.pollFromBrain()); };
const kb = (m) => (m && m.reply_markup ? m.reply_markup.inline_keyboard : []);

test('quiet: the command, the kind\'s routing (a discovery kind), the tab\'s columns, the handler and the five app ops are registered', () => {
  const { ctx, state } = fresh();
  assert.equal(typeof ctx.getCommand('/quiet'), 'function');
  assert.ok(J(ctx.HB_REGISTRY.help).some((l) => l.indexOf('/quiet — ') === 0), 'a help line');
  assert.equal(ctx.TG_KIND_ROUTINE['quiet'], 'RESEARCH');
  assert.equal(ctx.TG_DISCOVER_KINDS.filter((k) => k === 'quiet').length, 1);
  assert.equal(ctx.tgKindRoutine('quiet'), 'RESEARCH');
  H.configureRoutine(ctx, state, 'DISCOVER');
  assert.equal(ctx.tgKindRoutine('quiet'), 'DISCOVER');
  assert.deepEqual(J(ctx.allSheetSchemas()).Quiet, ['id', 'trip', 'magnet_slug', 'magnet_name', 'created_on', 'date', 'count', 'payload_json', 'added_json', 'received_at']);
  assert.ok(MANIFEST.envelope_types.includes('quiet'));
  assert.ok(ctx.getEnvelopeHandler('quiet'));
  assert.deepEqual(['quiet.list', 'quiet.get', 'quiet.add', 'quiet.new', 'quiet.day'].filter((op) => !ctx.TG_APP_OPS[op]), []);
  assert.deepEqual(['quiet.add', 'quiet.new'].filter((op) => !ctx.TG_APP_OPS[op].write), [], 'the two write ops');
  assert.deepEqual(['quiet.list', 'quiet.get', 'quiet.day'].filter((op) => ctx.TG_APP_OPS[op].write), []);
});

test('parse parity: tgQuietParse and parseQuietText give every shared case its answer', async () => {
  const { ctx } = fresh();
  const { parseQuietText } = await import('../packs/tour-guide/quiet/index.mjs');
  for (const c of CASES.cases) {
    assert.deepEqual(J(ctx.tgQuietParse(c.text, CASES.today)), c.want, 'core: ' + JSON.stringify(c.text));
    assert.deepEqual(parseQuietText(c.text, { today: CASES.today }), c.want, 'engine: ' + JSON.stringify(c.text));
  }
});

/** Payloads only the validators refuse (the schema subset cannot say these), each with the one word both give. */
function validatorOnly() {
  const v = () => J(FIX.valid[0]);
  const out = [];
  let p = v(); p.items[1].n = 3; p.items[2].n = 2; out.push([p, 'items[1].n must be 2 (rank order)']);
  p = v(); p.items[2].slug = p.items[0].slug; out.push([p, 'items[2]: duplicate slug reedwater-shrine']);
  p = v(); p.items[0].labels = ['local_favourite', 'local_favourite']; out.push([p, 'items[0].labels[1]: duplicate label']);
  p = v(); p.created_on = '2027-02-30'; out.push([p, 'created_on must be a calendar date YYYY-MM-DD']);
  p = v(); p.magnet.location = { lat: 1, lng: 2 }; out.push([p, 'magnet.location: Google field refused (own data only)']);
  p = v(); p.items[0].userRatingCount = 900; out.push([p, 'items[0].userRatingCount: Google field refused (own data only)']);
  p = v(); p.items.forEach((it) => { it.maps_url = 'https://www.google.com/maps/search/?api=1&query=' + 'x'.repeat(1940); });
  p.items.forEach((it) => { it.why = 'w'.repeat(200); it.best = 'b'.repeat(120); });
  p.magnet.source.url = 'https://lantern-shrine.example/' + 'v'.repeat(1960);
  p.left_out = Array.from({ length: 12 }, (_, i) => ({ name: 'Fixture Hall ' + 'h'.repeat(100) + i, reason: 'too_far' }));
  out.push([p, 'payload is ' + JSON.stringify(p).length + ' chars (max 12000)']);
  return out;
}

test('the three validators: the fixture alike; the core and the pack give the same words, Google fields and size included', async () => {
  const { ctx } = fresh();
  const pack = await import('../packs/tour-guide/quiet/index.mjs');
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  for (const p of FIX.valid) {
    assert.deepEqual(J(ctx.tgEnvValidateQuiet(J(p))), [], JSON.stringify(p).slice(0, 80));
    assert.deepEqual(pack.validateQuietPayload(J(p)), []);
    assert.deepEqual(schemas.validatePayload('quiet', J(p)).errors, []);
  }
  for (const p of FIX.invalid) {
    const core = J(ctx.tgEnvValidateQuiet(J(p)));
    assert.ok(core.length > 0, 'core accepts ' + JSON.stringify(p).slice(0, 120));
    assert.deepEqual(pack.validateQuietPayload(J(p)), core, 'the same words for ' + JSON.stringify(p).slice(0, 120));
    assert.equal(schemas.validatePayload('quiet', J(p)).ok, false, 'schema accepts ' + JSON.stringify(p).slice(0, 120));
  }
  const only = validatorOnly();
  assert.ok(JSON.stringify(only.at(-1)[0]).length > 12000 && JSON.stringify(only.at(-1)[0]).length < 60000);
  for (const [p, word] of only) {
    const core = J(ctx.tgEnvValidateQuiet(J(p)));
    assert.ok(core.includes(word), word + ' — got ' + JSON.stringify(core));
    assert.deepEqual(pack.validateQuietPayload(J(p)), core, word);
  }
  const big = J(only.at(-1)[0]);
  big.left_out[0].name = 'x'.repeat(50000);
  assert.deepEqual(J(ctx.tgEnvValidateQuiet(J(big))).filter((e) => /^payload is/.test(e)), pack.validateQuietPayload(J(big)).filter((e) => /^payload is/.test(e)));
  assert.equal(J(ctx.tgEnvValidateQuiet(J(big))).filter((e) => /^payload is \d+ chars \(max (60000|12000)\)$/.test(e)).length, 2);
});

test('/quiet <place> [on <date>]: a `quiet` request with the current trip, the owner\'s words as typed, and the acknowledgement', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/quiet Lantern Shrine');
  let reqs = requests(state);
  assert.equal(reqs.length, 1);
  assert.deepEqual(ask(reqs[0]), { trip: TRIP, place: 'Lantern Shrine' });
  assert.equal(reqs[0].payload.kind, 'quiet');
  assert.equal(reqs[0].payload.text, '/quiet Lantern Shrine');
  assert.equal(J(ctx.storeAll('Requests'))[0].routine, 'RESEARCH');
  assert.equal(texts(state).at(-1), '🕊 Looking for places quieter than <b>Lantern Shrine</b>…');
  const today = ctx.tgQuietToday(ctx.tgTripGet(TRIP));
  say(ctx, state, '/quiet Copper <Noodle> Bar on tomorrow');
  reqs = requests(state);
  const second = reqs.find((r) => r.payload.place !== 'Lantern Shrine');
  const next = new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  assert.deepEqual(ask(second), { trip: TRIP, place: 'Copper <Noodle> Bar', date: next });
  assert.equal(texts(state).at(-1), '🕊 Looking for places quieter than <b>Copper &lt;Noodle&gt; Bar</b>…');
});

test('/quiet: without a trip the request has none; bad words, a past date, a long place or a date alone ask nothing', () => {
  let { ctx, state } = fresh({ trip: false });
  say(ctx, state, '/quiet Lantern Shrine on 2027-05-20');
  assert.deepEqual(ask(requests(state)[0]), { place: 'Lantern Shrine', date: '2027-05-20' });
  ({ ctx, state } = fresh());
  const before = texts(state).length;
  say(ctx, state, '/quiet Lantern Shrine on 2027-02-30');
  say(ctx, state, '/quiet Lantern Shrine on 2027-04-01');
  say(ctx, state, '/quiet ' + 'x'.repeat(81));
  say(ctx, state, '/quiet on tomorrow');
  say(ctx, state, '/quiet');
  assert.equal(requests(state).length, 0);
  const said = texts(state).slice(before);
  assert.match(said[0], /could not read that date/);
  assert.match(said[1], /already passed/);
  assert.match(said[2], /under 80 characters/);
  assert.equal(said[3], ctx.TG_QUIET_USAGE, 'a date and no place: the how-to');
  assert.equal(said[4], ctx.TG_QUIET_USAGE, 'no stops and no boards: only the how-to');
  assert.equal(sends(state).at(-1).reply_markup, undefined);
});

test('/quiet alone with boards and no stops: the last 5 boards as resend buttons, then the how-to', () => {
  const { ctx, state } = fresh();
  for (let i = 0; i < 6; i++) {
    const p = J(FIX.valid[1]); p.id = 'qt-20270501-hall-' + i; p.magnet.name = 'Hall ' + i; p.magnet.slug = 'hall-' + i;
    assert.equal(deliver(ctx, state, p).processed, 1);
  }
  say(ctx, state, '/quiet');
  const m = sends(state).at(-1);
  assert.match(m.text, /^🕊 <b>Quieter places<\/b>\nYour last boards:\n<b>1\.<\/b> Quieter than Hall 5 · 0 places · asked Wed 12 May\n/);
  assert.ok(!/Hall 0/.test(m.text), 'five boards');
  assert.ok(m.text.endsWith(ctx.TG_QUIET_USAGE));
  assert.deepEqual(kb(m).flat().map((b) => b.text), ['🔁 1', '🔁 2', '🔁 3', '🔁 4', '🔁 5']);
  assert.equal(kb(m)[0][0].callback_data, 'qt:' + ctx.tgQuietKey('qt-20270501-hall-5') + ':s');
  tap(ctx, state, kb(m)[0][1].callback_data);
  assert.match(texts(state).at(-1), /^🕊 <b>Quieter than Hall 4<\/b>/);
});

test('the handler: the board is stored and the card sent — items, why, best, the quiet line with its source, ➕ 1–3 and 📱; nothing left out', () => {
  const { ctx, state } = fresh();
  assert.deepEqual(deliver(ctx, state, J(FIX.valid[0])), { processed: 1, rejected: 0, failed: 0, duplicate: 0 });
  const row = J(ctx.storeAll('Quiet'))[0];
  assert.deepEqual({ ...row, payload_json: undefined, _row: undefined }, { id: BOARD, trip: TRIP, magnet_slug: 'lantern-shrine', magnet_name: 'Lantern Shrine',
    created_on: '2027-05-12', date: '2027-05-13', count: 3, added_json: '[]', received_at: '2027-05-01T12:00:00.000Z', payload_json: undefined, _row: undefined });
  assert.deepEqual(JSON.parse(row.payload_json), FIX.valid[0]);
  const m = sends(state).at(-1), lines = m.text.split('\n');
  assert.equal(lines[0], '🕊 <b>Quieter than Lantern Shrine</b> · Thu 13 May');
  assert.match(lines[1], /^<b>1\.<\/b> <a href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=Reedwater%20Shrine&amp;query_place_id=FixtureQmReedwater1">Reedwater Shrine<\/a> — 🚶 12 min · much quieter$/);
  assert.equal(lines[2], '<i>Same lantern-lit approach, a tenth of the crowd</i>');
  assert.equal(lines[3], '🕐 Early morning, before 09:30');
  assert.match(lines[4], /Moss Step Shrine<\/a> — 🚆 about 18 min · clearly quieter$/);
  assert.equal(lines[5], '<i>Moss garden and a covered hall</i>', 'no best time, no 🕐 line');
  assert.match(lines[6], /Heron Gate Shrine<\/a> — 🚶 about 9 min · somewhat quieter$/);
  assert.equal(lines[8], '<i>…and 1 more that were also quieter.</i>');
  assert.equal(lines[9], '🕐 <b>If you go anyway:</b> Quietest at opening (09:00–10:00) or late (from 15:30; last entry 16:30); weekday mornings are calmest (<a href="https://lantern-shrine.example/visit">Lantern Shrine visitor page</a>)');
  assert.deepEqual(lines.slice(10), ['', '➕ adds a place to the Later list.']);
  ['Upper Hall', 'Tealeaf', 'Grand Gate', 'Far Cliff'].forEach((n) => assert.ok(!m.text.includes(n), n + ' stays in the app'));
  const key = ctx.tgQuietKey(BOARD);
  assert.match(key, /^k[0-9a-f]{12}$/);
  assert.deepEqual(kb(m)[0].map((b) => [b.text, b.callback_data]), [['➕ 1', 'qt:' + key + ':1'], ['➕ 2', 'qt:' + key + ':2'], ['➕ 3', 'qt:' + key + ':3']]);
  assert.equal(kb(m)[1][0].text, '📱 Open in the app');
  assert.match(kb(m)[1][0].web_app.url, /^https:\/\/app\.example\.invalid\/helper-app\.html\?.*&screen=quiet&trip=quillmere-2027&quiet=qt-20270512-lantern-shrine$/);
});

test('an empty board on a magnet that is not busy: the not-busy line, the empty line, the quiet line, only 📱 and no trip in its link', () => {
  let { ctx, state } = fresh();
  deliver(ctx, state, J(FIX.valid[1]));
  const m = sends(state).at(-1);
  assert.equal(m.text, ['🕊 <b>Quieter than Copper Noodle Bar</b>',
    '<i>Copper Noodle Bar is not one of the busiest places nearby, so these are a choice rather than an escape.</i>',
    'Nothing of the same kind within 30 minutes is clearly quieter.',
    '🕐 <b>If you go anyway:</b> No quiet hours found; early is usually quieter'].join('\n'));
  assert.equal(kb(m).length, 1);
  assert.match(kb(m)[0][0].web_app.url, /&screen=quiet&quiet=qt-20270512-copper-noodle-bar$/);
  ({ ctx, state } = fresh({ shell: false }));
  deliver(ctx, state, J(FIX.valid[1]));
  assert.equal(sends(state).at(-1).reply_markup, undefined, 'no shell, no items: no keyboard');
});

test('➕ adds to the Later list and marks ✅; a re-delivery keeps the added entry while its place is on the board and drops it when not', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, J(FIX.valid[0]));
  const key = ctx.tgQuietKey(BOARD);
  tap(ctx, state, 'qt:' + key + ':1');
  assert.deepEqual(J(ctx.tgLaterList(TRIP)).map((e) => [e.place_slug, e.reason]), [['reedwater-shrine', 'owner_choice']]);
  const answers = state.fetch.telegram('answerCallbackQuery').map((r) => r.json);
  assert.equal(answers.at(-1).text, 'Added');
  const edit = state.fetch.telegram('editMessageReplyMarkup').map((r) => r.json).at(-1);
  assert.deepEqual(edit.reply_markup.inline_keyboard[0].map((b) => b.text), ['✅ 1', '➕ 2', '➕ 3']);
  assert.match(texts(state).at(-1), /Reedwater Shrine/);
  const first = J(ctx.tgQuietGet(BOARD)).added;
  assert.deepEqual(first.map((a) => a.slug), ['reedwater-shrine']);
  tap(ctx, state, 'qt:' + key + ':1');
  assert.deepEqual(J(ctx.tgQuietGet(BOARD)).added, first, 'a second tap changes nothing');
  assert.equal(J(ctx.tgLaterList(TRIP)).length, 1);
  // Re-delivered with the items reordered: the entry stays, ✅ on its new number.
  let p = J(FIX.valid[0]);
  p.items = [p.items[1], p.items[0], p.items[2]].map((it, i) => ({ ...it, n: i + 1 }));
  p.items[0].score = 90; p.items[1].score = 86;
  assert.equal(deliver(ctx, state, p).processed, 1);
  assert.deepEqual(J(ctx.tgQuietGet(BOARD)).added, first);
  assert.deepEqual(kb(sends(state).at(-1))[0].map((b) => b.text), ['➕ 1', '✅ 2', '➕ 3']);
  // Re-delivered without it: the entry goes (the Later list keeps the place).
  p = J(FIX.valid[0]);
  p.items = p.items.slice(1).map((it, i) => ({ ...it, n: i + 1 }));
  p.more = 0;
  assert.equal(deliver(ctx, state, p).processed, 1);
  assert.deepEqual(J(ctx.tgQuietGet(BOARD)).added, []);
  assert.equal(J(ctx.tgLaterList(TRIP)).length, 1);
});

test('an unknown trip is rejected; without the type in helper.json there is no handler and the envelope is rejected', () => {
  let { ctx, state } = fresh();
  const p = J(FIX.valid[0]); p.trip = 'nowhere-2027';
  const r = deliver(ctx, state, p);
  assert.equal(r.rejected, 1);
  assert.equal(J(ctx.storeAll('Quiet')).length, 0);
  const manifest = J(MANIFEST); manifest.envelope_types = manifest.envelope_types.filter((t) => t !== 'quiet');
  ({ ctx, state } = fresh({ manifest }));
  assert.ok(!ctx.getEnvelopeHandler('quiet'));
  assert.equal(deliver(ctx, state, J(FIX.valid[0])).rejected, 1);
  assert.equal(J(ctx.storeAll('Quiet')).length, 0);
});

// Developed by: LightAISolutions

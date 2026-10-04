'use strict';
// Tour Guide — What's on (item 20, C15, TG-PHASE-15 WP-15b), core side: /whatson and its words (parity with the engine),
// the defaults and refusals, the routing; the validators agree on every fixture; the WhatsOn tab and the card; choosing
// (which day, re-plan, un-choose); the weekly check (alarm tg_whatson) and its silence; the `whatson_chosen` snapshot;
// /whatson last; the app ops. Invented data (Quillmere, Fernby Cross); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const PACK_DIR = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide');
const FIX = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'whatson', 'fixtures', 'whatson-sample.json'), 'utf8'));
const CASES = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'whatson', 'fixtures', 'whatson-parse-cases.json'), 'utf8')).cases;
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'helper.json'), 'utf8'));
const NOW = '2027-05-01T12:00:00Z';
const SHELL = 'https://app.example.invalid/helper-app.html';
const BOARD = FIX.valid[0];
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: o.now || NOW, manifest: o.manifest || MANIFEST });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'RESEARCH');
  if (o.shell !== false) state.props[ctx.PROP.APP_SHELL_URL] = SHELL;
  if (o.trip !== false) ctx.tgTripUpsert({ ...FIX.trip, ...(o.tripOver || {}) });
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const tap = (ctx, state, data) => post(ctx, state, H.tgUpdate({ callback: data }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json);
const buttons = (m) => (m && m.reply_markup ? m.reply_markup.inline_keyboard.flat() : []);
const app = (ctx, state, op, args) => J(H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args }));
const requests = (state) => (state.drive.listFiles(MANIFEST.drive_root + '/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile(MANIFEST.drive_root + '/mailbox/to-brain', n)));
const deliver = (ctx, state, payload, over) => { H.putEnvelope(state, H.envelope('whatson', payload, over)); return J(ctx.pollFromBrain()); };
const digest = (dates) => ({ v: 1, kind: 'plan_digest', trip: FIX.trip.slug, build_id: 'build-wo-1', verified_on: '2027-04-30',
  days: dates.map((d) => ({ date: d, theme: 'Mere', stops: [], legs: [], warnings: [] })), later: [],
  drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null } });
const key = (ctx, id) => ctx.tgWhatsonKey(id);
const tag = (ctx, itemId) => ctx.tgCmdTag(itemId);

test('whatson: the command, the kind\'s routing, the tab (C15 columns), the alarm, the snapshot, the handler and the four app ops are registered', () => {
  const { ctx } = fresh();
  assert.equal(typeof ctx.getCommand('/whatson'), 'function');
  assert.ok(J(ctx.HB_REGISTRY.help).some((l) => l.indexOf('/whatson — ') === 0), 'a help line');
  assert.equal(ctx.TG_KIND_ROUTINE['whatson'], 'RESEARCH');
  assert.equal(ctx.tgKindRoutine('whatson'), 'RESEARCH');
  assert.deepEqual(J(ctx.allSheetSchemas()['WhatsOn']), ['id', 'trip', 'place_label', 'from', 'to', 'created_on', 'auto', 'count', 'payload_json', 'chosen_json', 'received_at']);
  assert.ok(MANIFEST.envelope_types.includes('whatson'));
  assert.ok(ctx.getEnvelopeHandler('whatson'));
  assert.equal(typeof ctx.HB_REGISTRY.alarm.tg_whatson.next, 'function');
  assert.equal(typeof ctx.HB_REGISTRY.snapshot.whatson_chosen, 'function');
  assert.deepEqual(['whatson.list', 'whatson.get', 'whatson.choose', 'whatson.new'].filter((op) => !ctx.TG_APP_OPS[op]), []);
  assert.equal(ctx.TG_APP_OPS['whatson.choose'].write, true);
  assert.equal(ctx.TG_APP_OPS['whatson.new'].write, true);
});

test('/whatson: `whatson` is a discovery kind (--discover): listed once, and a configured DISCOVER routine gets the request', () => {
  const { ctx, state } = fresh();
  assert.equal(ctx.TG_DISCOVER_KINDS.filter((k) => k === 'whatson').length, 1);
  H.configureRoutine(ctx, state, 'DISCOVER');
  assert.equal(ctx.tgKindRoutine('whatson'), 'DISCOVER');
  say(ctx, state, '/whatson');
  assert.equal(requests(state).length, 1);
  assert.equal(J(ctx.storeAll('Requests'))[0].routine, 'DISCOVER');
});

test('whatson parity: tgEnvValidateWhatson and validateWhatsonPayload give the same words on every fixture; the schema agrees on valid and invalid', async () => {
  const { ctx } = fresh();
  const pack = await import('../packs/tour-guide/whatson/index.mjs');
  const schemas = await import('../packs/tour-guide/schemas/index.mjs');
  for (const p of FIX.valid) {
    assert.deepEqual(J(ctx.tgEnvValidateWhatson(J(p))), [], JSON.stringify(p));
    assert.deepEqual(pack.validateWhatsonPayload(J(p)), [], JSON.stringify(p));
    assert.deepEqual(schemas.validatePayload('whatson', J(p)).errors, [], JSON.stringify(p));
  }
  for (const p of FIX.invalid) {
    const core = J(ctx.tgEnvValidateWhatson(J(p)));
    assert.ok(core.length > 0, 'core accepts ' + JSON.stringify(p));
    assert.deepEqual(pack.validateWhatsonPayload(J(p)), core, 'the same words for ' + JSON.stringify(p));
    assert.equal(schemas.validatePayload('whatson', J(p)).ok, false, 'schema accepts ' + JSON.stringify(p));
  }
  for (const p of FIX.semantic) {   // rules a JSON schema cannot say: the two validators and checkWhatson refuse them
    const core = J(ctx.tgEnvValidateWhatson(J(p)));
    assert.ok(core.length > 0, 'core accepts ' + JSON.stringify(p));
    assert.deepEqual(pack.validateWhatsonPayload(J(p)), core, 'the same words for ' + JSON.stringify(p));
    assert.ok(pack.checkWhatson(J(p)).length > 0, 'checkWhatson accepts ' + JSON.stringify(p));
  }
  // Google fields and the one-cell cap, in the same words
  const g = J(BOARD); g.items[0].rating = 4.5; g.items[1].venue.formattedAddress = '1 Quay';
  assert.deepEqual(J(ctx.tgEnvValidateWhatson(J(g))), pack.validateWhatsonPayload(J(g)));
  assert.match(J(ctx.tgEnvValidateWhatson(J(g))).join('\n'), /items\[0\]\.rating: Google field refused/);
  const big = J(BOARD);
  big.items = Array.from({ length: 20 }, (_, i) => ({ ...J(BOARD.items[0]), id: 'reed-' + String(i).padStart(2, '0'), name: 'Reed ' + String(i).padStart(2, '0'),
    why: 'w'.repeat(200), url: 'https://whatson.example.org/' + 'u'.repeat(1950) }));
  const bigWords = J(ctx.tgEnvValidateWhatson(J(big)));
  assert.match(bigWords.join('\n'), /chars \(max 40000 for one cell\)/);
  assert.deepEqual(pack.validateWhatsonPayload(J(big)), bigWords);
  assert.equal(pack.buildWhatsonPayload, pack.whatsonPayload, 'the generated name stays');
});

test('/whatson words: the core\'s tgWhatsonParse and the engine\'s parseWhatsonText agree on the shared case list', async () => {
  const { ctx } = fresh();
  const { parseWhatsonText } = await import('../packs/tour-guide/whatson/whatson-text.mjs');
  assert.ok(CASES.length >= 40);
  for (const c of CASES) {
    assert.deepEqual(J(ctx.tgWhatsonParse(c.text, c.today)), c.want, 'core: ' + JSON.stringify(c.text) + ' on ' + c.today);
    assert.deepEqual(parseWhatsonText(c.text, { today: c.today }), c.want, 'engine: ' + JSON.stringify(c.text));
  }
  const reasons = new Set(CASES.filter((c) => !c.want.ok).map((c) => c.want.reason));
  assert.deepEqual([...reasons].sort(), ['long_place', 'past', 'reversed', 'too_long']);
});

const pick = (p) => { const o = {}; ['trip', 'place', 'from', 'to', 'dates_given', 'auto'].forEach((k) => { if (p[k] !== undefined) o[k] = p[k]; }); return o; };

test('/whatson: the defaults (the trip\'s days, else today and 6 more), the trip rides along when no place is named or the dates meet it', () => {
  let { ctx, state } = fresh();
  say(ctx, state, '/whatson');
  say(ctx, state, '/whatson Fernby Cross tomorrow');
  say(ctx, state, '/whatson in Quillmere 13 May');
  say(ctx, state, '/whatson Fernby Cross');
  const reqs = requests(state);
  assert.deepEqual(reqs.map((r) => r.payload.kind), ['whatson', 'whatson', 'whatson', 'whatson']);
  assert.deepEqual(reqs.map((r) => pick(r.payload)), [
    { trip: 'quillmere-2027', from: '2027-05-12', to: '2027-05-14' },
    { place: 'Fernby Cross', from: '2027-05-02', to: '2027-05-02', dates_given: true },
    { trip: 'quillmere-2027', place: 'Quillmere', from: '2027-05-13', to: '2027-05-13', dates_given: true },
    { trip: 'quillmere-2027', place: 'Fernby Cross', from: '2027-05-12', to: '2027-05-14' }]);
  const said = texts(state);
  assert.match(said[0], /Looking up what's on in the cities of <b>Quillmere<\/b> · 12–14 May/);
  assert.match(said[1], /Looking up what's on in <b>Fernby Cross<\/b> · Sun 2 May/);

  ({ ctx, state } = fresh({ trip: false }));
  say(ctx, state, '/whatson Fernby Cross');
  assert.deepEqual(pick(requests(state)[0].payload), { place: 'Fernby Cross', from: '2027-05-01', to: '2027-05-07' });
  say(ctx, state, '/whatson');
  assert.equal(requests(state).length, 1, 'no place and no trip: no request');
  assert.match(texts(state).pop(), /Which place\?.*\/whatson &lt;place&gt; &lt;dates&gt;/);

  ({ ctx, state } = fresh({ tripOver: { start: '2027-04-01', end: '2027-04-05' } }));
  ctx.settingSet(ctx.TG_SETTINGS.CURRENT_TRIP, 'quillmere-2027', 'pinned');   // a pinned trip stays current after its days
  say(ctx, state, '/whatson');
  assert.deepEqual(pick(requests(state)[0].payload), { trip: 'quillmere-2027', from: '2027-05-01', to: '2027-05-07' }, 'a trip that is over: today and 6 more');
});

test('/whatson: past, reversed, too long and an over-long place get one line and no request', () => {
  const { ctx, state } = fresh();
  const cases = [['/whatson 2027-04-01', /already past/], ['/whatson Quillmere 10-8 Jun', /ends before it starts/], ['/whatson 1 Jun to 2 Jul', /31 days or fewer/],
    ['/whatson ' + 'x'.repeat(81), /under 80 characters/]];
  for (const [text, re] of cases) { say(ctx, state, text); assert.match(texts(state).pop(), re, text); }
  assert.equal(requests(state).length, 0);
});

test('the whatson envelope: one row per board id with the C15 columns, then the card grouped by date', () => {
  const { ctx, state } = fresh();
  assert.equal(deliver(ctx, state, BOARD).processed, 1);
  const rows = J(ctx.storeAll('WhatsOn'));
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].id, rows[0].trip, rows[0].place_label, rows[0].from, rows[0].to, rows[0].created_on, String(rows[0].count), rows[0].chosen_json],
    ['wo-20270501-quillmere', 'quillmere-2027', 'Quillmere', '2027-05-12', '2027-05-14', '2027-05-01', '4', '[]']);
  assert.deepEqual(JSON.parse(rows[0].payload_json), BOARD);
  const m = sends(state).pop(), lines = m.text.split('\n');
  assert.equal(lines[0], '🗓 <b>What\'s on in Quillmere</b> · 12–14 May');
  const heads = lines.filter((l) => /^<b>[A-Z]/.test(l));
  assert.deepEqual(heads, ['<b>All these days</b>', '<b>Thu 13 May</b>', '<b>Fri 14 May</b>']);
  const items = lines.filter((l) => /^<b>\d+\.<\/b>/.test(l));
  assert.equal(items.length, 4);
  assert.equal(items[0], '<b>1.</b> 🖼 10:00–17:00 <a href="https://whatson.example.org/reed-and-rush">Reed and Rush: Weavers of the Mere</a> · until Wed 30 Jun');
  assert.match(items[1], /^<b>2\.<\/b> 🧺 08:00–13:00 .*Thursday Quay Market<\/a> · until Thu 27 May$/, 'one day in the window, more after it');
  assert.match(items[2], /^<b>3\.<\/b> 🏮 19:30–22:00 .*Lantern Walk on the Mere<\/a> · 2 days \(dates not yet confirmed\)$/);
  assert.match(items[3], /^<b>4\.<\/b> 📅 .*Founders' Day<\/a>$/);
  assert.ok(lines.includes('<i>Paper lanterns along the boardwalk at dusk; flat and easy, about an hour.</i>'));
  assert.ok(lines.includes('🌱 Vegetarian noodles at the boathouse stall. · 💴 free · 🎟 No booking; arrive before 19:15.'));
  assert.equal(lines[lines.length - 1], 'Sources: <a href="https://whatson.example.org/quillmere">Quillmere what\'s on</a> · <a href="https://boardwalk.example.net/events">Mere Boardwalk events</a>');
  const k = key(ctx, BOARD.id);
  assert.match(k, /^k[0-9a-f]{12}$/);
  assert.deepEqual(buttons(m).filter((b) => b.callback_data).map((b) => [b.text, b.callback_data]), [
    ['➕ 1', 'wo:' + k + ':1.' + tag(ctx, BOARD.items[0].id)], ['➕ 2', 'wo:' + k + ':2.' + tag(ctx, BOARD.items[1].id)],
    ['➕ 3', 'wo:' + k + ':3.' + tag(ctx, BOARD.items[2].id)]], 'a holiday has no ➕');
  const web = buttons(m).filter((b) => b.web_app);
  assert.equal(web.length, 1);
  assert.match(web[0].web_app.url, /screen=whatson&trip=quillmere-2027&board=wo-20270501-quillmere$/);
  assert.equal(deliver(ctx, state, FIX.invalid[3]).rejected, 1, 'an invalid payload is rejected');
});

test('the card: a one-day board has no "All these days"; a long board stays under 4000 characters and ends "… and N more in the app"', () => {
  const { ctx, state } = fresh();
  const one = { ...J(BOARD), id: 'wo-20270501-quillmere-13', from: '2027-05-13', to: '2027-05-13' };
  one.items = [one.items[1], one.items[0], one.items[2]];   // on the 13th alone the 08:00 market comes first
  assert.equal(deliver(ctx, state, one).processed, 1);
  const t = texts(state).pop();
  assert.ok(!/All these days/.test(t));
  assert.match(t, /· Thu 13 May\n\n<b>Thu 13 May<\/b>/);
  const long = { ...J(BOARD), id: 'wo-20270501-quillmere-long' };
  long.items = Array.from({ length: 20 }, (_, i) => ({ ...J(BOARD.items[0]), id: 'reed-' + String(i).padStart(2, '0'), name: 'Reed ' + String(i).padStart(2, '0'),
    why: 'w'.repeat(200), food: 'f'.repeat(160), booking: 'b'.repeat(120), url: 'https://whatson.example.org/r' + i }));
  const before = sends(state).length;
  assert.equal(deliver(ctx, state, long).processed, 1);
  assert.equal(sends(state).length, before + 1, 'one message');
  const m = sends(state).pop();
  assert.ok(m.text.length <= 4000, 'length ' + m.text.length);
  const shown = m.text.split('\n').filter((l) => /^<b>\d+\.<\/b>/.test(l)).length;
  assert.ok(shown > 3 && shown < 20, 'shown ' + shown);
  assert.match(m.text, new RegExp('… and ' + (20 - shown) + ' more in the app'));
  assert.equal(buttons(m).filter((b) => b.callback_data).length, shown, 'buttons for the items shown');
});

test('choosing: ➕ asks "Which day?" when several days fit, a day button chooses; one fitting day chooses at once; ➕ again removes', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, BOARD);
  const k = key(ctx, BOARD.id), b = (n) => 'wo:' + k + ':' + n + '.' + tag(ctx, BOARD.items[n - 1].id);
  tap(ctx, state, b(1));
  let m = sends(state).pop();
  assert.equal(m.text, 'Which day for <b>Reed and Rush: Weavers of the Mere</b>?');
  assert.deepEqual(buttons(m).map((x) => [x.text, x.callback_data]), [['Wed 12 May', b(1) + ':20270512'], ['Thu 13 May', b(1) + ':20270513'], ['Fri 14 May', b(1) + ':20270514']]);
  assert.equal(J(ctx.tgWhatsonGet(BOARD.id)).chosen.length, 0, 'nothing chosen yet');
  tap(ctx, state, b(1) + ':20270513');
  m = sends(state).pop();
  assert.equal(m.text, '✅ <b>Reed and Rush: Weavers of the Mere</b> is chosen for Thu 13 May. The plan carries it when that day is planned.');
  assert.equal(buttons(m).length, 0, 'no planned day: no re-plan button');
  tap(ctx, state, b(2));   // the market runs on one of the trip's days only
  assert.match(sends(state).pop().text, /Thursday Quay Market<\/b> is chosen for Thu 13 May/);
  let chosen = J(ctx.tgWhatsonGet(BOARD.id)).chosen;
  assert.deepEqual(chosen.map((c) => [c.item, c.chosen_on]), [[BOARD.items[0].id, '2027-05-13'], [BOARD.items[1].id, '2027-05-13']]);
  assert.match(chosen[0].at, /^2027-05-01T12:00:00/);
  assert.deepEqual(JSON.parse(J(ctx.storeAll('WhatsOn'))[0].chosen_json).map((c) => Object.keys(c).sort()), [['at', 'chosen_on', 'item'], ['at', 'chosen_on', 'item']]);
  // the card now marks them
  tap(ctx, state, 'wo:' + k + ':s');
  m = sends(state).pop();
  assert.match(m.text, /Weavers of the Mere<\/a> · until Wed 30 Jun ✅/);
  assert.deepEqual(buttons(m).filter((x) => x.callback_data).map((x) => x.text), ['✅ 1', '✅ 2', '➕ 3']);
  // ➕ on a chosen item removes it
  const n = sends(state).length;
  tap(ctx, state, b(2));
  assert.equal(answers(state).pop().text, 'Removed — any day already planned keeps it until that day is re-planned');
  assert.equal(sends(state).length, n);
  assert.deepEqual(J(ctx.tgWhatsonGet(BOARD.id)).chosen.map((c) => c.item), [BOARD.items[0].id]);
  // a holiday cannot be chosen; a stale tag or an unknown board says so
  tap(ctx, state, b(4));
  assert.match(answers(state).pop().text, /for information only/);
  tap(ctx, state, 'wo:' + k + ':1.ffff');
  assert.match(answers(state).pop().text, /board has changed/);
  tap(ctx, state, 'wo:k000000000000:s');
  assert.match(answers(state).pop().text, /board is gone/);
  tap(ctx, state, b(3) + ':20270512');   // the lantern walk does not run on the 12th
  assert.match(answers(state).pop().text, /no longer fits/);
});

test('choosing: on a planned day the bot offers "🔁 Re-plan <day>", which opens the replan with `whatson { board, item }`', () => {
  const { ctx, state } = fresh();
  H.configureRoutine(ctx, state, 'PLAN');
  H.putEnvelope(state, H.envelope('plan_digest', digest(['2027-05-12', '2027-05-13', '2027-05-14'])));
  assert.equal(J(ctx.pollFromBrain()).processed, 1);
  deliver(ctx, state, BOARD);
  const k = key(ctx, BOARD.id), b3 = 'wo:' + k + ':3.' + tag(ctx, BOARD.items[2].id);
  tap(ctx, state, b3);
  assert.deepEqual(buttons(sends(state).pop()).map((x) => x.text), ['Thu 13 May', 'Fri 14 May']);
  tap(ctx, state, b3 + ':20270514');
  const m = sends(state).pop();
  assert.equal(m.text, '✅ <b>Lantern Walk on the Mere</b> is chosen for Fri 14 May. Day 3 is already planned — re-plan it to fit this in?');
  assert.deepEqual(buttons(m).map((x) => [x.text, x.callback_data]), [['🔁 Re-plan Fri 14 May', b3 + ':r']]);
  const before = requests(state).length;
  tap(ctx, state, b3 + ':r');
  const reqs = requests(state);
  assert.equal(reqs.length, before + 1);
  const p = reqs.filter((r) => r.payload.kind === 'replan')[0].payload;
  assert.deepEqual(pick(p), { trip: 'quillmere-2027' });
  assert.deepEqual([p.dates, p.whatson, p.reason, p.deliverables], [['2027-05-14'], { board: BOARD.id, item: 'lantern-walk-on-the-mere-0513' },
    'added Lantern Walk on the Mere from What\'s on', ['plan']]);
  assert.match(texts(state).pop(), /Fitting <b>Lantern Walk on the Mere<\/b> into day 3 \(Fri 14 May\)/);
});

test('the store: a re-delivered board replaces its row and keeps each choice whose item is still on it', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, BOARD);
  const rec = ctx.tgWhatsonGet(BOARD.id);
  ctx.tgWhatsonChoose(rec, rec.items[0], true, '2027-05-12');
  ctx.tgWhatsonChoose(ctx.tgWhatsonGet(BOARD.id), rec.items[1], true);
  const again = J(BOARD);
  again.items = again.items.filter((it) => it.id !== 'thursday-quay-market-0506');
  assert.equal(deliver(ctx, state, again).processed, 1);
  const rows = J(ctx.storeAll('WhatsOn'));
  assert.equal(rows.length, 1);
  assert.equal(String(rows[0].count), '3');
  assert.deepEqual(J(ctx.tgWhatsonGet(BOARD.id)).chosen.map((c) => [c.item, c.chosen_on]), [['reed-and-rush-weavers-of-the-mere-0401', '2027-05-12']]);
});

test('one choice per trip and place (C15 coordinator): the weekly check\'s newer board shows a choice made on an earlier one; ✅ there un-chooses it everywhere; choosing again moves it; the re-plan and the snapshot follow the board that holds it', () => {
  const { ctx, state } = fresh();
  H.configureRoutine(ctx, state, 'PLAN');
  H.putEnvelope(state, H.envelope('plan_digest', digest(['2027-05-12', '2027-05-13', '2027-05-14'])));
  assert.equal(J(ctx.pollFromBrain()).processed, 1);
  deliver(ctx, state, BOARD);
  const lantern = BOARD.items[2], NEXT = FIX.valid[2];   // NEXT: the weekly check's board of the same trip and place, a new id
  assert.equal(ctx.tgWhatsonChoose(ctx.tgWhatsonGet(BOARD.id), lantern, true, '2027-05-14').ok, true);
  ctx.__TEST_NOW = '2027-05-05T09:00:00Z';
  assert.equal(deliver(ctx, state, NEXT).processed, 1);
  const k2 = key(ctx, NEXT.id), b2 = 'wo:' + k2 + ':3.' + tag(ctx, lantern.id);
  const held = () => [J(ctx.tgWhatsonGet(BOARD.id)).chosen.map((c) => c.chosen_on), J(ctx.tgWhatsonGet(NEXT.id)).chosen.map((c) => c.chosen_on)];
  assert.deepEqual(held(), [['2027-05-14'], []], 'the earlier board holds it');
  // the newer board shows it: its card, the app, /whatson last
  tap(ctx, state, 'wo:' + k2 + ':s');
  let m = sends(state).pop();
  assert.match(m.text.split('\n').filter((l) => /Lantern Walk on the Mere/.test(l))[0], / ✅$/);
  assert.deepEqual(buttons(m).filter((x) => x.callback_data).map((x) => x.text), ['➕ 1', '➕ 2', '✅ 3']);
  const g = app(ctx, state, 'whatson.get', { id: NEXT.id }).board;
  assert.deepEqual([g.items[2].chosen_on, g.chosen, g.choices.map((c) => [c.item, c.chosen_on])], ['2027-05-14', 1, [[lantern.id, '2027-05-14']]]);
  assert.deepEqual(app(ctx, state, 'whatson.list').boards.map((b) => [b.id, b.chosen]), [[NEXT.id, 1], [BOARD.id, 1]]);
  say(ctx, state, '/whatson last');
  assert.deepEqual(texts(state).pop().split('\n').slice(1, 3), ['<b>1.</b> Quillmere · 12–14 May · 4 things · ✅ 1', '<b>2.</b> Quillmere · 12–14 May · 4 things · ✅ 1']);
  assert.deepEqual(J(ctx.tgWhatsonChosenSnapshot()).map((s) => [s.board, s.item, s.chosen_on]), [[BOARD.id, lantern.id, '2027-05-14']]);
  // its re-plan names the board that holds the choice
  const before = requests(state).length;
  const rp = ctx.tgWhatsonReplan(ctx.tgWhatsonGet(NEXT.id), lantern, { ack: false });
  assert.deepEqual([rp.ok, rp.day, rp.date], [true, 3, '2027-05-14']);
  assert.equal(requests(state).length, before + 1);
  assert.deepEqual(requests(state).filter((r) => r.payload.kind === 'replan')[0].payload.whatson, { board: BOARD.id, item: lantern.id });
  // ✅ on the newer board un-chooses it everywhere
  tap(ctx, state, b2);
  assert.equal(answers(state).pop().text, 'Removed — any day already planned keeps it until that day is re-planned');
  assert.deepEqual(held(), [[], []]);
  assert.deepEqual(J(ctx.tgWhatsonChosenSnapshot()), []);
  // ➕ there again asks which day and moves the choice to the newer board; choosing on the earlier one moves it back
  tap(ctx, state, b2);
  assert.equal(sends(state).pop().text, 'Which day for <b>Lantern Walk on the Mere</b>?');
  tap(ctx, state, b2 + ':20270513');
  assert.match(sends(state).pop().text, /^✅ <b>Lantern Walk on the Mere<\/b> is chosen for Thu 13 May\. Day 2 is already planned/);
  assert.deepEqual(held(), [[], ['2027-05-13']]);
  assert.deepEqual(J(ctx.tgWhatsonChosenSnapshot()).map((s) => [s.board, s.chosen_on]), [[NEXT.id, '2027-05-13']]);
  const r = app(ctx, state, 'whatson.choose', { id: BOARD.id, item: lantern.id, choose: true, chosen_on: '2027-05-14' });
  assert.deepEqual([r.ok, r.chosen_on, r.board.choices.map((c) => c.item)], [true, '2027-05-14', [lantern.id]]);
  assert.deepEqual(held(), [['2027-05-14'], []]);
  assert.equal(J(ctx.tgWhatsonChosenSnapshot()).length, 1);
  // another place's board, or the same place without the trip, is another set of choices
  deliver(ctx, state, { ...J(BOARD), id: 'wo-20270501-fernby-cross', place: { label: 'Fernby Cross', slug: 'fernby-cross' } });
  assert.deepEqual(buttons(sends(state).pop()).filter((x) => x.callback_data).map((x) => x.text), ['➕ 1', '➕ 2', '➕ 3']);
  deliver(ctx, state, { ...J(BOARD), id: 'wo-20270502-quillmere', created_on: '2027-05-02', trip: null });
  const o = app(ctx, state, 'whatson.get', { id: 'wo-20270502-quillmere' }).board;
  assert.deepEqual([o.chosen, o.choices, o.items[2].chosen_on], [0, [], null]);
});

test('the `whatson_chosen` snapshot (C15): chosen items newest first with the C15 fields, in state.json; a done trip\'s boards drop out', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, BOARD);
  ctx.tgWhatsonChoose(ctx.tgWhatsonGet(BOARD.id), BOARD.items[0], true, '2027-05-13');
  ctx.__TEST_NOW = '2027-05-01T13:00:00Z';
  ctx.tgWhatsonChoose(ctx.tgWhatsonGet(BOARD.id), BOARD.items[2], true, '2027-05-14');
  const snap = J(ctx.buildSnapshot()).whatson_chosen;
  assert.deepEqual(snap.map((s) => s.item), ['lantern-walk-on-the-mere-0513', 'reed-and-rush-weavers-of-the-mere-0401']);
  assert.deepEqual(snap[0], { board: BOARD.id, item: 'lantern-walk-on-the-mere-0513', trip: 'quillmere-2027', place: 'Quillmere', name: 'Lantern Walk on the Mere',
    kind: 'light_up', from: '2027-05-13', to: '2027-05-14', start: '19:30', end: '22:00', venue: BOARD.items[2].venue, url: BOARD.items[2].url,
    booking: BOARD.items[2].booking, chosen_on: '2027-05-14', chosen_at: snap[0].chosen_at });
  assert.match(snap[0].chosen_at, /^2027-05-01T13:00:00/);
  assert.deepEqual(Object.keys(snap[1]), ['board', 'item', 'trip', 'place', 'name', 'kind', 'from', 'to', 'start', 'end', 'venue', 'url', 'chosen_on', 'chosen_at']);
  // a board without a trip counts; a done trip's do not
  deliver(ctx, state, { ...J(BOARD), id: 'wo-20270501-fernby-cross', trip: null, place: { label: 'Fernby Cross', slug: 'fernby-cross' } });
  ctx.tgWhatsonChoose(ctx.tgWhatsonGet('wo-20270501-fernby-cross'), BOARD.items[1], true);
  ctx.tgTripUpsert({ ...FIX.trip, status: 'done' });
  assert.deepEqual(J(ctx.tgWhatsonChosenSnapshot()).map((s) => [s.board, s.item, s.trip]), [['wo-20270501-fernby-cross', 'thursday-quay-market-0506', null]]);
});

const choir = { id: 'harbour-choir-0512', name: 'Harbour Choir', kind: 'performance', from: '2027-05-12', to: '2027-05-12', start: '18:00',
  why: 'An evening of mere songs in the old boathouse.', url: 'https://whatson.example.org/choir', confidence: 'confirmed', labels: ['evening'] };

test('the weekly check\'s boards (auto) are silent unless something is new; then "New on in <place>" lists only the new items', () => {
  let { ctx, state } = fresh();
  deliver(ctx, state, BOARD);
  let n = sends(state).length;
  assert.equal(deliver(ctx, state, FIX.valid[2]).processed, 1, 'the auto board of the same trip and place, nothing new');
  assert.equal(sends(state).length, n, 'silent');
  const next = { ...J(FIX.valid[2]), id: 'wo-20270512-quillmere', created_on: '2027-05-12' };
  next.items.splice(1, 0, choir);
  assert.equal(deliver(ctx, state, next).processed, 1);
  assert.equal(sends(state).length, n + 1);
  const m = sends(state).pop();
  assert.match(m.text, /^🗓 <b>New on in Quillmere<\/b> · 12–14 May\n/);
  const items = m.text.split('\n').filter((l) => /^<b>\d+\.<\/b>/.test(l));
  assert.deepEqual(items, ['<b>1.</b> 🎭 18:00 <a href="https://whatson.example.org/choir">Harbour Choir</a>']);
  assert.deepEqual(buttons(m).filter((b) => b.callback_data).map((b) => b.callback_data), ['wo:' + key(ctx, next.id) + ':2.' + tag(ctx, choir.id)]);
  assert.equal(J(ctx.storeAll('WhatsOn')).length, 3, 'every board is stored');

  ({ ctx, state } = fresh());
  deliver(ctx, state, FIX.valid[2]);
  assert.equal(sends(state).filter((x) => /New on in Quillmere/.test(x.text)).length, 1, 'no earlier board: everything is new');
  assert.equal(sends(state).pop().text.split('\n').filter((l) => /^<b>\d+\.<\/b>/.test(l)).length, 4);
});

test('alarm tg_whatson: 21 days before the trip at 09:00, then weekly to its last day; skips while a request is open; off and done trips have none', () => {
  const { ctx, state } = fresh({ now: '2027-04-01T12:00:00Z' });
  const A = ctx.HB_REGISTRY.alarm.tg_whatson, tz = ctx.tgTripTz(FIX.trip.slug), at = (d) => ctx.msAtLocal(tz, d, 9, 0);
  assert.equal(A.next(Date.parse('2027-04-01T12:00:00Z')), at('2027-04-21'));
  // through the one alarm trigger, as Apps Script runs it
  ctx.alarmArm();
  ctx.__TEST_NOW = new Date(at('2027-04-21')).toISOString();
  H.fireTriggers(ctx, state, 'alarmTrigger');
  let reqs = requests(state);
  assert.equal(reqs.length, 1);
  assert.deepEqual(pick(reqs[0].payload), { trip: 'quillmere-2027', from: '2027-05-12', to: '2027-05-14', auto: true });
  assert.equal(sends(state).length, 0, 'no acknowledgement');
  assert.deepEqual(JSON.parse(ctx.settingGet('tg_whatson_checks', '{}')), { 'quillmere-2027': '2027-04-21' });
  // a week later, still open: held an hour at a time and nothing opened
  const wk = at('2027-04-28');
  ctx.__TEST_NOW = new Date(wk).toISOString();
  assert.equal(A.next(wk), wk + 3600000);
  A.run(wk);
  assert.equal(requests(state).length, 1);
  ctx.storeUpdateById('Requests', reqs[0].id, { status: 'answered' });
  assert.equal(A.next(wk), wk);
  A.run(wk);
  assert.equal(requests(state).length, 2);
  // during the trip: the window starts at the trip's today; after the last check day there is none
  ctx.storeUpdateById('Requests', requests(state)[1].id, { status: 'answered' });
  ctx.settingSet('tg_whatson_checks', JSON.stringify({ 'quillmere-2027': '2027-05-06' }), 'test');
  const d13 = at('2027-05-13');
  assert.equal(A.next(d13), d13);
  ctx.__TEST_NOW = new Date(d13).toISOString();
  A.run(d13);
  reqs = requests(state);
  assert.deepEqual(pick(reqs.filter((r) => r.payload.from === '2027-05-13')[0].payload), { trip: 'quillmere-2027', from: '2027-05-13', to: '2027-05-14', auto: true });
  ctx.storeUpdateById('Requests', reqs[2].id, { status: 'answered' });
  assert.equal(A.next(d13), null, 'the next check (20 May) is after the last day');
  // off, and done trips
  ctx.settingSet('tg_whatson_checks', '{}', 'test');
  ctx.__TEST_NOW = '2027-04-01T12:00:00Z';
  say(ctx, state, '/whatson auto off');
  assert.match(texts(state).pop(), /weekly What's on check is off/);
  assert.equal(A.next(Date.parse('2027-04-01T12:00:00Z')), null);
  say(ctx, state, '/whatson auto on');
  assert.equal(ctx.settingGet('whatson_auto', ''), 'on');
  assert.equal(A.next(Date.parse('2027-04-01T12:00:00Z')), at('2027-04-21'));
  ctx.tgTripUpsert({ ...FIX.trip, status: 'done' });
  assert.equal(A.next(Date.parse('2027-04-01T12:00:00Z')), null);
});

test('/whatson last: the last 10 boards with 🗓 buttons that resend one', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/whatson last');
  assert.match(texts(state).pop(), /No What's on boards yet/);
  deliver(ctx, state, BOARD);
  ctx.__TEST_NOW = '2027-05-01T13:00:00Z';
  deliver(ctx, state, FIX.valid[1]);
  say(ctx, state, '/whatson last');
  const m = sends(state).pop();
  assert.deepEqual(m.text.split('\n').slice(0, 3), ['🗓 <b>Your last What\'s on boards</b>', '<b>1.</b> Fernby Cross · Mon 10 May · 0 things', '<b>2.</b> Quillmere · 12–14 May · 4 things']);
  const cb = buttons(m).filter((b) => b.callback_data);
  assert.deepEqual(cb.map((b) => [b.text, b.callback_data]), [['🗓 1', 'wo:' + key(ctx, FIX.valid[1].id) + ':s'], ['🗓 2', 'wo:' + key(ctx, BOARD.id) + ':s']]);
  tap(ctx, state, cb[1].callback_data);
  assert.match(texts(state).pop(), /^🗓 <b>What's on in Quillmere<\/b> · 12–14 May/);
});

test('app whatson.list and whatson.get: heads, then the board with each item\'s days, the days it can be chosen for and the planned dates', () => {
  const { ctx, state } = fresh();
  H.putEnvelope(state, H.envelope('plan_digest', digest(['2027-05-12', '2027-05-13'])));
  ctx.pollFromBrain();
  deliver(ctx, state, BOARD);
  const list = app(ctx, state, 'whatson.list');
  assert.equal(list.ok, true);
  assert.equal(list.total, 1);
  assert.deepEqual(list.boards[0], { id: BOARD.id, trip: 'quillmere-2027', place: BOARD.place, from: '2027-05-12', to: '2027-05-14', created_on: '2027-05-01',
    auto: false, count: 4, chosen: 0, received_at: list.boards[0].received_at });
  const b = app(ctx, state, 'whatson.get', { id: BOARD.id }).board;
  assert.deepEqual(b.items.map((it) => [it.id, it.days_in, it.choosable, it.choose_days, it.chosen_on]), [
    ['reed-and-rush-weavers-of-the-mere-0401', ['2027-05-12', '2027-05-13', '2027-05-14'], true, ['2027-05-12', '2027-05-13', '2027-05-14'], null],
    ['thursday-quay-market-0506', ['2027-05-13'], true, ['2027-05-13'], null],
    ['lantern-walk-on-the-mere-0513', ['2027-05-13', '2027-05-14'], true, ['2027-05-13', '2027-05-14'], null],
    ['quillmere-founders-day-0514', ['2027-05-14'], false, [], null]]);
  assert.equal(b.items[2].venue.name, 'Mere Boardwalk');
  assert.deepEqual([b.sources, b.left_out, b.choices, b.planned, b.trip_title], [BOARD.sources, BOARD.left_out, [], ['2027-05-12', '2027-05-13'], 'Quillmere']);
  assert.equal(app(ctx, state, 'whatson.get', { id: 'wo-20270501-nowhere' }).reason, 'no_whatson');
  assert.equal(app(ctx, state, 'whatson.get', { id: 'not-a-board' }).reason, 'bad_args');
});

test('app whatson.choose: the buttons\' rules (which day, not choosable, no item), un-choosing, and replan: true on a planned day', () => {
  const { ctx, state } = fresh();
  H.configureRoutine(ctx, state, 'PLAN');
  H.putEnvelope(state, H.envelope('plan_digest', digest(['2027-05-12', '2027-05-13'])));
  ctx.pollFromBrain();
  deliver(ctx, state, BOARD);
  const choose = (args) => app(ctx, state, 'whatson.choose', { id: BOARD.id, ...args });
  let r = choose({ item: 'reed-and-rush-weavers-of-the-mere-0401', choose: true });
  assert.deepEqual([r.ok, r.reason, r.days], [false, 'which_day', ['2027-05-12', '2027-05-13', '2027-05-14']]);
  assert.equal(choose({ item: 'quillmere-founders-day-0514', choose: true }).reason, 'not_choosable');
  assert.equal(choose({ item: 'no-such-thing', choose: true }).reason, 'no_item');
  assert.equal(choose({ item: 'thursday-quay-market-0506', choose: true, chosen_on: '2027-05-12' }).reason, 'bad_day');
  assert.equal(choose({ item: 'thursday-quay-market-0506' }).reason, 'missing_arg');
  r = choose({ item: 'reed-and-rush-weavers-of-the-mere-0401', choose: true, chosen_on: '2027-05-14' });
  assert.deepEqual([r.ok, r.chosen, r.chosen_on, r.planned, r.replan], [true, true, '2027-05-14', false, null], 'the 14th has no plan');
  assert.equal(r.board.items[0].chosen_on, '2027-05-14');
  const before = requests(state).length;
  r = choose({ item: 'thursday-quay-market-0506', choose: true, replan: true });
  assert.deepEqual([r.chosen_on, r.planned, r.replan.day, r.replan.date], ['2027-05-13', true, 2, '2027-05-13']);
  const rp = requests(state).filter((q) => q.payload.kind === 'replan');
  assert.equal(requests(state).length, before + 1);
  assert.deepEqual(rp[0].payload.whatson, { board: BOARD.id, item: 'thursday-quay-market-0506' });
  r = choose({ item: 'thursday-quay-market-0506', choose: false });
  assert.deepEqual([r.ok, r.chosen, r.message], [true, false, 'Removed — any day already planned keeps it until that day is re-planned']);
  assert.deepEqual(r.board.choices.map((c) => c.item), ['reed-and-rush-weavers-of-the-mere-0401']);
});

test('app whatson.new: opens the request as /whatson does, with the same refusals', () => {
  let { ctx, state } = fresh();
  let r = app(ctx, state, 'whatson.new', { place: 'Fernby Cross', from: '2027-05-20', to: '2027-05-22' });
  assert.equal(r.ok, true);
  assert.deepEqual(pick(requests(state)[0].payload), { place: 'Fernby Cross', from: '2027-05-20', to: '2027-05-22', dates_given: true });
  assert.deepEqual(r.request, { place: 'Fernby Cross', from: '2027-05-20', to: '2027-05-22', dates_given: true });
  assert.equal(r.request_id, requests(state)[0].id);
  r = app(ctx, state, 'whatson.new', {});
  assert.deepEqual(pick(requests(state)[1].payload), { trip: 'quillmere-2027', from: '2027-05-12', to: '2027-05-14' });
  assert.equal(app(ctx, state, 'whatson.new', { place: 'Fernby Cross', from: '2027-05-20', to: '2027-07-01' }).reason, 'too_long');
  assert.equal(app(ctx, state, 'whatson.new', { place: 'Fernby Cross', from: '2027-04-20' }).reason, 'past');
  assert.equal(app(ctx, state, 'whatson.new', { from: '2027-13-20' }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'whatson.new', { place: 'x'.repeat(81) }).reason, 'too_long');
  ({ ctx, state } = fresh({ trip: false }));
  assert.equal(app(ctx, state, 'whatson.new', {}).reason, 'no_place');
  assert.equal(requests(state).length, 0);
});

test('without `whatson` in helper.json the handler is not registered and the envelope is rejected; the chat side still works', () => {
  const { ctx, state } = fresh({ manifest: { ...MANIFEST, envelope_types: MANIFEST.envelope_types.filter((t) => t !== 'whatson') } });
  assert.equal(ctx.getEnvelopeHandler('whatson'), null);
  assert.equal(deliver(ctx, state, BOARD).rejected, 1);
  assert.equal(J(ctx.storeAll('WhatsOn')).length, 0);
  say(ctx, state, '/whatson');
  assert.equal(requests(state).length, 1);
});

// Developed by: LightAISolutions

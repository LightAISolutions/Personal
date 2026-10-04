'use strict';
// Tour Guide — the daytrip branch (TG-PHASE-15 WP-15a, Contract C15), core side, part 2: the `daytrip` envelope is stored
// in the DayTrips tab and the card sent; a re-delivery keeps what was kept; the dt buttons keep, un-keep, put a kept trip
// on a planned day (a replan) and resend; /daytrips; state.json `daytrips_kept`; the app ops daytrip.list / get / keep /
// new. Part 1: tests/pack_tour-guide_daytrip.test.js. Invented data only (Bramblecombe, Quillmere); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');

const PACK_DIR = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide');
const FIX = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'daytrip', 'fixtures', 'daytrip-sample.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'helper.json'), 'utf8'));
const NOW = '2027-05-01T12:00:00Z';
const SHELL = 'https://app.example.invalid/helper-app.html';
const TRIP = FIX.trip.slug;
const BOARD = FIX.valid[0].id;
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh(o = {}) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW, manifest: MANIFEST });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'RESEARCH');
  H.configureRoutine(ctx, state, 'PLAN');
  if (o.shell !== false) state.props[ctx.PROP.APP_SHELL_URL] = SHELL;
  if (o.trip !== false) ctx.tgTripUpsert(FIX.trip);
  return { ctx, state };
}
const post = (ctx, state, upd) => ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, upd));
const say = (ctx, state, text) => post(ctx, state, H.tgUpdate({ text }));
const tap = (ctx, state, data) => post(ctx, state, H.tgUpdate({ callback: data }));
const sends = (state) => state.fetch.telegram('sendMessage').map((r) => r.json);
const texts = (state) => sends(state).map((m) => m.text);
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
const marks = (state) => state.fetch.telegram('editMessageReplyMarkup').map((r) => r.json);
const buttons = (m) => (m && m.reply_markup ? m.reply_markup.inline_keyboard.flat() : []);
const app = (ctx, state, op, args) => J(H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args }));
const requests = (state) => (state.drive.listFiles(MANIFEST.drive_root + '/mailbox/to-brain') || []).filter((n) => /^req_/.test(n))
  .map((n) => JSON.parse(state.drive.readFile(MANIFEST.drive_root + '/mailbox/to-brain', n)));
const ask = (r) => { const o = { ...r.payload }; ['kind', 'text', 'chat', 'requested_at', 'upload_key', 'lodging_fp', 'trip_update'].forEach((k) => delete o[k]); return o; };
const deliver = (ctx, state, type, payload) => { H.putEnvelope(state, H.envelope(type, payload)); return J(ctx.pollFromBrain()); };
const key = (ctx, id = BOARD) => ctx.tgDaytripKey(id);
const digest = () => ({ v: 1, kind: 'plan_digest', trip: TRIP, build_id: 'build-dt-1', verified_on: '2027-04-30',
  days: ['2027-05-12', '2027-05-13', '2027-05-14'].map((date) => ({ date, theme: 'Quillmere', stops: [], legs: [], warnings: [] })),
  later: [], drive: { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null } });
/** FIX.valid[0] with a third item, Fernwick (n 3), so a re-delivery can drop one and reorder the rest. */
const fernwick = () => ({ ...J(FIX.valid[0].items[1]), n: 3, slug: 'fernwick', name: 'Fernwick', closed: undefined, labels: ['gem'],
  maps_url: 'https://www.google.com/maps/search/?api=1&query=fernwick', ride: { minutes: 75, estimated: false } });
function board3() { const p = J(FIX.valid[0]); const f = fernwick(); delete f.closed; p.items.push(f); return p; }

test('the daytrip envelope: one DayTrips row per board, and the card — header, numbered lines with ride and length, why, 🌱 🍂 ⛔, ➕ buttons 4 to a row, 📱; nothing left out in the chat', () => {
  const { ctx, state } = fresh();
  const r = deliver(ctx, state, 'daytrip', FIX.valid[0]);
  assert.equal(r.processed, 1, JSON.stringify(r));
  const rows = J(ctx.storeAll('DayTrips'));
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].id, rows[0].trip, rows[0].base_label, rows[0].created_on, rows[0].max_minutes, rows[0].date, rows[0].count, rows[0].kept_json],
    [BOARD, TRIP, 'Bramblecombe', '2027-05-10', 90, '', 2, '[]']);
  assert.deepEqual(JSON.parse(rows[0].payload_json), FIX.valid[0]);
  const card = sends(state).at(-1), t = card.text;
  assert.match(t, /^🚆 <b>Day trips from Bramblecombe<\/b> · under 90 min\n/);
  assert.match(t, /<b>1\.<\/b> <a href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=lockford">Lockford<\/a> — 🚆 ~42 min · full day\n<i>Canal locks, a reed-bed walk/);
  assert.match(t, /\n🌱 The lockside bakery marks vegetarian pies/);
  assert.match(t, /\n🍂 Water lilies on the canal in May\./);
  assert.match(t, /<b>2\.<\/b> <a [^>]+>Saltmere Head<\/a> — 🚆 ~64 min · half day\n<i>Sea cliffs/);
  assert.match(t, /\n⛔ Closed Thu 13 May/);
  assert.match(t, /…and 2 more within reach\./);
  assert.ok(!/Farhaven|Cherryfield|too far|out of season/.test(t), 'what was left out stays in the app');
  const kb = card.reply_markup.inline_keyboard;
  assert.deepEqual(kb[0].map((b) => [b.text, b.callback_data]), [['➕ 1', 'dt:' + key(ctx) + ':1'], ['➕ 2', 'dt:' + key(ctx) + ':2']]);
  assert.match(key(ctx), /^k[0-9a-f]{12}$/);
  assert.equal(kb[1][0].text, '📱 Open in the app');
  assert.match(kb[1][0].web_app.url, /screen=daytrip&trip=quillmere-2027&daytrip=dt-20270510-bramblecombe$/);
  // eight items: ➕ buttons four to a row
  const eight = J(FIX.valid[0]);
  eight.id = 'dt-20270510-eight';
  eight.date = '2027-05-13';
  eight.items = Array.from({ length: 8 }, (_, i) => ({ ...J(FIX.valid[0].items[0]), n: i + 1, slug: 'town-' + (i + 1), name: 'Town ' + (i + 1) }));
  assert.equal(deliver(ctx, state, 'daytrip', eight).processed, 1);
  assert.deepEqual(sends(state).at(-1).reply_markup.inline_keyboard.map((row) => row.length), [4, 4, 1]);
  assert.match(sends(state).at(-1).text, /^🚆 <b>Day trips from Bramblecombe<\/b> · under 90 min · Thu 13 May\n/, 'the asked date in the header');
});

test('the daytrip envelope: a board without a trip is stored and says so plainly; a board naming a trip the core does not know is rejected', () => {
  const { ctx, state } = fresh({ shell: false });
  assert.equal(deliver(ctx, state, 'daytrip', FIX.valid[1]).processed, 1);
  const card = sends(state).at(-1);
  assert.match(card.text, /^🚆 <b>Day trips from Wyvern Cross<\/b> · under 30 min\nNothing worth the ride this time\.$/);
  assert.equal(card.reply_markup, undefined, 'nothing to keep and no app shell: no keyboard');
  assert.equal(J(ctx.storeAll('DayTrips'))[0].trip, '');
  const stray = { ...J(FIX.valid[0]), id: 'dt-20270510-stray', trip: 'no-such-trip' };
  assert.equal(deliver(ctx, state, 'daytrip', stray).rejected, 1);
  assert.equal(deliver(ctx, state, 'daytrip', FIX.invalid[3]).rejected, 1, 'an invalid payload is rejected');
  assert.equal(J(ctx.storeAll('DayTrips')).length, 1);
});

test('keep: dt:<key>:<n> keeps and un-keeps, answers Kept / Removed and re-marks the keyboard with ✅; without planned days no day question', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'daytrip', FIX.valid[0]);
  const before = sends(state).length;
  tap(ctx, state, 'dt:' + key(ctx) + ':1');
  assert.deepEqual(answers(state), ['Kept']);
  assert.deepEqual(marks(state)[0].reply_markup.inline_keyboard[0].map((b) => b.text), ['✅ 1', '➕ 2']);
  const kept = JSON.parse(J(ctx.storeAll('DayTrips'))[0].kept_json);
  assert.deepEqual(kept.map((k) => [k.n, k.slug, k.date]), [[1, 'lockford', undefined]]);
  assert.match(kept[0].at, /^2027-05-01T12:00:00/);
  assert.equal(sends(state).length, before, 'the trip has no planned days: no "Put … on a day?"');
  tap(ctx, state, 'dt:' + key(ctx) + ':1');
  assert.deepEqual(answers(state), ['Kept', 'Removed']);
  assert.deepEqual(marks(state)[1].reply_markup.inline_keyboard[0].map((b) => b.text), ['➕ 1', '➕ 2']);
  assert.equal(J(ctx.storeAll('DayTrips'))[0].kept_json, '[]');
  // buttons that do not fit are refused, and nothing changes
  for (const d of ['dt:' + key(ctx) + ':9', 'dt:' + key(ctx) + ':x', 'dt:' + key(ctx), 'dt:k000000000000:1']) tap(ctx, state, d);
  assert.deepEqual(answers(state).slice(2), ['Unknown button', 'Unknown button', 'Unknown button', 'That board is gone — send /daytrips.']);
  tap(ctx, state, 'dt:' + key(ctx) + ':5');
  assert.equal(answers(state).at(-1), 'That trip is gone — send /daytrips.');
  assert.equal(requests(state).length, 0);
});

test('put on a day: a keep on a trip with planned days asks "Put <name> on a day?"; a day tap stores the date and opens the replan, with the old date when it moves', () => {
  const { ctx, state } = fresh();
  assert.equal(deliver(ctx, state, 'plan_digest', digest()).processed, 1);
  deliver(ctx, state, 'daytrip', FIX.valid[0]);
  tap(ctx, state, 'dt:' + key(ctx) + ':1');
  const q = sends(state).at(-1);
  assert.equal(q.text, 'Put <b>Lockford</b> on a day?');
  assert.deepEqual(buttons(q).map((b) => [b.text, b.callback_data]), [['1 · Wed 12 May', 'dt:' + key(ctx) + ':1.1'], ['2 · Thu 13 May', 'dt:' + key(ctx) + ':1.2'], ['3 · Fri 14 May', 'dt:' + key(ctx) + ':1.3']]);
  tap(ctx, state, 'dt:' + key(ctx) + ':1.2');
  assert.equal(answers(state).at(-1), 'Replanning day 2');
  assert.deepEqual(marks(state).at(-1).reply_markup, { inline_keyboard: [] }, 'the day buttons are cleared');
  let reqs = requests(state).filter((r) => r.payload.kind === 'replan');
  assert.equal(reqs.length, 1);
  assert.deepEqual(ask(reqs[0]), { trip: TRIP, dates: ['2027-05-13'], daytrip: { board: BOARD, n: 1 }, reason: 'a day trip to Lockford', deliverables: ['plan'] });
  assert.match(texts(state).join('\n'), /🚆 Putting the day trip to <b>Lockford<\/b> on day 2 \(Thu 13 May\) — replanning that day…/);
  assert.deepEqual(JSON.parse(J(ctx.storeAll('DayTrips'))[0].kept_json).map((k) => [k.slug, k.date]), [['lockford', '2027-05-13']]);
  // moving it to day 3 replans both days
  tap(ctx, state, 'dt:' + key(ctx) + ':1.3');
  reqs = requests(state).filter((r) => r.payload.kind === 'replan');
  assert.deepEqual(reqs.map((r) => r.payload.dates).sort(), [['2027-05-13'], ['2027-05-14', '2027-05-13']]);
  assert.deepEqual(JSON.parse(J(ctx.storeAll('DayTrips'))[0].kept_json).map((k) => [k.slug, k.date]), [['lockford', '2027-05-14']]);
  // a day that is not planned is refused
  tap(ctx, state, 'dt:' + key(ctx) + ':1.9');
  assert.equal(answers(state).at(-1), 'That day has changed — send /daytrips.');
  // a board without a trip never asks for a day
  deliver(ctx, state, 'daytrip', { ...J(FIX.valid[0]), id: 'dt-20270510-no-trip', trip: null });
  const n = sends(state).length;
  tap(ctx, state, 'dt:' + key(ctx, 'dt-20270510-no-trip') + ':2');
  assert.equal(answers(state).at(-1), 'Kept');
  assert.equal(sends(state).length, n);
});

test('a re-delivered board replaces its row and keeps each kept entry still on it, renumbered, with its date', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'plan_digest', digest());
  deliver(ctx, state, 'daytrip', board3());
  tap(ctx, state, 'dt:' + key(ctx) + ':1');
  tap(ctx, state, 'dt:' + key(ctx) + ':3');
  tap(ctx, state, 'dt:' + key(ctx) + ':3.1');
  assert.deepEqual(JSON.parse(J(ctx.storeAll('DayTrips'))[0].kept_json).map((k) => [k.n, k.slug, k.date || null]), [[1, 'lockford', null], [3, 'fernwick', '2027-05-12']]);
  // the routine re-runs: Lockford is gone, Fernwick moved to first place
  const again = J(FIX.valid[0]);
  const f = fernwick(); delete f.closed; f.n = 1;
  again.items = [f, { ...again.items[1], n: 2 }];
  assert.equal(deliver(ctx, state, 'daytrip', again).processed, 1);
  const rows = J(ctx.storeAll('DayTrips'));
  assert.equal(rows.length, 1);
  assert.deepEqual(JSON.parse(rows[0].kept_json).map((k) => [k.n, k.slug, k.date || null]), [[1, 'fernwick', '2027-05-12']]);
  assert.deepEqual(sends(state).at(-1).reply_markup.inline_keyboard[0].map((b) => b.text), ['✅ 1', '➕ 2'], 'the new card shows what is still kept');
});

test('/daytrips: the last boards, kept trips first with ✅, 🚆 buttons that resend a board; empty: a hint', () => {
  const { ctx, state } = fresh();
  say(ctx, state, '/daytrips');
  assert.match(texts(state).at(-1), /No day trips yet/);
  deliver(ctx, state, 'daytrip', FIX.valid[0]);
  ctx.__TEST_NOW = '2027-05-01T13:00:00Z';
  deliver(ctx, state, 'daytrip', FIX.valid[1]);
  tap(ctx, state, 'dt:' + key(ctx) + ':2');
  say(ctx, state, '/daytrips');
  const m = sends(state).at(-1), lines = m.text.split('\n');
  assert.equal(lines[0], '🚆 <b>Your day trips</b>');
  assert.match(lines[1], /^✅ <a [^>]+>Saltmere Head<\/a> — from Bramblecombe · 🚆 ~64 min · half day$/);
  assert.match(lines[2], /^<b>1\.<\/b> From Wyvern Cross · under 30 min · 0 trips · asked Mon 10 May$/);
  assert.match(lines[3], /^<b>2\.<\/b> From Bramblecombe · under 90 min · 2 trips · asked Mon 10 May$/);
  const bs = buttons(m);
  assert.deepEqual(bs.slice(0, 2).map((b) => [b.text, b.callback_data]), [['🚆 1', 'dt:' + key(ctx, FIX.valid[1].id) + ':s'], ['🚆 2', 'dt:' + key(ctx) + ':s']]);
  assert.equal(bs[2].text, '📱 Day trips in the app');
  const n = sends(state).length;
  tap(ctx, state, 'dt:' + key(ctx) + ':s');
  assert.match(sends(state)[n].text, /^🚆 <b>Day trips from Bramblecombe<\/b>/);
  assert.deepEqual(sends(state).at(-1).reply_markup.inline_keyboard[0].map((b) => b.text), ['➕ 1', '✅ 2']);
});

test('state.json daytrips_kept (C15): kept trips of boards whose trip is not done and of boards without one, newest first, C15 fields only', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'plan_digest', digest());
  deliver(ctx, state, 'daytrip', FIX.valid[0]);
  deliver(ctx, state, 'daytrip', { ...J(FIX.valid[0]), id: 'dt-20270510-loose', trip: null, base: { label: 'Wyvern Cross', slug: 'wyvern-cross' } });
  assert.deepEqual(J(ctx.buildSnapshot()).daytrips_kept, []);
  tap(ctx, state, 'dt:' + key(ctx) + ':1');
  tap(ctx, state, 'dt:' + key(ctx) + ':1.2');
  ctx.__TEST_NOW = '2027-05-01T12:05:00Z';
  tap(ctx, state, 'dt:' + key(ctx, 'dt-20270510-loose') + ':2');
  const snap = J(ctx.buildSnapshot()).daytrips_kept;
  assert.deepEqual(snap, [
    { board: 'dt-20270510-loose', n: 2, trip: null, base: 'Wyvern Cross', name: 'Saltmere Head', slug: 'saltmere-head', length: 'half', ride_minutes: 64,
      stops: [{ name: 'Lighthouse path' }, { name: 'Seal cove' }], kept_at: snap[0].kept_at },
    { board: BOARD, n: 1, trip: TRIP, base: 'Bramblecombe', name: 'Lockford', slug: 'lockford', length: 'full', ride_minutes: 42,
      stops: [{ name: 'Flight of nine locks', place_id: 'FixtureDtLockFlight01' }, { name: 'Reed-bed boardwalk' }, { name: "Lock-keeper's museum", place_id: 'FixtureDtLockMuseum01' }],
      place_id: 'FixtureDtLockford01', date: '2027-05-13', kept_at: snap[1].kept_at }]);
  assert.ok(snap[0].kept_at > snap[1].kept_at, 'newest first');
  // a done trip's boards drop out; boards without a trip stay
  ctx.tgTripSetStatus(TRIP, 'done');
  assert.deepEqual(J(ctx.buildSnapshot()).daytrips_kept.map((k) => k.board), ['dt-20270510-loose']);
});

test('app daytrip.list and daytrip.get: heads newest first; a board with its items, more, left-out reasons in words, kept entries and the trip\'s planned days', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'plan_digest', digest());
  deliver(ctx, state, 'daytrip', FIX.valid[0]);
  ctx.__TEST_NOW = '2027-05-01T13:00:00Z';
  deliver(ctx, state, 'daytrip', FIX.valid[1]);
  tap(ctx, state, 'dt:' + key(ctx) + ':1');
  const list = app(ctx, state, 'daytrip.list');
  assert.equal(list.ok, true);
  assert.equal(list.total, 2);
  assert.deepEqual(list.boards.map((b) => [b.id, b.trip, b.base, b.count, b.kept]), [[FIX.valid[1].id, null, 'Wyvern Cross', 0, 0], [BOARD, TRIP, 'Bramblecombe', 2, 1]]);
  assert.deepEqual(Object.keys(list.boards[1]).sort(), ['base', 'count', 'created_on', 'date', 'id', 'kept', 'max_minutes', 'received_at', 'trip']);
  assert.deepEqual(list.kept_trips, J(ctx.buildSnapshot()).daytrips_kept, 'the kept trips, by the snapshot\'s rule');
  assert.deepEqual(list.kept_trips.map((k) => [k.board, k.n, k.name]), [[BOARD, 1, 'Lockford']]);
  const got = app(ctx, state, 'daytrip.get', { id: BOARD }).board;
  assert.deepEqual(got.items, FIX.valid[0].items);
  assert.equal(got.more, 2);
  assert.deepEqual(got.left_out, [{ name: 'Farhaven', reason: 'too_far', words: 'too far' }, { name: 'Cherryfield', reason: 'out_of_season', words: 'out of season' }]);
  assert.deepEqual(got.kept_entries.map((k) => [k.n, k.slug]), [[1, 'lockford']]);
  assert.deepEqual(got.days, [{ n: 1, date: '2027-05-12' }, { n: 2, date: '2027-05-13' }, { n: 3, date: '2027-05-14' }]);
  assert.equal(got.trip_title, 'Quillmere');
  assert.deepEqual(app(ctx, state, 'daytrip.get', { id: FIX.valid[1].id }).board.days, [], 'no trip, no day picker');
  assert.equal(app(ctx, state, 'daytrip.get', { id: 'dt-20270510-nowhere' }).reason, 'no_daytrip');
  assert.equal(app(ctx, state, 'daytrip.get', { id: 'Not An Id' }).reason, 'bad_args');
  // a Maps link the chat would not show is not shown in the app either
  deliver(ctx, state, 'daytrip', { ...J(FIX.valid[0]), id: 'dt-20270510-odd-link', items: [{ ...J(FIX.valid[0].items[0]), maps_url: 'https://maps.example.invalid/lockford' }] });
  assert.equal(app(ctx, state, 'daytrip.get', { id: 'dt-20270510-odd-link' }).board.items[0].maps_url, '');
});

test('app daytrip.keep: keep and un-keep with the buttons\' rules; a date opens the replan; unknown items, unplanned days and bad arguments are refused', () => {
  const { ctx, state } = fresh();
  deliver(ctx, state, 'plan_digest', digest());
  deliver(ctx, state, 'daytrip', FIX.valid[0]);
  let r = app(ctx, state, 'daytrip.keep', { id: BOARD, n: 2, keep: true });
  assert.equal(r.ok, true);
  assert.deepEqual([r.kept, r.kept_entries.map((k) => k.slug), r.replan], [true, ['saltmere-head'], undefined]);
  r = app(ctx, state, 'daytrip.keep', { id: BOARD, n: 1, keep: true, date: '2027-05-14' });
  assert.deepEqual(r.kept_entries.map((k) => [k.slug, k.date || null]), [['lockford', '2027-05-14'], ['saltmere-head', null]]);
  assert.deepEqual([r.replan.dates, r.replan.day], [['2027-05-14'], 3]);
  const rq = requests(state).filter((x) => x.payload.kind === 'replan');
  assert.deepEqual(rq.map((x) => [x.id === r.replan.request_id, ask(x)]), [[true, { trip: TRIP, dates: ['2027-05-14'], daytrip: { board: BOARD, n: 1 }, reason: 'a day trip to Lockford', deliverables: ['plan'] }]]);
  r = app(ctx, state, 'daytrip.keep', { id: BOARD, n: 2, keep: false });
  assert.deepEqual(r.kept_entries.map((k) => k.slug), ['lockford']);
  const no = (args) => app(ctx, state, 'daytrip.keep', args).reason;
  assert.equal(no({ id: BOARD, n: 1, keep: true, date: '2027-05-20' }), 'no_day');
  assert.equal(no({ id: BOARD, n: 1, keep: false, date: '2027-05-13' }), 'bad_args');
  assert.equal(no({ id: BOARD, n: 1, keep: true, date: '2027-02-30' }), 'bad_args');
  assert.equal(no({ id: BOARD, n: 5, keep: true }), 'no_item');
  assert.equal(no({ id: BOARD, n: 9, keep: true }), 'bad_args');
  assert.equal(no({ id: BOARD, n: 1 }), 'missing_arg');
  assert.equal(no({ id: BOARD, n: '1', keep: true }), 'bad_args');
  assert.equal(no({ id: 'dt-20270510-nowhere', n: 1, keep: true }), 'no_daytrip');
  deliver(ctx, state, 'daytrip', FIX.valid[1]);
  const loose = { ...J(FIX.valid[0]), id: 'dt-20270510-loose', trip: null };
  deliver(ctx, state, 'daytrip', loose);
  assert.equal(no({ id: 'dt-20270510-loose', n: 1, keep: true, date: '2027-05-13' }), 'no_trip');
  assert.equal(requests(state).filter((x) => x.payload.kind === 'replan').length, 1, 'only the one replan');
});

test('app daytrip.new: opens the request as /daytrip does — from, minutes clamped, the command\'s date words; no base and no trip is refused', () => {
  let { ctx, state } = fresh();
  let r = app(ctx, state, 'daytrip.new', { from: 'Bramblecombe', under: 45, date: '5/13' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.trip, r.from, r.max_minutes, r.date, r.routine], [TRIP, 'Bramblecombe', 45, '2027-05-13', 'RESEARCH']);
  const q = requests(state)[0];
  assert.equal(q.id, r.request_id);
  assert.deepEqual(ask(q), { trip: TRIP, from: 'Bramblecombe', date: '2027-05-13', max_minutes: 45 });
  assert.equal(q.payload.text, '/daytrip from Bramblecombe under 45 min on 2027-05-13');
  r = app(ctx, state, 'daytrip.new', { under: 400, date: 'tomorrow' });
  assert.deepEqual([r.from, r.max_minutes, r.date], ['', 180, '2027-05-02']);
  assert.equal(app(ctx, state, 'daytrip.new', {}).max_minutes, 90);
  assert.equal(app(ctx, state, 'daytrip.new', { under: 10 }).max_minutes, 30);
  const no = (args) => app(ctx, state, 'daytrip.new', args).reason;
  assert.equal(no({ date: '2027-04-01' }), 'past_date');
  assert.equal(no({ date: 'someday' }), 'bad_date');
  assert.equal(no({ under: '90' }), 'bad_args');
  assert.equal(no({ from: 'B'.repeat(81) }), 'too_long');
  assert.equal(no({ where: 'Bramblecombe' }), 'bad_args');
  ({ ctx, state } = fresh({ trip: false }));
  assert.equal(app(ctx, state, 'daytrip.new', {}).reason, 'no_trip');
  assert.equal(requests(state).length, 0);
  r = app(ctx, state, 'daytrip.new', { from: 'Wyvern Cross' });
  assert.deepEqual(ask(requests(state)[0]), { from: 'Wyvern Cross', max_minutes: 90 });
});

// Developed by: LightAISolutions

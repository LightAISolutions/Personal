'use strict';
// Tour Guide — the quiet branch (TG-PHASE-16 WP-16a, Contract C16), core side, part 2, in the Lark Bay world: the 🕊 rows
// under a day (a crowd slot, a warned stop, the cap of two, a recent board resent, the request a tap opens, a changed
// day, a past day), the warning mirror's parity with the planner's noQuietSlotText, the day card and the morning message
// through the C16 hook, /quiet alone with coming stops, ➕ onto the right trip, and the five quiet.* app ops.
// Invented data only; no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = require('./pack_tour-guide_phase12_world');
const { H, TRIP, DATES, J, at, day2, day3, digest, fresh, deliver, say, tap, sends, texts, reqOf, setNow } = W;

const PACK_DIR = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide');
const FIX = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'quiet', 'fixtures', 'quiet-sample.json'), 'utf8'));
const D2 = DATES[1], D3 = DATES[2];
const SHELL = 'https://app.example.invalid/helper-app.html';
const kbOf = (msgs) => J(msgs).filter((m) => m.keyboard).pop().keyboard.inline_keyboard;
const rowTexts = (rows) => rows.map((r) => r.map((b) => b.text));
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text);
const ask = (p) => { const o = { ...p }; ['kind', 'text', 'chat', 'requested_at', 'upload_key', 'lodging_fp', 'trip_update'].forEach((k) => delete o[k]); return o; };
const app = (ctx, state, op, args) => J(H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args }));
const NAV = ['◀ Day 1', 'Day 3 ▶'];
const LATE = ['⏰ Late 15 min', '30 min', '60 min'], REPLAN = ['📍 Re-plan from here'];
let P;
const planner = async () => (P = P || await import('../packs/tour-guide/planner/index.mjs'));

/** The world's digest with crowd times: Tide Hall timed for opening, Kite Museum and (in other case) Harbour Tower warned, Lantern Hall late. */
async function crowded() {
  const { noQuietSlotText } = await planner();
  const d2 = day2(), d3 = day3();
  d2.stops[0].crowd_slot = 'opening';
  d2.warnings = ['Bring a light jacket.', noQuietSlotText('Kite Museum', '15:00'), noQuietSlotText('harbour tower', '16:30'), noQuietSlotText('Nowhere Hall', '12:00')];
  d3.stops[1].crowd_slot = 'late';
  const d = digest();
  d.days = [d.days[0], d2, d3];
  return d;
}
/** A board in this world: FIX.valid[0] made Tide Hall's, on day 2. */
function board(over = {}) {
  const p = J(FIX.valid[0]);
  p.id = 'qt-20270611-tide-hall'; p.trip = TRIP; p.created_on = D2; p.date = D2;
  p.magnet = { ...p.magnet, name: 'Tide Hall', slug: 'tide-hall', place_id: 'FixtureLbTide01' };
  delete p.magnet.source;
  p.magnet.quiet = 'Quietest at opening (09:00)';
  return Object.assign(p, over);
}
async function world(now, o = {}) {
  const w = fresh(now || at(D2, '09:00'), { digest: await crowded() });
  w.state.props[w.ctx.PROP.APP_SHELL_URL] = SHELL;
  if (o.board) assert.equal(deliver(w.ctx, w.state, 'quiet', o.board === true ? board() : o.board).processed, 1);
  return w;
}
const views = (ctx, date = D2) => {
  const trip = ctx.tgTripGet(TRIP), day = ctx.tgDigestDay(TRIP, date);
  return { trip, day, card: () => kbOf(ctx.tgCmdDayMessages(trip, day, 3)), morning: () => kbOf(ctx.tgMorningMessages(trip, day, 3, null, false)) };
};

test('the warning mirror: TG_QUIET.WARN_RE reads back the stop name noQuietSlotText writes, a warning cut at 200 characters included', async () => {
  const { noQuietSlotText } = await planner();
  const { ctx } = fresh(at(D2, '09:00'));
  for (const name of ['Kite Museum', 'Hall: east wing', 'Hall (north) · old town', 'N'.repeat(120), 'Café “Ō”']) {
    const text = noQuietSlotText(name, '10:15');
    assert.deepEqual(J(ctx.tgQuietWarnedNames({ warnings: [text] })), [name], text);
    assert.deepEqual(J(ctx.tgQuietWarnedNames({ warnings: [{ text }] })), [name], 'a warning as { text }');
  }
  assert.equal(noQuietSlotText('N'.repeat(120), '10:15').length, 200, 'the long name\'s warning is the cut one');
  assert.deepEqual(J(ctx.tgQuietWarnedNames({ warnings: ['Kite Museum: closes early', 'no quieter slot fitted', 42, null] })), []);
  assert.deepEqual(J(ctx.tgQuietWarnedNames({})), []);
});

test('the day\'s 🕊 stops: crowd slots first, then warned stops (exact name, else ignoring case), each once, in stop order', async () => {
  const { ctx } = await world();
  const v = views(ctx);
  assert.deepEqual(J(ctx.tgQuietDayStops(v.day)).map((s) => s.slug), ['tide-hall', 'kite-museum', 'harbour-tower']);
  const day = J(v.day);
  day.warnings.push(day.warnings[1]);
  day.stops[3].crowd_slot = 'late';
  assert.deepEqual(J(ctx.tgQuietDayStops(day)).map((s) => s.slug), ['tide-hall', 'kite-museum', 'harbour-tower'], 'a stop once, the crowd slot first');
  day.stops.push({ n: 7, slug: 'old-tower', name: 'harbour tower', arrive: '19:00', depart: '19:30', minutes: 30, note_line: '' });
  assert.deepEqual(J(ctx.tgQuietDayStops(day)).map((s) => s.slug), ['tide-hall', 'kite-museum', 'old-tower'], 'the exact name over the case-blind one');
  day.stops.push({ n: 8, slug: 'Bad Slug', name: 'Kite Museum' }, { n: 9, slug: 'nameless', name: '  ', crowd_slot: 'late' });
  assert.deepEqual(J(ctx.tgQuietDayStops(day)).map((s) => s.slug), ['tide-hall', 'kite-museum', 'old-tower'], 'a stop needs a slug and a name');
  assert.deepEqual(J(ctx.tgQuietDayStops(views(ctx, DATES[0]).day)), [], 'a free day');
  assert.deepEqual(J(ctx.tgQuietDayStops(null)), []);
});

test('🕊 rows on the day card and the morning message: two at most, Quiet\'s data, nothing on a past day or without stops', async () => {
  const { ctx, state } = await world();
  const v = views(ctx), key = TRIP, d8 = D2.replace(/-/g, '');
  const want = [['🕊 Quieter than Tide Hall'], ['🕊 Quieter than Kite Museum']];
  const card = v.card(), morning = v.morning();
  assert.deepEqual(rowTexts(card), [...want, NAV]);
  assert.deepEqual(rowTexts(morning), [LATE, REPLAN, ...want]);
  assert.deepEqual(card.slice(0, 2).map((r) => r[0].callback_data), ['tide-hall', 'kite-museum'].map((s) => 'qt:' + key + ':' + d8 + ':' + ctx.tgCmdTag(s)));
  card.flat().forEach((b) => assert.ok(Buffer.byteLength(b.callback_data || '') <= 64));
  // A long stop name is cut to 30 in the button.
  const day = J(v.day); day.stops[0].name = 'The Very Long Name Of A Tide Hall By The Sea';
  assert.equal(J(ctx.tgQuietDayRows(v.trip, day))[0][0].text, '🕊 Quieter than The Very Long Name Of A Tide …');
  // Day 3 (one crowd slot), day 1 (no stops); then day 2 seen from day 3: passed.
  assert.deepEqual(rowTexts(J(ctx.tgQuietDayRows(v.trip, views(ctx, D3).day))), [['🕊 Quieter than Lantern Hall']]);
  assert.deepEqual(J(ctx.tgQuietDayRows(v.trip, views(ctx, DATES[0]).day)), []);
  setNow(ctx, at(D3, '08:00'));
  assert.deepEqual(J(ctx.tgQuietDayRows(v.trip, v.day)), []);
  assert.deepEqual(J(ctx.tgQuietDayRows(null, v.day)), []);
  // /day itself carries them.
  setNow(ctx, at(D2, '09:00'));
  say(ctx, state, '/day 2');
  const m = sends(state).filter((x) => x.reply_markup).pop();
  assert.deepEqual(rowTexts(m.reply_markup.inline_keyboard).slice(0, 2), want);
});

test('a 🕊 tap opens the stop\'s quiet request — { trip, place, slug, date } — and a changed or past day asks nothing', async () => {
  const { ctx, state } = await world();
  const card = views(ctx).card();
  tap(ctx, state, card[1][0].callback_data);
  assert.equal(answers(state).at(-1), 'Asked');
  assert.deepEqual(reqOf(state, 'quiet').map(ask), [{ trip: TRIP, place: 'Kite Museum', slug: 'kite-museum', date: D2 }]);
  assert.equal(texts(state).at(-1), '🕊 Looking for places quieter than <b>Kite Museum</b>…');
  tap(ctx, state, 'qt:' + TRIP + ':' + D2.replace(/-/g, '') + ':ffff');
  assert.equal(answers(state).at(-1), 'That day has changed — send /day again.');
  tap(ctx, state, 'qt:' + TRIP + ':20270230:' + ctx.tgCmdTag('tide-hall'));
  assert.equal(answers(state).at(-1), 'That day has changed — send /day again.');
  setNow(ctx, at(D3, '08:00'));
  tap(ctx, state, card[0][0].callback_data);
  assert.equal(answers(state).at(-1), 'That day has passed.');
  assert.equal(reqOf(state, 'quiet').length, 1);
});

test('a recent board of the stop is resent instead: 30 days, this trip or none; an older or another trip\'s board asks again', async () => {
  let { ctx, state } = await world(null, { board: true });
  let card = views(ctx).card();
  const key = ctx.tgQuietKey('qt-20270611-tide-hall');
  assert.equal(card[0][0].text, '🕊 Quieter than Tide Hall');
  assert.equal(card[0][0].callback_data, 'qt:' + key + ':s');
  assert.match(card[1][0].callback_data, /^qt:lark-bay:20270611:[0-9a-f]{4}$/, 'Kite Museum has no board');
  const before = sends(state).length;
  tap(ctx, state, card[0][0].callback_data);
  assert.match(texts(state).slice(before).join('\n'), /^🕊 <b>Quieter than Tide Hall<\/b> · Fri 11 Jun/);
  assert.equal(reqOf(state, 'quiet').length, 0);
  // A board with no trip counts; one received 31 days before does not; another trip's does not.
  ({ ctx, state } = await world(null, { board: board({ trip: null }) }));
  assert.equal(views(ctx).card()[0][0].callback_data, 'qt:' + key + ':s');
  ({ ctx, state } = await world());
  setNow(ctx, new Date(Date.parse(at(D2, '09:00')) - 31 * 86400000).toISOString());
  assert.equal(deliver(ctx, state, 'quiet', board()).processed, 1);
  setNow(ctx, at(D2, '09:00'));
  assert.match(views(ctx).card()[0][0].callback_data, /^qt:lark-bay:/);
  ({ ctx, state } = await world());
  ctx.tgTripUpsert({ slug: 'fen-coast', title: 'Fen Coast', destination: 'Fen Coast', start: '2027-08-01', end: '2027-08-03', tz: 'UTC' });
  assert.equal(deliver(ctx, state, 'quiet', board({ trip: 'fen-coast' })).processed, 1);
  card = views(ctx).card();
  assert.match(card[0][0].callback_data, /^qt:lark-bay:/);
  assert.equal(ctx.tgQuietBoardFor(ctx.tgTripGet('fen-coast'), 'tide-hall').id, 'qt-20270611-tide-hall');
});

test('/quiet alone with coming stops: a 🕊 button per stop (by day), then the boards, then the how-to', async () => {
  const { ctx, state } = await world(null, { board: true });
  say(ctx, state, '/quiet');
  const m = sends(state).at(-1), rows = m.reply_markup.inline_keyboard;
  assert.equal(m.text.split('\n').slice(0, 4).join('\n'), ['🕊 <b>Quieter places</b>',
    'Coming stops your plan times around the crowds — tap one for quieter places nearby.', 'Your last boards:',
    '<b>1.</b> Quieter than Tide Hall · 3 places · Fri 11 Jun · asked Fri 11 Jun'].join('\n'));
  assert.ok(m.text.endsWith(ctx.TG_QUIET_USAGE));
  assert.deepEqual(rowTexts(rows), [['🕊 Tide Hall · day 2'], ['🕊 Kite Museum · day 2'], ['🕊 Harbour Tower · day 2'], ['🕊 Lantern Hall · day 3'], ['🔁 1']]);
  assert.equal(rows[0][0].callback_data, 'qt:' + ctx.tgQuietKey('qt-20270611-tide-hall') + ':s', 'its board resent');
  tap(ctx, state, rows[3][0].callback_data);
  assert.deepEqual(reqOf(state, 'quiet').map(ask), [{ trip: TRIP, place: 'Lantern Hall', slug: 'lantern-hall', date: D3 }]);
  // From day 3, day 2's stops are gone.
  setNow(ctx, at(D3, '08:00'));
  say(ctx, state, '/quiet');
  assert.deepEqual(rowTexts(sends(state).at(-1).reply_markup.inline_keyboard), [['🕊 Lantern Hall · day 3'], ['🔁 1']]);
});

test('➕ goes to the board\'s trip; to the current trip when the board\'s is done or it has none; no trip at all is an alert', async () => {
  let { ctx, state } = await world(null, { board: true });
  const key = ctx.tgQuietKey('qt-20270611-tide-hall');
  tap(ctx, state, 'qt:' + key + ':2');
  assert.equal(answers(state).at(-1), 'Added');
  assert.deepEqual(J(ctx.tgLaterList(TRIP)).map((e) => e.place_slug).filter((s) => s === 'moss-step-shrine'), ['moss-step-shrine']);
  tap(ctx, state, 'qt:' + key + ':9');
  assert.equal(answers(state).at(-1), 'Unknown button');
  tap(ctx, state, 'qt:k000000000000:1');
  assert.equal(answers(state).at(-1), 'That board is gone — send /quiet.');
  tap(ctx, state, 'qt:' + key + ':s:x:y');
  assert.equal(answers(state).at(-1), 'Unknown button');
  // The board's trip done: the current trip gets it.
  ({ ctx, state } = await world());
  ctx.tgTripUpsert({ slug: 'fen-coast', title: 'Fen Coast', destination: 'Fen Coast', start: '2027-03-01', end: '2027-03-03', tz: 'UTC', status: 'done' });
  deliver(ctx, state, 'quiet', board({ trip: 'fen-coast' }));
  tap(ctx, state, 'qt:' + key + ':1');
  assert.ok(J(ctx.tgLaterList(TRIP)).some((e) => e.place_slug === 'reedwater-shrine'));
  assert.deepEqual(J(ctx.tgLaterList('fen-coast')), []);
  // No trip on file at all.
  const bare = H.loadGas({ pack: 'tour-guide', now: at(D2, '09:00') });
  H.bootstrap(bare.ctx, bare.state);
  H.configureRoutine(bare.ctx, bare.state, 'RESEARCH');
  deliver(bare.ctx, bare.state, 'quiet', board({ trip: null }));
  tap(bare.ctx, bare.state, 'qt:' + key + ':1');
  const a = bare.state.fetch.telegram('answerCallbackQuery').map((r) => r.json).at(-1);
  assert.equal(a.text, 'No current trip — /plan one first.');
  assert.equal(a.show_alert, true);
  assert.deepEqual(J(bare.ctx.tgQuietGet('qt-20270611-tide-hall')).added, []);
});

test('the app: quiet.list and quiet.get (own fields, the left-out reasons in words), quiet.add, quiet.new and quiet.day', async () => {
  const { ctx, state } = await world(null, { board: true });
  const ID = 'qt-20270611-tide-hall';
  const list = app(ctx, state, 'quiet.list');
  assert.equal(list.ok, true);
  assert.equal(list.total, 1);
  assert.deepEqual(list.boards, [{ id: ID, trip: TRIP, magnet: 'Tide Hall', magnet_slug: 'tide-hall', busy: true, created_on: D2, date: D2, count: 3, added: 0,
    received_at: at(D2, '09:00').replace('Z', '').replace(/(\.\d{3})?$/, '.000') + 'Z' }]);
  const b = app(ctx, state, 'quiet.get', { id: ID }).board;
  assert.equal(b.quiet, 'Quietest at opening (09:00)');
  assert.equal(b.kind, 'shrine');
  assert.equal(b.source, null);
  assert.deepEqual(b.items.map((it) => [it.n, it.slug, it.quieter, it.reach.mode]), [[1, 'reedwater-shrine', 'much', 'WALK'], [2, 'moss-step-shrine', 'clearly', 'TRANSIT'], [3, 'heron-gate-shrine', 'somewhat', 'WALK']]);
  assert.match(b.items[0].maps_url, /^https:\/\/www\.google\.com\/maps\//);
  assert.equal(b.more, 1);
  assert.deepEqual(b.left_out.map((l) => l.words), ['part of the place itself', 'not the same kind of place', 'not clearly quieter', 'more than 30 minutes away']);
  assert.deepEqual(b.added_entries, []);
  assert.equal(app(ctx, state, 'quiet.get', { id: 'qt-20270611-nowhere' }).reason, 'no_quiet');
  assert.equal(app(ctx, state, 'quiet.get', { id: 'Not An Id' }).reason, 'bad_args');
  // quiet.add
  const r = app(ctx, state, 'quiet.add', { id: ID, n: 3 });
  assert.equal(r.ok, true);
  assert.deepEqual([r.trip, r.slug, r.added_entries.map((a) => a.slug), r.days.map((d) => d.date)], [TRIP, 'heron-gate-shrine', ['heron-gate-shrine'], DATES]);
  assert.equal(app(ctx, state, 'quiet.list').boards[0].added, 1);
  assert.equal(app(ctx, state, 'quiet.add', { id: ID, n: 4 }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'quiet.add', { id: ID }).reason, 'missing_arg');
  assert.equal(app(ctx, state, 'quiet.add', { id: ID, n: '1' }).reason, 'bad_args');
  // quiet.new: the command's words for the date.
  let n = app(ctx, state, 'quiet.new', { place: 'Glass Works', slug: 'glass-works', date: 'tomorrow' });
  assert.equal(n.ok, true);
  assert.deepEqual([n.trip, n.place, n.slug, n.date], [TRIP, 'Glass Works', 'glass-works', D3]);
  assert.deepEqual(reqOf(state, 'quiet').map(ask), [{ trip: TRIP, place: 'Glass Works', slug: 'glass-works', date: D3 }]);
  n = app(ctx, state, 'quiet.new', { place: 'Lantern Hall' });
  assert.deepEqual([n.slug, n.date], [null, null]);
  assert.equal(app(ctx, state, 'quiet.new', { place: 'X', date: '2027-06-01' }).reason, 'past_date');
  assert.equal(app(ctx, state, 'quiet.new', { place: 'X', date: '2027-02-30' }).reason, 'bad_date');
  assert.equal(app(ctx, state, 'quiet.new', { place: 'x'.repeat(81) }).reason, 'too_long');
  assert.equal(app(ctx, state, 'quiet.new', { place: 'x'.repeat(201) }).reason, 'too_long', 'over the app\'s 200 as well');
  assert.equal(app(ctx, state, 'quiet.new', { place: 'X', slug: 'Not A Slug' }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'quiet.new', { place: '   ' }).reason, 'no_place');
  assert.equal(reqOf(state, 'quiet').length, 2);
  // quiet.day
  assert.deepEqual(app(ctx, state, 'quiet.day', { trip: TRIP, date: D2 }).stops, [
    { slug: 'tide-hall', name: 'Tide Hall', board: ID }, { slug: 'kite-museum', name: 'Kite Museum', board: null }, { slug: 'harbour-tower', name: 'Harbour Tower', board: null }]);
  assert.deepEqual(app(ctx, state, 'quiet.day', { trip: TRIP, date: DATES[0] }).stops, []);
  assert.deepEqual(app(ctx, state, 'quiet.day', { trip: TRIP, date: '2027-07-01' }).stops, []);
  assert.equal(app(ctx, state, 'quiet.day', { trip: 'nowhere', date: D2 }).reason, 'no_trip');
  setNow(ctx, at(D3, '08:00'));
  assert.deepEqual(app(ctx, state, 'quiet.day', { trip: TRIP, date: D2 }).stops, [], 'a past day');
});

// Developed by: LightAISolutions

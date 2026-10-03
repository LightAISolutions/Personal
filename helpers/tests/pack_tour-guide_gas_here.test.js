'use strict';
// Tour Guide pack — WP-12b "re-plan from here" (TG-PHASE-12 §5): 📍 (rp) asks where the rest of today starts; each answer
// opens one replan request with C12's from / visited / rain; a shared location serves that request only and is kept
// nowhere (Settings, sheets, the audit log, replies, the deferred-update queue); the reply keyboard goes away after an
// answer, on Cancel and on the timeout; a stray location, or one from another chat, is ignored. Trip-local clock in
// Pacific/Kiritimati (UTC+14). Invented world: helpers/tests/pack_tour-guide_phase12_world.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('./pack_tour-guide_phase12_world');
const { H, TRIP, DATES, at } = W;

const RP = 'rp:lark-bay:20270611';
const LOC = { latitude: 12.512345678, longitude: 160.259876543 };
const wait = (ctx) => ctx.settingGet('tg_here_wait', '');
const replans = (state) => W.reqOf(state, 'replan');
const kb = (m) => m.reply_markup;
/** Every place a value could be kept: Settings and every other sheet, the props, the logs, Drive outside the request file. */
function keptAnywhere(ctx, state, needles) {
  const hits = [];
  for (const ss of state.spreadsheets.values()) {
    for (const sh of ss.getSheets()) {
      const v = JSON.stringify(sh.getDataRange().getValues());
      needles.forEach((n) => { if (v.includes(n)) hits.push('sheet ' + sh.getName()); });
    }
  }
  const props = JSON.stringify(state.props) + JSON.stringify(state.logs);
  needles.forEach((n) => { if (props.includes(n)) hits.push('props/logs'); });
  W.texts(state).forEach((t) => needles.forEach((n) => { if (t.includes(n)) hits.push('a reply'); }));
  const walk = (f) => {
    f.files.forEach((x) => { if (!/^req_/.test(x.name)) needles.forEach((n) => { if (x.content.includes(n)) hits.push('drive ' + x.path()); }); });
    f.folders.forEach(walk);
  };
  walk(state.drive.root);
  return hits;
}
/** The request files that carry a value (the request is the location's one transport). */
const reqFilesWith = (state, n) => {
  const out = [];
  const walk = (f) => { f.files.forEach((x) => { if (/^req_/.test(x.name) && x.content.includes(n)) out.push(x.path()); }); f.folders.forEach(walk); };
  walk(state.drive.root);
  return out;
};

test('📍 asks where from with a one-time reply keyboard; "From <stop>" opens a replan from that stop, with what is done', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '14:00'));
  W.tap(ctx, state, RP);
  const q = W.sends(state).pop();
  assert.match(q.text, /Re-plan the rest of today<\/b> — from where\?\nFrom <b>The Ropewalk<\/b>/);
  assert.match(q.text, /kept nowhere/);
  assert.deepEqual(kb(q), { keyboard: [[{ text: '📍 From The Ropewalk' }], [{ text: '📡 Share my location', request_location: true }],
    [{ text: '☔ Rain — indoor first' }], [{ text: '✖️ Cancel' }]], one_time_keyboard: true, resize_keyboard: true });
  assert.equal(state.fetch.telegram('answerCallbackQuery').pop().json.text, 'Where from?');
  assert.deepEqual(JSON.parse(wait(ctx)), { trip: TRIP, date: DATES[1], stop: 'ropewalk', until: at(DATES[1], '14:10'),
    labels: { loc: '📡 Share my location', cancel: '✖️ Cancel', from: '📍 From The Ropewalk', rain: '☔ Rain — indoor first' } });
  W.setNow(ctx, at(DATES[1], '14:02'));
  W.say(ctx, state, '📍 From The Ropewalk');
  const [p] = replans(state);
  assert.deepEqual({ ...p, requested_at: undefined, chat: undefined }, { trip: TRIP, dates: [DATES[1]], deliverables: ['plan'],
    from: { time: '14:02', place: 'ropewalk' }, visited: ['tide-hall', 'glass-works', 'ropewalk'],
    reason: 'Re-plan the rest of 2027-06-11 from The Ropewalk at 14:02; keep what I have already done.',
    trip_update: p.trip_update, upload_key: p.upload_key, kind: 'replan', text: 're-plan from here · 2027-06-11', requested_at: undefined, chat: undefined });
  const c = W.sends(state).pop();
  assert.match(c.text, /^📍 Re-planning the rest of today from <b>The Ropewalk<\/b> \(14:02\)\.\nIt runs in the background; the day card updates when the new plan is ready/);
  assert.deepEqual(kb(c), { remove_keyboard: true });
  assert.equal(wait(ctx), '');
  assert.equal(ctx.tgHereCheck(p), '');
  W.say(ctx, state, '📍 From The Ropewalk');
  assert.equal(replans(state).length, 1, 'the same text later is not an answer');
});

test('the current stop is the one under way, else the last one started; running late moves it; rain adds rain: true', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '13:00'));
  W.say(ctx, state, '/late 30');
  W.setNow(ctx, at(DATES[1], '13:10'));
  W.tap(ctx, state, RP);
  assert.match(W.last(state), /From <b>Glass Works<\/b>/, 'at 13:10 the Ropewalk (moved to 14:00) has not started: the last one started');
  W.say(ctx, state, '☔ Rain — indoor first');
  const [p] = replans(state);
  assert.deepEqual([p.from, p.visited, p.rain], [{ time: '13:10', place: 'glass-works' }, ['tide-hall', 'glass-works'], true]);
  assert.match(p.reason, /rain-proof: indoor and covered places first/);
  assert.match(W.last(state), /^☔ Re-planning the rest of today from <b>Glass Works<\/b> \(13:10\), indoor and covered places first\./);

  const b = W.fresh(at(DATES[1], '08:00'));
  W.tap(b.ctx, b.state, RP);
  const q = W.sends(b.state).pop();
  assert.match(q.text, /Nothing has started yet: share where you are/);
  assert.deepEqual(kb(q).keyboard, [[{ text: '📡 Share my location', request_location: true }], [{ text: '✖️ Cancel' }]], 'before the first stop: only a location');
});

test('a shared location: used once as from.point (rounded), kept nowhere, keyboard removed', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '14:00'));
  W.tap(ctx, state, RP);
  W.post(ctx, state, H.tgUpdate({ location: LOC }));
  const [p] = replans(state);
  assert.deepEqual(p.from, { time: '14:00', point: { lat: 12.51235, lng: 160.25988 } });
  assert.deepEqual(p.visited, ['tide-hall', 'glass-works'], 'only what has ended: the owner may have left the Ropewalk');
  assert.equal(p.rain, undefined);
  assert.equal(p.reason, 'Re-plan the rest of 2027-06-11 from where I am now at 14:00; keep what I have already done.');
  const c = W.sends(state).pop();
  assert.match(c.text, /from <b>where you are<\/b> \(14:00\)/);
  assert.deepEqual(kb(c), { remove_keyboard: true });
  assert.deepEqual(keptAnywhere(ctx, state, ['12.512', '160.259', '12.5123', '160.2598']), [], 'not in Settings, a sheet, the audit log, a reply or Drive');
  assert.equal(reqFilesWith(state, '12.51235').length, 1, 'the request file is its one transport');
  assert.equal(JSON.parse(W.audits(ctx, 'tg_here')[0].detail_json).choice, 'loc');
  W.post(ctx, state, H.tgUpdate({ location: LOC }));
  assert.equal(replans(state).length, 1, 'used once: a second location is a stray one');
});

test('a stray location, a late one and one from another chat are ignored without a word', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '14:00'));
  const n = W.sends(state).length;
  W.post(ctx, state, H.tgUpdate({ location: LOC }));
  W.post(ctx, state, H.tgUpdate({ venue: { location: LOC } }));
  assert.equal(W.sends(state).length, n, 'no reply ("I only read text" included)');
  assert.equal(W.reqEnvs(state).length, 0, 'not forwarded to the inbound routine either');
  ctx.flowStart(777, 'interview', {});
  const f = W.sends(state).length, step = JSON.stringify(ctx.flowActive(777));
  W.post(ctx, state, H.tgUpdate({ location: LOC }));
  assert.equal(W.sends(state).length, f, 'a location is never a conversation\'s answer');
  assert.equal(JSON.stringify(ctx.flowActive(777)), step);
  ctx.flowCancel(777);

  W.tap(ctx, state, RP);
  W.post(ctx, state, H.tgUpdate({ location: LOC, fromId: 4242, chatId: 4242 }));
  assert.equal(replans(state).length, 0, 'another chat cannot answer');
  assert.ok(wait(ctx), 'the question still waits');
  assert.deepEqual(keptAnywhere(ctx, state, ['12.512', '160.259']), []);

  W.setNow(ctx, at(DATES[1], '14:10'));
  H.fireTriggers(ctx, state, 'alarmTrigger');
  const t = W.sends(state).pop();
  assert.equal(t.text, '⌛ No re-plan — the question timed out. The day stays as it is.');
  assert.deepEqual(kb(t), { remove_keyboard: true });
  assert.equal(wait(ctx), '');
  const m = W.sends(state).length;
  W.post(ctx, state, H.tgUpdate({ location: LOC }));
  assert.equal(W.sends(state).length, m, 'after the timeout a location is stray');
  assert.equal(replans(state).length, 0);
});

test('Cancel and a stale button text remove the keyboard; another date, an active conversation or a forged button ask nothing', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '14:00'));
  W.tap(ctx, state, RP);
  W.say(ctx, state, '✖️ Cancel');
  const c = W.sends(state).pop();
  assert.equal(c.text, '✖️ No re-plan — the day stays as it is.');
  assert.deepEqual(kb(c), { remove_keyboard: true });
  assert.equal(replans(state).length, 0);

  W.tap(ctx, state, RP);
  W.setNow(ctx, at(DATES[1], '14:11'));
  W.say(ctx, state, '☔ Rain — indoor first');
  assert.equal(W.last(state), '⌛ That question timed out — tap 📍 Re-plan from here again.');
  assert.deepEqual(kb(W.sends(state).pop()), { remove_keyboard: true });
  assert.equal(replans(state).length, 0);

  W.tap(ctx, state, 'rp:lark-bay:20270612');
  assert.equal(state.fetch.telegram('answerCallbackQuery').pop().json.text, 'Re-plan from here works on the day itself.');
  assert.equal(wait(ctx), '');
  ctx.flowStart(777, 'interview', {});
  const n = W.sends(state).length;
  W.tap(ctx, state, RP);
  assert.match(state.fetch.telegram('answerCallbackQuery').pop().json.text, /Finish the current conversation first/);
  for (const data of ['rp:lark-bay', 'rp:lark-bay:2027061', 'rp:lark-bay:20270611:x', 'rp:no-trip:20270611', 'rp:lark-bay:20271311']) W.tap(ctx, state, data);
  assert.equal(W.sends(state).length, n, 'no question was sent');
  assert.equal(wait(ctx), '');
});

test('a location that waited in the queue (the lock was busy) is withheld from the Queue sheet and asked for again', () => {
  const { ctx, state } = W.fresh(at(DATES[1], '14:00'));
  W.tap(ctx, state, RP);
  state.lock.busy = true;
  W.post(ctx, state, H.tgUpdate({ location: LOC }));
  const row = ctx.storeFind('Queue', (r) => r.kind === 'tg_update_deferred')[0];
  assert.ok(row && !JSON.stringify(row).includes('12.512'), 'the stored update has no location');
  assert.match(JSON.stringify(row), /hb_location_withheld/);
  state.lock.busy = false;
  H.fireTriggers(ctx, state, 'queueTrigger');
  assert.equal(W.last(state), '📡 That location arrived while I was busy and was not kept — please share it again.');
  assert.equal(replans(state).length, 0);
  assert.ok(wait(ctx), 'still waiting for it');
  assert.deepEqual(keptAnywhere(ctx, state, ['12.512', '160.259']), []);
  W.post(ctx, state, H.tgUpdate({ location: LOC }));
  assert.equal(replans(state).length, 1);
});

test('the request check mirrors the planner\'s C12 bounds (restartErrors)', () => {
  const { ctx } = W.fresh(at(DATES[1], '14:00'));
  const ok = (r) => assert.equal(ctx.tgHereCheck(JSON.parse(JSON.stringify(r))), '', JSON.stringify(r));
  const bad = (r, f) => assert.equal(ctx.tgHereCheck(JSON.parse(JSON.stringify(r))), f, JSON.stringify(r));
  const slugs = (n) => Array.from({ length: n }, (_, i) => 'stop-' + i);
  ok({ from: { time: '00:00', place: 'tide-hall' } });
  ok({ from: { time: '23:59', point: { lat: -90, lng: 180 } }, visited: slugs(25), rain: true });
  ok({ from: { time: '12:00', point: { lat: 90, lng: -180 } }, visited: [] });
  bad({}, 'from');
  bad({ from: { time: '24:00', place: 'a' } }, 'from');
  bad({ from: { time: '12:00' } }, 'from');
  bad({ from: { time: '12:00', place: 'a', point: { lat: 1, lng: 1 } } }, 'from');
  bad({ from: { time: '12:00', place: 'a', when: 'now' } }, 'from');
  bad({ from: { time: '12:00', place: 'here' } }, 'from.place');
  bad({ from: { time: '12:00', place: 'Not A Slug' } }, 'from.place');
  bad({ from: { time: '12:00', point: { lat: 90.0001, lng: 0 } } }, 'from.point');
  bad({ from: { time: '12:00', point: { lat: '1', lng: 0 } } }, 'from.point');
  bad({ from: { time: '12:00', point: { lat: 1, lng: 2, alt: 3 } } }, 'from.point');
  bad({ from: { time: '12:00', place: 'a' }, visited: slugs(26) }, 'visited');
  bad({ from: { time: '12:00', place: 'a' }, visited: ['a', 'a'] }, 'visited');
  bad({ from: { time: '12:00', place: 'a' }, visited: 'a' }, 'visited');
  bad({ from: { time: '12:00', place: 'a' }, rain: false }, 'rain');
});

// Developed by: LightAISolutions

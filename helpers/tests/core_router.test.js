'use strict';
// 10_router.js + 11_commands_builtin.js — webhook auth, pairing, strangers, commands, free text → request, callbacks, lock.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh(opts = {}) {
  const { ctx, state } = H.loadGas({ pack: 'hello', ...opts });
  H.bootstrap(ctx, state);
  return { ctx, state, k: state.props[ctx.PROP.WEBHOOK_SECRET] };
}
const tg = (ctx, k, upd) => ctx.doPost(H.postEvent('tg', { k }, upd));
const audits = (ctx, ev) => ctx.storeAll('AuditLog').filter((x) => x.event === ev);

test('health route answers without secrets; unknown POST routes are audited; tg GET is a bare OK', () => {
  const { ctx, state } = fresh();
  const h = JSON.parse(ctx.doGet(H.getEvent('')).content);
  assert.deepEqual(Object.keys(h).sort(), ['app', 'core', 'ok', 'ts', 'version']);
  assert.equal(h.app, 'hello'); assert.equal(h.version, '0.1.0');
  assert.equal(ctx.doGet(H.getEvent('tg')).content, 'OK');
  assert.equal(ctx.doPost(H.postEvent('nope', {}, {})).content, 'not found');
  assert.equal(audits(ctx, 'route_unknown').length, 1);
  assert.equal(JSON.stringify(state.props).includes('"ok"'), false);
});

test('webhook: wrong secret → forbidden; bad body → OK; the same update_id is handled once', () => {
  const { ctx, state, k } = fresh();
  assert.equal(tg(ctx, 'wrong', H.tgUpdate({ text: '/ping' })).content, 'forbidden');
  assert.equal(audits(ctx, 'tg_auth_fail').length, 1);
  assert.equal(ctx.doPost(H.postEvent('tg', { k }, 'garbage')).content, 'OK');
  assert.equal(audits(ctx, 'tg_bad_body').length, 1);
  const upd = H.tgUpdate({ text: '/ping' });
  tg(ctx, k, upd); tg(ctx, k, upd);
  assert.equal(state.fetch.telegram('sendMessage').length, 1, 'duplicate delivery ignored');
  assert.match(state.fetch.lastTelegramText(), /^pong · .* · hello v0\.1\.0 · core v1\.0\.0$/);
});

test('pairing: only /start <PAIR_CODE> from a private chat claims ownership, once; strangers are audited once and never answered', () => {
  const { ctx, state, k } = fresh();
  state.props[ctx.PROP.OWNER_CHAT_ID] = '';
  state.props[ctx.PROP.PAIR_CODE] = 'pair-code-1';
  tg(ctx, k, H.tgUpdate({ text: '/start wrong-code', fromId: 4242 }));
  assert.equal(state.fetch.telegram('sendMessage').length, 0);
  assert.equal(audits(ctx, 'tg_unpaired_ignored').length, 1);
  tg(ctx, k, H.tgUpdate({ text: '/start pair-code-1', fromId: 4242, chatType: 'group', chatId: -100 }));
  assert.equal(state.props[ctx.PROP.OWNER_CHAT_ID], '', 'group chats cannot pair');
  tg(ctx, k, H.tgUpdate({ text: '/start pair-code-1', fromId: 4242 }));
  assert.equal(state.props[ctx.PROP.OWNER_CHAT_ID], '4242');
  assert.equal(state.props[ctx.PROP.PAIR_CODE], undefined, 'pair code is single-use');
  assert.match(state.fetch.lastTelegramText(), /✅ Paired\. .*Hello Helper/);
  // Now a stranger (and the old test owner 777) gets nothing.
  tg(ctx, k, H.tgUpdate({ text: '/ping', fromId: 777 }));
  tg(ctx, k, H.tgUpdate({ text: '/ping', fromId: 777 }));
  tg(ctx, k, H.tgUpdate({ text: 'hello there', fromId: 9 }));
  assert.equal(state.fetch.telegram('sendMessage').length, 1);
  assert.equal(audits(ctx, 'tg_unauthorized').length, 2, 'one audit row per stranger, not per message');
  tg(ctx, k, H.tgUpdate({ text: '/ping', fromId: 4242 }));
  assert.match(state.fetch.lastTelegramText(), /^pong/);
});

test('built-in commands answer; unknown commands get a hint; a command error is reported, not swallowed', () => {
  const { ctx, state, k } = fresh();
  const say = (t) => { tg(ctx, k, H.tgUpdate({ text: t })); return state.fetch.lastTelegramText(); };
  assert.match(say('/help'), /<b>Commands<\/b>\n/);
  assert.ok(say('/help').includes('/hello — say hello'));
  assert.equal(say('/id'), 'chat <code>777</code> · user <code>777</code>');
  assert.match(say('/status'), /Queue: 0 waiting\nPending actions: 0\nOpen requests: 0\nLast sweep: never/);
  assert.equal(say('/pending'), 'No pending actions.');
  assert.equal(say('/expire'), 'Expired 0 stale proposal(s).');
  assert.equal(say('/ask'), 'Usage: /ask &lt;question or task&gt;');
  assert.equal(say('/nope'), 'Unknown command. Send /help.');
  assert.match(say('/start'), /Hello Helper is paired to this chat/);
  assert.equal(say('/wake'), '⏱ Sweep scheduled — the mailbox is read within a minute.');
  assert.deepEqual(state.triggers.map((t) => [t.fn, t.spec.afterMs]), [['wakeTrigger', 60000]], '/wake never sweeps inside the webhook (lock held, Telegram waiting)');
  assert.equal(JSON.parse(JSON.stringify(H.fireTriggers(ctx, state, 'wakeTrigger')[0])).source, 'trigger');
  assert.equal(say('/Hello@helper_test_bot'), '👋 Hello from Hello Helper v0.1.0', 'case and @bot suffix are tolerated');
  ctx.registerCommand('/crash', () => { throw new Error('kaboom'); });
  assert.match(say('/crash'), /⚠️ \/crash failed: kaboom/);
  assert.equal(audits(ctx, 'command_error').length, 1);
});

test('free text opens a request: routine fired with req_<id>, req file + Requests row + fallback sweeps + a quiet ack', () => {
  const { ctx, state, k } = fresh();
  const n = H.configureRoutine(ctx, state);
  const upd = H.tgUpdate({ text: 'book me <something>', messageId: 321 });
  tg(ctx, k, upd);
  const fired = state.fetch.routine();
  assert.equal(fired.length, 1);
  assert.equal(fired[0].url, state.props[ctx.routineProp(n, 'URL')]);
  assert.equal(fired[0].headers.Authorization, 'Bearer ' + state.props[ctx.routineProp(n, 'TOKEN')]);
  assert.equal(fired[0].headers['anthropic-version'], '2023-06-01');
  assert.equal(fired[0].headers['anthropic-beta'], 'experimental-cc-routine-2026-04-01');
  assert.match(fired[0].json.text, /^req_[0-9a-f-]{36}$/, 'the fire text is only the request id');
  const id = fired[0].json.text.slice(4);
  const req = JSON.parse(state.drive.readFile('Hello/mailbox/to-brain', 'req_' + id + '.json'));
  assert.equal(req.payload.kind, 'message'); assert.equal(req.payload.text, 'book me <something>');
  assert.equal(req.payload.chat.chat_id, 777); assert.equal(req.payload.chat.message_id, 321);
  const row = ctx.getRequest(id);
  assert.equal(row.status, 'open'); assert.equal(row.fired, 'yes'); assert.equal(row.routine, 'CHAT'); assert.equal(row.text_preview, 'book me <something>');
  assert.deepEqual(state.triggers.map((t) => [t.fn, t.spec.afterMs]).sort((a, b) => a[1] - b[1]), [['wakeTrigger', 180000], ['wakeTrigger', 600000]]);
  const ack = state.fetch.telegram('sendMessage').slice(-1)[0].json;
  assert.equal(ack.text, '🧠 Working on it…'); assert.equal(ack.reply_to_message_id, 321); assert.equal(ack.disable_notification, true);
  assert.equal(JSON.parse(state.drive.readFile('Hello/mailbox/to-brain', 'state.json')).requests_open[0].id, id, 'snapshot refreshed before the fire');
  assert.equal(ctx.settingDailyCount('routine_fires'), 1);
  // /ask goes the same way; a pack message handler short-circuits; media without a caption is refused.
  tg(ctx, k, H.tgUpdate({ text: '/ask plan <tomorrow>' }));
  assert.equal(state.fetch.routine().length, 2);
  assert.equal(JSON.parse(state.drive.readFile('Hello/mailbox/to-brain', 'req_' + state.fetch.routine()[1].json.text.slice(4) + '.json')).payload.kind, 'ask');
  tg(ctx, k, H.tgUpdate({ text: 'hello core' }));
  assert.equal(state.fetch.routine().length, 2, 'hello_echo handled it');
  assert.equal(state.fetch.lastTelegramText(), '👋 hello core');
  tg(ctx, k, H.tgUpdate({ document: {} }));
  assert.equal(state.fetch.lastTelegramText(), 'I only read text here. Add a caption to send a file.');
  tg(ctx, k, H.tgUpdate({ document: {}, caption: 'file this' }));
  assert.equal(state.fetch.routine().length, 3, 'a caption is text');
});

test('without a configured routine the owner learns which properties to set; a failed fire is acknowledged honestly', () => {
  const { ctx, state, k } = fresh();
  tg(ctx, k, H.tgUpdate({ text: 'anything' }));
  assert.equal(state.fetch.routine().length, 0);
  assert.match(state.fetch.lastTelegramText(), /No routine is configured.*<code>HELLO_ROUTINE_FIRE_URL_CHAT<\/code> and <code>HELLO_ROUTINE_FIRE_TOKEN_CHAT<\/code>/);
  assert.equal(ctx.openRequestCount(), 0, 'no request is written when nobody can answer it');
  H.configureRoutine(ctx, state);
  state.fetch.responder = (url) => (/api\.anthropic\.com/.test(url) ? { code: 503, body: 'overloaded' } : null);
  tg(ctx, k, H.tgUpdate({ text: 'try again' }));
  assert.match(state.fetch.lastTelegramText(), /^⏳ Noted — the routine could not be fired right now \(HTTP 503\)/);
  assert.equal(ctx.listOpenRequests()[0].fired, 'http_503');
  state.props[ctx.PROP.MAX_ROUTINE_FIRES_PER_DAY] = '1';
  tg(ctx, k, H.tgUpdate({ text: 'and again' }));
  assert.match(state.fetch.lastTelegramText(), /\(daily_cap\)/);
  assert.equal(state.fetch.routine().length, 1, 'cap reached → no HTTP call');
});

test('callbacks: owner-only, foreign-chat forgeries rejected, unknown prefixes answered, errors answered', () => {
  const { ctx, state, k } = fresh();
  tg(ctx, k, H.tgUpdate({ callback: 'a:pa_x:y', fromId: 9 }));
  assert.equal(state.fetch.telegram('answerCallbackQuery').length, 0, 'strangers get no answer at all');
  assert.equal(audits(ctx, 'tg_callback_unauthorized').length, 1);
  tg(ctx, k, H.tgUpdate({ callback: 'a:pa_x:y', callbackChat: { id: 999, type: 'private' } }));
  assert.equal(audits(ctx, 'tg_callback_unauthorized').length, 2);
  assert.match(audits(ctx, 'tg_callback_unauthorized')[1].detail_json, /foreign chat/);
  tg(ctx, k, H.tgUpdate({ callback: 'zz:1' }));
  assert.equal(state.fetch.telegram('answerCallbackQuery').slice(-1)[0].json.text, 'Unknown button');
  ctx.registerCallback('x', () => { throw new Error('bad'); });
  tg(ctx, k, H.tgUpdate({ callback: 'x:1' }));
  const last = state.fetch.telegram('answerCallbackQuery').slice(-1)[0].json;
  assert.equal(last.text, '⚠️ failed'); assert.equal(last.show_alert, true);
  tg(ctx, k, H.tgUpdate({ callback: 'a:pa_missing:y' }));
  assert.equal(state.fetch.telegram('answerCallbackQuery').slice(-1)[0].json.text, 'Unknown action');
});

test('when the script lock is busy the update is deferred to the queue and handled by the worker trigger', () => {
  const { ctx, state, k } = fresh();
  state.lock.busy = true;
  assert.equal(tg(ctx, k, H.tgUpdate({ text: '/ping' })).content, 'OK');
  assert.equal(state.fetch.telegram('sendMessage').length, 0);
  assert.equal(ctx.storeFind('Queue', (r) => r.kind === 'tg_update_deferred').length, 1);
  assert.deepEqual(state.triggers.map((t) => t.fn), ['queueTrigger']);
  state.lock.busy = false;
  H.fireTriggers(ctx, state, 'queueTrigger');
  assert.match(state.fetch.lastTelegramText(), /^pong/);
  assert.equal(ctx.queueDepth(), 0);
});

test('core_start renderer: its message follows /start and pairing; a throwing renderer is audited, not fatal', () => {
  const { ctx, state } = H.loadGas();
  H.bootstrap(ctx, state);
  const k = state.props[ctx.PROP.WEBHOOK_SECRET];
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ text: '/start' })));
  assert.match(state.fetch.lastTelegramText(), /is paired to this chat/);
  let mode = 'obj';
  ctx.registerRenderer('core_start', () => { if (mode === 'throw') throw new Error('boom'); return mode === 'obj' ? { html: 'Next: <b>step</b>', keyboard: ctx.tgKeyboard([[{ text: 'Go', data: 'x:1' }]]) } : ''; });
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ text: '/start' })));
  assert.equal(state.fetch.lastTelegramText(), 'Next: <b>step</b>');
  mode = '';
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ text: '/start' })));
  assert.match(state.fetch.lastTelegramText(), /is paired to this chat/);
  mode = 'throw';
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ text: '/start' })));
  assert.ok(ctx.storeAll('AuditLog').some((r) => r.event === 'start_extras_error'));
});

test('core_status renderer: its lines end /status; a throwing renderer is audited and /status still answers', () => {
  const { ctx, state } = H.loadGas();
  H.bootstrap(ctx, state);
  const k = state.props[ctx.PROP.WEBHOOK_SECRET];
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ text: '/status' })));
  assert.match(state.fetch.lastTelegramText(), /One-off triggers: \d+$/);
  let mode = 'ok';
  ctx.registerRenderer('core_status', () => { if (mode === 'throw') throw new Error('boom'); return 'Answers: <b>free</b>'; });
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ text: '/status' })));
  assert.match(state.fetch.lastTelegramText(), /One-off triggers: \d+\nAnswers: <b>free<\/b>$/);
  mode = 'throw';
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ text: '/status' })));
  assert.match(state.fetch.lastTelegramText(), /One-off triggers: \d+$/);
  assert.ok(ctx.storeAll('AuditLog').some((r) => r.event === 'status_extras_error'));
});

// Developed by: LightAISolutions

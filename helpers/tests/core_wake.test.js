'use strict';
// 12_wake.js + 13_routines.js — wake route, sweeps, one-off triggers only, request lifecycle, daily jobs per local day.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh(opts = {}) {
  const { ctx, state } = H.loadGas({ pack: 'hello', ...opts });
  H.bootstrap(ctx, state);
  return { ctx, state };
}
const wake = (ctx, method = 'get') => JSON.parse((method === 'get' ? ctx.doGet(H.getEvent('wake')) : ctx.doPost(H.postEvent('wake', {}, ''))).content);
const triggers = (state, fn) => state.triggers.filter((t) => !fn || t.fn === fn);
const audits = (ctx, ev) => ctx.storeAll('AuditLog').filter((x) => x.event === ev);

test('wake before setup is refused; afterwards GET and POST both sweep the mailbox and report counts', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  assert.deepEqual(wake(ctx), { ok: false, error: 'not set up' });
  H.bootstrap(ctx, state);
  state.props[ctx.PROP.WAKE_MIN_INTERVAL_SEC] = '0';
  H.putEnvelope(state, H.envelope('notice', { text: 'one' }));
  const r = wake(ctx);
  assert.deepEqual(r, { ok: true, processed: 1, open_requests: 0, remaining: 499 });
  assert.equal(state.fetch.lastTelegramText(), 'ℹ️ one');
  H.putEnvelope(state, H.envelope('greeting', { name: 'Ada' }));
  assert.equal(wake(ctx, 'post').processed, 1);
  assert.equal(state.fetch.lastTelegramText(), '👋 Hello, Ada!');
  assert.equal(ctx.settingDailyCount('wakes'), 2);
  assert.equal(ctx.settingGet('last_sweep') !== '', true);
  assert.equal(audits(ctx, 'wake').length, 2, 'a wake that did work is audited');
  wake(ctx); wake(ctx); wake(ctx);
  assert.equal(audits(ctx, 'wake').length, 3, 'idle wakes are audited at most once per hour');
  assert.equal(triggers(state).length, 0, 'an idle wake schedules nothing');
});

test('wake is rate-limited: a burst gets one follow-up trigger instead of extra sweeps; the daily cap closes the door', () => {
  const { ctx, state } = fresh();
  assert.equal(wake(ctx).ok, true);
  const t = wake(ctx);
  assert.deepEqual(t, { ok: true, throttled: true, retry_in_sec: 15 });
  wake(ctx); wake(ctx);
  assert.equal(triggers(state, 'wakeTrigger').length, 1, 'one follow-up for the whole burst');
  assert.equal(triggers(state, 'wakeTrigger')[0].spec.afterMs, 60000);
  assert.equal(ctx.settingDailyCount('wakes'), 1, 'throttled calls do not count');
  ctx.__TEST_NOW = Date.now() + 20000;
  assert.equal(wake(ctx).throttled, undefined, 'window passed');
  state.props[ctx.PROP.MAX_WAKES_PER_DAY] = '2';
  state.props[ctx.PROP.WAKE_MIN_INTERVAL_SEC] = '0';
  assert.deepEqual(wake(ctx), { ok: false, throttled: true, reason: 'daily_cap' });
  assert.equal(audits(ctx, 'wake_cap_reached').length, 1);
  wake(ctx);
  assert.equal(audits(ctx, 'wake_cap_reached').length, 1, 'cap audited once, not per refused call');
});

test('wakeTrigger deletes the trigger that fired it; a busy lock yields skipped:busy and (for wakes) a follow-up', () => {
  const { ctx, state } = fresh();
  ctx.scheduleOneOff('wakeTrigger', 3);
  const [r] = H.fireTriggers(ctx, state, 'wakeTrigger');
  assert.equal(J(r).source, 'trigger');
  assert.equal(state.triggers.length, 0);
  state.lock.busy = true;
  assert.deepEqual(J(ctx.wakeSweep('owner')), { skipped: 'busy', source: 'owner' });
  assert.equal(state.triggers.length, 0, 'owner /wake while busy does not schedule');
  const w = wake(ctx);
  assert.equal(w.skipped, 'busy');
  assert.equal(triggers(state, 'wakeTrigger').length, 1, 'a busy wake retries itself once via a one-off trigger');
  state.lock.busy = false;
  assert.throws(() => ctx.scheduleOneOff('wakeSweep', 1), /unknown handler/);
  assert.equal(ctx.deleteOneOffTrigger({}), false);
});

test('snapshot is written when a sweep touched something or when the owner/trigger asked; never for an idle wake', () => {
  const { ctx, state } = fresh();
  state.props[ctx.PROP.WAKE_MIN_INTERVAL_SEC] = '0';
  const snap = () => state.drive.readFile('Hello/mailbox/to-brain', 'state.json');
  wake(ctx);
  assert.equal(snap(), null, 'idle wake → no snapshot write');
  assert.equal(J(ctx.wakeSweep('owner')).snapshot, true);
  assert.ok(snap());
  const before = snap();
  ctx.__TEST_NOW = Date.now() + 1000;
  H.putEnvelope(state, H.envelope('notice', { text: 'x' }));
  wake(ctx);
  assert.notEqual(snap(), before, 'a wake that processed an envelope refreshes the snapshot');
});

test('daily jobs run once per LOCAL day inside the first sweep of that day (Asia/Tokyo vs UTC)', () => {
  const { ctx, state } = fresh({ tz: 'Asia/Tokyo', now: '2026-03-01T14:30:00Z' }); // 23:30 JST Mar 1
  const r1 = J(ctx.wakeSweep('owner'));
  assert.deepEqual(Object.keys(r1.daily).sort(), ['core_prune_mailbox', 'core_prune_queue', 'hello_mark']);
  assert.equal(ctx.settingGet('last_daily_date'), '2026-03-01');
  const stamp1 = ctx.settingGet('hello_last_daily');
  assert.equal(J(ctx.wakeSweep('owner')).daily, null, 'same local day → not again');
  ctx.__TEST_NOW = '2026-03-01T15:30:00Z'; // 00:30 JST Mar 2 — still Mar 1 in UTC
  assert.ok(J(ctx.wakeSweep('owner')).daily, 'new local day → runs');
  assert.equal(ctx.settingGet('last_daily_date'), '2026-03-02');
  assert.notEqual(ctx.settingGet('hello_last_daily'), stamp1);
  assert.equal(state.triggers.length, 0, 'daily jobs need no trigger of their own');
});

test('daily jobs run once a day even where Sheets types the stored date (they ran on every sweep before)', () => {
  const { ctx, state } = fresh({ tz: 'America/Los_Angeles', now: '2026-10-04T21:00:00Z' });
  ctx.getSpreadsheet().autoType = true;                                   // "2026-10-04" written plainly would come back as a date cell
  assert.ok(J(ctx.wakeSweep('owner')).daily, 'first sweep of the day runs them');
  assert.equal(ctx.settingGet('last_daily_date'), '2026-10-04');
  assert.equal(J(ctx.wakeSweep('wake')).daily, null, 'not again the same day');
  ctx.__TEST_NOW = '2026-10-05T08:00:00Z';                                // 01:00 the next day in Los Angeles
  assert.ok(J(ctx.wakeSweep('wake')).daily, 'the next day runs them');
  assert.equal(state.triggers.filter((t) => t.fn === 'wakeTrigger').length, 0);
});

test('open requests keep an hourly follow-up alive (one at a time) and expire after 24 h with one notice', () => {
  const { ctx, state } = fresh({ now: '2026-05-05T12:00:00Z' });
  H.configureRoutine(ctx, state);
  const a = ctx.openRequest({ kind: 'ask', text: 'first <q>', chat: { chat_id: 777, message_id: 1 } });
  const b = ctx.openRequest({ kind: 'ask', text: 'second', chat: { chat_id: 777, message_id: 2 } });
  assert.equal(triggers(state, 'wakeTrigger').length, 4, 'two fallback sweeps per request');
  ctx.wakeSweep('trigger'); ctx.wakeSweep('trigger');
  const hourly = triggers(state, 'wakeTrigger').filter((t) => t.spec.afterMs === 3600000);
  assert.equal(hourly.length, 1, 'one hourly follow-up while requests are open');
  assert.equal(J(ctx.buildSnapshot()).requests_open.map((r) => r.id).join(), [a.id, b.id].join());
  H.putEnvelope(state, H.envelope('reply', { text: 'ans' }, { in_reply_to: a.id }));
  ctx.wakeSweep('trigger');
  assert.equal(ctx.openRequestCount(), 1);
  ctx.__TEST_NOW = '2026-05-06T12:00:01Z';
  const r = J(ctx.wakeSweep('trigger'));
  assert.equal(r.requests_expired, 1);
  assert.equal(ctx.getRequest(b.id).status, 'expired');
  assert.equal(ctx.getRequest(a.id).status, 'answered');
  assert.match(state.fetch.lastTelegramText(), /^⌛ 1 request\(s\) got no answer within 24 h: second$/);
  assert.equal(J(ctx.wakeSweep('trigger')).requests_expired, 0, 'said once');
  assert.ok(state.triggers.every((t) => t.spec.afterMs && !t.spec.everyMinutes && !t.spec.everyHours && !t.spec.everyDays), 'no permanent trigger, ever');
  const left = state.triggers.length;
  assert.equal(ctx.clearOneOffTriggers(), left);
  assert.equal(state.triggers.length, 0, 'the setup page can clear every one-off trigger');
});

test('fireRoutine: unconfigured and capped fires are skipped without HTTP; failures are audited with the body; names are discoverable', () => {
  const { ctx, state } = fresh();
  assert.deepEqual(J(ctx.fireRoutine('MORNING', 'x')), { ok: false, skipped: 'not_configured' });
  assert.deepEqual([...ctx.routineNames()], []);
  H.configureRoutine(ctx, state, 'MORNING'); H.configureRoutine(ctx, state, 'CHAT');
  assert.deepEqual([...ctx.routineNames()], ['CHAT', 'MORNING']);
  assert.equal(ctx.routineConfigured('morning'), true);
  assert.deepEqual(J(ctx.fireRoutine('morning')), { ok: true, code: 200 });
  assert.equal(state.fetch.routine()[0].json.text, undefined, 'no text → empty body');
  state.fetch.responder = (url) => (/api\.anthropic\.com/.test(url) ? { code: 401, body: 'bad token' } : null);
  assert.deepEqual(J(ctx.fireRoutine('MORNING', 'req_1')), { ok: false, code: 401 });
  assert.match(audits(ctx, 'routine_fired').slice(-1)[0].detail_json, /bad token/);
  assert.equal(audits(ctx, 'routine_fired').slice(-1)[0].ok, 'false');
  state.fetch.responder = () => { throw new Error('DNS error'); };
  assert.match(J(ctx.fireRoutine('MORNING')).error, /DNS error/);
  assert.equal(ctx.settingDailyCount('routine_fires'), 2, 'a thrown fetch does not count as a fire');
});

// Developed by: LightAISolutions

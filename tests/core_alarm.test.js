'use strict';
// 17_alarms.js — registerAlarm + the single pending alarmTrigger (re-armed after every run, never relying on exact timing).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const T0 = '2027-03-01T12:00:00Z';
const ms = (iso) => new Date(iso).getTime();
function fresh(opts = {}) {
  const { ctx, state } = H.loadGas({ pack: 'hello', now: T0, ...opts });
  H.bootstrap(ctx, state);
  return { ctx, state };
}
const alarmTriggers = (state) => state.triggers.filter((t) => t.fn === 'alarmTrigger');
const at = (state) => alarmTriggers(state).map((t) => t.spec.at.toISOString());

test('registerAlarm checks the name and needs next() and run()', () => {
  const { ctx } = fresh();
  assert.throws(() => ctx.registerAlarm('Bad Name', { next: () => null, run: () => {} }), /name must match/);
  assert.throws(() => ctx.registerAlarm('ok', { next: () => null }), /next\(nowMs\), run\(nowMs\)/);
  ctx.registerAlarm('ok', { next: () => null, run: () => {} });
  assert.throws(() => ctx.registerAlarm('ok', { next: () => null, run: () => {} }), /duplicate/);
  assert.ok(ctx.ONE_OFF_HANDLERS.includes('alarmTrigger'));
});

test('alarmArm leaves at most one trigger, at the earliest next(), never sooner than a minute from now', () => {
  const { ctx, state } = fresh();
  assert.equal(ctx.alarmArm(), null, 'no alarms → nothing armed');
  assert.equal(alarmTriggers(state).length, 0);
  let a = ms('2027-03-01T15:00:00Z'), b = ms('2027-03-01T13:30:00Z');
  ctx.registerAlarm('alpha', { next: () => a, run: () => {} });
  ctx.registerAlarm('beta', { next: () => b, run: () => {} });
  ctx.registerAlarm('idle', { next: () => null, run: () => {} });
  const r = ctx.alarmArm();
  assert.deepEqual({ ...r }, { at: '2027-03-01T13:30:00.000Z', name: 'beta' });
  assert.deepEqual(at(state), ['2027-03-01T13:30:00.000Z']);
  ctx.alarmArm(); ctx.alarmArm();
  assert.equal(alarmTriggers(state).length, 1, 're-arming replaces, never adds');
  b = ms('2027-03-01T11:00:00Z'); // already past
  ctx.alarmArm();
  assert.deepEqual(at(state), ['2027-03-01T12:01:00.000Z'], 'a past time arms one minute out');
  assert.equal(ctx.alarmPending().name, 'beta');
  a = null; b = null;
  assert.equal(ctx.alarmArm(), null);
  assert.equal(alarmTriggers(state).length, 0, 'nothing pending → no trigger left at all');
  assert.equal(ctx.alarmPending(), null);
});

test('alarmTrigger runs every due alarm (a little early is fine), skips the rest, and re-arms the next one', () => {
  const { ctx, state } = fresh();
  const ran = [];
  let alertAt = ms('2027-03-01T13:00:00Z'), dailyAt = ms('2027-03-01T14:00:00Z');
  ctx.registerAlarm('alert', { next: () => alertAt, run: (now) => { ran.push(['alert', new Date(now).toISOString()]); alertAt = null; } });
  ctx.registerAlarm('daily', { next: () => dailyAt, run: () => { ran.push(['daily']); dailyAt += 86400000; } });
  ctx.alarmArm();
  assert.deepEqual(at(state), ['2027-03-01T13:00:00.000Z']);
  ctx.__TEST_NOW = '2027-03-01T12:59:30Z'; // fires 30 s early
  const r = H.fireTriggers(ctx, state, 'alarmTrigger')[0];
  assert.deepEqual([...r.ran], ['alert']);
  assert.deepEqual(ran, [['alert', '2027-03-01T12:59:30.000Z']]);
  assert.deepEqual(at(state), ['2027-03-01T14:00:00.000Z'], 'the fired trigger is gone; the next alarm is armed');
  ctx.__TEST_NOW = '2027-03-01T14:07:00Z'; // fires 7 min late
  H.fireTriggers(ctx, state, 'alarmTrigger');
  assert.deepEqual(ran.map((x) => x[0]), ['alert', 'daily']);
  assert.deepEqual(at(state), ['2027-03-02T14:00:00.000Z']);
  assert.equal(state.lock.busy, false, 'the lock is released');
});

test('a throwing alarm is audited and held back; the others still run; a still-due alarm never loops every minute', () => {
  const { ctx, state } = fresh();
  let good = 0;
  ctx.registerAlarm('bad', { next: () => ms(T0), run: () => { throw new Error('boom'); } });
  ctx.registerAlarm('good', { next: () => (good ? null : ms(T0)), run: () => { good++; } });
  ctx.alarmArm();
  const r = H.fireTriggers(ctx, state, 'alarmTrigger')[0];
  assert.deepEqual([...r.failed], ['bad']);
  assert.deepEqual([...r.ran], ['good']);
  assert.equal(ctx.storeAll('AuditLog').filter((x) => x.event === 'alarm_bad_error').length, 1);
  assert.deepEqual(at(state), ['2027-03-01T12:15:00.000Z'], 'held back ALARM_RETRY_MIN, not re-run a minute later');
});

test('busy lock: the run steps aside and leaves one retry trigger; the daily cap stops runaway runs', () => {
  const { ctx, state } = fresh();
  ctx.registerAlarm('x', { next: () => ms(T0), run: () => {} });
  ctx.alarmArm();
  state.lock.busy = true;
  const r = H.fireTriggers(ctx, state, 'alarmTrigger')[0];
  assert.equal(r.skipped, 'busy');
  assert.deepEqual(at(state), ['2027-03-01T12:15:00.000Z']);
  state.lock.busy = false;
  for (let i = 0; i < ctx.LIMITS.ALARM_MAX_RUNS_PER_DAY; i++) ctx.settingIncrDaily('alarm_runs');
  const c = H.fireTriggers(ctx, state, 'alarmTrigger')[0];
  assert.equal(c.capped, true);
  assert.deepEqual(at(state), ['2027-03-01T18:00:00.000Z'], 'past the cap: next try six hours out');
  assert.equal(ctx.storeAll('AuditLog').filter((x) => x.event === 'alarm_cap_reached').length, 1);
});

test('clearOneOffTriggers clears it; the first sweep of a local day re-arms it (backstop)', () => {
  const { ctx, state } = fresh();
  ctx.registerAlarm('x', { next: () => ms('2027-03-02T09:00:00Z'), run: () => {} });
  ctx.alarmArm();
  assert.equal(ctx.clearOneOffTriggers(), 1);
  assert.equal(alarmTriggers(state).length, 0);
  ctx.settingSet('last_daily_date', '');
  const r = ctx.wakeSweep('owner');
  assert.ok(r.daily, 'daily jobs ran');
  assert.deepEqual(at(state), ['2027-03-02T09:00:00.000Z']);
  ctx.clearOneOffTriggers();
  ctx.wakeSweep('owner');
  assert.equal(alarmTriggers(state).length, 0, 'later sweeps the same day do not re-arm (pack code re-arms after its own changes)');
});

// Developed by: LightAISolutions

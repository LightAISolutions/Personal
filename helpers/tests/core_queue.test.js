'use strict';
// 06_queue.js — enqueue schedules ONE one-off worker trigger; retries, dead letters, requeue, pruning.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  return { ctx, state };
}

test('enqueue appends a row and schedules exactly one queueTrigger (~1 min); the trigger deletes itself and runs the handler', () => {
  const { ctx, state } = fresh();
  const seen = [];
  ctx.registerQueueHandler('job', (item) => { seen.push(J(item)); return { did: item.payload.n }; });
  const a = ctx.enqueue('job', { n: 1 }, 'test');
  ctx.enqueue('job', { n: 2 }, 'test');
  assert.equal(a.status, 'new');
  const trg = state.triggers.filter((t) => t.fn === 'queueTrigger');
  assert.equal(trg.length, 1, 'one outstanding worker trigger, not one per item');
  assert.equal(trg[0].spec.afterMs, 60000);
  assert.equal(ctx.queueDepth(), 2);
  const r = H.fireTriggers(ctx, state, 'queueTrigger')[0];
  assert.equal(J(r).processed, 2);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].kind, 'job'); assert.equal(seen[0].source, 'test'); assert.equal(seen[1].payload.n, 2);
  assert.equal(state.triggers.length, 0, 'the fired one-off trigger was deleted and nothing is left to run');
  assert.equal(ctx.queueDepth(), 0);
  assert.equal(ctx.storeGet('Queue', a.id).result_json, '{"did":1}');
  assert.ok(ctx.storeAll('AuditLog').some((x) => x.event === 'queue_done'));
});

test('a throwing handler retries up to QUEUE_MAX_ATTEMPTS then goes dead; unknown kinds die at once; requeueDead reopens', () => {
  const { ctx, state } = fresh();
  ctx.registerQueueHandler('bad', () => { throw new Error('boom ' + state.props[ctx.PROP.BOT_TOKEN]); });
  const row = ctx.enqueue('bad', {}, 'test');
  ctx.enqueue('nobody_handles_this', {}, 'test');
  let r = H.fireTriggers(ctx, state, 'queueTrigger')[0];
  assert.equal(ctx.storeGet('Queue', row.id).status, 'new', 'first failure → back to new');
  assert.equal(ctx.storeGet('Queue', row.id).last_error.includes('TESTTOKENTESTTOKEN'), false, 'errors are redacted before they hit the Sheet');
  assert.equal(state.triggers.filter((t) => t.fn === 'queueTrigger').length, 1, 're-scheduled because work remains');
  H.fireTriggers(ctx, state, 'queueTrigger');
  r = H.fireTriggers(ctx, state, 'queueTrigger')[0];
  const dead = ctx.storeGet('Queue', row.id);
  assert.equal(dead.status, 'dead'); assert.equal(String(dead.attempts), '3');
  assert.equal(ctx.storeFind('Queue', (x) => x.kind === 'nobody_handles_this')[0].last_error, 'no_handler');
  assert.equal(state.triggers.length, 0, 'nothing claimable → no further trigger');
  assert.equal(ctx.requeueDead('bad'), 1);
  assert.equal(ctx.storeGet('Queue', row.id).status, 'new');
  assert.equal(state.triggers.filter((t) => t.fn === 'queueTrigger').length, 1);
});

test('worker is skipped while another run holds the lock; pruneQueue removes old done rows only', () => {
  const { ctx, state } = fresh();
  ctx.registerQueueHandler('job', () => 'ok');
  ctx.enqueue('job', {}, 'test');
  state.lock.busy = true;
  assert.equal(J(ctx.workerTick()).skipped, true);
  state.lock.busy = false;
  assert.equal(J(ctx.workerTick()).done, 1);
  ctx.enqueue('job', {}, 'test'); // stays new
  ctx.__TEST_NOW = Date.now() + 8 * 86400000;
  assert.equal(ctx.pruneQueue(), 1, 'only the done row older than QUEUE_KEEP_DAYS');
  assert.equal(ctx.storeAll('Queue').length, 1);
  assert.throws(() => ctx.enqueue('Bad Kind', {}), /bad kind/);
  assert.throws(() => ctx.enqueue('job', { big: 'x'.repeat(40000) }), /payload too large/);
});

// Developed by: LightAISolutions

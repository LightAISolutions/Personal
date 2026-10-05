'use strict';
// Tour Guide pack — gas/49_requests_app.js (Phase 17d): requests.status, the app's progress bar. The estimate is the median
// time from asking to answer over the last answered requests of the same kind, else a default per kind; commands.run says
// which request a command opened. Invented data (Port Sorrel); no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const T0 = '2027-05-01T12:00:00.000Z';
function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: T0 });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state, 'RESEARCH');
  ctx.getSpreadsheet().autoType = true;   // Sheets types what the core writes, as it would live
  return { ctx, state };
}
const app = (ctx, state, op, args) => H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args });
const at = (ctx, iso) => { ctx.__TEST_NOW = iso; };
const plus = (sec) => new Date(Date.parse(T0) + sec * 1000).toISOString();
/** Ask a scout from the app at `start`, answered (markRequestAnswered, as dispatchEnvelope does) `took` seconds later. */
function scoutAnswered(ctx, state, start, took, n) {
  at(ctx, plus(start));
  const r = app(ctx, state, 'scout.new', { query: 'matcha ' + n, where: 'Port Sorrel' });
  assert.equal(r.ok, true, r.reason);
  at(ctx, plus(start + took));
  ctx.markRequestAnswered(r.request_id, { type: 'scout' });
  return r.request_id;
}

test('requests.status: a new kind uses its default, then elapsed time counts up while it is open', () => {
  const { ctx, state } = fresh();
  const r = app(ctx, state, 'scout.new', { query: 'matcha', where: 'Port Sorrel' });
  at(ctx, plus(70));
  const s = app(ctx, state, 'requests.status', { id: r.request_id });
  assert.equal(s.ok, true, s.reason);
  assert.deepEqual([s.kind, s.status, s.started, s.fire_problem], ['scout', 'open', true, '']);
  assert.deepEqual([s.eta_sec, s.eta_from, s.samples], [ctx.TG_REQ_ETA.DEFAULTS.scout, 'default', 0]);
  assert.equal(s.elapsed_sec, 70);
  assert.equal(s.created_at, T0);
  assert.equal(s.answered_at, '');
});

test('requests.status: the estimate is the median of the answered ones; an answered request stops its clock', () => {
  const { ctx, state } = fresh();
  scoutAnswered(ctx, state, 0, 150, 1);
  scoutAnswered(ctx, state, 1000, 210, 2);
  const last = scoutAnswered(ctx, state, 2000, 600, 3);
  at(ctx, plus(5000));
  const s = app(ctx, state, 'requests.status', { id: last });
  assert.deepEqual([s.status, s.elapsed_sec, s.eta_from, s.samples], ['answered', 600, 'history', 3]);
  assert.equal(s.eta_sec, 210, 'the median, not the mean (an unusually slow run does not drag it)');
  assert.equal(s.answered_at, plus(2600));
  // one answered request is not yet a history; other kinds keep their own estimate
  const one = fresh();
  scoutAnswered(one.ctx, one.state, 0, 100, 1);
  const q = app(one.ctx, one.state, 'quiet.new', { place: 'Port Sorrel' });
  assert.equal(q.ok, true, q.reason);
  const qs = app(one.ctx, one.state, 'requests.status', { id: q.request_id });
  assert.deepEqual([qs.kind, qs.eta_from, qs.eta_sec], ['quiet', 'default', one.ctx.TG_REQ_ETA.DEFAULTS.quiet]);
  assert.deepEqual(JSON.parse(JSON.stringify(one.ctx.tgReqEta('scout'))), { sec: one.ctx.TG_REQ_ETA.DEFAULTS.scout, from: 'default', samples: 1 });
});

test('requests.status: failed and expired come through; a routine that could not be fired says why; bad ids are refused', () => {
  const { ctx, state } = fresh();
  const r = app(ctx, state, 'scout.new', { query: 'matcha', where: 'Port Sorrel' });
  ctx.markRequestFailed(r.request_id, 'test');
  assert.equal(app(ctx, state, 'requests.status', { id: r.request_id }).status, 'failed');
  const bare = H.loadGas({ pack: 'tour-guide', now: T0 });   // no routine configured: saved, not fired
  H.bootstrap(bare.ctx, bare.state);
  const nf = app(bare.ctx, bare.state, 'scout.new', { query: 'matcha', where: 'Port Sorrel' });
  const s = app(bare.ctx, bare.state, 'requests.status', { id: nf.request_id });
  assert.deepEqual([s.started, s.fire_problem], [false, 'not_configured']);
  assert.equal(app(ctx, state, 'requests.status', { id: '00000000-0000-0000-0000-000000000000' }).reason, 'not_found');
  assert.equal(app(ctx, state, 'requests.status', { id: '../x' }).reason, 'bad_args');
  assert.equal(app(ctx, state, 'requests.status', {}).reason, 'missing_arg');
});

test('commands.run says which request a command opened, and nothing for a command that asks no routine', () => {
  const { ctx, state } = fresh();
  const r = app(ctx, state, 'commands.run', { text: '/scout matcha in Port Sorrel', nonce: 'n-request-1' });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.request.kind, 'scout');
  assert.equal(app(ctx, state, 'requests.status', { id: r.request.id }).status, 'open');
  const p = app(ctx, state, 'commands.run', { text: '/ping', nonce: 'n-request-2' });
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.request, undefined, 'the last request of an earlier run is not reported again');
});

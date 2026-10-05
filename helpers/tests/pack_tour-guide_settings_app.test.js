'use strict';
// Tour Guide pack — gas/46_settings_app.js: the app's Settings screen (settings.get). It reads the switches the chat commands
// set, so a switch the app flips by running its command reads back changed, and it never shows a secret.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const NOW = '2027-05-01T12:00:00Z';
function fresh(withKey) {
  const { ctx, state } = H.loadGas({ pack: 'tour-guide', now: NOW });
  H.bootstrap(ctx, state);
  if (withKey) state.props[ctx.propName(ctx.TG_CHAT_PROP.KEY)] = withKey;
  return { ctx, state };
}
const app = (ctx, state, op, args) => H.appPost(ctx, state, 'app', args === undefined ? { op } : { op, args });
const run = (ctx, state, text, n) => {
  const r = app(ctx, state, 'commands.run', { text, nonce: 'n-settings-' + n });
  assert.equal(r.ok, true, text + ': ' + r.reason);
};

test('settings.get: the defaults of a new helper, the /status counts and no profile yet', () => {
  const { ctx, state } = fresh();
  const r = app(ctx, state, 'settings.get');
  assert.equal(r.ok, true);
  assert.equal(r.journey, false);
  assert.deepEqual(r.morning, { at: ctx.TG_MORNING.AT, on: true });
  assert.equal(r.whatson_auto, true);
  assert.equal(r.lists_auto, true);
  assert.deepEqual(r.smart, { wanted: 'off', key_set: false, on: false, today: { answered: 0, tokens: 0, usd: 0 } });
  assert.deepEqual(r.profile, { has: false, updated: '', dimensions: null });
  assert.deepEqual(r.status, JSON.parse(JSON.stringify(ctx.coreStatusCounts())), 'the same numbers as /status');
  assert.equal(app(ctx, state, 'settings.get', { x: 1 }).reason, 'bad_args');
});

test('settings.get reads back every switch the app flips by running its command', () => {
  const { ctx, state } = fresh();
  run(ctx, state, '/journey on', 1);
  run(ctx, state, '/morning at 07:30', 2);
  run(ctx, state, '/morning off', 3);
  run(ctx, state, '/whatson auto off', 4);
  run(ctx, state, '/lists auto off', 5);
  const r = app(ctx, state, 'settings.get');
  assert.equal(r.journey, true);
  assert.deepEqual(r.morning, { at: '07:30', on: false });
  assert.equal(r.whatson_auto, false);
  assert.equal(r.lists_auto, false);
  run(ctx, state, '/journey off', 6);
  run(ctx, state, '/lists auto on', 7);
  const back = app(ctx, state, 'settings.get');
  assert.equal(back.journey, false);
  assert.equal(back.lists_auto, true);
});

test('settings.get: smart answers say whether the key is set, never its value, and on only with the key', () => {
  const noKey = fresh();
  run(noKey.ctx, noKey.state, '/smart on', 1);   // refused without a key: nothing changes
  assert.deepEqual([app(noKey.ctx, noKey.state, 'settings.get').smart.on, app(noKey.ctx, noKey.state, 'settings.get').smart.key_set], [false, false]);
  const { ctx, state } = fresh('sk-test-secret-value');
  run(ctx, state, '/smart on', 2);
  const r = app(ctx, state, 'settings.get');
  assert.deepEqual([r.smart.wanted, r.smart.key_set, r.smart.on], ['on', true, true]);
  assert.ok(!JSON.stringify(r).includes('sk-test-secret-value'), 'the key never leaves the core');
});

test('settings.get: the profile line once the brain has sent a summary', () => {
  const { ctx, state } = fresh();
  ctx.tgProfileSummaryStore({ text: 'Walks a lot, vegetarian, early riser.', dimensions_count: 12, updated: '2027-04-30' });
  assert.deepEqual(app(ctx, state, 'settings.get').profile, { has: true, updated: '2027-04-30', dimensions: 12 });
});

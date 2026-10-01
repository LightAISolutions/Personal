'use strict';
// 00_config.js — manifest merge, prefixed property names, type/allowlist extension, time zone, secret redaction.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

test('core defaults apply when no manifest is injected', () => {
  const { ctx } = H.loadGas();
  assert.equal(ctx.HELPER.name, 'helper');
  assert.equal(ctx.HELPER.drive_root, 'Helper');
  assert.equal(ctx.PROP.BOT_TOKEN, 'HELPER_BOT_TOKEN');
  assert.deepEqual([...ctx.ENVELOPE_TYPES], ['notice', 'reply', 'proposal']);
  assert.deepEqual([...ctx.ACTION_ALLOWLIST], ['drive_create_file']);
  assert.equal(ctx.routineProp('chat', 'url'), 'HELPER_ROUTINE_FIRE_URL_CHAT');
  assert.equal(ctx.routineProp('my-trip', 'TOKEN'), 'HELPER_ROUTINE_FIRE_TOKEN_MY_TRIP');
});

test('manifest values override defaults; unknown or null fields fall back; arrays are copied', () => {
  const { ctx } = H.loadGas({ manifest: { name: 'x', display_name: 'X Helper', property_prefix: '', envelope_types: ['alert', 'notice'], action_allowlist: ['x_do'], version: null, bogus: 1 } });
  assert.equal(ctx.HELPER.name, 'x');
  assert.equal(ctx.HELPER.display_name, 'X Helper');
  assert.equal(ctx.HELPER.version, '0.0.0', 'null falls back to the default');
  assert.equal(ctx.HELPER.bogus, undefined);
  assert.equal(ctx.PROP.BOT_TOKEN, 'BOT_TOKEN', 'empty prefix → bare names');
  assert.equal(ctx.PROP.WEBAPP_URL, 'WEBAPP_URL');
  assert.deepEqual([...ctx.ENVELOPE_TYPES], ['notice', 'reply', 'proposal', 'alert'], 'core types first, duplicates dropped');
  assert.deepEqual([...ctx.ACTION_ALLOWLIST], ['drive_create_file', 'x_do']);
  assert.equal(ctx.routineProp('CHAT', 'URL'), 'ROUTINE_FIRE_URL_CHAT');
});

test('hello pack: prefixed properties and the pack envelope type', () => {
  const { ctx } = H.loadGas({ pack: 'hello' });
  assert.equal(ctx.PROP.BOT_TOKEN, 'HELLO_BOT_TOKEN');
  assert.equal(ctx.PROP.MAX_ROUTINE_FIRES_PER_DAY, 'HELLO_MAX_ROUTINE_FIRES_PER_DAY');
  assert.ok(ctx.ENVELOPE_TYPES.includes('greeting'));
  assert.equal(ctx.HELPER.inbound_routine, 'CHAT');
  assert.deepEqual([...ctx.PROP_KEYS].map((k) => ctx.PROP[k]), [...ctx.PROP_KEYS].map((k) => 'HELLO_' + k));
});

test('getTz: TIMEZONE property wins, then the script zone, then Etc/UTC; getIntProp parses or defaults', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello', tz: 'Asia/Tokyo' });
  assert.equal(ctx.getTz(), 'Asia/Tokyo');
  state.props[ctx.PROP.TIMEZONE] = 'Europe/Lisbon';
  assert.equal(ctx.getTz(), 'Europe/Lisbon');
  state.props[ctx.PROP.MAX_WAKES_PER_DAY] = '7';
  assert.equal(ctx.getIntProp(ctx.PROP.MAX_WAKES_PER_DAY, 500), 7);
  assert.equal(ctx.getIntProp(ctx.PROP.MAX_PROPOSALS_PER_DAY, 30), 30);
  const u = H.loadGas({ tz: '' });
  assert.equal(u.ctx.getTz(), 'Etc/UTC');
});

test('redactSecrets strips bot tokens, bearer tokens, ?k= secrets and the exact secret property values', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  const n = H.configureRoutine(ctx, state);
  const tok = state.props[ctx.PROP.BOT_TOKEN], rt = state.props[ctx.routineProp(n, 'TOKEN')], k = state.props[ctx.PROP.WEBHOOK_SECRET];
  const msg = `fetch https://api.telegram.org/bot${tok}/sendMessage failed; Authorization: Bearer ${rt}; url ?route=tg&k=${k}`;
  const out = ctx.redactSecrets(msg);
  assert.ok(!out.includes(tok) && !out.includes(rt) && !out.includes(k), out);
  assert.match(out, /bot\[redacted\]/);
  assert.match(out, /Bearer \[redacted\]/);
  assert.equal(ctx.describeError(new Error('token ' + tok)).includes(tok), false);
});

// Developed by: LightAISolutions

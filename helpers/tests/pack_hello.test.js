'use strict';
// The hello pack: proof that a pack extends the core through registries only, and runs end to end in the mocks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness/gas-mocks');
const J = (v) => JSON.parse(JSON.stringify(v));

test('hello pack never touches core files and declares what it registers', () => {
  const dir = path.join(H.HELPERS_ROOT, 'packs', 'hello');
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'helper.json'), 'utf8'));
  assert.equal(m.name, 'hello');
  assert.deepEqual(m.envelope_types, ['greeting']);
  const src = fs.readFileSync(path.join(dir, 'gas', 'hello.js'), 'utf8');
  assert.ok(!/HB_REGISTRY\./.test(src), 'uses register*() helpers, not the registry object');
  assert.ok(/registerEnvelopeHandler\('greeting'/.test(src) && /registerCommand\('\/hello'/.test(src));
  assert.ok(src.trimEnd().endsWith('// Developed by: LightAISolutions'));
});

test('greeting envelope → owner message + counter; snapshot, daily job and setup step are the pack\'s', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  H.putEnvelope(state, H.envelope('greeting', { name: 'Grace <3' }));
  H.putEnvelope(state, H.envelope('greeting', { name: '' }));
  const r = J(ctx.pollFromBrain());
  assert.equal(r.processed, 1); assert.equal(r.rejected, 1);
  assert.equal(state.fetch.lastTelegramText(), '👋 Hello, Grace &lt;3!');
  assert.deepEqual(J(ctx.buildSnapshot()).hello, { greetings_sent: 1 });
  assert.equal(J(ctx.runDailyJobs()).hello_mark.ok, true);
  assert.ok(ctx.settingGet('hello_last_daily'));
  assert.equal(ctx.HB_REGISTRY.setup.hello_wave.run(), 'waved');
  assert.equal(state.fetch.lastTelegramText(), '👋');
});

test('/hello and the hello message handler answer locally; other text still goes to the routine', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state);
  const k = state.props[ctx.PROP.WEBHOOK_SECRET];
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ text: '/hello' })));
  assert.equal(state.fetch.lastTelegramText(), '👋 Hello from Hello Helper v0.1.0');
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ text: 'Hello, is it me?' })));
  assert.equal(state.fetch.lastTelegramText(), '👋 Hello, is it me?');
  assert.equal(state.fetch.routine().length, 0);
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ text: 'say hello to the routine' })));
  assert.equal(state.fetch.routine().length, 1, 'only a leading "hello" is handled locally');
});

// Developed by: LightAISolutions

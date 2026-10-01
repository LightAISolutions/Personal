'use strict';
// 14_setup.js — owner setup page: admin-secret gate, lessons from the first helper, every action, pack steps.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const page = (ctx, params) => ctx.doGet(H.getEvent('setup', params)).content;
const post = (ctx, params) => ctx.doPost(H.postEvent('setup', params, '')).content;

test('printSetupUrl mints the secrets and logs the URL; the page needs the admin secret; dev URLs are called out', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  assert.match(page(ctx, {}), /Run <code>printSetupUrl\(\)<\/code>/);
  const url = ctx.printSetupUrl();
  const k = state.props[ctx.PROP.ADMIN_SECRET];
  assert.equal(k.length, 40);
  assert.equal(state.props[ctx.PROP.WEBHOOK_SECRET].length, 40);
  assert.equal(state.props[ctx.PROP.PAIR_CODE].length, 8);
  assert.equal(url, 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec?route=setup&k=' + k);
  assert.ok(state.logs.some((l) => l.startsWith('SETUP URL: ')));
  assert.match(page(ctx, {}), /Bad or missing key/);
  assert.match(page(ctx, { k: 'nope' }), /Bad or missing key/);
  const html = page(ctx, { k });
  assert.ok(html.includes('<base target="_top">'), 'forms and links must escape the HtmlService iframe');
  assert.ok(html.includes('<title>Hello Helper — setup</title>'));
  assert.ok(html.includes('exec?route=wake'), 'the wake URL for the brain is shown');
  assert.ok(html.includes('<code>HELLO_BOT_TOKEN</code>') && html.includes('<code>HELLO_ROUTINE_FIRE_URL_NAME</code>'), 'property names are listed');
  assert.ok(html.includes('<details class="secret"><summary>Show pair code</summary>'), 'secrets stay collapsed until clicked');
  assert.ok(html.includes('Hello: wave at the owner'), 'pack setup steps are buttons');
  assert.ok(html.includes('Hello Helper v0.1.0 · helpers core v' + ctx.CORE_VERSION));
  assert.ok(html.includes('Timezone</th><td>Etc/UTC'));
  state.props[ctx.PROP.WEBAPP_URL] = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/dev';
  assert.ok(page(ctx, { k }).includes('This is the test (/dev) URL'), 'the /dev URL lesson');
});

test('setup actions: deployment URL, token paste tolerance, storage, webhook, snapshot, pairing reset, triggers, pack step', () => {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  ctx.ensureSecrets();
  const k = state.props[ctx.PROP.ADMIN_SECRET];
  assert.match(post(ctx, { k: 'bad', action: 'create_storage' }), /Bad or missing key/);
  assert.match(post(ctx, { k, action: 'save_webapp_url', url: 'https://script.google.com/macros/s/X/dev' }), /URL must look like/);
  assert.match(post(ctx, { k, action: 'save_webapp_url', url: 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec' }), /Web app URL saved/);
  assert.equal(state.props[ctx.PROP.WEBAPP_URL], 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec');
  assert.match(post(ctx, { k, action: 'save_token', token: 'short' }), /Token format looks wrong/);
  assert.match(post(ctx, { k, action: 'save_token', token: 'Use this token to access the HTTP API:\n`123456789:TESTtokenTESTtokenTEST`​' }), /Token saved/);
  assert.equal(state.props[ctx.PROP.BOT_TOKEN], '123456789:TESTtokenTESTtokenTEST');
  const r = post(ctx, { k, action: 'create_storage' });
  assert.match(r, /Sheet created · Tabs ensured: 5 created · Mailbox folders ready/);
  assert.equal(state.spreadsheets.get(state.props[ctx.PROP.SHEET_ID]).getName(), 'Hello Helper — state');
  assert.ok(state.drive.findFolder('Hello/mailbox/to-brain'));
  assert.match(post(ctx, { k, action: 'create_storage' }), /Tabs ensured: 0 created/, 'idempotent');
  assert.match(post(ctx, { k, action: 'set_webhook' }), /Webhook set for @helper_test_bot/);
  const hook = state.fetch.telegram('setWebhook')[0].json;
  assert.equal(hook.url, 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec?route=tg&k=' + state.props[ctx.PROP.WEBHOOK_SECRET]);
  assert.deepEqual([...hook.allowed_updates], ['message', 'callback_query']);
  assert.ok(ctx.settingGet('webhook_set_at'));
  assert.match(post(ctx, { k, action: 'write_snapshot' }), /Swept and snapshot written \(0 envelope\(s\) handled\)/);
  assert.ok(state.drive.readFile('Hello/mailbox/to-brain', 'state.json'));
  assert.match(post(ctx, { k, action: 'test_message' }), /test_message: Failed:/, 'no owner yet');
  state.props[ctx.PROP.OWNER_CHAT_ID] = '777';
  assert.match(post(ctx, { k, action: 'test_message' }), /test_message: Sent/);
  assert.equal(state.fetch.lastTelegramText(), '✅ Test message from Hello Helper v0.1.0');
  assert.match(post(ctx, { k, action: 'step:hello_wave' }), /step:hello_wave: waved/);
  assert.match(post(ctx, { k, action: 'step:nope' }), /Unknown action/);
  assert.match(post(ctx, { k, action: 'reset_pairing' }), /Pairing reset/);
  assert.equal(state.props[ctx.PROP.OWNER_CHAT_ID], undefined);
  assert.equal(state.props[ctx.PROP.PAIR_CODE].length, 8);
  const old = state.props[ctx.PROP.WEBHOOK_SECRET];
  assert.match(post(ctx, { k, action: 'rotate_webhook_secret' }), /Webhook secret rotated · Webhook set for/);
  assert.notEqual(state.props[ctx.PROP.WEBHOOK_SECRET], old);
  ctx.scheduleOneOff('wakeTrigger', 5); ctx.scheduleOneOff('queueTrigger', 1);
  assert.match(post(ctx, { k, action: 'clear_triggers' }), /Removed 2 one-off trigger\(s\)/);
  assert.equal(state.triggers.length, 0);
  assert.ok(ctx.storeAll('AuditLog').filter((x) => x.event === 'setup_action').length >= 10, 'every setup action is audited');
  assert.equal(JSON.stringify(ctx.storeAll('AuditLog')).includes(state.props[ctx.PROP.BOT_TOKEN]), false, 'the token never lands in the audit log');
});

// Developed by: LightAISolutions

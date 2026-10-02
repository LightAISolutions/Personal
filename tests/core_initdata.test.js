'use strict';
// 05_telegram.js — tgVerifyInitData (Telegram Mini App initData), tgSetMenuButton / tgMenuButtonDefault, web_app keyboard buttons.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  ctx.__TEST_NOW = '2026-10-02T12:00:00Z';
  return { ctx, state };
}

test('a valid initData signed with the bot token passes and yields the owner, auth_date and start_param', () => {
  const { ctx, state } = fresh();
  const v = ctx.tgVerifyInitData(H.initData(ctx, state, { startParam: 'core_x_screen_shortlist' }));
  assert.equal(v.ok, true); assert.equal(v.reason, '');
  assert.equal(v.user.id, 777); assert.equal(v.user.username, 'owner');
  assert.equal(v.auth_date, Math.floor(new Date('2026-10-02T12:00:00Z').getTime() / 1000));
  assert.equal(v.start_param, 'core_x_screen_shortlist');
  const plain = ctx.tgVerifyInitData(H.initData(ctx, state));
  assert.equal(plain.ok, true); assert.equal(plain.start_param, '');
});

test('the hash is checked exactly as Telegram documents (key "WebAppData", message = bot token)', () => {
  const { ctx, state } = fresh();
  // Reference vector computed by hand for token "123456:TESTTOKENTESTTOKENTESTTOKEN" and the fields below.
  const crypto = require('node:crypto');
  const fields = { auth_date: '1790000000', query_id: 'q1', user: '{"id":777}' };
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update('123456:TESTTOKENTESTTOKENTESTTOKEN').digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  const s = `query_id=q1&user=${encodeURIComponent(fields.user)}&auth_date=1790000000&hash=${hash}`;
  assert.equal(ctx.tgVerifyInitData(s, { maxAgeSec: 0 }).ok, true);
  const wrongSecret = crypto.createHmac('sha256', '123456:TESTTOKENTESTTOKENTESTTOKEN').update('WebAppData').digest();   // swapped key/message
  const wrongHash = crypto.createHmac('sha256', wrongSecret).update(dcs).digest('hex');
  assert.equal(ctx.tgVerifyInitData(s.replace(hash, wrongHash), { maxAgeSec: 0 }).reason, 'bad_hash');
});

test('every failure has its reason and never leaks the data: tampered, expired, wrong user, missing hash, empty, malformed', () => {
  const { ctx, state } = fresh();
  const good = H.initData(ctx, state, { startParam: 'abc' });
  const r = (s, o) => ctx.tgVerifyInitData(s, o);
  assert.equal(r(good.replace('start_param=abc', 'start_param=abd')).reason, 'bad_hash', 'tampered field');
  assert.equal(r(good.replace(encodeURIComponent('"id":777'), encodeURIComponent('"id":778'))).reason, 'bad_hash', 'tampered user');
  assert.equal(r(good.replace(/[0-9a-f]{4}$/, (m) => (m === 'ffff' ? '0000' : 'ffff'))).reason, 'bad_hash', 'altered hash');
  assert.equal(r(H.initData(ctx, state, { authDate: Math.floor(state.now() / 1000) - 86401 })).reason, 'expired');
  assert.equal(r(H.initData(ctx, state, { authDate: Math.floor(state.now() / 1000) - 86401 }), { maxAgeSec: 100000 }).ok, true, 'maxAgeSec is honoured');
  assert.equal(r(H.initData(ctx, state, { authDate: Math.floor(state.now() / 1000) - 3601 }), { maxAgeSec: 3600 }).reason, 'expired');
  assert.equal(r(H.initData(ctx, state, { userId: 999 })).reason, 'not_owner');
  assert.equal(r(good.replace(/&hash=[0-9a-f]+$/, '')).reason, 'missing_hash');
  assert.equal(r(good.replace(/&hash=[0-9a-f]+$/, '&hash=ABC')).reason, 'missing_hash');
  assert.equal(r('').reason, 'missing');
  assert.equal(r(undefined).reason, 'missing');
  assert.equal(r({ toString: () => good }).reason, 'missing', 'only a string is accepted');
  assert.equal(r('no-equals-sign').reason, 'malformed');
  assert.equal(r(good + '&start_param=dup').reason, 'malformed', 'duplicate field');
  assert.equal(r(good + '&%E0%A4%A=1').reason, 'malformed', 'bad percent-encoding');
  assert.equal(r('a'.repeat(5000)).reason, 'too_long');
  const noUser = H.initData(ctx, state, { extra: { note: 'x' } }).replace(/user=[^&]+&/, '');
  assert.equal(r(noUser).reason, 'missing_field');
  const badUser = H.initData(ctx, state, { extra: {} });
  // A user field that is signed but not JSON: rebuild with the harness so the hash is right.
  const crypto = require('node:crypto');
  const fields = { auth_date: String(Math.floor(state.now() / 1000)), user: 'not-json' };
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(state.props[ctx.PROP.BOT_TOKEN]).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  assert.equal(r(`auth_date=${fields.auth_date}&user=not-json&hash=${hash}`).reason, 'bad_user');
  assert.equal(typeof badUser, 'string');
  // The other bot's token: nothing signed elsewhere verifies here.
  state.props[ctx.PROP.BOT_TOKEN] = '999999:OTHERTOKENOTHERTOKENOTHERTOKEN';
  assert.equal(r(good).reason, 'bad_hash');
  state.props[ctx.PROP.BOT_TOKEN] = '123456:TESTTOKENTESTTOKENTESTTOKEN';
  state.props[ctx.PROP.OWNER_CHAT_ID] = '';
  assert.equal(r(good).reason, 'not_owner', 'no owner paired → nobody is the owner');
  for (const v of [r(''), r(good.replace('abc', 'abd'))]) { assert.equal(v.user, null); assert.equal(v.ok, false); assert.doesNotMatch(JSON.stringify(v), /abc|hash=/); }
});

test('tgSetMenuButton sets a web_app menu button for the owner chat (https only); tgMenuButtonDefault restores it', () => {
  const { ctx, state } = fresh();
  const r = ctx.tgSetMenuButton('https://example.com/helper-app.html?core=x', 'Tour Guide');
  assert.equal(r.ok, true);
  const calls = state.fetch.telegram('setChatMenuButton');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].json, { chat_id: '777', menu_button: { type: 'web_app', text: 'Tour Guide', web_app: { url: 'https://example.com/helper-app.html?core=x' } } });
  assert.equal(ctx.tgSetMenuButton('http://example.com/app', 'x').ok, false);
  assert.equal(ctx.tgSetMenuButton('', 'x').ok, false);
  assert.equal(ctx.tgMenuButtonDefault().ok, true);
  assert.deepEqual(state.fetch.telegram('setChatMenuButton')[1].json, { chat_id: '777', menu_button: { type: 'default' } });
  state.props[ctx.PROP.OWNER_CHAT_ID] = '';
  assert.equal(ctx.tgSetMenuButton('https://example.com/app', 'x').ok, false);
  assert.equal(ctx.tgMenuButtonDefault().ok, false);
  assert.equal(state.fetch.telegram('setChatMenuButton').length, 2, 'nothing is sent without an owner');
});

test('tgKeyboard builds web_app buttons (https only) next to callback and url buttons', () => {
  const { ctx } = fresh();
  const kb = ctx.tgKeyboard([[{ text: 'Open', web_app: { url: 'https://example.com/app?screen=shortlist' } }, { text: 'Tap', data: 'x:1' }, { text: 'Site', url: 'https://example.com' }]]);
  assert.deepEqual(JSON.parse(JSON.stringify(kb.inline_keyboard[0])), [
    { text: 'Open', web_app: { url: 'https://example.com/app?screen=shortlist' } }, { text: 'Tap', callback_data: 'x:1' }, { text: 'Site', url: 'https://example.com' }
  ]);
  assert.throws(() => ctx.tgKeyboard([[{ text: 'Open', web_app: { url: 'http://example.com/app' } }]]), /https/);
});

// Developed by: LightAISolutions

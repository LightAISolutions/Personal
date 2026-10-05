'use strict';
// core/18_command_forms.js (form templates) and core/10_router.js runOwnerCommand (a command run from the app as if typed).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

const J = (v) => JSON.parse(JSON.stringify(v));
function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'hello', now: '2027-05-01T12:00:00Z' });
  H.bootstrap(ctx, state);
  return { ctx, state };
}

test('cmdTemplateParse: text, required fields and optional segments; malformed templates are refused with a reason', () => {
  const { ctx } = fresh();
  assert.deepEqual(J(ctx.cmdTemplateParse('/daytrip[ from {from}][ under {under} min]')), { ok: true, names: ['from', 'under'],
    parts: [{ t: '/daytrip' }, { opt: [{ t: ' from ' }, { f: 'from' }] }, { opt: [{ t: ' under ' }, { f: 'under' }, { t: ' min' }] }] });
  [['/a [x {b}', 'unclosed'], ['/a [[{b}]]', 'nested'], ['/a ]', 'stray ]'], ['/a {B}', 'bad field'], ['/a {b} {b}', 'twice'],
    ['/a [ x ]', 'without a field'], ['go {b}', 'must start'], ['', 'must start'], ['/a }', 'stray }']].forEach(([t, why]) => {
    const r = J(ctx.cmdTemplateParse(t));
    assert.equal(r.ok, false, t);
    assert.match(r.error, new RegExp(why.replace(/[[\]{}]/g, '\\$&')), t);
  });
});

test('cmdTemplateFill and cmdTemplateMatches agree on what a filled template reads like', () => {
  const { ctx } = fresh();
  const p = ctx.cmdTemplateParse('/route {from} → {to}[ {mode}]').parts;
  const fields = { from: { kind: 'place' }, to: { kind: 'place' }, mode: { kind: 'choice', options: ['walk', 'transit', 'drive'] } };
  assert.equal(ctx.cmdTemplateFill(p, { from: ' Old  Mill ', to: 'Pier\n2', mode: '' }), '/route Old Mill → Pier 2');
  assert.equal(ctx.cmdTemplateFill(p, { from: 'A', to: 'B', mode: 'walk' }), '/route A → B walk');
  assert.equal(ctx.cmdTemplateFill(p, { from: 'A' }), null);
  assert.equal(ctx.cmdTemplateMatches(p, fields, '/route A → B walk'), true);
  assert.equal(ctx.cmdTemplateMatches(p, fields, '/route A → B'), true);
  assert.equal(ctx.cmdTemplateMatches(p, fields, '/route A to B'), false);
  const d = ctx.cmdTemplateParse('/late {min}[ {day}]').parts, df = { min: { kind: 'number' }, day: { kind: 'day' } };
  assert.equal(ctx.cmdTemplateMatches(d, df, '/late 30 day 2'), true);
  assert.equal(ctx.cmdTemplateMatches(d, df, '/late soon'), false);
});

test('runOwnerCommand: echo line, then the handler with the echo as its message; refusals post nothing', () => {
  const { ctx, state } = fresh();
  let seen = null;
  ctx.registerCommand('/zzecho', (c) => { seen = { args: c.args, argv: J(c.argv), mid: c.chat.message_id, via: c.via, chatId: c.chatId }; c.reply('done'); }, 'test');
  const r = J(ctx.runOwnerCommand('/zzecho  one two', { via: 'app' }));
  assert.equal(r.ok, true);
  const sent = state.fetch.telegram('sendMessage').map((x) => x.json);
  assert.equal(sent[0].text, '▶️ <code>/zzecho  one two</code> · from the app');
  assert.equal(seen.mid, r.message_id);
  assert.equal(seen.args, 'one two');
  assert.deepEqual(seen.argv, ['one', 'two']);
  assert.equal(seen.via, 'app');
  assert.equal(seen.chatId, 777);
  assert.equal(sent[1].text, 'done');
  const before = state.fetch.telegram('sendMessage').length;
  [['hello', 'not_command'], ['/nope', 'unknown_command'], ['/start', 'chat_only'], ['', 'bad_text'], ['/ping\nx', 'bad_text'],
    ['/ping ' + 'x'.repeat(600), 'bad_text']].forEach(([t, why]) => assert.equal(ctx.runOwnerCommand(t).reason, why, t));
  assert.equal(state.fetch.telegram('sendMessage').length, before);
  // A handler that throws is answered and audited, as when typed.
  ctx.registerCommand('/zzboom', () => { throw new Error('kaput'); }, 'test');
  assert.equal(ctx.runOwnerCommand('/zzboom').ok, true);
  assert.match(state.fetch.lastTelegramText(), /zzboom failed/);
});

// Developed by: LightAISolutions

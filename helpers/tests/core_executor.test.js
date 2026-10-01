'use strict';
// 07_executor.js + 08_actions_builtin.js — proposals show the exact payload, run only after ✅, dedupe, expire, cap.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  return { ctx, state };
}

test('proposeAction stores a pending row and sends the owner the exact payload with ✅/❌ buttons; same key dedupes', () => {
  const { ctx, state } = fresh();
  const row = ctx.proposeAction({ type: 'drive_create_file', payload: { name: 'note.md', content: 'hello there', path: 'notes' }, origin: 'test-skill' });
  assert.equal(row.status, 'pending');
  assert.match(row.id, /^pa_/);
  const sent = state.fetch.telegram('sendMessage');
  assert.equal(sent.length, 1);
  const msg = sent[0].json;
  assert.equal(String(msg.chat_id), '777');
  assert.ok(msg.text.includes('<pre>' + ctx.tgEscape(JSON.stringify({ name: 'note.md', content: 'hello there', path: 'notes' })) + '</pre>'), 'exact payload shown');
  assert.ok(msg.text.includes('Hello/notes/note.md'), 'preview names the Drive path under the helper root');
  assert.deepEqual(J(msg.reply_markup.inline_keyboard[0]).map((b) => b.callback_data), ['a:' + row.id + ':y', 'a:' + row.id + ':n']);
  assert.equal(String(ctx.getPendingAction(row.id).tg_message_id), '101', 'the Telegram message id is stored on the row');
  const again = ctx.proposeAction({ type: 'drive_create_file', payload: { name: 'note.md', content: 'hello there', path: 'notes' }, origin: 'test-skill' });
  assert.equal(again.id, row.id, 'identical payload → same pending row');
  assert.equal(state.fetch.telegram('sendMessage').length, 1, 'no second message');
  assert.deepEqual(J(ctx.buildSnapshot().pending_actions).map((p) => p.id), [row.id]);
});

test('owner ✅ via callback executes drive_create_file once; the file lands under the Drive root; messages are updated', () => {
  const { ctx, state } = fresh();
  const k = state.props[ctx.PROP.WEBHOOK_SECRET];
  const row = ctx.proposeAction({ type: 'drive_create_file', payload: { name: 'note.md', content: 'hi', path: 'notes/2026' } });
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ callback: 'a:' + row.id + ':y', messageId: Number(ctx.getPendingAction(row.id).tg_message_id) })));
  const done = ctx.getPendingAction(row.id);
  assert.equal(done.status, 'executed');
  assert.equal(state.drive.readFile('Hello/notes/2026', 'note.md'), 'hi');
  assert.match(J(done).result_json, /"summary":"created notes\/2026\/note.md"/);
  const edits = state.fetch.telegram('editMessageText');
  assert.equal(edits.length, 1);
  assert.match(edits[0].json.text, /✅ executed: created notes\/2026\/note\.md/);
  assert.equal(state.fetch.telegram('answerCallbackQuery').length, 1);
  // Tapping again is harmless.
  ctx.doPost(H.postEvent('tg', { k }, H.tgUpdate({ callback: 'a:' + row.id + ':y' })));
  assert.equal(state.fetch.telegram('answerCallbackQuery')[1].json.text, 'Already executed');
  // A second proposal for the same file name fails at execution instead of overwriting.
  const row2 = ctx.proposeAction({ type: 'drive_create_file', payload: { name: 'note.md', content: 'other', path: 'notes/2026' } });
  const r2 = ctx.decideAction(row2.id, 'y', 'owner:777');
  assert.equal(r2.ok, false);
  assert.match(r2.error, /already exists/);
  assert.equal(state.drive.readFile('Hello/notes/2026', 'note.md'), 'hi', 'never overwritten');
});

test('reject, expiry sweep, validation, allowlist and the daily cap', () => {
  const { ctx, state } = fresh();
  const a = ctx.proposeAction({ type: 'drive_create_file', payload: { name: 'a.md', content: 'a' } });
  assert.equal(ctx.decideAction(a.id, 'n').status, 'rejected');
  assert.match(state.fetch.telegram('editMessageText').slice(-1)[0].json.text, /❌ rejected/);
  const b = ctx.proposeAction({ type: 'drive_create_file', payload: { name: 'b.md', content: 'b' }, expires_in_min: 5 });
  ctx.__TEST_NOW = Date.now() + 6 * 60000;
  assert.equal(ctx.expirePendingActions(), 1);
  assert.equal(ctx.getPendingAction(b.id).status, 'expired');
  assert.equal(ctx.decideAction(b.id, 'y').status, 'expired');
  assert.throws(() => ctx.proposeAction({ type: 'gmail_send', payload: {} }), /not allowed/);
  assert.throws(() => ctx.proposeAction({ type: 'drive_create_file', payload: { content: 'x' } }), /name required/);
  assert.throws(() => ctx.proposeAction({ type: 'drive_create_file', payload: { name: '../x.md', content: 'x' } }), /plain file name/);
  assert.throws(() => ctx.proposeAction({ type: 'drive_create_file', payload: { name: 'x.md', content: 'x', path: '../etc' } }), /path must be/);
  assert.throws(() => ctx.proposeAction({ type: 'drive_create_file', payload: { name: 'x.md', content: 'x', mime: 'text/x-shellscript' } }), /mime must be/);
  state.props[ctx.PROP.MAX_PROPOSALS_PER_DAY] = '3';
  ctx.proposeAction({ type: 'drive_create_file', payload: { name: 'c.md', content: 'c' } });
  assert.throws(() => ctx.proposeAction({ type: 'drive_create_file', payload: { name: 'd.md', content: 'd' } }), /daily proposal cap reached \(3\)/);
  assert.ok(ctx.storeAll('AuditLog').some((x) => x.event === 'action_cap_reached'));
  assert.equal(ctx.decideAction('pa_missing', 'y').status, 'missing');
});

// Developed by: LightAISolutions

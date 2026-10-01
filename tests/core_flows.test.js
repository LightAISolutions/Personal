'use strict';
// 15_flows.js — conversational flows (registerFlow / flowStart / flowResume / flowCancel / expiry / pause) +
// 05_telegram.js tgSendDocument + 09_mailbox.js reply.drive_file_ids. Flows and fixtures here are invented.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

function fresh(opts = {}) {
  const { ctx, state } = H.loadGas({ pack: 'hello', ...opts });
  if (!opts.state) { H.bootstrap(ctx, state); H.configureRoutine(ctx, state); }
  return { ctx, state, k: state.props[ctx.PROP.WEBHOOK_SECRET] };
}
const J = (v) => JSON.parse(JSON.stringify(v)); // vm-realm objects vs node-realm literals
const tg = (ctx, k, upd) => ctx.doPost(H.postEvent('tg', { k }, upd));
const audits = (ctx, ev) => ctx.storeAll('AuditLog').filter((x) => x.event === ev);
const sent = (state) => state.fetch.telegram('sendMessage').map((r) => r.json.text);
const lastKeyboard = (state) => { const c = state.fetch.telegram('sendMessage'); const m = c[c.length - 1].json.reply_markup; return m ? m.inline_keyboard : null; };
const answers = (state) => state.fetch.telegram('answerCallbackQuery').map((r) => r.json.text || '');
const flowsRows = (ctx) => ctx.storeAll('Flows');

/** A three-step flow: button (colour) → text (reason) → done. `hooks` lets a test override next/onDone. */
function registerPick(ctx, hooks = {}) {
  const seen = { done: [] };
  ctx.registerFlow('pick', {
    ttl_min: hooks.ttl_min,
    start(seed) { return { prompt: 'Which <b>colour</b>?', keyboard: [[{ text: 'Red', value: 'red' }, { text: 'Blue', value: 'blue' }], { text: 'Docs', url: 'https://example.com' }], expect: 'button', state: { seed: seed === undefined ? null : seed } }; },
    next(state, input, fctx) {
      if (hooks.next) { const r = hooks.next(state, input, fctx); if (r !== undefined) return r; }
      if (input.type === 'button') { state.colour = input.value; return { prompt: 'Why ' + input.value + '?', expect: 'text', state }; }
      if (input.type === 'text') { state.why = input.text; return { prompt: 'Thanks!', done: true, state, result: { colour: state.colour, why: state.why } }; }
      throw new Error('unexpected input ' + input.type);
    },
    onDone(state, fctx) { seen.done.push({ state, chatId: fctx.chatId }); }
  });
  return seen;
}

test('registerFlow validates names and shapes; duplicates are rejected', () => {
  const { ctx } = fresh();
  assert.throws(() => ctx.registerFlow('Bad Name', { start() {}, next() {} }), /name must match/);
  assert.throws(() => ctx.registerFlow('nope', { start() {} }), /need \{start/);
  assert.throws(() => ctx.registerFlow('nope', { start() {}, next() {}, onDone: 3 }), /onDone must be a function/);
  assert.throws(() => ctx.registerFlow('nope', { start() {}, next() {}, ttl_min: 0 }), /ttl_min/);
  registerPick(ctx);
  assert.throws(() => registerPick(ctx), /already registered|duplicate/i);
  assert.equal(typeof ctx.getFlow('pick').start, 'function');
  assert.equal(ctx.getFlow('missing'), null);
  assert.throws(() => ctx.flowStart('777', 'missing'), /unknown flow/);
});

test('three-step flow: button → text → done, with first claim on text and fl callbacks', () => {
  const { ctx, state, k } = fresh();
  const seen = registerPick(ctx);
  const r1 = ctx.flowStart('777', 'pick', { trip: 'demo' });
  assert.deepEqual(J(r1), { done: false, step: 1, paused: false });
  assert.equal(sent(state).pop(), 'Which <b>colour</b>?');
  const kb = lastKeyboard(state);
  assert.deepEqual(kb[0].map((b) => b.callback_data), ['fl:1:red', 'fl:1:blue']);
  assert.equal(kb[1][0].url, 'https://example.com');
  const active = ctx.flowActive('777');
  assert.equal(active.flow, 'pick'); assert.equal(active.step, 1); assert.equal(active.expect, 'button');
  assert.deepEqual(J(active.state), { seed: { trip: 'demo' } });
  assert.equal(audits(ctx, 'flow_started').length, 1);

  // Free text while a button is expected: nudged, flow unchanged, no request opened.
  tg(ctx, k, H.tgUpdate({ text: 'blue please' }));
  assert.match(sent(state).pop(), /use the buttons above/);
  assert.equal(ctx.flowActive('777').step, 1);
  assert.equal(ctx.storeCount('Requests'), 0);

  // Button press: keyboard cleared, next step asks for text.
  tg(ctx, k, H.tgUpdate({ callback: 'fl:1:blue', messageId: 101 }));
  const cleared = state.fetch.telegram('editMessageReplyMarkup');
  assert.equal(cleared.length, 1); assert.equal(cleared[0].json.message_id, 101); assert.deepEqual(cleared[0].json.reply_markup, { inline_keyboard: [] });
  assert.equal(sent(state).pop(), 'Why blue?');
  const a2 = ctx.flowActive('777');
  assert.equal(a2.step, 2); assert.equal(a2.expect, 'text'); assert.equal(a2.state.colour, 'blue');

  // A stale button from step 1 is refused.
  tg(ctx, k, H.tgUpdate({ callback: 'fl:1:red' }));
  assert.equal(answers(state).pop(), 'That question has moved on.');
  assert.equal(ctx.flowActive('777').step, 2);

  // Free text is claimed by the flow (not turned into a request) and finishes it.
  tg(ctx, k, H.tgUpdate({ text: 'it is calm' }));
  assert.equal(sent(state).pop(), 'Thanks!');
  assert.equal(ctx.flowActive('777'), null);
  assert.equal(flowsRows(ctx).length, 0);
  assert.equal(ctx.storeCount('Requests'), 0);
  assert.deepEqual(J(seen.done), [{ state: { seed: { trip: 'demo' }, colour: 'blue', why: 'it is calm' }, chatId: 777 }]);
  assert.equal(audits(ctx, 'flow_done').length, 1);
  assert.equal(audits(ctx, 'flow_done')[0].detail_json, '{"steps":2}');

  // Pressing a button after the flow ended is answered, not crashed.
  tg(ctx, k, H.tgUpdate({ callback: 'fl:2:x' }));
  assert.equal(answers(state).pop(), 'That conversation has ended.');
});

test('/cancel ends the flow; a command mid-flow is handled and the flow continues', () => {
  const { ctx, state, k } = fresh();
  registerPick(ctx);
  tg(ctx, k, H.tgUpdate({ text: '/cancel' }));
  assert.equal(sent(state).pop(), 'Nothing to cancel.');
  ctx.flowStart('777', 'pick');
  tg(ctx, k, H.tgUpdate({ callback: 'fl:1:red' }));
  assert.equal(ctx.flowActive('777').step, 2);
  // A command always wins over the flow's text claim — and does not disturb the flow.
  tg(ctx, k, H.tgUpdate({ text: '/ping' }));
  assert.match(sent(state).pop(), /^pong/);
  assert.equal(ctx.flowActive('777').step, 2);
  assert.equal(ctx.flowActive('777').state.colour, 'red');
  tg(ctx, k, H.tgUpdate({ text: '/cancel' }));
  assert.equal(sent(state).pop(), '✖️ Cancelled pick.');
  assert.equal(ctx.flowActive('777'), null);
  assert.equal(audits(ctx, 'flow_cancelled').length, 1);
  assert.equal(ctx.storeCount('Requests'), 0);
  // After cancel, free text goes back to the normal path (a request is opened).
  tg(ctx, k, H.tgUpdate({ text: 'what now?' }));
  assert.equal(ctx.storeCount('Requests'), 1);
});

test('flow state survives a fresh execution (new context, same stored data)', () => {
  const { ctx, state, k } = fresh();
  registerPick(ctx);
  ctx.flowStart('777', 'pick', 7);
  tg(ctx, k, H.tgUpdate({ callback: 'fl:1:red' }));
  // Second context = a new Apps Script execution: fresh globals, same Sheet.
  const second = fresh({ state });
  const seen2 = registerPick(second.ctx);
  const a = second.ctx.flowActive('777');
  assert.equal(a.step, 2); assert.equal(a.expect, 'text'); assert.deepEqual(J(a.state), { seed: 7, colour: 'red' });
  tg(second.ctx, second.k, H.tgUpdate({ text: 'warm' }));
  assert.equal(sent(state).pop(), 'Thanks!');
  assert.deepEqual(J(seen2.done[0].state), { seed: 7, colour: 'red', why: 'warm' });
  assert.equal(second.ctx.flowActive('777'), null);
});

test('expiry: the sweep removes a flow past ttl_min, audits it and tells the owner once', () => {
  const { ctx, state } = fresh({ now: '2026-05-01T10:00:00Z' });
  registerPick(ctx, { ttl_min: 30 });
  ctx.flowStart('777', 'pick');
  const row = flowsRows(ctx)[0];
  assert.equal(row.expires_at, '2026-05-01T10:30:00.000Z');
  ctx.__TEST_NOW = '2026-05-01T10:29:00Z';
  assert.equal(ctx.wakeSweep('manual').flows_expired, 0);
  assert.equal(ctx.flowActive('777').step, 1);
  ctx.__TEST_NOW = '2026-05-01T10:31:00Z';
  assert.equal(ctx.flowActive('777'), null, 'an expired row reads as no active flow even before the sweep');
  const r = ctx.wakeSweep('manual');
  assert.equal(r.flows_expired, 1);
  assert.equal(flowsRows(ctx).length, 0);
  assert.equal(audits(ctx, 'flow_expired').length, 1);
  assert.equal(audits(ctx, 'flow_expired')[0].ok, 'false');
  assert.match(sent(state).pop(), /^⌛ pick timed out/);
  assert.equal(ctx.wakeSweep('manual').flows_expired, 0, 'told once');
  // The default ttl is LIMITS.FLOW_DEFAULT_TTL_MIN.
  ctx.__TEST_NOW = '2026-05-02T00:00:00Z';
  ctx.registerFlow('quick', { start() { return { prompt: 'q', expect: 'any', state: {} }; }, next() { return { prompt: 'd', done: true, state: {} }; } });
  ctx.flowStart('777', 'quick');
  assert.equal(flowsRows(ctx)[0].expires_at, new Date(Date.parse('2026-05-02T00:00:00Z') + ctx.LIMITS.FLOW_DEFAULT_TTL_MIN * 60000).toISOString());
});

test('pause keeps the state but releases the text claim until flowResume; errors in next() stop the flow', () => {
  const { ctx, state, k } = fresh();
  const seen = registerPick(ctx, {
    next(st, input) {
      if (input.type === 'button') { st.colour = input.value; return { pause: true, state: st }; }
      if (input.type === 'resume') { st.resumed = input.data; return { prompt: 'Resumed', expect: 'text', state: st }; }
    }
  });
  ctx.flowStart('777', 'pick');
  const r = tg(ctx, k, H.tgUpdate({ callback: 'fl:1:blue' }));
  assert.equal(r.content, 'OK');
  const a = ctx.flowActive('777');
  assert.equal(a.paused, true); assert.equal(a.expect, 'paused'); assert.equal(a.step, 2);
  tg(ctx, k, H.tgUpdate({ text: 'are you there?' }));
  assert.equal(ctx.storeCount('Requests'), 1, 'text while paused is not claimed — it opens a request as usual');
  assert.match(sent(state).pop(), /Working on it/);
  const before = sent(state).length;
  tg(ctx, k, H.tgUpdate({ callback: 'fl:2:blue' }));
  assert.equal(answers(state).pop(), 'One moment — still working on the previous step.');
  assert.equal(sent(state).length, before, 'no prompt went out while paused');
  const rr = ctx.flowResume('777', { data: 42 });
  assert.deepEqual(J(rr), { done: false, step: 3, paused: false });
  assert.equal(sent(state).pop(), 'Resumed');
  assert.deepEqual(J(ctx.flowActive('777').state), { seed: null, colour: 'blue', resumed: 42 });
  tg(ctx, k, H.tgUpdate({ text: 'fine' }));
  assert.equal(sent(state).pop(), 'Thanks!');
  assert.equal(seen.done.length, 1);
  assert.equal(ctx.flowResume('777', { data: 1 }), null, 'nothing to resume');

  // next() throwing cancels the flow, audits and tells the owner.
  ctx.registerFlow('boom', { start() { return { prompt: 'go', expect: 'text', state: { n: 1 } }; }, next() { throw new Error('kaput'); } });
  ctx.flowStart('777', 'boom');
  const e = ctx.flowResume('777', 'x');
  assert.equal(e.done, true); assert.match(e.error, /kaput/);
  assert.equal(ctx.flowActive('777'), null);
  assert.equal(audits(ctx, 'flow_error').length, 1);
  assert.match(sent(state).pop(), /^⚠️ boom stopped/);
  // Starting a flow while another is active replaces it (audited).
  ctx.flowStart('777', 'pick'); ctx.flowStart('777', 'boom');
  assert.equal(ctx.flowActive('777').flow, 'boom');
  assert.equal(audits(ctx, 'flow_replaced').length, 1);
  assert.equal(flowsRows(ctx).length, 1);
  // Oversized state is refused.
  ctx.registerFlow('fat', { start() { return { prompt: 'x', expect: 'any', state: { big: 'z'.repeat(ctx.LIMITS.FLOW_STATE_MAX_CHARS) } }; }, next() {} });
  assert.throws(() => ctx.flowStart('777', 'fat'), /state_json/);
});

test('tgSendDocument sends a Drive file as multipart sendDocument; oversize falls back to the link', () => {
  const { ctx, state } = fresh();
  const f = state.drive.putFile('Helper/out', 'plan.md', '# Day 1\nWalk.', 'text/markdown');
  const r = ctx.tgSendDocument('777', { driveFileId: f.getId(), caption: '<b>Plan</b>', replyTo: 12, silent: true });
  assert.equal(r.ok, true);
  const calls = state.fetch.telegram('sendDocument');
  assert.equal(calls.length, 1);
  const p = calls[0].options.payload;
  assert.equal(calls[0].json, null, 'multipart, not a JSON body');
  assert.equal(calls[0].options.contentType, undefined);
  assert.equal(p.chat_id, '777'); assert.equal(p.caption, '<b>Plan</b>'); assert.equal(p.parse_mode, 'HTML');
  assert.equal(p.reply_to_message_id, '12'); assert.equal(p.disable_notification, 'true');
  assert.equal(typeof p.document.getBytes, 'function');
  assert.equal(p.document.getDataAsString(), '# Day 1\nWalk.');
  assert.deepEqual(Object.keys(p).sort(), ['caption', 'chat_id', 'disable_notification', 'document', 'parse_mode', 'reply_to_message_id']);
  // Missing file.
  const miss = ctx.tgSendDocument('777', { driveFileId: 'nope-nope-nope' });
  assert.equal(miss.ok, false); assert.equal(audits(ctx, 'document_not_found').length, 1);
  // Oversize → link + audit, no sendDocument call.
  ctx.LIMITS.DOCUMENT_MAX_BYTES = 5;
  const big = ctx.tgSendDocument('777', { driveFileId: f.getId(), caption: 'Plan' });
  assert.equal(big.ok, true); assert.equal(big.fallback, 'link'); assert.equal(big.description, 'document_too_large');
  assert.equal(state.fetch.telegram('sendDocument').length, 1);
  assert.match(sent(state).pop(), /too large to attach/);
  assert.match(sent(state).pop(), /plan\.md/);
  assert.equal(audits(ctx, 'document_too_large').length, 1);
  // Blob-only path: no link to fall back to.
  const blob = ctx.Utilities.newBlob('hello world', 'text/plain', 'hi.txt');
  const b = ctx.tgSendDocument('777', { blob });
  assert.equal(b.ok, false); assert.equal(b.description, 'document_too_large');
  ctx.LIMITS.DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;
  const b2 = ctx.tgSendDocument('777', { blob, filename: 'renamed.txt' });
  assert.equal(b2.ok, true);
  assert.equal(state.fetch.telegram('sendDocument').pop().options.payload.document.getName(), 'renamed.txt');
  assert.equal(ctx.tgSendDocument('777', {}).ok, false);
  // Owner variant.
  assert.equal(ctx.tgSendOwnerDocument({ blob }).ok, true);
  assert.equal(state.fetch.telegram('sendDocument').pop().options.payload.chat_id, '777');
});

test('reply envelopes may carry drive_file_ids: validated, then sent as captioned documents after the text', () => {
  const { ctx, state, k } = fresh();
  const f1 = state.drive.putFile(ctx.HELPER.drive_root + '/out', 'notes.md', 'notes', 'text/markdown');   // inside the helper's folder: attachable
  const f2 = state.drive.putFile(ctx.HELPER.drive_root + '/out', 'brochure.html', '<p>b</p>', 'text/html');
  tg(ctx, k, H.tgUpdate({ text: 'plan my weekend', messageId: 31 }));
  const req = ctx.storeAll('Requests')[0];
  const bad = H.envelope('reply', { text: 'x', drive_file_ids: { 'Bad/Label': f1.getId(), Ok: 'short' } }, { in_reply_to: req.id });
  assert.match(ctx.validateEnvelope(JSON.stringify(bad), 200).errors.join(' '), /bad label.*must be a Drive file id/);
  const tooMany = {}; for (let i = 0; i <= ctx.LIMITS.REPLY_MAX_DOCUMENTS; i++) tooMany['f' + i] = f1.getId();
  assert.match(ctx.validateEnvelope(JSON.stringify(H.envelope('reply', { text: 'x', drive_file_ids: tooMany }, { in_reply_to: req.id })), 200).errors.join(' '), /drive_file_ids/);
  assert.equal(ctx.validateEnvelope(JSON.stringify(H.envelope('reply', { text: 'x' }, { in_reply_to: req.id })), 200).errors.length, 0, 'drive_file_ids stays optional');
  const good = H.envelope('reply', { text: 'Here you go', drive_file_ids: { Notes: f1.getId(), Brochure: f2.getId() } }, { in_reply_to: req.id });
  H.putEnvelope(state, good);
  const r = ctx.wakeSweep('manual');
  assert.equal(r.mailbox.processed, 1);
  const msgs = sent(state);
  assert.equal(msgs.pop(), 'Here you go');
  const docs = state.fetch.telegram('sendDocument');
  assert.deepEqual(docs.map((d) => d.options.payload.caption), ['Notes', 'Brochure']);
  assert.deepEqual(docs.map((d) => d.options.payload.chat_id), ['777', '777']);
  assert.ok(docs.every((d) => d.options.payload.disable_notification === 'true'));
  const processed = audits(ctx, 'envelope_processed');
  assert.match(processed[processed.length - 1].detail_json, /documents\\":2,\\"documents_sent\\":2/);
  assert.equal(ctx.getRequest(req.id).status, 'answered');
});

// Developed by: LightAISolutions

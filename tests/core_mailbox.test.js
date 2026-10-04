'use strict';
// 09_mailbox.js — envelope validation, dispatch + archive folders, dedupe, reply→request, proposals, snapshot, pruning.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');
const J = (v) => JSON.parse(JSON.stringify(v));

function fresh(opts = {}) {
  const { ctx, state } = H.loadGas({ pack: 'hello', ...opts });
  H.bootstrap(ctx, state);
  return { ctx, state };
}
const names = (state, p) => (state.drive.listFiles('Hello/mailbox/' + p) || []).sort();
const errorsOf = (ctx, env) => { const raw = JSON.stringify(env); return ctx.validateEnvelope(raw, raw.length); };

test('validateEnvelope enforces the v1 shape, age, sizes, type and the handler\'s payload rules', () => {
  const { ctx } = fresh({ now: '2026-05-05T12:00:00Z' });
  const ok = errorsOf(ctx, H.envelope('notice', { text: 'hi' }));
  assert.equal(ok.ok, true, ok.errors.join('; '));
  const bad = (env) => errorsOf(ctx, env).errors.join(' | ');
  assert.match(bad({ ...H.envelope('notice', { text: 'hi' }), extra: 1 }), /unknown key: extra/);
  assert.match(bad(H.envelope('notice', { text: 'hi' }, { v: 2 })), /v must be 1/);
  assert.match(bad(H.envelope('notice', { text: 'hi' }, { id: 'short' })), /id must match/);
  assert.match(bad(H.envelope('bogus', { text: 'hi' })), /unknown type/);
  assert.match(bad(H.envelope('request', { text: 'hi' })), /unknown type/, 'request is core→brain only');
  assert.match(bad(H.envelope('notice', { text: 'hi' }, { created_at: '2026-04-01T00:00:00Z' })), /older than 14 days/);
  assert.match(bad(H.envelope('notice', { text: 'hi' }, { created_at: '2026-05-08T00:00:00Z' })), /in the future/);
  assert.match(bad(H.envelope('notice', { text: 'hi' }, { producer: 'Bad Producer' })), /producer must match/);
  assert.match(bad(H.envelope('notice', 'text')), /payload must be an object/);
  assert.match(bad(H.envelope('notice', { text: 'x'.repeat(16001) })), /exceeds 16000/);
  assert.match(bad(H.envelope('notice', { text: '' })), /payload: text required/);
  assert.match(bad(H.envelope('notice', { text: 'x', level: 'loud' })), /level must be info\|warn/);
  assert.match(bad(H.envelope('reply', { text: 'x' })), /reply needs in_reply_to/);
  assert.match(bad(H.envelope('notice', { text: 'x' }, { in_reply_to: 'r'.repeat(65) })), /in_reply_to invalid/);
  assert.match(bad(H.envelope('proposal', { action: 'gmail_send', payload: {} })), /action must be one of drive_create_file/);
  assert.match(bad(H.envelope('proposal', { action: 'drive_create_file', payload: { content: 1 } })), /drive_create_file: name required/);
  assert.match(bad(H.envelope('greeting', { name: '' })), /name required/);
  assert.match(ctx.validateEnvelope('not json', 8).errors[0], /invalid JSON/);
  assert.match(ctx.validateEnvelope('{}', 999999).errors[0], /file too large/);
  assert.match(ctx.validateEnvelope('[]', 2).errors[0], /must be a JSON object/);
});

test('pollFromBrain: notice → owner message + processed; junk → rejected; duplicate id → processed once; throwing handler → failed', () => {
  const { ctx, state } = fresh({ manifest: { name: 'hello', display_name: 'Hello Helper', drive_root: 'Hello', version: '0.1.0', envelope_types: ['greeting', 'boom'] } });
  ctx.registerEnvelopeHandler('boom', () => { throw new Error('handler exploded'); });
  const n = H.envelope('notice', { text: 'Pack <your> bag', title: 'Trip', level: 'warn' });
  H.putEnvelope(state, n, 'a.json');
  H.putEnvelope(state, n, 'a-copy.json');
  state.drive.putFile('Hello/mailbox/from-brain', 'readme.txt', 'not an envelope');
  H.putEnvelope(state, { v: 1, id: 'x' }, 'broken.json');
  H.putEnvelope(state, H.envelope('boom', { any: 1 }), 'boom.json');
  const r = J(ctx.pollFromBrain());
  assert.deepEqual(r, { processed: 1, rejected: 2, failed: 1, duplicate: 1 });
  assert.deepEqual(names(state, 'from-brain'), []);
  assert.deepEqual(names(state, 'archive/processed'), ['a-copy.json', 'a.json']);
  assert.deepEqual(names(state, 'archive/rejected'), ['broken.json', 'readme.txt']);
  assert.deepEqual(names(state, 'archive/failed'), ['boom.json']);
  const sent = state.fetch.telegram('sendMessage');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].json.text, '⚠️ <b>Trip</b>\nPack &lt;your&gt; bag');
  assert.equal(String(sent[0].json.chat_id), '777');
  const ev = ctx.storeAll('AuditLog').map((x) => x.event);
  ['envelope_processed', 'envelope_duplicate', 'envelope_rejected', 'envelope_failed'].forEach((e) => assert.ok(ev.includes(e), e));
  assert.equal(ctx.storeAll('AuditLog').find((x) => x.event === 'envelope_processed').actor, n.producer, 'audit actor is the producer');
});

test('reply answers the request that opened it: Telegram reply to the original message, Requests row answered, req file archived', () => {
  const { ctx, state } = fresh();
  H.configureRoutine(ctx, state);
  const open = ctx.openRequest({ kind: 'ask', text: 'what now?', chat: { chat_id: 777, message_id: 42 } });
  assert.deepEqual(names(state, 'to-brain'), ['req_' + open.id + '.json', 'state.json']);
  const req = JSON.parse(state.drive.readFile('Hello/mailbox/to-brain', 'req_' + open.id + '.json'));
  assert.equal(req.type, 'request'); assert.equal(req.producer, 'hello-core'); assert.equal(req.payload.kind, 'ask');
  assert.equal(req.payload.chat.message_id, 42);
  H.putEnvelope(state, H.envelope('reply', { text: 'Do <this>', html: false }, { in_reply_to: open.id }));
  const r = J(ctx.pollFromBrain());
  assert.equal(r.processed, 1);
  const sent = state.fetch.telegram('sendMessage');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].json.text, 'Do &lt;this&gt;');
  assert.equal(sent[0].json.reply_to_message_id, '42');
  assert.equal(String(sent[0].json.chat_id), '777');
  const row = ctx.getRequest(open.id);
  assert.equal(row.status, 'answered'); assert.ok(row.answered_at);
  assert.deepEqual(names(state, 'to-brain'), ['state.json'], 'req file archived once answered');
  assert.deepEqual(names(state, 'archive/processed').filter((x) => /^req_/.test(x)), ['req_' + open.id + '.json']);
  assert.equal(ctx.openRequestCount(), 0);
  // A reply to an unknown request still reaches the owner (no crash, no lost answer).
  H.putEnvelope(state, H.envelope('reply', { text: '<b>late</b>', html: true }, { in_reply_to: 'unknown-request-id' }));
  assert.equal(J(ctx.pollFromBrain()).processed, 1);
  assert.equal(state.fetch.lastTelegramText(), '<b>late</b>');
});

test('an answer whose handler throws: the request is marked failed and the owner hears once; the key is released; a late answer lands', () => {
  const { ctx, state } = fresh({ manifest: { name: 'hello', display_name: 'Hello Helper', drive_root: 'Hello', version: '0.1.0', envelope_types: ['greeting', 'boom'] } });
  H.configureRoutine(ctx, state);
  let explode = true;
  ctx.registerEnvelopeHandler('boom', () => { if (explode) throw new Error('Sheet tab missing: Cards'); ctx.tgSendOwner('card'); return { sent: true }; });
  const open = ctx.openRequest({ kind: 'card', text: '/card <rebuild>', chat: { chat_id: 777, message_id: 9 } });
  const env = H.envelope('boom', { any: 1 }, { in_reply_to: open.id, dedupe_key: 'card:' + open.id });
  H.putEnvelope(state, env, 'boom.json');
  assert.deepEqual(J(ctx.pollFromBrain()), { processed: 0, rejected: 0, failed: 1, duplicate: 0 });
  assert.equal(ctx.getRequest(open.id).status, 'failed');
  assert.equal(ctx.openRequestCount(), 0, 'no more follow-up sweeps for it');
  const sent = state.fetch.telegram('sendMessage').map((r) => r.json.text);
  assert.deepEqual(sent, ['⚠️ Something went wrong on my side with “/card &lt;rebuild&gt;”, so the answer did not come through. It is logged; please try again.']);
  assert.equal(ctx.storeAll('AuditLog').filter((r) => r.event === 'request_failed').length, 1);
  // The same answer again under the same key (fixed now) is handled, not dropped as a duplicate, and answers the request.
  explode = false;
  H.putEnvelope(state, { ...env, id: 'retry-' + env.id.slice(0, 20) }, 'boom-again.json');
  assert.deepEqual(J(ctx.pollFromBrain()), { processed: 1, rejected: 0, failed: 0, duplicate: 0 });
  assert.equal(ctx.getRequest(open.id).status, 'answered');
  assert.equal(state.fetch.lastTelegramText(), 'card');
  assert.equal(J(ctx.wakeSweep('trigger')).requests_expired, 0);
  ctx.__TEST_NOW = new Date(state.now() + 25 * 3600000).toISOString();
  assert.equal(J(ctx.wakeSweep('trigger')).requests_expired, 0, 'never reported again as unanswered');
});

test('a failed answer is not reported when another envelope of the same batch answered the request; a refused one stays silent', () => {
  const { ctx, state } = fresh({ manifest: { name: 'hello', display_name: 'Hello Helper', drive_root: 'Hello', version: '0.1.0', envelope_types: ['greeting', 'boom'] } });
  H.configureRoutine(ctx, state);
  ctx.registerEnvelopeHandler('boom', () => { throw new Error('handler exploded'); });
  const a = ctx.openRequest({ kind: 'ask', text: 'first', chat: { chat_id: 777, message_id: 1 } });
  H.putEnvelope(state, H.envelope('boom', { any: 1 }, { in_reply_to: a.id }), 'a1.json');
  H.putEnvelope(state, H.envelope('reply', { text: 'the answer' }, { in_reply_to: a.id }), 'a2.json');
  const b = ctx.openRequest({ kind: 'ask', text: 'second', chat: { chat_id: 777, message_id: 2 } });
  H.putEnvelope(state, H.envelope('reply', { text: '' }, { in_reply_to: b.id }), 'b1.json');   // refused: text required
  assert.deepEqual(J(ctx.pollFromBrain()), { processed: 1, rejected: 1, failed: 1, duplicate: 0 });
  assert.equal(ctx.getRequest(a.id).status, 'answered');
  assert.equal(ctx.getRequest(b.id).status, 'open', 'a refused answer leaves the request waiting');
  assert.deepEqual(state.fetch.telegram('sendMessage').map((r) => r.json.text), ['the answer']);
});

test('proposal envelopes become pending actions; a proposal guard can refuse; observers see every handled envelope', () => {
  const { ctx, state } = fresh();
  const seen = [];
  ctx.registerEnvelopeObserver('spy', (env, result) => seen.push([env.type, J(result)]));
  H.putEnvelope(state, H.envelope('proposal', { action: 'drive_create_file', payload: { name: 'p.md', content: 'p' }, rationale: 'because' }));
  assert.equal(J(ctx.pollFromBrain()).processed, 1);
  const pending = ctx.listPendingActions();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].origin, 'test-skill — because');
  assert.match(state.fetch.lastTelegramText(), /Action proposal/);
  ctx.registerProposalGuard('no_p_files', (env, p) => (p.payload.name === 'q.md' ? 'q files are not allowed' : null));
  H.putEnvelope(state, H.envelope('proposal', { action: 'drive_create_file', payload: { name: 'q.md', content: 'q' } }));
  assert.equal(J(ctx.pollFromBrain()).processed, 1, 'refused proposals are still "processed" (archived, not retried)');
  assert.equal(ctx.listPendingActions().length, 1);
  assert.ok(ctx.storeAll('AuditLog').some((x) => x.event === 'proposal_refused' && x.detail_json.includes('q files are not allowed')));
  assert.deepEqual(seen.map((s) => s[0]), ['proposal', 'proposal']);
  assert.equal(seen[1][1].refused, 'q files are not allowed');
});

test('snapshot carries the core fields, wake_url and every provider; writeSnapshot upserts one state.json', () => {
  const { ctx, state } = fresh({ now: '2026-05-05T12:00:00Z' });
  const s = J(ctx.buildSnapshot());
  assert.equal(s.v, 1); assert.equal(s.generated_at, '2026-05-05T12:00:00.000Z'); assert.equal(s.tz, 'Etc/UTC');
  assert.equal(s.helper, 'hello'); assert.equal(s.version, '0.1.0'); assert.equal(s.core_version, ctx.CORE_VERSION);
  assert.equal(s.wake_url, 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec?route=wake');
  assert.deepEqual(s.pending_actions, []); assert.deepEqual(s.queue, { depth: 0 }); assert.deepEqual(s.requests_open, []);
  assert.deepEqual(s.hello, { greetings_sent: 0 });
  ctx.writeSnapshot(); ctx.writeSnapshot();
  assert.deepEqual(names(state, 'to-brain'), ['state.json']);
  assert.equal(JSON.parse(state.drive.readFile('Hello/mailbox/to-brain', 'state.json')).helper, 'hello');
  ctx.registerSnapshotProvider('broken', () => { throw new Error('nope'); });
  assert.match(J(ctx.buildSnapshot()).broken.error, /nope/, 'a broken provider never breaks the snapshot');
});

test('mailboxWriteRequest validates kind; pruneMailbox trashes stale requests and old archive files, keeps state.json', () => {
  const { ctx, state } = fresh();
  assert.throws(() => ctx.mailboxWriteRequest({ kind: 'Bad Kind' }), /bad kind/);
  const id = ctx.mailboxWriteRequest({ kind: 'ask', text: 'x' });
  assert.match(id, /^[0-9a-f-]{36}$/);
  ctx.writeSnapshot();
  state.drive.putFile('Hello/mailbox/archive/processed', 'old.json', '{}');
  assert.equal(ctx.pruneMailbox(), 0, 'nothing is old yet');
  ctx.__TEST_NOW = Date.now() + 31 * 86400000;
  assert.equal(ctx.pruneMailbox(), 2);
  assert.deepEqual(names(state, 'to-brain'), ['state.json']);
  assert.deepEqual(names(state, 'archive/processed'), []);
});

test('reply html goes through tgSafeHtml, hidden characters are stripped from notice and reply text, and a Drive file outside the helper folder is never attached (R1–R3)', () => {
  const { ctx, state } = fresh();
  H.configureRoutine(ctx, state);
  const open = ctx.openRequest({ kind: 'ask', text: 'files?', chat: { chat_id: 777, message_id: 7 } });
  const inside = state.drive.putFile('Hello/Trips/demo', 'plan.pdf', '%PDF-1.7 inside', 'application/pdf');
  const outside = state.drive.putFile('Elsewhere/Private', 'statement.pdf', '%PDF-1.7 not ours', 'application/pdf');
  const userinfo = 'https://lookalike.example' + '@' + 'evil.test/';   // built at runtime: the boundary check reads a literal as an e-mail address
  H.putEnvelope(state, H.envelope('reply', {
    text: 'See <a href="' + userinfo + '">the plan</a> and <b>da\u202Ey 2</b>', html: true,
    drive_file_ids: { plan: inside.getId(), statement: outside.getId(), gone: 'fixtureMissingFile000' },
  }, { in_reply_to: open.id }));
  assert.equal(J(ctx.pollFromBrain()).processed, 1);
  const sent = state.fetch.telegram('sendMessage');
  assert.equal(sent[0].json.text, 'See &lt;a href="' + userinfo + '"&gt;the plan</a> and <b>day 2</b>');
  const docs = state.fetch.telegram('sendDocument');
  assert.equal(docs.length, 1, 'only the file inside Hello/ is attached; the outside file is skipped, the missing one audited');
  const ev = ctx.storeAll('AuditLog');
  assert.ok(ev.some((x) => x.event === 'document_outside_root' && x.detail_json.includes('"statement"')));
  assert.ok(ev.some((x) => x.event === 'document_not_found'));
  assert.equal(ctx.driveFileWhere(inside.getId()), 'in');
  assert.equal(ctx.driveFileWhere(outside.getId()), 'outside');
  assert.equal(ctx.driveFileWhere('fixtureMissingFile000'), 'missing');
  H.putEnvelope(state, H.envelope('notice', { text: 'to​day⁦ fine', title: 'He‮ads up' }));
  assert.equal(J(ctx.pollFromBrain()).processed, 1);
  assert.equal(state.fetch.lastTelegramText(), 'ℹ️ <b>Heads up</b>\ntoday fine');
});

// Developed by: LightAISolutions

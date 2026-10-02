'use strict';
// 16_upload.js — ?route=upload: per-request HMAC key, open/just-answered requests only, mime/name/folder/size/count checks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness/gas-mocks');

function fresh() {
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state);
  return { ctx, state };
}
const post = (ctx, body) => JSON.parse(ctx.doPost(H.postEvent('upload', {}, body)).content);
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
function openWithKey(ctx, state) {
  const open = ctx.openRequest({ kind: 'ask', text: 'plan it', chat: { chat_id: 777, message_id: 9 } });
  const req = JSON.parse(state.drive.readFile('Hello/mailbox/to-brain', `req_${open.id}.json`));
  return { id: open.id, key: req.payload.upload_key };
}

test('the request file carries a per-request upload key; a good upload lands under the helper root and can be attached', () => {
  const { ctx, state } = fresh();
  const { id, key } = openWithKey(ctx, state);
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(key, ctx.uploadKey(id));
  assert.notEqual(key, ctx.uploadKey(openWithKey(ctx, state).id), 'each request gets its own key');
  const r = post(ctx, { req: 'req_' + id, key, name: 'shortlist-r1.pdf', mime: 'application/pdf', data: b64('%PDF-1.7 sheet'), folder: 'trips/kyoto' });
  assert.equal(r.ok, true);
  assert.equal(r.name, 'shortlist-r1.pdf');
  assert.equal(r.bytes, 14);
  assert.deepEqual(state.drive.listFiles('Hello/trips/kyoto'), ['shortlist-r1.pdf']);
  assert.equal(state.drive.readFile('Hello/trips/kyoto', 'shortlist-r1.pdf'), '%PDF-1.7 sheet');
  assert.equal(ctx.driveFileWhere(r.file_id), 'in', 'inside the root, so a reply may name it in drive_file_ids');
  const d = post(ctx, { req: id, key, name: 'page.html', mime: 'text/html', data: b64('<p>x</p>') });
  assert.equal(d.ok, true);
  assert.deepEqual(state.drive.listFiles('Hello/files'), ['page.html'], 'default folder is files/');
  assert.ok(ctx.storeAll('AuditLog').some((x) => x.event === 'upload'));
});

test('wrong key, unknown or malformed request, bad mime/name/folder/data are refused and audited', () => {
  const { ctx, state } = fresh();
  const { id, key } = openWithKey(ctx, state);
  const ok = { req: id, key, name: 'a.pdf', mime: 'application/pdf', data: b64('%PDF') };
  const reason = (over) => post(ctx, { ...ok, ...over }).reason;
  assert.equal(reason({ key: key.replace(/.$/, (c) => (c === '0' ? '1' : '0')) }), 'bad_key');
  assert.equal(reason({ key: '' }), 'bad_key');
  assert.equal(reason({ req: 'not-a-uuid' }), 'bad_request_id');
  const ghost = '00000000-0000-4000-8000-000000000000';
  assert.equal(reason({ req: ghost, key: ctx.uploadKey(ghost) }), 'unknown_request');
  assert.equal(reason({ mime: 'application/zip', name: 'a.zip' }), 'bad_mime');
  assert.equal(reason({ name: 'a.html' }), 'bad_name', 'extension must match the mime');
  assert.equal(reason({ name: '../a.pdf' }), 'bad_name');
  assert.equal(reason({ folder: 'mailbox/from-brain' }), 'bad_folder', 'never into the mailbox');
  assert.equal(reason({ folder: 'Trips/Kyoto' }), 'bad_folder');
  assert.equal(reason({ folder: 'a/b/c/d' }), 'bad_folder');
  assert.equal(reason({ folder: 'trips/../x' }), 'bad_folder');
  assert.equal(reason({ data: '' }), 'empty_file');
  assert.equal(post(ctx, 'not json').reason, 'bad_json');
  assert.equal(post(ctx, '').reason, 'empty_body');
  assert.equal(state.drive.listFiles('Hello/files'), null, 'nothing was written');
  assert.ok(ctx.storeAll('AuditLog').filter((x) => x.event === 'upload_refused').length >= 10);
});

test('closed, expired or long-answered requests take no uploads; an answered one takes them for an hour; six per request', () => {
  const { ctx, state } = fresh();
  const { id, key } = openWithKey(ctx, state);
  const send = (n) => post(ctx, { req: id, key, name: `f${n}.pdf`, mime: 'application/pdf', data: b64('%PDF ' + n) });
  ctx.markRequestAnswered(id, { type: 'reply' });
  assert.equal(send(1).ok, true, 'just answered: still open for uploads');
  ctx.__TEST_NOW = Date.now() + 61 * 60000;
  assert.equal(send(2).reason, 'request_closed');
  const b = openWithKey(ctx, state);
  for (let n = 1; n <= 6; n++) assert.equal(post(ctx, { req: b.id, key: b.key, name: `g${n}.pdf`, mime: 'application/pdf', data: b64('%PDF') }).ok, true);
  assert.equal(post(ctx, { req: b.id, key: b.key, name: 'g7.pdf', mime: 'application/pdf', data: b64('%PDF') }).reason, 'too_many_files');
  const c = openWithKey(ctx, state);
  ctx.__TEST_NOW += 25 * 3600000;
  assert.equal(post(ctx, { req: c.id, key: c.key, name: 'h.pdf', mime: 'application/pdf', data: b64('%PDF') }).reason, 'request_too_old');
});

test('upload before setup is refused without touching Drive', () => {
  const { ctx } = H.loadGas({ pack: 'hello' });
  assert.equal(JSON.parse(ctx.doPost(H.postEvent('upload', {}, { req: 'x' })).content).reason, 'not_set_up');
});

// Developed by: LightAISolutions

'use strict';
// tools/upload.mjs — routines POST a made file to ?route=upload; the tool refuses what the core would refuse, never sends the key elsewhere.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const H = require('./harness/gas-mocks');
const TOOL = path.join(H.HELPERS_ROOT, 'tools', 'upload.mjs');
const REQ = '0f1e2d3c-4b5a-4968-8776-655443322110';
const KEY = 'a'.repeat(64);

function tmpFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upl-'));
  const f = path.join(dir, name);
  fs.writeFileSync(f, content);
  return f;
}

test('uploadUrl swaps the wake route for the upload route; uploadBody builds what the core route accepts', async () => {
  const { uploadUrl, uploadBody } = await import('../tools/upload.mjs');
  assert.equal(uploadUrl('https://script.google.com/macros/s/FIXTURE/exec?route=wake'), 'https://script.google.com/macros/s/FIXTURE/exec?route=upload');
  assert.throws(() => uploadUrl('http://script.google.com/x?route=wake'), /https/);
  const f = tmpFile('sheet.pdf', '%PDF-1.7 x');
  const r = uploadBody({ req: 'req_' + REQ, key: KEY, file: f, folder: 'trips/harbor-town' });
  assert.deepEqual(Object.keys(r.body).sort(), ['data', 'folder', 'key', 'mime', 'name', 'req']);
  assert.equal(r.body.req, REQ);
  assert.equal(r.body.mime, 'application/pdf');
  assert.equal(Buffer.from(r.body.data, 'base64').toString(), '%PDF-1.7 x');
  assert.throws(() => uploadBody({ req: REQ, key: KEY, file: tmpFile('a.zip', 'x') }), /only \.pdf, \.html and \.json/);
  assert.equal(uploadBody({ req: REQ, key: KEY, file: tmpFile('plan-b1.json', '{}') }).body.mime, 'application/json');
  assert.throws(() => uploadBody({ req: REQ, key: KEY, file: f, folder: 'Trips/X' }), /folder/);
  assert.throws(() => uploadBody({ req: REQ, key: 'short', file: f }), /upload_key/);
  assert.throws(() => uploadBody({ req: 'nope', key: KEY, file: f }), /request id/);
  assert.throws(() => uploadBody({ req: REQ, key: KEY, file: tmpFile('e.pdf', '') }), /empty/);
});

test('the body the tool builds is accepted by the core route end to end (mock Drive)', async () => {
  const { uploadBody } = await import('../tools/upload.mjs');
  const { ctx, state } = H.loadGas({ pack: 'hello' });
  H.bootstrap(ctx, state);
  H.configureRoutine(ctx, state);
  const open = ctx.openRequest({ kind: 'ask', text: 'x', chat: { chat_id: 777, message_id: 1 } });
  const key = JSON.parse(state.drive.readFile('Hello/mailbox/to-brain', `req_${open.id}.json`)).payload.upload_key;
  const { body } = uploadBody({ req: open.id, key, file: tmpFile('page.html', '<p>hi</p>'), folder: 'trips/demo' });
  const r = JSON.parse(ctx.doPost(H.postEvent('upload', {}, body)).content);
  assert.equal(r.ok, true);
  assert.equal(state.drive.readFile('Hello/trips/demo', 'page.html'), '<p>hi</p>');
});

test('CLI: --dry-run prints the target and size without the key; a bad argument exits 1 with a reason', () => {
  const f = tmpFile('s.pdf', '%PDF');
  const ok = spawnSync(process.execPath, [TOOL, '--wake-url', 'https://script.google.com/macros/s/FIXTURE/exec?route=wake', '--req', REQ, '--key', KEY, '--file', f, '--dry-run'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const out = JSON.parse(ok.stdout);
  assert.deepEqual(out, { ok: true, dry_run: true, url: 'https://script.google.com/macros/s/FIXTURE/exec?route=upload', name: 's.pdf', bytes: 4 });
  assert.ok(!ok.stdout.includes(KEY));
  const bad = spawnSync(process.execPath, [TOOL, '--req', REQ], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(JSON.parse(bad.stdout).reason, /missing --wake-url/);
});

// Developed by: LightAISolutions

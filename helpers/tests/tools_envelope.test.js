'use strict';
// tools/envelope.mjs — routines stamp envelopes with a real id + clock; types come from the core and the pack manifest.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const H = require('./harness/gas-mocks');
const TOOL = path.join(H.HELPERS_ROOT, 'tools', 'envelope.mjs');

test('output passes core validateEnvelope and uses the canonical file name; the type list is read from 00_config.js', async () => {
  const { makeEnvelope, TYPES, typesFor } = await import('../tools/envelope.mjs');
  const { ctx } = H.loadGas();
  assert.deepEqual([...TYPES], [...ctx.ENVELOPE_TYPES]);
  assert.deepEqual(typesFor('hello'), [...TYPES, 'greeting']);
  assert.deepEqual(typesFor('tour-guide'), [...TYPES, 'prefs_review', 'shortlist', 'trip_facts', 'plan_digest', 'profile_summary', 'places_digest', 'bookings', 'scout']);
  assert.throws(() => typesFor('nope'), /unknown pack/);
  const now = new Date('2026-09-29T17:03:07.123Z');
  ctx.__TEST_NOW = now.getTime();
  const r = makeEnvelope({ type: 'notice', producer: 'brief-morning', payload: { title: 'Morning', text: 'Nothing new.' }, dedupeKey: 'brief:x', now });
  assert.deepEqual(r.errors, []);
  assert.match(r.file_name, /^20260929T170307_notice_[0-9a-f-]{36}\.json$/);
  assert.equal(r.envelope.created_at, '2026-09-29T17:03:07Z');
  const raw = JSON.stringify(r.envelope);
  assert.ok(ctx.validateEnvelope(raw, raw.length).ok);
  const hello = H.loadGas({ pack: 'hello' });
  hello.ctx.__TEST_NOW = now.getTime();
  const g = makeEnvelope({ type: 'greeting', producer: 'hello-skill', payload: { name: 'Ada' }, now, types: typesFor('hello') });
  assert.deepEqual(g.errors, []);
  assert.ok(hello.ctx.validateEnvelope(JSON.stringify(g.envelope), 100).ok);
  assert.match(makeEnvelope({ type: 'greeting', producer: 'hello-skill', payload: { name: 'Ada' } }).errors.join(), /unknown type: greeting .*--pack NAME/);
});

test('ids are random per call; reply needs in_reply_to; bad producer / oversize / non-object payload are reported', async () => {
  const { makeEnvelope } = await import('../tools/envelope.mjs');
  const a = makeEnvelope({ type: 'notice', producer: 'x', payload: { text: 'x' } });
  const b = makeEnvelope({ type: 'notice', producer: 'x', payload: { text: 'x' } });
  assert.notEqual(a.envelope.id, b.envelope.id);
  assert.match(makeEnvelope({ type: 'reply', producer: 'x', payload: { text: 'x' } }).errors.join(), /reply needs --in-reply-to/);
  assert.deepEqual(makeEnvelope({ type: 'reply', producer: 'x', payload: { text: 'x' }, inReplyTo: 'req-1' }).errors, []);
  assert.match(makeEnvelope({ type: 'notice', producer: 'Bad Producer', payload: {} }).errors.join(), /producer/);
  assert.match(makeEnvelope({ type: 'notice', producer: 'x', payload: { text: 'y'.repeat(16001) } }).errors.join(), /exceeds 16000/);
  assert.match(makeEnvelope({ type: 'notice', producer: 'x', payload: [] }).errors.join(), /JSON object/);
  assert.match(makeEnvelope({ type: 'notice', producer: 'x', payload: {}, dedupeKey: 'k'.repeat(121) }).errors.join(), /dedupe_key/);
});

test('reply payloads get the core checks (text, html, drive_file_ids); --now stamps created_at and the file name', async () => {
  const { makeEnvelope } = await import('../tools/envelope.mjs');
  const mk = (payload) => makeEnvelope({ type: 'reply', producer: 'x', payload, inReplyTo: 'req-1' }).errors.join('\n');
  assert.equal(mk({ text: 'Brochure ready.', html: true, drive_file_ids: { brochure_pdf: 'fileAbcdefgh01', 'Day 2 (plan).pdf': 'file_Abcdefgh02' } }), '');
  assert.match(mk({ text: 'x'.repeat(4001) }), /reply\.text must be a non-empty string of at most 4000/);
  assert.match(mk({ text: '  ' }), /reply\.text must be a non-empty/);
  assert.match(mk({ drive_file_ids: { plan: 'fileAbcdefgh01' } }), /reply\.text must be a non-empty/);
  assert.match(mk({ text: 'ok', html: 'yes' }), /reply\.html must be true or false/);
  assert.match(mk({ text: 'ok', drive_file_ids: ['fileAbcdefgh01'] }), /drive_file_ids must be an object/);
  assert.match(mk({ text: 'ok', drive_file_ids: { 'bad<label>': 'fileAbcdefgh01' } }), /label "bad<label>" must match/);
  assert.match(mk({ text: 'ok', drive_file_ids: { plan: 'short' } }), /drive_file_ids\["plan"\] must be a Drive file id/);
  assert.match(mk({ text: 'ok', drive_file_ids: { plan: 42 } }), /drive_file_ids\["plan"\] must be a Drive file id/);
  const many = Object.fromEntries(Array.from({ length: 11 }, (_, i) => ['f' + i, 'fileAbcdefgh' + String(i).padStart(2, '0')]));
  assert.match(mk({ text: 'ok', drive_file_ids: many }), /at most 10 files/);
  assert.equal(makeEnvelope({ type: 'notice', producer: 'x', payload: { text: 'x'.repeat(4001) } }).errors.length, 0, 'the 4000 limit is a reply rule');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-env-'));
  const payload = path.join(dir, 'payload.json');
  fs.writeFileSync(payload, JSON.stringify({ text: 'hi' }));
  const ok = spawnSync(process.execPath, [TOOL, 'notice', 'x', payload, '--now', '2027-05-01T16:00:00Z'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  const r = JSON.parse(ok.stdout);
  assert.equal(JSON.parse(r.content).created_at, '2027-05-01T16:00:00Z');
  assert.match(r.file_name, /^20270501T160000_notice_[0-9a-f-]{36}\.json$/);
  const bad = spawnSync(process.execPath, [TOOL, 'notice', 'x', payload, '--now', 'yesterday'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--now must be an ISO date-time/);
});

test('CLI: --pack adds the pack types, --out writes the file, errors exit 1 and write nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-env-'));
  const payload = path.join(dir, 'payload.json');
  fs.writeFileSync(payload, JSON.stringify({ name: 'Ada' }));
  const bad = spawnSync(process.execPath, [TOOL, 'greeting', 'hello-skill', payload, '--out', dir], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(JSON.parse(bad.stdout).errors.join(), /unknown type/);
  assert.deepEqual(fs.readdirSync(dir), ['payload.json'], 'nothing written on error');
  const ok = spawnSync(process.execPath, [TOOL, 'greeting', 'hello-skill', payload, '--pack', 'hello', '--out', dir], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  const r = JSON.parse(ok.stdout);
  assert.deepEqual(r.errors, []);
  assert.ok(fs.existsSync(path.join(dir, r.file_name)));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, r.file_name), 'utf8')).producer, 'hello-skill');
  assert.equal(spawnSync(process.execPath, [TOOL], { encoding: 'utf8' }).status, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--pack NAME validates a pack type\'s payload when the pack ships schemas/index.mjs validatePayload', async () => {
  const { packPayloadErrors } = await import('../tools/envelope.mjs');
  assert.deepEqual(await packPayloadErrors('tour-guide', 'profile_summary', { text: 'Relaxed pace.', dimensions_count: 3, updated: '2027-04-28T08:15:00Z' }), []);
  assert.deepEqual(await packPayloadErrors('tour-guide', 'profile_summary', { dimensions_count: 3 }), ['payload: missing required "text"']);
  assert.deepEqual(await packPayloadErrors('tour-guide', 'profile_summary', 'not an object'), [], 'non-objects are reported by makeEnvelope');
  assert.deepEqual(await packPayloadErrors('hello', 'greeting', {}), []);
  await assert.rejects(packPayloadErrors('nope', 'x', {}), /unknown pack/);
});

// Developed by: LightAISolutions

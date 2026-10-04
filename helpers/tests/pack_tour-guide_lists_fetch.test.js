'use strict';
// Tour Guide — the Takeout fetch, client half (TG-PHASE-14 WP-14f): packs/tour-guide/lists/lists-fetch.mjs lists the
// owner's exports through the core's ?route=takeout and writes the newest one's parts to a directory. A fake `run`
// stands in for the network; the CLI is run against a fake `curl` placed first on PATH. Invented data only; no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const H = require('./harness/gas-mocks');

const LF = () => import('../packs/tour-guide/lists/lists-fetch.mjs');
const CLI = path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'lists', 'lists-fetch.mjs');
const WAKE = 'https://script.example.invalid/macros/s/FixtureDeployment/exec?route=wake';
const REQ = '0b5e2c4a-7d1f-4e8a-9c3b-1a2b3c4d5e6f';
const KEY = 'a1'.repeat(32);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wp14f-'));
const part = (seed, n) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 13 + seed) % 256));
const P1 = part(3, 900), P2 = part(7, 300), OLD = part(11, 50);
const EXPORTS = [
  { stamp: '20270420T101500Z', created: '2027-04-20T10:30:00.000Z', bytes: 1200, too_large: false,
    parts: [{ name: 'takeout-20270420T101500Z-001.tgz', bytes: 900 }, { name: 'takeout-20270420T101500Z-002.tgz', bytes: 300 }] },
  { stamp: '20270301T080000Z', created: '2027-03-01T08:20:00.000Z', bytes: 50, too_large: false, parts: [{ name: 'takeout-20270301T080000Z-001.zip', bytes: 50 }] }
];
const DATA = { 'takeout-20270420T101500Z-001.tgz': P1, 'takeout-20270420T101500Z-002.tgz': P2, 'takeout-20270301T080000Z-001.zip': OLD };
const getAnswer = (name) => ({ ok: true, name, bytes: DATA[name].length, created: '2027-04-20T10:30:00.000Z', data: DATA[name].toString('base64') });
/** A fake core: answers list and get as ?route=takeout would; `over` replaces an answer by op or by part name. */
function fakeRun(over = {}) {
  const calls = [];
  const run = async (url, body) => {
    calls.push({ url, body: { ...body } });
    if (body.op === 'list') return 'list' in over ? over.list : { ok: true, exports: EXPORTS };
    return body.name in over ? over[body.name] : getAnswer(body.name);
  };
  return { run, calls };
}

test('takeoutUrl: the wake url with route=takeout; https only', async () => {
  const { takeoutUrl } = await LF();
  assert.equal(takeoutUrl(WAKE), 'https://script.example.invalid/macros/s/FixtureDeployment/exec?route=takeout');
  assert.equal(takeoutUrl('https://script.example.invalid/x/exec?route=wake&k=1'), 'https://script.example.invalid/x/exec?route=takeout');
  assert.throws(() => takeoutUrl('http://script.example.invalid/x/exec?route=wake'), /https/);
  assert.throws(() => takeoutUrl(''), /./);
});

test('the client\'s name pattern is the core\'s (TG_LISTS.TAKEOUT_RE)', async () => {
  const { TAKEOUT_RE } = await LF();
  const { ctx } = H.loadGas({ pack: 'tour-guide', manifest: JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'helper.json'), 'utf8')) });
  assert.equal(TAKEOUT_RE.source, ctx.TG_LISTS.TAKEOUT_RE.source);
  assert.equal(TAKEOUT_RE.flags, ctx.TG_LISTS.TAKEOUT_RE.flags);
});

test('fetchTakeout: lists, then gets each part of the newest export into out under its own name, byte for byte', async () => {
  const { fetchTakeout } = await LF();
  const out = path.join(tmp(), 'parts');   // created when missing
  const { run, calls } = fakeRun();
  const r = await fetchTakeout({ wakeUrl: WAKE, req: 'req_' + REQ, key: KEY, out, run });
  assert.deepEqual(r, { ok: true, stamp: '20270420T101500Z', created: '2027-04-20T10:30:00.000Z',
    files: [path.join(out, 'takeout-20270420T101500Z-001.tgz'), path.join(out, 'takeout-20270420T101500Z-002.tgz')], bytes: 1200 });
  assert.ok(fs.readFileSync(r.files[0]).equals(P1));
  assert.ok(fs.readFileSync(r.files[1]).equals(P2));
  assert.deepEqual(fs.readdirSync(out).sort(), ['takeout-20270420T101500Z-001.tgz', 'takeout-20270420T101500Z-002.tgz']);
  assert.deepEqual(calls.map((c) => c.body), [
    { req: REQ, key: KEY, op: 'list' },
    { req: REQ, key: KEY, op: 'get', name: 'takeout-20270420T101500Z-001.tgz' },
    { req: REQ, key: KEY, op: 'get', name: 'takeout-20270420T101500Z-002.tgz' }]);
  assert.ok(calls.every((c) => c.url === 'https://script.example.invalid/macros/s/FixtureDeployment/exec?route=takeout'));
  // Newer than an older stamp: fetched.
  const again = await fetchTakeout({ wakeUrl: WAKE, req: REQ, key: KEY, out: tmp(), newerThan: '20270301T080000Z', run: fakeRun().run });
  assert.equal(again.ok, true);
  assert.equal(again.stamp, '20270420T101500Z');
});

test('fetchTakeout: nothing newer, no export at all, an export too large — nothing fetched', async () => {
  const { fetchTakeout } = await LF();
  let f = fakeRun();
  const out = path.join(tmp(), 'parts');
  assert.deepEqual(await fetchTakeout({ wakeUrl: WAKE, req: REQ, key: KEY, out, newerThan: '20270420T101500Z', run: f.run }),
    { ok: true, none: true, reason: 'not_newer', newest: '20270420T101500Z' });
  assert.deepEqual(await fetchTakeout({ wakeUrl: WAKE, req: REQ, key: KEY, out, newerThan: '20270501T000000Z', run: f.run }),
    { ok: true, none: true, reason: 'not_newer', newest: '20270420T101500Z' });
  assert.equal(f.calls.filter((c) => c.body.op === 'get').length, 0);
  assert.equal(fs.existsSync(out), false, 'no directory made for nothing');
  f = fakeRun({ list: { ok: true, exports: [] } });
  assert.deepEqual(await fetchTakeout({ wakeUrl: WAKE, req: REQ, key: KEY, out, run: f.run }), { ok: true, none: true, reason: 'no_export' });
  f = fakeRun({ list: { ok: true, exports: [{ ...EXPORTS[0], too_large: true }] } });
  assert.deepEqual(await fetchTakeout({ wakeUrl: WAKE, req: REQ, key: KEY, out, run: f.run }), { ok: false, reason: 'too_large', newest: '20270420T101500Z' });
  assert.equal(f.calls.length, 1);
});

test('fetchTakeout: the core\'s refusal, an old core (not_deployed), an unparsable answer, a network failure', async () => {
  const { fetchTakeout } = await LF();
  const out = tmp();
  const go = (over) => fetchTakeout({ wakeUrl: WAKE, req: REQ, key: KEY, out, run: fakeRun(over).run });
  assert.deepEqual(await go({ list: { ok: false, status: 403, reason: 'wrong_kind' } }), { ok: false, reason: 'wrong_kind' });
  assert.deepEqual(await go({ list: { ok: false, status: 404, reason: 'not_found' } }), { ok: false, reason: 'not_deployed' });
  assert.deepEqual(await go({ list: { ok: false, status: 404, reason: 'unknown_request' } }), { ok: false, reason: 'unknown_request' });
  for (const bad of [null, 'garbage', 7, { ok: true }, { ok: true, exports: 'x' }, { ok: true, exports: [{ stamp: 'yesterday', parts: [] }] },
    { ok: true, exports: [{ ...EXPORTS[0], parts: [{ name: '../takeout-20270420T101500Z-001.tgz', bytes: 900 }] }] },
    { ok: true, exports: [{ ...EXPORTS[0], parts: [{ name: 'sub/takeout-20270420T101500Z-001.tgz', bytes: 900 }] }] },
    { ok: true, exports: [{ ...EXPORTS[0], parts: [{ name: 'notes.txt', bytes: 900 }] }] }]) {
    assert.deepEqual(await go({ list: bad }), { ok: false, reason: 'bad_answer' }, JSON.stringify(bad));
  }
  assert.deepEqual(fs.readdirSync(out), [], 'nothing written');
  const boom = await fetchTakeout({ wakeUrl: WAKE, req: REQ, key: KEY, out, run: async () => { throw new Error('curl failed (exit 6)'); } });
  assert.deepEqual(boom, { ok: false, reason: 'network' });
  await assert.rejects(fetchTakeout({ wakeUrl: 'http://x.example.invalid/', req: REQ, key: KEY, out, run: fakeRun().run }), /https/);
  await assert.rejects(fetchTakeout({ wakeUrl: WAKE, req: 'nope', key: KEY, out, run: fakeRun().run }), /request id/);
  await assert.rejects(fetchTakeout({ wakeUrl: WAKE, req: REQ, key: 'short', out, run: fakeRun().run }), /key/);
});

test('fetchTakeout: a failure part-way removes the parts this call wrote (size mismatch, a refused get, a bad get answer)', async () => {
  const { fetchTakeout } = await LF();
  const second = 'takeout-20270420T101500Z-002.tgz';
  const cases = [
    [{ [second]: { ...getAnswer(second), data: part(7, 299).toString('base64') } }, { ok: false, reason: 'size_mismatch' }],
    [{ [second]: { ...getAnswer(second), bytes: 301 } }, { ok: false, reason: 'size_mismatch' }],
    [{ [second]: { ok: false, status: 429, reason: 'too_many_gets' } }, { ok: false, reason: 'too_many_gets' }],
    [{ [second]: { ok: true, name: second } }, { ok: false, reason: 'bad_answer' }],
    [{ [second]: 'not json' }, { ok: false, reason: 'bad_answer' }]
  ];
  for (const [over, want] of cases) {
    const out = tmp();
    fs.writeFileSync(path.join(out, 'keep-me.txt'), 'not ours');
    assert.deepEqual(await fetchTakeout({ wakeUrl: WAKE, req: REQ, key: KEY, out, run: fakeRun(over).run }), want, JSON.stringify(want));
    assert.deepEqual(fs.readdirSync(out), ['keep-me.txt'], 'the first part is removed; nothing else is touched');
  }
});

/* ---------------- the CLI against a fake curl ---------------- */
const FAKE_CURL = `#!/usr/bin/env node
const fs = require('fs');
const a = process.argv.slice(2), at = (f) => a[a.indexOf(f) + 1];
const canned = JSON.parse(fs.readFileSync(process.env.FAKE_TAKEOUT, 'utf8'));
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(a) + '\\n');
if (canned.fail) { process.stderr.write('curl: (6) Could not resolve host\\n'); process.exit(6); }
const body = JSON.parse(fs.readFileSync(at('--data-binary').slice(1), 'utf8'));
let ans;
if (body.key !== canned.key || body.req !== canned.req) ans = { ok: false, status: 403, reason: 'bad_key' };
else if (body.op === 'list') ans = canned.list;
else ans = canned.get[body.name] || { ok: false, status: 404, reason: 'unknown_file' };
fs.writeFileSync(at('-o'), typeof ans === 'string' ? ans : JSON.stringify(ans));
`;
function cliSetup(canned) {
  const dir = tmp(), bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'curl'), FAKE_CURL, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'canned.json'), JSON.stringify({ req: REQ, key: KEY, list: { ok: true, exports: EXPORTS },
    get: Object.fromEntries(Object.keys(DATA).map((n) => [n, getAnswer(n)])), ...canned }));
  fs.writeFileSync(path.join(dir, 'req.json'), JSON.stringify({ v: 1, id: REQ, type: 'request', payload: { kind: 'lists', text: '/lists sync', upload_key: KEY } }));
  const cli = (args) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8',
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, FAKE_TAKEOUT: path.join(dir, 'canned.json'), FAKE_LOG: path.join(dir, 'log.txt') } });
    assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY), 'the key is never printed');
    const lines = r.stdout.split('\n').filter(Boolean);
    assert.equal(lines.length, 1, 'exactly one JSON line: ' + r.stdout + r.stderr);
    return { code: r.status, out: JSON.parse(lines[0]), stderr: r.stderr };
  };
  const log = () => (fs.existsSync(path.join(dir, 'log.txt')) ? fs.readFileSync(path.join(dir, 'log.txt'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { dir, cli, log, req: path.join(dir, 'req.json') };
}

test('CLI: fetched → exit 0; --list → exit 0; nothing newer or no export → exit 2; the curl flags; the key only in the body file', () => {
  const s = cliSetup();
  const out = path.join(s.dir, 'out');
  let r = s.cli(['--wake-url', WAKE, '--key-from', s.req, '--out', out]);
  assert.equal(r.code, 0);
  assert.equal(r.out.ok, true);
  assert.equal(r.out.stamp, '20270420T101500Z');
  assert.ok(fs.readFileSync(path.join(out, 'takeout-20270420T101500Z-001.tgz')).equals(P1));
  assert.ok(fs.readFileSync(path.join(out, 'takeout-20270420T101500Z-002.tgz')).equals(P2));
  const calls = s.log();
  assert.equal(calls.length, 3);
  for (const a of calls) {
    assert.ok(a.includes('-sSL') && a.includes('--max-time') && a[a.indexOf('--max-time') + 1] === '300', 'follows the redirect, bounded');
    assert.equal(a[a.indexOf('-H') + 1], 'Content-Type: text/plain');
    assert.equal(a[a.length - 1], 'https://script.example.invalid/macros/s/FixtureDeployment/exec?route=takeout');
    assert.ok(!a.join(' ').includes(KEY), 'the key is never on the command line');
    assert.equal(fs.existsSync(a[a.indexOf('--data-binary') + 1].slice(1)), false, 'the body file is deleted');
    assert.equal(fs.existsSync(a[a.indexOf('-o') + 1]), false, 'the answer file is deleted');
  }
  r = s.cli(['--wake-url', WAKE, '--key-from', s.req, '--list']);
  assert.equal(r.code, 0);
  assert.deepEqual(r.out, { ok: true, exports: EXPORTS });
  r = s.cli(['--wake-url', WAKE, '--key-from', s.req, '--out', out, '--newer-than', '20270420T101500Z']);
  assert.equal(r.code, 2);
  assert.deepEqual(r.out, { ok: true, none: true, reason: 'not_newer', newest: '20270420T101500Z' });
  const e = cliSetup({ list: { ok: true, exports: [] } });
  r = e.cli(['--wake-url', WAKE, '--key-from', e.req, '--out', path.join(e.dir, 'out')]);
  assert.equal(r.code, 2);
  assert.equal(r.out.reason, 'no_export');
});

test('CLI: refusals, a curl failure and bad arguments → exit 1 with one JSON line; the key never shows', () => {
  let s = cliSetup({ list: { ok: false, status: 403, reason: 'request_closed' } });
  let r = s.cli(['--wake-url', WAKE, '--key-from', s.req, '--out', path.join(s.dir, 'out')]);
  assert.deepEqual([r.code, r.out], [1, { ok: false, reason: 'request_closed' }]);
  s = cliSetup({ key: 'b2'.repeat(32) });   // the core knows another key
  r = s.cli(['--wake-url', WAKE, '--key-from', s.req, '--list']);
  assert.deepEqual([r.code, r.out], [1, { ok: false, reason: 'bad_key' }]);
  s = cliSetup({ list: { ok: false, status: 404, reason: 'not_found' } });
  r = s.cli(['--wake-url', WAKE, '--key-from', s.req, '--out', path.join(s.dir, 'out')]);
  assert.deepEqual([r.code, r.out], [1, { ok: false, reason: 'not_deployed' }]);
  s = cliSetup({ list: '<html>Sign in</html>' });
  r = s.cli(['--wake-url', WAKE, '--key-from', s.req, '--list']);
  assert.deepEqual([r.code, r.out], [1, { ok: false, reason: 'bad_answer' }]);
  s = cliSetup({ fail: true });
  r = s.cli(['--wake-url', WAKE, '--key-from', s.req, '--out', path.join(s.dir, 'out')]);
  assert.deepEqual([r.code, r.out], [1, { ok: false, reason: 'network' }]);
  for (const args of [[], ['--wake-url', WAKE, '--out', 'x'], ['--wake-url', WAKE, '--key-from', s.req], ['--key-from', s.req, '--out', 'x'],
    ['--wake-url', 'http://x.example.invalid/', '--key-from', s.req, '--out', 'x'], ['--wake-url', WAKE, '--key-from', s.req, '--out', 'x', '--bogus'],
    ['--wake-url', WAKE, '--key-from', path.join(s.dir, 'missing.json'), '--out', 'x'],
    ['--wake-url', WAKE, '--key-from', s.req, '--out', 'x', '--key', KEY]]) {   // a key typed by mistake is never echoed (cli() asserts it)
    r = s.cli(args);
    assert.equal(r.code, 1, args.join(' '));
    assert.equal(r.out.ok, false);
  }
});

// Developed by: LightAISolutions

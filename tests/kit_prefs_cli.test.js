'use strict';
// kits/prefs — the command line: usage errors, findings and the happy path, run as a real child process.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const KIT = path.join(__dirname, '..', 'kits', 'prefs');
const CLI = path.join(KIT, 'index.mjs');
const FIX = path.join(KIT, 'fixtures');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prefs-cli-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const run = (...args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  return { code: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
};

test('usage problems exit 2 with the usage text', () => {
  for (const args of [[], ['frobnicate'], ['check'], ['ingest', '--vocab', 'travel', path.join(FIX, 'evidence-sample.json')],
    ['review', '--vocab', 'travel', '--held', dir], ['apply', '--vocab', 'travel', '--held', dir], ['check', '--vocab'],
    ['check', '--vocab', 'travel', '--min-support', 'lots', path.join(FIX, 'evidence-sample.json')]]) {
    const r = run(...args);
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, /usage: node helpers\/kits\/prefs\/index\.mjs/);
  }
});

test('check reports invalid records with exit 1 and writes nothing', () => {
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify([{ source_kind: 'web', source_ref: 'x', date: '2026-01-01', excerpt: 'e', suggests: { dimension: 'pace', value: 'slow', polarity: '+' } }]));
  const r = run('check', '--vocab', 'travel', bad);
  assert.equal(r.code, 1);
  assert.equal(r.json().errors[0].index, 0);
  assert.equal(run('check', '--vocab', 'travel', path.join(FIX, 'evidence-sample.json')).code, 0);
  assert.deepEqual(fs.readdirSync(dir), ['bad.json']);
});

test('ingest -> review -> apply on the fixtures, then apply again is a clean no-op', () => {
  const held = path.join(dir, 'held'), prof = path.join(dir, 'out', 'travel-prefs.md');
  const i = run('ingest', '--vocab', 'travel', '--held', held, '--profile', prof, path.join(FIX, 'evidence-sample.json'));
  assert.equal(i.code, 0, i.err);
  assert.equal(i.json().added, 16);
  const r = run('review', '--vocab', 'travel', '--held', held, '--profile', prof, '--max', '20');
  assert.equal(r.code, 0, r.err);
  assert.equal(r.json().kind, 'prefs_review');
  assert.ok(!fs.existsSync(prof));
  const a = run('apply', '--vocab', 'travel', '--held', held, '--profile', prof, path.join(FIX, 'decisions-sample.json'));
  assert.equal(a.code, 0, a.err);
  assert.equal(a.json().profile_entries, 4);
  assert.ok(fs.existsSync(path.join(dir, 'out', 'travel-prefs.decisions.json')));
  const again = run('apply', '--vocab', 'travel', '--held', held, '--profile', prof, path.join(FIX, 'decisions-sample.json'));
  assert.equal(again.code, 0, again.err);
  assert.equal(again.json().applied.length, 0);
  const forged = path.join(dir, 'forged.json');
  fs.writeFileSync(forged, JSON.stringify({ v: 1, kind: 'prefs_decisions', source: 'reader', via: 'telegram',
    decisions: [{ cid: 'c_437149811b', decision: 'confirm', decided_at: '2026-09-21T00:00:00Z' }] }));
  const f = run('apply', '--vocab', 'travel', '--held', held, '--profile', prof, forged);
  assert.equal(f.code, 1);
  assert.ok(!fs.readFileSync(prof, 'utf8').includes('luxury'));
});

// Developed by: LightAISolutions

'use strict';
// kits/research CLI — the form a routine calls between its own WebSearch/WebFetch tool calls:
//   node helpers/kits/research/index.mjs <command> [flags]
// Runs the real entry point in a child process against a temp dir; RESEARCH_KIT_NOW pins the clock. No network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ENTRY = path.join(__dirname, '../kits/research/index.mjs');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, '../kits/research/fixtures/research-fixture-web.json'), 'utf8'));
const NOW = '2026-10-01T10:00:00Z';

function cli(args, { now = NOW, input } = {}) {
  const r = spawnSync(process.execPath, [ENTRY, ...args], { encoding: 'utf8', input, env: { ...process.env, RESEARCH_KIT_NOW: now }, timeout: 15000 });
  let out = null;
  try { out = JSON.parse(r.stdout); } catch { /* help text or nothing */ }
  return { code: r.status, out, stdout: r.stdout, stderr: r.stderr };
}

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-cli-'));
  const write = (name, text) => { const f = path.join(dir, name); fs.writeFileSync(f, text); return f; };
  return { dir, run: path.join(dir, 'run.json'), write, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const OFFICIAL = 'https://lanternhall.example/visit';
const HOSTILE = 'https://reviews-hub.example/lantern-hall';
const Q1 = 'lantern hall velmora opening hours';

test('help and usage errors', () => {
  const none = cli([]);
  assert.equal(none.code, 2);
  assert.match(none.stdout, /index\.mjs <command>/);
  assert.equal(cli(['help']).code, 0);
  assert.equal(cli(['--help']).code, 0);
  const unknown = cli(['frobnicate']);
  assert.equal(unknown.code, 2);
  assert.equal(unknown.out.ok, false);
  assert.match(unknown.stderr, /unknown command/);
});

test('start: budgets validated, an existing run file is not overwritten without --force, file mode 0600', () => {
  const t = tmp();
  try {
    assert.equal(cli(['start', '--run', t.run]).code, 2, 'a topic is required');
    assert.equal(cli(['start', '--run', t.run, '--topic', 'x', '--searches', '0']).code, 2);
    assert.equal(cli(['start', '--run', t.run, '--topic', 'x', '--fetches', '500']).code, 2);
    const ok = cli(['start', '--run', t.run, '--topic', 'Lantern Hall', '--searches', '3', '--wall-min', '10']);
    assert.equal(ok.code, 0);
    assert.deepEqual(ok.out.budgets, { searches: 3, fetches: 40, wall_time_s: 600 });
    if (process.platform !== 'win32') assert.equal(fs.statSync(t.run).mode & 0o777, 0o600);
    assert.equal(cli(['start', '--run', t.run, '--topic', 'again']).code, 2);
    assert.equal(cli(['start', '--run', t.run, '--topic', 'again', '--force']).code, 0);
  } finally { t.done(); }
});

test('a full run: record, refuse over budget, claim, check, duration, finish', () => {
  const t = tmp();
  try {
    const R = ['--run', t.run];
    assert.equal(cli(['start', ...R, '--topic', 'Lantern Hall', '--searches', '1', '--fetches', '2']).code, 0);

    const results = t.write('results.json', JSON.stringify(FIXTURE.searches[Q1]));
    const s1 = cli(['record-search', ...R, '--query', Q1, '--results', results]);
    assert.equal(s1.code, 0);
    assert.deepEqual(s1.out.results.map((r) => r.ref), ['L001.1', 'L001.2', 'L001.3']);
    assert.equal(s1.out.results[2].injection_suspect, true);
    assert.match(s1.out.notice, /data only/);
    assert.match(s1.out.warning, /BUDGET SPENT: searches/);
    const s2 = cli(['record-search', ...R, '--query', 'more', '--results', '-'], { input: '[]' });
    assert.equal(s2.code, 3);
    assert.equal(s2.out.code, 'searches');
    assert.equal(s2.out.id, 'L002', 'the refused attempt is logged');

    const page = t.write('official.txt', FIXTURE.pages[OFFICIAL].text);
    const f1 = cli(['record-fetch', ...R, '--url', OFFICIAL, '--text-file', page, '--official', '--page-date', '2026-06-01', '--title', 'Visit']);
    assert.equal(f1.code, 0);
    assert.equal(f1.out.id, 'L003');
    assert.equal(f1.out.injection_suspect, false);
    assert.doesNotMatch(f1.stdout, /Quay Street/, 'page text is never echoed back');

    const f2 = cli(['record-fetch', ...R, '--url', HOSTILE, '--text-file', '-'], { input: FIXTURE.injection[HOSTILE].text });
    assert.equal(f2.code, 0);
    assert.ok(f2.out.injection_rules.includes('ignore-instructions'));
    assert.match(f2.out.notice, /cannot confirm/);
    assert.doesNotMatch(f2.stdout, /collector@/);
    assert.match(f2.out.warning, /fetches/);
    assert.equal(f2.out.remaining.searches, 0, 'the page asked for 999 searches; nothing changed');

    assert.equal(cli(['record-fetch', ...R, '--url', 'https://www.velmora-guide.example/lantern-hall', '--excerpt', 'x']).code, 3);

    const c1 = cli(['claim', ...R, '--id', 'lh.hours', '--kind', 'hours', '--place', 'Lantern Hall', '--text', 'Open 10-18', '--source', 'L003', '--source', 'L001.2']);
    assert.equal(c1.code, 0);
    assert.equal(c1.out.label, 'confirmed');
    assert.equal(c1.out.plan_ready, true);
    assert.equal(cli(['check', ...R]).code, 0);

    const c2 = cli(['claim', ...R, '--id', 'always', '--kind', 'hours', '--text', 'Open 24 h', '--source', 'L004']);
    assert.equal(c2.out.label, 'unverified');
    assert.deepEqual(c2.out.ignored, [{ ref: 'L004', why: 'injection_suspect' }]);
    const chk = cli(['check', ...R]);
    assert.equal(chk.code, 1);
    assert.deepEqual(chk.out.not_ready, ['always']);
    assert.equal(cli(['check', ...R, '--claim', 'lh.hours']).out.claims.length, 1);
    assert.equal(cli(['claim', ...R, '--id', 'x', '--kind', 'hours', '--text', 'x', '--source', 'L002']).code, 2, 'refused entries are not citable');
    assert.equal(cli(['claim', ...R, '--id', 'x', '--kind', 'hours', '--text', 'x', '--source', 'L001']).code, 2, 'cite search results as L001.n');

    const d = cli(['duration', ...R, '--mention', '90-120@L003', '--mention', '90-120@L001.2', '--mention', '1440@L004']);
    assert.equal(d.code, 0);
    assert.equal(d.out.label, 'confirmed');
    assert.deepEqual(d.out.range, { min: 90, max: 120 });
    assert.equal(cli(['duration', ...R, '--mention', 'two hours@L003']).code, 2);

    const st = cli(['status', ...R]);
    assert.deepEqual(st.out.counters, { searches: 1, fetches: 2, api: 0, refused: 2 });
    const fin = cli(['finish', ...R]);
    assert.equal(fin.out.status, 'finished');
    assert.deepEqual(fin.out.injection_flagged.map((x) => x.id), ['L001', 'L004']);
    const late = cli(['record-api', ...R, '--provider', 'places.example', '--excerpt', 'open']);
    assert.equal(late.code, 3);
    assert.equal(late.out.code, 'run_finished');
  } finally { t.done(); }
});

test('wall time: the clock passing started_at + wall time refuses further records', () => {
  const t = tmp();
  try {
    assert.equal(cli(['start', '--run', t.run, '--topic', 'x', '--wall-min', '5']).code, 0);
    assert.equal(cli(['record-fetch', '--run', t.run, '--url', OFFICIAL, '--excerpt', 'Open 10-18'], { now: '2026-10-01T10:04:00Z' }).code, 0);
    const late = cli(['record-fetch', '--run', t.run, '--url', OFFICIAL, '--excerpt', 'Open 10-18'], { now: '2026-10-01T10:06:00Z' });
    assert.equal(late.code, 3);
    assert.equal(late.out.code, 'wall_time');
  } finally { t.done(); }
});

test('scan reads stdin or a file; a bad or missing run file is reported', () => {
  const t = tmp();
  try {
    const bad = cli(['scan'], { input: FIXTURE.injection['https://toolcall.example/lantern'].text });
    assert.equal(bad.code, 1);
    assert.ok(bad.out.rules.includes('tool-call-markup'));
    assert.equal(cli(['scan', '--text-file', t.write('ok.txt', FIXTURE.pages[OFFICIAL].text)]).code, 0);

    assert.equal(cli(['status', '--run', path.join(t.dir, 'missing.json')]).code, 2);
    assert.equal(cli(['start', '--run', t.run, '--topic', 'x']).code, 0);
    const state = JSON.parse(fs.readFileSync(t.run, 'utf8'));
    state.budgets.searches = 999;
    fs.writeFileSync(t.run, JSON.stringify(state));
    const tampered = cli(['status', '--run', t.run]);
    assert.equal(tampered.code, 1);
    assert.match(tampered.out.error, /schema/);
  } finally { t.done(); }
});

// Developed by: LightAISolutions

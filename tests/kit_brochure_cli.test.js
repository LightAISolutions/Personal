'use strict';
// kits/brochure — the CLI is `node helpers/kits/brochure/index.mjs <cmd>` (a directory path does not run index.mjs).
// The PDF step needs the image's global Playwright + Chromium; without them the PDF test is skipped, not failed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const CLI = path.resolve(__dirname, '..', 'kits', 'brochure', 'index.mjs');
const FIXTURE = path.resolve(__dirname, '..', 'kits', 'brochure', 'fixtures', 'sample-trip.json');
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'brochure-'));

test('validate: 0 on the fixture, 2 with problems listed, 1 on usage / unknown option', () => {
  const ok = run('validate', FIXTURE);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stderr, /valid \(3 days, \d+ places\)/);
  const bad = path.join(tmp(), 'bad.json');
  const m = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  delete m.trip.start_date; m.days[0].stops[0].place = 'ghost';
  fs.writeFileSync(bad, JSON.stringify(m));
  const r = run('validate', bad);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /problems?\n\/trip: /);
  assert.equal(run().status, 1);
  assert.equal(run('render', FIXTURE).status, 1);
  assert.equal(run('render', FIXTURE, 'x.html', '--page', 'tabloid').status, 1);
  assert.equal(run('render', FIXTURE, 'x.html', '--bogus').status, 1);
});

test('render writes one self-contained HTML file; build without Playwright returns 3 with the HTML written', async () => {
  const dir = tmp();
  const out = path.join(dir, 'b.html');
  const r = run('render', FIXTURE, out, '--page', 'a4');
  assert.equal(r.status, 0, r.stderr);
  const html = fs.readFileSync(out, 'utf8');
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /content="a4"/);
  const { pdfAvailable } = await import('../kits/brochure/index.mjs');
  const b = spawnSync(process.execPath, [CLI, 'build', FIXTURE, path.join(dir, 'nopw'), '--name', 'trip'], { encoding: 'utf8', env: { ...process.env, BROCHURE_CHROMIUM: path.join(dir, 'no-such-chromium') } });
  assert.ok(fs.existsSync(path.join(dir, 'nopw', 'trip.html')));
  assert.equal(b.status, 3, b.stderr);
  assert.match(b.stderr, /PDF step skipped: (Chromium not found|Playwright is not installed)/);
  if (!pdfAvailable()) return; // no global Playwright/Chromium here (CI): the HTML half is the contract
  const p = run('build', FIXTURE, path.join(dir, 'pdf'), '--shots');
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stderr, /wrote .*brochure\.pdf \((\d+) pages, \1 PNG\)/);
  assert.ok(fs.readFileSync(path.join(dir, 'pdf', 'brochure.pdf')).subarray(0, 5).toString() === '%PDF-');
  assert.ok(fs.existsSync(path.join(dir, 'pdf', 'shots', 'page-01.png')));
  assert.doesNotMatch(p.stderr, /warning: .*taller than a page/);
});

test('--google refuses to run without a usage ledger and writes nothing', () => {
  const dir = tmp();
  const out = path.join(dir, 'x.html');
  const r = spawnSync(process.execPath, [CLI, 'render', FIXTURE, out, '--google'], { encoding: 'utf8', env: { ...process.env, MAPS_USAGE_LEDGER: '', MAPS_STATIC_KEY: '' } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage ledger/);
  assert.ok(!fs.existsSync(out));
});

// Developed by: LightAISolutions

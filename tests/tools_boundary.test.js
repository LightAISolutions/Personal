'use strict';
// tools/boundary-check.mjs — the public repo must never carry a secret or a personal-data path. Phase 1 done-when:
// a planted fake secret and a personal-data path make the check FAIL, and the real helpers/ tree passes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const H = require('./harness/gas-mocks');
const TOOL = path.join(H.HELPERS_ROOT, 'tools', 'boundary-check.mjs');
// Fakes are assembled at runtime so this test file itself never contains a secret-shaped string.
const FAKE_BOT_TOKEN = '123456789' + ':' + 'A'.repeat(35);
const FAKE_GOOGLE_KEY = 'AIza' + 'x'.repeat(35);
const DENIED_NAME = ['Shadow', 'AI', 'Solutions'].join('');
// PII fixtures are assembled too, so the real-tree scan below never trips on this file.
const FAKE_EMAIL = ['someone', 'mail.test'].join('@');
const FAKE_PHONE = ['555', '123', '4567'].join('-');

function plant() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-boundary-'));
  const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  w('core/leak.js', `var token = '${FAKE_BOT_TOKEN}';\nvar key = '${FAKE_GOOGLE_KEY}';\n`);
  w('people/alice.md', '# Alice\n');
  w('profile.md', '# Owner\n');
  w('docs/contact.md', `Write to ${FAKE_EMAIL} or call ${FAKE_PHONE}.\n`);
  w('docs/fixtures.md', 'Fixtures use owner@example.com and bot@users.noreply.github.com only.\n');
  w('docs/credit.md', `Developed by: ${DENIED_NAME}\n`);
  w('log/.gitkeep', '');
  w('trips/.gitkeep', '');
  w('dist/hello/Code.gs', `var token = '${FAKE_BOT_TOKEN}';\n`);
  return dir;
}

test('scan(): planted secrets, personal-data paths, PII and denied names are findings; fixtures and .gitkeep are not', async () => {
  const { scan, format, pathProblems, redact } = await import('../tools/boundary-check.mjs');
  const dir = plant();
  const r = scan({ root: dir });
  const rules = r.findings.map((f) => f.path + ' → ' + f.rule).sort();
  assert.deepEqual(rules, [
    'core/leak.js → google-api-key',
    'core/leak.js → telegram-bot-token',
    'docs/contact.md → email-address',
    'docs/contact.md → phone-number',
    'docs/credit.md → deny:' + DENIED_NAME,
    'people/alice.md → personal-data path: people/',
    'profile.md → personal-data path: profile*'
  ]);
  const text = format(r);
  assert.ok(!text.includes(FAKE_BOT_TOKEN) && !text.includes(FAKE_GOOGLE_KEY), 'matches are printed redacted');
  assert.match(text, /core\/leak\.js:1: telegram-bot-token: 1234…AAA \(45 chars\)/);
  assert.deepEqual(pathProblems('templates/private-repo/log/.gitkeep'), []);
  assert.deepEqual(pathProblems('trips/2026/rome.md'), ['personal-data path: trips/']);
  assert.deepEqual(pathProblems('x/profile-notes.md'), ['personal-data path: profile*']);
  assert.equal(redact('abcdefghijkl'), 'abcd…jkl (12 chars)');
  assert.equal(scan({ root: dir, paths: ['docs/fixtures.md', 'log'] }).findings.length, 0);
  assert.deepEqual(scan({ root: dir, paths: ['nope.md'] }).findings, [{ path: 'nope.md', rule: 'missing path' }]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('CLI: exits 1 on the planted tree (redacted output), honours an allowlist, and the real helpers/ tree is clean', () => {
  const dir = plant();
  const bad = spawnSync(process.execPath, [TOOL, '--root', dir], { encoding: 'utf8' });
  assert.equal(bad.status, 1, 'a planted fake secret MUST fail the check');
  assert.match(bad.stderr, /boundary-check: 7 finding\(s\) in \d+ file\(s\)/);
  assert.ok(!bad.stderr.includes(FAKE_BOT_TOKEN));
  const al = path.join(dir, 'allow.txt');
  // A custom allowlist replaces the default one, so the fixture entries it needs are repeated here.
  fs.writeFileSync(al, 'domain example.com\ndomain users.noreply.github.com\npath dist/\ndomain mail.test\npath docs/credit.md\npath people/\npath profile.md\npath core/\n');
  const some = spawnSync(process.execPath, [TOOL, '--root', dir, '--allowlist', al], { encoding: 'utf8' });
  assert.equal(some.status, 1);
  assert.match(some.stderr, /1 finding\(s\)/);
  assert.match(some.stderr, /phone-number/);
  const clean = spawnSync(process.execPath, [TOOL], { encoding: 'utf8' });
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /^boundary-check: clean — \d+ file\(s\) under /);
  assert.equal(spawnSync(process.execPath, [TOOL, '--quiet'], { encoding: 'utf8' }).stdout, '');
  fs.rmSync(dir, { recursive: true, force: true });
});

// Developed by: LightAISolutions

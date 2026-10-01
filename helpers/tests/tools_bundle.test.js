'use strict';
// tools/bundle.mjs — manifest validation, bundle layout, appsscript.json, CLI, and the bundle running in the mocks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync, spawnSync } = require('node:child_process');
const H = require('./harness/gas-mocks');
const TOOL = path.join(H.HELPERS_ROOT, 'tools', 'bundle.mjs');

test('validateManifest mirrors SPEC §4', async () => {
  const { validateManifest } = await import('../tools/bundle.mjs');
  const good = { name: 'trip-mate', display_name: 'Trip Mate', drive_root: 'TripMate', version: '0.1.0', envelope_types: ['alert'], memory_dirs: ['trips'] };
  assert.deepEqual(validateManifest(good), []);
  const errs = (m) => validateManifest({ ...good, ...m }).join(' | ');
  assert.match(errs({ name: 'Bad Name' }), /name invalid/);
  assert.match(errs({ version: '1.0' }), /version invalid/);
  assert.match(errs({ property_prefix: 'lower' }), /property_prefix invalid/);
  assert.match(errs({ envelope_types: ['notice'] }), /"notice" is a core type/);
  assert.match(errs({ envelope_types: ['a', 'a'] }), /duplicates/);
  assert.match(errs({ action_allowlist: ['drive_create_file'] }), /core action/);
  assert.match(errs({ memory_dirs: ['log'] }), /"log" is reserved/);
  assert.match(errs({ scopes: ['https://example.com/x'] }), /scopes: .* invalid/);
  assert.match(errs({ timezone: 'nowhere' }), /timezone invalid/);
  assert.match(errs({ private_repo: 'nope' }), /private_repo invalid/);
  assert.match(errs({ surprise: 1 }), /unknown field: surprise/);
  assert.match(validateManifest(null).join(), /JSON object/);
  assert.match(validateManifest({}).join(' | '), /name required.*display_name required.*drive_root required.*version required/);
});

test('bundle(hello): manifest block first, then core, then the pack; appsscript.json from the manifest', async () => {
  const B = await import('../tools/bundle.mjs');
  const b = B.bundle('hello');
  assert.equal(b.files.length, B.listCoreFiles().length + 1);
  assert.ok(b.code.startsWith('// Hello Helper (hello) — bundled by helpers/tools/bundle.mjs'));
  const idx = (s) => b.code.indexOf(s);
  assert.ok(idx('var HELPER_MANIFEST = {') < idx('// ===== core/00_config.js ====='), 'manifest precedes the core');
  assert.ok(idx('// ===== core/14_setup.js =====') < idx('// ===== packs/hello/gas/hello.js ====='), 'pack code loads last');
  assert.ok(!b.code.includes('"bogus"'));
  assert.equal(b.appsscript.timeZone, 'Etc/UTC');
  assert.equal(b.appsscript.runtimeVersion, 'V8');
  assert.deepEqual(b.appsscript.webapp, { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' });
  assert.deepEqual(b.appsscript.oauthScopes, B.CORE_SCOPES, 'no extra scopes unless the manifest asks');
  assert.ok(B.listPacks().includes('hello'), 'the hello pack is listed (other packs may exist)');
  assert.throws(() => B.bundle('nope'), /no manifest/);
});

test('the bundled Code.gs runs in the Apps Script mocks end to end (no file list, one script)', async () => {
  const { bundle } = await import('../tools/bundle.mjs');
  const { sandbox, state } = H.createMocks();
  const ctx = vm.createContext(sandbox);
  new vm.Script(bundle('hello').code, { filename: 'Code.gs' }).runInContext(ctx);
  H.bootstrap(ctx, state);
  assert.equal(ctx.HELPER.display_name, 'Hello Helper');
  ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text: '/ping' })));
  assert.match(state.fetch.lastTelegramText(), /^pong · .* · hello v0\.1\.0 · core v/);
  H.putEnvelope(state, H.envelope('greeting', { name: 'bundle' }), 'g.json', 'Hello');
  assert.equal(JSON.parse(ctx.doGet(H.getEvent('wake')).content).processed, 1);
  assert.equal(state.fetch.lastTelegramText(), '👋 Hello, bundle!');
});

test('CLI: --check reports, --out writes Code.gs + appsscript.json, bad packs exit 1', () => {
  const out = execFileSync(process.execPath, [TOOL, 'hello', '--check'], { encoding: 'utf8' });
  assert.match(out, /^ok: hello — \d+ files, \d+ chars, 4 scopes/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-bundle-'));
  execFileSync(process.execPath, [TOOL, 'hello', '--out', dir], { encoding: 'utf8' });
  assert.ok(fs.existsSync(path.join(dir, 'Code.gs')) && fs.existsSync(path.join(dir, 'appsscript.json')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'appsscript.json'), 'utf8')).oauthScopes.length, 4);
  const bad = spawnSync(process.execPath, [TOOL, 'missing-pack', '--check'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /bundle failed: no manifest/);
  assert.equal(spawnSync(process.execPath, [TOOL], { encoding: 'utf8' }).status, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('generated pack files: the interview bank constant is current, loads in the mocks, and --check catches drift', async () => {
  const B = await import('../tools/bundle.mjs');
  assert.deepEqual(B.staleGenerated('tour-guide'), [], 'gas/40_interview_bank.js matches the prefs kit preset — run the bundler');
  assert.deepEqual(B.generatedFor('hello'), []);
  const g = B.generatedFor('tour-guide').find((x) => x.out === 'gas/40_interview_bank.js');
  const onDisk = fs.readFileSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', g.out), 'utf8');
  assert.equal(onDisk, B.generatedScript(g));
  assert.match(onDisk, /GENERATED by helpers\/tools\/bundle\.mjs .* DO NOT EDIT/);
  assert.ok(onDisk.trimEnd().endsWith('// Developed by: LightAISolutions'));
  const preset = JSON.parse(fs.readFileSync(path.join(H.HELPERS_ROOT, g.from), 'utf8'));
  const sb = {}; vm.createContext(sb); new vm.Script(onDisk).runInContext(sb);
  assert.deepEqual(JSON.parse(JSON.stringify(sb.TG_INTERVIEW_BANK)), preset);
  assert.ok(B.bundle('tour-guide').code.includes('var TG_INTERVIEW_BANK = {'));

  // A temp tree: a changed source makes the file stale → bundle() refuses; writeBundle() regenerates it.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-gen-'));
  fs.cpSync(path.join(H.HELPERS_ROOT, 'core'), path.join(root, 'core'), { recursive: true });
  fs.cpSync(path.join(H.HELPERS_ROOT, 'packs', 'tour-guide', 'helper.json'), path.join(root, 'packs', 'tour-guide', 'helper.json'));
  fs.mkdirSync(path.join(root, 'kits', 'prefs', 'presets'), { recursive: true });
  const bank = { v: 1, vocab: 'travel', title: 'Tiny', sections: [{ id: 'pace', title: 'Pace', questions: [{ qid: 'pace-01', text: 'Pace?', kind: 'pick', dimension: 'pace', options: [{ label: 'Slow', value: 'relaxed', polarity: '+' }, { label: 'Fast', value: 'packed', polarity: '+' }], skip_ok: true }] }] };
  const src = path.join(root, g.from);
  fs.writeFileSync(src, JSON.stringify(bank));
  assert.deepEqual(B.staleGenerated('tour-guide', root), ['packs/tour-guide/gas/40_interview_bank.js'], 'missing counts as stale');
  assert.throws(() => B.bundle('tour-guide', root), /generated file out of date: packs\/tour-guide\/gas\/40_interview_bank\.js/);
  B.writeBundle('tour-guide', path.join(root, 'dist'), root);
  assert.deepEqual(B.staleGenerated('tour-guide', root), []);
  assert.match(fs.readFileSync(path.join(root, 'dist', 'Code.gs'), 'utf8'), /"title": "Tiny"/);
  const out = path.join(root, 'packs', 'tour-guide', g.out);
  fs.appendFileSync(out, '// hand edit\n');
  assert.throws(() => B.bundle('tour-guide', root), /out of date/, 'a hand edit fails the check');
  assert.deepEqual(B.writeGenerated('tour-guide', root), ['packs/tour-guide/gas/40_interview_bank.js']);
  assert.deepEqual(B.writeGenerated('tour-guide', root), [], 'unchanged → nothing rewritten');
  fs.writeFileSync(src, JSON.stringify({ v: 1, sections: [] }));
  assert.throws(() => B.staleGenerated('tour-guide', root), /needs sections/);
  fs.writeFileSync(src, '{nope');
  assert.throws(() => B.generatedScript(g, root), /invalid JSON/);
  fs.rmSync(root, { recursive: true, force: true });
});

// Developed by: LightAISolutions

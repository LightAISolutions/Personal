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

// Developed by: LightAISolutions

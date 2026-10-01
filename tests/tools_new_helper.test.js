'use strict';
// tools/new-helper.mjs — scaffold a pack and a private repo from the template; the result bundles and runs in the mocks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const H = require('./harness/gas-mocks');

const walk = (dir, acc = [], base = dir) => { for (const n of fs.readdirSync(dir).sort()) { const p = path.join(dir, n); if (fs.statSync(p).isDirectory()) walk(p, acc, base); else acc.push(path.relative(base, p)); } return acc; };

test('manifestFor + scaffoldPack: a valid manifest, a gas file that loads in the mocks, no overwrite without --force', async () => {
  const N = await import('../tools/new-helper.mjs');
  const { validateManifest } = await import('../tools/bundle.mjs');
  const m = N.manifestFor({ name: 'trip-mate', memory: ['trips', 'places'], types: ['alert'], privateRepo: 'ExampleOrg/TripMate' });
  assert.deepEqual(validateManifest(m), []);
  assert.equal(m.display_name, 'Trip Mate'); assert.equal(m.drive_root, 'TripMate'); assert.equal(m.property_prefix, 'TRIP_MATE'); assert.equal(m.producer, 'trip-mate-core');
  assert.throws(() => N.manifestFor({ name: 'Bad' }), /cannot build a valid manifest/);
  assert.throws(() => N.manifestFor({ name: 'ok', memory: ['log'] }), /reserved/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-pack-'));
  const written = N.scaffoldPack(m, { root }).map((f) => path.relative(root, f));
  assert.deepEqual(written, ['packs/trip-mate/helper.json', 'packs/trip-mate/gas/trip_mate.js', 'packs/trip-mate/README.md']);
  assert.throws(() => N.scaffoldPack(m, { root }), /pack exists/);
  const gas = path.join(root, 'packs/trip-mate/gas/trip_mate.js');
  new vm.Script(fs.readFileSync(gas, 'utf8'));
  assert.ok(fs.readFileSync(gas, 'utf8').trimEnd().endsWith('// Developed by: LightAISolutions'));
  const { ctx, state } = H.loadGas({ manifest: JSON.parse(fs.readFileSync(path.join(root, 'packs/trip-mate/helper.json'), 'utf8')), extra: [gas] });
  H.bootstrap(ctx, state);
  assert.equal(ctx.PROP.BOT_TOKEN, 'TRIP_MATE_BOT_TOKEN');
  assert.ok(ctx.getEnvelopeHandler('alert'));
  ctx.doPost(H.postEvent('tg', { k: state.props[ctx.PROP.WEBHOOK_SECRET] }, H.tgUpdate({ text: '/trip_mate' })));
  assert.equal(state.fetch.lastTelegramText(), '👋 Trip Mate v0.1.0 is here.');
  H.putEnvelope(state, H.envelope('alert', { text: 'Gate changed' }), 'a.json', 'TripMate');
  assert.equal(JSON.parse(JSON.stringify(ctx.pollFromBrain())).processed, 1);
  assert.equal(state.fetch.lastTelegramText(), 'Gate changed');
  fs.rmSync(root, { recursive: true, force: true });
});

test('scaffoldPrivateRepo fills every placeholder, ships the memory dirs, the merge workflow and the vendor pin notes', async () => {
  const N = await import('../tools/new-helper.mjs');
  const m = N.manifestFor({ name: 'trip-mate', memory: ['trips', 'places'], types: ['alert', 'brief'], privateRepo: 'ExampleOrg/TripMate' });
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-private-'));
  N.scaffoldPrivateRepo(m, out, { frameworkRepo: 'ExampleOrg/Framework' });
  const files = walk(out);
  for (const f of ['CLAUDE.md', 'README.md', '.gitattributes', '.github/workflows/merge-routine-memory.yml', 'scripts/merge-routine-memory.sh', 'skills/README.md', 'skills/remember-session/SKILL.md', 'routines/README.md', 'vendor/helpers/README.md', 'repository-information/SESSION-CONTEXT.md', 'log/.gitkeep', 'quarantine/.gitkeep', 'trips/.gitkeep', 'places/.gitkeep']) {
    assert.ok(files.includes(f), 'missing ' + f);
  }
  for (const f of files) {
    const text = fs.readFileSync(path.join(out, f), 'utf8');
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(text), 'unfilled placeholder in ' + f);
    if (f.endsWith('.md')) assert.ok(text.trimEnd().endsWith('Developed by: LightAISolutions'), 'branding missing in ' + f);
  }
  const claude = fs.readFileSync(path.join(out, 'CLAUDE.md'), 'utf8');
  assert.ok(claude.includes('Trip Mate') && claude.includes('TripMate/mailbox') && claude.includes('`alert`, `brief`') && claude.includes('--pack trip-mate'));
  assert.ok(claude.includes('`trips/`, `places/`'));
  assert.match(fs.readFileSync(path.join(out, 'scripts/merge-routine-memory.sh'), 'utf8'), /trips\|places/);
  assert.match(fs.readFileSync(path.join(out, 'vendor/helpers/README.md'), 'utf8'), /ExampleOrg\/Framework/);
  assert.match(fs.readFileSync(path.join(out, '.gitattributes'), 'utf8'), /log\/\*\.md merge=union/);
  assert.throws(() => N.scaffoldPrivateRepo(m, out), /not empty/);
  fs.rmSync(out, { recursive: true, force: true });
  const none = N.manifestFor({ name: 'quiet' });
  const ph = N.placeholdersFor(none);
  assert.equal(ph.MEMORY_DIRS_REGEX, 'quarantine');
  assert.equal(ph.ENVELOPE_TYPES, '(none)');
  assert.equal(ph.PRIVATE_REPO, '<your-org>/Quiet');
});

// Developed by: LightAISolutions

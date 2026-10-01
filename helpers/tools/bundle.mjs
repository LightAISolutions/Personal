#!/usr/bin/env node
/**
 * Helpers — bundler. Emits ONE Apps Script project for a pack:
 *   dist/<pack>/Code.gs        = generated manifest block + helpers/core/*.js (sorted) + helpers/packs/<pack>/gas/*.js (sorted)
 *   dist/<pack>/appsscript.json = time zone and OAuth scopes derived from the manifest (core minimum ∪ manifest.scopes)
 * Usage: node helpers/tools/bundle.mjs <pack> [--out DIR] [--check]      (exit 1 on a bad manifest or a syntax error)
 *        node helpers/tools/bundle.mjs --all [--check]
 * Generated pack files (GENERATED below — e.g. the tour-guide pack's interview bank constant): the normal mode rewrites
 * them from their JSON source before bundling; --check (and bundle()) fails when the file on disk differs.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const HELPERS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CORE_SCOPES = [
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/script.scriptapp'
];
export const CORE_ENVELOPE_TYPES = ['notice', 'reply', 'proposal', 'request'];
const RE = {
  name: /^[a-z][a-z0-9-]{1,31}$/, producer: /^[a-z0-9_-]{1,64}$/, prefix: /^([A-Z][A-Z0-9_]{0,15})?$/, version: /^\d+\.\d+\.\d+$/,
  driveRoot: /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/, ident: /^[a-z][a-z0-9_]{0,39}$/, routine: /^[A-Z][A-Z0-9_]{0,31}$/,
  memoryDir: /^[a-z][a-z0-9_-]{0,31}$/, tz: /^(UTC|Etc\/UTC|[A-Za-z_]+\/[A-Za-z_+\-\/]+)$/, scope: /^https:\/\/www\.googleapis\.com\/auth\/[a-z0-9_.\/-]+$/,
  repo: /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
};

/** validateManifest(obj) → string[] of problems (empty = valid). Mirrors helpers/SPEC.md §4. */
export function validateManifest(m) {
  const errs = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return ['manifest must be a JSON object'];
  const str = (k, re, required) => {
    if (m[k] === undefined) { if (required) errs.push(`${k} required`); return; }
    if (typeof m[k] !== 'string' || !re.test(m[k])) errs.push(`${k} invalid (${re})`);
  };
  const list = (k, re, extra) => {
    if (m[k] === undefined) return;
    if (!Array.isArray(m[k])) { errs.push(`${k} must be an array`); return; }
    m[k].forEach((v) => { if (typeof v !== 'string' || !re.test(v)) errs.push(`${k}: "${v}" invalid (${re})`); else if (extra) { const e = extra(v); if (e) errs.push(`${k}: ${e}`); } });
    if (new Set(m[k]).size !== m[k].length) errs.push(`${k} has duplicates`);
  };
  str('name', RE.name, true); str('display_name', /^[^\n]{1,60}$/, true); str('drive_root', RE.driveRoot, true);
  str('producer', RE.producer); str('property_prefix', RE.prefix); str('version', RE.version, true); str('timezone', RE.tz);
  str('inbound_routine', RE.routine); str('private_repo', RE.repo);
  list('envelope_types', RE.ident, (v) => (CORE_ENVELOPE_TYPES.includes(v) ? `"${v}" is a core type` : null));
  list('action_allowlist', RE.ident, (v) => (v === 'drive_create_file' ? `"${v}" is a core action` : null));
  list('memory_dirs', RE.memoryDir, (v) => (['log', 'quarantine', 'vendor', 'skills', 'routines'].includes(v) ? `"${v}" is reserved` : null));
  list('scopes', RE.scope);
  const known = ['name', 'display_name', 'drive_root', 'producer', 'property_prefix', 'version', 'timezone', 'inbound_routine', 'private_repo', 'envelope_types', 'action_allowlist', 'memory_dirs', 'scopes', 'description'];
  Object.keys(m).forEach((k) => { if (!known.includes(k)) errs.push(`unknown field: ${k}`); });
  if (m.description !== undefined && (typeof m.description !== 'string' || m.description.length > 300)) errs.push('description must be a string ≤300 chars');
  return errs;
}
export function packDir(pack, root = HELPERS_ROOT) { return join(root, 'packs', pack); }
/** loadManifest(pack) → the validated manifest object (throws on problems). */
export function loadManifest(pack, root = HELPERS_ROOT) {
  const file = join(packDir(pack, root), 'helper.json');
  if (!existsSync(file)) throw new Error(`no manifest: ${relative(root, file)}`);
  let m;
  try { m = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${relative(root, file)}: invalid JSON (${e.message})`); }
  const errs = validateManifest(m);
  if (errs.length) throw new Error(`${relative(root, file)}: ${errs.join('; ')}`);
  if (m.name !== pack) throw new Error(`${relative(root, file)}: name "${m.name}" must equal the pack directory "${pack}"`);
  return m;
}
/** The generated first file of every bundle: the manifest as a global the core reads in 00_config.js. */
export function manifestScript(m, label = 'helper.json') {
  const keys = ['name', 'display_name', 'drive_root', 'producer', 'property_prefix', 'version', 'envelope_types', 'action_allowlist', 'inbound_routine', 'memory_dirs', 'scopes'];
  const obj = {}; keys.forEach((k) => { if (m[k] !== undefined) obj[k] = m[k]; });
  return `// ===== manifest: ${label} (generated by helpers/tools/bundle.mjs — edit the JSON, not this block) =====\nvar HELPER_MANIFEST = ${JSON.stringify(obj, null, 2)};\n`;
}
export function appsscriptFor(m) {
  const scopes = [...new Set([...CORE_SCOPES, ...(m.scopes || [])])];
  return { timeZone: m.timezone || 'Etc/UTC', dependencies: {}, exceptionLogging: 'STACKDRIVER', runtimeVersion: 'V8',
    webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' }, oauthScopes: scopes };
}
export function listCoreFiles(root = HELPERS_ROOT) { return listJs(join(root, 'core')); }
export function listPackFiles(pack, root = HELPERS_ROOT) { return listJs(join(packDir(pack, root), 'gas')); }
export function listPacks(root = HELPERS_ROOT) {
  const d = join(root, 'packs');
  return existsSync(d) ? readdirSync(d).filter((n) => existsSync(join(d, n, 'helper.json'))).sort() : [];
}
function listJs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().filter((n) => n.endsWith('.js') && statSync(join(dir, n)).isFile()).map((n) => join(dir, n));
}

/**
 * Generated pack files: a JSON source in helpers/ becomes one `var NAME = {...};` constant file in a pack's gas/.
 * Never edit the output by hand — edit the source and run the bundler (normal mode) to rewrite it.
 */
export const GENERATED = [
  { pack: 'tour-guide', out: 'gas/40_interview_bank.js', from: 'kits/prefs/presets/travel.interview.json', name: 'TG_INTERVIEW_BANK',
    what: 'the prefs kit travel interview bank (sections → questions) that drives /interview' }
];
export function generatedFor(pack) { return GENERATED.filter((g) => g.pack === pack); }
/** The exact text of one generated file. Throws when the source is missing or not a JSON object. */
export function generatedScript(g, root = HELPERS_ROOT) {
  const src = join(root, g.from);
  if (!existsSync(src)) throw new Error(`generated ${g.pack}/${g.out}: source ${g.from} not found`);
  let data;
  try { data = JSON.parse(readFileSync(src, 'utf8')); } catch (e) { throw new Error(`${g.from}: invalid JSON (${e.message})`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${g.from}: must be a JSON object`);
  if (g.name === 'TG_INTERVIEW_BANK' && (!Array.isArray(data.sections) || !data.sections.length || data.sections.some((s) => !s || !s.id || !Array.isArray(s.questions)))) {
    throw new Error(`${g.from}: an interview bank needs sections[] = { id, title, questions[] }`);
  }
  return `/**\n * GENERATED by helpers/tools/bundle.mjs from helpers/${g.from} — DO NOT EDIT.\n * ${g.what}.\n` +
    ` * Edit the JSON source, then run: node helpers/tools/bundle.mjs ${g.pack}   (--check fails while this file is stale)\n */\n` +
    `var ${g.name} = ${JSON.stringify(data, null, 2)};\n\n// Developed by: LightAISolutions\n`;
}
/** Generated files of a pack whose text on disk differs from what would be generated → [relative path]. */
export function staleGenerated(pack, root = HELPERS_ROOT) {
  return generatedFor(pack).filter((g) => {
    const file = join(packDir(pack, root), g.out);
    return !existsSync(file) || readFileSync(file, 'utf8') !== generatedScript(g, root);
  }).map((g) => `packs/${pack}/${g.out}`);
}
/** (Re)write every generated file of a pack → [relative paths written (changed only)]. */
export function writeGenerated(pack, root = HELPERS_ROOT) {
  const stale = staleGenerated(pack, root);
  generatedFor(pack).forEach((g) => {
    const file = join(packDir(pack, root), g.out);
    if (!stale.includes(`packs/${pack}/${g.out}`)) return;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, generatedScript(g, root));
  });
  return stale;
}

/** bundle(pack) → { code, files, manifest, appsscript }. Every file and the whole bundle must parse. */
export function bundle(pack, root = HELPERS_ROOT) {
  const manifest = loadManifest(pack, root);
  const stale = staleGenerated(pack, root);
  if (stale.length) throw new Error(`generated file out of date: ${stale.join(', ')} — run node helpers/tools/bundle.mjs ${pack}`);
  const files = [...listCoreFiles(root), ...listPackFiles(pack, root)];
  if (!listCoreFiles(root).length) throw new Error('no core files found under ' + relative(root, join(root, 'core')));
  const parts = [`// ${manifest.display_name} (${pack}) — bundled by helpers/tools/bundle.mjs — DO NOT EDIT; edit helpers/core/*.js or helpers/packs/${pack}/gas/*.js and rebuild.\n`,
    manifestScript(manifest, `helpers/packs/${pack}/helper.json`)];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    try { new vm.Script(src, { filename: f }); } catch (e) { throw new Error(`Syntax error in ${relative(root, f)}: ${e.message}`); }
    parts.push(`\n// ===== ${relative(root, f)} =====\n${src.trimEnd()}\n`);
  }
  const code = parts.join('');
  try { new vm.Script(code, { filename: 'Code.gs' }); } catch (e) { throw new Error(`Bundle syntax error: ${e.message}`); }
  return { code, files, manifest, appsscript: appsscriptFor(manifest) };
}
export function writeBundle(pack, outDir, root = HELPERS_ROOT) {
  loadManifest(pack, root);
  writeGenerated(pack, root);
  const b = bundle(pack, root);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'Code.gs'), b.code);
  writeFileSync(join(outDir, 'appsscript.json'), JSON.stringify(b.appsscript, null, 2) + '\n');
  return b;
}

function main(argv) {
  const check = argv.includes('--check'), all = argv.includes('--all');
  const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
  const packs = all ? listPacks() : argv.filter((a) => !a.startsWith('--') && a !== out);
  if (!packs.length) { console.error('usage: node helpers/tools/bundle.mjs <pack> [--out DIR] [--check] | --all [--check]'); return 2; }
  for (const pack of packs) {
    const dir = resolve(out || join(HELPERS_ROOT, 'dist', pack));
    const b = check ? bundle(pack) : writeBundle(pack, dir);
    console.log(check ? `ok: ${pack} — ${b.files.length} files, ${b.code.length} chars, ${b.appsscript.oauthScopes.length} scopes`
      : `bundled ${pack}: ${b.files.length} files → ${relative(process.cwd(), join(dir, 'Code.gs'))} (${b.code.length} chars)`);
  }
  return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error('bundle failed: ' + e.message); process.exitCode = 1; }
}

// Developed by: LightAISolutions

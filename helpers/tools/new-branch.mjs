#!/usr/bin/env node
/**
 * Helpers — scaffold one branch of a pack, and check a branch has all its parts (helpers/tools/README.md, "Branches").
 * A branch: a command → a request kind → a routine → (an envelope type → its handler, schema and validators) → (a tab)
 * → (app ops). Usage:
 *   node helpers/tools/new-branch.mjs <name> [--pack tour-guide] [--title "<Title>"] [--command /<cmd>] [--kind <kind>]
 *     [--envelope <type>] [--routine RESEARCH] [--tab <Tab>] [--no-app] [--no-envelope] [--no-tab] [--prefix NN]
 *     [--private-out <dir>] [--dry-run] [--force]
 *   node helpers/tools/new-branch.mjs --check <name> [--pack tour-guide]
 * Exit: 0 written / complete · 1 the check found a missing part · 2 a usage error, a clash or a pack it cannot extend.
 * Reads code, never a registry file: the check loads the pack in the GAS harness and reads its source.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { validateManifest, CORE_ENVELOPE_TYPES } from './bundle.mjs';

export const HELPERS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATE_DIR = join(HELPERS_ROOT, 'tools', 'branch-templates');
const require = createRequire(import.meta.url);

export const RE = Object.freeze({
  name: /^[a-z][a-z0-9]{1,23}$/, pack: /^[a-z][a-z0-9-]{1,31}$/, command: /^\/[a-z0-9_]{1,31}$/, kind: /^[a-z][a-z0-9_]{1,31}$/,
  type: /^[a-z][a-z0-9_]{0,39}$/, tab: /^[A-Z][A-Za-z0-9]{0,30}$/, routine: /^[A-Z][A-Z0-9_]{0,31}$/,
  title: /^[A-Za-z0-9][A-Za-z0-9 ,.()&-]{0,39}$/, prefix: /^\d{2}$/
});
/**
 * Load-order bands. The core module needs only 00_common.js before it (TG_KIND_ROUTINE at load; the rest is called at run
 * time): the pack's 1x–2x band first, then 41–99. The app file adds to TG_APP_OPS, so it loads after 32_app_api.js.
 */
export const BANDS = Object.freeze({ core: [10, 29], prefix: [1, 99], app: [33, 39], spill: [41, 99] });
const ICON = '🧩';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const pascal = (s) => String(s).split(/[-_]+/).filter(Boolean).map(cap).join('');
export const kebab = (s) => String(s).replace(/_/g, '-');
const listJs = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.js')).sort() : []);
const read = (f) => readFileSync(f, 'utf8');
const two = (n) => String(n).padStart(2, '0');

/**
 * render(template, vars, flags): `{{#FLAG}}…{{/FLAG}}` keeps its body when the flag is true, `{{^FLAG}}…{{/FLAG}}` when it is
 * false (innermost first, so sections nest), then `{{KEY}}` is replaced. An unknown key or flag throws.
 */
export function render(tmpl, vars, flags = {}) {
  const SEC = /\{\{([#^])([A-Z_]+)\}\}((?:(?!\{\{[#^][A-Z_]+\}\})[\s\S])*?)\{\{\/\2\}\}/g;
  let s = tmpl, prev;
  do {
    prev = s;
    s = s.replace(SEC, (m, op, flag, body) => {
      if (!Object.prototype.hasOwnProperty.call(flags, flag)) throw new Error(`template: unknown section ${flag}`);
      return (op === '#') === !!flags[flag] ? body : '';
    });
  } while (s !== prev);
  if (/\{\{[#^/][A-Z_]+\}\}/.test(s)) throw new Error('template: an unbalanced section');
  return s.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => {
    if (!Object.prototype.hasOwnProperty.call(vars, k)) throw new Error(`template: unknown key ${k}`);
    return String(vars[k]);
  });
}
/* ==================== reading a pack ==================== */

/** A usage error, a clash or a pack the tool cannot extend: exit 2. */
export class BranchError extends Error {
  constructor(message, list) { super(message); this.code = 2; this.list = list || [message]; }
}
const fail2 = (msg, list) => new BranchError(msg, list);

/** Comments out, for scanning (block comments and whole-line // comments); the @branch line is read from the raw text. */
export const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** The pack's manifest and gas files: { pack, root, dir, gasDir, manifest, manifestText, manifestPath, files: [{ file, path, raw, code }] }. */
export function readPack(pack, root = HELPERS_ROOT) {
  const dir = join(root, 'packs', pack), manifestPath = join(dir, 'helper.json');
  if (!existsSync(manifestPath)) throw fail2(`no pack "${pack}" (packs/${pack}/helper.json not found)`);
  const manifestText = read(manifestPath);
  let manifest;
  try { manifest = JSON.parse(manifestText); } catch (e) { throw fail2(`packs/${pack}/helper.json is not JSON: ${e.message}`); }
  const gasDir = join(dir, 'gas');
  const files = listJs(gasDir).map((file) => { const raw = read(join(gasDir, file)); return { file, path: join(gasDir, file), raw, code: stripComments(raw) }; });
  return { pack, root, dir, gasDir, manifest, manifestText, manifestPath, files };
}

/** Load core + the pack's gas files (minus `exclude`) in the GAS harness, as the bundle runs them. → the vm context. */
export function loadContext(p, exclude = []) {
  const harness = join(p.root, 'tests', 'harness', 'gas-mocks.js');
  if (!existsSync(harness)) throw fail2(`the GAS harness is missing (${relative(p.root, harness)})`);
  const { sandbox } = require(harness).createMocks({ now: '2027-01-01T00:00:00Z' });
  const ctx = vm.createContext(sandbox);
  new vm.Script('var HELPER_MANIFEST = ' + JSON.stringify(p.manifest) + ';', { filename: 'manifest.js' }).runInContext(ctx);
  for (const f of listJs(join(p.root, 'core'))) new vm.Script(read(join(p.root, 'core', f)), { filename: 'core/' + f }).runInContext(ctx);
  for (const f of p.files) if (!exclude.includes(f.file)) new vm.Script(f.raw, { filename: f.file }).runInContext(ctx);
  return ctx;
}

/** What a generated module calls: a pack without these is not one this tool can extend. */
export const PLUMBING = Object.freeze(['TG_KIND_ROUTINE', 'tgKindRoutine', 'tgOpenKindRequest', 'TG_APP_OPS', 'tgAppStr', 'tgAppOk', 'tgAppNo', 'tgAppS',
  'tgEnvObj', 'tgEnvHead', 'tgEnvStr', 'tgEnvSlug', 'tgEnvSize', 'tgEnvDone', 'tgEnvCleaned', 'tgTripCurrent', 'tgTripGet', 'tgCmdTitle',
  'tgOwnerChat', 'tgSend', 'tgEscape', 'tgShStr', 'TG_SLUG_RE']);

/** The @branch line of a core module → { name, command, kind, envelope, tab, routine, app } ("-" = not needed), or null. */
export function parseMarker(raw) {
  const m = /^\/\/ @branch ([a-z][a-z0-9_-]*)((?: [a-z]+=\S+)*)[ \t]*$/m.exec(raw || '');
  if (!m) return null;
  const out = { name: m[1] };
  for (const kv of m[2].trim().split(/\s+/).filter(Boolean)) { const i = kv.indexOf('='); out[kv.slice(0, i)] = kv.slice(i + 1); }
  return out;
}
/** Branch files of `name` in gas/: the core module NN_<name>.js and the app file NN_<name>_app.js. */
export function branchFiles(p, name) {
  const core = p.files.find((f) => new RegExp(`^\\d{2}_${escRe(name)}\\.js$`).test(f.file)) || null;
  const app = p.files.find((f) => new RegExp(`^\\d{2}_${escRe(name)}_app\\.js$`).test(f.file)) || null;
  return { core, app };
}
/** Every request kind in use: TG_KIND_ROUTINE's keys, kinds tgKindRoutine names in its body, and every literal tgOpenKindRequest('…'). */
export function kindsInUse(p, ctx, exclude = []) {
  const out = new Map();
  for (const k of Object.keys(ctx.TG_KIND_ROUTINE || {})) out.set(k, 'TG_KIND_ROUTINE');
  for (const m of String(ctx.tgKindRoutine || '').matchAll(/'([a-z][a-z0-9_]*)'/g)) if (!out.has(m[1])) out.set(m[1], 'tgKindRoutine');
  for (const f of p.files) {
    if (exclude.includes(f.file)) continue;
    for (const m of f.code.matchAll(/tgOpenKindRequest\(\s*'([a-z][a-z0-9_]*)'/g)) if (!out.has(m[1])) out.set(m[1], 'gas/' + f.file);
  }
  return out;
}
const whereIs = (p, needle, exclude = []) => {
  const f = p.files.find((x) => !exclude.includes(x.file) && x.code.includes(needle));
  return f ? 'gas/' + f.file : 'core';
};
/** The pack's schemas/index.mjs source, or null. */
const schemasIndexPath = (p) => join(p.dir, 'schemas', 'index.mjs');
const payloadKindsBlock = (src) => /export const PAYLOAD_KINDS = Object\.freeze\(\{[\s\S]*?\n\}\);/.exec(src || '');
const payloadKindsHas = (src, type) => { const b = payloadKindsBlock(src); return !!b && new RegExp(`(^|\\n)\\s*'?${escRe(type)}'?\\s*:`).test(b[0]); };
/* ==================== planning a branch ==================== */

/** Options (CLI or caller) → the branch with every default filled in. Throws BranchError listing every bad option. */
export function resolveOptions(o = {}) {
  const errs = [], name = o.name || '';
  if (!RE.name.test(name)) errs.push(`the name must match ${RE.name} (got "${name}")`);
  if (o.envelope && o.noEnvelope) errs.push('--envelope and --no-envelope together');
  if (o.tab && o.noTab) errs.push('--tab and --no-tab together');
  const b = {
    name, pack: o.pack || 'tour-guide', title: o.title || cap(name), command: o.command || '/' + name, kind: o.kind || name,
    envelope: o.noEnvelope ? null : (o.envelope || name), tab: o.noTab ? null : (o.tab || cap(name) + (name.endsWith('s') ? '' : 's')),
    routine: String(o.routine || 'RESEARCH').toUpperCase(), app: !o.noApp, prefix: o.prefix == null ? null : String(o.prefix),
    privateOut: o.privateOut || null, force: !!o.force
  };
  const want = (k, re, v) => { if (v !== null && !re.test(v)) errs.push(`${k} must match ${re} (got "${v}")`); };
  want('--pack', RE.pack, b.pack); want('--title', RE.title, b.title); want('--command', RE.command, b.command);
  want('--kind', RE.kind, b.kind); want('--envelope', RE.type, b.envelope); want('--tab', RE.tab, b.tab);
  want('--routine', RE.routine, b.routine); want('--prefix', RE.prefix, b.prefix);
  if (errs.length) throw fail2('bad options: ' + errs.join('; '), errs);
  return b;
}

/** Identifiers the generated files define (a name that collides with an existing global is refused). */
export function branchIdentifiers(b) {
  const P = pascal(b.name), ids = ['TG_' + b.name.toUpperCase(), `tg${P}Open`];
  if (b.tab) ids.push(`tg${P}Rec`, `tg${P}Get`, `tg${P}List`, `tg${P}Store`);
  if (b.envelope) ids.push('tgEnvValidate' + pascal(b.envelope));
  if (b.app) ids.push(`tgApp${P}Out`, `tgAppOp${P}List`, `tgAppOp${P}Get`);
  return ids;
}

/** Every clash with what the pack already has → string[] (empty = none). `own` = this branch's files, ignored under --force. */
export function findClashes(b, p, ctx, own = []) {
  const out = [], files = branchFiles(p, b.name);
  const generated = !!(files.core && parseMarker(files.core.raw) && parseMarker(files.core.raw).name === b.name);
  const may = b.force && generated;   // --force rewrites only a branch this tool wrote
  if (Array.from(ctx.registryKeys('command')).includes(b.command)) out.push(`command ${b.command} is already registered (${whereIs(p, `'${b.command}'`, own)})`);
  const kinds = kindsInUse(p, ctx, own);
  if (kinds.has(b.kind)) out.push(`request kind "${b.kind}" is already used (${kinds.get(b.kind)})`);
  if (b.envelope) {
    const src = existsSync(schemasIndexPath(p)) ? read(schemasIndexPath(p)) : '';
    if (CORE_ENVELOPE_TYPES.includes(b.envelope)) out.push(`envelope type "${b.envelope}" is a core type`);
    else if (ctx.getEnvelopeHandler(b.envelope)) out.push(`envelope type "${b.envelope}" already has a handler (${whereIs(p, `'${b.envelope}'`, own)})`);
    else if (!may && (p.manifest.envelope_types || []).includes(b.envelope)) out.push(`envelope type "${b.envelope}" is already in helper.json envelope_types`);
    else if (!may && payloadKindsHas(src, b.envelope)) out.push(`envelope type "${b.envelope}" is already in schemas/index.mjs PAYLOAD_KINDS`);
  }
  if (b.tab) {
    const tab = Object.keys(ctx.allSheetSchemas()).find((t) => t.toLowerCase() === b.tab.toLowerCase());   // Sheet tab names ignore case
    if (tab) out.push(`tab "${b.tab}" already exists ("${tab}")`);
  }
  for (const id of branchIdentifiers(b)) if (id in ctx) out.push(`identifier ${id} is already defined (${whereIs(p, id, own)}) — pick another name`);
  const taken = [];
  if (files.core || files.app) taken.push('gas/' + [files.core, files.app].filter(Boolean).map((f) => f.file).join(', gas/'));
  if (existsSync(join(p.dir, b.name))) taken.push(`packs/${p.pack}/${b.name}/`);
  if (b.envelope && existsSync(join(p.dir, 'schemas', `${p.pack}-${kebab(b.envelope)}.schema.json`))) taken.push(`schemas/${p.pack}-${kebab(b.envelope)}.schema.json`);
  if (existsSync(join(p.root, 'tests', `pack_${p.pack}_${b.name}.test.js`))) taken.push(`tests/pack_${p.pack}_${b.name}.test.js`);
  if (b.privateOut && existsSync(join(b.privateOut, b.name)) && readdirSync(join(b.privateOut, b.name)).length) taken.push(join(b.privateOut, b.name) + '/');
  if (taken.length && !may) {
    out.push(`the name "${b.name}" is taken: ${taken.join(', ')}` + (b.force ? ' (--force rewrites only a branch new-branch wrote: no @branch line found)' : ' (--force rewrites a branch new-branch wrote)'));
  }
  return out;
}

/** File numbers: the core module's (1x–2x band, or --prefix) and the app file's (after 32_app_api.js). */
export function pickNumbers(b, p, own = []) {
  const used = new Set(p.files.filter((f) => !own.includes(f.file)).map((f) => Number(f.file.slice(0, 2))).filter((n) => !Number.isNaN(n)));
  const ownCore = own.find((f) => !/_app\.js$/.test(f)), ownApp = own.find((f) => /_app\.js$/.test(f));
  const first = ([lo, hi]) => { for (let n = lo; n <= hi; n++) if (!used.has(n)) return n; return null; };
  let core;
  if (b.prefix !== null) {
    core = Number(b.prefix);
    if (core < BANDS.prefix[0] || core > BANDS.prefix[1]) throw fail2(`--prefix must be ${two(BANDS.prefix[0])}–${BANDS.prefix[1]} (the core module loads after 00_common.js)`);
    if (used.has(core)) throw fail2(`--prefix ${b.prefix} is already used by gas/${p.files.find((f) => Number(f.file.slice(0, 2)) === core).file}`);
  } else core = ownCore ? Number(ownCore.slice(0, 2)) : (first(BANDS.core) ?? first(BANDS.spill));
  if (core === null) throw fail2('no free file number for the core module: pass --prefix NN');
  used.add(core);
  let app = null;
  if (b.app) {
    app = ownApp ? Number(ownApp.slice(0, 2)) : (first(BANDS.app) ?? first(BANDS.spill));
    if (app === null) throw fail2('no free number after 32_app_api.js for the app file');
  }
  return { core, app };
}

/** Template values of a branch. */
export function branchVars(b, p, nums) {
  const T = b.envelope || '', mdirs = (p.manifest.memory_dirs || []).map((d) => '`' + d + '/`');
  return {
    NAME: b.name, PACK: p.pack, DISPLAY: p.manifest.display_name || pascal(p.pack), TITLE: b.title, TITLE_HTML: b.title.replace(/&/g, '&amp;'),
    TITLE_JSON: b.title, TITLE_ONE_LINE: b.title, CMD: b.command, KIND: b.kind, ROUTINE: b.routine, HELP: `${b.title} for the current trip`,
    TYPE: T, TYPE_PASCAL: T ? pascal(T) : '', TYPE_OR_DASH: T || '-', TYPE_JS: T ? `'${T}'` : 'null',
    TAB: b.tab || '', TAB_OR_DASH: b.tab || '-', TAB_JS: b.tab ? `'${b.tab}'` : 'null', APP_OR_DASH: b.app ? 'yes' : '-',
    UPPER: b.name.toUpperCase(), PASCAL: pascal(b.name), ICON, CORE_FILE: `${two(nums.core)}_${b.name}.js`,
    APP_FILE: b.app ? `${two(nums.app)}_${b.name}_app.js` : '', SCHEMA_FILE: T ? `${p.pack}-${kebab(T)}.schema.json` : '',
    DRIVE_ROOT: p.manifest.drive_root || pascal(p.pack), MEMORY_DIRS: mdirs.length ? mdirs.join(', ') : 'the memory directories',
    LONG_NOTE: 'x'.repeat(201)
  };
}
/**
 * helper.json text with `type` appended to envelope_types, keeping the file's own layout (one line or one per line).
 * → { text, changed, reformatted } — reformatted when the layout could not be kept (the JSON is then re-stringified).
 */
export function addEnvelopeType(text, type) {
  const m = JSON.parse(text), before = m.envelope_types || [];
  if (before.includes(type)) return { text, changed: false, reformatted: false };
  const want = { ...m, envelope_types: [...before, type] };
  const out = text.replace(/("envelope_types"\s*:\s*\[)([^\]]*)(\])/, (all, a, inner, c) => {
    const body = inner.replace(/\s+$/, ''), tail = inner.slice(body.length);
    if (!body.trim()) return a + `"${type}"` + c;
    if (inner.includes('\n')) return a + body + ',\n' + ((/\n([ \t]*)\S[^\n]*$/.exec(body) || [, '  '])[1]) + `"${type}"` + tail + c;
    return a + body + (/",\s/.test(body) ? ', ' : ',') + `"${type}"` + tail + c;
  });
  let ok = false;
  try { ok = JSON.stringify(JSON.parse(out)) === JSON.stringify(want); } catch { ok = false; }
  return ok ? { text: out, changed: true, reformatted: false } : { text: JSON.stringify(want, null, 2) + '\n', changed: true, reformatted: true };
}

/** schemas/index.mjs text with the type's schema kind in KINDS and `type: 'kind'` in PAYLOAD_KINDS (so tools/envelope.mjs --pack knows it). */
export function addPayloadKind(src, type, kind) {
  let out = src;
  const add = (re, line, has) => {
    const m = re.exec(out);
    if (!m) throw fail2('schemas/index.mjs has no ' + re.source.slice(0, 40) + '… block to add the type to');
    if (has.test(m[0])) return;
    const body = m[0].slice(0, -'\n});'.length).replace(/,?\s*$/, '');
    out = out.slice(0, m.index) + body + ',\n' + line + '\n});' + out.slice(m.index + m[0].length);
  };
  add(/const KINDS = Object\.freeze\(\{[\s\S]*?\n\}\);/, `  '${kind}': null`, new RegExp(`\\n\\s*'${escRe(kind)}'\\s*:`));
  add(/export const PAYLOAD_KINDS = Object\.freeze\(\{[\s\S]*?\n\}\);/, `  ${type}: '${kind}'`, new RegExp(`\\n\\s*'?${escRe(type)}'?\\s*:`));
  return { text: out, changed: out !== src };
}

/**
 * planBranch(options) → { branch, pack, clashes, writes: [{ path, rel, content, change }], removes: [path], notes }.
 * Reads only. writeBranch(plan) writes it; --dry-run prints it.
 */
export function planBranch(o, root = HELPERS_ROOT) {
  const b = resolveOptions(o), p = readPack(b.pack, root);
  const mErr = validateManifest(p.manifest);
  if (mErr.length) throw fail2(`packs/${p.pack}/helper.json is not a valid manifest: ${mErr.join('; ')}`);
  const files = branchFiles(p, b.name), own = b.force ? [files.core, files.app].filter(Boolean).map((f) => f.file) : [];
  let ctx;
  try { ctx = loadContext(p, own); } catch (e) { throw fail2(`pack ${p.pack} does not load in the GAS harness: ${e.message}`); }
  const lacking = PLUMBING.filter((k) => !(k in ctx));
  if (lacking.length) throw fail2(`pack ${p.pack} lacks what a branch calls: ${lacking.join(', ')} (new-branch extends Tour-Guide-style packs)`);
  const idx = schemasIndexPath(p);
  if (b.envelope && !(existsSync(idx) && payloadKindsBlock(read(idx)))) throw fail2(`an envelope needs packs/${p.pack}/schemas/index.mjs with PAYLOAD_KINDS (or pass --no-envelope)`);
  const clashes = findClashes(b, p, ctx, own);
  const plan = { branch: b, pack: p, clashes, writes: [], removes: [], notes: [] };
  if (clashes.length) return plan;
  const nums = pickNumbers(b, p, own), v = branchVars(b, p, nums), flags = { ENVELOPE: !!b.envelope, TAB: !!b.tab, APP: b.app };
  const tmpl = (f) => read(join(TEMPLATE_DIR, f));
  const put = (path, content, change = false) => plan.writes.push({ path, rel: relative(root, path), content, change });
  const pkg = join(p.dir, b.name);
  put(join(p.gasDir, v.CORE_FILE), render(tmpl('core.js.tmpl'), v, flags));
  if (b.app) put(join(p.gasDir, v.APP_FILE), render(tmpl('app.js.tmpl'), v, flags));
  if (b.envelope) {
    put(join(p.dir, 'schemas', v.SCHEMA_FILE), render(tmpl('schema.json.tmpl'), v, flags));
    put(join(pkg, `${b.name}-payload.mjs`), render(tmpl('payload.mjs.tmpl'), v, flags));
  }
  put(join(pkg, 'index.mjs'), render(tmpl('index.mjs.tmpl'), v, flags));
  put(join(pkg, 'README.md'), render(tmpl('README.md.tmpl'), v, flags));
  put(join(pkg, 'fixtures', `${b.name}-sample.json`), render(tmpl('fixture.json.tmpl'), v, flags));
  put(join(root, 'tests', `pack_${p.pack}_${b.name}.test.js`), render(tmpl('test.js.tmpl'), v, flags));
  if (b.envelope) {
    const hj = addEnvelopeType(p.manifestText, b.envelope);
    if (hj.changed) put(p.manifestPath, hj.text, true);
    if (hj.reformatted) plan.notes.push('helper.json: envelope_types kept no recognisable layout, so the file was re-stringified');
    const si = addPayloadKind(read(idx), b.envelope, kebab(b.envelope));
    if (si.changed) put(idx, si.text, true);
  }
  if (b.privateOut) {
    const dir = join(resolve(b.privateOut), b.name);
    put(join(dir, 'SKILL.md'), render(tmpl('private/SKILL.md.tmpl'), v, flags));
    put(join(dir, `${b.name}-start.mjs`), render(tmpl('private/start.mjs.tmpl'), v, flags));
    put(join(dir, `${b.name}-finish.mjs`), render(tmpl('private/finish.mjs.tmpl'), v, flags));
  }
  const keep = new Set(plan.writes.map((w) => w.path));
  for (const f of own) if (!keep.has(join(p.gasDir, f))) plan.removes.push(join(p.gasDir, f));   // --force with a new number / --no-app
  if (b.force && !b.envelope) plan.notes.push('--force with --no-envelope leaves an earlier schema, payload module and helper.json entry in place');
  return plan;
}
/** Write a plan (refuses one with clashes). Checks the edited schemas/index.mjs still imports and maps the type; restores it if not. */
export async function writeBranch(plan) {
  if (plan.clashes.length) throw fail2('refused: ' + plan.clashes.join('; '), plan.clashes);
  const b = plan.branch;
  for (const w of plan.writes) {
    if (!w.change && existsSync(w.path) && !b.force) throw fail2(`refused to overwrite ${w.rel} (--force rewrites a branch new-branch wrote)`);
  }
  const idx = schemasIndexPath(plan.pack), before = existsSync(idx) ? read(idx) : null;
  for (const w of plan.writes) { mkdirSync(dirname(w.path), { recursive: true }); writeFileSync(w.path, w.content); }
  for (const r of plan.removes) rmSync(r);
  if (b.envelope && plan.writes.some((w) => w.path === idx)) {
    let why = null;
    try {
      const s = await import(pathToFileURL(idx).href + '?t=' + Date.now());
      if (s.PAYLOAD_KINDS[b.envelope] !== kebab(b.envelope)) why = 'PAYLOAD_KINDS does not map the type';
      else s.loadSchema(kebab(b.envelope));
    } catch (e) { why = e.message; }
    if (why) { writeFileSync(idx, before); throw fail2(`schemas/index.mjs could not take the type (${why}); restored it — add it by hand`); }
  }
  return plan.writes.map((w) => w.rel);
}

/* ==================== checking a branch ==================== */

const normType = (s) => String(s).toLowerCase().replace(/[-_]/g, '');
const walkMjs = (dir, skip) => {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) { if (!skip.includes(e.name)) out.push(...walkMjs(f, skip)); } else if (e.name.endsWith('.mjs')) out.push(f);
  }
  return out;
};

/**
 * checkBranch(name, { pack, root }) → { name, pack, marker, rows: [{ part, status: 'ok' | 'missing' | 'not needed', detail }], complete }.
 * What a branch declares comes from its core module's @branch line ("-" = not needed: --no-envelope, --no-tab, --no-app);
 * a branch without the line (built by hand) is expected to have every part, its names derived from its code.
 */
export async function checkBranch(name, { pack = 'tour-guide', root = HELPERS_ROOT } = {}) {
  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(name || '')) throw fail2(`--check needs a branch name (got "${name || ''}")`);
  const p = readPack(pack, root), rows = [];
  const row = (part, status, detail) => rows.push({ part, status, detail });
  let ctx = null;
  try { ctx = loadContext(p); row('pack loads', 'ok', `core + ${p.files.length} gas files in the GAS harness`); } catch (e) { row('pack loads', 'missing', e.message); }
  const live = (fn) => { if (!ctx) return null; try { return fn(ctx); } catch { return null; } };
  const { core, app } = branchFiles(p, name);
  const coreFile = core || p.files.find((f) => f.code.includes(`registerCommand('/${name}'`)) || null;
  const marker = coreFile ? parseMarker(coreFile.raw) : null;
  const decl = marker && marker.name === name ? marker : null;
  const first = (re) => { const m = coreFile && re.exec(coreFile.code); return m ? m[1] : null; };
  const d = {
    command: decl ? decl.command : (first(/registerCommand\(\s*'(\/[a-z0-9_]+)'/) || '/' + name),
    kind: decl ? decl.kind : (first(/tgOpenKindRequest\(\s*'([a-z][a-z0-9_]*)'/) || name),
    envelope: decl ? decl.envelope : (first(/registerEnvelopeHandler\(\s*'([a-z][a-z0-9_]*)'/) || name),
    tab: decl ? decl.tab : null, routine: decl ? decl.routine : null, app: decl ? decl.app : null
  };
  if (coreFile) row('core module', 'ok', `gas/${coreFile.file}` + (decl ? ' (parts from its @branch line)' : ' (no @branch line: every part expected)'));
  else row('core module', 'missing', `no gas/NN_${name}.js and no file registering /${name}`);
  const CMD = d.command;
  row('command', live((c) => typeof c.getCommand(CMD) === 'function') ? 'ok' : 'missing', CMD);
  const opener = p.files.find((f) => f.code.includes(`tgOpenKindRequest('${d.kind}'`));
  row('kind request', opener ? 'ok' : 'missing', opener ? `"${d.kind}" opened in gas/${opener.file}` : `nothing calls tgOpenKindRequest('${d.kind}', …)`);
  const routed = live((c) => Object.prototype.hasOwnProperty.call(c.TG_KIND_ROUTINE, d.kind) || new RegExp(`'${escRe(d.kind)}'`).test(String(c.tgKindRoutine)));
  const routine = live((c) => c.tgKindRoutine(d.kind));
  if (!routed) row('kind routing', 'missing', `"${d.kind}" is not in TG_KIND_ROUTINE (it would fall to the default routine)`);
  else if (d.routine && routine !== d.routine) row('kind routing', 'missing', `"${d.kind}" routes to ${routine}; the @branch line says ${d.routine}`);
  else row('kind routing', 'ok', `"${d.kind}" → ${routine}`);
  const ENV_PARTS = ['envelope type', 'envelope handler', 'core validator', 'schema', 'pack validator', 'envelope tool', 'parity test'];
  if (d.envelope === '-') for (const part of ENV_PARTS) row(part, 'not needed', '--no-envelope (@branch envelope=-)');
  else {
    const T = d.envelope, idx = schemasIndexPath(p);
    let schemas = null;
    try { schemas = existsSync(idx) ? await import(pathToFileURL(idx).href + '?t=' + Date.now()) : null; } catch { schemas = null; }
    const pk = schemas && schemas.PAYLOAD_KINDS && Object.prototype.hasOwnProperty.call(schemas.PAYLOAD_KINDS, T) ? schemas.PAYLOAD_KINDS[T] : null;
    row('envelope type', (p.manifest.envelope_types || []).includes(T) ? 'ok' : 'missing', `"${T}" in helper.json envelope_types`);
    const guard = p.files.find((f) => f.code.includes(`ENVELOPE_TYPES.indexOf('${T}')`));
    if (live((c) => !!c.getEnvelopeHandler(T))) row('envelope handler', 'ok', `"${T}" registered` + (guard ? ` (guarded in gas/${guard.file})` : ''));
    else row('envelope handler', 'missing', `no handler for "${T}"` + (whereIs(p, `registerEnvelopeHandler('${T}'`) !== 'core' ? ' (registered only while helper.json lists the type)' : ''));
    const coreVal = live((c) => Object.keys(c).find((k) => /^tgEnvValidate/.test(k) && typeof c[k] === 'function' && normType(k.slice('tgEnvValidate'.length)) === normType(T)));
    row('core validator', coreVal ? 'ok' : 'missing', coreVal || `no tgEnvValidate${pascal(T)}`);
    const sFile = [`${p.pack}-${kebab(T)}.schema.json`, pk ? `${p.pack}-${pk}.schema.json` : null].filter(Boolean).find((f) => existsSync(join(p.dir, 'schemas', f)));
    let sWhy = sFile ? null : `no schemas/${p.pack}-${kebab(T)}.schema.json`;
    if (sFile) { try { if (JSON.parse(read(join(p.dir, 'schemas', sFile))).additionalProperties !== false) sWhy = `schemas/${sFile} lets unknown keys in`; } catch (e) { sWhy = `schemas/${sFile} is not JSON`; } }
    row('schema', sWhy ? 'missing' : 'ok', sWhy || `schemas/${sFile}`);
    const want = new RegExp(`export function (validate([A-Za-z0-9]+)Payload)\\b`, 'g');
    let packVal = null;
    for (const f of walkMjs(p.dir, ['gas', 'schemas', 'fixtures'])) {
      for (const m of read(f).matchAll(want)) if (!packVal && normType(m[2]) === normType(T)) packVal = { fn: m[1], file: relative(p.dir, f) };
    }
    if (packVal) row('pack validator', 'ok', `${packVal.fn} (${packVal.file})`);
    else if (pk && !decl) row('pack validator', 'ok', `validatePayload('${T}') in schemas/index.mjs (no module of its own)`);   // hand-built only
    else row('pack validator', 'missing', `no validate${pascal(T)}Payload under packs/${p.pack}/`);
    row('envelope tool', pk ? 'ok' : 'missing', pk ? `PAYLOAD_KINDS ${T} → ${pk} (tools/envelope.mjs --pack ${p.pack} checks it)` : `"${T}" is not in schemas/index.mjs PAYLOAD_KINDS, so tools/envelope.mjs --pack refuses it`);
    const testsDir = join(p.root, 'tests'), packWord = packVal ? packVal.fn : 'validatePayload';
    const parity = coreVal && listJs(testsDir).find((f) => { const s = read(join(testsDir, f)); return s.includes(coreVal) && s.includes(packWord); });
    row('parity test', parity ? 'ok' : 'missing', parity ? `tests/${parity}` : `no test names both ${coreVal || 'the core validator'} and ${packWord}`);
  }
  if (d.tab === '-') row('tab', 'not needed', '--no-tab (@branch tab=-)');
  else {
    const m = coreFile && /registerSheet\(\s*([^,]+?)\s*,/.exec(coreFile.code);
    const tab = m ? live((c) => vm.runInContext(m[1], c)) : null;
    const known = tab && live((c) => Object.prototype.hasOwnProperty.call(c.allSheetSchemas(), tab));
    if (!m) row('tab', 'missing', `the core module registers no tab${d.tab ? ` (@branch says ${d.tab})` : ''}`);
    else if (!known) row('tab', 'missing', `registerSheet(${m[1]}, …) does not register a tab`);
    else if (d.tab && tab !== d.tab) row('tab', 'missing', `registers "${tab}"; the @branch line says "${d.tab}"`);
    else row('tab', 'ok', `"${tab}"`);
  }
  if (d.app === '-') row('app ops', 'not needed', '--no-app (@branch app=-)');
  else {
    const ops = live((c) => Object.keys(c.TG_APP_OPS).filter((k) => k.indexOf(name + '.') === 0).sort()) || [];
    row('app ops', ops.length ? 'ok' : 'missing', ops.length ? ops.join(', ') + (app ? ` (gas/${app.file})` : '') : `no TG_APP_OPS['${name}.…']`);
  }
  const complete = rows.every((r) => r.status !== 'missing');
  return { name, pack, marker: decl, rows, complete };
}
/* ==================== command line ==================== */

const VALUE_FLAGS = { pack: 'pack', title: 'title', command: 'command', kind: 'kind', envelope: 'envelope', routine: 'routine', tab: 'tab',
  prefix: 'prefix', 'private-out': 'privateOut', check: 'check' };
const BOOL_FLAGS = { 'no-app': 'noApp', 'no-envelope': 'noEnvelope', 'no-tab': 'noTab', 'dry-run': 'dryRun', force: 'force' };
const USAGE = 'usage: node helpers/tools/new-branch.mjs <name> [--pack tour-guide] [--title "<Title>"] [--command /<cmd>] [--kind <kind>]\n' +
  '         [--envelope <type>] [--routine RESEARCH] [--tab <Tab>] [--no-app] [--no-envelope] [--no-tab] [--prefix NN]\n' +
  '         [--private-out <dir>] [--dry-run] [--force]\n' +
  '       node helpers/tools/new-branch.mjs --check <name> [--pack tour-guide]';

/** argv → options; throws BranchError on an unknown flag, a missing value or a stray argument. */
export function parseArgs(argv) {
  const o = {}, rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { rest.push(a); continue; }
    const k = a.slice(2);
    if (BOOL_FLAGS[k]) o[BOOL_FLAGS[k]] = true;
    else if (VALUE_FLAGS[k]) {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw fail2(`${a} needs a value\n${USAGE}`);
      o[VALUE_FLAGS[k]] = argv[++i];
    } else throw fail2(`unknown option ${a}\n${USAGE}`);
  }
  if (o.check !== undefined) {
    if (rest.length) throw fail2(`--check takes one name\n${USAGE}`);
    const extra = Object.keys(o).filter((k) => k !== 'check' && k !== 'pack');
    if (extra.length) throw fail2(`--check takes only --pack\n${USAGE}`);
  } else {
    if (rest.length !== 1) throw fail2(`one branch name, please\n${USAGE}`);
    o.name = rest[0];
  }
  return o;
}

/** Text of a check result, one row per part. */
export function formatCheck(r) {
  const w = Math.max(...r.rows.map((x) => x.part.length));
  const lines = [`new-branch --check ${r.name} (pack ${r.pack})`];
  for (const x of r.rows) lines.push(`  ${x.status.padEnd(10)}  ${x.part.padEnd(w)}  ${x.detail}`);
  const miss = r.rows.filter((x) => x.status === 'missing').map((x) => x.part);
  lines.push(miss.length ? `incomplete — missing: ${miss.join(', ')}` : 'complete');
  return lines.join('\n');
}

export async function main(argv = process.argv.slice(2), root = HELPERS_ROOT) {
  try {
    const o = parseArgs(argv);
    if (o.check !== undefined) {
      const r = await checkBranch(o.check, { pack: o.pack, root });
      console.log(formatCheck(r));
      return r.complete ? 0 : 1;
    }
    const plan = planBranch(o, root);
    if (plan.clashes.length) {
      console.error(`refused: ${plan.branch.name} clashes with what pack ${plan.branch.pack} already has:`);
      for (const c of plan.clashes) console.error('  - ' + c);
      return 2;
    }
    const show = (w) => (isAbsolute(w.rel) || w.rel.startsWith('..') ? w.path : w.rel);
    if (o.dryRun) {
      console.log(`dry run — ${plan.branch.name} would write (nothing written):`);
      for (const w of plan.writes) console.log(`  ${w.change ? 'change' : 'write '}  ${show(w)}`);
      for (const r of plan.removes) console.log(`  remove  ${relative(root, r)}`);
      for (const n of plan.notes) console.log(`  note: ${n}`);
      return 0;
    }
    await writeBranch(plan);
    console.log(`${plan.branch.name}: wrote`);
    for (const w of plan.writes) console.log(`  ${w.change ? 'changed' : 'wrote  '}  ${show(w)}`);
    for (const r of plan.removes) console.log(`  removed  ${relative(root, r)}`);
    for (const n of plan.notes) console.log(`  note: ${n}`);
    console.log(`next: node helpers/tools/new-branch.mjs --check ${plan.branch.name}` + (plan.branch.pack !== 'tour-guide' ? ` --pack ${plan.branch.pack}` : '') +
      ` · node --test helpers/tests/pack_${plan.branch.pack}_${plan.branch.name}.test.js`);
    return 0;
  } catch (e) {
    if (e instanceof BranchError) { console.error(e.message); return 2; }
    throw e;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(e && e.stack ? e.stack : e); process.exitCode = 1; });
}

// Developed by: LightAISolutions

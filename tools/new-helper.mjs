#!/usr/bin/env node
/**
 * Helpers — scaffold a new helper: a pack under helpers/packs/<name>/ and, with --private-out, the private repo
 * skeleton from helpers/templates/private-repo/ with every {{PLACEHOLDER}} filled in.
 * Usage: node helpers/tools/new-helper.mjs <name> [--display "Tour Guide"] [--drive-root TourGuide] [--prefix TG]
 *          [--routine CHAT] [--memory trips,places] [--types itinerary,alert] [--private-repo Org/Repo]
 *          [--framework-repo Org/Repo] [--private-out DIR] [--force]
 * Prints the files it wrote. Never overwrites an existing pack or a non-empty private-out directory unless --force.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest, CORE_ENVELOPE_TYPES } from './bundle.mjs';

export const HELPERS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATE_DIR = join(HELPERS_ROOT, 'templates', 'private-repo');
export const DEFAULT_FRAMEWORK_REPO = 'LightAISolutions/Personal';
const titleCase = (s) => s.split(/[-_]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const pascal = (s) => titleCase(s).replace(/ /g, '');

/** manifestFor(opts) → a valid helper.json object (throws when the options cannot make one). */
export function manifestFor(o) {
  const m = {
    name: o.name, display_name: o.display || titleCase(o.name), description: o.description || `${titleCase(o.name)} helper pack.`,
    drive_root: o.driveRoot || pascal(o.name), producer: `${o.name}-core`, property_prefix: o.prefix || o.name.replace(/-/g, '_').toUpperCase().slice(0, 16),
    version: '0.1.0', timezone: o.timezone || 'Etc/UTC', inbound_routine: (o.routine || 'CHAT').toUpperCase(),
    envelope_types: o.types || [], action_allowlist: [], memory_dirs: o.memory || [], scopes: []
  };
  if (o.privateRepo) m.private_repo = o.privateRepo;
  const errs = validateManifest(m);
  if (errs.length) throw new Error('cannot build a valid manifest: ' + errs.join('; '));
  return m;
}
export function placeholdersFor(m, frameworkRepo = DEFAULT_FRAMEWORK_REPO) {
  const dirs = (m.memory_dirs || []);
  return {
    HELPER_NAME: m.name, DISPLAY_NAME: m.display_name, DRIVE_ROOT: m.drive_root, PRODUCER: m.producer,
    MEMORY_DIRS: dirs.length ? dirs.map((d) => '`' + d + '/`').join(', ') : '(none — this pack keeps no memory beyond log/ and quarantine/)',
    MEMORY_DIRS_REGEX: dirs.length ? dirs.join('|') : 'quarantine',
    ENVELOPE_TYPES: (m.envelope_types || []).length ? m.envelope_types.map((t) => '`' + t + '`').join(', ') : '(none)',
    FRAMEWORK_REPO: frameworkRepo, PRIVATE_REPO: m.private_repo || `<your-org>/${pascal(m.name)}`
  };
}
export function fill(text, ph) {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (all, k) => (Object.prototype.hasOwnProperty.call(ph, k) ? ph[k] : all));
}
function listFiles(dir, acc = [], base = dir) {
  for (const n of readdirSync(dir).sort()) {
    const abs = join(dir, n);
    if (statSync(abs).isDirectory()) listFiles(abs, acc, base); else acc.push(relative(base, abs));
  }
  return acc;
}
function write(abs, text, written) { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, text); written.push(abs); }

/** scaffoldPack(manifest, {root, force}) → written file paths. */
export function scaffoldPack(m, { root = HELPERS_ROOT, force = false } = {}) {
  const dir = join(root, 'packs', m.name);
  if (existsSync(dir) && !force) throw new Error(`pack exists: ${relative(root, dir)} (use --force to overwrite)`);
  const written = [];
  write(join(dir, 'helper.json'), JSON.stringify(m, null, 2) + '\n', written);
  write(join(dir, 'gas', `${m.name.replace(/-/g, '_')}.js`), `/**
 * ${m.display_name} pack — Apps Script side. Extend the core ONLY through the registries in helpers/core/02_registry.js.
 * Bundle: node helpers/tools/bundle.mjs ${m.name}
 */
registerCommand('/${m.name.replace(/-/g, '_').slice(0, 31)}', function (ctx) { ctx.reply('👋 ' + tgEscape(HELPER.display_name) + ' v' + tgEscape(HELPER.version) + ' is here.'); }, 'say hello');
${(m.envelope_types || []).map((t) => `registerEnvelopeHandler('${t}', {
  validate: function (p) { return typeof p.text === 'string' && p.text.trim() ? [] : ['text required']; },
  handle: function (env) { var r = tgSendOwner(tgEscape(env.payload.text)); return { sent: !!(r && r.ok) }; }
});`).join('\n')}

// Developed by: LightAISolutions
`, written);
  write(join(dir, 'README.md'), `# ${m.name} pack

${m.description}

- Manifest: \`helper.json\` (fields in \`helpers/SPEC.md\` §4)
- Code: \`gas/\` (loads after \`helpers/core/*.js\`; extends the core through the registries only)
- Bundle: \`node helpers/tools/bundle.mjs ${m.name}\`
- Private repo: \`${m.private_repo || '<your-org>/' + pascal(m.name)}\` (skills, memory, vendored framework)

Developed by: LightAISolutions
`, written);
  return written;
}
/** scaffoldPrivateRepo(manifest, outDir, {frameworkRepo, force}) → written file paths (template with placeholders filled). */
export function scaffoldPrivateRepo(m, outDir, { frameworkRepo = DEFAULT_FRAMEWORK_REPO, force = false, templateDir = TEMPLATE_DIR } = {}) {
  if (existsSync(outDir) && readdirSync(outDir).length && !force) throw new Error(`private-out is not empty: ${outDir} (use --force)`);
  const ph = placeholdersFor(m, frameworkRepo);
  const written = [];
  for (const rel of listFiles(templateDir)) {
    const src = readFileSync(join(templateDir, rel));
    const out = /\.(png|jpe?g|gif|pdf|zip)$/i.test(rel) ? src : Buffer.from(fill(src.toString('utf8'), ph));
    write(join(outDir, rel), out, written);
  }
  for (const d of ['log', 'quarantine', ...(m.memory_dirs || [])]) { const k = join(outDir, d, '.gitkeep'); if (!existsSync(k)) write(k, '', written); }
  const left = written.filter((f) => !/\.(png|jpe?g|gif|pdf|zip)$/i.test(f) && /\{\{[A-Z_]+\}\}/.test(readFileSync(f, 'utf8')));
  if (left.length) throw new Error('unfilled placeholders in: ' + left.map((f) => relative(outDir, f)).join(', '));
  return written;
}

function main(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { const k = argv[i].slice(2); if (k === 'force') opt.force = true; else opt[k] = argv[++i]; } else pos.push(argv[i]); }
  const name = pos[0];
  if (!name) { console.error('usage: node helpers/tools/new-helper.mjs <name> [--display D] [--drive-root R] [--prefix P] [--routine CHAT] [--memory a,b] [--types x,y] [--private-repo Org/Repo] [--framework-repo Org/Repo] [--private-out DIR] [--force]'); return 2; }
  const split = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined);
  const m = manifestFor({ name, display: opt.display, driveRoot: opt['drive-root'], prefix: opt.prefix, routine: opt.routine, memory: split(opt.memory), types: split(opt.types), privateRepo: opt['private-repo'], timezone: opt.timezone, description: opt.description });
  const written = scaffoldPack(m, { force: !!opt.force });
  if (opt['private-out']) written.push(...scaffoldPrivateRepo(m, resolve(opt['private-out']), { frameworkRepo: opt['framework-repo'] || DEFAULT_FRAMEWORK_REPO, force: !!opt.force }));
  written.forEach((f) => console.log('wrote ' + relative(process.cwd(), f)));
  console.log(`next: node helpers/tools/bundle.mjs ${name} --check` + (opt['private-out'] ? '' : ' · add --private-out DIR to scaffold the private repo'));
  return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error('new-helper failed: ' + e.message); process.exitCode = 1; }
}

// Developed by: LightAISolutions

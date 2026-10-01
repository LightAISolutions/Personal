#!/usr/bin/env node
/**
 * Brochure kit — CLI and library entry.
 *   node helpers/kits/brochure/index.mjs validate model.json
 *   node helpers/kits/brochure/index.mjs render   model.json out.html        [--page letter|a4]
 *   node helpers/kits/brochure/index.mjs pdf      in.html    out.pdf         [--page letter|a4] [--shots DIR]
 *   node helpers/kits/brochure/index.mjs build    model.json outdir/         [--page …] [--shots] [--name brochure]
 *   node helpers/kits/brochure/index.mjs sample   outdir/                    (the invented fixture, built)
 *   … build|sample … --google [--ledger PATH]   first fetch real Google maps, place photos and route lines through the maps
 *     kit (needs MAPS_STATIC_KEY for maps, a usage ledger via --ledger or MAPS_USAGE_LEDGER); without it: drawn sketches.
 * Exit codes: 0 ok · 1 usage or runtime error · 2 the model failed validation · 3 PDF unavailable (HTML written).
 * Library: import { renderHtml, renderPdf, validate, prepare, pageSpec, pdfAvailable } from '…/index.mjs'.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHtml } from './lib/render.mjs';
import { renderPdf, pdfAvailable, resolvePlaywright, CHROMIUM_PATH } from './lib/pdf.mjs';
import { validate, formatErrors, loadSchema, SCHEMA_PATH } from './lib/validate.mjs';
import { prepare, semanticErrors, ModelError } from './lib/model.mjs';
import { pageSpec, PAGES, DEFAULT_PAGE } from './lib/tokens.mjs';
import { addGoogleImages, DAY_MAP, TRIP_MAP, MAP_STYLES } from './lib/google-images.mjs';

export { addGoogleImages, DAY_MAP, TRIP_MAP, MAP_STYLES };
export { directionsUrl, TRAVELMODE, DIRECTIONS_BASE } from './lib/directions.mjs';
export { renderHtml, renderPdf, pdfAvailable, resolvePlaywright, CHROMIUM_PATH, validate, formatErrors, loadSchema, SCHEMA_PATH, prepare, semanticErrors, ModelError, pageSpec, PAGES, DEFAULT_PAGE };
export const KIT_DIR = dirname(fileURLToPath(import.meta.url));
export const SAMPLE_MODEL = join(KIT_DIR, 'fixtures', 'sample-trip.json');

const USAGE = `usage: node helpers/kits/brochure/index.mjs <validate|render|pdf|build|sample> … [--page letter|a4] [--shots [DIR]] [--name NAME] [--google [--ledger PATH]]`;

function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--page' || a === '--name' || a === '--ledger') opt[a.slice(2)] = argv[++i];
    else if (a === '--google') opt.google = true;
    else if (a === '--shots') opt.shots = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; // options go after the positionals
    else if (a === '--no-fonts') opt.noFonts = true;
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else pos.push(a);
  }
  return { pos, opt };
}
const readModel = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { throw new Error(`cannot read model ${p}: ${e.message}`); } };
const say = (...a) => process.stderr.write(a.join(' ') + '\n');

/** validate → 0 or 2 (errors listed, one per line, JSON-pointer paths). */
function cmdValidate(modelPath) {
  const m = readModel(modelPath);
  const errs = validate(m);
  const all = errs.length ? errs : semanticErrors(m);
  if (all.length) { say(`${modelPath}: ${all.length} problem${all.length === 1 ? '' : 's'}\n` + formatErrors(all)); return 2; }
  say(`${modelPath}: valid (${m.days.length} days, ${Object.keys(m.places).length} places)`);
  return 0;
}
/** --google: a live maps-kit client (dynamic import keeps the renderer free of the maps kit). */
async function withGoogle(m, opt) {
  if (!opt.google) return m;
  const { createMapsClient } = await import('../maps/index.mjs');
  const ledgerPath = opt.ledger || process.env.MAPS_USAGE_LEDGER;
  if (!ledgerPath) throw new Error('--google needs a usage ledger: --ledger PATH or MAPS_USAGE_LEDGER');
  const client = createMapsClient({ ledgerPath });
  if (!client.hasStaticKey()) say('warning: MAPS_STATIC_KEY is not set — maps stay drawn sketches; photos and routes still fetched');
  const r = await addGoogleImages(m, { client, maps: client.hasStaticKey() });
  for (const w of r.warnings) say('warning:', w);
  say(`google: ${r.stats.maps} maps, ${r.stats.photos} photos, ${r.stats.routes} route lines`);
  return r.model;
}
async function doRender(modelPath, opt) {
  const m = await withGoogle(readModel(modelPath), opt);
  const r = renderHtml(m, { page: opt.page, baseDir: dirname(resolve(modelPath)), embedFonts: !opt.noFonts });
  for (const w of r.warnings) say('warning:', w);
  return r;
}
async function cmdRender(modelPath, out, opt) {
  const r = await doRender(modelPath, opt);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, r.html);
  say(`wrote ${out} (${Math.round(r.html.length / 1024)} KB, ${r.model.days.length} days)`);
  return 0;
}
async function doPdf(html, out, opt, shotsDir) {
  const r = await renderPdf(html, out, { page: opt.page, shotsDir });
  for (const w of r.warnings) say('warning:', w);
  say(`wrote ${out} (${r.pages} pages${r.shots.length ? `, ${r.shots.length} PNG` : ''})`);
  return 0;
}
async function cmdPdf(inPath, out, opt) {
  const html = readFileSync(inPath, 'utf8');
  if (!pdfAvailable()) { say('PDF step unavailable:', unavailableReason()); return 3; }
  return doPdf(html, out, opt, typeof opt.shots === 'string' ? opt.shots : '');
}
function unavailableReason() { try { resolvePlaywright(); return `Chromium not found at ${CHROMIUM_PATH}`; } catch (e) { return e.message; } }
async function cmdBuild(modelPath, outDir, opt) {
  const name = opt.name || 'brochure';
  mkdirSync(outDir, { recursive: true });
  const r = await doRender(modelPath, opt);
  const htmlPath = join(outDir, `${name}.html`);
  writeFileSync(htmlPath, r.html);
  say(`wrote ${htmlPath} (${Math.round(r.html.length / 1024)} KB)`);
  if (!pdfAvailable()) { say('PDF step skipped:', unavailableReason()); return 3; }
  return doPdf(r.html, join(outDir, `${name}.pdf`), opt, opt.shots ? (typeof opt.shots === 'string' ? opt.shots : join(outDir, 'shots')) : '');
}
export async function main(argv = process.argv.slice(2)) {
  const { pos, opt } = parseArgs(argv);
  const [cmd, a, b] = pos;
  if (opt.page) pageSpec(opt.page); // throws early on a bad size
  switch (cmd) {
    case 'validate': if (!a) break; return cmdValidate(a);
    case 'render': if (!a || !b) break; return cmdRender(a, b, opt);
    case 'pdf': if (!a || !b) break; return cmdPdf(a, b, opt);
    case 'build': if (!a || !b) break; return cmdBuild(a, b, opt);
    case 'sample': if (!a) break; return cmdBuild(SAMPLE_MODEL, a, { ...opt, name: opt.name || 'sample-brochure', shots: opt.shots ?? true });
    default: break;
  }
  say(USAGE);
  return 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (e) => { say(e instanceof ModelError ? e.message : `error: ${e.message}`); process.exit(e instanceof ModelError ? 2 : 1); });
}

// Developed by: LightAISolutions

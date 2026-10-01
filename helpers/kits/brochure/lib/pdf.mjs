/**
 * Brochure kit — the PDF step. Opens the rendered HTML in the pre-installed Chromium through Playwright, runs
 * the paginator inside the page, prints one PDF page per sheet, and optionally screenshots sheets to PNG.
 * Playwright is resolved from the global install (never `playwright install`, never a download); a missing
 * Playwright or browser is a clear error the caller can turn into "HTML only".
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pageSpec } from './tokens.mjs';
import { paginate } from './paginate.mjs';

export const CHROMIUM_PATH = process.env.BROCHURE_CHROMIUM || '/opt/pw-browsers/chromium';
const GLOBAL_PLAYWRIGHT = ['/opt/node-tools/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright'];

/** The playwright module, from the normal resolution chain or the known global locations; throws a clear Error. */
export function resolvePlaywright() {
  const req = createRequire(import.meta.url);
  const tried = [];
  for (const spec of ['playwright', ...GLOBAL_PLAYWRIGHT]) {
    try { return { playwright: req(spec), from: req.resolve(spec) }; } catch (e) { tried.push(spec); }
  }
  throw new Error(`Playwright is not installed (tried ${tried.join(', ')}). The PDF step needs the global Playwright of the routine image; the HTML brochure still works without it.`);
}
/** True when both Playwright and a Chromium binary are available (tests use this to skip). */
export function pdfAvailable() {
  try { resolvePlaywright(); } catch { return false; }
  return existsSync(CHROMIUM_PATH) || !!process.env.BROCHURE_ALLOW_DEFAULT_CHROMIUM;
}
export async function launch() {
  const { playwright } = resolvePlaywright();
  const opts = { headless: true };
  if (existsSync(CHROMIUM_PATH)) opts.executablePath = CHROMIUM_PATH;
  else if (!process.env.BROCHURE_ALLOW_DEFAULT_CHROMIUM) throw new Error(`Chromium not found at ${CHROMIUM_PATH} (set BROCHURE_CHROMIUM, or BROCHURE_ALLOW_DEFAULT_CHROMIUM=1 to use Playwright's own browser if it is installed — never run \`playwright install\` from a routine).`);
  return playwright.chromium.launch(opts);
}
const pageOfHtml = (html) => (html.match(/<meta name="brochure-page" content="([a-z0-9]+)"/) || [])[1];
const titleOfHtml = (html) => { const m = html.match(/<title>([^<]*)<\/title>/); return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/ — .*$/, '') : ''; };

/**
 * renderPdf(html, outPath, { page, shotsDir, shots }) → { pages, warnings, shots:[paths] }
 * `page` overrides the size the HTML was rendered for (letter | a4); `shotsDir` writes one PNG per sheet
 * (or only the sheet numbers listed in `shots`).
 */
export async function renderPdf(html, outPath, { page = undefined, shotsDir = '', shots = null, scale = 2 } = {}) {
  const spec = pageSpec(page || pageOfHtml(html));
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: Math.round(spec.w * 96), height: Math.round(spec.h * 96) }, deviceScaleFactor: scale });
    const pg = await ctx.newPage();
    await pg.setContent(html, { waitUntil: 'load' });
    if (page && page !== pageOfHtml(html)) {
      await pg.addStyleTag({ content: `:root{--page-w:${spec.w}in;--page-h:${spec.h}in;--inner-w:${spec.innerW.toFixed(4)}in;--inner-h:${spec.innerH.toFixed(4)}in}@page{size:${spec.css}}` });
    }
    await pg.evaluate(() => document.fonts.ready);
    const result = await pg.evaluate(paginate, { title: titleOfHtml(html) });
    await pg.evaluate(() => document.fonts.ready);
    const out = { ...result, shots: [] };
    if (shotsDir) {
      mkdirSync(shotsDir, { recursive: true });
      const sheets = await pg.$$('.sheet');
      for (let i = 0; i < sheets.length; i++) {
        if (shots && !shots.includes(i + 1)) continue;
        const p = join(shotsDir, `page-${String(i + 1).padStart(2, '0')}.png`);
        await sheets[i].screenshot({ path: p });
        out.shots.push(p);
      }
    }
    await pg.emulateMedia({ media: 'print' });
    await pg.pdf({ path: outPath, width: `${spec.w}in`, height: `${spec.h}in`, printBackground: true, preferCSSPageSize: false, margin: { top: 0, right: 0, bottom: 0, left: 0 }, displayHeaderFooter: false });
    return out;
  } finally {
    await browser.close();
  }
}

// Developed by: LightAISolutions

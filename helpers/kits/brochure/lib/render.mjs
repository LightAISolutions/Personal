/**
 * Brochure kit — the renderer. prepare() the model, run the sections, inline fonts, the Google Maps logo and any
 * images, and emit one self-contained HTML document. No <script> ever (asserted here and in the tests); nothing
 * is fetched at render or view time.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepare, usesC11 } from './model.mjs';
import { stylesheet } from './css.mjs';
import { pageSpec } from './tokens.mjs';
import { fontFaceCss } from './fonts.mjs';
import { imageResolver } from './images.mjs';
import { esc, attr } from './escape.mjs';
import { cover } from './sections/cover.mjs';
import { glance } from './sections/glance.mjs';
import { day } from './sections/day.mjs';
import { cards } from './sections/cards.mjs';
import { later } from './sections/later.mjs';
import { practical } from './sections/practical.mjs';
import { attribution } from './sections/attribution.mjs';
import { season } from './sections/season.mjs';

export const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const LOGO = join(ASSET_DIR, 'google-maps-logo.svg');

/** renderHtml(model, { page, baseDir, embedFonts }) → { html, warnings, model } — throws ModelError on bad input. */
export function renderHtml(input, { page = undefined, baseDir = process.cwd(), embedFonts = true } = {}) {
  const m = prepare(input);
  const spec = pageSpec(page);
  const warnings = [];
  const img = imageResolver({ baseDir, warnings });
  const fonts = fontFaceCss({ embed: embedFonts });
  if (embedFonts && fonts.embedded < 4) warnings.push(`fonts: ${fonts.embedded}/4 Charter faces found — system serif fallback in use`);
  const logo = existsSync(LOGO) ? readFileSync(LOGO, 'utf8').replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g, '').trim() : '';
  const ctx = { m, locale: m.locale, img, logo, page: spec, warnings };
  const body = [cover(ctx), glance(ctx), season(ctx), ...m.days.map((d, i) => day(d, i, ctx)), cards(ctx), later(ctx), practical(ctx), attribution(ctx)].filter(Boolean).join('\n');
  const title = `${m.trip.title} — ${m.days.length}-day brochure`;
  const html = `<!doctype html>
<html lang="${attr((m.locale || 'en').split('-')[0])}" data-page="${spec.key}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="tour-guide brochure kit">
<meta name="brochure-page" content="${spec.key}">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
<style>${stylesheet({ page: spec, fontCss: fonts.css, c11: usesC11(m) })}</style>
</head>
<body><main class="doc">
${body}
</main></body>
</html>
`;
  if (/<script/i.test(html)) throw new Error('renderer produced a <script> element — refusing to emit');
  return { html, warnings, model: m };
}

// Developed by: LightAISolutions

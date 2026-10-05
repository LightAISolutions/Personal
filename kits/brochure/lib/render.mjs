/**
 * Brochure kit — the renderer. prepare() the model, run the sections, inline fonts, the Google Maps logo and any
 * images, and emit one self-contained HTML document. No <script> ever (asserted here and in the tests); nothing
 * is fetched at render or view time.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepare, usesC11, usesC12, usesC18, usesC18Brief, isDayBook } from './model.mjs';
import { stylesheet } from './css.mjs';
import { pageSpec } from './tokens.mjs';
import { fontFaceCss } from './fonts.mjs';
import { imageResolver } from './images.mjs';
import { esc, attr } from './escape.mjs';
import { longDate } from './format.mjs';
import { cover, coverDay } from './sections/cover.mjs';
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
  const dayBook = isDayBook(m);
  const body = (dayBook ? dayBookSections(ctx) : [cover(ctx), glance(ctx), season(ctx), ...m.days.map((d, i) => day(d, i, ctx)), cards(ctx), later(ctx), practical(ctx), attribution(ctx)]).filter(Boolean).join('\n');
  const title = dayBook ? `${m.trip.title} — Day book, ${longDate(m.days[0].date, m.locale)}` : `${m.trip.title} — ${m.days.length}-day brochure`;
  const html = `<!doctype html>
<html lang="${attr((m.locale || 'en').split('-')[0])}" data-page="${spec.key}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="tour-guide brochure kit">
<meta name="brochure-page" content="${spec.key}">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
<style>${stylesheet({ page: spec, fontCss: fonts.css, c11: usesC11(m), c12: usesC12(m), c18: usesC18(m), c18b: usesC18Brief(m), c18d: dayBook })}</style>
</head>
<body><main class="doc">
${body}
</main></body>
</html>
`;
  if (/<script/i.test(html)) throw new Error('renderer produced a <script> element — refusing to emit');
  return { html, warnings, model: m };
}
/**
 * Contract C18 wave 3: the Day book — the day's cover, its spread (in its own hue and number), only its place cards, then
 * sources and attribution. The trip-wide sections (glance, season, later, practical) are not in it; a model that carries
 * them anyway renders without them and with a warning.
 */
const TRIP_WIDE = [['season', (m) => Boolean(m.season)], ['later', (m) => m.later.length > 0], ['practical', (m) => m.practical.length > 0]];
function dayBookSections(ctx) {
  const { m } = ctx;
  for (const [k, has] of TRIP_WIDE) if (has(m)) ctx.warnings.push(`day book: ${k} left out (a Day book is the day's cover, the day, its places and the sources)`);
  const d = m.days[0];
  return [coverDay(ctx), day(d, d.index - 1, ctx), cards(ctx), attribution(ctx)];
}

// Developed by: LightAISolutions

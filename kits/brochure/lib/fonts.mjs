/**
 * Brochure kit — the typeface. Bitstream Charter (four faces) converted once from the Type 1 fonts that ship with
 * X11 (`assets/fonts/convert-charter.py`, licence in `assets/fonts/NOTICE-charter.txt`) and embedded at render
 * time as data URIs, so the document never fetches a font and looks the same on every device and in the PDF.
 * If the files are missing (a stripped vendor copy) the stack falls through to the system serifs listed below.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');
export const FACES = [
  ['Charter-Regular.woff2', 400, 'normal'], ['Charter-Italic.woff2', 400, 'italic'],
  ['Charter-Bold.woff2', 700, 'normal'], ['Charter-BoldItalic.woff2', 700, 'italic']
];
/** System fallbacks, in order of resemblance: Apple ships Charter; Windows has Georgia; Linux images have Liberation. */
export const STACK = '"Charter","Bitstream Charter","Iowan Old Style","Palatino Linotype","Book Antiqua",Georgia,"Liberation Serif",serif';

/** @font-face rules with the WOFF2 files inlined; { css, embedded: n } — n = faces found (0 → system stack only). */
export function fontFaceCss({ embed = true, dir = FONT_DIR } = {}) {
  if (!embed) return { css: '', embedded: 0 };
  let css = '', embedded = 0;
  for (const [file, weight, style] of FACES) {
    const p = join(dir, file);
    if (!existsSync(p)) continue;
    const b64 = readFileSync(p).toString('base64');
    css += `@font-face{font-family:"Charter";font-weight:${weight};font-style:${style};font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2")}\n`;
    embedded++;
  }
  return { css, embedded };
}

// Developed by: LightAISolutions

/**
 * Brochure kit — design tokens. One serif family (Charter) at a 1.2 modular scale, a warm near-black ink on white
 * paper, a cream used only as an accent surface, terracotta as the single accent, and a small rotation of day hues
 * for tabs and route lines. Everything downstream reads these as CSS custom properties.
 */
export const COLORS = {
  ink: '#1c1a17', ink2: '#4a4541', muted: '#7a736b', faint: '#b8b0a4', rule: '#e2dbcf', hair: '#ece6da',
  paper: '#ffffff', cream: '#f6f1e7', cream2: '#eee6d6',
  accent: '#b2492f', accentInk: '#7d2f1d', accentSoft: '#f3ddd3',
  sea: '#2e5b6e', seaSoft: '#dce7ec', moss: '#5c6b3b', ochre: '#b58a2a', plum: '#6d3c5a', warn: '#9a6b12', alert: '#9c2f26'
};
/** Day hue rotation (tab colour, route line, numerals). */
export const DAY_HUES = [['#b2492f', '#f3ddd3'], ['#2e5b6e', '#dce7ec'], ['#5c6b3b', '#e3e8d4'], ['#b58a2a', '#f3e8cc'], ['#6d3c5a', '#eadbe4'], ['#3f5f5a', '#d9e6e2'], ['#8a5a2b', '#efe0cf']];
export const dayHue = (i) => DAY_HUES[i % DAY_HUES.length];

/** Modular scale, base 1rem, ratio 1.2 — used as --s-2 … --s9. */
export const SCALE = { '-3': 0.579, '-2': 0.694, '-1': 0.833, 0: 1, 1: 1.2, 2: 1.44, 3: 1.728, 4: 2.074, 5: 2.488, 6: 2.986, 7: 3.583, 8: 4.3, 9: 5.16 };

/** Page geometry per paper size (inches) — the PDF step paginates into sheets of exactly this size. */
export const PAGES = {
  letter: { name: 'Letter', w: 8.5, h: 11, css: 'Letter' },
  a4: { name: 'A4', w: 8.2677, h: 11.6929, css: 'A4' }
};
export const DEFAULT_PAGE = 'letter';
export const MARGINS = { top: 0.62, right: 0.62, bottom: 0.72, left: 0.62 }; // inches; identical on both sizes so layouts transfer
export function pageSpec(name = DEFAULT_PAGE) {
  const p = PAGES[String(name || DEFAULT_PAGE).toLowerCase()];
  if (!p) throw new Error(`unknown page size "${name}" (letter or a4)`);
  return { ...p, key: String(name).toLowerCase(), margins: MARGINS, innerW: p.w - MARGINS.left - MARGINS.right, innerH: p.h - MARGINS.top - MARGINS.bottom };
}

/** `:root{…}` custom properties for a page spec. */
export function tokensCss(page = pageSpec()) {
  const c = Object.entries(COLORS).map(([k, v]) => `--${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';');
  const s = Object.entries(SCALE).map(([k, v]) => `--s${k}:${v}rem`).join(';');
  return `:root{${c};${s};--page-w:${page.w}in;--page-h:${page.h}in;--m-top:${MARGINS.top}in;--m-right:${MARGINS.right}in;--m-bottom:${MARGINS.bottom}in;--m-left:${MARGINS.left}in;--inner-w:${page.innerW.toFixed(4)}in;--inner-h:${page.innerH.toFixed(4)}in}`;
}

// Developed by: LightAISolutions

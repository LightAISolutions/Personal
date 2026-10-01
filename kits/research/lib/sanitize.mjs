// Sanitizer for every string the kit stores from untrusted text (excerpts, titles, snippets, samples).
// Stored text is data: it is shortened, stripped of markup and invisible characters, and never interpreted.

export const EXCERPT_MAX = 1000;
export const TITLE_MAX = 200;
export const SNIPPET_MAX = 300;
export const SAMPLE_MAX = 80;

// Zero-width, word-joiner, BOM, soft hyphen, bidi embedding/override/isolate controls, Unicode tag characters.
export const INVISIBLE_RE = /[\u00AD\u180E\u200B-\u200F\u2060-\u2064\uFEFF\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/gu;
// C0/C1 control characters other than tab and newline.
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

const NAMED = { lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', amp: '&' };

/** Decode numeric entities and a few named ones (one pass, so "&amp;lt;" stays "&lt;"). Bad code points are dropped. */
export function decodeEntities(text) {
  return String(text).replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(lt|gt|quot|apos|nbsp|amp));/g, (_, dec, hex, name) => {
    if (name) return NAMED[name];
    const cp = dec ? Number(dec) : parseInt(hex, 16);
    return cp > 0 && cp <= 0x10FFFF && !(cp >= 0xD800 && cp <= 0xDFFF) ? String.fromCodePoint(cp) : '';
  });
}

/** Drop <script>/<style> blocks, HTML comments and tags; decode entities. */
export function stripMarkup(text) {
  return decodeEntities(String(text)
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?[A-Za-z][^<>]{0,2000}>/g, ' '));
}

/**
 * Clean one untrusted string for storage: NFKC, markup removed, invisible and control characters removed,
 * whitespace collapsed (single newlines kept), trimmed, capped at `max` characters (an ellipsis marks a cut).
 */
export function sanitizeText(text, max = EXCERPT_MAX) {
  if (text === null || text === undefined) return '';
  let s = stripMarkup(String(text).slice(0, 400000)).normalize('NFKC');
  s = s.replace(INVISIBLE_RE, '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(CONTROL_RE, '');
  s = s.replace(/[ \u00A0\u2000-\u200A  \u3000]+/g, ' ').replace(/ *\n[ \n]*/g, '\n').trim();
  if (s.length > max) s = s.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
  return s;
}

/** One-line form (newlines → spaces) for titles, snippets, queries and samples. */
export function sanitizeLine(text, max = TITLE_MAX) {
  return sanitizeText(String(text ?? '').replace(/[\r\n]+/g, ' '), max);
}

// Developed by: LightAISolutions

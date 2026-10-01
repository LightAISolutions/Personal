/**
 * Brochure kit — escaping. Every string in the model is web-sourced or owner-typed text and is treated as data:
 * it passes through esc()/attr() before it reaches the document, URLs pass through safeUrl(), and the renderer never
 * emits a <script> element (tests assert the output contains none).
 */
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
/** Bidi overrides/embeddings/isolates, zero-width and tag characters: a name must not flip or hide the line around it. */
export const DIRECTIONAL_RE = /[\u00AD\u180E\u200B-\u200D\u2060-\u2064\uFEFF\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/gu;

/** Escape text for an HTML or SVG text node. Non-strings are stringified; null/undefined become ''. */
export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(DIRECTIONAL_RE, '').replace(/[&<>"'`]/g, (c) => MAP[c]);
}
/** Escape for a double-quoted attribute value (same table; kept separate for readability at call sites). */
export const attr = esc;

/** Only http(s) and mailto URLs survive; anything else (javascript:, data:, vbscript:, relative paths) → ''. */
export function safeUrl(u) {
  if (typeof u !== 'string') return '';
  const s = u.trim();
  if (!/^(https?:\/\/|mailto:)/i.test(s)) return '';
  if (/[\s<>"'`\\]/.test(s)) return '';
  return s;
}
/** Display form of a URL: scheme and trailing slash dropped, truncated with an ellipsis past `max` chars; '' when the URL is not one safeUrl() accepts (an unsafe URL is not shown even as text). */
export function prettyUrl(u, max = 48) {
  if (!safeUrl(u)) return '';
  const s = String(u || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
/** Collapse whitespace and cap length (web-sourced excerpts can be enormous). */
export function clip(s, max = 600) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}
/** Join rendered fragments, dropping empties. */
export const join = (parts, sep = '') => parts.filter((p) => p !== '' && p !== null && p !== undefined && p !== false).join(sep);
/** Build a class attribute from conditionally present names. */
export const cls = (...names) => names.filter(Boolean).join(' ');

// Developed by: LightAISolutions

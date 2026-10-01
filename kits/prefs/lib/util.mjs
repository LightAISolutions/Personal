/**
 * Prefs kit — small pure helpers: hashing, value normalisation, slugs, text sanitising, token estimate.
 * No clock and no randomness here: every id is a hash of its content so re-runs are byte-identical.
 */
import { createHash } from 'node:crypto';

/** hex(sha256(parts joined by U+0001)) */
export function sha(...parts) { return createHash('sha256').update(parts.map(String).join('\u0001')).digest('hex'); }

const ZERO_WIDTH = new RegExp('[\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
const CONTROL = new RegExp('[\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f]', 'g');
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

/** normValue(' Street  Food ') -> 'street food'; strips diacritics and zero-width chars, lower-cases, collapses spaces. */
export function normValue(v) {
  return String(v == null ? '' : v).normalize('NFKD').replace(DIACRITICS, '').replace(ZERO_WIDTH, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** slug('Street food & bars', 32) -> 'street-food-bars' (ASCII only, never empty). */
export function slug(v, max = 32) {
  const s = normValue(v).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
  return s || 'x';
}

/** One-line, control-free text, capped with an ellipsis. */
export function oneLine(s, max) {
  const t = String(s == null ? '' : s).replace(CONTROL, ' ').replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, Math.max(0, max - 1)).trimEnd() + '…' : t;
}

/**
 * Excerpt sanitiser: strips HTML tags and control / zero-width characters, masks e-mail addresses, digit runs of six or
 * more and separated numbers of nine digits or more (booking references, account and phone numbers never reach memory;
 * a date such as 2026-05-14 survives), collapses to one line, caps length.
 */
export function sanitizeExcerpt(s, max) {
  const t = String(s == null ? '' : s)
    .replace(/<[^>]{0,200}>/g, ' ')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, '[email]')
    .replace(/\+?\d[\d ().-]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[number]' : m))
    .replace(/\d{6,}/g, '[number]');
  return oneLine(t, max);
}

/** Conservative token estimate for the profile size cap: 1 token per 3.5 characters, rounded up. */
export function estimateTokens(text) { return Math.ceil(String(text).length / 3.5); }

/** 'YYYY-MM-DD' from a date or ISO datetime string; null when not a real calendar date. */
export function isoDay(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$)/.exec(String(v == null ? '' : v));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Stable JSON: object keys sorted, two-space indent, trailing newline. */
export function stableJson(v) {
  const sort = (x) => Array.isArray(x) ? x.map(sort) : x && typeof x === 'object'
    ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])])) : x;
  return JSON.stringify(sort(v), null, 2) + '\n';
}

// Developed by: LightAISolutions

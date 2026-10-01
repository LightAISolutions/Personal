/**
 * Gem Funnel — chain detection (proposal §4 stage 2): a display name that repeats CHAIN_REPEAT_MIN times in the pool,
 * or that starts with one of a short, deliberately generic list of global brands. The list is here on its own so it is
 * trivial to change; it names no local business and nothing of the owner's.
 */
import { CHAIN_REPEAT_MIN } from './gems-weights.mjs';

/** A dozen global brands, lower-case, matched as a prefix of the normalized display name. */
export const CHAIN_LIST = Object.freeze([
  'mcdonalds', 'starbucks', 'subway', 'kfc', 'burger king', 'pizza hut',
  'dominos', 'dunkin', 'costa coffee', 'pret a manger', 'hard rock cafe', 'tim hortons'
]);

/** normalizeName("Café Lúmen – Harbour") → 'cafe lumen harbour' (lower-case, no diacritics or punctuation, single spaces). */
export function normalizeName(name) {
  return String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** nameCounts(pool) → Map(normalized name → how many records carry it). */
export function nameCounts(pool) {
  const m = new Map();
  for (const r of pool) { const k = normalizeName(r.name); if (k) m.set(k, (m.get(k) || 0) + 1); }
  return m;
}

/**
 * chainReason(record, counts, chain_list = CHAIN_LIST) → 'repeated' | 'listed' | null
 * `counts` is nameCounts(pool); `chain_list` entries are matched as a prefix of the normalized name (word boundary).
 */
export function chainReason(record, counts, chain_list = CHAIN_LIST) {
  const k = normalizeName(record.name);
  if (!k) return null;
  if ((counts.get(k) || 0) >= CHAIN_REPEAT_MIN) return 'repeated';
  for (const brand of chain_list) {
    const b = normalizeName(brand);
    if (b && (k === b || k.startsWith(b + ' '))) return 'listed';
  }
  return null;
}

// Developed by: LightAISolutions

/**
 * Gem Funnel — the one-sentence "why it's a gem" line (proposal §4 stage 5), ≤ GEM_LINE_MAX characters, built ONLY from
 * numbers and source kinds / counts: rating and count against the category's peers, how many local sources of which kind
 * named it, the rough edges and flags we know. Never from review text or page text — this module has no access to any.
 * Deterministic: the same record and options always give the same string.
 */
import { GEM_LINE_MAX, MASS_TOURISM_TOP_N } from './gems-weights.mjs';
import { mentionCount, isOwnerSeed } from './gems-record.mjs';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const numberWord = (n) => (Number.isInteger(n) && n >= 0 && n <= 10 ? WORDS[n] : String(n));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const plural = (n, one, many) => `${numberWord(n)} ${n === 1 ? one : many}`;
const FRICTION_WORDS = Object.freeze({ 'cash-only': 'cash only', 'no-english-menu': 'no English menu', queues: 'expect a queue', 'no-reservations': 'no reservations', 'standing-room': 'standing room only' });
const FLAG_WORDS = Object.freeze({ unproven: 'new: all its ratings are recent', tourist_oriented: 'reads tourist-oriented', closed_day_conflict: 'closed on a trip day' });

/** gemLineClauses(record, { category_median_count }) → the clauses in order, before joining and trimming. */
export function gemLineClauses(record, { category_median_count } = {}) {
  const parts = [];
  if (record.rating != null && record.rating_count != null) {
    let s = `${Number(record.rating).toFixed(1)} from ${fmt(record.rating_count)} rating${record.rating_count === 1 ? '' : 's'}`;
    if (Number.isFinite(category_median_count) && category_median_count > 0) s += ` where peers typically have ${fmt(category_median_count)}`;
    parts.push(s);
  } else if (record.rating_count != null) parts.push(`${fmt(record.rating_count)} ratings`);
  const named = [];
  const ll = mentionCount(record, 'local-language'), ed = mentionCount(record, 'editorial'), co = mentionCount(record, 'community');
  if (ll) named.push(plural(ll, 'local-language guide', 'local-language guides'));
  if (ed) named.push(plural(ed, 'local editorial list', 'local editorial lists'));
  if (co) named.push(plural(co, 'community thread', 'community threads'));
  if (named.length) parts.push('named by ' + (named.length > 1 ? named.slice(0, -1).join(', ') + ' and ' + named[named.length - 1] : named[0]));
  if (isOwnerSeed(record)) parts.push('one of your own seeds');
  if (record.mass_tourism_rank != null && record.mass_tourism_rank <= MASS_TOURISM_TOP_N) parts.push('on a mass-tourism top-ten list');
  const edges = (record.friction || []).map((f) => FRICTION_WORDS[f]).filter(Boolean);
  if (record.signals?.english_only_menu === true && !edges.includes(FRICTION_WORDS["no-english-menu"])) edges.push('English-only menu');
  parts.push(...edges);
  parts.push(...(record.flags || []).map((f) => FLAG_WORDS[f]).filter(Boolean));
  return parts;
}

/** gemLine(record, { category_median_count?, max = GEM_LINE_MAX }) → one sentence ≤ max chars ('' when there is nothing to say). */
export function gemLine(record, opts = {}) {
  const max = opts.max ?? GEM_LINE_MAX;
  const clauses = gemLineClauses(record, opts);
  let n = clauses.length;
  while (n > 0) {
    const s = clauses.slice(0, n).join('; ') + '.';
    if (s.length <= max) return s;
    n--;
  }
  const first = clauses[0] || '';
  return first ? first.slice(0, Math.max(0, max - 1)) + '…' : '';
}

// Developed by: LightAISolutions

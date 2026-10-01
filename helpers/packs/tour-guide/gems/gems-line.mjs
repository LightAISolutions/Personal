/**
 * Gem Funnel — the one-sentence "why it's a gem" line (proposal §4 stage 5), ≤ GEM_LINE_MAX characters, built ONLY from
 * our own derived words and source kinds / counts: a qualitative rating band and a words-only comparison of the record's
 * reviewer count with its category peers, how many local sources of which kind named it, the rough edges and flags we
 * know. Never from review text or page text — this module has no access to any — and never a Google digit: the line
 * carries no rating value, no rating count and no peer-median number (Maps Platform ToS §3.2.3(b) "No Caching";
 * Service Specific Terms §3 and §14.3 allow only place_id and lat/lng to be kept). R3, Phase 6 terms review.
 * Deterministic: the same record and options always give the same string.
 */
import { GEM_LINE_MAX, MASS_TOURISM_TOP_N } from './gems-weights.mjs';
import { mentionCount, isOwnerSeed } from './gems-record.mjs';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const numberWord = (n) => (Number.isInteger(n) && n >= 0 && n <= 10 ? WORDS[n] : String(n));
const plural = (n, one, many) => `${numberWord(n)} ${n === 1 ? one : many}`;
const FRICTION_WORDS = Object.freeze({ 'cash-only': 'cash only', 'no-english-menu': 'no English menu', queues: 'expect a queue', 'no-reservations': 'no reservations', 'standing-room': 'standing room only' });
/** ratingBand(rating) → our own qualitative band for a Google rating; the digits never leave this function. */
export function ratingBand(rating) {
  if (rating >= 4.7) return 'exceptionally well rated';
  if (rating >= 4.5) return 'very well rated';
  if (rating >= 4.3) return 'well rated';
  if (rating >= 4.0) return 'decently rated';
  return 'modestly rated';
}
/** peerComparison(ratio) → words for rating_count / category_median_count; no number survives. */
export function peerComparison(ratio) {
  if (ratio < 0.25) return 'by a fraction of the reviewers its peers have';
  if (ratio < 0.6) return 'by far fewer reviewers than its peers';
  if (ratio < 0.9) return 'by fewer reviewers than its peers';
  if (ratio <= 1.1) return 'by about as many reviewers as its peers';
  return 'by more reviewers than its peers';
}
const FLAG_WORDS = Object.freeze({ unproven: 'new: all its ratings are recent', tourist_oriented: 'reads tourist-oriented', closed_day_conflict: 'closed on a trip day' });

/** gemLineClauses(record, { category_median_count }) → the clauses in order, before joining and trimming. *  The first clause is words only (R3): a rating band from our own thresholds plus the reviewer-count-vs-peer-median
 *  comparison, never a digit from Google. */
export function gemLineClauses(record, { category_median_count } = {}) {
  const parts = [];
  const rating = Number(record.rating), count = Number(record.rating_count);
  const band = record.rating != null && Number.isFinite(rating) ? ratingBand(rating) : null;
  const peers = record.rating_count != null && Number.isFinite(count) && Number.isFinite(category_median_count) && category_median_count > 0
    ? peerComparison(count / category_median_count) : null;
  if (band && peers) parts.push(`${band} ${peers}`);
  else if (band) parts.push(band);
  else if (peers) parts.push(`rated ${peers}`);
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

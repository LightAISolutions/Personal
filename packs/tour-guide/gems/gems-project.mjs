/**
 * Gem Funnel — the persisted projections (proposal §6 data-model row; WP-3d adds the fields to the schemas).
 * Place gains `gem_score`, `gem`, `obscurity`, `local_mentions[]`, `flags[]`; a Shortlist item gains `gem` and `gem_line`.
 * These are OUR numbers and OUR notes. No Google field (rating, counts, hours, address, website, business status,
 * coordinates, names, types, reviews) is ever emitted here — `assertNoGoogleFields` is the guard and the tests use it.
 */
import { LOCAL_MENTIONS_MAX, LOCAL_MENTION_REF_MAX, LOCAL_MENTION_KINDS, FLAGS, FLAGS_MAX } from './gems-weights.mjs';
import { LANGUAGE_RE } from './gems-record.mjs';
import { gemLine } from './gems-line.mjs';

export const PLACE_FIELDS = Object.freeze(['gem_score', 'gem', 'obscurity', 'local_mentions', 'flags']);
export const SHORTLIST_FIELDS = Object.freeze(['gem', 'gem_line']);
/** Keys that are Google content and must never appear in a persisted projection. */
export const GOOGLE_FIELDS = Object.freeze(['rating', 'rating_count', 'review_count', 'userRatingCount', 'hours', 'regularOpeningHours', 'location', 'lat', 'lng', 'website', 'websiteUri', 'address', 'formattedAddress', 'business_status', 'businessStatus', 'price_level', 'priceLevel', 'name', 'display_name', 'displayName', 'types', 'primary_type', 'primaryType', 'reviews', 'maps_uri', 'googleMapsUri']);

/** assertNoGoogleFields(obj, where) → obj, or throws when any GOOGLE_FIELDS key is present (shallow). */
export function assertNoGoogleFields(obj, where = 'projection') {
  const hit = Object.keys(obj || {}).filter((k) => GOOGLE_FIELDS.includes(k));
  if (hit.length) throw new Error(`gems: ${where} carries Google content (${hit.join(', ')}); only our own scores and notes persist`);
  return obj;
}

/** toPlaceFields(record) → { gem_score, gem, obscurity, local_mentions, flags } for a scored (and optionally flagged) record. */
export function toPlaceFields(record) {
  if (!record || typeof record.gem_score !== 'number') throw new Error('gems: toPlaceFields needs a scored record (run scoreGems first)');
  const out = {
    gem_score: Math.min(100, Math.max(0, Math.round(record.gem_score * 10) / 10)),
    gem: record.gem === true,
    obscurity: Math.min(1, Math.max(0, Number(record.o ?? record.obscurity ?? 0))),
    local_mentions: (record.local_mentions || []).slice(0, LOCAL_MENTIONS_MAX).map((m) => {
      const language = String(m.language);
      if (!LANGUAGE_RE.test(language)) throw new Error(`gems: local mention language ${JSON.stringify(m.language)} is not a BCP-47-like tag`);
      if (!LOCAL_MENTION_KINDS.includes(m.kind)) throw new Error(`gems: local mention kind ${JSON.stringify(m.kind)} is not one of ${LOCAL_MENTION_KINDS.join(', ')}`);
      return { ref: String(m.ref).slice(0, LOCAL_MENTION_REF_MAX), language, kind: m.kind };
    }),
    flags: (record.flags || []).filter((f) => FLAGS.includes(f)).slice(0, FLAGS_MAX)
  };
  return assertNoGoogleFields(out, 'Place projection');
}

/** toShortlistFields(record, { category_median_count? }) → { gem, gem_line } for a shortlist item. */
export function toShortlistFields(record, opts = {}) {
  if (!record || typeof record.gem_score !== 'number') throw new Error('gems: toShortlistFields needs a scored record');
  return assertNoGoogleFields({ gem: record.gem === true, gem_line: gemLine(record, opts) }, 'Shortlist projection');
}

// Developed by: LightAISolutions

/**
 * Gem Funnel — stage 4, evidence flags (proposal §4): unproven · tourist_oriented · closed_day_conflict.
 * Reviews are inputs only (publish times and ratings); the signals behind tourist_oriented are booleans the skill
 * sets after reading the place's own site and the research sources — no page or review text reaches this module.
 */
import { UNPROVEN_REVIEW_WINDOW_DAYS, UNPROVEN_MAX_RATING_COUNT, FLAGS, FLAGS_MAX } from './gems-weights.mjs';
import { mentionCount } from './gems-record.mjs';
import { closedOn, closedDates } from './gems-hours.mjs';

/** Display labels for the flags (our own words, no Google content). */
export const FLAG_LABELS = Object.freeze({ unproven: 'New: only a few, recent ratings', tourist_oriented: 'Reads tourist-oriented', closed_day_conflict: 'Closed on a trip day' });
export const TOURIST_SIGNALS = Object.freeze(['english_only_menu', 'tourist_pricing', 'visitor_wording', 'mass_tourism_listing']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(fromIso, toDate) { return (Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromIso)) / 86400000; }

/** isUnproven(record, today) → every review (≥ 1) published within the window, under UNPROVEN_MAX_RATING_COUNT ratings, no local mention. */
export function isUnproven(record, today) {
  const reviews = record.reviews || [];
  if (!reviews.length) return false;
  if ((record.rating_count ?? 0) >= UNPROVEN_MAX_RATING_COUNT) return false;
  if (mentionCount(record) > 0) return false;
  if (!DATE_RE.test(String(today))) throw new Error('gems: flagEvidence needs today as YYYY-MM-DD when the record carries reviews');
  return reviews.every((r) => { const d = daysBetween(r.publish_time, today); return d >= -1 && d <= UNPROVEN_REVIEW_WINDOW_DAYS; });
}

/** isTouristOriented(record, signals) → English-only menu with tourist pricing, "popular with visitors" wording, or a mass-tourism listing. */
export function isTouristOriented(record, signals = {}) {
  const s = { ...(record.signals || {}), ...(signals || {}) };
  return (s.english_only_menu === true && s.tourist_pricing === true) || s.visitor_wording === true || s.mass_tourism_listing === true || record.mass_tourism_rank != null;
}

/**
 * flagEvidence(record, { trip_dates = [], today, visit_date?, signals? }) → { flags: [...], record }
 * `record` is a copy carrying `flags` and, when unproven, `gem: false` (an unproven place is never shown as a 💎).
 * closed_day_conflict: closed on `visit_date` when given, else closed on at least one trip date.
 */
export function flagEvidence(record, { trip_dates = [], today, visit_date, signals } = {}) {
  if (!record || typeof record !== 'object') throw new Error('gems: flagEvidence needs a record');
  if (!Array.isArray(trip_dates) || !trip_dates.every((d) => DATE_RE.test(String(d)))) throw new Error('gems: trip_dates must be YYYY-MM-DD strings');
  if (visit_date != null && !DATE_RE.test(String(visit_date))) throw new Error('gems: visit_date must be YYYY-MM-DD');
  const flags = [];
  if (isUnproven(record, today)) flags.push('unproven');
  if (isTouristOriented(record, signals)) flags.push('tourist_oriented');
  if (visit_date != null ? closedOn(record.hours, visit_date) : closedDates(record.hours, trip_dates).length > 0) flags.push('closed_day_conflict');
  const out = flags.filter((f) => FLAGS.includes(f)).slice(0, FLAGS_MAX);
  const next = { ...record, flags: out };
  if (out.includes('unproven') && next.gem === true) next.gem = false;
  return { flags: out, record: next };
}

// Developed by: LightAISolutions

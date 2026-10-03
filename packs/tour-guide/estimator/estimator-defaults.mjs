/**
 * Tour Guide estimator — the fixed numbers (plan §5.3, Phase 3 data contract): category defaults in minutes, pace and
 * interest factors, the 5-minute rounding and the calibration bounds.
 */
export const CATEGORY_DEFAULTS = Object.freeze({
  museum: 120, viewpoint: 30, market: 60, hike: 180, park: 60, church: 30, neighbourhood: 90, restaurant: 75, cafe: 30, shop: 45, other: 60
});
export const PACE_FACTORS = Object.freeze({ relaxed: 1.15, normal: 1.0, packed: 0.85 });
export const INTEREST_FACTORS = Object.freeze({ low: 0.8, normal: 1.0, high: 1.25 });
export const CALIBRATION_STEP = 0.1;
export const CALIBRATION_MIN = 0.7;
export const CALIBRATION_MAX = 1.4;
export const MIN_VISIT_MINUTES = 15;
export const MAX_VISIT_MINUTES = 1440;

/**
 * Sessions with a set length (Phase 8, F21 follow-up: a booked tea ceremony was timed as a 95-minute stroll). Read from the
 * place's `activity` words before the category default; pace and interest do not stretch a session. The minutes are
 * typical session lengths (an inference, not a measurement); a booking's own `minutes` always wins.
 */
export const ACTIVITY_DEFAULTS = Object.freeze([
  { kind: 'ceremony', re: /\bceremon(y|ies)\b/i, minutes: 60 },
  { kind: 'class', re: /\b(cooking |craft )?(class|lesson)(es|s)?\b/i, minutes: 150 },
  { kind: 'workshop', re: /\bworkshops?\b/i, minutes: 120 },
  { kind: 'tasting', re: /\btastings?\b/i, minutes: 60 },
  { kind: 'performance', re: /\b(performance|recital|concert)s?\b/i, minutes: 90 }
]);
/** activityDefault('tea ceremony in a machiya') → { kind: 'ceremony', minutes: 60 }; null when no session word is there. */
export function activityDefault(activity) {
  const a = String(activity || '');
  for (const d of ACTIVITY_DEFAULTS) if (d.re.test(a)) return { kind: d.kind, minutes: d.minutes };
  return null;
}
/** categoryDefault('museum') → 120; unknown categories use 'other' (60). */
export function categoryDefault(category) {
  return Object.prototype.hasOwnProperty.call(CATEGORY_DEFAULTS, category) ? CATEGORY_DEFAULTS[category] : CATEGORY_DEFAULTS.other;
}
/** round5(37) → 35; never below 5. */
export const round5 = (x) => Math.max(5, Math.round(x / 5) * 5);
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Developed by: LightAISolutions

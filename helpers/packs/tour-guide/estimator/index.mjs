/**
 * Tour Guide — visit-duration estimator and calibration (plan §5.3).
 *   buildEstimate({ place_id, activity, category, mentions, sources, now }) → VisitEstimate
 *   chooseMinutes({ estimate | range + typical, category, pace, interest, calibration }) → { minutes, min, max, confidence, factors }
 *   categoryDefault(category, country?) → minutes · activityDefault(activity, country?) → { kind, minutes } | null (sessions with a set length)
 *   countryCode('Japan') → 'JP' · COUNTRY_DEFAULTS (per-country overrides, Japan first; Phase 11)
 *   createCalibration() · applyTap(state, { category, tap }) → new state · calibrationFactor(state, category) → number
 */
export { buildEstimate, isoDay } from './estimator-build.mjs';
export { chooseMinutes } from './estimator-minutes.mjs';
export { createCalibration, applyTap, calibrationFactor, factorFor } from './estimator-calibration.mjs';
export { categoryDefault, activityDefault, ACTIVITY_DEFAULTS, CATEGORY_DEFAULTS, PACE_FACTORS, INTEREST_FACTORS, CALIBRATION_MIN, CALIBRATION_MAX, MIN_VISIT_MINUTES,
  COUNTRY_DEFAULTS, countryCode, countryCategoryDefault, countryActivityDefault } from './estimator-defaults.mjs';

// Developed by: LightAISolutions

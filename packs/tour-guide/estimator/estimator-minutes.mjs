/**
 * Tour Guide estimator — chooseMinutes(): the minutes the planner books for a visit.
 *   minutes = round5(base × pace × interest × calibration)
 *   base    = the estimate's chosen_minutes, else typical, else the range midpoint, else the category default
 *   with a range: clamped to [max(15, ½·min), 2·max] (bounds rounded inward to 5); without: at least 15.
 * Returns { minutes, min, max, confidence, factors: { pace, interest, calibration } }; min / max are the range scaled
 * by the same factors and clamped the same way (min = max = minutes when no range is known).
 * A session (Phase 8): `booked` minutes (the booking's own length) are used as they are; with no sourced range or typical,
 * an `activity` with a set length (ceremony, class, workshop, tasting, performance) takes that length — neither is
 * stretched by pace, interest or calibration (factors all 1, `fixed: true`).
 */
import { PACE_FACTORS, INTEREST_FACTORS, MIN_VISIT_MINUTES, MAX_VISIT_MINUTES, categoryDefault, activityDefault, round5, clamp } from './estimator-defaults.mjs';
import { calibrationFactor } from './estimator-calibration.mjs';

const ceil5 = (x) => Math.ceil(x / 5) * 5;
const floor5 = (x) => Math.floor(x / 5) * 5;

function factor(table, key, name) {
  if (!Object.prototype.hasOwnProperty.call(table, key)) throw new TypeError(`estimator: ${name} must be one of ${Object.keys(table).join(', ')} (got "${key}")`);
  return table[key];
}

/**
 * chooseMinutes({ estimate? | range?, typical?, category?, pace = 'normal', interest?, profile?, calibration?, activity?, booked? })
 * interest defaults to profile.interests[category], else 'normal'; calibration is a calibration state or a number.
 */
export function chooseMinutes({ estimate = null, range = null, typical = null, category, pace = 'normal', interest, profile = null, calibration = null, activity = null, booked = null } = {}) {
  const cat = category || (estimate && estimate.category) || 'other';
  const r = (estimate ? estimate.range : range) || null;
  const typ = estimate ? estimate.typical : typical;
  const session = Number.isInteger(booked) && booked > 0 ? booked : !r && !typ ? (activityDefault(activity || (estimate && estimate.activity)) || {}).minutes : null;
  if (session) {
    const minutes = clamp(round5(session), MIN_VISIT_MINUTES, MAX_VISIT_MINUTES);
    return { minutes, min: minutes, max: minutes, confidence: (estimate && estimate.confidence) || 'unverified', factors: { pace: 1, interest: 1, calibration: 1 }, fixed: true };
  }
  const level = interest || (profile && profile.interests && profile.interests[cat]) || 'normal';
  const factors = {
    pace: factor(PACE_FACTORS, pace, 'pace'),
    interest: factor(INTEREST_FACTORS, level, 'interest'),
    calibration: typeof calibration === 'number' ? calibration : calibrationFactor(calibration, cat)
  };
  const f = factors.pace * factors.interest * factors.calibration;
  const base = (estimate && estimate.chosen_minutes) || typ || (r ? (r.min + r.max) / 2 : categoryDefault(cat));
  const confidence = (estimate && estimate.confidence) || 'unverified';
  if (r) {
    const lo = Math.min(ceil5(Math.max(MIN_VISIT_MINUTES, 0.5 * r.min)), MAX_VISIT_MINUTES);
    const hi = Math.max(lo, Math.min(floor5(2 * r.max), MAX_VISIT_MINUTES));
    const fit = (x) => clamp(round5(x), lo, hi);
    return { minutes: fit(base * f), min: fit(r.min * f), max: fit(r.max * f), confidence, factors };
  }
  const minutes = clamp(round5(base * f), MIN_VISIT_MINUTES, MAX_VISIT_MINUTES);
  return { minutes, min: minutes, max: minutes, confidence, factors };
}

// Developed by: LightAISolutions

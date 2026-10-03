/**
 * Tour Guide estimator — calibration from the owner's "longer / shorter / about right" taps, per category.
 * State (kept by the brain): { v: 1, categories: { "<category>": { longer, shorter, about_right, factor } } }.
 * factor = clamp(1 + 0.1 · (longer − shorter), 0.7, 1.4): bounded, and reversible because it depends only on the
 * difference of the counts (a "longer" tap and a "shorter" tap cancel). "about-right" is counted but never moves it.
 * Every function returns a new object (undoTap returns its input when there is nothing to take back); the input state is
 * never mutated.
 */
import { CALIBRATION_STEP, CALIBRATION_MIN, CALIBRATION_MAX, clamp } from './estimator-defaults.mjs';

const CATEGORY_RE = /^[a-z][a-z0-9-]{0,31}$/;
const TAPS = Object.freeze({ longer: 'longer', shorter: 'shorter', 'about-right': 'about_right' });

/** createCalibration() → { v: 1, categories: {} } */
export function createCalibration() { return { v: 1, categories: {} }; }

/** factorFor(longer, shorter) → the bounded factor, rounded to 2 decimals. */
export function factorFor(longer, shorter) {
  return clamp(Math.round((1 + CALIBRATION_STEP * (longer - shorter)) * 100) / 100, CALIBRATION_MIN, CALIBRATION_MAX);
}

/** applyTap(state, { category, tap: 'longer' | 'shorter' | 'about-right' }) → new state. */
export function applyTap(state, { category, tap } = {}) {
  if (!CATEGORY_RE.test(String(category))) throw new TypeError(`estimator: bad category "${category}"`);
  if (!Object.prototype.hasOwnProperty.call(TAPS, tap)) throw new TypeError(`estimator: tap must be longer, shorter or about-right (got "${tap}")`);
  const base = state && state.categories ? state : createCalibration();
  const categories = {};
  for (const [k, r] of Object.entries(base.categories)) categories[k] = { ...r };
  const row = categories[category] || { longer: 0, shorter: 0, about_right: 0, factor: 1 };
  row[TAPS[tap]] += 1;
  row.factor = factorFor(row.longer, row.shorter);
  categories[category] = row;
  return { v: 1, categories };
}

/**
 * undoTap(state, { category, tap }) → new state with one such tap taken back: the inverse of applyTap, so
 * undoTap(applyTap(s, t), t) deep-equals s (a category left with no taps is removed). A tap that was never counted leaves
 * the state as it is — the same object — so `undoTap(s, t) === s` tells the caller nothing was taken back.
 */
export function undoTap(state, { category, tap } = {}) {
  if (!CATEGORY_RE.test(String(category))) throw new TypeError(`estimator: bad category "${category}"`);
  if (!Object.prototype.hasOwnProperty.call(TAPS, tap)) throw new TypeError(`estimator: tap must be longer, shorter or about-right (got "${tap}")`);
  const row = state && state.categories && state.categories[category];
  if (!row || !(row[TAPS[tap]] > 0)) return state;
  const next = { ...row, [TAPS[tap]]: row[TAPS[tap]] - 1 };
  next.factor = factorFor(next.longer, next.shorter);
  const categories = {};   // same key order as before, so a saved state's text changes only where the tap was
  for (const [k, r] of Object.entries(state.categories)) {
    if (k !== category) categories[k] = { ...r };
    else if (next.longer + next.shorter + next.about_right > 0) categories[k] = next;
  }
  return { v: 1, categories };
}

/** calibrationFactor(state, category) → number in [0.7, 1.4]; 1 when the category has no taps (or no state). */
export function calibrationFactor(state, category) {
  const r = state && state.categories && state.categories[category];
  return r ? factorFor(r.longer, r.shorter) : 1;
}

// Developed by: LightAISolutions

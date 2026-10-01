/**
 * Gem Funnel — every tunable number in one place (proposal §4 stages 2–5; §7 decisions 18–22 defaults).
 * Phase 8 tunes these from the owner's ✅ 🔖 ❌ taps; nothing else in gems/ hard-codes a threshold.
 * Each constant is one edit away from changing a default; the tests read them from here, never a literal.
 */

/** Stage 0 defaults (proposal §4, interview): appetite 3, 25 minutes off track, tolerates cash-only and no English menu. */
export const APPETITE_DEFAULT = 3;
export const APPETITE_MIN = 1;
export const APPETITE_MAX = 5;
export const OFF_TRACK_MINUTES_DEFAULT = 25;
/** The rough edges the owner may tolerate (prefs vocabulary `rough_edges`, WP-2f) and the stage-0 default set. */
export const ROUGH_EDGES = Object.freeze(['cash-only', 'no-english-menu', 'queues', 'no-reservations', 'standing-room']);
export const ROUGH_EDGES_DEFAULT = Object.freeze(['cash-only', 'no-english-menu']);

/** Stage 2 — screening. */
export const RATING_FLOOR_DEFAULT = 4.3;
export const RATING_FLOOR_HIGH_APPETITE = 4.5;   // appetite ≥ RATING_FLOOR_APPETITE_FROM
export const RATING_FLOOR_APPETITE_FROM = 4;
export const MIN_RATING_COUNT = 15;              // fewer than this is "too new to trust" …
export const MIN_LOCAL_MENTIONS_TO_WAIVE_COUNT = 2; // … unless this many local mentions vouch for it
export const CHAIN_REPEAT_MIN = 3;               // the same display name this many times in the pool = a chain
/** Straight-line speeds for the off-track estimate, km/h, deliberately conservative (proposal §4 stage 2). */
export const MODE_SPEEDS_KMH = Object.freeze({ WALK: 4.5, TRANSIT: 15, DRIVE: 30 });
export const MODES_DEFAULT = Object.freeze(['TRANSIT', 'WALK']);

/** Stage 3 — quality Q: Bayesian shrinkage `(n·r + m·μ) / (n + m)`, mapped 4.0 → 0 … 4.9 → 1. */
export const QUALITY_PRIOR_WEIGHT_M = 30;
export const QUALITY_MU_DEFAULT = 4.2;
export const QUALITY_MU_MIN_MEMBERS = 20;        // a category needs this many rated members before its own mean is used
export const QUALITY_MAP_LOW = 4.0;
export const QUALITY_MAP_HIGH = 4.9;

/** Stage 3 — obscurity O: 1 − percentile rank of the rating count within the category, bucketed by city size. */
export const OBSCURITY_BANDS = Object.freeze({
  large: Object.freeze({ lo: 40, hi: 400 }),     // counts in [lo, hi] score highest
  small: Object.freeze({ lo: 15, hi: 150 })
});
export const OBSCURITY_ZERO_ABOVE = 2000;        // more ratings than this → O = 0
export const OBSCURITY_BELOW_BAND_FACTOR = 0.85; // under the band (but past screening): obscure yet thin evidence
export const OBSCURITY_PERCENTILE_FLOOR = 0.6;   // inside the band O = factor × (floor + (1 − floor) × (1 − percentile))
export const OBSCURITY_OWNER_SEED = 0.5;         // owner seeds skip the obscurity test by convention
export const CITY_SIZE_DEFAULT = 'large';
export const CITY_LARGE_AGGREGATE_MIN = 300;     // Σ aggregate counts of well-rated places ≥ this → large city
export const CITY_LARGE_POOL_MIN = 150;          // without aggregate counts: a kept pool this big → large city

/** Stage 3 — local-ness L: the point table, clamped 0–1. */
export const LOCALNESS_POINTS = Object.freeze({ 'local-language': 0.5, editorial: 0.3, community: 0.2 });
export const LOCALNESS_LOCAL_LANGUAGE_CAP = 1.0;
export const LOCALNESS_MASS_TOURISM_PENALTY = -0.5;
export const MASS_TOURISM_TOP_N = 10;            // a rank ≤ this on a mass-tourism list earns the penalty

/** Stage 3 — fit F (cheap estimate before the model judges; the skill overrides through fit_estimates). */
export const FIT_DEFAULT = 0.5;
export const FIT_INTEREST = Object.freeze({ high: 0.2, normal: 0, low: -0.2 });
export const FIT_LIKED_TYPE = 0.1;               // per liked type, up to FIT_LIKED_TYPE_CAP
export const FIT_LIKED_TYPE_CAP = 0.2;
export const FIT_PRICE_MATCH = 0.1;
export const FIT_PRICE_OVER = -0.15;             // per price level above the owner's ceiling
export const FIT_OWNER_SEED = 0.1;

/** Stage 3 — practicality P. */
export const PRACTICALITY_UNKNOWN_HOURS = 0.5;
export const PRACTICALITY_FRICTION_PENALTY = 0.25; // per rough edge the owner does not tolerate
export const USABLE_OVERLAP_MINUTES = 30;        // an opening window must overlap the day window by this much

/** Stage 3 — weights and the 💎 rule. */
export const WEIGHTS_BASE = Object.freeze({ F: 0.35, Q: 0.25, O: 0.20, L: 0.15, P: 0.05 });
export const APPETITE_WEIGHT_SHIFT_MAX = 0.10;   // appetite 5 moves this much from Q+F to O+L; appetite 1 the reverse
export const GEM_RULE = Object.freeze({ O: 0.6, L: 0.3, Q: 0.6 });
export const GEM_SCORE_DECIMALS = 1;

/** Stage 4 — evidence flags. */
export const UNPROVEN_REVIEW_WINDOW_DAYS = 60;
export const UNPROVEN_MAX_RATING_COUNT = 50;
export const FLAGS = Object.freeze(['unproven', 'tourist_oriented', 'closed_day_conflict']);
export const FLAGS_MAX = 5;
export const LOCAL_MENTIONS_MAX = 20;
export const LOCAL_MENTION_REF_MAX = 120;
export const LOCAL_MENTION_KINDS = Object.freeze(['editorial', 'community', 'local-language']);

/** Stage 5 — shortlist. */
export const PER_GROUP_DEFAULT = Object.freeze({ activities: 8, food: 6 });
/** 💎 floor by appetite: [activities, food]. */
export const GEM_FLOORS = Object.freeze({ 1: Object.freeze({ activities: 0, food: 0 }), 2: Object.freeze({ activities: 1, food: 1 }), 3: Object.freeze({ activities: 2, food: 2 }), 4: Object.freeze({ activities: 3, food: 2 }), 5: Object.freeze({ activities: 4, food: 3 }) });
export const GEM_LINE_MAX = 200;
export const GEMS_NOT_CHOSEN_LIST = 'Gems not chosen';
export const GEMS_NOT_CHOSEN_CODE = 'not_shown';  // WP-3d adds this to the LaterList `code` enum

/** ratingFloorFor(appetite) → 4.3, or 4.5 at appetite ≥ 4. */
export function ratingFloorFor(appetite = APPETITE_DEFAULT) { return appetite >= RATING_FLOOR_APPETITE_FROM ? RATING_FLOOR_HIGH_APPETITE : RATING_FLOOR_DEFAULT; }

/** weightsFor(appetite) → { F, Q, O, L, P } summing to 1: appetite 5 moves 0.10 from Q and F to O and L, appetite 1 the reverse. */
export function weightsFor(appetite = APPETITE_DEFAULT) {
  const a = clampAppetite(appetite);
  const shift = ((a - APPETITE_DEFAULT) / (APPETITE_MAX - APPETITE_DEFAULT)) * APPETITE_WEIGHT_SHIFT_MAX; // −0.10 … +0.10
  const half = shift / 2;
  return { F: round4(WEIGHTS_BASE.F - half), Q: round4(WEIGHTS_BASE.Q - half), O: round4(WEIGHTS_BASE.O + half), L: round4(WEIGHTS_BASE.L + half), P: WEIGHTS_BASE.P };
}
/** gemFloorFor(appetite) → { activities, food }. */
export function gemFloorFor(appetite = APPETITE_DEFAULT) { return GEM_FLOORS[clampAppetite(appetite)]; }

export function clampAppetite(a) {
  const n = Number.isFinite(a) ? Math.round(a) : APPETITE_DEFAULT;
  return Math.min(APPETITE_MAX, Math.max(APPETITE_MIN, n));
}
const round4 = (x) => Math.round(x * 1e4) / 1e4;

// Developed by: LightAISolutions

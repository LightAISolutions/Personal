/**
 * Tour Guide Scout — the numbers behind the ranking (helpers/decisions/TG-SCOUT.md §4). One place to tune them;
 * scout-rank.mjs reads nothing else.
 */
/** Part weights; they sum to 1. score = round(100 × Σ weight × part). */
export const WEIGHTS = Object.freeze({ topic: 0.35, quality: 0.25, fit: 0.15, local: 0.10, reach: 0.15 });

/** T (on-topic) when the skill gave no `relevance` judgment. */
export const TOPIC = Object.freeze({ name: 0.9, type: 0.6, editorial: 0.5, none: 0.2 });
/** Q: Bayesian prior strength (m), default prior mean (μ when the pool has no rating), and the 0..1 mapping band. */
export const QUALITY = Object.freeze({ m: 30, mu_default: 4.2, floor: 3.8, ceil: 4.8 });
/**
 * Q's prior mean μ per group — fixed, so a 4.5 means the same on every board (TG-PHASE-14 WP-14b change 1; before,
 * μ was the pool's mean rating). Any other group uses QUALITY.mu_default.
 */
export const QUALITY_MU = Object.freeze({ food: 4.2, activities: 4.3 });
/**
 * Points (of 100) taken off the score (change 2): a chain, and a crowd magnet — a place with at least CROWD_MIN_COUNT
 * ratings, the planner's crowd-magnet count (gems CROWD_MAGNET_MIN_COUNT, Phase 11). Never below 0; never a drop.
 */
export const PENALTY = Object.freeze({ chain: 8, crowd: 4 });
export { CROWD_MAGNET_MIN_COUNT as CROWD_MIN_COUNT } from '../gems/gems-weights.mjs';
/** A judgment rescues a new place from the `unproven` screen at this relevance or with veg `verified` (change 3). */
export const RESCUE = Object.freeze({ relevance: 0.7 });
/** F default when the skill gave no `fit` (change 5: 0.3, was 0.5); such a pick carries the `not_judged` label. */
export const FIT_DEFAULT = 0.3;
/** L: per distinct local mention, capped at 1; a chain scores 0. */
export const LOCAL_PER_MENTION = 0.25;
/** R: minutes → reach. ≤ full → 1; linear to mid_value at mid; linear to far_value at far; far_value beyond. */
export const REACH = Object.freeze({ full: 10, mid: 40, mid_value: 0.3, far: 60, far_value: 0.1, unknown: 0.5, closed_some_penalty: 0.3 });

/** Screens (§4), in the order they are applied; each drop carries the first matching reason. */
export const SCREEN = Object.freeze({ low_rating_below: 4.0, low_rating_min_count: 20, unproven_below_count: 5, off_topic_below: 0.3, too_far_minutes: 90 });
export const SCREEN_ORDER = Object.freeze(['duplicate', 'closed', 'closed_on_trip', 'low_rating', 'unproven', 'off_topic', 'diet', 'diet_unproven', 'too_far']);

/** Labels: `far` past this many minutes; `gem` needs ≥ gem_mentions distinct local mentions, Q ≥ gem_quality, ≤ gem_max_count ratings, not a chain. */
export const LABEL = Object.freeze({ far_minutes: 40, gem_mentions: 2, gem_quality: 0.6, gem_max_count: 400 });
export const LABELS = Object.freeze(['gem', 'veg_verified', 'veg_likely', 'booking', 'queue', 'cash_only', 'chain', 'new', 'seen_before', 'far', 'not_judged']);
export const LABELS_MAX = 8;
export const VEG = Object.freeze(['verified', 'likely', 'no', 'unknown']);

/** Shown picks: default and hard cap (the payload allows 20). left_out keeps at most LEFT_OUT_MAX entries. */
export const LIMIT_DEFAULT = 10;
export const LIMIT_MAX = 20;
export const LEFT_OUT_MAX = 20;
/**
 * Compare mode (TG-PHASE-14 WP-14e, item 12): at most COMPARE_MAX places on a board; each screen but `duplicate` and
 * `off_topic` becomes a flag (COMPARE_FLAGS, in SCREEN_ORDER); a place with a HARD_FLAGS flag sorts after every place
 * without one, the other flags only show.
 */
export const COMPARE_MAX = 10;
export const COMPARE_FLAGS = Object.freeze(SCREEN_ORDER.filter((r) => r !== 'duplicate' && r !== 'off_topic'));
export const HARD_FLAGS = Object.freeze(['closed', 'closed_on_trip', 'diet']);
/**
 * Estimated reach (no route matrix row, change 7): the planner's walking minutes (planner-rail walkMinutes) up to this
 * many, else the planner's rail estimate (railEstimate). 20 is the private driver's walking limit (TG-SCOUT §8 Reach).
 */
export const ESTIMATE_WALK_MAX_MINUTES = 20;

// Developed by: LightAISolutions

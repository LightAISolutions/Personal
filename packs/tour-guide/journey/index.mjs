/**
 * Tour Guide journey (Phase 11 wave 2, WP-11e) — whole-journey outlines, day versions and the chosen mix, on top of
 * the C11 planner. Library only; the brain's plan routine drives it. No network call of its own: snapshots, the Maps
 * client (or a fixture) and every other fact come in as input.
 *   outlineDraft({ trip, places, snapshots, season?, profile?, choices?, dinners?, build_id? }) → { payload (1–3 options: one when the trip has one shape), areas, measure, reason? }
 *   checkOutline(outline, trip) → [{ path, message }]
 *   outlineInput(draft, { base, mix? }) → the planner's `outline` input
 *   planVersions(input, { date, count?, cache? }) → { payload (1–3 versions: one when the day has one way to go; a slower day after a busy one), versions, anchors, budget, cache, reason? }
 *   assembleChosen({ input, outline, choices }) → { plan, alternatives, notes }
 *   cachedMaps(maps) → a Maps-kit client that asks each point pair once
 *   checkDayVersions(payload) → [{ path, message }]
 * Design, defaults and limits: helpers/decisions/WP-11e.md.
 */
export { outlineDraft, outlineInput, DRAFT } from './journey-outline.mjs';
export { checkOutline, checkDayVersions } from './journey-check.mjs';
export { planVersions, summarize, PACE } from './journey-versions.mjs';
export { assembleChosen } from './journey-assemble.mjs';
export { cachedMaps } from './journey-cache.mjs';
export { journeyDays, journeyCandidates, staysOf, clusterStay, areaScore, CLUSTER_KM, DAY_TRIP_FACTOR, SCORE } from './journey-areas.mjs';
export { LIMITS, KEYS, clip } from './journey-text.mjs';

// Developed by: LightAISolutions

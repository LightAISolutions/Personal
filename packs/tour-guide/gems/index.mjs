/**
 * Tour Guide — Gem Funnel (`gems/`): the engine half of proposal helpers/decisions/hidden-gems-proposal.md §4, stages 2–5.
 * Library only — pure functions over data the skill already holds; nothing here makes a call, reads a file or keeps state.
 *
 *   import { screen, scoreGems, flagEvidence, gemLine, selectShortlist, gemsNotChosenList, toPlaceFields } from '…/gems/index.mjs';
 *   const { kept, dropped } = screen(pool, { trip_dates, anchors, off_track_minutes, modes, avoid_types, rating_floor, season }); // stage 2
 *   const scored = scoreGems(kept, { appetite, city_size, fit_estimates, profile, trip_dates, day_start, day_end, anchors }); // stage 3
 *   const { flags, record } = flagEvidence(scored[i], { trip_dates, today, signals });                                      // stage 4
 *   const line = gemLine(record, { category_median_count });                                                                 // stage 5
 *   const { groups, not_shown } = selectShortlist(flagged, { appetite, per_group, decided });                               // stage 5
 *   const later = gemsNotChosenList({ trip_id, not_shown, today });   const fields = toPlaceFields(record);
 */
export * from './gems-weights.mjs';
export { CHAIN_LIST, normalizeName, nameCounts, chainReason } from './gems-chains.mjs';
export { haversineKm, straightLineMinutes, minutesToNearestAnchor, isLatLng } from './gems-geo.mjs';
export { hoursKnown, openWindows, closedOn, closedOnAll, closedDates, usableOn, usableDates } from './gems-hours.mjs';
export { STREAMS, BUSINESS_STATUSES, PRICE_LEVELS, CATEGORY_TYPES, FOOD_CATEGORIES, LANGUAGE_RE, LEDGER_REF_RE, normalizeRecord, normalizePool, fromSearchResult, categoryOf, groupOf, slugFor, mentionCount, isOwnerSeed, isLocalFavourite } from './gems-record.mjs';
export { screen, DROP_REASONS, nameWords, nameCore, isFeatureName, partOfParent, crowdMagnetIds } from './gems-screen.mjs';
export { scoreGems, scoringContext, categoryMeans, categoryMedianCounts, muFor, qualityScore, percentileRank, citySizeFor, bucketFactor, obscurityScore, localnessScore, estimateFit, practicalityScore, isGem } from './gems-score.mjs';
export { flagEvidence, isUnproven, isTouristOriented, FLAG_LABELS, TOURIST_SIGNALS } from './gems-flags.mjs';
export { gemLine, gemLineClauses, numberWord } from './gems-line.mjs';
export { selectShortlist, gemsNotChosenList, isDecided, byScore } from './gems-select.mjs';
export { toPlaceFields, toShortlistFields, assertNoGoogleFields, PLACE_FIELDS, SHORTLIST_FIELDS, GOOGLE_FIELDS } from './gems-project.mjs';

// Developed by: LightAISolutions

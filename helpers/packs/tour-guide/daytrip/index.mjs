/**
 * Tour Guide — Day trip (`daytrip/`, TG-PHASE-15 WP-15a): a ranked board of up to 8 day trips from any base.
 * Library only — plain Node ESM, no network, no clock; the private skill's drivers make the calls and pass the results in.
 *
 *   import { parseDaytripText, rankDayTrips, daytripPayload, dayTripOutlineEntry, BRANCH } from '…/packs/tour-guide/daytrip/index.mjs';
 *   const ask = parseDaytripText(request.text, { today });            // { ok, from, max_minutes, date } — the core's parse agrees
 *   const leg = estimateReach(base, town, { fromStations, toStations }); // scout/index.mjs: the one rail estimate → candidate.ride
 *   const ranked = rankDayTrips(candidates, { maxMinutes, date, tripDays });
 *   const payload = daytripPayload({ trip, base: { label }, createdOn: today, maxMinutes, date, ranked });   // then tools/envelope.mjs daytrip …
 *   const entry = dayTripOutlineEntry({ name, center, anchors });       // a kept trip's day for the planner's outline
 */
export { parseDaytripText, resolveDate, underMinutes, MINUTES_MIN, MINUTES_MAX, MINUTES_DEFAULT, FROM_MAX } from './daytrip-text.mjs';
export { reachPart, rankDayTrips, normName, WEIGHTS, SEASON_PART, FOOD_PART, REACH, LABELS, LABELS_MAX, REASONS, LENGTHS, ITEMS_MAX, MORE_MAX, LEFT_MAX } from './daytrip-rank.mjs';
export { validateDaytripPayload, checkDaytrip, dayTripId, daytripPayload, baseSlugOf, googleKeys, GOOGLE_KEYS, ID_RE, SLUG_RE, PAYLOAD_MAX } from './daytrip-payload.mjs';
export { dayTripOutlineEntry, DAYTRIP_RADIUS_KM, ANCHORS_MAX } from './daytrip-outline.mjs';

/** What the branch is wired as (the core module's @branch line says the same). */
export const BRANCH = Object.freeze({ name: 'daytrip', command: '/daytrip', kind: 'daytrip', envelope: 'daytrip', tab: 'DayTrips', routine: 'RESEARCH', discover: true });

// Developed by: LightAISolutions

/**
 * Tour Guide — the trip's season sheet (Contract C11 `trip.season`, WP-11b). Library only: pure functions over data in
 * hand, no call, no file write, no clock. Trip research writes the sheet; the gem screen drops single-bloom gardens out
 * of season; the planner finds evening events near a day's route; the day card, the app and the brochure show the lines.
 *
 *   import { normalizeSeason, eventsOn, bloomOn, outOfSeason } from '…/season/index.mjs';
 *   const { ok, season, errors } = normalizeSeason(raw);      // a valid trip.season, or the errors
 *   eventsOn(season, '2027-11-20', { kinds: ['light_up'] });  // the events running that day, by start time
 *   bloomOn(season, '2027-11-20');                            // 'Autumn leaves at their peak'
 *   outOfSeason(place, { season, dates, lat });               // a rose garden in December → true
 * Defaults (bloom months, the tropics rule) and their sources: helpers/decisions/WP-11b.md.
 */
export { normalizeSeason, seasonSchema } from './season-normalize.mjs';
export { eventsOn, bloomOn, bloomStatusOn, bloomKindOf, usualMonths, forecastSays, outOfSeason, autumnCherry, BLOOM_MONTHS_NORTH, BLOOM_WORDS, TROPICS_LAT, AUTUMN_CHERRY_MONTHS_NORTH, AUTUMN_CHERRY_WORDS } from './season-bloom.mjs';

// Developed by: LightAISolutions

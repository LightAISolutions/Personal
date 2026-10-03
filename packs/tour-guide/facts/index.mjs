/**
 * Tour Guide — place facts (Contract C11 `place.facts`, WP-11b). Library only: pure functions over data in hand, no call,
 * no file write, no clock (`now` is an argument). The research step fills `facts` from each place's own site; the planner
 * reads them for visit lengths, last entry and closing days; the digest builder, the app and the brochure show the lines.
 *
 *   import { normalizeFacts, factsLines, menuLine, factsStale, factsConflict } from '…/facts/index.mjs';
 *   const { ok, facts, errors } = normalizeFacts(raw);                       // a valid place.facts, or the errors
 *   const lines = factsLines(facts, { now: '2027-05-01', diet: 'vegetarian' }); // { facts_line, booking_line, price_line, menu_checked }
 *   factsStale(facts, now);                                                   // { facts, menu, any, facts_age_days, menu_age_days }
 *   factsConflict(facts, googleHours, '2027-05-12');                          // { conflict, items: [{ kind, own, google, text }] }
 * Defaults and their reasons: helpers/decisions/WP-11b.md.
 */
export { normalizeFacts, factsSchema, clean } from './facts-normalize.mjs';
export { factsLines, menuLine, fitLine, duration, visitRange, closedDays, dietWords, LINE_MAX } from './facts-lines.mjs';
export { factsStale, factsConflict, dateOf, FACTS_MAX_AGE_DAYS, MENU_MAX_AGE_DAYS, CLOSE_TOLERANCE_MINUTES } from './facts-check.mjs';

// Developed by: LightAISolutions

/**
 * Tour Guide — What's on (`whatson/`, C15, TG-PHASE-15 WP-15b): the pack side of the branch new-branch.mjs wrote.
 * Library only — plain Node ESM, no network, no clock; the private skill's drivers make the calls and pass the results in.
 *
 *   import { parseWhatsonText, normalizeWhatson, whatsonPayload, toSeasonEvent, mergeChosen } from '…/packs/tour-guide/whatson/index.mjs';
 *   const payload = whatsonPayload({ created_on, place: { label }, trip, from, to, items, sources });   // throws when invalid
 *   // then: node tools/envelope.mjs whatson <skill> payload.json --pack tour-guide
 */
export { validateWhatsonPayload, checkWhatson, compareItems, firstDayIn, daysIn, googleKeys, isRealDate, daysBetween, addDays,
  ID_RE, SLUG_RE, KINDS, CHOOSABLE, LABELS, LEFT_REASONS, CONFIDENCE, LIMITS, PAYLOAD_MAX } from './whatson-check.mjs';
export { parseWhatsonText, monthOf, PLACE_MAX } from './whatson-text.mjs';
export { foldName, eventId, normalizeWhatson, newItems, toSeasonEvent, mergeChosen } from './whatson-events.mjs';
export { whatsonPayload, buildWhatsonPayload, placeSlug } from './whatson-payload.mjs';

/** What the branch is wired as (the core module's @branch line says the same). */
export const BRANCH = Object.freeze({ name: 'whatson', command: '/whatson', kind: 'whatson', envelope: 'whatson', tab: 'WhatsOn', routine: 'RESEARCH', discover: true });

// Developed by: LightAISolutions

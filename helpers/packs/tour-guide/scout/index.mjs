/**
 * Tour Guide — Scout (`scout/`): a ranked "find X in Y" list (helpers/decisions/TG-SCOUT.md §3, §4, §5, §7).
 * Library only — plain Node ESM, no network, no clock; the skill makes the calls and passes the results in.
 *
 *   import { parseScoutText, scoutId, guessGroup, scoutQueries, fromScoutResult, rankScout, scoutPayload,
 *            scoutPlaceFields, renderScoutBoard, renderScoutBoardPdf } from '…/packs/tour-guide/scout/index.mjs';
 *   const { what, where } = parseScoutText('matcha in Kyoto');
 *   const queries = scoutQueries({ what, where, group: guessGroup(what), diet: 'vegetarian' });         // ≤ 3 Text Searches
 *   const pool = results.map((r) => fromScoutResult(r, { query: what, local_mentions: mentions[r.id] }));
 *   const ranked = rankScout(pool, { what, group, diet, anchors, reach, judgments, trip_dates, limit: 10 });
 *   const payload = scoutPayload({ scout_id: scoutId(today, what, taken), query: what, destination, place_label, group,
 *                                  created_on: today, from: 'your hotel', diet, ranked, slugs, areas, categories });
 *   const { place, entry } = scoutPlaceFields(payload.items[0], { query: what, trip, scout_id, on: today, existing });
 *   const { html } = renderScoutBoard({ payload, google, map, anchor, locations, trip_dates, options: { built_on: today } });
 */
export * as WEIGHTS from './scout-weights.mjs';
export { parseScoutText, scoutId, guessGroup, scoutQueries, slugOf, ACTIVITY_WORDS, FOOD_WORDS, CAFE_WORDS, TEXT_MAX } from './scout-text.mjs';
export { fromScoutResult, rankScout, normalizeScoutRecord, screenReason, topicPart, qualityPart, reachValue, reachFor, usualTypes, tokens, whyLine, isVegetarianDiet, ACTIVITY_TYPES } from './scout-rank.mjs';
export { scoutPayload, scoutPlaceFields, assertNoGoogleKeys, queryTag, SCOUT_GOOGLE_KEYS } from './scout-payload.mjs';
export { renderScoutBoard, renderScoutBoardPdf, pdfAvailable, httpsUrl, dataImage, tripHours, openSummary, ratingText, priceText, reachText, LABEL_TEXT, REASON_TEXT, BOARD_CSP, APP_PHOTO_MAX_PX, APP_PHOTO_MAX_CHARS, APP_MAP_MAX_CHARS } from './scout-board.mjs';

// Developed by: LightAISolutions

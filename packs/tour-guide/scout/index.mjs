/**
 * Tour Guide — Scout (`scout/`): a ranked "find X in Y" list (helpers/decisions/TG-SCOUT.md §3, §4, §5, §7).
 * Library only — plain Node ESM, no network, no clock; the skill makes the calls and passes the results in.
 *
 *   import { parseScoutText, scoutId, guessGroup, scoutQueries, fromScoutResult, rankScout, scoutPayload,
 *            scoutPlaceFields, renderScoutBoard, renderScoutBoardPdf } from '…/packs/tour-guide/scout/index.mjs';
 *   const { what, city, area } = parseScoutText('/scout matcha near Old Harbour, Wrenmouth');   // the one grammar (TG-SCOUT §9)
 *   const queries = scoutQueries({ what, where: city, group: guessGroup(what), diet: 'vegetarian' });   // ≤ 3 Text Searches
 *   const pool = results.map((r) => fromScoutResult(r, { query: what, local_mentions: mentions[r.id] }));
 *   const ranked = rankScout(pool, { what, group, diet, diet_rule, anchors, reach, judgments, trip_dates, city_dates, known, limit: 10 });
 *   const payload = scoutPayload({ scout_id: scoutId(today, what, taken), query: what, destination, place_label, group,
 *                                  created_on: today, from: 'your hotel', diet, ranked, slugs, areas, categories, known });
 *   const r = scoutPlaceFields(payload.items[0], { query: what, trip, scout_id, on: today, existing, own_name: ranked.items[0].own_name });
 *   //   r.place === null && r.reason === 'no_own_name' → a new pick without its own name: not written, counted in the log
 *   const leg = estimateReach(from, to, { fromStations, toStations });   // the one leg estimate (TG-PHASE-14 WP-14b change 7)
 *   const { html } = renderScoutBoard({ payload, google, map, anchor, locations, trip_dates, city_dates, options: { built_on: today } });
 */
export * as WEIGHTS from './scout-weights.mjs';
export { parseScoutText, scoutId, guessGroup, scoutQueries, slugOf, isCafeTopic, ACTIVITY_WORDS, FOOD_WORDS, CAFE_WORDS, TEXT_MAX,
  foodKind, DRINK_WORDS, CAFE_SWEET_WORDS, MARKET_WORDS, MEAL_WORDS } from './scout-text.mjs';
export { fromScoutResult, rankScout, normalizeScoutRecord, screenReason, screenFlags, compareQuery, compareCut, topicPart, qualityPart, muFor, reachValue, reachFor, estimateReach, usualTypes, tokens, whyLine, isVegetarianDiet, yourDates, dietRule, googleVegCounts, ownName, ACTIVITY_TYPES,
  vegOf, isVeganDiet, kindLikely, rescued } from './scout-rank.mjs';
export { scoutPayload, scoutPlaceFields, assertNoGoogleKeys, queryTag, SCOUT_GOOGLE_KEYS } from './scout-payload.mjs';
export { renderScoutBoard, renderScoutBoardPdf, pdfAvailable, httpsUrl, dataImage, tripHours, hoursRows, openSummary, ratingText, priceText, reachText, LABEL_TEXT, REASON_TEXT, BOARD_CSP, APP_PHOTO_MAX_PX, APP_PHOTO_MAX_CHARS, APP_MAP_MAX_CHARS } from './scout-board.mjs';

// Developed by: LightAISolutions

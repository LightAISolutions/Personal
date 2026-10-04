/**
 * Tour Guide — Quiet (`quiet/`, TG-PHASE-16 WP-16a, Contract C16): for a crowd magnet the owner wants to see anyway, a
 * board of up to 3 quieter places of the same kind within 30 minutes of it, and the magnet's quietest hours.
 * Library only — plain Node ESM, no network, no clock; the private skill's drivers make the calls and pass the results in.
 *
 *   import { parseQuietText, pickRadius, isBusy, rankQuiet, quietLine, quietPayload, BRANCH } from '…/packs/tour-guide/quiet/index.mjs';
 *   const ask = parseQuietText(request.text, { today });                   // { ok, place, date } — the core's parse agrees
 *   const radius = pickRadius([{ radius: 1000, count: 4 }, { radius: 2000, count: 9 }]);   // QUIET.RADII, nearest first
 *   const reach = estimateReach(magnet.location, place.location);          // scout/index.mjs: candidate.reach
 *   const ranked = rankQuiet(candidates, { magnet: { record, kind }, group, date, cityDates, diet, dietRule, visited });
 *   const payload = quietPayload({ trip, createdOn: today, date, magnet: { name, slug, place_id, kind,
 *     busy: isBusy(record, pool), quiet: quietLine({ hours, always_open, tip }), source }, ranked });   // then tools/envelope.mjs quiet …
 */
export { parseQuietText, PLACE_MAX } from './quiet-text.mjs';
export { QUIET, LABELS, REASONS, QUIETER, MODES, quietRatio, quietPart, quieterWord, isBusy, rankQuiet, quietLine, pickRadius } from './quiet-rank.mjs';
export { validateQuietPayload, checkQuiet, quietId, quietPayload, magnetSlugOf, ID_RE, SLUG_RE, PAYLOAD_MAX } from './quiet-payload.mjs';

/** What the branch is wired as (the core module's @branch line says the same). */
export const BRANCH = Object.freeze({ name: 'quiet', command: '/quiet', kind: 'quiet', envelope: 'quiet', tab: 'Quiet', routine: 'RESEARCH', discover: true });

// Developed by: LightAISolutions

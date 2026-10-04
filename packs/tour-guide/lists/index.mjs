/**
 * Tour Guide — Lists (`lists/`): the owner's Google Maps lists, read from a Takeout "Saved" export (TG-PHASE-14 WP-14d).
 * Library only — plain Node ESM, no network, no clock (the caller passes `today`); the only dependency beyond the repo is
 * node:zlib. The private `lists-sync` skill finds the export in Drive, reads it here, merges, looks the new items up
 * within the Maps budget, applies `acceptResult`, and writes the place files and the index. README.md has the rules.
 *
 *   import { readSavedExport, readSavedExports, parseMapsUrl, mergeLists, acceptResult, destinationFor, listNotesFor } from '…/packs/tour-guide/lists/index.mjs';
 */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** What the branch is wired as (the core module's @branch line says the same). */
export const BRANCH = Object.freeze({ name: 'lists', command: '/lists', kind: 'lists', envelope: null, tab: null, routine: 'RESEARCH' });

export { readSavedExport, readSavedExports, parseCsv, LIMITS } from './lists-read.mjs';
export { parseMapsUrl } from './lists-url.mjs';
export { mergeLists, recordResolution, lookupFor, acceptResult, destinationFor, listNotesFor, listedPlace, applyListTags,
  foldName, namesMatch, metres, slugify, NOTE_MAX, RETRY_DAYS, MATCH_RADIUS_M, NAME_RATIO, DEST_RADIUS_KM } from './lists-merge.mjs';

// Developed by: LightAISolutions

/**
 * Tour Guide — Compare (`compare/`): the pack side of a branch written by helpers/tools/new-branch.mjs.
 * Library only — plain Node ESM, no network, no clock; the private skill's drivers make the calls and pass the results in.
 *
 *   import { BRANCH, SLUG_RE } from '…/packs/tour-guide/compare/index.mjs';
 */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** What the branch is wired as (the core module's @branch line says the same). */
export const BRANCH = Object.freeze({ name: 'compare', command: '/compare', kind: 'compare', envelope: null, tab: null, routine: 'RESEARCH' });

// Developed by: LightAISolutions

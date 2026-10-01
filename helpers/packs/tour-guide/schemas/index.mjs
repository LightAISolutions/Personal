/**
 * Tour Guide — entity schemas (data contract v1) and their validator.
 *   import { validate, listKinds } from '…/packs/tour-guide/schemas/index.mjs';
 *   validate(trip, 'trip') → { ok: true, errors: [] } | { ok: false, errors: [{ path: '/lodging/0/to', message }] }
 * Each kind has one JSON Schema file (tour-guide-<kind>.schema.json) in the draft 2020-12 subset the brochure kit's
 * validator understands (helpers/kits/brochure/lib/validate.mjs — reused, not copied), plus semantic checks
 * (tour-guide-checks.mjs) that run once the schema passes. A Plan's days[], later[] and places[] are validated
 * against their own schemas (the subset has no cross-file $ref) with paths prefixed by their position.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSubset } from '../../../kits/brochure/lib/validate.mjs';
import { checkTrip, checkPlace, checkSnapshot, checkEstimate, checkCalibration, checkLaterList, checkDayPlan, checkPlan } from './tour-guide-checks.mjs';

export const SCHEMA_DIR = dirname(fileURLToPath(import.meta.url));
const KINDS = Object.freeze({
  'trip': checkTrip,
  'place': checkPlace,
  'google-snapshot': checkSnapshot,
  'visit-estimate': checkEstimate,
  'place-note': null,
  'calibration': checkCalibration,
  'day-plan': checkDayPlan,
  'later-list': checkLaterList,
  'plan': checkPlan,
  'profile-excerpt': null
});
/** Parts of a Plan validated against their own kind. */
const PLAN_PARTS = Object.freeze({ days: 'day-plan', later: 'later-list', places: 'place' });
const MAX_ERRORS = 50;
const cache = new Map();

/** listKinds() → ['trip', 'place', 'google-snapshot', …] */
export function listKinds() { return Object.keys(KINDS); }
/** schemaPath('trip') → absolute path of tour-guide-trip.schema.json */
export function schemaPath(kind) { assertKind(kind); return join(SCHEMA_DIR, `tour-guide-${kind}.schema.json`); }
/** loadSchema('trip') → the parsed schema (cached). */
export function loadSchema(kind) {
  if (!cache.has(kind)) cache.set(kind, JSON.parse(readFileSync(schemaPath(kind), 'utf8')));
  return cache.get(kind);
}
function assertKind(kind) {
  if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) throw new Error(`tour-guide schemas: unknown kind "${kind}" (use ${listKinds().join(', ')})`);
}

function errorsFor(entity, kind) {
  const errs = validateSubset(entity, loadSchema(kind));
  if (kind === 'plan' && entity && typeof entity === 'object') {
    for (const [field, part] of Object.entries(PLAN_PARTS)) {
      if (!Array.isArray(entity[field])) continue;
      entity[field].forEach((item, i) => {
        for (const x of errorsFor(item, part)) errs.push({ path: `/${field}/${i}${x.path === '/' ? '' : x.path}`, message: x.message });
      });
    }
  }
  if (!errs.length && KINDS[kind]) errs.push(...KINDS[kind](entity));
  return errs;
}

/** validate(entity, kind) → { ok, errors: [{ path, message }] } (at most 50 errors, JSON-pointer paths). */
export function validate(entity, kind) {
  assertKind(kind);
  const errors = errorsFor(entity, kind).slice(0, MAX_ERRORS);
  return { ok: errors.length === 0, errors };
}
/** assertValid(entity, kind) → entity, or throws an Error listing the problems. */
export function assertValid(entity, kind) {
  const r = validate(entity, kind);
  if (!r.ok) throw Object.assign(new Error(`tour-guide ${kind} is invalid:\n` + formatErrors(r.errors)), { errors: r.errors });
  return entity;
}
export const formatErrors = (errors) => errors.map((x) => `${x.path}: ${x.message}`).join('\n');

export * from './tour-guide-dates.mjs';

// Developed by: LightAISolutions

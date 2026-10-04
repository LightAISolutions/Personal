/**
 * Tour Guide — entity schemas (data contract v1) and their validator.
 *   import { validate, listKinds } from '…/packs/tour-guide/schemas/index.mjs';
 *   validate(trip, 'trip') → { ok: true, errors: [] } | { ok: false, errors: [{ path: '/lodging/0/to', message }] }
 * Each kind has one JSON Schema file (tour-guide-<kind>.schema.json) in the draft 2020-12 subset the brochure kit's
 * validator understands (helpers/kits/brochure/lib/validate.mjs — reused, not copied), plus semantic checks
 * (tour-guide-checks.mjs) that run once the schema passes. Eleven kinds are envelope payloads (PAYLOAD_KINDS, validatePayload). A Plan's days[], later[] and places[] are validated
 * against their own schemas (the subset has no cross-file $ref) with paths prefixed by their position.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSubset } from '../../../kits/brochure/lib/validate.mjs';
import { checkTrip, checkPlace, checkSnapshot, checkEstimate, checkCalibration, checkLaterList, checkDayPlan, checkPlan,
  checkShortlist, checkTripFacts, checkPlanDigest, checkProfileSummary, checkPrefsReview, checkPlacesDigest,
  checkBooking, checkBookings, checkScout, checkOutline, checkDayVersions } from './tour-guide-checks.mjs';
import { checkVegCard } from '../vegcard/vegcard-payload.mjs';   // C14 (TG-PHASE-14 WP-14c): the veg card's own checks

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
  'profile-excerpt': null,
  'booking': (b) => checkBooking(b),
  // Payloads of the pack's envelope types (helper.json envelope_types; PAYLOAD_KINDS maps type → kind).
  'shortlist': checkShortlist,
  'trip-facts': checkTripFacts,
  'plan-digest': checkPlanDigest,
  'profile-summary': checkProfileSummary,
  'prefs-review': checkPrefsReview,
  'places-digest': checkPlacesDigest,
  'bookings': checkBookings,
  'scout': checkScout,
  'outline': checkOutline,
  'day-versions': checkDayVersions,
  'veg-card': checkVegCard
});
/** Envelope type (helper.json envelope_types) → schema kind of its payload. */
export const PAYLOAD_KINDS = Object.freeze({
  prefs_review: 'prefs-review',
  shortlist: 'shortlist',
  trip_facts: 'trip-facts',
  plan_digest: 'plan-digest',
  profile_summary: 'profile-summary',
  places_digest: 'places-digest',
  bookings: 'bookings',
  scout: 'scout',
  outline: 'outline',
  day_versions: 'day-versions',
  veg_card: 'veg-card'
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
/**
 * validatePayload(type, payload) → { ok, kind, errors: [{ path, message }] } for an envelope of one of the pack's types
 * (tools/envelope.mjs --pack tour-guide calls this). A type with no payload schema → ok false, kind null.
 */
export function validatePayload(type, payload) {
  const kind = Object.prototype.hasOwnProperty.call(PAYLOAD_KINDS, type) ? PAYLOAD_KINDS[type] : null;
  if (!kind) return { ok: false, kind: null, errors: [{ path: '/', message: `no payload schema for envelope type "${type}" (known: ${Object.keys(PAYLOAD_KINDS).join(', ')})` }] };
  return { ...validate(payload, kind), kind };
}
export const formatErrors = (errors) => errors.map((x) => `${x.path}: ${x.message}`).join('\n');

export * from './tour-guide-dates.mjs';

// Developed by: LightAISolutions

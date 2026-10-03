/**
 * Tour Guide fixtures — loader. Each fixture is a directory of JSON files named tg-fixture-<name>-<part>.json:
 * trip, places, snapshots (GoogleSnapshot records, lodgings included), estimates (one VisitEstimate per place),
 * notes (PlaceNotes), profile (profile excerpt), calibration (estimator state) and routes (the travel table).
 * Every call returns fresh objects, so a test may mutate what it loaded.
 * Phase 11 (WP-11a): C11_FIXTURE_NAMES are extra fixtures for the Phase 11 planner (moving-day: a slow first morning,
 * a moving day by train with a bag step, a last day ending at a station, a dinner pool, a season sheet, places with
 * facts and a crowd magnet). They load with loadFixture like the others, carry the extra part `dinners`
 * (C11_FIXTURE_PARTS), and are not in listFixtures(), so the suites that walk every fixture are unchanged.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_NAMES = Object.freeze(['transit-city', 'driving-loop', 'hill-town']);
export const FIXTURE_PARTS = Object.freeze(['trip', 'places', 'snapshots', 'estimates', 'notes', 'profile', 'calibration', 'routes']);
export const C11_FIXTURE_NAMES = Object.freeze(['moving-day']);
export const C11_FIXTURE_PARTS = Object.freeze([...FIXTURE_PARTS, 'dinners']);

/** listFixtures() → ['transit-city', 'driving-loop', 'hill-town'] */
export function listFixtures() { return [...FIXTURE_NAMES]; }

/** fixturePath(name, part) → absolute path of that JSON file. */
export function fixturePath(name, part) { return join(FIXTURES_DIR, name, `tg-fixture-${name}-${part}.json`); }

/** loadFixture(name) → { name, trip, places, snapshots, estimates, notes, profile, calibration, routes } (+ dinners for a C11 fixture) */
export function loadFixture(name) {
  const c11 = C11_FIXTURE_NAMES.includes(name);
  if (!FIXTURE_NAMES.includes(name) && !c11) throw new Error(`tour-guide fixtures: unknown fixture "${name}" (use ${[...FIXTURE_NAMES, ...C11_FIXTURE_NAMES].join(', ')})`);
  const out = { name };
  for (const part of c11 ? C11_FIXTURE_PARTS : FIXTURE_PARTS) out[part] = JSON.parse(readFileSync(fixturePath(name, part), 'utf8'));
  return out;
}

// Developed by: LightAISolutions

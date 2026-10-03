/**
 * Tour Guide fixtures — loader. Each fixture is a directory of JSON files named tg-fixture-<name>-<part>.json:
 * trip, places, snapshots (GoogleSnapshot records, lodgings included), estimates (one VisitEstimate per place),
 * notes (PlaceNotes), profile (profile excerpt), calibration (estimator state) and routes (the travel table).
 * Every call returns fresh objects, so a test may mutate what it loaded.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_NAMES = Object.freeze(['transit-city', 'driving-loop', 'hill-town']);
export const FIXTURE_PARTS = Object.freeze(['trip', 'places', 'snapshots', 'estimates', 'notes', 'profile', 'calibration', 'routes']);

/** listFixtures() → ['transit-city', 'driving-loop', 'hill-town'] */
export function listFixtures() { return [...FIXTURE_NAMES]; }

/** fixturePath(name, part) → absolute path of that JSON file. */
export function fixturePath(name, part) { return join(FIXTURES_DIR, name, `tg-fixture-${name}-${part}.json`); }

/** loadFixture(name) → { name, trip, places, snapshots, estimates, notes, profile, calibration, routes } */
export function loadFixture(name) {
  if (!FIXTURE_NAMES.includes(name)) throw new Error(`tour-guide fixtures: unknown fixture "${name}" (use ${FIXTURE_NAMES.join(', ')})`);
  const out = { name };
  for (const part of FIXTURE_PARTS) out[part] = JSON.parse(readFileSync(fixturePath(name, part), 'utf8'));
  return out;
}

// Developed by: LightAISolutions

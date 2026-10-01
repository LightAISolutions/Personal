/**
 * Gem Funnel fixtures — one invented pool with gem evidence for Port Sorrel (the transit-city fixture's invented
 * harbour). Every place, id, ledger ref, review time and coordinate is made up; `carriers` names which place exercises
 * which rule so tests do not hunt by name. loadGemFixture() returns a fresh copy each time.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES = Object.freeze({ 'port-sorrel': 'gems-fixture-port-sorrel.json' });

export function listGemFixtures() { return Object.keys(FIXTURES); }
/** loadGemFixture('port-sorrel') → { v, today, trip, anchors, screen_options, profile, rough_edges, aggregate_counts, carriers, pool } */
export function loadGemFixture(name = 'port-sorrel') {
  if (!FIXTURES[name]) throw new Error(`gems: unknown fixture "${name}" (use ${listGemFixtures().join(', ')})`);
  return JSON.parse(readFileSync(join(DIR, FIXTURES[name]), 'utf8'));
}

// Developed by: LightAISolutions

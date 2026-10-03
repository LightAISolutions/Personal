/**
 * Place facts (Contract C11, `place.facts`) — the normaliser. The research step reads a place's own site and hands over a
 * raw facts object; `normalizeFacts` returns a clean copy that passes the place schema's `facts` block and `checkFacts`,
 * or the errors. Clean-up is mechanical only (trim strings, drop null / undefined values, sort and de-duplicate
 * `closed_weekdays`, lower-case `menu.fits`); every bound and every unknown key is still refused — nothing is clipped.
 * C12: `local_name` (1–80), `address` (1–160) and `access` (≤ 2 of { station 1–60, line? 1–60, exit? 1–20,
 * walk_minutes? 0–60 }, no station and line twice) come from the place schema like every other field.
 */
import { validate as validateSubset } from '../../../kits/brochure/lib/validate.mjs';
import { loadSchema } from '../schemas/index.mjs';
import { checkFacts, checkAccess } from '../schemas/tour-guide-checks.mjs';

/** The place schema's `facts` block as a standalone schema (the subset resolves `$ref` against its own root). */
export function factsSchema() {
  const place = loadSchema('place');
  return { ...place.properties.facts, $defs: place.$defs };
}

/** clean(value) → a copy with strings trimmed and null / undefined members dropped (objects and arrays, recursively). */
export function clean(v) {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined).map(clean);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (x !== null && x !== undefined) out[k] = clean(x);
    return out;
  }
  return v;
}

/**
 * normalizeFacts(raw) → { ok: true, facts, errors: [] } | { ok: false, facts: null, errors: [{ path, message }] }
 * Paths are JSON pointers inside the facts object ('/visit_minutes', '/sources/0/url').
 */
export function normalizeFacts(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, facts: null, errors: [{ path: '/', message: 'facts must be an object' }] };
  const facts = clean(raw);
  if (Array.isArray(facts.closed_weekdays) && facts.closed_weekdays.every(Number.isInteger)) facts.closed_weekdays = [...new Set(facts.closed_weekdays)].sort((a, b) => a - b);
  if (facts.menu && typeof facts.menu.fits === 'string') facts.menu.fits = facts.menu.fits.toLowerCase();
  const errors = validateSubset(facts, factsSchema());
  if (!errors.length) checkFacts(facts, '', errors);
  if (!errors.length && facts.access) checkAccess(facts.access, '/access', errors);   // C12: no station twice
  return errors.length ? { ok: false, facts: null, errors: errors.map((x) => ({ path: x.path || '/', message: x.message })) } : { ok: true, facts, errors: [] };
}

// Developed by: LightAISolutions

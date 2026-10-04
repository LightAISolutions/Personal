/**
 * Tour Guide veg card — the pack's validator of the `veg_card` payload (Contract C14), mirrored by the core's
 * tgEnvValidateVegCard (gas/27_vegcard.js); a parity test keeps the two in step.
 *   checkVegCard(p) → [{ path, message }]  the semantic checks once the schema passes (schemas/index.mjs runs it)
 *   validateVegCardPayload(p) → string[]   schema + semantic checks, as 'path: message' lines ([] when valid)
 * Self-contained (reads the schema file and uses the brochure kit's validator subset) so schemas/index.mjs can import
 * checkVegCard without a cycle.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSubset } from '../../../kits/brochure/lib/validate.mjs';
import { SECTION_IDS, PAYLOAD_MAX } from './vegcard.mjs';

export const VEG_CARD_SCHEMA = Object.freeze(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas', 'tour-guide-veg-card.schema.json'), 'utf8')));

/** The checks a JSON Schema cannot say: section order and uniqueness, local null exactly when lang is null, the size. */
export function checkVegCard(p) {
  const errs = [];
  let last = -1;
  const seen = new Set();
  p.sections.forEach((s, i) => {
    const at = SECTION_IDS.indexOf(s.id);
    if (seen.has(s.id)) errs.push({ path: `/sections/${i}/id`, message: `section "${s.id}" appears twice` });
    else if (at < last) errs.push({ path: `/sections/${i}/id`, message: `section "${s.id}" out of order (intro, avoid, ok, ask, thanks)` });
    seen.add(s.id);
    last = Math.max(last, at);
    s.lines.forEach((l, j) => {
      if (p.lang === null && l.local !== null) errs.push({ path: `/sections/${i}/lines/${j}/local`, message: 'must be null when lang is null' });
      if (p.lang !== null && l.local === null) errs.push({ path: `/sections/${i}/lines/${j}/local`, message: 'must be a string when lang is set' });
    });
  });
  const n = JSON.stringify(p).length;
  if (n >= PAYLOAD_MAX) errs.push({ path: '/', message: `payload is ${n} characters (must stay under ${PAYLOAD_MAX})` });
  return errs;
}

/** validateVegCardPayload(p) → [] when p is a valid veg_card payload, else 'path: message' lines. */
export function validateVegCardPayload(p) {
  const errs = validateSubset(p, VEG_CARD_SCHEMA);
  if (!errs.length) errs.push(...checkVegCard(p));
  return errs.map((e) => `${e.path}: ${e.message}`);
}

// Developed by: LightAISolutions

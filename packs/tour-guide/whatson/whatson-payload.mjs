/**
 * Tour Guide — What's on (C15, WP-15b): the `whatson` envelope payload.
 *   whatsonPayload({ created_on, place, trip?, from, to, items, sources?, left_out?, auto? }) → a valid payload; throws
 *   placeSlug(label) → the place's slug (the board id's tail)
 * The rules live in whatson-check.mjs (validateWhatsonPayload, the core's mirror) and schemas/tour-guide-whatson.schema.json;
 * a built payload passes both. Own data only: no Google field (the validators refuse one anywhere).
 */
import { validateWhatsonPayload, PAYLOAD_MAX, LIMITS, LEFT_REASONS, SLUG_RE, isRealDate } from './whatson-check.mjs';
import { normalizeWhatson, foldName } from './whatson-events.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate as validateSubset } from '../../../kits/brochure/lib/validate.mjs';

export { validateWhatsonPayload, checkWhatson, SLUG_RE, PAYLOAD_MAX } from './whatson-check.mjs';
const clip = (s, max) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };
const URL_RE = /^https:\/\/\S+$/;
/** The schema, read here (not through schemas/index.mjs) so that file can import this branch's modules without a cycle. */
export const WHATSON_SCHEMA = Object.freeze(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas', 'tour-guide-whatson.schema.json'), 'utf8')));

/** placeSlug(label) → lower-case Latin letters, digits and hyphens, ≤ 40 ('place' when the label has none). */
export function placeSlug(label) {
  const s = foldName(label).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s || 'place';
}

/**
 * whatsonPayload(...) → the payload. `items` are the run's raw finds, normalised here (normalizeWhatson); its left-out
 * entries come first, then the given `left_out`, ≤ 20. The id is 'wo-' + created_on's digits + '-' + the place slug.
 * `sources` keep https pages only, once each, ≤ 10. A board that would pass 40 000 characters loses items from its end
 * (counted in `more`) until it fits. Throws listing every problem when the result is still invalid.
 */
export function whatsonPayload(a = {}) {
  if (!isRealDate(a.created_on)) throw new Error('whatson: whatsonPayload needs created_on as a calendar date');
  const label = clip(a.place && a.place.label, LIMITS.LABEL);
  const slug = a.place && SLUG_RE.test(String(a.place.slug ?? '')) ? String(a.place.slug).slice(0, 40).replace(/-+$/, '') : placeSlug(label);
  const n = normalizeWhatson(a.items, { from: a.from, to: a.to });
  const given = (Array.isArray(a.left_out) ? a.left_out : []).filter((l) => l && clip(l.name, LIMITS.NAME) && LEFT_REASONS.includes(l.reason))
    .map((l) => ({ name: clip(l.name, LIMITS.NAME), reason: l.reason }));
  const seen = new Set();
  const sources = (Array.isArray(a.sources) ? a.sources : []).filter((s) => s && URL_RE.test(String(s.url ?? '')) && String(s.url).length <= LIMITS.URL && clip(s.title, LIMITS.TITLE))
    .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, LIMITS.SOURCES)
    .map((s) => ({ title: clip(s.title, LIMITS.TITLE), url: s.url }));
  const p = { v: 1, id: 'wo-' + a.created_on.replace(/-/g, '') + '-' + slug, trip: a.trip || null, place: { label, slug }, from: a.from, to: a.to, created_on: a.created_on };
  if (a.auto === true) p.auto = true;
  p.items = n.items;
  let more = n.more;
  p.sources = sources;
  p.left_out = n.left_out.concat(given).slice(0, LIMITS.LEFT_OUT);
  const fit = () => { if (more > 0) p.more = Math.min(LIMITS.MORE, more); else delete p.more; return JSON.stringify(p).length <= PAYLOAD_MAX; };
  while (!fit() && p.items.length) { p.items = p.items.slice(0, -1); more += 1; }
  const errs = validateWhatsonPayload(p);
  const s = validateSubset(p, WHATSON_SCHEMA).map((e) => e.path + ': ' + e.message);
  if (errs.length || s.length) throw Object.assign(new Error('whatson payload is invalid: ' + errs.concat(s).join('; ')), { errors: errs.concat(s) });
  return p;
}
/** The name the generated branch used (helpers/tools/new-branch.mjs). */
export const buildWhatsonPayload = whatsonPayload;

// Developed by: LightAISolutions

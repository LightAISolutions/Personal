/**
 * The season sheet (Contract C11, `trip.season`) — the normaliser. Trip research hands over a raw sheet (typical weather,
 * the leaf or blossom forecast, the season's events); `normalizeSeason` returns a clean copy that passes the trip
 * schema's `season` block and `checkSeason`, or the errors. Clean-up is mechanical only (trim strings, drop null /
 * undefined values, lower-case enum words); every bound and every unknown key is still refused.
 */
import { validate as validateSubset } from '../../../kits/brochure/lib/validate.mjs';
import { loadSchema } from '../schemas/index.mjs';
import { checkSeason } from '../schemas/tour-guide-checks.mjs';
import { clean } from '../facts/facts-normalize.mjs';

/** The trip schema's `season` block as a standalone schema. */
export function seasonSchema() {
  const trip = loadSchema('trip');
  return { ...trip.$defs.season, $defs: trip.$defs };
}

const lower = (o, k) => { if (o && typeof o[k] === 'string') o[k] = o[k].toLowerCase(); };

/** normalizeSeason(raw) → { ok: true, season, errors: [] } | { ok: false, season: null, errors: [{ path, message }] } */
export function normalizeSeason(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, season: null, errors: [{ path: '/', message: 'season must be an object' }] };
  const season = clean(raw);
  for (const b of Array.isArray(season.bloom) ? season.bloom : []) { lower(b, 'kind'); lower(b, 'status'); }
  for (const ev of Array.isArray(season.events) ? season.events : []) lower(ev, 'kind');
  const errors = validateSubset(season, seasonSchema());
  if (!errors.length) checkSeason(season, '', errors);
  return errors.length ? { ok: false, season: null, errors: errors.map((x) => ({ path: x.path || '/', message: x.message })) } : { ok: true, season, errors: [] };
}

// Developed by: LightAISolutions

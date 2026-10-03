/**
 * Tour Guide estimator — buildEstimate(): duration mentions read in sources → a VisitEstimate, on top of the research
 * kit's durationRange() (median range, typical value, outlier and injection filtering, confidence label).
 * chosen_minutes = typical, else the range midpoint (rounded to 5), else a session's set length (activityDefault: ceremony,
 * class, workshop, tasting, performance), else the category default. Pace, interest and
 * calibration are NOT applied here (chooseMinutes() does that at plan time), so the estimate stays a research fact.
 */
import { durationRange } from '../../../kits/research/index.mjs';
import { categoryDefault, activityDefault, round5 } from './estimator-defaults.mjs';

const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
const CATEGORY_RE = /^[a-z][a-z0-9-]{0,31}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/\S+$/;

/** isoDay(now) → 'YYYY-MM-DD' (a date string is taken as is; anything else through Date, in UTC). */
export function isoDay(now = new Date()) {
  if (typeof now === 'string' && DATE_RE.test(now)) return now;
  const d = new Date(now);
  if (Number.isNaN(d.getTime())) throw new TypeError('estimator: bad `now`');
  return d.toISOString().slice(0, 10);
}

function cleanSource(s, i) {
  if (!s || !URL_RE.test(String(s.url || ''))) throw new TypeError(`estimator: sources[${i}].url must be an http(s) URL`);
  if (!DATE_RE.test(String(s.accessed || ''))) throw new TypeError(`estimator: sources[${i}].accessed must be YYYY-MM-DD`);
  const out = { url: String(s.url), accessed: s.accessed };
  if (s.title) out.title = String(s.title).slice(0, 200);
  if (s.ref) out.ref = String(s.ref).slice(0, 40);
  return out;
}

/**
 * buildEstimate({ place_id, activity, category, mentions: [{ min, max, ref, source_key, injection_suspect? }], sources, now })
 * → VisitEstimate. A source whose `ref` is cited only by injection-suspect mentions is not kept as a citation.
 */
export function buildEstimate({ place_id, activity, category, mentions = [], sources = [], now = new Date() } = {}) {
  if (!PLACE_ID_RE.test(String(place_id || ''))) throw new TypeError('estimator: place_id must be a Google place id');
  if (!activity || typeof activity !== 'string') throw new TypeError('estimator: activity is required');
  if (!CATEGORY_RE.test(String(category || ''))) throw new TypeError('estimator: category must be a lowercase slug');
  const r = durationRange(mentions);
  const flagged = new Set(r.dropped.filter((d) => d.why === 'injection_suspect').map((d) => d.ref));
  const used = new Set(r.used);
  const cited = sources.map(cleanSource).filter((s) => !s.ref || used.has(s.ref) || !flagged.has(s.ref));
  const typical = r.typical ?? null;
  const range = r.range ? { min: r.range.min, max: r.range.max } : null;
  const chosen = typical ?? (range ? round5((range.min + range.max) / 2) : (activityDefault(activity) || {}).minutes || categoryDefault(category));
  return {
    v: 1, place_id, activity, category, range, typical, chosen_minutes: chosen, sources: cited,
    confidence: r.label, calibration: null, estimated_on: isoDay(now)
  };
}

// Developed by: LightAISolutions

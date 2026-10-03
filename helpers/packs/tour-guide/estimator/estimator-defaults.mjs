/**
 * Tour Guide estimator — the fixed numbers (plan §5.3, Phase 3 data contract): category defaults in minutes, pace and
 * interest factors, the 5-minute rounding and the calibration bounds.
 */
export const CATEGORY_DEFAULTS = Object.freeze({
  museum: 120, viewpoint: 30, market: 60, hike: 180, park: 60, church: 30, neighbourhood: 90, restaurant: 75, cafe: 30, shop: 45, other: 60,
  // Phase 10 (WP-10b, fix (b)): temples and shrines were timed as 30-minute churches or 90-minute neighbourhoods, gardens as
  // parks and set-length sessions as strolls. Typical visit lengths, an inference recorded in helpers/decisions/WP-10b.md.
  temple: 45, shrine: 30, garden: 60, experience: 90
});
export const PACE_FACTORS = Object.freeze({ relaxed: 1.15, normal: 1.0, packed: 0.85 });
export const INTEREST_FACTORS = Object.freeze({ low: 0.8, normal: 1.0, high: 1.25 });
export const CALIBRATION_STEP = 0.1;
export const CALIBRATION_MIN = 0.7;
export const CALIBRATION_MAX = 1.4;
export const MIN_VISIT_MINUTES = 15;
export const MAX_VISIT_MINUTES = 1440;

/**
 * Sessions with a set length (Phase 8, F21 follow-up: a booked tea ceremony was timed as a 95-minute stroll). Read from the
 * place's `activity` words before the category default; pace and interest do not stretch a session. The minutes are
 * typical session lengths (an inference, not a measurement); a booking's own `minutes` always wins.
 */
export const ACTIVITY_DEFAULTS = Object.freeze([
  { kind: 'ceremony', re: /\bceremon(y|ies)\b/i, minutes: 60 },
  { kind: 'class', re: /\b(cooking |craft )?(class|lesson)(es|s)?\b/i, minutes: 150 },
  { kind: 'workshop', re: /\bworkshops?\b/i, minutes: 120 },
  { kind: 'tasting', re: /\btastings?\b/i, minutes: 60 },
  { kind: 'performance', re: /\b(performance|recital|concert)s?\b/i, minutes: 90 }
]);
/** activityDefault('tea ceremony in a machiya') → { kind: 'ceremony', minutes: 60 }; null when no session word is there. A country's own sessions are checked first. */
export function activityDefault(activity, country = null) {
  const c = country ? countryActivityDefault(activity, country) : null;
  if (c) return c;
  const a = String(activity || '');
  for (const d of ACTIVITY_DEFAULTS) if (d.re.test(a)) return { kind: d.kind, minutes: d.minutes };
  return null;
}
/**
 * Country-aware defaults (Phase 11, WP-11a; Contract C11 suggestion 4). Keyed by an ISO 3166-1 alpha-2 code that
 * countryCode() reads from the trip's free-text `country`. A country entry overrides category defaults and adds sessions
 * with a set length that are checked before the generic ACTIVITY_DEFAULTS. Japan first; every number and its source is in
 * helpers/decisions/WP-11a.md. Outside these countries nothing changes.
 */
export const COUNTRY_DEFAULTS = Object.freeze({
  JP: Object.freeze({
    categories: Object.freeze({ temple: 60, shrine: 40, garden: 75 }),
    activities: Object.freeze([
      { kind: 'tea_ceremony', re: /\btea\b[^.]*\bceremon(y|ies)\b|\bchanoyu\b|\bsad[oō]\b/i, minutes: 45 },
      { kind: 'course_meal', re: /\bkaiseki\b|\bomakase\b|\bsh[oō]jin(?:[- ]ry[oō]ri)?\b|\bcourse (?:meal|dinner|lunch)\b|\btasting menu\b|\bmulti-course\b/i, minutes: 120 }
    ])
  })
});
const COUNTRY_NAMES = Object.freeze({ jp: 'JP', jpn: 'JP', japan: 'JP', nippon: 'JP', nihon: 'JP', '日本': 'JP' });
/** countryCode('Japan') → 'JP'; a two-letter code is taken as is; anything unknown → null. */
export function countryCode(country) {
  const s = String(country || '').trim();
  if (!s) return null;
  const k = s.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(COUNTRY_NAMES, k)) return COUNTRY_NAMES[k];
  return /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : null;
}
const countryEntry = (country) => { const c = countryCode(country); return c && Object.prototype.hasOwnProperty.call(COUNTRY_DEFAULTS, c) ? COUNTRY_DEFAULTS[c] : null; };
/** countryCategoryDefault('temple', 'Japan') → 60; null when the country has no override for that category. */
export function countryCategoryDefault(category, country) {
  const e = countryEntry(country);
  return e && Object.prototype.hasOwnProperty.call(e.categories, category) ? e.categories[category] : null;
}
/** countryActivityDefault('tea ceremony', 'Japan') → { kind: 'tea_ceremony', minutes: 45 }; null when none applies. */
export function countryActivityDefault(activity, country) {
  const e = countryEntry(country);
  if (!e) return null;
  const a = String(activity || '');
  for (const d of e.activities) if (d.re.test(a)) return { kind: d.kind, minutes: d.minutes };
  return null;
}
/** categoryDefault('museum') → 120; unknown categories use 'other' (60). With a country, its override wins. */
export function categoryDefault(category, country = null) {
  const c = country ? countryCategoryDefault(category, country) : null;
  if (c !== null) return c;
  return Object.prototype.hasOwnProperty.call(CATEGORY_DEFAULTS, category) ? CATEGORY_DEFAULTS[category] : CATEGORY_DEFAULTS.other;
}
/** round5(37) → 35; never below 5. */
export const round5 = (x) => Math.max(5, Math.round(x / 5) * 5);
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Developed by: LightAISolutions

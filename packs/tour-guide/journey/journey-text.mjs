/**
 * Tour Guide journey — plain-words helpers and the payload bounds (TG-PHASE-11.md, wave 2: the `outline` and
 * `day_versions` payloads). Every string the journey module emits passes through clip() with its bound.
 */
export const LIMITS = Object.freeze({
  TITLE: 80, GAINS: 200, GIVES_UP: 200, AREA: 60, NAME: 120, NOTE: 120, NOTES: 300, SUMMARY: 160, PICK_NAME: 40,
  WARNING: 160, BOOKING: 120, ANCHORS: 3, STOPS: 12, BOOKINGS: 5, LEAVES_OUT: 10, WARNINGS: 5, OPTIONS_MIN: 2, OPTIONS_MAX: 3,
  VERSIONS_MIN: 1,  // a day with only one way to go is sent as one version, so every requested date gets its envelope
  OUTLINES_MIN: 1   // a trip with only one shape that really differs is sent as one outline, which the core takes as it is
});
export const KEYS = Object.freeze(['A', 'B', 'C']);

/** One line, at most `n` characters; a cut line ends with "…". */
export function clip(s, n) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).replace(/[\s,;:·–-]+$/, '') + '…';
}
/** ['a'] → 'a'; ['a', 'b'] → 'a and b'; ['a', 'b', 'c'] → 'a, b and c'. */
export function joinWords(xs) {
  const a = xs.filter(Boolean);
  if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
/** Capitalise the first letter. */
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** "1 stop", "3 stops". */
export const count = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
/** Minutes as words: 45 → "45 min", 130 → "2 h 10 min". */
export function minutesText(m) {
  const n = Math.max(0, Math.round(m || 0));
  if (n < 60) return `${n} min`;
  return n % 60 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n / 60} h`;
}

// Developed by: LightAISolutions

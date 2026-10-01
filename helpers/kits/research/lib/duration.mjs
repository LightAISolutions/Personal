// Visit-duration support (plan §5.3): duration mentions extracted from sources → a min/max range, a typical value
// and a confidence label. The Phase 3 estimator builds on this (pace and interest adjustments live there, not here).

export const DURATION_MAX_MIN = 1440;     // a mention above 24 h is not a visit duration
export const OUTLIER_FACTOR = 3;          // with ≥3 mentions, a midpoint >3× or <⅓ of the median midpoint is dropped
export const CONFLICT_RATIO = 2;          // largest / smallest kept midpoint above this → "conflicting"

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round5 = (x) => Math.max(5, Math.round(x / 5) * 5);

/** Parse "90", "60-120" or "60–120" (minutes) into { min, max }; null when unusable. */
export function parseMinutes(spec) {
  const m = /^\s*(\d{1,4})\s*(?:[-–]\s*(\d{1,4}))?\s*$/.exec(String(spec));
  if (!m) return null;
  const a = Number(m[1]); const b = m[2] === undefined ? a : Number(m[2]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/**
 * mentions: [{ min, max, source_key, ref?, injection_suspect? }] — minutes, and the publisher key of the source
 * (mentions sharing a key are one source for independence). Returns
 * { range: {min, max} | null, typical: minutes | null, label, independent_sources, used: [ref], dropped: [{ref, why}] }
 * label: confirmed (≥2 independent sources, midpoints within ×2) · conflicting (≥2 independent, spread >×2) ·
 * single-source (one publisher) · unverified (nothing usable).
 */
export function durationRange(mentions) {
  const dropped = [];
  let kept = [];
  for (const [i, m] of (mentions || []).entries()) {
    const ref = m && m.ref ? String(m.ref) : `#${i + 1}`;
    const min = Number(m && m.min), max = Number(m && (m.max ?? m.min));
    if (m && m.injection_suspect) { dropped.push({ ref, why: 'injection_suspect' }); continue; }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min || max > DURATION_MAX_MIN) { dropped.push({ ref, why: 'invalid minutes' }); continue; }
    if (!m.source_key) { dropped.push({ ref, why: 'no source' }); continue; }
    kept.push({ ref, min, max, mid: (min + max) / 2, key: String(m.source_key) });
  }
  if (kept.length >= 3) {
    const med = median(kept.map((k) => k.mid));
    kept = kept.filter((k) => {
      const out = k.mid > med * OUTLIER_FACTOR || k.mid < med / OUTLIER_FACTOR;
      if (out) dropped.push({ ref: k.ref, why: 'outlier' });
      return !out;
    });
  }
  if (!kept.length) return { range: null, typical: null, label: 'unverified', independent_sources: 0, used: [], dropped };
  let lo = median(kept.map((k) => k.min)), hi = median(kept.map((k) => k.max));
  if (lo > hi) [lo, hi] = [hi, lo];
  const keys = new Set(kept.map((k) => k.key));
  const mids = kept.map((k) => k.mid);
  const spread = Math.max(...mids) / Math.min(...mids);
  const label = keys.size < 2 ? 'single-source' : spread > CONFLICT_RATIO ? 'conflicting' : 'confirmed';
  return {
    range: { min: round5(lo), max: Math.max(round5(lo), round5(hi)) }, typical: round5(median(mids)), label,
    independent_sources: keys.size, used: kept.map((k) => k.ref), dropped
  };
}

// Developed by: LightAISolutions

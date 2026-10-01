/**
 * Brochure kit — decorative art generated from data, never fetched: contour lines seeded by the trip title (every
 * trip gets its own hill) and small ornaments. All SVG, all vector, all stroked in the accent colour.
 */
/** Deterministic PRNG (mulberry32) seeded from any string. */
export function rng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** One contour ring: a perturbed circle, smooth closed path of 96 points. */
function ring(cx, cy, r, harmonics) {
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const f = 1 + harmonics.reduce((a, [amp, n, ph]) => a + amp * Math.sin(n * t + ph), 0);
    pts.push([cx + Math.cos(t) * r * f, cy + Math.sin(t) * r * f * 0.78]);
  }
  return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
}
/** Contour field for a w×h box: `rings` nested rings around a seeded centre, thin strokes. */
export function contours({ seed = 'brochure', w = 800, h = 1000, rings = 14, stroke = '#b2492f', opacity = 0.5, strokeWidth = 0.9, cx, cy } = {}) {
  const r = rng(seed);
  const x0 = cx ?? w * (0.35 + r() * 0.3), y0 = cy ?? h * (0.3 + r() * 0.35);
  const harmonics = [[0.05 + r() * 0.07, 2, r() * 6.28], [0.03 + r() * 0.05, 3, r() * 6.28], [0.015 + r() * 0.03, 5, r() * 6.28], [0.01 + r() * 0.015, 8, r() * 6.28]];
  const base = Math.min(w, h) * 0.045;
  let d = '';
  for (let i = 1; i <= rings; i++) d += ring(x0, y0, base * i * (1 + i * 0.02), harmonics.map(([a, n, p]) => [a * (1 + i * 0.04), n, p + i * 0.08])) + ' ';
  return `<path d="${d.trim()}" fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
}
/** A compass rose — four points, hairline circle, N marked. */
export function compass(size = 48, stroke = '#1c1a17') {
  const c = size / 2, r = c - 2;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${stroke}" stroke-width="0.8" stroke-opacity="0.5"/><path d="M${c} ${c - r * 0.85}L${c + r * 0.16} ${c}L${c} ${c + r * 0.85}L${c - r * 0.16} ${c}Z" fill="${stroke}"/><path d="M${c - r * 0.85} ${c}L${c} ${c - r * 0.16}L${c + r * 0.85} ${c}L${c} ${c + r * 0.16}Z" fill="none" stroke="${stroke}" stroke-width="0.8"/><circle cx="${c}" cy="${c}" r="1.6" fill="#fff" stroke="${stroke}" stroke-width="0.8"/></svg>`;
}
/** Short hairline rule with a centred diamond — a section divider. */
export function ornamentRule(width = 120, stroke = '#b2492f') {
  const m = width / 2;
  return `<svg class="orn" viewBox="0 0 ${width} 10" width="${width}" height="10" aria-hidden="true"><path d="M0 5H${m - 9}M${m + 9} 5H${width}" stroke="${stroke}" stroke-width="0.8"/><path d="M${m} 1L${m + 4} 5L${m} 9L${m - 4} 5Z" fill="${stroke}"/></svg>`;
}

// Developed by: LightAISolutions

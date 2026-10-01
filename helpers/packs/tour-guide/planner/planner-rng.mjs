/** Tour Guide planner — seeded PRNG (mulberry32) so tie-breaks are reproducible from `seed`. */
export function createRng(seed = 1) {
  let a = (Number(seed) >>> 0) || 1;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, seed: a, /** Stable shuffle-key per item so sorts stay deterministic. */ key: (s) => { let h = 2166136261 ^ a; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h / 4294967296; } };
}

// Developed by: LightAISolutions

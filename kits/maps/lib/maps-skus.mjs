/**
 * Maps kit — SKU table. Free monthly caps and list prices (USD per 1,000 billable units at the lowest paid band) from
 * https://developers.google.com/maps/billing-and-pricing/pricing (page "Last updated 2026-09-28 UTC", read 2026-10-01).
 * Triggers from https://developers.google.com/maps/billing-and-pricing/sku-details (2026-09-30 UTC).
 * `unit` is what Google bills: 'request' or 'element' (Route Matrix bills each element = origin × destination).
 * DEFAULT_CEILINGS are the kit's monthly hard stops: 80 % of each free cap, so a normal month never leaves the free tier
 * and other users of the same key keep 20 % headroom. Override per SKU with the `ceilings` option or MAPS_SKU_CEILINGS.
 */
export const SKUS = Object.freeze({
  'places.details.essentials': { label: 'Place Details Essentials', unit: 'request', free: 10000, usdPer1000: 5 },
  'places.details.pro': { label: 'Place Details Pro', unit: 'request', free: 5000, usdPer1000: 17 },
  'places.details.enterprise': { label: 'Place Details Enterprise', unit: 'request', free: 1000, usdPer1000: 20 },
  'places.details.enterprise_atmosphere': { label: 'Place Details Enterprise + Atmosphere', unit: 'request', free: 1000, usdPer1000: 25 },
  'places.text_search.ids_only': { label: 'Text Search Essentials (IDs Only)', unit: 'request', free: Infinity, usdPer1000: 0 },
  'places.text_search.pro': { label: 'Text Search Pro', unit: 'request', free: 5000, usdPer1000: 32 },
  'places.text_search.enterprise': { label: 'Text Search Enterprise', unit: 'request', free: 1000, usdPer1000: 35 },
  'routes.compute_routes.essentials': { label: 'Compute Routes Essentials', unit: 'request', free: 10000, usdPer1000: 5 },
  'routes.compute_routes.pro': { label: 'Compute Routes Pro', unit: 'request', free: 5000, usdPer1000: 10 },
  'routes.route_matrix.essentials': { label: 'Compute Route Matrix Essentials', unit: 'element', free: 10000, usdPer1000: 5 },
  'routes.route_matrix.pro': { label: 'Compute Route Matrix Pro', unit: 'element', free: 5000, usdPer1000: 10 }
});

/** 80 % of the free cap; the unlimited IDs-only SKU gets a loop guard instead (2,000 requests a month). */
export const DEFAULT_CEILINGS = Object.freeze(Object.fromEntries(Object.entries(SKUS).map(([k, s]) => [k, Number.isFinite(s.free) ? Math.floor(s.free * 0.8) : 2000])));

/** resolveCeilings({ 'places.details.enterprise': 200 }) → full table; unknown SKUs or negative numbers throw. */
export function resolveCeilings(overrides = {}) {
  const out = { ...DEFAULT_CEILINGS };
  for (const [k, v] of Object.entries(overrides || {})) {
    if (!(k in SKUS)) throw new Error('maps: unknown SKU in ceilings: ' + k);
    if (!Number.isInteger(v) || v < 0) throw new Error('maps: ceiling for ' + k + ' must be a non-negative integer');
    out[k] = v;
  }
  return out;
}
/** parseCeilingsEnv('places.details.enterprise=200,routes.compute_routes.pro=50') → object (MAPS_SKU_CEILINGS format). */
export function parseCeilingsEnv(s) {
  const out = {};
  for (const part of String(s || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    const [k, v] = part.split('=');
    out[k.trim()] = Number(v);
  }
  return out;
}
/** List-price cost of `units` beyond the free cap, given `alreadyUsed` this month (estimate, not a quote). */
export function estimateUsd(sku, units, alreadyUsed = 0) {
  const s = SKUS[sku];
  if (!s || !Number.isFinite(s.free)) return 0;
  const billable = Math.max(0, alreadyUsed + units - Math.max(s.free, alreadyUsed));
  return (billable / 1000) * s.usdPer1000;
}

// Developed by: LightAISolutions

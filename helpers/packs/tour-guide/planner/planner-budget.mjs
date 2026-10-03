/**
 * Tour Guide planner — the pre-flight budget. Counts every Maps unit a build will spend BEFORE the first call and
 * checks it against the ledger's remaining monthly ceilings (the Maps kit would refuse mid-build; this refuses up front).
 * Per day: one Route Matrix of P² elements (P = distinct points: stops + lodging endpoints), ≤ stops + 1 Compute Routes
 * (Essentials) for the real legs — re-solves reuse fetched legs and add at most a few — and one Compute Routes (Pro)
 * cross-check on DRIVE / WALK days with ≥ 2 stops. Phase 10 (WP-10b) adds the honest-leg requests (planner-legs.mjs
 * LEG_EXTRA): per leg at most one WALK route (TRANSIT days, a leg the rail estimator walks) and one DRIVE route (a walked
 * leg that is uphill, on a trail or on a footpath) — `extra_calls`, capped at LEG_EXTRA.MAX_PER_DAY, counted under the
 * same Compute Routes (Essentials) SKU.
 * Phase 11 (WP-11a): an overridden day's matrix holds its own points (planner-anchors.mjs: the start, the end, the bag
 * stop's lodging) and adds one route for the bag leg (`hotel`: start → the night's lodging; `locker`: start → the end
 * when they differ) with its honest-leg extras. With `dinner: true` (a dinner pool was given) every day that can have a
 * dinner (no `end` override) adds the two dinner legs — `dinner_calls` 2 plus their own extras (extraCallsFor(mode, 2)).
 */
import { estimateUsd } from '../../../kits/maps/index.mjs';
import { pointKey, LEG_EXTRA } from './planner-legs.mjs';
import { dayAnchors } from './planner-anchors.mjs';

export const SKU = Object.freeze({ matrix: 'routes.route_matrix.essentials', routes: 'routes.compute_routes.essentials', pro: 'routes.compute_routes.pro' });
export class PlanBudgetError extends Error {
  constructor(budget) { super(`planner: the build would exceed a Maps ceiling (${Object.entries(budget.short).map(([k, v]) => `${k}: ${v.needed} needed, ${v.remaining} left`).join('; ')}); nothing was sent`); this.name = 'PlanBudgetError'; this.code = 'PLAN_BUDGET'; this.budget = budget; }
}

/** extraCallsFor(mode, legs) → the most honest-leg requests a day of `legs` legs can spend (WALK + DRIVE on TRANSIT days, DRIVE on WALK days). */
export function extraCallsFor(mode, legs) {
  const per = mode === 'TRANSIT' ? LEG_EXTRA.PER_WALKED_LEG : mode === 'WALK' ? 1 : 0;
  return Math.min(LEG_EXTRA.MAX_PER_DAY, per * Math.max(0, legs));
}

/** The bag leg an overridden day fetches outside its matrix chain: 1 (hotel; locker ending elsewhere) or 0. */
export function bagLegs(day) {
  if (!day.override || !day.bags) return 0;
  const a = dayAnchors(day);
  if (a.hotel) return pointKey(a.S) === pointKey(a.hotel) ? 0 : 1;
  if (a.locker) return pointKey(a.S) === pointKey(a.E) ? 0 : 1;
  return 0;
}

/** budgetFor({ days, byDate, ledger, dinner? }) → { skus, usd_estimate, within_ceiling, short, per_day } */
export function budgetFor({ days, byDate, ledger = null, dinner = false }) {
  const skus = { [SKU.matrix]: 0, [SKU.routes]: 0, [SKU.pro]: 0 };
  const per_day = {};
  for (const day of days) {
    const stops = byDate[day.date] || [];
    const ends = day.override ? dayAnchors(day).points.map(pointKey) : [pointKey(day.lodging_start), pointKey(day.lodging_end)];
    const points = new Set([...ends, ...stops.map((c) => 'id:' + c.place_id)]).size;
    const bag = bagLegs(day);
    const d = { matrix_elements: points > 1 ? points * points : 0, route_calls: stops.length + 1 + bag, extra_calls: stops.length || bag ? extraCallsFor(day.mode, stops.length + 1 + bag) : 0, pro_calls: day.mode !== 'TRANSIT' && stops.length >= 2 ? 1 : 0 };
    if (dinner && !day.end) { d.dinner_calls = 2; d.extra_calls += extraCallsFor(day.mode, 2); }
    skus[SKU.matrix] += d.matrix_elements; skus[SKU.routes] += d.route_calls + (d.dinner_calls || 0) + d.extra_calls; skus[SKU.pro] += d.pro_calls;
    per_day[day.date] = d;
  }
  const used = {};
  if (ledger) for (const r of ledger.usage().skus) used[r.sku] = r.units;
  const short = {};
  let usd = 0;
  for (const [sku, units] of Object.entries(skus)) {
    usd += estimateUsd(sku, units, used[sku] || 0);
    if (ledger) { const remaining = ledger.remaining(sku); if (units > remaining) short[sku] = { needed: units, remaining }; }
  }
  return { skus, usd_estimate: Math.round(usd * 10000) / 10000, within_ceiling: Object.keys(short).length === 0, short, per_day };
}

// Developed by: LightAISolutions

/**
 * Tour Guide planner — the pre-flight budget. Counts every Maps unit a build will spend BEFORE the first call and
 * checks it against the ledger's remaining monthly ceilings (the Maps kit would refuse mid-build; this refuses up front).
 * Per day: one Route Matrix of P² elements (P = distinct points: stops + lodging endpoints), ≤ stops + 1 Compute Routes
 * (Essentials) for the real legs — re-solves reuse fetched legs and add at most a few — and one Compute Routes (Pro)
 * cross-check on DRIVE / WALK days with ≥ 2 stops.
 */
import { estimateUsd } from '../../../kits/maps/index.mjs';
import { pointKey } from './planner-legs.mjs';

export const SKU = Object.freeze({ matrix: 'routes.route_matrix.essentials', routes: 'routes.compute_routes.essentials', pro: 'routes.compute_routes.pro' });
export class PlanBudgetError extends Error {
  constructor(budget) { super(`planner: the build would exceed a Maps ceiling (${Object.entries(budget.short).map(([k, v]) => `${k}: ${v.needed} needed, ${v.remaining} left`).join('; ')}); nothing was sent`); this.name = 'PlanBudgetError'; this.code = 'PLAN_BUDGET'; this.budget = budget; }
}

/** budgetFor({ days, byDate, ledger }) → { skus, usd_estimate, within_ceiling, short, per_day } */
export function budgetFor({ days, byDate, ledger = null }) {
  const skus = { [SKU.matrix]: 0, [SKU.routes]: 0, [SKU.pro]: 0 };
  const per_day = {};
  for (const day of days) {
    const stops = byDate[day.date] || [];
    const points = new Set([pointKey(day.lodging_start), pointKey(day.lodging_end), ...stops.map((c) => 'id:' + c.place_id)]).size;
    const d = { matrix_elements: points > 1 ? points * points : 0, route_calls: stops.length + 1, pro_calls: day.mode !== 'TRANSIT' && stops.length >= 2 ? 1 : 0 };
    skus[SKU.matrix] += d.matrix_elements; skus[SKU.routes] += d.route_calls; skus[SKU.pro] += d.pro_calls;
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

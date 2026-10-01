/**
 * Tour Guide planner — day plans over Google Maps (plan §5.4). Library only; the brain's `plan-days` skill drives it.
 *   planTrip({ trip, places, snapshots, estimates, notes?, profile, calibration?, maps, build_id, now, seed?, chooseMinutes? }) → Plan
 *   replanDays(plan, dates, input) → Plan        (every other day is byte-identical; Later items outside the pool are kept)
 *   estimateBudget(input) → budget               (no API call; what planTrip would spend and whether the ledger allows it)
 * `maps` is a Maps-kit client (createMapsClient); every unit it spends is counted by its ledger before sending.
 * Contract (entities, codes, warnings): helpers/packs/tour-guide/README.md. Design and limits: helpers/decisions/WP-3b.md.
 */
import { prepare } from './planner-input.mjs';
import { assign } from './planner-assign.mjs';
import { planDay } from './planner-day.mjs';
import { budgetFor, PlanBudgetError, SKU } from './planner-budget.mjs';
import { mergeLater } from './planner-later.mjs';
import { createRng } from './planner-rng.mjs';
import { dateIn } from './planner-time.mjs';

export { PlanBudgetError, SKU } from './planner-budget.mjs';
export { solveDay, WEIGHT, MAX_STOPS } from './planner-solve.mjs';
export { hoursOn, earliestFit, unfitCode } from './planner-hours.mjs';
export { assign, FAR_KM, CAP, dayCapacity } from './planner-assign.mjs';
export { prepare, buildDays, lodgingForNight, modeFor, PACE } from './planner-input.mjs';
export { localToIso, weekdayOf, dateRange, toMin, hm } from './planner-time.mjs';
export { DIDNT_FIT, NEXT_TIME } from './planner-later.mjs';

const fail = (m) => { throw new Error('planner: ' + m); };

async function context(input) {
  if (!input || !input.maps || typeof input.maps.computeRouteMatrix !== 'function') fail('maps must be a Maps-kit client');
  if (!input.build_id || !/^[A-Za-z0-9_.-]{1,80}$/.test(String(input.build_id))) fail('build_id is required (letters, digits, _ . -)');
  const ctx = await prepare(input);
  ctx.breakfastAtLodging = !(input.profile && input.profile.meals && input.profile.meals.breakfast_at_lodging === false);
  ctx.now = input.now ? new Date(input.now) : new Date();
  if (Number.isNaN(ctx.now.getTime())) fail('now must be a date');
  ctx.today = dateIn(ctx.now, ctx.trip.timezone);
  ctx.seed = Number.isInteger(input.seed) ? input.seed : 1;
  ctx.rng = createRng(ctx.seed);
  return ctx;
}

/** Shared build: plan `dates` from `pool`, merge with `prior` (a previous Plan) when re-planning. */
async function build(ctx, input, { dates, pool, prior }) {
  const days = ctx.days.filter((d) => dates.includes(d.date));
  const { byDate, later: unassigned } = assign({ days, cands: pool, rng: ctx.rng });
  const budget = budgetFor({ days, byDate, ledger: input.maps.ledger || null });
  if (!budget.within_ceiling && !input.allowOverBudget) throw new PlanBudgetError(budget);
  const built = [], dropped = unassigned.slice();
  const usage = { matrix_elements: 0, route_calls: 0 };
  for (const day of days) {
    const r = await planDay({ ctx, day, cands: byDate[day.date], maps: input.maps, build_id: String(input.build_id), seed: ctx.seed, verified_on: ctx.today });
    built.push(r.dayPlan);
    dropped.push(...r.dropped);
    usage.matrix_elements += r.usage.matrix_elements; usage.route_calls += r.usage.route_calls;
  }
  const poolIds = new Set(pool.map((c) => c.id));
  const allDays = prior ? prior.days.map((d) => (dates.includes(d.date) ? built.find((b) => b.date === d.date) : JSON.parse(JSON.stringify(d)))) : built;
  const scheduled = new Set(allDays.flatMap((d) => d.stops.map((s) => s.place)));
  const later = mergeLater({ trip_id: ctx.trip.id, previous: prior ? prior.later : null, pool: poolIds, dropped, saved: ctx.saved, today: ctx.today });
  const inLater = new Set(later.flatMap((l) => l.items.map((it) => it.place)));
  const places = input.places.map((p) => {
    const { scheduled_hint, ...rest } = p;
    if (scheduled.has(p.id)) return { ...rest, status: 'scheduled' };
    if (inLater.has(p.id)) return { ...rest, status: 'saved-for-later' };
    return poolIds.has(p.id) && p.status === 'scheduled' ? { ...rest, status: 'candidate' } : rest;
  });
  const skus = { ...budget.skus };
  if (prior && prior.budget && prior.budget.skus) for (const [k, v] of Object.entries(prior.budget.skus)) skus[k] = (skus[k] || 0) + v;
  return {
    v: 1, build_id: String(input.build_id), trip_id: ctx.trip.id, built_on: ctx.today,
    days: allDays.sort((a, b) => a.date.localeCompare(b.date)), later, places,
    budget: { skus, usd_estimate: budget.usd_estimate + (prior && prior.budget ? prior.budget.usd_estimate : 0), within_ceiling: budget.within_ceiling },
    usage: { matrix_elements: usage.matrix_elements + (prior ? prior.usage.matrix_elements : 0), route_calls: usage.route_calls + (prior ? prior.usage.route_calls : 0) }
  };
}

export async function planTrip(input) {
  const ctx = await context(input);
  return build(ctx, input, { dates: ctx.days.map((d) => d.date), pool: ctx.cands, prior: null });
}

/**
 * replanDays(plan, dates, input): the pool is every place scheduled on `dates` in `plan` plus every place whose status
 * is `candidate` (a promoted place carries `scheduled_hint`); places scheduled on other days are untouched.
 */
export async function replanDays(plan, dates, input) {
  if (!plan || plan.v !== 1 || !Array.isArray(plan.days)) fail('replanDays needs a v1 Plan');
  if (!Array.isArray(dates) || !dates.length) fail('replanDays needs at least one date');
  for (const d of dates) if (!plan.days.some((x) => x.date === d)) fail(`date ${d} is not in the plan`);
  const ctx = await context({ ...input, places: input.places || plan.places, build_id: input.build_id || plan.build_id });
  const elsewhere = new Set(plan.days.filter((d) => !dates.includes(d.date)).flatMap((d) => d.stops.map((s) => s.place)));
  const pool = ctx.cands.filter((c) => !elsewhere.has(c.id));
  return build(ctx, { ...input, places: input.places || plan.places, build_id: input.build_id || plan.build_id }, { dates, pool, prior: plan });
}

/** What a planTrip would spend, checked against the ledger — no API call. */
export async function estimateBudget(input) {
  const ctx = await context(input);
  const { byDate } = assign({ days: ctx.days, cands: ctx.cands, rng: ctx.rng });
  return budgetFor({ days: ctx.days, byDate, ledger: input.maps.ledger || null });
}

// Developed by: LightAISolutions

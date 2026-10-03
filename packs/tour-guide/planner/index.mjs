/**
 * Tour Guide planner — day plans over Google Maps (plan §5.4). Library only; the brain's `plan-days` skill drives it.
 *   planTrip({ trip, places, snapshots, estimates, notes?, profile, calibration?, maps, build_id, now, seed?, chooseMinutes?, railEstimates?, choices? }) → Plan
 *   replanDays(plan, dates, input) → Plan        (every other day is byte-identical; Later items outside the pool are kept)
 * choices = { picks?, later?, skip? } by place slug (planner-choices.mjs): picks are the whole pool, later → "Saved by
 * you" (owner_choice), skip → rejected. Without choices the output is exactly what it was before choices existed.
 *   estimateBudget(input) → budget               (no API call; what planTrip would spend and whether the ledger allows it)
 * TRANSIT legs Google has no route for are estimated from distance (trip.transit_fallback, planner-legs.mjs) and the
 * day carries a `transit_estimated` warning; DRIVE / WALK are unchanged.
 * Each built day with an outdoor stop may carry `rain_swaps`: up to two nearby indoor places off the plan (planner-rain.mjs).
 * `maps` is a Maps-kit client (createMapsClient); every unit it spends is counted by its ledger before sending.
 * Contract (entities, codes, warnings): helpers/packs/tour-guide/README.md. Design and limits: helpers/decisions/WP-3b.md.
 */
import { prepare } from './planner-input.mjs';
import { assign } from './planner-assign.mjs';
import { planDay } from './planner-day.mjs';
import { budgetFor, PlanBudgetError, SKU } from './planner-budget.mjs';
import { mergeLater } from './planner-later.mjs';
import { normalizeChoices, applyChoices, choiceStatus, OWNER_CHOICE_REASON } from './planner-choices.mjs';
import { createRng } from './planner-rng.mjs';
import { dateIn } from './planner-time.mjs';
import { withRailEstimates } from './planner-rail.mjs';
import { withBusFallback } from './planner-transit.mjs';
import { rainSwaps } from './planner-rain.mjs';

export { PlanBudgetError, SKU } from './planner-budget.mjs';
export { solveDay, WEIGHT, MAX_STOPS } from './planner-solve.mjs';
export { hoursOn, earliestFit, unfitCode } from './planner-hours.mjs';
export { assign, FAR_KM, CAP, dayCapacity } from './planner-assign.mjs';
export { prepare, buildDays, lodgingForNight, modeFor, PACE } from './planner-input.mjs';
export { localToIso, weekdayOf, dateRange, toMin, hm } from './planner-time.mjs';
export { DIDNT_FIT, NEXT_TIME, SAVED_BY_YOU } from './planner-later.mjs';
export { withBusFallback, transitPrefs, railOnly, RAIL_MODES } from './planner-transit.mjs';
export { withRailEstimates, railEstimate, railLine, rideMinutes, walkMinutes, RAIL, STATION_TYPES } from './planner-rail.mjs';
export { normalizeChoices, applyChoices, POOL_STATUSES, CHOICE_LISTS, OWNER_CHOICE_REASON } from './planner-choices.mjs';
export { transitFallback, estimateTransit, TRANSIT_FALLBACK_DEFAULT, ROUTE_FACTOR } from './planner-legs.mjs';
export { TRANSIT_ESTIMATED_TEXT } from './planner-day.mjs';
export { rainSwaps, isIndoor, MAX_SWAPS, SWAP_KM, INDOOR_CATEGORIES, OUTDOOR_CATEGORIES } from './planner-rain.mjs';

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

/** Resolve choices against the places: null without choices, else applyChoices() plus the original places. */
function resolveChoices(places, raw, explicit) {
  if (!Array.isArray(places)) return null;
  const c = normalizeChoices(raw, places);
  return c ? applyChoices(places, c, { explicit }) : null;
}

/** Shared build: plan `dates` from `pool`, merge with `prior` (a previous Plan) when re-planning; `ch` = resolved choices. */
async function build(ctx, input, { dates, pool, prior, ch = null }) {
  const days = ctx.days.filter((d) => dates.includes(d.date));
  const { byDate, later: unassigned } = assign({ days, cands: pool, rng: ctx.rng });
  const budget = budgetFor({ days, byDate, ledger: input.maps.ledger || null });
  if (!budget.within_ceiling && !input.allowOverBudget) throw new PlanBudgetError(budget);
  const built = [], dropped = unassigned.slice();
  const usage = { matrix_elements: 0, route_calls: 0 };
  // TRANSIT asks rail first and re-asks with buses only for pairs rail could not serve (planner-transit.mjs); where Google
  // has no transit route at all (Japan), TRANSIT legs become station-based train estimates (planner-rail.mjs).
  const railFirst = withBusFallback(input.maps);
  const maps = input.railEstimates === false ? railFirst : withRailEstimates(railFirst, { points: [...pool.map((c) => ({ placeId: c.place_id, ...(c.loc || {}) })), ...days.flatMap((d) => [d.lodging_start, d.lodging_end])] });
  for (const day of days) {
    const r = await planDay({ ctx, day, cands: byDate[day.date], maps, build_id: String(input.build_id), seed: ctx.seed, verified_on: ctx.today });
    built.push(r.dayPlan);
    dropped.push(...r.dropped);
    usage.matrix_elements += r.usage.matrix_elements; usage.route_calls += r.usage.route_calls;
  }
  const poolIds = new Set(pool.map((c) => c.id));
  const allDays = prior ? prior.days.map((d) => (dates.includes(d.date) ? built.find((b) => b.date === d.date) : JSON.parse(JSON.stringify(d)))) : built;
  const scheduled = new Set(allDays.flatMap((d) => d.stops.map((s) => s.place)));
  addRainSwaps(allDays, dates, { places: input.places, snapshots: ctx.snapshots, exclude: new Set([...scheduled, ...(ch ? ch.skip : [])]) });
  const extra = ch && ch.explicit ? {
    refresh: new Set([...ch.keep, ...ch.skip]),
    kept: input.places.filter((p) => ch.keep.has(p.id)).map((p) => ({ id: p.id, place_id: p.place_id, reason: OWNER_CHOICE_REASON }))
  } : {};
  const later = mergeLater({ trip_id: ctx.trip.id, previous: prior ? prior.later : null, pool: poolIds, dropped, saved: ctx.saved, today: ctx.today, ...extra });
  const inLater = new Set(later.flatMap((l) => l.items.map((it) => it.place)));
  const places = input.places.map((p) => {
    const { scheduled_hint, ...rest } = p;
    if (ch) return choiceStatus(p, rest, { ch, scheduled, inLater });
    if (scheduled.has(p.id)) return { ...rest, status: 'scheduled' };
    if (inLater.has(p.id)) return { ...rest, status: 'saved-for-later' };
    return poolIds.has(p.id) && p.status === 'scheduled' ? { ...rest, status: 'candidate' } : rest;
  });
  const skus = { ...budget.skus };
  if (prior && prior.budget && prior.budget.skus) for (const [k, v] of Object.entries(prior.budget.skus)) skus[k] = (skus[k] || 0) + v;
  const plan = {
    v: 1, build_id: String(input.build_id), trip_id: ctx.trip.id, built_on: ctx.today,
    days: allDays.sort((a, b) => a.date.localeCompare(b.date)), later, places,
    budget: { skus, usd_estimate: budget.usd_estimate + (prior && prior.budget ? prior.budget.usd_estimate : 0), within_ceiling: budget.within_ceiling },
    usage: { matrix_elements: usage.matrix_elements + (prior ? prior.usage.matrix_elements : 0), route_calls: usage.route_calls + (prior ? prior.usage.route_calls : 0) }
  };
  if (ch) plan.choices = { picks: [...ch.effective.picks].sort(), later: [...ch.effective.later].sort(), skip: [...ch.effective.skip].sort() };
  return plan;
}

/**
 * Rainy-day swaps (planner-rain.mjs) on every re-built date; a kept day keeps its swaps except a place now scheduled or
 * skipped, and a place is offered on one day only (kept days claim theirs first).
 */
function addRainSwaps(allDays, dates, { places, snapshots, exclude }) {
  const used = new Set(), byDate = allDays.slice().sort((a, b) => a.date.localeCompare(b.date));
  for (const d of byDate) {
    if (dates.includes(d.date) || !d.rain_swaps) continue;
    d.rain_swaps = d.rain_swaps.filter((r) => !exclude.has(r.place) && !used.has(r.place));
    d.rain_swaps.forEach((r) => used.add(r.place));
    if (!d.rain_swaps.length) delete d.rain_swaps;
  }
  for (const d of byDate) {
    if (!dates.includes(d.date)) continue;
    const swaps = rainSwaps({ day: d, places, snapshots, exclude, used });
    if (swaps.length) d.rain_swaps = swaps; else delete d.rain_swaps;
  }
}

export async function planTrip(input) {
  const ch = resolveChoices(input && input.places, input && input.choices, true);
  const ctx = await context(ch ? { ...input, places: ch.places } : input);
  return build(ctx, input, { dates: ctx.days.map((d) => d.date), pool: ctx.cands, prior: null, ch });
}

/**
 * replanDays(plan, dates, input): the pool is every place scheduled on `dates` in `plan` plus every place whose status
 * is `candidate` (a promoted place carries `scheduled_hint`); places scheduled on other days are untouched.
 * Choices: `input.choices` when given (explicit; `null` = none), else the choices the plan recorded (a pool filter).
 */
export async function replanDays(plan, dates, input) {
  if (!plan || plan.v !== 1 || !Array.isArray(plan.days)) fail('replanDays needs a v1 Plan');
  if (!Array.isArray(dates) || !dates.length) fail('replanDays needs at least one date');
  for (const d of dates) if (!plan.days.some((x) => x.date === d)) fail(`date ${d} is not in the plan`);
  const places = input.places || plan.places;
  const explicit = input.choices !== undefined;
  const ch = resolveChoices(places, explicit ? input.choices : plan.choices || null, explicit);
  const ctx = await context({ ...input, places: ch ? ch.places : places, build_id: input.build_id || plan.build_id });
  const elsewhereDay = new Map(plan.days.filter((d) => !dates.includes(d.date)).flatMap((d) => d.stops.map((s) => [s.place, d.date])));
  const elsewhere = new Set(elsewhereDay.keys());
  if (ch && ch.explicit) {
    for (const slug of [...ch.keep, ...ch.skip]) if (elsewhereDay.has(slug)) fail(`choices keep or skip "${slug}", which is scheduled on ${elsewhereDay.get(slug)}, a day not being re-planned (re-plan that day too)`);
  }
  const pool = ctx.cands.filter((c) => !elsewhere.has(c.id));
  return build(ctx, { ...input, places, build_id: input.build_id || plan.build_id }, { dates, pool, prior: plan, ch });
}

/** What a planTrip would spend, checked against the ledger — no API call. */
export async function estimateBudget(input) {
  const ch = resolveChoices(input && input.places, input && input.choices, true);
  const ctx = await context(ch ? { ...input, places: ch.places } : input);
  const { byDate } = assign({ days: ctx.days, cands: ctx.cands, rng: ctx.rng });
  return budgetFor({ days: ctx.days, byDate, ledger: input.maps.ledger || null });
}

// Developed by: LightAISolutions

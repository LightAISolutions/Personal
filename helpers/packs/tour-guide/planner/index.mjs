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
 * Phase 11 (WP-11a): day overrides (real starts and ends, bag steps), place facts and crowd slots shape each day
 * (planner-day.mjs); `input.dinners` (saved places that fit the diet) gives each day a real dinner (planner-dinner.mjs);
 * a trip with a season sheet, day overrides or a dinner pool also gets each day's `sunset` and evening `extras`
 * (planner-evening.mjs). Without any of these the output is exactly what it was before Phase 11.
 * Phase 11 (WP-11e): `input.outline` ({ by_date: { <date>: { kind, area?, anchors? } } }, planner-outline.mjs) shapes
 * each outlined day — its area, its kind and its anchors; without `outline` the planner plans exactly as before. The
 * journey module (../journey/) builds on planDates, outlinePools and versionSetBudget below.
 * Phase 12 (WP-12a, Contract C12): every built day carries `leave_by` (its first leg's departure) and, when its lodgings
 * have an `area`, `areas` (planner-morning.mjs). replanDays(plan, [date], { ...input, from, visited, rain }) re-plans the
 * rest of one day from where you are (planner-restart.mjs); without `from` it re-plans exactly as before.
 * Phase 13 (WP-13a): a hard end even an empty day cannot reach gives a day without stops and an `over_long_day`
 * alert, never an error (planner-solve.mjs, planner-day.mjs); an inverted override is clamped with a warning
 * (planner-input.mjs withOverride); a booking widens its day instead of going to Later, unless a hard end stops it, and a
 * booking dated outside the trip says so (planner-assign.mjs); a hard-end day's last leg leaves as late as allowed
 * (one more transit request, budgeted); evening extras start after the day's arrival (planner-evening.mjs); own facts
 * older than FACTS_MAX_AGE_DAYS still apply, with a "facts are old" warning (oldFactsDate). Old fixtures plan as before
 * except their hard-end days (A8).
 * `maps` is a Maps-kit client (createMapsClient); every unit it spends is counted by its ledger before sending.
 * Contract (entities, codes, warnings): helpers/packs/tour-guide/README.md. Design and limits: helpers/decisions/WP-3b.md.
 */
import { prepare, oldFactsDate, factsOldText } from './planner-input.mjs';
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
import { prepareDinners, addDinners } from './planner-dinner.mjs';
import { sunsetFor, eveningExtras, applyExtras } from './planner-evening.mjs';
import { normalizeOutline, applyOutline, outlineCap } from './planner-outline.mjs';
import { dayCapacity } from './planner-assign.mjs';
import { haversineKm } from './planner-geo.mjs';
import { DINNER_EARLIEST } from './planner-input.mjs';
import { DINNER } from './planner-dinner.mjs';
import { withMorning } from './planner-morning.mjs';
import { prepareRestart, mergeRestart, lateAgain, restartReason } from './planner-restart.mjs';
import { coveredFor, isIndoor } from './planner-rain.mjs';

export { PlanBudgetError, SKU, extraCallsFor } from './planner-budget.mjs';
export { solveDay, WEIGHT, MAX_STOPS } from './planner-solve.mjs';
export { hoursOn, earliestFit, unfitCode, knownWindows, irregularText, IRREGULAR_LINE_RE } from './planner-hours.mjs';
export { assign, FAR_KM, CAP, dayCapacity } from './planner-assign.mjs';
export { prepare, buildDays, lodgingForNight, modeFor, isWithheldDinner, PACE, withOverride, CLAMP_MINUTES, oldFactsDate, planToday } from './planner-input.mjs';
export { localToIso, weekdayOf, dateRange, toMin, hm, dayDate } from './planner-time.mjs';
export { DIDNT_FIT, NEXT_TIME, SAVED_BY_YOU } from './planner-later.mjs';
export { withBusFallback, transitPrefs, railOnly, RAIL_MODES } from './planner-transit.mjs';
export { withRailEstimates, railEstimate, railLine, rideMinutes, walkMinutes, RAIL, STATION_TYPES } from './planner-rail.mjs';
export { normalizeChoices, applyChoices, POOL_STATUSES, CHOICE_LISTS, OWNER_CHOICE_REASON } from './planner-choices.mjs';
export { transitFallback, estimateTransit, TRANSIT_FALLBACK_DEFAULT, ROUTE_FACTOR, fetchLeg, routeFlags, isHillPoint, legAllowance, LEG_EXTRA, FLAG_ORDER, FOOTPATH_RE, TRAIL_RE } from './planner-legs.mjs';
export { TRANSIT_ESTIMATED_TEXT, WALK_ESTIMATED_TEXT, TRAVEL_ESTIMATED_TEXT, CHECK_IRREGULAR_TEXT, CHECK_UNKNOWN_TEXT, checkOnDay, timeStyle, shortfall, EXACT_NEAR_LAST_ENTRY, LAST_ENTRY_BEFORE_CLOSE } from './planner-day.mjs';
export { bufferFor, BUFFER } from './planner-buffer.mjs';
export { guardNote, guardNoteFields, noteConflict, clockOf, NOTE_RULES } from './planner-notes.mjs';
export { refineCategory, withRefinedCategory, minVisit, MIN_VISIT, COVERED_SIGHTS, MEAL_CATEGORIES, NEW_CATEGORIES } from './planner-category.mjs';
export { rainSwaps, isIndoor, isCoveredSight, MAX_SWAPS, SWAP_KM, INDOOR_CATEGORIES, OUTDOOR_CATEGORIES } from './planner-rain.mjs';
export { overrideFor, dayAnchors, bagsText, BAGS, BAG_KINDS, END_MARGIN, START_SLUG, END_SLUG, LODGING_SLUG } from './planner-anchors.mjs';
export { placeFacts, factsHours, factsMinutes, ownHoursConflict, CLOSE_TOLERANCE_MINUTES, MENU_FITS } from './planner-facts.mjs';
export { avoidsCrowds, crowdWindows, crowdSlotOf, CROWD_SLOT, CROWD_RULE_RE } from './planner-crowd.mjs';
export { sunsetLocal, sunsetUtcMinutes, SUNSET_ZENITH } from './planner-sun.mjs';
export { prepareDinners, addDinners, dinnerBooking, bookingFor, bookingRecordLine, DINNER } from './planner-dinner.mjs';
export { sunsetFor, eveningExtras, applyExtras, runsThatEvening, EXTRAS } from './planner-evening.mjs';
export { schedWindows, legRecord, estimatedWarning, BACK_EARLY_NOTE, END_SPARE_NOTE } from './planner-day.mjs';
export { checkDayChain } from './planner-chain.mjs';
export { bagLegs, budgetFor } from './planner-budget.mjs';
export { normalizeOutline, applyOutline, outlineCode, outlineCap, OUTLINE_KINDS, AREA_KM, OUTLINE, FREE_DAY_NOTE } from './planner-outline.mjs';
export { mergeLater } from './planner-later.mjs';
export { leaveBy, dayAreas, withMorning } from './planner-morning.mjs';
export { restartErrors, prepareRestart, mergeRestart, lateAgain, restartReason, HERE_SLUG, HERE_NAME, RESTART, PASSED_OVER_NOTE } from './planner-restart.mjs';
export { RAIN, coveredFor, rainWeight } from './planner-rain.mjs';

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
  const t = ctx.trip;
  ctx.evening = !!(t.season || (Array.isArray(t.day_overrides) && t.day_overrides.length) || Array.isArray(input.dinners));   // Phase 11 output only for Phase 11 input
  if (input.outline !== undefined && input.outline !== null) {   // WP-11e: only an input with an outline
    ctx.outline = normalizeOutline(input.outline, ctx.days.map((d) => d.date));
    applyOutline(ctx, ctx.outline, { places: input.places, dinners: input.dinners });
  }
  return ctx;
}

/** Resolve choices against the places: null without choices, else applyChoices() plus the original places. */
function resolveChoices(places, raw, explicit) {
  if (!Array.isArray(places)) return null;
  const c = normalizeChoices(raw, places);
  return c ? applyChoices(places, c, { explicit }) : null;
}

/** Shared build: plan `dates` from `pool`, merge with `prior` (a previous Plan) when re-planning; `ch` = resolved choices. */
async function build(ctx, input, { dates, pool, prior, ch = null, withheld = [], sink = null, restart = null }) {
  const days = ctx.days.filter((d) => dates.includes(d.date)).map((d) => (restart && d.date === restart.date ? restart.day : d));   // C12: the rest of a re-planned day
  const { byDate, later: unassigned } = assign({ days, cands: pool, rng: ctx.rng, tripDates: ctx.days.map((d) => d.date) });   // Phase 13 (A13): a re-plan still knows the whole trip
  // Phase 11: the dinner pool (saved places that fit the diet), prepared before the budget so its legs are counted.
  const dinnerPool = prepareDinners(input.dinners, { snapshots: ctx.snapshots, dates: ctx.days.map((d) => d.date), places: ch ? ch.places : input.places, choices: ch });
  const budget = budgetFor({ days, byDate, ledger: input.maps.ledger || null, ...(dinnerPool.length ? { dinner: true } : {}) });
  if (!budget.within_ceiling && !input.allowOverBudget) throw new PlanBudgetError(budget);
  const built = [], evenings = [];
  const dropped = restart ? unassigned.map((x) => ({ ...x, reason: restartReason(restart, x.reason) })) : unassigned.slice();   // C12: every drop is the re-plan's
  const usage = { matrix_elements: 0, route_calls: 0 };
  // TRANSIT asks rail first and re-asks with buses only for pairs rail could not serve (planner-transit.mjs); where Google
  // has no transit route at all (Japan), TRANSIT legs become station-based train estimates (planner-rail.mjs).
  const railFirst = withBusFallback(input.maps);
  const railPoints = [...pool.map((c) => ({ placeId: c.place_id, ...(c.loc || {}) })), ...days.flatMap((d) => [d.lodging_start, d.lodging_end, ...(d.start ? [d.start] : []), ...(d.end ? [d.end] : [])]), ...dinnerPool.map((c) => c.point)];
  const maps = input.railEstimates === false ? railFirst : withRailEstimates(railFirst, { points: railPoints });
  for (const day of days) {
    let r;
    if (restart && day.date === restart.date) {
      try { r = await planDay({ ctx, day, cands: byDate[day.date], maps, build_id: String(input.build_id), seed: ctx.seed, verified_on: ctx.today }); }
      catch (err) { throw new Error(`planner: could not re-plan ${day.date} ${restart.note.replace(/^Re-planned /, '')}: ${String(err.message).replace(/^planner: /, '')}`); }   // "could not re-plan <date> at <time> from <where>: <why>"
      mergeRestart(r, restart, { categoryOf: (slug) => (ctx.cands.find((c) => c.id === slug) || {}).category || null });
    } else r = await planDay({ ctx, day, cands: byDate[day.date], maps, build_id: String(input.build_id), seed: ctx.seed, verified_on: ctx.today });
    if (ctx.outlineNotes && ctx.outlineNotes[day.date]) for (const text of ctx.outlineNotes[day.date]) if (r.dayPlan.warnings.length < 40) r.dayPlan.warnings.push({ severity: 'info', code: 'other', text });
    built.push(r.dayPlan);
    evenings.push({ dayPlan: r.dayPlan, evening: r.evening, day });
    dropped.push(...r.dropped);
    usage.matrix_elements += r.usage.matrix_elements; usage.route_calls += r.usage.route_calls;
  }
  const poolIds = new Set([...pool.map((c) => c.id), ...withheld.map((c) => c.id)]);
  const allDays = prior ? prior.days.map((d) => (dates.includes(d.date) ? built.find((b) => b.date === d.date) : JSON.parse(JSON.stringify(d)))) : built;
  const stopIds = new Set(allDays.flatMap((d) => d.stops.map((s) => s.place)));
  // Phase 11: dinners — a place serves dinner on one day only (kept days claim theirs first).
  const keptDinners = new Set(allDays.filter((d) => !dates.includes(d.date)).flatMap((d) => d.meals.filter((m) => m.kind === 'dinner' && m.at && m.at !== 'lodging').map((m) => m.at)));
  const dinners = new Map();
  if (sink) for (const d of built) sink[d.date] = JSON.parse(JSON.stringify({ legs: d.legs, meals: d.meals, free: d.free, warnings: d.warnings }));   // WP-11e: the day before its dinner
  if (dinnerPool.length) {
    const rain = restart && restart.rain ? { date: restart.date, outdoor: new Set([...(input.dinners || []), ...(input.places || [])].filter((p) => p && isIndoor(p) === false).map((p) => p.id)) } : null;
    const { chosen, route_calls } = await addDinners({ built: evenings, pool: dinnerPool, used: new Set(keptDinners), exclude: stopIds, maps, trip: ctx.trip, pace: ctx.pace, ...(ctx.preferDinner && ctx.preferDinner.size ? { prefer: ctx.preferDinner } : {}), ...(rain ? { rain } : {}) });
    usage.route_calls += route_calls;
    for (const c of chosen) dinners.set(c.place.id, c.place);
    // Phase 13 (A5): a dinner whose hours come from old own facts says so on its day.
    for (const c of chosen) {
      const raw = (input.dinners || []).find((p) => p && p.id === c.place.id) || {};
      const rec = c.place.record || {};
      const old = oldFactsDate(rec.facts || raw.facts, ctx.today, { visit: false });
      const dp = built.find((d) => d.date === c.date);
      if (old && dp && dp.warnings.length < 40) dp.warnings.push({ severity: 'info', code: 'other', text: factsOldText(c.place.name, old), place: c.place.id });
    }
  }
  for (const c of withheld) if (!dinners.has(c.id) && !keptDinners.has(c.id)) dropped.push({ cand: c, code: 'day_full', reason: `kept for dinner, but no evening had room for ${c.name}`.slice(0, 300), from_date: null });
  const scheduled = new Set([...stopIds, ...keptDinners, ...dinners.keys()]);
  addRainSwaps(allDays, dates, { places: input.places, snapshots: ctx.snapshots, exclude: new Set([...scheduled, ...(ch ? ch.skip : [])]), dry: restart && restart.rain ? restart.date : null });
  const extra = ch && ch.explicit ? {
    refresh: new Set([...ch.keep, ...ch.skip]),
    kept: input.places.filter((p) => ch.keep.has(p.id)).map((p) => ({ id: p.id, place_id: p.place_id, reason: OWNER_CHOICE_REASON }))
  } : {};
  let later = mergeLater({ trip_id: ctx.trip.id, previous: prior ? prior.later : null, pool: poolIds, dropped, saved: ctx.saved, today: ctx.today, ...extra });
  if (dinners.size || keptDinners.size) later = later.map((l) => ({ ...l, items: l.items.filter((it) => !scheduled.has(it.place)) }));   // a dinner place is scheduled
  const inLater = new Set(later.flatMap((l) => l.items.map((it) => it.place)));
  const places = input.places.map((p) => {
    const { scheduled_hint, ...rest } = p;
    if (ch) return choiceStatus(p, rest, { ch, scheduled, inLater });
    if (scheduled.has(p.id)) return { ...rest, status: 'scheduled' };
    if (inLater.has(p.id)) return { ...rest, status: 'saved-for-later' };
    return poolIds.has(p.id) && p.status === 'scheduled' ? { ...rest, status: 'candidate' } : rest;
  });
  const known = new Set(places.map((p) => p.id));
  for (const d of dinners.values()) if (!known.has(d.id)) { const { scheduled_hint, ...rest } = d.record; places.push({ ...rest, status: 'scheduled' }); }   // dinner places go into plan.places
  if (ctx.evening) addEvening(allDays, dates, evenings, { ctx, places, later, scheduled });
  for (const d of built) withMorning(ctx.trip, d);   // C12: leave_by and areas on every built day (kept days stay as they were)
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
 * Phase 11: each re-built day's sunset and evening extras. A saved place is offered on one day only (kept days claim
 * theirs first); scheduled places (stops and dinners) and rejected ones are never offered.
 */
function addEvening(allDays, dates, evenings, { ctx, places, later, scheduled }) {
  const used = new Set(allDays.filter((d) => !dates.includes(d.date)).flatMap((d) => (d.extras || []).filter((x) => x.kind === 'saved').map((x) => x.ref)));
  const exclude = new Set([...scheduled, ...places.filter((p) => p.status === 'rejected').map((p) => p.id)]);
  const inLater = new Set(later.flatMap((l) => l.items.map((it) => it.place)));
  for (const { dayPlan, evening, day } of evenings) {
    const sunset = sunsetFor(day, ctx.trip.timezone);
    if (sunset) dayPlan.sunset = sunset;
    applyExtras(dayPlan, eveningExtras({ evening, date: day.date, season: ctx.trip.season, places, snapshots: ctx.snapshots, exclude, used, later: inLater }));
  }
}

/**
 * Rainy-day swaps (planner-rain.mjs) on every re-built date; a kept day keeps its swaps except a place now scheduled or
 * skipped, and a place is offered on one day only (kept days claim theirs first).
 */
function addRainSwaps(allDays, dates, { places, snapshots, exclude, dry = null }) {
  const used = new Set(), byDate = allDays.slice().sort((a, b) => a.date.localeCompare(b.date));
  for (const d of byDate) {
    if (dates.includes(d.date) || !d.rain_swaps) continue;
    d.rain_swaps = d.rain_swaps.filter((r) => !exclude.has(r.place) && !used.has(r.place));
    d.rain_swaps.forEach((r) => used.add(r.place));
    if (!d.rain_swaps.length) delete d.rain_swaps;
  }
  for (const d of byDate) {
    if (!dates.includes(d.date)) continue;
    // C12: a rainy re-plan already chose covered places (no swaps); a visited stop is never swapped out.
    const swaps = d.date === dry ? [] : rainSwaps({ day: d.stops.some((s) => s.visited) ? { ...d, stops: d.stops.filter((s) => !s.visited) } : d, places, snapshots, exclude, used });
    if (swaps.length) d.rain_swaps = swaps; else delete d.rain_swaps;
  }
}

export async function planTrip(input) {
  const ch = resolveChoices(input && input.places, input && input.choices, true);
  const ctx = await context(ch ? { ...input, places: ch.places } : input);
  return build(ctx, input, { dates: ctx.days.map((d) => d.date), pool: ctx.cands, prior: null, ch, withheld: ctx.withheld });
}

/**
 * replanDays(plan, dates, input): the pool is every place scheduled on `dates` in `plan` plus every place whose status
 * is `candidate` (a promoted place carries `scheduled_hint`); places scheduled on other days are untouched.
 * Choices: `input.choices` when given (explicit; `null` = none), else the choices the plan recorded (a pool filter).
 * C12: with `input.from` ({ time, place } or { time, point: { lat, lng } }) and exactly one date, the day's `visited`
 * stops are kept and the rest of the day is planned from there (planner-restart.mjs); `visited` and `rain` without
 * `from` are ignored, so a re-plan without `from` is exactly what it was.
 */
export async function replanDays(plan, dates, input) {
  if (!plan || plan.v !== 1 || !Array.isArray(plan.days)) fail('replanDays needs a v1 Plan');
  if (!Array.isArray(dates) || !dates.length) fail('replanDays needs at least one date');
  for (const d of dates) if (!plan.days.some((x) => x.date === d)) fail(`date ${d} is not in the plan`);
  const restarting = input.from !== undefined && input.from !== null;
  // C12: a re-plan from where you are takes back what that day dropped for lack of time.
  const places = restarting ? lateAgain(plan, dates[0], input.places || plan.places) : input.places || plan.places;
  const explicit = input.choices !== undefined;
  const ch = resolveChoices(places, explicit ? input.choices : plan.choices || null, explicit);
  const ctx = await context({ ...input, places: ch ? ch.places : places, build_id: input.build_id || plan.build_id });
  // A place scheduled on a kept day — a stop, or (Phase 11) its dinner — stays there.
  const elsewhereDay = new Map(plan.days.filter((d) => !dates.includes(d.date)).flatMap((d) => [...d.stops.map((s) => [s.place, d.date]), ...d.meals.filter((m) => m.kind === 'dinner' && m.at && m.at !== 'lodging').map((m) => [m.at, d.date])]));
  const elsewhere = new Set(elsewhereDay.keys());
  if (ch && ch.explicit) {
    for (const slug of [...ch.keep, ...ch.skip]) if (elsewhereDay.has(slug)) fail(`choices keep or skip "${slug}", which is scheduled on ${elsewhereDay.get(slug)}, a day not being re-planned (re-plan that day too)`);
  }
  let pool = ctx.cands.filter((c) => !elsewhere.has(c.id));
  const withheld = ctx.withheld.filter((c) => !elsewhere.has(c.id));
  // C12: a re-plan from where you are (one date): the visited stops are kept, the rest of the day is planned from `from`.
  let restart = null;
  if (restarting) {
    if (dates.length !== 1) fail('a re-plan from where you are takes exactly one date');
    const working = ch ? ch.places : places;
    restart = prepareRestart({ ctx, plan, date: dates[0], input, places: working });
    pool = pool.filter((c) => !restart.visited.has(c.id));
    if (restart.rain) { const byId = new Map(working.map((p) => [p.id, p])); pool = pool.map((c) => ({ ...c, rain: coveredFor(byId.get(c.id), c.category) })); }
  }
  return build(ctx, { ...input, places, build_id: input.build_id || plan.build_id }, { dates, pool, prior: plan, ch, withheld, restart });
}

/**
 * WP-11e: plan only `dates` (no prior plan) from the candidates `only` names (a Set of slugs; default every candidate).
 * `sink` (an object) receives each built day's legs, meals, free and warnings as they were before its dinner.
 */
export async function planDates(input, dates, { only = null, sink = null } = {}) {
  const ch = resolveChoices(input && input.places, input && input.choices, true);
  const ctx = await context(ch ? { ...input, places: ch.places } : input);
  for (const d of dates) if (!ctx.days.some((x) => x.date === d)) fail(`date ${d} is not a trip date`);
  const pool = only ? ctx.cands.filter((c) => only.has(c.id)) : ctx.cands;
  return build(ctx, input, { dates, pool, prior: null, ch, withheld: ctx.withheld, sink });
}

/**
 * WP-11e: the per-date pools of an outlined trip — no API call. Every candidate goes to its best date with no stop cap
 * (a free day takes none): pools[date] (anchors first, then priority), anchors[date], unplaced (the Later drops),
 * capacity[date] (the stops one plan of that day can hold), dinners[date] (each dinner place on one date: its booking's
 * date, else its outline date, else a date whose lodging or area it is near and that it is open for dinner, fewest
 * first, else the nearest date) and days[date] (the planner's day record).
 */
export async function outlinePools(input) {
  const ch = resolveChoices(input && input.places, input && input.choices, true);
  const ctx = await context(ch ? { ...input, places: ch.places } : input);
  const { byDate, later } = assign({ days: ctx.days, cands: ctx.cands, rng: ctx.rng, uncapped: true });
  const order = (c, date) => [c.booking || c.anchor === date ? 0 : 1, c.priority, ctx.rng.key(c.id)];
  const cmp = (date) => (a, b) => { const x = order(a, date), y = order(b, date); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  const pools = {}, anchors = {}, capacity = {}, days = {};
  for (const day of ctx.days) {
    pools[day.date] = byDate[day.date].slice().sort(cmp(day.date));
    anchors[day.date] = pools[day.date].filter((c) => c.anchor === day.date || (c.booking && c.booking.date === day.date)).map((c) => c.id);
    capacity[day.date] = outlineCap(day, dayCapacity(day));
    days[day.date] = day;
  }
  const dinnerPool = prepareDinners(input.dinners, { snapshots: ctx.snapshots, dates: ctx.days.map((d) => d.date), places: ch ? ch.places : input.places, choices: ch });
  return { trip: ctx.trip, dates: ctx.days.map((d) => d.date), days, pools, anchors, capacity, unplaced: later, dinners: dinnerHomes(ctx, dinnerPool), dinner: dinnerPool.length > 0, withheld: ctx.withheld.map((c) => c.id), saved: ctx.saved.map((p) => p.id), today: ctx.today };
}

/** One home date per dinner place (outlinePools). */
function dinnerHomes(ctx, pool) {
  const out = Object.fromEntries(ctx.days.map((d) => [d.date, []]));
  const evenings = ctx.days.filter((d) => !d.end);
  const bookings = Array.isArray(ctx.trip.bookings) ? ctx.trip.bookings : [];
  const openFor = (c, date) => { const h = c.hours[date]; return !!h && (h.status === 'always' || (h.status === 'open' && h.windows.some((w) => w.close >= DINNER_EARLIEST + ctx.pace.dinner))); };
  const near = (c, d) => haversineKm(c.loc, d.lodging_end) <= DINNER.RADIUS_KM || !!(d.outline && d.outline.area && haversineKm(c.loc, d.outline.area) <= d.outline.area.radius_km);
  for (const c of pool.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    const booked = bookings.find((b) => b && b.place === c.id && out[b.for_date]);
    let home = booked ? booked.for_date : ctx.preferDinner && [...ctx.preferDinner].find(([, s]) => s === c.id)?.[0];
    if (!home) {
      const ok = evenings.filter((d) => near(c, d) && openFor(c, d.date)).sort((a, b) => out[a.date].length - out[b.date].length || a.date.localeCompare(b.date));
      home = ok.length ? ok[0].date : (evenings.slice().sort((a, b) => haversineKm(c.loc, a.lodging_end) - haversineKm(c.loc, b.lodging_end) || a.date.localeCompare(b.date))[0] || ctx.days[0]).date;
    }
    out[home].push(c.id);
  }
  return out;
}

/**
 * WP-11e: what `count` versions of one day would spend at most — each version counted as a full day of the pool's first
 * capacity places (no cache credit), dinner legs included — checked against the ledger. No API call.
 */
export function versionSetBudget({ day, pool, capacity, count, ledger = null, dinner = false }) {
  const days = Array.from({ length: count }, () => day);
  return budgetFor({ days, byDate: { [day.date]: pool.slice(0, capacity) }, ledger, ...(dinner ? { dinner } : {}) });
}

/** What a planTrip would spend, checked against the ledger — no API call. */
export async function estimateBudget(input) {
  const ch = resolveChoices(input && input.places, input && input.choices, true);
  const ctx = await context(ch ? { ...input, places: ch.places } : input);
  const { byDate } = assign({ days: ctx.days, cands: ctx.cands, rng: ctx.rng });
  const dinner = prepareDinners(input.dinners, { snapshots: ctx.snapshots, dates: ctx.days.map((d) => d.date), places: ch ? ch.places : input.places, choices: ch }).length > 0;
  return budgetFor({ days: ctx.days, byDate, ledger: input.maps.ledger || null, ...(dinner ? { dinner } : {}) });
}

// Developed by: LightAISolutions

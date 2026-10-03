/**
 * Tour Guide journey — two or three versions of one day under the chosen outline (suggestion 8b).
 *   planVersions(input, { date, count = 3, cache? }) → { payload, versions, budget, cache, reason? }
 * input is a planTrip input with `outline` (the planner input from outlineInput) and a Maps-kit client in `maps`.
 *   · the day's pool is every candidate whose best date (outlinePools: the outline's areas, kinds and anchors, no stop
 *     cap) is `date`; the dinner places are the date's share (each dinner place has one home date, so two days never
 *     want the same place);
 *   · the day's anchors (its bookings and the picks the outline pinned to it) are held in every place version, so two
 *     place versions are compared on their other stops;
 *   · version A plans the whole pool; version k plans it minus every non-anchor stop of the versions before it, with
 *     seed + k, so any two place versions share only anchors. A place version is kept when it brings a new stop that
 *     is no anchor, shares at most half of its other stops with every kept version (shared × 2 ≤ the smaller count)
 *     and holds at least half as many of them as A (fewer is a scrap of A's leftovers); the first one that is not kept
 *     ends the place versions. A day whose whole pool fits is one place version: halves of it would only be lighter
 *     copies of A, and the slower day is that choice with A's best places in it;
 *   · a slower day: when fewer than `count` versions came and version A is busy (less than PACE.BUSY spare minutes),
 *     A without its lowest-value stops that are not booked — non-picks first, then the lowest priority, then the most
 *     time — at most PACE.DROPS of them, until their visits add up to PACE.GAIN minutes, at least one stop kept; it is
 *     kept when it gives at least PACE.GAIN more spare minutes. It shares its stops with A by design: what differs is
 *     the time, and its card says what it leaves out;
 *   · the budget guard (versionSetBudget) counts the whole set — count + 1 full days of the pool's first places (a
 *     place version that is not kept or the slower day's try included), dinner legs included — before the first
 *     request and throws PlanBudgetError, nothing sent, when it would pass a ceiling;
 *   · route answers are shared by every version (cachedMaps: one request per point pair; pass `cache` to share it with
 *     other dates too); each version's DayPlan counts only the requests it really sent;
 *   · no snapshot is fetched: the routine's snapshots are input, shared by every version.
 * Result: { payload, versions, anchors, budget, usage (every request the set sent, tries not kept included), cache
 * (the cache's counters), pool }. Each version: { key, pace? (true for the slower day), summary (the day_versions
 * fields), plan (a one-day Plan), day (its DayPlan), undo (the day before its dinner), usage }. A day with one possible
 * version (a free day, a tiny pool, a day that fits with room to spare) returns that one alone: its payload carries one
 * version and `reason` says why there is nothing to compare. Every date answered gets a payload, so the core, which
 * offers 🧱 Build my plan once every trip date has its versions, never waits for a date that cannot vary.
 */
import { outlinePools, planDates, versionSetBudget, PlanBudgetError } from '../planner/index.mjs';
import { cachedMaps } from './journey-cache.mjs';
import { clip, joinWords, count as countText, minutesText, LIMITS, KEYS } from './journey-text.mjs';

const fail = (m) => { throw new Error('journey: ' + m); };
const SEVERITY = { alert: 0, warn: 1, info: 2 };
/** The slower day: offered when version A has less than BUSY spare minutes; it must free GAIN minutes, dropping at most DROPS stops. */
export const PACE = Object.freeze({ BUSY: 120, GAIN: 60, DROPS: 2 });

export async function planVersions(input, { date, count = 3, cache = null } = {}) {
  if (!input || !input.maps) fail('planVersions needs a plan input with a Maps-kit client');
  if (![2, 3].includes(count)) fail('count must be 2 or 3');
  const P = await outlinePools(input);
  if (!P.dates.includes(date)) fail(`${date} is not a trip date`);
  const day = P.days[date], pool = P.pools[date], capacity = P.capacity[date];
  const dinnerIds = new Set(P.dinners[date]);
  const dinners = Array.isArray(input.dinners) ? input.dinners.filter((d) => d && dinnerIds.has(d.id)) : undefined;
  // The set may plan one day more than it keeps: a place version that is not kept, or the slower day's try.
  const budget = versionSetBudget({ day, pool, capacity, count: count + 1, ledger: input.maps.ledger || null, dinner: !!(dinners && dinners.length) });
  if (!budget.within_ceiling && !input.allowOverBudget) throw new PlanBudgetError(budget);
  const maps = cache || cachedMaps(input.maps);
  const anchors = new Set(P.anchors[date]);
  const names = new Map([...(input.places || []), ...(input.dinners || [])].filter((p) => p && p.id).map((p) => [p.id, p.name]));
  const picks = new Set([...(input.places || []).filter((p) => p && p.status === 'chosen').map((p) => p.id), ...((input.choices && Array.isArray(input.choices.picks)) ? input.choices.picks : [])]);
  const baseSeed = Number.isInteger(input.seed) ? input.seed : 1;
  const start = maps.stats ? maps.stats() : null;
  const planOne = async (only, k) => {
    const sink = {}, before = maps.stats ? maps.stats() : null;
    const plan = await planDates({ ...input, maps, seed: baseSeed + k, ...(dinners ? { dinners } : {}), allowOverBudget: true }, [date], { only, sink });
    const dp = plan.days[0];
    if (before) {   // the requests this version really sent (cache hits cost nothing)
      const after = maps.stats();
      dp.solver.matrix_elements = after.matrix_units - before.matrix_units;
      dp.solver.route_calls = after.route_requests - before.route_requests;
      plan.usage = { matrix_elements: dp.solver.matrix_elements, route_calls: dp.solver.route_calls };
    }
    // A one-day Plan of the date's share: only the places it schedules, lists or offers (checkPlan holds on it).
    const refs = new Set([...dp.stops.map((s) => s.place), ...dp.meals.map((m) => m.at), ...plan.later.flatMap((l) => l.items.map((it) => it.place))]);
    if (dp.rain_swaps) { dp.rain_swaps = dp.rain_swaps.filter((r) => refs.has(r.place)); if (!dp.rain_swaps.length) delete dp.rain_swaps; }
    plan.places = plan.places.filter((p) => refs.has(p.id));
    return { plan, day: dp, undo: sink[date] || null, usage: plan.usage };
  };
  // Keep a place version only when it brings a new stop that is no anchor, shares at most half of its other stops with
  // every kept one (the anchors are in every place version, so they are not compared) and holds at least half as many
  // of them as A (fewer is a scrap of A's leftovers, and the slower day below is the lighter choice).
  const others = (v) => v.day.stops.map((s) => s.place).filter((s) => !anchors.has(s));
  const keep = (list, r) => {
    const stops = others(r);
    const seen = new Set(list.flatMap((v) => v.day.stops.map((s) => s.place)));
    if (list.length && !stops.some((s) => !seen.has(s))) return false;
    if (list.length && stops.length < Math.ceil(others(list[0]).length / 2)) return false;
    if (list.some((v) => { const o = others(v); return 2 * o.filter((s) => stops.includes(s)).length > Math.min(o.length, stops.length); })) return false;
    list.push({ key: KEYS[list.length], ...r });
    return true;
  };
  // Version A plans from the whole pool; version k from the pool minus every non-anchor stop of the versions before it.
  const versions = [];
  keep(versions, await planOne(new Set(pool.map((c) => c.id)), 0));
  const whole = versions[0];
  const taken = new Set(others(whole));
  for (let k = 1; k < count; k++) {
    const only = new Set(pool.map((c) => c.id).filter((id) => anchors.has(id) || !taken.has(id)));
    if (![...only].some((id) => !anchors.has(id))) break;
    const r = await planOne(only, k);
    if (!keep(versions, r)) break;
    r.day.stops.forEach((s) => taken.add(s.place));
  }
  // The slower day: A without its lowest-value stops that are not booked (picks are kept longest), when A is busy.
  if (versions.length < count && capacity > 0 && (whole.day.spare_minutes || 0) < PACE.BUSY) {
    const slow = await slowerDay(whole, { pool, date, picks, places: input.places, plan: (only) => planOne(only, count) });
    if (slow) versions.push({ key: KEYS[versions.length], pace: true, ...slow });
  }
  for (const v of versions) v.summary = summarize(v, { pool, names, picks });
  const end = maps.stats ? maps.stats() : null;
  const usage = start ? { matrix_elements: end.matrix_units - start.matrix_units, route_calls: end.route_requests - start.route_requests } : null;
  const out = { versions, anchors: [...anchors], budget, usage, cache: end, pool: pool.map((c) => c.id) };
  out.payload = { v: 1, kind: 'day_versions', trip: P.trip.id, build_id: String(input.build_id), date, versions: versions.map((v) => v.summary) };
  if (versions.length < LIMITS.OPTIONS_MIN) out.reason = capacity === 0 ? 'a free day: nothing to compare' : 'only one way to plan this day';
  return out;
}

/**
 * The slower day from version A (`whole`): A without its lowest-value stops that are not booked for the date —
 * non-picks first, then the lowest priority (the owner's own, not the outline's), then the most time (the visit and the
 * legs to and from it), then the slug — at most PACE.DROPS of them, until their visits add up to PACE.GAIN minutes;
 * at least one stop stays. `plan(only)` plans the date from the slugs left. null when nothing can go, when the day
 * would bring a stop A does not have, or when it gains less than PACE.GAIN spare minutes.
 */
async function slowerDay(whole, { pool, date, picks, places, plan }) {
  const d = whole.day;
  const inPool = new Map(pool.map((c) => [c.id, c]));
  const booked = (s) => { const c = inPool.get(s.place); return !!s.booked || !!(c && c.booking && c.booking.date === date); };
  const prio = new Map((places || []).filter((p) => p && p.id).map((p) => [p.id, Number.isFinite(p.priority) ? p.priority : 2]));
  const legs = (pred) => d.legs.filter(pred).reduce((t, l) => t + (Number.isFinite(l.minutes) ? l.minutes : 0), 0);
  const cost = (s) => (s.minutes || 0) + legs((l) => l.to === s.place) + legs((l) => l.from === s.place);
  const can = d.stops.filter((s) => inPool.has(s.place) && !booked(s)).sort((a, b) =>
    (picks.has(a.place) ? 1 : 0) - (picks.has(b.place) ? 1 : 0) || (prio.get(b.place) ?? 2) - (prio.get(a.place) ?? 2)
    || cost(b) - cost(a) || a.place.localeCompare(b.place));
  const drop = new Set();
  let freed = 0;
  for (const s of can) {
    if (drop.size >= PACE.DROPS || freed >= PACE.GAIN || d.stops.length - drop.size <= 1) break;
    drop.add(s.place); freed += s.minutes || 0;
  }
  if (!drop.size) return null;
  const r = await plan(new Set(d.stops.map((s) => s.place).filter((id) => inPool.has(id) && !drop.has(id))));
  const was = new Set(d.stops.map((s) => s.place));
  if (!r.day.stops.length || r.day.stops.some((s) => !was.has(s.place))) return null;
  if ((r.day.spare_minutes || 0) < (d.spare_minutes || 0) + PACE.GAIN) return null;
  return r;
}

/** The day_versions fields of one version, in plain words within the bounds. */
export function summarize(v, { pool, names, picks = new Set() }) {
  const d = v.day;
  const nameOf = (slug) => clip(names.get(slug) || slug, LIMITS.NAME);
  const stops = d.stops.slice(0, LIMITS.STOPS).map((s) => ({ slug: s.place, name: nameOf(s.place), time: s.arrive }));
  const sum = (pred) => Math.min(1440, d.legs.filter(pred).reduce((t, l) => t + (Number.isFinite(l.minutes) ? l.minutes : 0), 0));
  const walk = sum((l) => l.mode === 'WALK'), transit = sum((l) => l.mode === 'TRANSIT' || l.mode === 'DRIVE');
  const spare = Math.min(1440, Math.max(0, Math.round(d.spare_minutes || 0)));
  const dinner = d.meals.find((m) => m.kind === 'dinner' && m.at && m.at !== 'lodging');
  const bookings = [];
  for (const s of d.stops) if (s.booked) bookings.push(clip(`${nameOf(s.place)}: ${s.booked}`, LIMITS.BOOKING));
  if (dinner && dinner.booking) bookings.push(clip(`${nameOf(dinner.at)}: ${dinner.booking}`, LIMITS.BOOKING));
  const inDay = new Set(d.stops.map((s) => s.place));
  const left = pool.filter((c) => !inDay.has(c.id)).map((c) => ({ c, pick: picks.has(c.id) ? 0 : 1 }));
  const leaves_out = left.sort((a, b) => a.pick - b.pick || a.c.priority - b.c.priority || a.c.id.localeCompare(b.c.id)).slice(0, LIMITS.LEAVES_OUT).map(({ c }) => ({ slug: c.id, name: nameOf(c.id) }));
  const seen = new Set();
  const warnings = d.warnings.slice().sort((a, b) => (SEVERITY[a.severity] ?? 3) - (SEVERITY[b.severity] ?? 3))
    .map((w) => clip(w.text, LIMITS.WARNING)).filter((t) => t && !seen.has(t) && seen.add(t)).slice(0, LIMITS.WARNINGS);
  const n = stops.length;
  const list = n ? (n <= 2 ? joinWords(stops.map((s) => s.name)) : `${stops[0].name}, ${stops[1].name} and ${n - 2} more`) : (d.free.length ? 'A free day' : 'An empty day');
  const title = v.pace && n ? `A slower day: ${list}` : list;
  const parts = [countText(n, 'stop'), `${minutesText(walk)} walking`];
  if (transit) parts.push(`${minutesText(transit)} on trains or by car`);
  parts.push(`${minutesText(spare)} spare`);
  if (dinner) parts.push(`dinner at ${nameOf(dinner.at)}`);
  return { key: v.key, title: clip(title, LIMITS.TITLE), summary: clip(parts.join(', '), LIMITS.SUMMARY), stops, walk_minutes: walk, transit_minutes: transit, spare_minutes: spare, bookings: bookings.slice(0, LIMITS.BOOKINGS), leaves_out, warnings };
}

// Developed by: LightAISolutions

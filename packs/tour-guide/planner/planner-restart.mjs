/**
 * Tour Guide planner — a re-plan from where you are (Phase 12, WP-12a; Contract C12 planner input `from`, `visited`,
 * `rain`). replanDays(plan, [date], { ...input, from, visited, rain }) re-plans the rest of ONE day:
 *   · the `visited` stops (that day's stops already done, kept in the day's order) keep their times, legs and fields
 *     and carry `visited: true`; between two of them a stop that was not visited is passed over by one leg kept from the
 *     old times (not re-routed, no Maps request);
 *   · the rest of the day starts at `from.time` (never before the day's start or the last visited stop's arrival) from
 *     `from.place` (a stop of that day — the last visited one, added to `visited` when missing — at its snapshot's
 *     coordinates) or from `from.point` (the reserved point 'here', named "where you were": its coordinates reach the
 *     Routes API and nothing else, never the plan or a link);
 *   · it is planned as a day of its own (planner-day.mjs: a day override starting there, under the day's end, its
 *     dinner and every Phase 10–11 rule), from every place the re-plan may use except the visited ones — a stop of the
 *     day that was not visited (the core dropped it for running late, say) is a candidate again, and so is a place the
 *     plan put on the Later list because that day ran out of time (lateAgain: code day_full, from_date the day);
 *   · with `rain: true` covered places (isCoveredSight) and indoor meals come first: they rank first for the day's
 *     places and outweigh any set of outdoor ones in the solver (planner-rain.mjs RAIN.COVERED_FACTOR), so an outdoor place is planned
 *     only where nothing covered fits; the day gets no rain swaps;
 *   · what no longer fits goes to the Later list, its reason saying it was the re-plan.
 * The re-planned day costs no Maps request a normal re-plan of that day would not (planner-budget.mjs counts it as a
 * day override: the restart point, the end, a bag point).
 *   restartErrors({ from, visited, rain }) → [{ path, message }]   the request's shape (C12 bounds), no plan needed
 *   prepareRestart({ ctx, plan, date, input, places }) → restart     validated against the plan; throws on a bad request
 *   mergeRestart(result, restart) → result                           the new part's DayPlan merged with the kept part
 */
import { toMin, hm } from './planner-time.mjs';
import { isLoc } from './planner-geo.mjs';
import { dayAnchors, LODGING_SLUG, START_SLUG, END_MARGIN } from './planner-anchors.mjs';
import { legUrl, pointKey } from './planner-legs.mjs';
import { estimatedWarning } from './planner-day.mjs';

/** The reserved point of a re-plan from a shared location (C12), and its name on the card. */
export const HERE_SLUG = 'here';
export const HERE_NAME = 'where you were';
/** C12 bounds of the request. */
export const RESTART = Object.freeze({ MAX_VISITED: 25 });
/** The leg kept between two visited stops when a stop between them was not visited. */
export const PASSED_OVER_NOTE = 'Kept from before the re-plan; not re-routed';

/**
 * lateAgain(plan, date, places) → places: a place the plan put on the Later list because `date` ran out of time
 * (code day_full, from_date `date`) is a candidate again for a re-plan of that date (its status `saved-for-later`, which
 * the plan gave it, reads as `candidate`). Every other place is returned as it is; the input is never changed.
 */
export function lateAgain(plan, date, places) {
  if (!Array.isArray(places)) return places;
  const late = new Set((Array.isArray(plan && plan.later) ? plan.later : []).flatMap((l) => (Array.isArray(l && l.items) ? l.items : []))
    .filter((i) => i && i.code === 'day_full' && i.from_date === date).map((i) => i.place));
  if (!late.size) return places;
  return places.map((p) => (p && late.has(p.id) && p.status === 'saved-for-later' ? { ...p, status: 'candidate' } : p));
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const fail = (m) => { throw new Error('planner: ' + m); };
const plainObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

/** A Later reason from the re-planned day, saying it was the re-plan: "re-planned at HH:MM: <reason>" (≤ 300). */
export function restartReason(restart, reason) { return `re-planned at ${hm(restart.T)}: ${reason}`.slice(0, 300); }

/** The C12 request shape: from = { time, place? | point? { lat, lng } } (exactly one), visited ≤ 25 slugs once each, rain = true. */
export function restartErrors({ from, visited, rain } = {}) {
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  if (!plainObject(from)) e('/from', 'must be an object { time, place } or { time, point }');
  else {
    for (const k of Object.keys(from)) if (!['time', 'place', 'point'].includes(k)) e('/from/' + k, 'unknown key');
    if (!TIME_RE.test(from.time || '')) e('/from/time', 'must be HH:MM');
    const hasPlace = from.place !== undefined, hasPoint = from.point !== undefined;
    if (hasPlace === hasPoint) e('/from', 'exactly one of place and point');
    if (hasPlace && !SLUG_RE.test(String(from.place))) e('/from/place', 'must be a place slug');
    if (hasPlace && from.place === HERE_SLUG) e('/from/place', `"${HERE_SLUG}" is reserved; send a point`);
    if (hasPoint) {
      const p = from.point;
      if (!plainObject(p)) e('/from/point', 'must be { lat, lng }');
      else {
        for (const k of Object.keys(p)) if (k !== 'lat' && k !== 'lng') e('/from/point/' + k, 'unknown key');
        if (!(typeof p.lat === 'number' && p.lat >= -90 && p.lat <= 90)) e('/from/point/lat', 'must be a number from -90 to 90');
        if (!(typeof p.lng === 'number' && p.lng >= -180 && p.lng <= 180)) e('/from/point/lng', 'must be a number from -180 to 180');
      }
    }
  }
  if (visited !== undefined) {
    if (!Array.isArray(visited)) e('/visited', 'must be an array of place slugs');
    else {
      if (visited.length > RESTART.MAX_VISITED) e('/visited', `at most ${RESTART.MAX_VISITED} places`);
      const seen = new Set();
      visited.forEach((s, i) => {
        if (typeof s !== 'string' || !SLUG_RE.test(s)) e(`/visited/${i}`, 'must be a place slug');
        else if (seen.has(s)) e(`/visited/${i}`, `"${s}" is listed twice`);
        seen.add(s);
      });
    }
  }
  if (rain !== undefined && rain !== true) e('/rain', 'must be true when present');
  return errs;
}

/** A planner point for a stop slug of the prior day (its snapshot location), for a passed-over leg's link. */
function pointOf(slug, { ctx, day, prior, stopsById }) {
  if (slug === LODGING_SLUG) {
    const hotelFirst = prior.bags && prior.bags.kind === 'hotel' && prior.legs.length && prior.legs[0].to === LODGING_SLUG && prior.legs[0].from !== LODGING_SLUG;
    return hotelFirst ? day.lodging_end : day.lodging_start;
  }
  if (slug === START_SLUG && day.start) return day.start;
  const s = stopsById.get(slug), snap = s ? ctx.snapshots.get(s.place_id) : null;
  return snap && isLoc(snap.location) ? { placeId: s.place_id, lat: snap.location.lat, lng: snap.location.lng, name: s.name || slug } : null;
}

/** Minutes between two clock times (across midnight when b < a). */
const span = (a, b) => { const d = toMin(b) - toMin(a); return d < 0 ? d + 1440 : d; };

/**
 * prepareRestart({ ctx, plan, date, input, places }) → { date, T, day, history, visited, rain, prior, from, note }
 * `day` is the planner day the rest is planned as (an override starting at the restart point); `history` holds the
 * kept part (stops, legs, meals, free, warnings).
 */
export function prepareRestart({ ctx, plan, date, input, places }) {
  const errs = restartErrors({ from: input.from, visited: input.visited, rain: input.rain });
  if (errs.length) fail(`re-plan request: ${errs.map((x) => `${x.path} ${x.message}`).join('; ')}`);
  const prior = plan.days.find((d) => d.date === date);
  const day = ctx.days.find((d) => d.date === date);
  if (!prior || !day) fail(`date ${date} is not in the plan`);
  const byId = new Map(places.map((p) => [p.id, p]));
  if (byId.has(HERE_SLUG)) fail(`a place may not use the reserved slug "${HERE_SLUG}"`);
  const from = input.from;
  // Visited: that day's stops only, in the day's order; from.place is the last of them.
  const asked = new Set(input.visited || []);
  const ignored = [...asked].filter((s) => !prior.stops.some((x) => x.place === s));
  if (from.place !== undefined) {
    if (!prior.stops.some((x) => x.place === from.place)) fail(`re-plan from "${from.place}": it is not a stop of ${date} (send a point to start anywhere else)`);
    asked.add(from.place);
  }
  const visited = prior.stops.filter((s) => asked.has(s.place));
  if (from.place !== undefined && visited[visited.length - 1].place !== from.place) fail(`re-plan from "${from.place}": the day's stops visited after it (${visited.slice(visited.findIndex((s) => s.place === from.place) + 1).map((s) => s.place).join(', ')}) come later in the day; start from the last one`);
  const lastV = visited.length ? visited[visited.length - 1] : null;
  const T = Math.max(toMin(from.time), day.dayStart, lastV ? toMin(lastV.arrive) : 0);
  const hard = day.end ? day.end.time - END_MARGIN : day.dayEnd;
  if (T >= hard) fail(`too late to re-plan ${date} at ${hm(T)}: the day ends at ${hm(hard)}`);

  // The restart point.
  let F;
  if (from.point) F = { id: HERE_SLUG, slug: HERE_SLUG, name: HERE_NAME, placeId: null, lat: from.point.lat, lng: from.point.lng, time: T, here: true };
  else {
    const p = byId.get(from.place) || {}, snap = ctx.snapshots.get(lastV.place_id);
    if (!snap || !isLoc(snap.location)) fail(`re-plan from "${from.place}": no snapshot location for it`);
    F = { id: from.place, slug: from.place, name: String(p.name || from.place).slice(0, 120), placeId: lastV.place_id, lat: snap.location.lat, lng: snap.location.lng, time: T };
  }

  // The kept part: the hotel bag leg once the bags are left, then the legs to each visited stop.
  const PL = prior.legs;
  const stopsById = new Map(prior.stops.map((s) => [s.place, { ...s, name: (byId.get(s.place) || {}).name }]));
  const bags = prior.bags || null;
  const hotelLeg = !!(bags && bags.kind === 'hotel' && PL.length && PL[0].to === LODGING_SLUG && PL[0].from !== LODGING_SLUG);
  const hotelDone = !!(bags && bags.kind === 'hotel' && (visited.length || (bags.end && toMin(bags.end) <= T)));
  const legs = [];
  let idx = 0, prev = PL.length ? PL[0].from : LODGING_SLUG;
  if (hotelLeg && hotelDone) { legs.push(JSON.parse(JSON.stringify(PL[0]))); idx = 1; prev = LODGING_SLUG; }
  for (const v of visited) {
    const j = PL.findIndex((l, i) => i >= idx && l.to === v.place);
    if (j < 0) fail(`the plan has no leg to ${v.place} on ${date}`);
    if (j === idx && PL[j].from === prev) legs.push(JSON.parse(JSON.stringify(PL[j])));
    else {
      const a = PL[idx], b = PL[j];
      const fp = pointOf(prev, { ctx, day, prior, stopsById }), tp = pointOf(v.place, { ctx, day, prior, stopsById });
      const leg = { from: prev, to: v.place, mode: day.mode, depart_at: a.depart_at, arrive_at: b.arrive_at, minutes: span(a.depart_at, b.arrive_at), distance_m: PL.slice(idx, j + 1).reduce((s, l) => s + (l.distance_m || 0), 0), source: 'route', maps_url: fp && tp ? legUrl(fp, tp, day.mode) : b.maps_url, note: PASSED_OVER_NOTE };
      legs.push(leg);
    }
    idx = j + 1; prev = v.place;
  }
  const visitedIds = new Set(visited.map((s) => s.place));
  const stops = visited.map((s) => ({ ...JSON.parse(JSON.stringify(s)), visited: true }));
  const histEnd = lastV ? toMin(lastV.arrive) : hotelLeg && hotelDone && bags.end ? toMin(bags.end) : -1;
  const kept = (m) => toMin(m.end) <= T && (m.at === LODGING_SLUG || m.at === START_SLUG || visitedIds.has(m.at));
  const breakfast = prior.meals.filter((m) => m.kind === 'breakfast' && (visited.length || toMin(m.end) <= T));
  const lunch = prior.meals.filter((m) => m.kind === 'lunch' && kept(m));
  const history = {
    stops, legs,
    meals: JSON.parse(JSON.stringify([...breakfast, ...lunch])),
    free: JSON.parse(JSON.stringify(prior.free.filter((f) => histEnd >= 0 && toMin(f.end) <= histEnd))),
    warnings: JSON.parse(JSON.stringify(prior.warnings.filter((w) => w.place && visitedIds.has(w.place) && w.code !== 'transit_estimated')))
  };

  // The rest of the day as a day of its own, starting at F.
  const A = dayAnchors(day);
  const rest = { ...day, override: true, start: F, dayStart: T };
  delete rest.bags; delete rest.lockerAt; delete rest.lockerFrom;
  if (lunch.length) rest.noLunch = true;
  let bagsOut = bags ? JSON.parse(JSON.stringify(bags)) : null;
  if (bags && bags.kind === 'hotel' && !hotelDone) { rest.bags = 'hotel'; bagsOut = null; }   // still to leave them: the new part's step
  else if (bags && bags.kind === 'locker') {
    const stored = !!bags.start && (visited.length > 0 || toMin(bags.start) < T);
    if (stored) { rest.bags = 'locker'; rest.lockerAt = A.S; rest.lockerFrom = toMin(bags.start); }
    else if (pointKey(A.S) === pointKey(F)) { rest.bags = 'locker'; bagsOut = null; }   // still at the locker point: as planned
    else { rest.bags = 'carry'; bagsOut = null; }   // not stored yet and away from the locker point: carried
  } else if (bags && (bags.kind === 'carry' || bags.kind === 'forward')) rest.bags = bags.kind;
  const note = `Re-planned at ${hm(T)} from ${F.here ? HERE_NAME : F.name}${input.rain === true ? ', covered places first' : ''}`.slice(0, 200);
  return { date, T, day: rest, history, visited: visitedIds, ignored, rain: input.rain === true, prior, from: F, bags: bagsOut, note };
}

/**
 * mergeRestart({ dayPlan, dropped, usage, evening }, restart, { categoryOf }) → the same object, its DayPlan now the kept
 * part then the new part. The day keeps its own start, end and bag line; the Maps link covers the rest of the day; the
 * theme reads every stop of the day; a place dropped from the day says it was the re-plan.
 */
export function mergeRestart(r, restart, { categoryOf = () => null } = {}) {
  const d = r.dayPlan, h = restart.history, prior = restart.prior;
  d.stops = [...h.stops, ...d.stops];
  d.legs = [...h.legs, ...d.legs];
  d.meals = [...h.meals, ...d.meals];
  d.free = [...h.free, ...d.free];
  const fresh = d.warnings.filter((w) => w.code !== 'transit_estimated');
  const lines = [{ severity: 'info', code: 'other', text: restart.note }];
  if (restart.ignored.length) lines.push({ severity: 'info', code: 'other', text: `Not stops of this day, so not kept as visited: ${restart.ignored.join(', ')}`.slice(0, 200) });
  const est = estimatedWarning(d.legs);
  d.warnings = [...lines, ...h.warnings, ...fresh, ...(est ? [est] : [])].slice(0, 40);
  if (prior.start) d.start = JSON.parse(JSON.stringify(prior.start)); else delete d.start;
  if (restart.bags) d.bags = restart.bags.kind === 'locker' && d.bags && d.bags.end ? { ...restart.bags, end: d.bags.end } : restart.bags;
  const theme = [...new Set(d.stops.map((s) => categoryOf(s.place)).filter(Boolean))].slice(0, 3);
  if (theme.length) d.theme = theme.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' · '); else delete d.theme;
  r.dropped = r.dropped.map((x) => (x.from_date === restart.date ? { ...x, reason: restartReason(restart, x.reason) } : x));
  return r;
}

// Developed by: LightAISolutions

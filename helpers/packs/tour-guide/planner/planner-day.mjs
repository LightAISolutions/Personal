/**
 * Tour Guide planner — one trip date end to end: Route Matrix → exact solver → real legs pair by pair → timeline on
 * the real legs (re-solve once on the real times, then drop one stop at a time if it still cannot be timed) →
 * cross-check → DayPlan. Returns the DayPlan plus the candidates it had to drop (for the Later list).
 * Phase 11 (WP-11a): an overridden day runs from its own start to its own end (planner-anchors.mjs) with its bag step —
 * hotel: start → the night's lodging, BAGS.HOTEL_MIN minutes there, then the sights from the lodging; locker:
 * BAGS.LOCKER_MIN minutes at the start point, the sights from and back to it, BAGS.COLLECT_MIN minutes, then on to the
 * end. A real end (`end`) is hard: the day reaches it END_MARGIN minutes before its time, so the solver gets no spill and
 * a stop that would make it late is dropped. Facts set hours and lengths (planner-facts.mjs) and a crowd magnet is
 * fitted in its quiet slots (planner-crowd.mjs), or kept where it fits with a warning. The result's `evening` feeds
 * the dinner and extras pass (planner-dinner.mjs, planner-evening.mjs).
 */
import { hm, localToIso } from './planner-time.mjs';
import { earliestFit } from './planner-hours.mjs';
import { solveDay } from './planner-solve.mjs';
import { fetchMatrix, fetchLeg, crossCheck, legUrl, dayLink, pointKey, transitFallback, legAllowance } from './planner-legs.mjs';
import { extraCallsFor, bagLegs } from './planner-budget.mjs';
import { bufferFor } from './planner-buffer.mjs';
import { transitPrefs } from './planner-transit.mjs';
import { LUNCH_WINDOW, DINNER_EARLIEST, breakfastLen } from './planner-input.mjs';
import { minVisit } from './planner-category.mjs';
import { dayAnchors, BAGS, END_MARGIN, START_SLUG, LODGING_SLUG, bagsText } from './planner-anchors.mjs';
import { crowdWindows, crowdSlotOf, CROWD_SLOT } from './planner-crowd.mjs';
import { FREE_DAY_NOTE } from './planner-outline.mjs';

export const SOLVER_METHOD = 'held-karp/time-windows';
export const TIGHT_MINUTES = 10;
export const FREE_MIN = 20;
/** The early-return free line; evening extras replace it (planner-evening.mjs). */
export const BACK_EARLY_NOTE = 'back early; the rest of the day is free';
/** A departure day that reaches its end point early: the time to spare there (Phase 11). */
export const END_SPARE_NOTE = 'time to spare near';
export const TRANSIT_ESTIMATED_TEXT = 'Transit times on this day are estimates; check the Maps link before you go';
export const WALK_ESTIMATED_TEXT = 'Walking times on this day are estimates; check the Maps link before you go';
export const TRAVEL_ESTIMATED_TEXT = 'Travel times on this day are estimates; check the Maps link before you go';
const candPoint = (c) => ({ placeId: c.place_id, lat: c.loc.lat, lng: c.loc.lng, name: c.name, id: c.id, category: c.category });
const windowsOn = (c, date) => (c.hours[date].status === 'open' || c.hours[date].status === 'irregular' ? c.hours[date].windows : []);
/**
 * Phase 11: the windows the schedule fits a stop into — a crowd magnet's quiet slots (unless `relaxed` holds its id),
 * the facts' bounds (close, last entry) of a place whose hours Google does not know, else its own windows. A stop
 * always reports its real window (windowsOn), never a slot or a bound.
 */
export function schedWindows(c, date, relaxed = null) {
  const ws = windowsOn(c, date);
  if (c.crowd && ws.length && !(relaxed && relaxed.has(c.id))) return crowdWindows(ws);
  if (!ws.length && c.hours[date].bounds) return c.hours[date].bounds;
  return ws;
}
/** A 0-minute leg between two names of one point (an overridden day only; asks Google nothing). */
const STAY = Object.freeze({ minutes: 0, distance_m: 0, line: null, transfers: 0, requests: 0, stay: true });
/** Phase 10 fix (e): why to check a stop on the day — irregular opening days or unknown hours (C10 `check_on_day`). */
export const CHECK_IRREGULAR_TEXT = 'Opening days vary — check before you go';
export const CHECK_UNKNOWN_TEXT = 'Opening hours unknown — check before you go';
export function checkOnDay(c, date) {
  const st = c.hours[date].status;
  if (st === 'irregular') return c.opening_note || CHECK_IRREGULAR_TEXT;
  if (st === 'unknown') return c.opening_note || CHECK_UNKNOWN_TEXT;
  return null;
}
/**
 * Phase 10 fix (f): "exact" for booked stops, set sessions (fixed length, experiences) and a stop that starts within
 * EXACT_NEAR_LAST_ENTRY minutes of its last entry (no last-entry data: LAST_ENTRY_BEFORE_CLOSE minutes before the window
 * closes); "about" for every other stop (sights, unbooked meals). The data keeps exact times; only the display rounds.
 */
export const EXACT_NEAR_LAST_ENTRY = 30;
export const LAST_ENTRY_BEFORE_CLOSE = 30;
export function timeStyle(c, start, window) {
  if (c.booking || c.fixed || c.category === 'experience') return 'exact';
  if (window && Number.isFinite(window.last)) return window.last - start <= EXACT_NEAR_LAST_ENTRY ? 'exact' : 'about';   // Phase 11: the place's own last entry
  if (window && window.close < 1440 && window.close - LAST_ENTRY_BEFORE_CLOSE - start <= EXACT_NEAR_LAST_ENTRY) return 'exact';
  return 'about';
}
/** A chosen restaurant or cafe whose activity is lunch is the day's lunch: no separate lunch slot, and it starts in lunchtime. */
export const LUNCH_SPOT_EARLIEST = LUNCH_WINDOW.open - 30;
export const isLunchSpot = (c) => (c.category === 'restaurant' || c.category === 'cafe') && /\blunch\b/i.test(c.activity || '');
function lunchWindows(c, date) {
  const ws = windowsOn(c, date);
  const lo = LUNCH_SPOT_EARLIEST, hi = LUNCH_WINDOW.close + c.minutes;
  return (ws.length ? ws : [{ open: 0, close: 1440 }]).map((w) => ({ open: Math.max(w.open, lo), close: Math.min(w.close, hi) })).filter((w) => w.close - w.open >= c.minutes);
}
/** The pool's lunch spot on `date` (best priority first), or null when none can start inside lunchtime. */
function lunchSpotOf(pool, date) {
  return pool.filter((c) => isLunchSpot(c) && lunchWindows(c, date).length).sort((a, b) => a.priority - b.priority)[0] || null;
}

/** planDay({ ctx, day, cands, maps, build_id, seed, verified_on }) → { dayPlan, dropped, usage } */
export async function planDay({ ctx, day, cands, maps, build_id, seed, verified_on }) {
  const { trip, pace } = ctx;
  const { date, mode } = day;
  const iso = (min) => localToIso(date, min, trip.timezone);
  const breakfast = breakfastLen(day, ctx.breakfastAtLodging);
  const A = dayAnchors(day);
  const tp = mode === 'TRANSIT' ? transitPrefs(trip) : null; // rail first; buses only where rail has no route
  const fallback = mode === 'TRANSIT' ? transitFallback(trip) : null;
  const usage = { matrix_elements: 0, route_calls: 0 };
  const allowance = legAllowance(extraCallsFor(mode, cands.length + 1 + bagLegs(day))); // the day's extra WALK / DRIVE requests, as budgeted (planner-budget.mjs)
  const same = (a, b) => pointKey(a) === pointKey(b);
  // Phase 11: the bag step. A locker is only worth it on a day with sights; without them the day goes straight on.
  const lockerOn = A.locker && cands.length > 0;
  const S = A.coreS, E = lockerOn ? A.S : A.E;
  const pt = (x) => (x === 'S' ? S : x === 'E' ? E : x.slug ? x : candPoint(x));
  const key = (a, b) => pointKey(pt(a)) + '|' + pointKey(pt(b));
  const getLeg = async (from, to, at) => {
    if ((day.override || day.outline) && same(pt(from), pt(to))) return { ...STAY, mode };   // WP-11e: an outline day too
    const leg = await fetchLeg(maps, { from: pt(from), to: pt(to), mode, departureTime: iso(at), transitPreferences: tp, fallback, allowance });
    usage.route_calls += leg.requests;
    return leg;
  };
  let departAt = day.dayStart + breakfast;
  const pre = [], post = [];
  let bag = null;
  if (A.hotel) {
    if (!same(A.S, A.hotel)) {
      const leg = await getLeg(A.S, A.hotel, departAt);
      if (!(leg.minutes < Infinity)) throw new Error(`planner: no route on ${date} from ${A.S.name} to ${A.hotel.name}`);
      pre.push({ kind: 'leg', from: A.S, to: A.hotel, depart: departAt, arrive: departAt + leg.minutes, leg, buffer: 0 });
      departAt += leg.minutes;
    }
    bag = { kind: 'hotel', at: LODGING_SLUG, start: departAt, end: departAt + BAGS.HOTEL_MIN };
    departAt += BAGS.HOTEL_MIN;
  } else if (lockerOn) {
    bag = { kind: 'locker', at: A.S.slug === START_SLUG ? 'day-start' : LODGING_SLUG, start: departAt };
    departAt += BAGS.LOCKER_MIN;
  } else if (day.bags) bag = { kind: day.bags, at: day.bags === 'forward' || A.S.slug !== START_SLUG ? LODGING_SLUG : 'day-start' };

  const points = [S, ...cands.map(candPoint), E];
  if (lockerOn && !same(A.E, A.S)) points.push(A.E);
  const m = await fetchMatrix(maps, { points, mode, departureTime: iso(departAt), transitPreferences: tp, fallback });
  usage.matrix_elements += m.elements;
  const travel = new Map(m.travel); // 'from|to' → { minutes, distance_m, line? }
  // Phase 11: a real end is hard (END_MARGIN early, no spill); a locker day keeps room to collect the bags and go on.
  const hard = day.end ? day.end.time - END_MARGIN : null;
  let tail = 0, postLeg = null;
  if (lockerOn) {
    tail = BAGS.COLLECT_MIN;
    if (!same(A.E, A.S)) {
      const est = travel.get(pointKey(A.S) + '|' + pointKey(A.E));
      const leaveBy = (hard !== null ? hard : day.dayEnd) - tail - (est && est.minutes < Infinity ? est.minutes : 0);
      postLeg = await getLeg(A.S, A.E, Math.max(departAt, leaveBy));
      if (!(postLeg.minutes < Infinity)) throw new Error(`planner: no route on ${date} from ${A.S.name} to ${A.E.name}`);
      tail += postLeg.minutes;
    }
  }
  const coreEnd = (hard !== null ? hard : day.dayEnd) - tail;
  const latest = hard !== null ? coreEnd : null;
  const relaxed = new Set();   // crowd magnets no quiet slot could hold: planned on their full hours
  const winOf = (c) => schedWindows(c, date, relaxed);
  const legs = new Map(); // real legs, same keys
  const dropped = [];
  let pool = cands.slice(), solution = null, timeline = null, resolved = false, finalSpot = null;
  for (let guard = 0; guard <= 2 * cands.length + 3; guard++) {
    let spot = lunchSpotOf(pool, date);
    const at = (x) => (x === 'S' || x === 'E' ? x : pool[x]);
    const tr = (a, b) => { const r = travel.get(key(at(a), at(b))); return r ? r.minutes : Infinity; };
    const buf = (a, b) => { const r = travel.get(key(at(a), at(b))); return r ? bufferFor({ mode, ...r }) : 0; };
    const solve = () => solveDay({ stops: pool.map((c) => ({ minutes: c.minutes, priority: c.priority, windows: c === spot ? lunchWindows(c, date) : winOf(c), booking: c.booking ? c.booking.time : null, ...(c.crowd && !relaxed.has(c.id) ? { waitAny: true } : {}), ...(c.anchor === date ? { must: true } : {}) })), travel: tr, buffer: buf, departAt, dayEnd: coreEnd, lunch: spot ? null : { len: pace.lunch, ...LUNCH_WINDOW }, ...(hard !== null ? { maxSpill: 0 } : {}) });
    solution = solve();
    if (spot && !solution.order.includes(pool.indexOf(spot))) { spot = null; solution = solve(); } // the lunch spot did not make the day: plain lunch slot
    // Phase 11: a crowd magnet left out by its quiet slots is planned on its full hours instead (never dropped for this rule).
    const shut = pool.find((c, i) => c.crowd && !relaxed.has(c.id) && !solution.order.includes(i));
    if (shut) { relaxed.add(shut.id); continue; }
    const chain = ['S', ...solution.order.map((i) => pool[i]), 'E'];
    const departures = legDepartures(solution, departAt);
    for (let i = 0; i < chain.length - 1; i++) {
      const k = key(chain[i], chain[i + 1]);
      if (legs.has(k)) continue;
      const leg = await getLeg(chain[i], chain[i + 1], departures[i]);
      legs.set(k, leg);
      travel.set(k, { minutes: leg.minutes, distance_m: leg.distance_m, line: leg.line, mode: leg.mode, transfers: leg.transfers, flags: leg.flags });
    }
    finalSpot = spot;
    timeline = retime({ chain, items: solution.items, pool, legs, key, departAt, dayEnd: coreEnd, date, lunchLen: pace.lunch, spot, winOf, latest });
    if (timeline.ok) break;
    if (!resolved) { resolved = true; continue; } // solve once more on the real leg times
    const bad = timeline.failed;
    if (bad.crowd && !relaxed.has(bad.id)) { relaxed.add(bad.id); continue; }
    dropped.push({ cand: bad, code: 'day_full', reason: `the real route times on ${date} left no room for ${bad.name}`, from_date: date });
    pool = pool.filter((c) => c !== bad);
  }
  if (!timeline || !timeline.ok) throw new Error(`planner: could not time ${date} even after dropping every stop`);
  const ordered = solution.order.map((i) => pool[i]);
  for (const c of pool) if (!ordered.includes(c)) dropped.push({ cand: c, code: 'day_full', reason: `no room left on ${date} for ${c.name}`, from_date: date });
  // Phase 11: the locker's collection and the leg on to the end, then the whole day's events in order.
  let finish = timeline.finish;
  if (lockerOn) {
    post.push({ kind: 'bag', start: finish, end: finish + BAGS.COLLECT_MIN });
    finish += BAGS.COLLECT_MIN;
    bag.end = finish;
    if (postLeg) { post.push({ kind: 'leg', from: A.S, to: A.E, depart: finish, arrive: finish + postLeg.minutes, leg: postLeg, buffer: 0 }); finish += postLeg.minutes; }
  }
  const anchor = (x) => x === 'S' || x === 'E' || !!x.slug;
  timeline.events = [...pre, ...timeline.events.filter((ev) => !(ev.kind === 'leg' && ev.leg.stay && anchor(ev.from) && anchor(ev.to))), ...post];   // a sightless locker loop
  timeline.coreFinish = timeline.finish;
  timeline.finish = finish;
  // Phase 10 fix (d): each place dropped from this day says how many minutes it was short and offers a shorter visit.
  const fit = { pool, items: solution.items, legs, travel, key, mode, departAt, dayEnd: coreEnd, date, lunchLen: pace.lunch, spot: finalSpot, winOf, latest };
  const shortWarnings = [];
  for (const d of dropped) {
    if (d.from_date !== date || d.code !== 'day_full') continue;
    const sf = shortfall(d.cand, fit);
    if (!sf) continue;
    d.reason = `${d.reason}: ${sf.text}`.slice(0, 300);
    shortWarnings.push({ severity: 'info', code: 'other', text: `${d.cand.name} did not fit: ${sf.text}`.slice(0, 200), place: d.cand.id });
  }
  const cc = await crossCheck(maps, { start: S, end: E, stops: ordered.map((c) => ({ id: c.id, point: candPoint(c) })), mode });
  if (cc.asked) usage.route_calls += 1;
  const dayPlan = assemble({ ctx, day, ordered, timeline, cc, build_id, seed, verified_on, usage, breakfast, departAt, A, S, E, bag, relaxed, hard });
  dayPlan.warnings.push(...shortWarnings.slice(0, Math.max(0, 40 - dayPlan.warnings.length)));
  // Phase 11: what the dinner and extras pass needs. `direct`: the day's last leg runs from its last stop to the night's lodging.
  const lastStop = ordered.length ? timeline.events.filter((ev) => ev.kind === 'stop').pop() : null;
  const evening = {
    finish, dayEnd: day.dayEnd, ends: !!day.end, lodging: day.lodging_end,
    last: lastStop ? { cand: lastStop.c, depart: lastStop.depart } : null,
    direct: !!lastStop && !lockerOn && !day.end && E.slug !== START_SLUG && same(E, day.lodging_end)
  };
  return { dayPlan, dropped, usage, evening };
}

/**
 * Phase 10 fix (d). How short the final day is for a dropped candidate: insert it, with a visit of m minutes, at every
 * gap of the final timeline (no Maps request: a pair without a real leg uses its Route Matrix time) and find the longest
 * m that times. → { short, fits, after, text } or null when the full visit fits somewhere (the solver dropped it for
 * another reason). An offer is made only when the longest fit is at least the category's sensible minimum
 * (planner-category.mjs minVisit) and the place is not a booking or a set session (never shortened).
 */
export function shortfall(c, { pool, items, legs, travel, key, mode, departAt, dayEnd, date, lunchLen, spot, winOf = null, latest = null }) {
  const look = { get: (k) => legs.get(k) || (travel.get(k) && travel.get(k).minutes < Infinity ? { mode, ...travel.get(k) } : undefined) };
  const p2 = [...pool, null];
  const times = (pos, m) => {
    p2[p2.length - 1] = { ...c, minutes: m };
    const it2 = items.slice();
    it2.splice(pos, 0, { kind: 'stop', i: p2.length - 1 });
    return retime({ chain: ['S', 'E'], items: it2, pool: p2, legs: look, key, departAt, dayEnd, date, lunchLen, spot, winOf, latest }).ok;
  };
  let best = 0, bestPos = -1;
  for (let pos = 0; pos <= items.length; pos++) {
    if (times(pos, c.minutes)) return null;
    let lo = 0, hi = c.minutes - 1;   // largest m in [1, c.minutes - 1] that times here (0 = none)
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (times(pos, mid)) lo = mid; else hi = mid - 1; }
    if (lo > best) { best = lo; bestPos = pos; }
  }
  const short = c.minutes - best;
  const min = minVisit(c.category);
  const offer = !c.booking && !c.fixed && min !== null && best >= min ? Math.max(min, Math.floor(best / 5) * 5) : null;
  let after = null;
  if (offer) { for (let j = bestPos - 1; j >= 0; j--) if (items[j].kind === 'stop') { after = pool[items[j].i].name; break; } }
  const where = offer ? (after ? ` after ${after}` : (items.find((x) => x.kind === 'stop') ? ` before ${pool[items.find((x) => x.kind === 'stop').i].name}` : '')) : '';
  const text = `${short} min short` + (offer ? `; a ${offer}-minute visit would fit${where}` : '');
  return { short, fits: offer, after, text };
}

/** A DayPlan leg from a real leg (fetchLeg's result) between two named points. */
export function legRecord({ from, to, fromPoint, toPoint, depart, arrive, leg: l, buffer = 0, mode }) {
  const lm = l.mode || mode;   // a TRANSIT day's walked leg is a WALK leg (Phase 10)
  const leg = { from, to, mode: lm, depart_at: hm(depart), arrive_at: hm(arrive), minutes: l.minutes, distance_m: l.distance_m ?? 0, source: 'route', maps_url: legUrl(fromPoint, toPoint, lm) };
  if (l.line) leg.line = l.line;
  if (l.estimated) { leg.estimated = true; leg.estimate_basis = 'distance'; if (l.warning) leg.note = String(l.warning).slice(0, 300); }
  if (l.flags && l.flags.length) leg.flags = l.flags.slice(0, 4);
  if (Number.isInteger(l.taxi_minutes)) leg.taxi_minutes = l.taxi_minutes;
  if (buffer > 0) leg.buffer_minutes = buffer;
  return leg;
}
/** The day's one `transit_estimated` warning for its estimated legs, or null. */
export function estimatedWarning(legs) {
  const est = legs.filter((l) => l.estimated);
  if (!est.length) return null;
  return { severity: 'warn', code: 'transit_estimated', text: est.every((l) => l.mode === 'TRANSIT') ? TRANSIT_ESTIMATED_TEXT : est.every((l) => l.mode === 'WALK') ? WALK_ESTIMATED_TEXT : TRAVEL_ESTIMATED_TEXT };
}

/** Departure time before each leg of the chain, from the solver's own timeline (lunch after a stop delays that departure). */
function legDepartures(solution, departAt) {
  const out = [departAt];
  for (const it of solution.items) { if (it.kind === 'stop') out.push(it.depart); else out[out.length - 1] = it.end; }
  return out;
}

/**
 * Walk the solved order on the real legs → { ok: true, events, finish, idle } or { ok: false, failed: cand }. Each leg to a
 * stop carries its buffer (planner-buffer.mjs): the stop starts no earlier than arrival + buffer; before a booking the
 * buffer shrinks to the slack there is. `idle` = waiting minutes inside the day (for spare_minutes).
 */
function retime({ chain, items, pool, legs, key, departAt, dayEnd, date, lunchLen, spot, winOf = null, latest = null }) {
  const events = [];
  let t = departAt, prev = 'S', idle = 0;
  for (const it of items) {
    if (it.kind === 'lunch') {
      const start = Math.max(t, LUNCH_WINDOW.open);
      if (start > LUNCH_WINDOW.close) { events.push({ kind: 'note', text: 'no lunch slot was left once the real travel times came in' }); continue; }
      if (start - t >= FREE_MIN) events.push({ kind: 'free', start: t, end: start, note: prev === 'S' ? 'free time before lunch' : `free time near ${prev.name} before lunch` });
      idle += start - t;
      events.push({ kind: 'lunch', start, end: start + lunchLen, at: prev });
      t = start + lunchLen;
      continue;
    }
    const c = pool[it.i], leg = legs.get(key(prev, c));
    if (!leg || !(leg.minutes < Infinity)) return { ok: false, failed: c };
    const arrive = t + leg.minutes;
    let start, window = null, buffer = bufferFor(leg);
    if (c.booking) { if (arrive > c.booking.time) return { ok: false, failed: c }; buffer = Math.min(buffer, c.booking.time - arrive); start = c.booking.time; }
    else {
      const ws = windowsOn(c, date);
      const f = earliestFit(c === spot ? lunchWindows(c, date) : winOf ? winOf(c) : ws, arrive + buffer, c.minutes, dayEnd);
      if (!f) return { ok: false, failed: c };
      start = f.start;
      window = ws.length ? ws.find((w) => w.open <= start && start + c.minutes <= w.close) || null : null; // report the place's own hours
    }
    events.push({ kind: 'leg', from: prev, to: c, depart: t, arrive, leg, buffer });
    events.push({ kind: 'stop', c, arrive, ready: arrive + buffer, start, depart: start + c.minutes, window });
    idle += start - (arrive + buffer);
    t = start + c.minutes;
    prev = c;
  }
  const back = legs.get(key(prev, 'E'));
  if (!back || !(back.minutes < Infinity)) return { ok: false, failed: prev === 'S' ? chain[1] : prev };
  events.push({ kind: 'leg', from: prev, to: 'E', depart: t, arrive: t + back.minutes, leg: back, buffer: 0 });
  if (latest !== null && t + back.minutes > latest && prev !== 'S') return { ok: false, failed: prev };   // Phase 11: a hard end
  return { ok: true, events, finish: t + back.minutes, idle };
}

function assemble({ ctx, day, ordered, timeline, cc, build_id, seed, verified_on, usage, breakfast, departAt, A, S, E, bag, relaxed, hard }) {
  const { trip, pace } = ctx;
  const { date, mode } = day;
  const pt = (x) => (x === 'S' ? S : x === 'E' ? E : x.slug ? x : candPoint(x));
  const slug = (x) => (x === 'S' ? S.slug : x === 'E' ? E.slug : x.slug ? x.slug : x.id);
  const stops = [], legs = [], meals = [], free = [], warnings = [];
  if (breakfast) meals.push({ kind: 'breakfast', start: hm(day.dayStart), end: hm(departAt), at: 'lodging', note: `at ${day.lodging_start.name}` });
  for (const ev of timeline.events) {
    if (ev.kind === 'leg') {
      legs.push(legRecord({ from: slug(ev.from), to: slug(ev.to), fromPoint: pt(ev.from), toPoint: pt(ev.to), depart: ev.depart, arrive: ev.arrive, leg: ev.leg, buffer: ev.buffer, mode }));
    } else if (ev.kind === 'stop') {
      const c = ev.c;
      const real = windowsOn(c, date);
      const quiet = c.crowd && !c.booking && real.some((w) => w.open <= ev.ready && ev.ready < w.close);   // open already: waiting for its quieter slot
      if (ev.start - ev.ready >= FREE_MIN) free.push({ start: hm(ev.ready), end: hm(ev.start), note: c.booking ? `before your ${hm(c.booking.time)} booking at ${c.name}` : quiet ? `until ${hm(ev.start)}, a quieter time at ${c.name}` : `until ${c.name} opens at ${hm(ev.start)}` });
      const stop = { place: c.id, place_id: c.place_id, arrive: hm(ev.start), depart: hm(ev.depart), minutes: c.minutes, activity: c.activity, window: ev.window ? { open: hm(ev.window.open), close: hm(Math.min(ev.window.close, 1439)) } : null, confidence: c.confidence };
      if (c.booking) stop.booked = c.booking.ref ? `${c.booking.ref} (${hm(c.booking.time)})` : `booked for ${hm(c.booking.time)}`;
      stop.time_style = timeStyle(c, ev.start, ev.window);
      const check = checkOnDay(c, date);
      if (check) stop.check_on_day = check;
      // Phase 11: the facts behind the stop's time (only a place with facts, or a crowd magnet, carries them).
      if (c.last_entry) stop.last_entry = c.last_entry;
      if (c.minutes_source) stop.minutes_source = c.minutes_source;
      if (c.crowd && !c.booking) {
        const slot = crowdSlotOf(ev.start, real);
        if (slot) stop.crowd_slot = slot;
        else warnings.push({ severity: 'info', code: 'other', text: `${c.name}: no quieter slot fitted (the first ${CROWD_SLOT.OPENING_MIN} min after opening or the last ${CROWD_SLOT.LATE_MIN} before closing); planned at ${hm(ev.start)}`.slice(0, 200), place: c.id });
      }
      stops.push(stop);
      if (c.hours[date].status === 'unknown') warnings.push({ severity: 'info', code: 'hours_unknown', text: `${c.name}: opening hours unknown, check before you go`, place: c.id });
      else if (c.hours[date].status === 'irregular') warnings.push({ severity: 'info', code: 'hours_unknown', text: `${c.name}: opening days vary, check before you go`.slice(0, 200), place: c.id });
      if (c.own_hours && c.own_hours[date]) warnings.push({ severity: 'info', code: 'other', text: c.own_hours[date], place: c.id });
      if (ev.window && ev.window.close - ev.depart < TIGHT_MINUTES) warnings.push({ severity: 'warn', code: 'tight_connection', text: `${c.name} closes at ${hm(ev.window.close)}, only ${ev.window.close - ev.depart} min after your visit ends`, place: c.id });
    } else if (ev.kind === 'lunch') {
      const atS = ev.at === 'S';
      meals.push({ kind: 'lunch', start: hm(ev.start), end: hm(ev.end), at: atS ? S.slug : ev.at.id, note: atS ? (S.slug === LODGING_SLUG ? 'near your lodging' : `near ${S.name}`) : `near ${ev.at.name}` });
    } else if (ev.kind === 'free') free.push({ start: hm(ev.start), end: hm(ev.end), note: ev.note });
    else if (ev.kind === 'note') warnings.push({ severity: 'info', code: 'other', text: ev.text });
  }
  const estWarning = estimatedWarning(legs);
  if (estWarning) warnings.push(estWarning);
  const finish = timeline.finish;
  if (hard !== null) {   // Phase 11: a departure — no early-return line and no dinner; late only when even an empty day is
    if (finish > hard) warnings.push({ severity: 'alert', code: 'over_long_day', text: `reaches ${A.E.name} at ${hm(finish)}, after the ${hm(hard)} needed for ${hm(day.end.time)}` });
    else if (hard - finish >= FREE_MIN) free.push({ start: hm(finish), end: hm(hard), note: `${END_SPARE_NOTE} ${A.E.name} before ${hm(day.end.time)}`.slice(0, 300) });
  } else {
    if (finish > day.dayEnd) warnings.push({ severity: 'warn', code: 'over_long_day', text: `back at ${A.E.name} at ${hm(finish)}, ${finish - day.dayEnd} min after your ${hm(day.dayEnd)} day end` });
    else if (day.dayEnd - finish >= FREE_MIN) free.push({ start: hm(finish), end: hm(day.dayEnd), note: day.outline && day.outline.kind === 'free' ? FREE_DAY_NOTE : BACK_EARLY_NOTE });
    const dinnerStart = Math.max(finish + 30, DINNER_EARLIEST);
    if (dinnerStart + pace.dinner <= 23 * 60) meals.push({ kind: 'dinner', start: hm(dinnerStart), end: hm(dinnerStart + pace.dinner), at: 'lodging', note: `near ${A.E.name}` });
  }
  if (cc.agrees === false) warnings.push({ severity: 'info', code: 'order_disagreement', text: `Google's shortest order (${cc.google_order.join(' → ')}) differs from this plan, which honours opening hours and bookings` });
  const dayPlan = { v: 1, trip_id: trip.id, date, build_id, mode, lodging_start: day.lodging_start.id, lodging_end: day.lodging_end.id, stops, legs, meals, free, warnings: warnings.slice(0, 40), day_url: dayLink([S, ...ordered.map(candPoint), E], mode), verified_on, solver: { method: SOLVER_METHOD, matrix_elements: usage.matrix_elements, route_calls: usage.route_calls, cross_check: cc, seed } };
  // Unscheduled minutes in the day's window after buffers (waits + the early return); 0 when the day overflows.
  dayPlan.spare_minutes = finish > day.dayEnd ? 0 : Math.max(0, Math.min(1440, timeline.idle + (day.dayEnd - finish)));
  if (day.start) dayPlan.start = { name: day.start.name, time: hm(day.start.time) };
  if (day.end) dayPlan.end = { name: day.end.name, time: hm(day.end.time) };
  if (bag) {
    dayPlan.bags = { kind: bag.kind, at: bag.at };
    if (Number.isInteger(bag.start)) dayPlan.bags.start = hm(bag.start);
    if (Number.isInteger(bag.end)) dayPlan.bags.end = hm(bag.end);
    dayPlan.bags.text = bagsText(bag.kind, { start: A.S.name, lodging: day.lodging_end.name, note: day.bags_note });
  }
  const theme = [...new Set(ordered.map((c) => c.category))].slice(0, 3);
  if (theme.length) dayPlan.theme = theme.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' · ');
  return dayPlan;
}

// Developed by: LightAISolutions

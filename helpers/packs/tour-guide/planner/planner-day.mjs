/**
 * Tour Guide planner — one trip date end to end: Route Matrix → exact solver → real legs pair by pair → timeline on
 * the real legs (re-solve once on the real times, then drop one stop at a time if it still cannot be timed) →
 * cross-check → DayPlan. Returns the DayPlan plus the candidates it had to drop (for the Later list).
 */
import { hm, localToIso } from './planner-time.mjs';
import { earliestFit } from './planner-hours.mjs';
import { solveDay } from './planner-solve.mjs';
import { fetchMatrix, fetchLeg, crossCheck, legUrl, dayLink, pointKey, transitFallback, legAllowance } from './planner-legs.mjs';
import { extraCallsFor } from './planner-budget.mjs';
import { bufferFor } from './planner-buffer.mjs';
import { transitPrefs } from './planner-transit.mjs';
import { LUNCH_WINDOW, DINNER_EARLIEST, breakfastLen } from './planner-input.mjs';
import { minVisit } from './planner-category.mjs';

export const SOLVER_METHOD = 'held-karp/time-windows';
export const TIGHT_MINUTES = 10;
export const FREE_MIN = 20;
export const TRANSIT_ESTIMATED_TEXT = 'Transit times on this day are estimates; check the Maps link before you go';
export const WALK_ESTIMATED_TEXT = 'Walking times on this day are estimates; check the Maps link before you go';
export const TRAVEL_ESTIMATED_TEXT = 'Travel times on this day are estimates; check the Maps link before you go';
const candPoint = (c) => ({ placeId: c.place_id, lat: c.loc.lat, lng: c.loc.lng, name: c.name, id: c.id, category: c.category });
const windowsOn = (c, date) => (c.hours[date].status === 'open' || c.hours[date].status === 'irregular' ? c.hours[date].windows : []);
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
  const departAt = day.dayStart + breakfast;
  const S = day.lodging_start, E = day.lodging_end;
  const tp = mode === 'TRANSIT' ? transitPrefs(trip) : null; // rail first; buses only where rail has no route
  const fallback = mode === 'TRANSIT' ? transitFallback(trip) : null;
  const usage = { matrix_elements: 0, route_calls: 0 };
  const allowance = legAllowance(extraCallsFor(mode, cands.length + 1)); // the day's extra WALK / DRIVE requests, as budgeted (planner-budget.mjs)
  const pt = (x) => (x === 'S' ? S : x === 'E' ? E : candPoint(x));
  const key = (a, b) => pointKey(pt(a)) + '|' + pointKey(pt(b));

  const m = await fetchMatrix(maps, { points: [S, ...cands.map(candPoint), E], mode, departureTime: iso(departAt), transitPreferences: tp, fallback });
  usage.matrix_elements += m.elements;
  const travel = new Map(m.travel); // 'from|to' → { minutes, distance_m, line? }
  const legs = new Map(); // real legs, same keys
  const dropped = [];
  let pool = cands.slice(), solution = null, timeline = null, resolved = false, finalSpot = null;
  for (let guard = 0; guard <= cands.length + 2; guard++) {
    let spot = lunchSpotOf(pool, date);
    const at = (x) => (x === 'S' || x === 'E' ? x : pool[x]);
    const tr = (a, b) => { const r = travel.get(key(at(a), at(b))); return r ? r.minutes : Infinity; };
    const buf = (a, b) => { const r = travel.get(key(at(a), at(b))); return r ? bufferFor({ mode, ...r }) : 0; };
    const solve = () => solveDay({ stops: pool.map((c) => ({ minutes: c.minutes, priority: c.priority, windows: c === spot ? lunchWindows(c, date) : windowsOn(c, date), booking: c.booking ? c.booking.time : null })), travel: tr, buffer: buf, departAt, dayEnd: day.dayEnd, lunch: spot ? null : { len: pace.lunch, ...LUNCH_WINDOW } });
    solution = solve();
    if (spot && !solution.order.includes(pool.indexOf(spot))) { spot = null; solution = solve(); } // the lunch spot did not make the day: plain lunch slot
    const chain = ['S', ...solution.order.map((i) => pool[i]), 'E'];
    const departures = legDepartures(solution, departAt);
    for (let i = 0; i < chain.length - 1; i++) {
      const k = key(chain[i], chain[i + 1]);
      if (legs.has(k)) continue;
      const leg = await fetchLeg(maps, { from: pt(chain[i]), to: pt(chain[i + 1]), mode, departureTime: iso(departures[i]), transitPreferences: tp, fallback, allowance });
      usage.route_calls += leg.requests;
      legs.set(k, leg);
      travel.set(k, { minutes: leg.minutes, distance_m: leg.distance_m, line: leg.line, mode: leg.mode, transfers: leg.transfers, flags: leg.flags });
    }
    finalSpot = spot;
    timeline = retime({ chain, items: solution.items, pool, legs, key, departAt, dayEnd: day.dayEnd, date, lunchLen: pace.lunch, spot });
    if (timeline.ok) break;
    if (!resolved) { resolved = true; continue; } // solve once more on the real leg times
    const bad = timeline.failed;
    dropped.push({ cand: bad, code: 'day_full', reason: `the real route times on ${date} left no room for ${bad.name}`, from_date: date });
    pool = pool.filter((c) => c !== bad);
  }
  if (!timeline || !timeline.ok) throw new Error(`planner: could not time ${date} even after dropping every stop`);
  const ordered = solution.order.map((i) => pool[i]);
  for (const c of pool) if (!ordered.includes(c)) dropped.push({ cand: c, code: 'day_full', reason: `no room left on ${date} for ${c.name}`, from_date: date });
  // Phase 10 fix (d): each place dropped from this day says how many minutes it was short and offers a shorter visit.
  const fit = { pool, items: solution.items, legs, travel, key, mode, departAt, dayEnd: day.dayEnd, date, lunchLen: pace.lunch, spot: finalSpot };
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
  const dayPlan = assemble({ ctx, day, ordered, timeline, cc, build_id, seed, verified_on, usage, breakfast, departAt });
  dayPlan.warnings.push(...shortWarnings.slice(0, Math.max(0, 40 - dayPlan.warnings.length)));
  return { dayPlan, dropped, usage };
}

/**
 * Phase 10 fix (d). How short the final day is for a dropped candidate: insert it, with a visit of m minutes, at every
 * gap of the final timeline (no Maps request: a pair without a real leg uses its Route Matrix time) and find the longest
 * m that times. → { short, fits, after, text } or null when the full visit fits somewhere (the solver dropped it for
 * another reason). An offer is made only when the longest fit is at least the category's sensible minimum
 * (planner-category.mjs minVisit) and the place is not a booking or a set session (never shortened).
 */
export function shortfall(c, { pool, items, legs, travel, key, mode, departAt, dayEnd, date, lunchLen, spot }) {
  const look = { get: (k) => legs.get(k) || (travel.get(k) && travel.get(k).minutes < Infinity ? { mode, ...travel.get(k) } : undefined) };
  const p2 = [...pool, null];
  const times = (pos, m) => {
    p2[p2.length - 1] = { ...c, minutes: m };
    const it2 = items.slice();
    it2.splice(pos, 0, { kind: 'stop', i: p2.length - 1 });
    return retime({ chain: ['S', 'E'], items: it2, pool: p2, legs: look, key, departAt, dayEnd, date, lunchLen, spot }).ok;
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
function retime({ chain, items, pool, legs, key, departAt, dayEnd, date, lunchLen, spot }) {
  const events = [];
  let t = departAt, prev = 'S', idle = 0;
  for (const it of items) {
    if (it.kind === 'lunch') {
      const start = Math.max(t, LUNCH_WINDOW.open);
      if (start > LUNCH_WINDOW.close) { events.push({ kind: 'note', text: 'no lunch slot was left once the real travel times came in' }); continue; }
      if (start - t >= FREE_MIN) events.push({ kind: 'free', start: t, end: start, note: prev === 'S' ? 'free time before lunch' : `free time near ${prev.name} before lunch` });
      idle += start - t;
      events.push({ kind: 'lunch', start, end: start + lunchLen, at: prev === 'S' ? 'lodging' : prev });
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
      const f = earliestFit(c === spot ? lunchWindows(c, date) : ws, arrive + buffer, c.minutes, dayEnd);
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
  return { ok: true, events, finish: t + back.minutes, idle };
}

function assemble({ ctx, day, ordered, timeline, cc, build_id, seed, verified_on, usage, breakfast, departAt }) {
  const { trip, pace } = ctx;
  const { date, mode } = day;
  const S = day.lodging_start, E = day.lodging_end;
  const pt = (x) => (x === 'S' ? S : x === 'E' ? E : candPoint(x));
  const slug = (x) => (x === 'S' || x === 'E' ? 'lodging' : x.id);
  const stops = [], legs = [], meals = [], free = [], warnings = [];
  if (breakfast) meals.push({ kind: 'breakfast', start: hm(day.dayStart), end: hm(departAt), at: 'lodging', note: `at ${S.name}` });
  for (const ev of timeline.events) {
    if (ev.kind === 'leg') {
      const lm = ev.leg.mode || mode;   // a TRANSIT day's walked leg is a WALK leg (Phase 10)
      const leg = { from: slug(ev.from), to: slug(ev.to), mode: lm, depart_at: hm(ev.depart), arrive_at: hm(ev.arrive), minutes: ev.leg.minutes, distance_m: ev.leg.distance_m ?? 0, source: 'route', maps_url: legUrl(pt(ev.from), pt(ev.to), lm) };
      if (ev.leg.line) leg.line = ev.leg.line;
      if (ev.leg.estimated) { leg.estimated = true; leg.estimate_basis = 'distance'; if (ev.leg.warning) leg.note = String(ev.leg.warning).slice(0, 300); }
      if (ev.leg.flags && ev.leg.flags.length) leg.flags = ev.leg.flags.slice(0, 4);
      if (Number.isInteger(ev.leg.taxi_minutes)) leg.taxi_minutes = ev.leg.taxi_minutes;
      if (ev.buffer > 0) leg.buffer_minutes = ev.buffer;
      legs.push(leg);
    } else if (ev.kind === 'stop') {
      const c = ev.c;
      if (ev.start - ev.ready >= FREE_MIN) free.push({ start: hm(ev.ready), end: hm(ev.start), note: c.booking ? `before your ${hm(c.booking.time)} booking at ${c.name}` : `until ${c.name} opens at ${hm(ev.start)}` });
      const stop = { place: c.id, place_id: c.place_id, arrive: hm(ev.start), depart: hm(ev.depart), minutes: c.minutes, activity: c.activity, window: ev.window ? { open: hm(ev.window.open), close: hm(Math.min(ev.window.close, 1439)) } : null, confidence: c.confidence };
      if (c.booking) stop.booked = c.booking.ref ? `${c.booking.ref} (${hm(c.booking.time)})` : `booked for ${hm(c.booking.time)}`;
      stop.time_style = timeStyle(c, ev.start, ev.window);
      const check = checkOnDay(c, date);
      if (check) stop.check_on_day = check;
      stops.push(stop);
      if (c.hours[date].status === 'unknown') warnings.push({ severity: 'info', code: 'hours_unknown', text: `${c.name}: opening hours unknown, check before you go`, place: c.id });
      else if (c.hours[date].status === 'irregular') warnings.push({ severity: 'info', code: 'hours_unknown', text: `${c.name}: opening days vary, check before you go`.slice(0, 200), place: c.id });
      if (ev.window && ev.window.close - ev.depart < TIGHT_MINUTES) warnings.push({ severity: 'warn', code: 'tight_connection', text: `${c.name} closes at ${hm(ev.window.close)}, only ${ev.window.close - ev.depart} min after your visit ends`, place: c.id });
    } else if (ev.kind === 'lunch') {
      meals.push({ kind: 'lunch', start: hm(ev.start), end: hm(ev.end), at: ev.at === 'lodging' ? 'lodging' : ev.at.id, note: ev.at === 'lodging' ? 'near your lodging' : `near ${ev.at.name}` });
    } else if (ev.kind === 'free') free.push({ start: hm(ev.start), end: hm(ev.end), note: ev.note });
    else if (ev.kind === 'note') warnings.push({ severity: 'info', code: 'other', text: ev.text });
  }
  const est = legs.filter((l) => l.estimated);
  if (est.length) warnings.push({ severity: 'warn', code: 'transit_estimated', text: est.every((l) => l.mode === 'TRANSIT') ? TRANSIT_ESTIMATED_TEXT : est.every((l) => l.mode === 'WALK') ? WALK_ESTIMATED_TEXT : TRAVEL_ESTIMATED_TEXT });
  const finish = timeline.finish;
  if (finish > day.dayEnd) warnings.push({ severity: 'warn', code: 'over_long_day', text: `back at ${E.name} at ${hm(finish)}, ${finish - day.dayEnd} min after your ${hm(day.dayEnd)} day end` });
  else if (day.dayEnd - finish >= FREE_MIN) free.push({ start: hm(finish), end: hm(day.dayEnd), note: 'back early; the rest of the day is free' });
  const dinnerStart = Math.max(finish + 30, DINNER_EARLIEST);
  if (dinnerStart + pace.dinner <= 23 * 60) meals.push({ kind: 'dinner', start: hm(dinnerStart), end: hm(dinnerStart + pace.dinner), at: 'lodging', note: `near ${E.name}` });
  if (cc.agrees === false) warnings.push({ severity: 'info', code: 'order_disagreement', text: `Google's shortest order (${cc.google_order.join(' → ')}) differs from this plan, which honours opening hours and bookings` });
  const dayPlan = { v: 1, trip_id: trip.id, date, build_id, mode, lodging_start: S.id, lodging_end: E.id, stops, legs, meals, free, warnings, day_url: dayLink([S, ...ordered.map(candPoint), E], mode), verified_on, solver: { method: SOLVER_METHOD, matrix_elements: usage.matrix_elements, route_calls: usage.route_calls, cross_check: cc, seed } };
  // Unscheduled minutes in the day's window after buffers (waits + the early return); 0 when the day overflows.
  dayPlan.spare_minutes = finish > day.dayEnd ? 0 : Math.max(0, Math.min(1440, timeline.idle + (day.dayEnd - finish)));
  const theme = [...new Set(ordered.map((c) => c.category))].slice(0, 3);
  if (theme.length) dayPlan.theme = theme.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' · ');
  return dayPlan;
}

// Developed by: LightAISolutions

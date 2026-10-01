/**
 * Tour Guide planner — one trip date end to end: Route Matrix → exact solver → real legs pair by pair → timeline on
 * the real legs (re-solve once on the real times, then drop one stop at a time if it still cannot be timed) →
 * cross-check → DayPlan. Returns the DayPlan plus the candidates it had to drop (for the Later list).
 */
import { hm, localToIso } from './planner-time.mjs';
import { earliestFit } from './planner-hours.mjs';
import { solveDay } from './planner-solve.mjs';
import { fetchMatrix, fetchLeg, crossCheck, legUrl, dayLink, pointKey, transitFallback } from './planner-legs.mjs';
import { LUNCH_WINDOW, DINNER_EARLIEST } from './planner-input.mjs';

export const SOLVER_METHOD = 'held-karp/time-windows';
export const TIGHT_MINUTES = 10;
export const FREE_MIN = 20;
export const TRANSIT_ESTIMATED_TEXT = 'Transit times on this day are estimates; check the Maps link before you go';
const candPoint = (c) => ({ placeId: c.place_id, lat: c.loc.lat, lng: c.loc.lng, name: c.name, id: c.id });
const windowsOn = (c, date) => (c.hours[date].status === 'open' ? c.hours[date].windows : []);

/** planDay({ ctx, day, cands, maps, build_id, seed, verified_on }) → { dayPlan, dropped, usage } */
export async function planDay({ ctx, day, cands, maps, build_id, seed, verified_on }) {
  const { trip, pace } = ctx;
  const { date, mode } = day;
  const iso = (min) => localToIso(date, min, trip.timezone);
  const breakfast = ctx.breakfastAtLodging ? pace.breakfast : 0;
  const departAt = day.dayStart + breakfast;
  const S = day.lodging_start, E = day.lodging_end;
  const tp = mode === 'TRANSIT' ? trip.transit_preferences || null : null;
  const fallback = mode === 'TRANSIT' ? transitFallback(trip) : null;
  const usage = { matrix_elements: 0, route_calls: 0 };
  const pt = (x) => (x === 'S' ? S : x === 'E' ? E : candPoint(x));
  const key = (a, b) => pointKey(pt(a)) + '|' + pointKey(pt(b));

  const m = await fetchMatrix(maps, { points: [S, ...cands.map(candPoint), E], mode, departureTime: iso(departAt), transitPreferences: tp, fallback });
  usage.matrix_elements += m.elements;
  const travel = new Map(m.travel); // 'from|to' → { minutes, distance_m, line? }
  const legs = new Map(); // real legs, same keys
  const dropped = [];
  let pool = cands.slice(), solution = null, timeline = null, resolved = false;
  for (let guard = 0; guard <= cands.length + 2; guard++) {
    const stops = pool.map((c) => ({ minutes: c.minutes, priority: c.priority, windows: windowsOn(c, date), booking: c.booking ? c.booking.time : null }));
    const tr = (a, b) => { const r = travel.get(key(a === 'S' || a === 'E' ? a : pool[a], b === 'S' || b === 'E' ? b : pool[b])); return r ? r.minutes : Infinity; };
    solution = solveDay({ stops, travel: tr, departAt, dayEnd: day.dayEnd, lunch: { len: pace.lunch, ...LUNCH_WINDOW } });
    const chain = ['S', ...solution.order.map((i) => pool[i]), 'E'];
    const departures = legDepartures(solution, departAt);
    for (let i = 0; i < chain.length - 1; i++) {
      const k = key(chain[i], chain[i + 1]);
      if (legs.has(k)) continue;
      const leg = await fetchLeg(maps, { from: pt(chain[i]), to: pt(chain[i + 1]), mode, departureTime: iso(departures[i]), transitPreferences: tp, fallback });
      usage.route_calls += 1;
      legs.set(k, leg);
      travel.set(k, { minutes: leg.minutes, distance_m: leg.distance_m, line: leg.line });
    }
    timeline = retime({ chain, items: solution.items, pool, legs, key, departAt, dayEnd: day.dayEnd, date, lunchLen: pace.lunch });
    if (timeline.ok) break;
    if (!resolved) { resolved = true; continue; } // solve once more on the real leg times
    const bad = timeline.failed;
    dropped.push({ cand: bad, code: 'day_full', reason: `the real route times on ${date} left no room for ${bad.name}`, from_date: date });
    pool = pool.filter((c) => c !== bad);
  }
  if (!timeline || !timeline.ok) throw new Error(`planner: could not time ${date} even after dropping every stop`);
  const ordered = solution.order.map((i) => pool[i]);
  for (const c of pool) if (!ordered.includes(c)) dropped.push({ cand: c, code: 'day_full', reason: `no room left on ${date} for ${c.name}`, from_date: date });
  const cc = await crossCheck(maps, { start: S, end: E, stops: ordered.map((c) => ({ id: c.id, point: candPoint(c) })), mode });
  if (cc.asked) usage.route_calls += 1;
  return { dayPlan: assemble({ ctx, day, ordered, timeline, cc, build_id, seed, verified_on, usage, breakfast, departAt }), dropped, usage };
}

/** Departure time before each leg of the chain, from the solver's own timeline (lunch after a stop delays that departure). */
function legDepartures(solution, departAt) {
  const out = [departAt];
  for (const it of solution.items) { if (it.kind === 'stop') out.push(it.depart); else out[out.length - 1] = it.end; }
  return out;
}

/** Walk the solved order on the real legs → { ok: true, events, finish } or { ok: false, failed: cand }. */
function retime({ chain, items, pool, legs, key, departAt, dayEnd, date, lunchLen }) {
  const events = [];
  let t = departAt, prev = 'S';
  for (const it of items) {
    if (it.kind === 'lunch') {
      const start = Math.max(t, LUNCH_WINDOW.open);
      if (start > LUNCH_WINDOW.close) { events.push({ kind: 'note', text: 'no lunch slot was left once the real travel times came in' }); continue; }
      if (start - t >= FREE_MIN) events.push({ kind: 'free', start: t, end: start, note: prev === 'S' ? 'free time before lunch' : `free time near ${prev.name} before lunch` });
      events.push({ kind: 'lunch', start, end: start + lunchLen, at: prev === 'S' ? 'lodging' : prev });
      t = start + lunchLen;
      continue;
    }
    const c = pool[it.i], leg = legs.get(key(prev, c));
    if (!leg || !(leg.minutes < Infinity)) return { ok: false, failed: c };
    const arrive = t + leg.minutes;
    let start, window = null;
    if (c.booking) { if (arrive > c.booking.time) return { ok: false, failed: c }; start = c.booking.time; }
    else {
      const ws = windowsOn(c, date);
      const f = earliestFit(ws, arrive, c.minutes, dayEnd);
      if (!f) return { ok: false, failed: c };
      start = f.start;
      window = ws.length ? f.window : null;
    }
    events.push({ kind: 'leg', from: prev, to: c, depart: t, arrive, leg });
    events.push({ kind: 'stop', c, arrive, start, depart: start + c.minutes, window });
    t = start + c.minutes;
    prev = c;
  }
  const back = legs.get(key(prev, 'E'));
  if (!back || !(back.minutes < Infinity)) return { ok: false, failed: prev === 'S' ? chain[1] : prev };
  events.push({ kind: 'leg', from: prev, to: 'E', depart: t, arrive: t + back.minutes, leg: back });
  return { ok: true, events, finish: t + back.minutes };
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
      const leg = { from: slug(ev.from), to: slug(ev.to), mode, depart_at: hm(ev.depart), arrive_at: hm(ev.arrive), minutes: ev.leg.minutes, distance_m: ev.leg.distance_m, source: 'route', maps_url: legUrl(pt(ev.from), pt(ev.to), mode) };
      if (ev.leg.line) leg.line = ev.leg.line;
      if (ev.leg.estimated) { leg.estimated = true; leg.estimate_basis = 'distance'; }
      legs.push(leg);
    } else if (ev.kind === 'stop') {
      const c = ev.c;
      if (ev.start - ev.arrive >= FREE_MIN) free.push({ start: hm(ev.arrive), end: hm(ev.start), note: c.booking ? `before your ${hm(c.booking.time)} booking at ${c.name}` : `until ${c.name} opens at ${hm(ev.start)}` });
      const stop = { place: c.id, place_id: c.place_id, arrive: hm(ev.start), depart: hm(ev.depart), minutes: c.minutes, activity: c.activity, window: ev.window ? { open: hm(ev.window.open), close: hm(Math.min(ev.window.close, 1439)) } : null, confidence: c.confidence };
      if (c.booking) stop.booked = c.booking.ref ? `${c.booking.ref} (${hm(c.booking.time)})` : `booked for ${hm(c.booking.time)}`;
      stops.push(stop);
      if (c.hours[date].status === 'unknown') warnings.push({ severity: 'info', code: 'hours_unknown', text: `${c.name}: opening hours unknown, check before you go`, place: c.id });
      if (ev.window && ev.window.close - ev.depart < TIGHT_MINUTES) warnings.push({ severity: 'warn', code: 'tight_connection', text: `${c.name} closes at ${hm(ev.window.close)}, only ${ev.window.close - ev.depart} min after your visit ends`, place: c.id });
    } else if (ev.kind === 'lunch') {
      meals.push({ kind: 'lunch', start: hm(ev.start), end: hm(ev.end), at: ev.at === 'lodging' ? 'lodging' : ev.at.id, note: ev.at === 'lodging' ? 'near your lodging' : `near ${ev.at.name}` });
    } else if (ev.kind === 'free') free.push({ start: hm(ev.start), end: hm(ev.end), note: ev.note });
    else if (ev.kind === 'note') warnings.push({ severity: 'info', code: 'other', text: ev.text });
  }
  if (legs.some((l) => l.estimated)) warnings.push({ severity: 'warn', code: 'transit_estimated', text: TRANSIT_ESTIMATED_TEXT });
  const finish = timeline.finish;
  if (finish > day.dayEnd) warnings.push({ severity: 'warn', code: 'over_long_day', text: `back at ${E.name} at ${hm(finish)}, ${finish - day.dayEnd} min after your ${hm(day.dayEnd)} day end` });
  else if (day.dayEnd - finish >= FREE_MIN) free.push({ start: hm(finish), end: hm(day.dayEnd), note: 'back early; the rest of the day is free' });
  const dinnerStart = Math.max(finish + 30, DINNER_EARLIEST);
  if (dinnerStart + pace.dinner <= 23 * 60) meals.push({ kind: 'dinner', start: hm(dinnerStart), end: hm(dinnerStart + pace.dinner), at: 'lodging', note: `near ${E.name}` });
  if (cc.agrees === false) warnings.push({ severity: 'info', code: 'order_disagreement', text: `Google's shortest order (${cc.google_order.join(' → ')}) differs from this plan, which honours opening hours and bookings` });
  const dayPlan = { v: 1, trip_id: trip.id, date, build_id, mode, lodging_start: S.id, lodging_end: E.id, stops, legs, meals, free, warnings, day_url: dayLink([S, ...ordered.map(candPoint), E], mode), verified_on, solver: { method: SOLVER_METHOD, matrix_elements: usage.matrix_elements, route_calls: usage.route_calls, cross_check: cc, seed } };
  const theme = [...new Set(ordered.map((c) => c.category))].slice(0, 3);
  if (theme.length) dayPlan.theme = theme.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' · ');
  return dayPlan;
}

// Developed by: LightAISolutions

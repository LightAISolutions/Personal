/**
 * Tour Guide planner — the exact subset-and-order solver for one day (Held-Karp over subsets with time windows).
 * State = (subset visited, last stop, lunch taken) → earliest departure time from the last stop. Transitions: go to an
 * unvisited stop (travel, wait for its window or booking, visit), or take lunch where you stand (zero travel, start
 * inside the lunch window). The best subset maximises Σ weight(priority) (1 = 100, 2 = 10, 3 = 1: one must-see
 * outranks ten nice-to-haves), then the earliest return to the lodging. Lunch is mandatory on any day that runs past
 * the lunch window (a day back at the lodging by `lunch.close` eats there); a day that cannot fit lunch drops stops.
 * Stops end by `dayEnd`; only the return leg may spill, up to `maxSpill` minutes. Up to 12 stops (2^12·13·2 states).
 *   solveDay({ stops, travel, departAt, dayEnd, lunch, maxWait, maxSpill, buffer }) → { order, items, finish, hasLunch, value, states }
 *   stops[i] = { minutes, priority, windows: [{open, close}] ([] = no constraint), booking: minutes | null }
 *   (Phase 11) stops[i].waitAny = true lets a stop wait past `maxWait` like a booking: a crowd magnet's quiet slot.
 *   (WP-11e) stops[i].must = true (an outline anchor) is kept whenever it fits at all (MUST_WEIGHT).
 *   travel(a, b) → minutes, a/b ∈ 'S' (start lodging) | 'E' (end lodging) | stop index; Infinity = unreachable
 *   buffer(a, b) → minutes of slack after the leg a → b before stop b starts (optional, default none; Phase 10). A booked
 *   stop's buffer shrinks to the slack before the booking, so a buffer never drops a booking.
 */
import { earliestFit } from './planner-hours.mjs';

export const WEIGHT = Object.freeze({ 1: 100, 2: 10, 3: 1 });
export const MAX_STOPS = 12;
/** WP-11e: an outline anchor (stops[i].must) outweighs any set of other stops (12 × 100 < 10 000). */
export const MUST_WEIGHT = 10000;

export function solveDay({ stops, travel, departAt, dayEnd, lunch = null, maxWait = 75, maxSpill = 90, buffer = null }) {
  const n = stops.length;
  if (n > MAX_STOPS) throw new Error(`planner: solveDay takes at most ${MAX_STOPS} stops (got ${n})`);
  if (lunch && departAt > lunch.close) lunch = null; // the day starts after lunchtime
  const L = n; // virtual "last" = start lodging
  const N = 1 << n, W = n + 1;
  const sidx = (mask, last, lunchDone) => (mask * W + last) * 2 + lunchDone;
  const time = new Float64Array(N * W * 2).fill(Infinity);
  const parent = new Int32Array(N * W * 2).fill(-1);
  const startAt = new Float64Array(N * W * 2).fill(-1); // visit start (stop) or lunch start
  time[sidx(0, L, 0)] = departAt;
  const value = (mask) => { let v = 0; for (let i = 0; i < n; i++) if (mask & (1 << i)) v += stops[i].must ? MUST_WEIGHT : WEIGHT[stops[i].priority] || 1; return v; };

  const relax = (to, t, from, s) => { if (t < time[to]) { time[to] = t; parent[to] = from; startAt[to] = s; } };
  for (let mask = 0; mask < N; mask++) {
    for (let last = 0; last <= n; last++) {
      if (last === L ? mask !== 0 : !(mask & (1 << last))) continue;
      const s0 = sidx(mask, last, 0);
      if (lunch && time[s0] < Infinity) {
        const start = Math.max(time[s0], lunch.open);
        if (start <= lunch.close) relax(sidx(mask, last, 1), start + lunch.len, s0, start);
      }
      for (let ld = 0; ld < 2; ld++) {
        const from = sidx(mask, last, ld), t = time[from];
        if (t === Infinity) continue;
        for (let j = 0; j < n; j++) {
          if (mask & (1 << j)) continue;
          const tr = travel(last === L ? 'S' : last, j);
          if (!(tr < Infinity)) continue;
          const arrive = t + tr, st = stops[j];
          const ready = arrive + (buffer ? buffer(last === L ? 'S' : last, j) || 0 : 0);
          let start;
          if (st.booking != null) { if (arrive > st.booking || st.booking + st.minutes > dayEnd) continue; start = st.booking; }
          else { const f = earliestFit(st.windows, ready, st.minutes, dayEnd); if (!f) continue; start = f.start; }
          if (st.booking == null && !st.waitAny && start - ready > maxWait) continue; // a booked stop may wait any length: the wait is free time, never a reason to drop the booking
          relax(sidx(mask | (1 << j), j, ld), start + st.minutes, from, start);
        }
      }
    }
  }
  let best = null;
  for (let mask = 0; mask < N; mask++) {
    const v = value(mask);
    for (let last = 0; last <= n; last++) {
      if (last === L ? mask !== 0 : !(mask & (1 << last))) continue;
      for (let ld = 0; ld < 2; ld++) {
        const s = sidx(mask, last, ld), t = time[s];
        if (t === Infinity) continue;
        const finish = t + travel(last === L ? 'S' : last, 'E');
        if (!(finish <= dayEnd + maxSpill)) continue;
        if (lunch && ld === 0 && t > lunch.close) continue; // ran through lunchtime without eating
        const cand = { s, mask, v, ld, finish };
        if (!best || cand.v > best.v || (cand.v === best.v && (cand.ld > best.ld || (cand.ld === best.ld && (cand.finish < best.finish || (cand.finish === best.finish && cand.mask < best.mask)))))) best = cand;
      }
    }
  }
  if (!best) throw new Error('planner: no feasible day (even an empty day cannot return to the lodging in time)');
  const items = [];
  for (let s = best.s; parent[s] !== -1; s = parent[s]) {
    const p = parent[s];
    const last = Math.floor(s / 2) % W, plast = Math.floor(p / 2) % W, lunchHere = (s % 2) !== (p % 2);
    if (lunchHere) items.push({ kind: 'lunch', start: startAt[s], end: time[s], at: plast === L ? null : plast });
    else items.push({ kind: 'stop', i: last, arrive: time[p] + travel(plast === L ? 'S' : plast, last), start: startAt[s], depart: time[s] });
  }
  items.reverse();
  return { order: items.filter((x) => x.kind === 'stop').map((x) => x.i), items, finish: best.finish, hasLunch: best.ld === 1, value: best.v, states: N * W * 2 };
}

// Developed by: LightAISolutions

/**
 * Tour Guide planner — day assignment (no API calls). Each candidate goes to one trip date or to a Later reason:
 *   1. no location / closed business / closed or outside hours on every date → Later (closed_business, closed_day, outside_day, outside_hours, other);
 *   2. farther than FAR_KM[mode] from every day's lodging → Later (too_far) before any matrix element is spent;
 *   3. bookings pin the date; a `scheduled_hint` (a promoted place) prefers its date;
 *   4. the rest, priority first, go to the feasible date with the best score = 0.5·km-to-anchor + mean km to the
 *      stops already on that date (or the anchor km when none) + 1.5·stops already there; capacity is capped per day
 *      (CAP: ≤ 10 matrix points on a TRANSIT day, ≤ 12 stops otherwise) so the subset solver stays exact and the
 *      matrix stays inside one request; overflow → Later (day_full) after one more pass over the remaining days.
 */
import { haversineKm, centroid } from './planner-geo.mjs';
import { unfitCode } from './planner-hours.mjs';
import { breakfastLen } from './planner-input.mjs';

export const FAR_KM = Object.freeze({ TRANSIT: 30, WALK: 12, DRIVE: 120 });
export const CAP = Object.freeze({ TRANSIT_POINTS: 10, STOPS: 12 });

export function dayCapacity(day) {
  const lodgingPoints = day.lodging_start.id === day.lodging_end.id ? 1 : 2;
  return day.mode === 'TRANSIT' ? Math.min(CAP.STOPS, CAP.TRANSIT_POINTS - lodgingPoints) : CAP.STOPS;
}
const anchorOf = (day) => centroid([day.lodging_start, day.lodging_end]);
const reasonText = {
  closed_business: (c) => `${c.name} is listed as closed (not operational)`,
  closed_day: (c) => `${c.name} is closed on every day of the trip`,
  outside_day: (c, d) => `${c.name} only opens outside your planning day (${d})`,
  outside_hours: (c) => `${c.name}'s opening hours are too short for a ${c.minutes}-minute visit inside the day`,
  too_far: (c, km) => `${c.name} is about ${Math.round(km)} km from the nearest lodging`,
  day_full: (c, d) => `no room left on ${d}, the closest day for ${c.name}`,
  other: (c) => `${c.name} has no Google location on file`
};

/** assign({ days, cands, rng }) → { byDate: { date: [cand] }, later: [{ cand, code, reason, from_date }] } */
export function assign({ days, cands, rng }) {
  const byDate = Object.fromEntries(days.map((d) => [d.date, []]));
  const later = [];
  const cap = Object.fromEntries(days.map((d) => [d.date, dayCapacity(d)]));
  const drop = (cand, code, extra, from_date = null) => later.push({ cand, code, reason: reasonText[code](cand, extra), from_date });

  const feasible = new Map(); // cand.id → [{ date, day, km }]
  const pending = [];
  for (const c of cands) {
    if (!c.loc) { drop(c, 'other'); continue; }
    const codes = {};
    const ok = [];
    for (const day of days) {
      let code = unfitCode(c.hours[day.date], c.minutes, day.dayStart + breakfastLen(day), day.dayEnd);
      if (!code && c.booking) {
        if (c.booking.date !== day.date) code = 'booked_elsewhere';
        else if (c.booking.time < day.dayStart || c.booking.time + c.minutes > day.dayEnd) code = 'outside_day';
      }
      if (code) { codes[code] = (codes[code] || 0) + 1; continue; }
      ok.push({ date: day.date, day, km: haversineKm(c.loc, anchorOf(day)) });
    }
    if (!ok.length) {
      const order = ['closed_business', 'outside_hours', 'outside_day', 'closed_day', 'day_full'];
      const code = order.find((k) => codes[k]) || 'closed_day';
      drop(c, code, code === 'outside_day' ? dayWindowText(days[0]) : undefined, c.booking ? c.booking.date : null);
      continue;
    }
    const nearest = ok.reduce((a, b) => (b.km < a.km ? b : a));
    if (nearest.km > FAR_KM[nearest.day.mode]) { drop(c, 'too_far', nearest.km); continue; }
    feasible.set(c.id, ok);
    pending.push(c);
  }

  const rank = (c) => [c.booking ? 0 : c.hint ? 1 : 2, c.priority, rng.key(c.id)];
  pending.sort((a, b) => { const ra = rank(a), rb = rank(b); for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]; return 0; });

  const score = (c, f) => {
    const stops = byDate[f.date];
    const affinity = stops.length ? stops.reduce((s, o) => s + haversineKm(c.loc, o.loc), 0) / stops.length : f.km;
    return 0.5 * f.km + affinity + 1.5 * stops.length;
  };
  for (const c of pending) {
    let opts = feasible.get(c.id);
    if (c.booking) opts = opts.filter((f) => f.date === c.booking.date);
    else if (c.hint && opts.some((f) => f.date === c.hint)) opts = opts.filter((f) => f.date === c.hint);
    const open = opts.filter((f) => byDate[f.date].length < cap[f.date]).sort((a, b) => score(c, a) - score(c, b) || a.date.localeCompare(b.date));
    if (open.length) { byDate[open[0].date].push(c); continue; }
    const closest = opts.slice().sort((a, b) => a.km - b.km)[0];
    drop(c, 'day_full', closest.date, closest.date);
  }
  return { byDate, later };
}

function dayWindowText(day) { const h = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); return `${h(day.dayStart)}–${h(day.dayEnd)}`; }

// Developed by: LightAISolutions

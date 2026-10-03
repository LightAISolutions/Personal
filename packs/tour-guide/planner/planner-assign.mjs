/**
 * Tour Guide planner — day assignment (no API calls). Each candidate goes to one trip date or to a Later reason:
 *   1. no location / closed business / closed or outside hours on every date → Later (closed_business, closed_day, outside_day, outside_hours, other);
 *   2. farther than FAR_KM[mode] from every day's lodging → Later (too_far) before any matrix element is spent; a place
 *      that is near a day it is closed and far from every day it is open says so (closed_day, "closed on <date>, the day
 *      you are near it") rather than giving the distance to a town it is open in;
 *   3. bookings pin the date; a `scheduled_hint` (a promoted place) prefers its date;
 *   4. the rest, priority first, go to the feasible date with the best score = 0.5·km-to-anchor + mean km to the
 *      stops already on that date (or the anchor km when none) + 1.5·stops already there; capacity is capped per day
 *      (CAP: ≤ 10 matrix points on a TRANSIT day, ≤ 12 stops otherwise) so the subset solver stays exact and the
 *      matrix stays inside one request; overflow → Later (day_full) after one more pass over the remaining days.
 * WP-11e: a day with an outline entry (day.outline, planner-outline.mjs) takes only places inside its area and of its
 * kind, at most outlineCap() of them; an outline anchor is pinned to its date like a booking and skips the far screen.
 * A rain-spare day first takes the covered places with no booking, anchor or hint (best rank first) up to its cap
 * (twice that when `uncapped`).
 * `uncapped` lifts the stop cap (a free day still takes none) — the journey module's per-date pools. Without an outline
 * and without `uncapped` nothing here changes.
 */
import { haversineKm, centroid } from './planner-geo.mjs';
import { unfitCode } from './planner-hours.mjs';
import { breakfastLen } from './planner-input.mjs';
import { dayAnchors } from './planner-anchors.mjs';
import { outlineCode, outlineCap, AREA_KM } from './planner-outline.mjs';

export const FAR_KM = Object.freeze({ TRANSIT: 30, WALK: 12, DRIVE: 120 });
export const CAP = Object.freeze({ TRANSIT_POINTS: 10, STOPS: 12 });

export function dayCapacity(day) {
  // Phase 11: an overridden day counts its own matrix points (start, end, the bag stop's lodging).
  const lodgingPoints = day.override ? dayAnchors(day).points.length : day.lodging_start.id === day.lodging_end.id ? 1 : 2;
  return day.mode === 'TRANSIT' ? Math.min(CAP.STOPS, CAP.TRANSIT_POINTS - lodgingPoints) : CAP.STOPS;
}
const anchorOf = (day) => { if (day.outline && day.outline.area) return day.outline.area; if (!day.override) return centroid([day.lodging_start, day.lodging_end]); const a = dayAnchors(day); return centroid([a.coreS, a.coreE]); };
const reasonText = {
  closed_business: (c) => `${c.name} is listed as closed (not operational)`,
  closed_day: (c, d) => (d ? `${c.name} is closed on ${d}, the day you are near it` : `${c.name} is closed on every day of the trip`),
  outside_day: (c, d) => `${c.name} only opens outside your planning day (${d})`,
  outside_hours: (c) => `${c.name}'s opening hours are too short for a ${c.minutes}-minute visit inside the day`,
  too_far: (c, km) => `${c.name} is about ${Math.round(km)} km from the nearest lodging`,
  day_full: (c, d) => `no room left on ${d}, the closest day for ${c.name}`,
  outside_area: (c) => `${c.name} lies outside the areas your outline gives the days near it`,
  outline_kind: (c) => `${c.name} does not suit the kind of day your outline gives the days near it`,
  other: (c) => `${c.name} has no Google location on file`
};

/** Later codes for the outline's own reasons (the Later code enum has no outline code). */
const LATER_CODE = Object.freeze({ outside_area: 'too_far', outline_kind: 'day_full' });

/** assign({ days, cands, rng, uncapped? }) → { byDate: { date: [cand] }, later: [{ cand, code, reason, from_date }] } */
export function assign({ days, cands, rng, uncapped = false }) {
  const byDate = Object.fromEntries(days.map((d) => [d.date, []]));
  const later = [];
  const cap = Object.fromEntries(days.map((d) => [d.date, uncapped ? (outlineCap(d, 1) ? Infinity : 0) : outlineCap(d, dayCapacity(d))]));
  const drop = (cand, code, extra, from_date = null) => later.push({ cand, code: LATER_CODE[code] || code, reason: reasonText[code](cand, extra).slice(0, 300), from_date });

  const feasible = new Map(); // cand.id → [{ date, day, km }]
  const pending = [];
  for (const c of cands) {
    if (!c.loc) { drop(c, 'other'); continue; }
    const codes = {};
    const ok = [], shut = [];
    for (const day of days) {
      let code = unfitCode(c.hours[day.date], c.minutes, day.dayStart + breakfastLen(day), day.dayEnd);
      if (!code && c.booking) {
        if (c.booking.date !== day.date) code = 'booked_elsewhere';
        else if (c.booking.time < day.dayStart || c.booking.time + c.minutes > day.dayEnd) code = 'outside_day';
      }
      if (!code && c.anchor && c.anchor !== day.date) code = 'anchored_elsewhere';
      if (!code && day.outline) code = outlineCode(c, day);
      if (code) { codes[code] = (codes[code] || 0) + 1; if (code === 'closed_day') shut.push({ date: day.date, day, km: haversineKm(c.loc, anchorOf(day)) }); continue; }
      ok.push({ date: day.date, day, km: haversineKm(c.loc, anchorOf(day)) });
    }
    if (!ok.length) {
      const order = ['closed_business', 'outside_hours', 'outside_day', 'outside_area', 'outline_kind', 'closed_day', 'day_full'];
      const code = order.find((k) => codes[k]) || 'closed_day';
      drop(c, code, code === 'outside_day' ? dayWindowText(days[0]) : undefined, c.booking ? c.booking.date : c.anchor || null);
      continue;
    }
    const nearest = ok.reduce((a, b) => (b.km < a.km ? b : a));
    if (!c.anchor && nearest.km > FAR_KM[nearest.day.mode]) {
      const near = shut.filter((f) => f.km <= FAR_KM[f.day.mode]).sort((a, b) => a.km - b.km || a.date.localeCompare(b.date))[0];
      const oc = codes.outside_area ? 'outside_area' : codes.outline_kind ? 'outline_kind' : null;   // WP-11e: the outline kept it off its nearer days
      if (near) drop(c, 'closed_day', near.date); else if (oc) drop(c, oc); else drop(c, 'too_far', nearest.km);
      continue;
    }
    feasible.set(c.id, ok);
    pending.push(c);
  }

  const rank = (c) => [c.booking || c.anchor ? 0 : c.hint ? 1 : 2, c.priority, rng.key(c.id)];
  pending.sort((a, b) => { const ra = rank(a), rb = rank(b); for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]; return 0; });

  const score = (c, f) => {
    const stops = byDate[f.date];
    const affinity = stops.length ? stops.reduce((s, o) => s + haversineKm(c.loc, o.loc), 0) / stops.length : f.km;
    return 0.5 * f.km + affinity + 1.5 * stops.length;
  };
  // WP-11e: a rain-spare day first takes the covered places (best rank first) that have no date of their own, so a
  // full day nearby never takes the indoor places the spare day exists for. Without an area, only places within
  // AREA_KM[mode] of the day's lodging count (a far museum is not a rainy-day fallback).
  const spare = days.filter((d) => d.outline && d.outline.kind === 'rain_spare');
  const placed = new Set();
  for (const d of spare) {
    const limit = uncapped ? 2 * outlineCap(d, CAP.STOPS) : cap[d.date];   // a version pool: room for two light versions
    for (const c of pending) {
      if (byDate[d.date].length >= limit) break;
      if (placed.has(c.id) || c.booking || c.anchor || c.hint || !c.covered) continue;
      if (!feasible.get(c.id).some((f) => f.date === d.date && (d.outline.area || f.km <= AREA_KM[d.mode]))) continue;   // near the day's area, or its lodging
      byDate[d.date].push(c); placed.add(c.id);
    }
  }
  for (const c of pending) {
    if (placed.has(c.id)) continue;
    let opts = feasible.get(c.id);
    if (c.booking) opts = opts.filter((f) => f.date === c.booking.date);
    else if (c.anchor) opts = opts.filter((f) => f.date === c.anchor);
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

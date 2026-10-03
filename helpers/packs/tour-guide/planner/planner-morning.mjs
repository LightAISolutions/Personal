/**
 * Tour Guide planner — what the morning message needs from a built day (Phase 12, WP-12a; Contract C12 outputs):
 *   leaveBy(dayPlan) → 'HH:MM' | null   the departure of the day's first leg (from the lodging, the day's start or,
 *                                        after a re-plan from a shared location, "here"); null on a day without legs
 *   dayAreas(trip, dayPlan) → [area] | null   the morning lodging's `area`, then the night lodging's when it differs (a
 *                                        moving day); null when neither lodging has an area. A day override's `start` or
 *                                        `end` does not change it: the areas are the lodgings' towns, not the stations.
 *   withMorning(trip, dayPlan) → dayPlan   sets `leave_by` (every day with a leg) and `areas` (only when known) in place
 * No API call; the planner adds both to every day it builds (planTrip, replanDays, planDates).
 */

/** The departure of the day's first leg, or null. */
export function leaveBy(dayPlan) {
  const L = dayPlan && Array.isArray(dayPlan.legs) ? dayPlan.legs : [];
  return L.length ? L[0].depart_at : null;
}

/** The day's town(s) from its lodgings' `area` (C12), or null. */
export function dayAreas(trip, dayPlan) {
  const lodging = trip && Array.isArray(trip.lodging) ? trip.lodging : [];
  const areaOf = (id) => { const l = lodging.find((x) => x && x.id === id); return l && typeof l.area === 'string' && l.area.trim() ? l.area.trim().slice(0, 60) : null; };
  const out = [];
  for (const a of [areaOf(dayPlan.lodging_start), areaOf(dayPlan.lodging_end)]) if (a && !out.includes(a)) out.push(a);
  return out.length ? out : null;
}

/** Add `leave_by` and `areas` to a built day (in place) and return it. */
export function withMorning(trip, dayPlan) {
  const t = leaveBy(dayPlan);
  if (t) dayPlan.leave_by = t; else delete dayPlan.leave_by;
  const areas = dayAreas(trip, dayPlan);
  if (areas) dayPlan.areas = areas; else delete dayPlan.areas;
  return dayPlan;
}

// Developed by: LightAISolutions

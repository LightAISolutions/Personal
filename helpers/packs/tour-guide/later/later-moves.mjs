/**
 * Tour Guide Later lists — promote and demote. Both return { lists, places, affected_days } so the caller re-plans
 * only those days (the planner's replanDays(plan, affected_days, input) keeps every other day byte-identical).
 *   promote: a Later item goes back to the candidates for one date (status → candidate, scheduled_hint: { date }).
 *   demote:  a scheduled stop is taken out (status → saved-for-later) and listed with its reason; the affected day
 *            is the date whose DayPlan held it.
 */
import { addItem, removeItem } from './later-lists.mjs';

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function placeOf(places, slug) {
  const p = places.find((x) => x.id === slug);
  if (!p) throw new Error(`later: unknown place "${slug}"`);
  return p;
}

/** promote({ lists, places, place, to_date }) → { lists, places, affected_days: [to_date] } */
export function promote({ lists, places, place, to_date } = {}) {
  placeOf(places, place);
  if (!DATE_RE.test(String(to_date || ''))) throw new TypeError('later: to_date must be YYYY-MM-DD');
  return {
    lists: removeItem(lists, place),
    places: places.map((p) => (p.id === place ? { ...p, status: 'candidate', scheduled_hint: { date: to_date } } : { ...p })),
    affected_days: [to_date]
  };
}

/**
 * demote({ lists, places, days, place, reason, code = 'owner', added_on }) → { lists, places, affected_days }
 * affected_days lists every date whose DayPlan has a stop at the place (normally one), in date order; from_date on the
 * Later item is the first of them.
 */
export function demote({ lists, places, days = [], place, reason, code = 'owner', added_on } = {}) {
  const p = placeOf(places, place);
  const affected = [...new Set(days.filter((d) => d.stops.some((s) => s.place === place)).map((d) => d.date))].sort();
  const next = addItem(lists, { place, place_id: p.place_id, reason, code, added_on, from_date: affected[0] });
  const updated = places.map((x) => {
    if (x.id !== place) return { ...x };
    const rest = { ...x, status: 'saved-for-later' };
    delete rest.scheduled_hint;
    return rest;
  });
  return { lists: next, places: updated, affected_days: affected };
}

// Developed by: LightAISolutions

/**
 * Tour Guide planner — a day's real start and end (Phase 11, WP-11a; Contract C11 `trip.day_overrides`).
 * An override for a date may give that day its own hours (`day_start`, `day_end`), a real start (`start`: an arrival —
 * the day's first point, and its time is the day's start, with no breakfast at the lodging), a real end (`end`: a
 * departure — the day must reach it by its time, END_MARGIN minutes early, with no spill) and a bag step (`bags`):
 *   · hotel   — the day goes to the night's lodging first: a BAGS.HOTEL_MIN-minute stop ("leave your bags"), then the sights;
 *   · locker  — a BAGS.LOCKER_MIN-minute stop at the start point, and the day ends through the start point
 *               (BAGS.COLLECT_MIN minutes to collect them) before its end;
 *   · forward / carry — only the bag line ("bags sent ahead to <lodging>", "carry your bags today").
 * Reserved slugs name the points in legs: 'day-start', 'day-end', and 'lodging' as before.
 *   overrideFor(trip, date) → the override or null (the first for a date; malformed parts ignored)
 *   dayAnchors(day) → { S, E, coreS, coreE, hotel, locker, points } — the points a day's matrix and legs use
 */
import { toMin } from './planner-time.mjs';
import { isLoc } from './planner-geo.mjs';
import { pointKey } from './planner-legs.mjs';

export const START_SLUG = 'day-start';
export const END_SLUG = 'day-end';
export const LODGING_SLUG = 'lodging';
export const BAGS = Object.freeze({ HOTEL_MIN: 15, LOCKER_MIN: 10, COLLECT_MIN: 10 });
export const BAG_KINDS = Object.freeze(['carry', 'locker', 'hotel', 'forward']);
/** Minutes before a departure (`end.time`) the day reaches the end point. */
export const END_MARGIN = 10;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The override for `date`, normalised: { day_start?, day_end?, start?, end?, bags?, bags_note?, note? } (minutes for times). */
export function overrideFor(trip, date) {
  const list = trip && Array.isArray(trip.day_overrides) ? trip.day_overrides : [];
  const o = list.find((x) => x && x.date === date);
  if (!o) return null;
  const out = {};
  if (TIME_RE.test(o.day_start || '')) out.day_start = toMin(o.day_start);
  if (TIME_RE.test(o.day_end || '')) out.day_end = toMin(o.day_end);
  for (const k of ['start', 'end']) {
    const p = o[k];
    if (!p || !isLoc(p) || !TIME_RE.test(p.time || '') || typeof p.name !== 'string' || !p.name.trim()) continue;
    out[k] = { id: k === 'start' ? START_SLUG : END_SLUG, slug: k === 'start' ? START_SLUG : END_SLUG, name: p.name.trim().slice(0, 120), placeId: p.place_id || null, lat: p.lat, lng: p.lng, time: toMin(p.time) };
  }
  if (BAG_KINDS.includes(o.bags)) out.bags = o.bags;
  if (typeof o.bags_note === 'string' && o.bags_note.trim()) out.bags_note = o.bags_note.trim().slice(0, 160);
  if (typeof o.note === 'string' && o.note.trim()) out.note = o.note.trim().slice(0, 200);
  return Object.keys(out).length ? out : null;
}

/**
 * dayAnchors(day) — S: where the day starts (the arrival, or the previous night's lodging); E: where it ends (the
 * departure, or the night's lodging); coreS / coreE: the ends of the sightseeing part the solver plans (hotel: the
 * night's lodging after the bag stop; locker: the start point at both ends); points: the distinct points of the day's
 * Route Matrix (coreS, coreE, and E when the locker day leaves from elsewhere). L: the locker's point — the start point,
 * or (C12, a re-plan of the rest of a locker day: `day.lockerAt`) the old start, where the bags already are.
 */
export function dayAnchors(day) {
  const S = day.start || { ...day.lodging_start, slug: LODGING_SLUG };
  const E = day.end || { ...day.lodging_end, slug: LODGING_SLUG };
  const hotel = day.bags === 'hotel' ? { ...day.lodging_end, slug: LODGING_SLUG } : null;
  const locker = day.bags === 'locker';
  const L = locker && day.lockerAt ? day.lockerAt : S;   // C12: a re-plan after the bags went into the locker at the old start
  const coreS = hotel || S;
  const coreE = locker ? L : E;
  const points = [];
  const add = (p) => { if (!points.some((q) => pointKey(q) === pointKey(p))) points.push(p); };
  add(coreS); add(coreE);
  if (locker) add(E);
  return { S, E, L, coreS, coreE, hotel, locker, points };
}

/** The bag line for a day: ≤ 160 characters. */
export function bagsText(kind, { start, lodging, note } = {}) {
  const base = kind === 'hotel' ? `Leave your bags at ${lodging} before the first sight`
    : kind === 'locker' ? `Bags in a locker at ${start}; collect them on the way out`
    : kind === 'forward' ? `Bags sent ahead to ${lodging}`
    : 'Carry your bags today';
  return (note ? `${base} · ${note}` : base).slice(0, 160);
}

// Developed by: LightAISolutions

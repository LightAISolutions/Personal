/**
 * Tour Guide planner — input normalisation. Turns the contract entities (Trip, Place, GoogleSnapshot, VisitEstimate,
 * profile, calibration) into the planner's working records: one `day` per trip date (mode, lodging endpoints, bounds)
 * and one `cand` per schedulable place (location, minutes to spend, priority, booking, opening hours per date).
 * Visit lengths come from the estimator (`chooseMinutes`), injected by the caller or imported from ../estimator/.
 */
import { toMin, isDate, dateRange, assertTimeZone } from './planner-time.mjs';
import { hoursOn } from './planner-hours.mjs';
import { isLoc } from './planner-geo.mjs';

export const PACE = Object.freeze({ relaxed: { breakfast: 45, lunch: 75, dinner: 75 }, normal: { breakfast: 35, lunch: 60, dinner: 60 }, packed: { breakfast: 25, lunch: 45, dinner: 45 } });
export const LUNCH_WINDOW = Object.freeze({ open: 12 * 60, close: 14 * 60 });
export const DINNER_EARLIEST = 18 * 60 + 30;
const MODES = ['TRANSIT', 'DRIVE', 'WALK'];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const fail = (m) => { throw new Error('planner: ' + m); };

/** Lodging covering the night of `date` (from ≤ date < to); on the check-out date the one whose `to` is that date. */
export function lodgingForNight(trip, date) {
  return trip.lodging.find((l) => l.from <= date && date < l.to) || (date === trip.end_date ? trip.lodging.find((l) => l.from <= date && l.to === date) : undefined) || null;
}
export function modeFor(trip, date) {
  const m = (trip.modes.by_date && trip.modes.by_date[date]) || trip.modes.default;
  if (!MODES.includes(m)) fail(`unsupported mode "${m}" (TRANSIT, DRIVE or WALK)`);
  if (trip.modes.allowed && !trip.modes.allowed.includes(m)) fail(`mode ${m} on ${date} is not in modes.allowed`);
  return m;
}
const point = (l) => ({ id: l.id, name: l.name, placeId: l.place_id || null, lat: l.lat, lng: l.lng });

export function buildDays(trip) {
  const dayStart = toMin(trip.day_start), dayEnd = toMin(trip.day_end);
  if (dayEnd - dayStart < 120) fail('day_end must be at least two hours after day_start');
  const pace = PACE[trip.pace] || fail(`unknown pace "${trip.pace}"`);
  return dateRange(trip.start_date, trip.end_date).map((date, i, all) => {
    const end = lodgingForNight(trip, date) || fail(`no lodging covers the night of ${date}`);
    const start = i === 0 ? end : lodgingForNight(trip, all[i - 1]);
    return { date, mode: modeFor(trip, date), lodging_start: point(start), lodging_end: point(end), dayStart, dayEnd, pace };
  });
}

function validateTrip(trip) {
  if (!trip || trip.v !== 1) fail('trip must be a v1 Trip');
  if (!SLUG_RE.test(trip.id || '')) fail('trip.id must be a slug');
  assertTimeZone(trip.timezone);
  if (!isDate(trip.start_date) || !isDate(trip.end_date) || trip.end_date < trip.start_date) fail('trip dates must be YYYY-MM-DD with end ≥ start');
  if (dateRange(trip.start_date, trip.end_date).length > 31) fail('a trip is at most 31 days');
  if (!Array.isArray(trip.lodging) || !trip.lodging.length) fail('trip.lodging must list at least one lodging');
  for (const l of trip.lodging) if (!SLUG_RE.test(l.id || '') || !isLoc(l) || !isDate(l.from) || !isDate(l.to)) fail(`lodging ${l && l.id} needs id, lat, lng, from, to`);
  if (!trip.modes || !trip.modes.default) fail('trip.modes.default is required');
}

/**
 * prepare(input) → { trip, days, cands, saved, chooseMinutes, snapshots }
 * input: { trip, places, snapshots (array or map by place_id), estimates (array or map), notes?, profile, calibration?, chooseMinutes? }
 */
export async function prepare(input) {
  const { trip, profile = {} } = input || {};
  validateTrip(trip);
  const places = Array.isArray(input.places) ? input.places : fail('places must be an array of Place');
  const snapshots = toMap(input.snapshots, 'snapshots');
  const estimates = toMap(input.estimates, 'estimates');
  const chooseMinutes = input.chooseMinutes || (await import('../estimator/index.mjs')).chooseMinutes;
  const days = buildDays(trip);
  const dates = days.map((d) => d.date);
  const cands = [], saved = [];
  const seen = new Set();
  for (const p of places) {
    if (!p || !SLUG_RE.test(p.id || '')) fail(`place ${p && p.id} needs a slug id`);
    if (seen.has(p.id)) fail(`duplicate place id ${p.id}`);
    seen.add(p.id);
    if (p.status === 'saved-for-later') { saved.push(p); continue; }
    if (p.status !== 'candidate' && p.status !== 'scheduled') continue;
    const snap = snapshots.get(p.place_id) || null;
    const est = estimates.get(p.place_id) || null;
    const interest = (profile.interests && profile.interests[p.category]) || 'normal';
    const cm = chooseMinutes({ estimate: est || undefined, range: est ? est.range : null, typical: est ? est.typical : null, category: p.category, pace: trip.pace, interest, calibration: input.calibration || null });
    if (!cm || !Number.isInteger(cm.minutes) || cm.minutes < 5) fail(`chooseMinutes returned no usable minutes for ${p.id}`);
    const booking = p.booking && p.booking.date ? { date: p.booking.date, time: toMin(p.booking.time), ref: p.booking.ref || null } : null;
    const hint = p.scheduled_hint && dates.includes(p.scheduled_hint.date) ? p.scheduled_hint.date : null;
    cands.push({
      id: p.id, place_id: p.place_id, name: p.name, category: p.category, activity: p.activity, priority: p.priority || 2,
      loc: snap && isLoc(snap.location) ? snap.location : null, minutes: cm.minutes, confidence: cm.confidence || (est && est.confidence) || 'unverified',
      booking, hint, hours: Object.fromEntries(dates.map((d) => [d, hoursOn(snap, d)]))
    });
  }
  return { trip, days, cands, saved, chooseMinutes, snapshots, pace: PACE[trip.pace] };
}

function toMap(x, label) {
  if (x instanceof Map) return x;
  if (Array.isArray(x)) return new Map(x.filter((e) => e && e.place_id).map((e) => [e.place_id, e]));
  if (x && typeof x === 'object') return new Map(Object.entries(x));
  fail(`${label} must be an array or a map keyed by place_id`);
}

// Developed by: LightAISolutions

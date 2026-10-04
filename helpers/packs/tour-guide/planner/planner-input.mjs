/**
 * Tour Guide planner — input normalisation. Turns the contract entities (Trip, Place, GoogleSnapshot, VisitEstimate,
 * profile, calibration) into the planner's working records: one `day` per trip date (mode, lodging endpoints, bounds)
 * and one `cand` per schedulable place (location, minutes to spend, priority, booking, opening hours per date).
 * Visit lengths come from the estimator (`chooseMinutes`), injected by the caller or imported from ../estimator/.
 * Phase 11 (WP-11a): a date in `trip.day_overrides` gets its own hours, start and end points and bag step
 * (planner-anchors.mjs); a place's `facts` set its hours and visit length (planner-facts.mjs, `minutes_source`); a
 * `crowd_magnet` is marked when the profile asks to avoid crowds (planner-crowd.mjs); the trip's `country` reaches the
 * estimator; a meal place offered in `input.dinners` (and not a lunch spot) is kept out of the day's stops for dinner.
 */
import { toMin, hm, dayDate, isDate, dateRange, assertTimeZone, dateIn } from './planner-time.mjs';
import { hoursOn } from './planner-hours.mjs';
import { isLoc } from './planner-geo.mjs';
import { refineCategory, MEAL_CATEGORIES } from './planner-category.mjs';
import { overrideFor } from './planner-anchors.mjs';
import { placeFacts, factsHours, factsMinutes } from './planner-facts.mjs';
import { avoidsCrowds } from './planner-crowd.mjs';
import { factsStale } from '../facts/index.mjs';

export const PACE = Object.freeze({ relaxed: { breakfast: 45, lunch: 75, dinner: 75 }, normal: { breakfast: 35, lunch: 60, dinner: 60 }, packed: { breakfast: 25, lunch: 45, dinner: 45 } });
export const LUNCH_WINDOW = Object.freeze({ open: 12 * 60, close: 14 * 60 });
export const DINNER_EARLIEST = 18 * 60 + 30;
/** A day that starts this late (an arrival day, say) has no breakfast at the lodging. */
export const LATE_START = 10 * 60 + 30;
export const breakfastLen = (day, atLodging = true) => (atLodging && !day.start && day.dayStart < LATE_START ? day.pace.breakfast : 0);   // a day starting at an arrival point has none
const LUNCH_RE = /\blunch\b/i;
const MODES = ['TRANSIT', 'DRIVE', 'WALK'];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const fail = (m) => { throw new Error('planner: ' + m); };

/** Lodging covering the night of `date` (from ≤ date < to); on the check-out date the one whose `to` is that date. */
/** A meal place the routine offered for dinner (its id in `dinnerIds`) is dinner, not a daytime stop — unless it is a lunch spot. */
export function isWithheldDinner(p, dinnerIds, category = refineCategory(p)) {
  return !!p && dinnerIds.has(p.id) && MEAL_CATEGORIES.includes(category) && !LUNCH_RE.test(p.activity || '');
}

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
    const day = { date, mode: modeFor(trip, date), lodging_start: point(start), lodging_end: point(end), dayStart, dayEnd, pace };
    const o = overrideFor(trip, date);
    return o ? withOverride(day, o) : day;
  });
}

/**
 * Phase 11: a day override. `day_start`/`day_end` replace the day's hours; `start.time` replaces the start (and wins
 * over day_start); `end.time` is a hard end (the day reaches the end point END_MARGIN minutes before it; planner-day.mjs).
 * A day the override leaves under two hours long is still planned (its stops are dropped as they fail to fit).
 * Phase 13 (A2): an override whose end is not after its start never throws; it is clamped (clampOverride).
 */
export function withOverride(day, o) {
  const d = { ...day, override: true };
  if (Number.isInteger(o.day_start)) d.dayStart = o.day_start;
  if (Number.isInteger(o.day_end)) d.dayEnd = o.day_end;
  if (o.start) { d.start = o.start; d.dayStart = o.start.time; }
  if (o.end) { d.end = o.end; d.dayEnd = Number.isInteger(o.day_end) ? Math.min(o.day_end, o.end.time) : o.end.time; }
  if (d.dayEnd <= d.dayStart) clampOverride(d, day);
  if (o.bags) d.bags = o.bags;
  if (o.bags_note) d.bags_note = o.bags_note;
  if (o.note) d.note = o.note;
  return d;
}

/** Phase 13 (A2): the length a clamped override gives its day (the two-hour rule of `/dates hours`). */
export const CLAMP_MINUTES = 120;
/**
 * Phase 13 (A2): an override whose end is not after its start (the brain, an outline or the app wrote it without the
 * core's `/dates` check). What is fixed is kept and the rest moves:
 *   · the end is a real departure (`end.time`), or neither side is fixed: the end stays and the start moves to
 *     CLAMP_MINUTES before it (never before 00:00);
 *   · only the start is fixed (`start.time`): the start stays and the end moves to CLAMP_MINUTES after it (by 23:59);
 *   · both are fixed: the day is planned without stops (`noStops`) and an over_long_day alert says so.
 * A `warn` (or that alert) on the day names the date, the values given and the fix (`day.notes`, planner-day.mjs).
 */
function clampOverride(d, day) {
  const date = day.date, gs = hm(d.dayStart), ge = hm(d.dayEnd), on = dayDate(date);
  if (d.start && d.end) {
    d.noStops = true;
    d.notes = [{ severity: 'alert', code: 'over_long_day', text: `${on}: the day must end at ${ge}, before it starts at ${gs}, so it is planned without stops. Fix the times with /dates ${date}`.slice(0, 200) }];
    return;
  }
  if (d.start) d.dayEnd = Math.min(1439, d.dayStart + CLAMP_MINUTES);
  else d.dayStart = Math.max(0, d.dayEnd - CLAMP_MINUTES);
  d.notes = [{ severity: 'warn', code: 'other', text: `${on}: the hours given end at ${ge}, before they start at ${gs}; planned ${hm(d.dayStart)}–${hm(d.dayEnd)}. To change it: /dates ${date} hours ${hm(d.dayStart)} ${hm(d.dayEnd)}`.slice(0, 200) }];
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
 * Phase 13 (A5): when a place's own facts set its hours (closed weekdays, closing time, last entry) or its visit length
 * and were checked longer than FACTS_MAX_AGE_DAYS before `today` (facts/facts-check.mjs factsStale, called as it is),
 * the date they were checked ('an unknown date' when none is given); otherwise null. The facts still apply.
 *   oldFactsDate(rawFacts, today, { visit = true }) → 'YYYY-MM-DD' | 'an unknown date' | null
 */
export function oldFactsDate(rawFacts, today, { visit = true } = {}) {
  if (!rawFacts || typeof rawFacts !== 'object' || !isDate(today)) return null;
  const f = placeFacts({ facts: rawFacts });
  const uses = f && (f.closed_weekdays || f.close !== null || f.last_entry !== null || (visit && f.visit));
  if (!uses || !factsStale(rawFacts, today).facts) return null;
  return isDate(rawFacts.checked) ? rawFacts.checked : 'an unknown date';
}
export const factsOldText = (name, checked) => `facts are old: ${name}, checked ${checked}`.slice(0, 200);
export const factsOldCheck = (checked) => `Hours last checked ${checked} — check before you go`.slice(0, 160);

/** The plan's day: the trip-zone date of `now` (null when `now` is not a date). */
export function planToday(now, tz) {
  const t = now === undefined || now === null ? new Date() : new Date(now);
  return Number.isNaN(t.getTime()) ? null : dateIn(t, tz);
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
  const cands = [], saved = [], withheld = [];
  const seen = new Set();
  const crowdRule = avoidsCrowds(profile);
  const today = planToday(input.now, trip.timezone);   // Phase 13 (A5): facts are judged on the plan's day
  const dinnerIds = new Set((Array.isArray(input.dinners) ? input.dinners : []).filter((p) => p && p.id).map((p) => p.id));
  for (const p of places) {
    if (!p || !SLUG_RE.test(p.id || '')) fail(`place ${p && p.id} needs a slug id`);
    if (seen.has(p.id)) fail(`duplicate place id ${p.id}`);
    seen.add(p.id);
    if (p.status === 'saved-for-later') { saved.push(p); continue; }
    if (p.status !== 'candidate' && p.status !== 'scheduled' && p.status !== 'chosen') continue;
    const snap = snapshots.get(p.place_id) || null;
    const est = estimates.get(p.place_id) || null;
    const category = refineCategory(p);   // Phase 10 fix (b): a legacy church named "…-ji" plans as a temple
    const interest = (profile.interests && (profile.interests[category] || profile.interests[p.category])) || 'normal';
    const booked = p.booking && Number.isInteger(p.booking.minutes) && p.booking.minutes > 0 ? p.booking.minutes : null;   // a booking's own length always wins
    const cmArgs = { estimate: est || undefined, range: est ? est.range : null, typical: est ? est.typical : null, category, pace: trip.pace, interest, calibration: input.calibration || null,
      activity: p.activity || null, booked };
    if (trip.country) cmArgs.country = trip.country;   // Phase 11: country defaults (estimator-defaults.mjs); absent = exactly as before
    const cm = chooseMinutes(cmArgs);
    if (!cm || !Number.isInteger(cm.minutes) || cm.minutes < 5) fail(`chooseMinutes returned no usable minutes for ${p.id}`);
    const booking = p.booking && p.booking.date ? { date: p.booking.date, time: toMin(p.booking.time), ref: p.booking.ref || null } : null;
    const hint = p.scheduled_hint && dates.includes(p.scheduled_hint.date) ? p.scheduled_hint.date : null;
    const irregular = p.opening_days === 'irregular';   // Phase 10 fix (e): never "closed" on a trip date; scheduled within known hours
    // Phase 11: the place's own facts win over Google's hours and the estimator's length.
    const facts = placeFacts(p), own = {};
    const hours = Object.fromEntries(dates.map((d) => {
      const r = factsHours(hoursOn(snap, d, { irregular }), facts, d, snap, p.name);
      if (r.conflict) own[d] = r.conflict;
      return [d, r.hours];
    }));
    const factor = cm.factors && !cm.fixed ? (cm.factors.pace || 1) * (cm.factors.interest || 1) * (cm.factors.calibration || 1) : 1;
    const official = !booked && facts && facts.visit ? factsMinutes(facts.visit, factor) : null;
    const cand = {
      id: p.id, place_id: p.place_id, name: p.name, category, activity: p.activity, priority: p.priority || 2,
      loc: snap && isLoc(snap.location) ? snap.location : null, minutes: booked || official || cm.minutes, confidence: cm.confidence || (est && est.confidence) || 'unverified',
      booking, hint, hours
    };
    if (cm.fixed && !official) cand.fixed = true;   // a set session (booking length or a ceremony/class): never shortened, exact time
    if (typeof p.opening_note === 'string' && p.opening_note.trim()) cand.opening_note = p.opening_note.trim().slice(0, 160);
    if (facts) {   // only a place with facts carries the new stop fields, so an old plan's stops are unchanged
      cand.minutes_source = booked || official ? 'official' : est && (est.range || est.typical) ? 'research' : 'estimate';
      if (facts.last_entry_text) cand.last_entry = facts.last_entry_text;
      if (Object.keys(own).length) cand.own_hours = own;
      const old = oldFactsDate(p.facts, today, { visit: !!official });
      if (old) cand.facts_old = old;   // Phase 13 (A5): still applied, flagged on the stop
    }
    // The gem screen's mark, read as set (never recomputed): `crowd_magnet: true` on the place, or the C11 flag.
    if (crowdRule && (p.crowd_magnet === true || (Array.isArray(p.flags) && p.flags.includes('crowd_magnet')))) cand.crowd = true;
    // A meal place the routine offered for dinner is dinner, not a daytime stop (unless it is the day's lunch spot).
    if (isWithheldDinner(p, dinnerIds, category)) { withheld.push(cand); continue; }
    cands.push(cand);
  }
  return { trip, days, cands, saved, withheld, crowdRule, chooseMinutes, snapshots, pace: PACE[trip.pace] };
}

function toMap(x, label) {
  if (x instanceof Map) return x;
  if (Array.isArray(x)) return new Map(x.filter((e) => e && e.place_id).map((e) => [e.place_id, e]));
  if (x && typeof x === 'object') return new Map(Object.entries(x));
  fail(`${label} must be an array or a map keyed by place_id`);
}

// Developed by: LightAISolutions

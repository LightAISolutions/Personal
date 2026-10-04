/**
 * Tour Guide planner — the evening (Phase 11, WP-11a; Contract C11 DayPlan `sunset`, `extras`). No Maps request.
 *   · sunset: at the night's lodging, in the trip's zone (planner-sun.mjs, NOAA);
 *   · extras (≤ EXTRAS.MAX, events first): season events (`trip.season.events`) running that evening within
 *     EXTRAS.RADIUS_KM in a straight line of the day's last stop or of the night's lodging; and, when the day is back at
 *     least EXTRAS.EARLY_MIN minutes before its end, saved places (Later list / saved-for-later) open then within the same
 *     radius. When a day has extras they replace its "back early" free line. A day that ends at a departure has none.
 * "Running that evening": the event is on that date (from ≤ date ≤ to), is not a holiday or a closure, and ends at or
 * after EXTRAS.EVENING_FROM (or past midnight), or — with a start only — starts at or after EXTRAS.START_FROM, or — with
 * no times — is a light-up. An event is located by its own lat/lng, else its place's snapshot; an event with only an area
 * is not offered (its distance is unknown). A saved place is offered on one day only and must be open (its own facts
 * win) for at least EXTRAS.MIN_OPEN minutes between EXTRAS.AFTER_MIN after the day's finish and the day's end;
 * restaurants and cafes are left to dinner.
 * Phase 13 (A12): no extra starts before the day's start plus its start step (`evening.ready`, the bag step on a moving
 * day): an event under way by then is offered from that time while at least EXTRAS.MIN_OPEN minutes of it are left.
 * Phase 15 (C15, WP-15b, change E): the same rule at the finish — an event under way before the later of the day's
 * finish plus EXTRAS.AFTER_MIN and `ready` is offered from that time while at least EXTRAS.MIN_OPEN minutes of it are
 * left, else not at all (a 10:00–17:30 opening is no longer offered "that evening" at 10:00).
 * Chosen events (What's on, `season_event.chosen_on`): a chosen event is considered only on its `chosen_on`; an evening
 * choice (isEveningChoice) comes first within EXTRAS.CHOSEN_RADIUS_KM with `chosen: true`, and past it the day gets an
 * info warning instead; a daytime choice is never an extra (the private side pins it to its day).
 *   sunsetFor(day, timeZone) → 'HH:MM' | null
 *   isEveningChoice(event) → boolean
 *   eveningExtras({ evening, date, season, places, snapshots, exclude, used, later, warnings }) → extras
 *   applyExtras(dayPlan, extras)
 */
import { haversineKm, isLoc } from './planner-geo.mjs';
import { hoursOn } from './planner-hours.mjs';
import { placeFacts, factsHours } from './planner-facts.mjs';
import { toMin, hm } from './planner-time.mjs';
import { sunsetLocal } from './planner-sun.mjs';
import { refineCategory } from './planner-category.mjs';
import { BACK_EARLY_NOTE } from './planner-day.mjs';

export const EXTRAS = Object.freeze({ RADIUS_KM: 2, MAX: 3, EARLY_MIN: 60, EVENING_FROM: 17 * 60, START_FROM: 16 * 60, MIN_OPEN: 30, AFTER_MIN: 15, CHOSEN_RADIUS_KM: 10 });
const NOT_EVENING = new Set(['holiday', 'closure']);
const FOOD = new Set(['restaurant', 'cafe']);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const km1 = (x) => Math.round(x * 10) / 10;

export function sunsetFor(day, timeZone) {
  const l = day.lodging_end;
  return l && isLoc(l) ? sunsetLocal(day.date, l.lat, l.lng, timeZone) : null;
}

/** true when a season event runs on the evening of `date`. */
export function runsThatEvening(e, date) {
  if (!e || !e.from || !e.to || e.from > date || e.to < date || NOT_EVENING.has(e.kind)) return false;
  const s = TIME_RE.test(e.start || '') ? toMin(e.start) : null, t = TIME_RE.test(e.end || '') ? toMin(e.end) : null;
  if (t !== null) return t >= EXTRAS.EVENING_FROM || (s !== null && t < s);
  if (s !== null) return s >= EXTRAS.START_FROM;
  return e.kind === 'light_up';
}

/**
 * C15: a chosen event the owner meant for an evening — it runs that evening on its `chosen_on` and, when it has a start,
 * starts at or after EXTRAS.START_FROM. Every other chosen event is a daytime choice.
 */
export function isEveningChoice(e) {
  if (!e || typeof e.chosen_on !== 'string' || !runsThatEvening(e, e.chosen_on)) return false;
  return !TIME_RE.test(e.start || '') || toMin(e.start) >= EXTRAS.START_FROM;
}

const WARN_MAX = 40;   // the day plan's warnings cap (tour-guide-day-plan.schema.json)

function eventLoc(e, placesById, snapshots) {
  if (isLoc(e)) return { lat: e.lat, lng: e.lng };
  const p = e.place ? placesById.get(e.place) : null;
  const id = (p && p.place_id) || e.place_id || null;
  const snap = id ? snapshots.get(id) : null;
  return snap && isLoc(snap.location) ? snap.location : null;
}

/**
 * eveningExtras({ evening, date, season, places, snapshots, exclude, used, later, warnings }) → [{ kind, ref, name, time?, km, note?, chosen? }]
 * `places` are the plan's places (final statuses); `exclude`: slugs not to offer (stops, dinners, rejected); `used`:
 * saved places already offered on another day (updated); `warnings`: the day plan's warnings (C15: a far chosen evening
 * event adds an info line; optional).
 */
export function eveningExtras({ evening: ev, date, season, places = [], snapshots, exclude = new Set(), used = new Set(), later = new Set(), warnings = null }) {
  if (!ev || ev.ends) return [];
  const origins = [ev.last && ev.last.cand.loc ? ev.last.cand.loc : null, ev.lodging].filter(isLoc);
  const dist = (loc) => Math.min(...origins.map((o) => haversineKm(o, loc)));
  const byId = new Map(places.map((p) => [p.id, p]));
  // Phase 13 (A12): nothing starts before the day's start plus its start step (`ready`; the bag step on a moving day).
  const ready = Number.isFinite(ev.ready) ? ev.ready : -Infinity;
  // C15 (change E): nor before the stops finish (plus the walk-out step) — the same rule, applied to the finish.
  const from = Math.max(Number.isFinite(ev.finish) ? ev.finish + EXTRAS.AFTER_MIN : -Infinity, ready);
  const chosen = [], events = [];
  for (const e of season && Array.isArray(season.events) ? season.events : []) {
    const isChosen = e && typeof e.chosen_on === 'string';
    if (isChosen ? e.chosen_on !== date || !isEveningChoice(e) : !runsThatEvening(e, date)) continue;   // a chosen event: its day only
    const loc = eventLoc(e, byId, snapshots);
    if (!loc) continue;
    const km = dist(loc);
    if (km > (isChosen ? EXTRAS.CHOSEN_RADIUS_KM : EXTRAS.RADIUS_KM)) {
      if (isChosen && Array.isArray(warnings) && warnings.length < WARN_MAX) {
        warnings.push({ severity: 'info', code: 'other', text: `${String(e.name).slice(0, 120)}, chosen for this evening, is about ${Math.round(km)} km from where the day ends` });
      }
      continue;
    }
    const x = { kind: 'event', ref: e.id, name: String(e.name).slice(0, 120), km: km1(km) };
    if (TIME_RE.test(e.start || '')) {
      const s = toMin(e.start);
      if (s < from) {   // under way before you can get there: offered from then while enough of it is left, else not at all
        const t = TIME_RE.test(e.end || '') ? toMin(e.end) : null;
        const end = t === null ? null : t < s ? t + 1440 : t;
        if (end === null || end - from < EXTRAS.MIN_OPEN) continue;
        x.time = hm(from);
      } else x.time = e.start;
    }
    if (typeof e.note === 'string' && e.note.trim()) x.note = e.note.trim().slice(0, 160);
    if (isChosen) { x.chosen = true; chosen.push(x); } else events.push(x);
  }
  const byKm = (a, b) => a.km - b.km || a.ref.localeCompare(b.ref);
  chosen.sort(byKm);
  events.sort(byKm);
  const out = chosen.concat(events).slice(0, EXTRAS.MAX);
  if (out.length < EXTRAS.MAX && ev.dayEnd - ev.finish >= EXTRAS.EARLY_MIN) {
    const saved = [];
    for (const p of places) {
      if (!(p.status === 'saved-for-later' || later.has(p.id)) || exclude.has(p.id) || used.has(p.id) || FOOD.has(refineCategory(p))) continue;
      const snap = snapshots.get(p.place_id);
      if (!snap || !isLoc(snap.location)) continue;
      const km = dist(snap.location);
      if (km > EXTRAS.RADIUS_KM) continue;
      const h = factsHours(hoursOn(snap, date, { irregular: p.opening_days === 'irregular' }), placeFacts(p), date, snap, p.name).hours;
      const ws = h.status === 'always' ? [{ open: 0, close: 1440 }] : h.status === 'open' ? h.windows : [];
      const w = ws.find((x) => Math.min(x.close, ev.dayEnd) - Math.max(x.open, from) >= EXTRAS.MIN_OPEN);
      if (!w) continue;
      saved.push({ kind: 'saved', ref: p.id, name: String(p.name).slice(0, 120), time: hm(Math.max(w.open, from)), km: km1(km) });
    }
    saved.sort((a, b) => a.km - b.km || a.ref.localeCompare(b.ref));
    for (const x of saved.slice(0, EXTRAS.MAX - out.length)) { out.push(x); used.add(x.ref); }
  }
  return out;
}

/** Put the extras on the day; they replace the "back early" line. */
export function applyExtras(dayPlan, extras) {
  if (!extras.length) return;
  dayPlan.extras = extras;
  dayPlan.free = dayPlan.free.filter((f) => f.note !== BACK_EARLY_NOTE);
}

// Developed by: LightAISolutions

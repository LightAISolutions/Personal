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
 *   sunsetFor(day, timeZone) → 'HH:MM' | null
 *   eveningExtras({ evening, date, season, places, snapshots, exclude, used }) → extras
 *   applyExtras(dayPlan, extras)
 */
import { haversineKm, isLoc } from './planner-geo.mjs';
import { hoursOn } from './planner-hours.mjs';
import { placeFacts, factsHours } from './planner-facts.mjs';
import { toMin, hm } from './planner-time.mjs';
import { sunsetLocal } from './planner-sun.mjs';
import { refineCategory } from './planner-category.mjs';
import { BACK_EARLY_NOTE } from './planner-day.mjs';

export const EXTRAS = Object.freeze({ RADIUS_KM: 2, MAX: 3, EARLY_MIN: 60, EVENING_FROM: 17 * 60, START_FROM: 16 * 60, MIN_OPEN: 30, AFTER_MIN: 15 });
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

function eventLoc(e, placesById, snapshots) {
  if (isLoc(e)) return { lat: e.lat, lng: e.lng };
  const p = e.place ? placesById.get(e.place) : null;
  const id = (p && p.place_id) || e.place_id || null;
  const snap = id ? snapshots.get(id) : null;
  return snap && isLoc(snap.location) ? snap.location : null;
}

/**
 * eveningExtras({ evening, date, season, places, snapshots, exclude, used }) → [{ kind, ref, name, time?, km, note? }]
 * `places` are the plan's places (final statuses); `exclude`: slugs not to offer (stops, dinners, rejected); `used`:
 * saved places already offered on another day (updated).
 */
export function eveningExtras({ evening: ev, date, season, places = [], snapshots, exclude = new Set(), used = new Set(), later = new Set() }) {
  if (!ev || ev.ends) return [];
  const origins = [ev.last && ev.last.cand.loc ? ev.last.cand.loc : null, ev.lodging].filter(isLoc);
  const dist = (loc) => Math.min(...origins.map((o) => haversineKm(o, loc)));
  const byId = new Map(places.map((p) => [p.id, p]));
  // Phase 13 (A12): nothing starts before the day's start plus its start step (`ready`; the bag step on a moving day).
  const ready = Number.isFinite(ev.ready) ? ev.ready : -Infinity;
  const events = (season && Array.isArray(season.events) ? season.events : []).filter((e) => runsThatEvening(e, date)).map((e) => {
    const loc = eventLoc(e, byId, snapshots);
    if (!loc) return null;
    const km = dist(loc);
    if (km > EXTRAS.RADIUS_KM) return null;
    const x = { kind: 'event', ref: e.id, name: String(e.name).slice(0, 120), km: km1(km) };
    if (TIME_RE.test(e.start || '')) {
      const s = toMin(e.start);
      if (s < ready) {   // under way before you arrive: offered from your arrival while enough of it is left, else not at all
        const t = TIME_RE.test(e.end || '') ? toMin(e.end) : null;
        const end = t === null ? null : t < s ? t + 1440 : t;
        if (end === null || end - ready < EXTRAS.MIN_OPEN) return null;
        x.time = hm(ready);
      } else x.time = e.start;
    }
    if (typeof e.note === 'string' && e.note.trim()) x.note = e.note.trim().slice(0, 160);
    return x;
  }).filter(Boolean).sort((a, b) => a.km - b.km || a.ref.localeCompare(b.ref));
  const out = events.slice(0, EXTRAS.MAX);
  if (out.length < EXTRAS.MAX && ev.dayEnd - ev.finish >= EXTRAS.EARLY_MIN) {
    const from = Math.max(ev.finish + EXTRAS.AFTER_MIN, ready);
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

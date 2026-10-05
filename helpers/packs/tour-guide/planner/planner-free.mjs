/**
 * Tour Guide planner — what to do in a free window (Phase 18, WP-18b; Contract C18 DayPlan `free[].title`,
 * `free[].options`). No Maps request: straight lines and a walking pace only.
 * Every free window of at least FREE.MIN_WINDOW minutes gets a `title` (≤ FREE.TITLE_MAX) and, when any place fits,
 * `options` (≤ FREE.MAX): saved, Later and shortlisted places (status saved-for-later, a Later-list item, or candidate /
 * chosen) that are not scheduled anywhere, not rejected and not that day's evening extras, and that
 *   · lie within FREE.RADIUS_KM in a straight line of the window's anchor;
 *   · are open (their own facts win over the snapshot, as for the evening extras) at least FREE.MIN_OPEN minutes inside
 *     the window — places whose hours are unknown or irregular that day are not offered;
 *   · leave room for the round trip: walk there and back plus FREE.STAY_MIN minutes within the window.
 * walk_min = ceil(km × FREE.ROUTE_FACTOR / FREE.WALK_KMH × 60); nearest first (then slug), at most FREE.MAX per window,
 * and a place is offered in one window of a day only (the earliest that takes it).
 * The anchor is where the traveller is when the window starts: the end of the last leg that arrives by then (a stop,
 * the lodging, the day's real start or end point); before any leg has arrived, the stop after the window, else the
 * day's start point (its real start, else the morning's lodging). On the usual windows this is the stop before
 * ("until X opens", "free time near X") and, after an early return, the lodging the day came back to.
 * kind: 'later' for a Later-list item, else 'saved' (status saved-for-later), else 'shortlist'.
 * open: "open all day", "open until 18:00", "open 15:00–18:00" (24-hour times; the brochure reformats them).
 *   freeOptions({ dayPlan, day, places, snapshots, later? }) → [{ index, title, options }]
 *   applyFreeOptions(dayPlan, list)
 *   freeTitle(window, anchorName) → title
 */
import { haversineKm, isLoc } from './planner-geo.mjs';
import { hoursOn } from './planner-hours.mjs';
import { placeFacts, factsHours } from './planner-facts.mjs';
import { toMin, hm } from './planner-time.mjs';
import { BACK_EARLY_NOTE, END_SPARE_NOTE } from './planner-day.mjs';
import { FREE_DAY_NOTE } from './planner-outline.mjs';

export const FREE = Object.freeze({ MIN_WINDOW: 30, RADIUS_KM: 1.2, MIN_OPEN: 30, STAY_MIN: 20, ROUTE_FACTOR: 1.25, WALK_KMH: 4.8, MAX: 4, TITLE_MAX: 60 });
const OFFERED = new Set(['saved-for-later', 'candidate', 'chosen']);
const km1 = (x) => Math.round(x * 10) / 10;
/** Straight-line km → walking minutes (FREE.ROUTE_FACTOR detour at FREE.WALK_KMH). */
export const freeWalkMinutes = (km) => Math.ceil(((km * FREE.ROUTE_FACTOR) / FREE.WALK_KMH) * 60);
const clipTo = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

/** The window's title from its note and anchor (≤ FREE.TITLE_MAX). */
export function freeTitle(w, anchorName) {
  const note = String((w && w.note) || '');
  let m;
  if ((m = /^before your (\d\d:\d\d) booking/i.exec(note))) return `Before your ${m[1]} booking`;
  if ((m = /^until (.+) opens at (\d\d:\d\d)$/i.exec(note))) return clipTo(`Until ${m[1]} opens`, FREE.TITLE_MAX);
  if ((m = /^until (\d\d:\d\d), a quieter time at (.+)$/i.exec(note))) return clipTo(`Until ${m[1]}, when ${m[2]} is quieter`, FREE.TITLE_MAX);
  if (/before lunch$/i.test(note)) return 'Free time before lunch';
  if (/before dinner$/i.test(note)) return 'Free time before dinner';
  if ((m = /before you leave for (.+)$/i.exec(note))) return clipTo(`Before you leave for ${m[1]}`, FREE.TITLE_MAX);
  if (note.startsWith(END_SPARE_NOTE + ' ')) return clipTo(`Time to spare near ${note.slice(END_SPARE_NOTE.length + 1).replace(/ before \d\d:\d\d$/, '')}`, FREE.TITLE_MAX);
  if (note === FREE_DAY_NOTE) return 'A free day';
  if (note === BACK_EARLY_NOTE) return anchorName ? clipTo(`Back early: free time near ${anchorName}`, FREE.TITLE_MAX) : 'Back early: the rest is free';
  return anchorName ? clipTo(`Free time near ${anchorName}`, FREE.TITLE_MAX) : 'Free time';
}

/** The day's named points: stops (from their snapshots), the lodgings, the real start and end. */
function pointsOf(dayPlan, day, snapshots, places) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const pts = new Map();
  const add = (k, loc, name) => { if (isLoc(loc)) pts.set(k, { lat: loc.lat, lng: loc.lng, name: name || null }); };
  for (const s of dayPlan.stops) { const snap = snapshots.get(s.place_id); add(s.place, snap && snap.location, (byId.get(s.place) || {}).name || (snap && snap.content && snap.content.display_name)); }
  for (const x of dayPlan.meals || []) if (x.at && x.at !== 'lodging' && !pts.has(x.at)) { const p = byId.get(x.at); const snap = p && snapshots.get(p.place_id); add(x.at, snap && snap.location, p && p.name); }
  add('lodging', day.lodging_end, day.lodging_end && day.lodging_end.name);
  if (day.start) add('day-start', day.start, day.start.name);
  if (day.end) add('day-end', day.end, day.end.name);
  return pts;
}

/** Where the traveller is when window `w` starts (see the file header) → { lat, lng, name } or null. */
function anchorOf(w, dayPlan, day, pts) {
  const t = toMin(w.start);
  let at = null;
  for (const l of dayPlan.legs || []) { const a = toMin(l.arrive_at); if (a !== null && a <= t && (!at || a >= toMin(at.arrive_at))) at = l; }
  if (at && pts.has(at.to)) return pts.get(at.to);
  if (!at) {
    const next = dayPlan.stops.find((s) => toMin(s.arrive) !== null && toMin(s.arrive) >= toMin(w.end));
    if (next && pts.has(next.place)) return pts.get(next.place);
    if (pts.has('day-start')) return pts.get('day-start');
    if (isLoc(day.lodging_start)) return { lat: day.lodging_start.lat, lng: day.lodging_start.lng, name: day.lodging_start.name || null };
  }
  return pts.get('lodging') || null;
}

/** The open window that gives a place at least FREE.MIN_OPEN minutes inside [s, e], with its text, or null. */
function openIn(h, s, e) {
  if (h.status === 'always') return 'open all day';
  if (h.status !== 'open') return null;
  const w = h.windows.find((x) => Math.min(x.close, e) - Math.max(x.open, s) >= FREE.MIN_OPEN);
  if (!w) return null;
  if (w.open <= 0 && w.close >= 1440) return 'open all day';
  const until = w.close >= 1440 ? 'midnight' : hm(w.close);
  return w.open <= s ? `open until ${until}` : `open ${hm(w.open)}–${until}`;
}

/**
 * freeOptions({ dayPlan, day, places, snapshots, later }) → [{ index, title, options }] for each free window of at
 * least FREE.MIN_WINDOW minutes (index into dayPlan.free). `places`: the plan's places (final statuses); `day`: the
 * planner's day record (lodgings, real start and end); `later`: slugs on a Later list.
 */
export function freeOptions({ dayPlan, day, places = [], snapshots, later = new Set() }) {
  const pts = pointsOf(dayPlan, day, snapshots, places);
  const extras = new Set((dayPlan.extras || []).filter((x) => x.kind === 'saved').map((x) => x.ref));
  const onDay = new Set([...dayPlan.stops.map((s) => s.place), ...(dayPlan.meals || []).map((x) => x.at).filter(Boolean)]);
  const pool = places.filter((p) => p && p.id && (OFFERED.has(p.status) || later.has(p.id)) && p.status !== 'rejected' && p.status !== 'scheduled' && !onDay.has(p.id) && !extras.has(p.id))
    .map((p) => ({ p, snap: snapshots.get(p.place_id) })).filter((x) => x.snap && isLoc(x.snap.location));
  const used = new Set(), out = [];
  const order = dayPlan.free.map((w, i) => ({ w, i, s: toMin(w.start), e: toMin(w.end) })).filter((x) => x.s !== null && x.e !== null && x.e - x.s >= FREE.MIN_WINDOW).sort((a, b) => a.s - b.s || a.i - b.i);
  for (const { w, i, s, e } of order) {
    const anchor = anchorOf(w, dayPlan, day, pts);
    const opts = [];
    if (anchor) {
      for (const { p, snap } of pool) {
        if (used.has(p.id)) continue;
        const km = haversineKm(anchor, snap.location);
        if (km > FREE.RADIUS_KM) continue;
        const walk = freeWalkMinutes(km);
        if (2 * walk + FREE.STAY_MIN > e - s) continue;
        const h = factsHours(hoursOn(snap, dayPlan.date, { irregular: p.opening_days === 'irregular' }), placeFacts(p), dayPlan.date, snap, p.name).hours;
        const open = openIn(h, s, e);
        if (!open) continue;
        opts.push({ kind: later.has(p.id) ? 'later' : p.status === 'saved-for-later' ? 'saved' : 'shortlist', ref: p.id, name: String(p.name).slice(0, 120), km: km1(km), walk_min: walk, open, _km: km });
      }
    }
    opts.sort((a, b) => a._km - b._km || a.ref.localeCompare(b.ref));
    const take = opts.slice(0, FREE.MAX).map(({ _km, ...o }) => o);
    take.forEach((o) => used.add(o.ref));
    out.push({ index: i, title: freeTitle(w, anchor && anchor.name), options: take });
  }
  return out;
}

/** Put titles and options on the day's free windows (a window without options gets its title only). */
export function applyFreeOptions(dayPlan, list) {
  for (const { index, title, options } of list) {
    const w = dayPlan.free[index];
    if (!w) continue;
    delete w.title; delete w.options;
    w.title = title;
    if (options.length) w.options = options;
  }
}

// Developed by: LightAISolutions

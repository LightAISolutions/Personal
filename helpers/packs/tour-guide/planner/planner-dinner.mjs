/**
 * Tour Guide planner — dinner at a real place (Phase 11, WP-11a; Contract C11 planner input `dinners`: saved places,
 * with snapshots, that fit the diet). After every day is built, each day (in date order) without a departure gets the
 * best dinner place that is:
 *   · open for dinner that day (Google's hours with the place's own facts; unknown or irregular hours are not promised),
 *   · within DINNER.RADIUS_KM (straight line) of the day's last stop or of the night's lodging — on an outlined day,
 *     a place inside the day's own area (or the outline's dinner place for that evening) may instead be up to
 *     DINNER.HOME_KM from the lodging: a short ride back out to where the day was spent,
 *   · not used for dinner on another day, not a stop of any day, never `facts.menu.fits: 'no'`, never skipped (rejected)
 *     or kept for later by the owner's choices;
 * ranked by the owner's ✅ picks (status `chosen` / choices.picks), then the Later list (`saved-for-later`), then the
 * rest, nearest first. Direct (last stop → dinner → lodging, replacing the day's last leg) when the place is near the
 * last stop and the wait for dinner is at most DINNER.MAX_WAIT; otherwise lodging → dinner → lodging after the day.
 * The two legs are honest legs (fetchLeg, Phase 10) with their own allowance (extraCallsFor(mode, 2)); planner-budget.mjs
 * counts them (`dinner_calls`). The choice is made on straight-line estimates (no request), then timed on the real legs;
 * if the real legs miss the place's hours the day keeps the old "near <lodging>" dinner (the two requests are spent).
 * The meal's `at` is the place's slug and its `booking` line comes from trip.bookings (same place and for_date), else the
 * place's facts.booking. The planner never adds a booking.
 *   prepareDinners(list, { snapshots, dates, places, choices }) → pool
 *   addDinners({ built, pool, used, exclude, maps, trip, pace, prefer? }) → { chosen: [{ date, place }], route_calls } (dayPlans updated in place)
 * WP-11e: `prefer` (Map date → place slug, the outline's dinner anchors) ranks that place first on its date and keeps it
 * off every other date.
 * Phase 13 (WP-13b, A4 and A5 menus): within each of the owner's ranks, places sort by their menu (dinnerMenu) before
 * distance — a current `yes`, then a current `partly`, then a menu that is `unknown`, missing, or checked more than
 * MENU_MAX_AGE_DAYS before the plan's day (`today`) — nearest first within each. The meal's note says why the third
 * group is there: "<name> · menu not checked for <diet>" or "<name> · menu last checked <date>". Without `today` the
 * age is not judged (the order of unchecked menus still holds).
 *   prepareDinners(list, { snapshots, dates, places, choices, today?, diet? }) → pool (each with menu_rank, menu_caveat)
 */
import { hoursOn, earliestFit } from './planner-hours.mjs';
import { haversineKm, isLoc } from './planner-geo.mjs';
import { placeFacts, factsHours } from './planner-facts.mjs';
import { fetchLeg, legAllowance, transitFallback } from './planner-legs.mjs';
import { extraCallsFor } from './planner-budget.mjs';
import { bufferFor } from './planner-buffer.mjs';
import { transitPrefs } from './planner-transit.mjs';
import { localToIso, hm } from './planner-time.mjs';
import { DINNER_EARLIEST } from './planner-input.mjs';
import { legRecord, estimatedWarning, BACK_EARLY_NOTE, FREE_MIN } from './planner-day.mjs';
import { MENU_MAX_AGE_DAYS } from '../facts/facts-check.mjs';
import { dietWords } from '../facts/facts-lines.mjs';
import { isDate, daysBetween } from '../schemas/tour-guide-dates.mjs';

export const DINNER = Object.freeze({ RADIUS_KM: 1.5, HOME_KM: 5, LATEST_END: 23 * 60, MAX_WAIT: 60, FRESHEN_MIN: 15 });
/** Straight-line pre-selection speeds (km/h, with the 1.3 route factor); a dinner hop within 1.5 km is a walk unless driving. */
const EST = Object.freeze({ WALK_KMH: 4.5, DRIVE_KMH: 30, DRIVE_OVERHEAD_MIN: 5, ROUTE_FACTOR: 1.3 });
/** A pool entry's menu group (an entry made before Phase 13 has none: the menu decides as dinnerMenu would without a plan day). */
const menuRank = (c) => (Number.isInteger(c.menu_rank) ? c.menu_rank : dinnerMenu(c.facts).rank);
const estMinutes = (a, b, mode) => {
  const km = haversineKm(a, b) * EST.ROUTE_FACTOR;
  return mode === 'DRIVE' ? Math.ceil((km / EST.DRIVE_KMH) * 60) + EST.DRIVE_OVERHEAD_MIN : Math.ceil((km / EST.WALK_KMH) * 60);
};
const RANK = Object.freeze({ PICK: 0, LATER: 1, OTHER: 2 });
/** A4/A5: the menu groups inside each rank. */
export const MENU_RANK = Object.freeze({ YES: 0, PARTLY: 1, UNCHECKED: 2 });

/**
 * dinnerMenu(facts, { today?, diet? }) → { rank, caveat } — facts as placeFacts() returns them (menu_fits, menu_checked).
 * rank: MENU_RANK.YES for a current `yes`, PARTLY for a current `partly`, UNCHECKED for `unknown`, no menu, or a check
 * more than MENU_MAX_AGE_DAYS before `today` (not judged without `today`). caveat: the note's tail for UNCHECKED.
 */
export function dinnerMenu(facts, { today = null, diet = null } = {}) {
  const fits = facts ? facts.menu_fits : null, checked = facts ? facts.menu_checked : null;
  if (fits !== 'yes' && fits !== 'partly') return { rank: MENU_RANK.UNCHECKED, caveat: `menu not checked for ${dietWords(diet) || 'your diet'}` };
  if (isDate(today) && (!isDate(checked) || daysBetween(checked, today) > MENU_MAX_AGE_DAYS)) {
    return { rank: MENU_RANK.UNCHECKED, caveat: isDate(checked) ? `menu last checked ${checked}` : `menu not checked for ${dietWords(diet) || 'your diet'}` };
  }
  return { rank: fits === 'yes' ? MENU_RANK.YES : MENU_RANK.PARTLY, caveat: null };
}

/** The windows dinner may use on a date: open (or always-open) hours only. */
function dinnerWindows(h) {
  if (!h) return [];
  if (h.status === 'always') return [{ open: 0, close: 1440 }];
  return h.status === 'open' ? h.windows : [];
}

/**
 * prepareDinners(list, { snapshots, dates, places, choices, today?, diet? }) → [{ id, place_id, name, loc, point, hours, facts, rank,
 * menu_rank, menu_caveat, record }] — `today` the plan's day (YYYY-MM-DD in the trip's zone), `diet` the profile's diet.
 * `places` are the planner's (choice-applied) places: a dinner place that is also there takes its status from them,
 * except 'scheduled', which the planner wrote itself (C12: on a re-plan `places` are plan.places, where the owner's
 * chosen dinner reads 'scheduled'); the list's own status counts then.
 * `choices` = applyChoices' result (or null), whose `picks`, `keep` and `skip` are Sets: skip and later are left out, picks rank first.
 */
export function prepareDinners(list, { snapshots, dates, places = [], choices = null, today = null, diet = null }) {
  if (!Array.isArray(list)) return [];
  const byId = new Map(places.map((p) => [p.id, p]));
  const picks = choices ? choices.picks : new Set(), keep = choices ? choices.keep : new Set(), skip = choices ? choices.skip : new Set();
  const out = [], seen = new Set();
  for (const raw of list) {
    if (!raw || !raw.id || !raw.place_id || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const p = byId.get(raw.id) || raw;
    const status = p.status === 'scheduled' && raw.status ? raw.status : p.status;
    if (status === 'rejected' || skip.has(p.id) || keep.has(p.id)) continue;
    const facts = placeFacts(p) || placeFacts(raw);
    if (facts && facts.menu_fits === 'no') continue;   // its current menu does not fit the diet
    const snap = snapshots.get(p.place_id) || null;
    if (!snap || !isLoc(snap.location)) continue;
    const hours = Object.fromEntries(dates.map((d) => [d, factsHours(hoursOn(snap, d, { irregular: p.opening_days === 'irregular' }), facts, d, snap, p.name).hours]));
    const rank = status === 'chosen' || picks.has(p.id) ? RANK.PICK : status === 'saved-for-later' ? RANK.LATER : RANK.OTHER;
    const loc = snap.location;
    const menu = dinnerMenu(facts, { today, diet });
    out.push({ id: p.id, place_id: p.place_id, name: p.name, loc, point: { placeId: p.place_id, lat: loc.lat, lng: loc.lng, name: p.name, id: p.id }, hours, facts, rank, menu_rank: menu.rank, menu_caveat: menu.caveat, record: p });
  }
  return out;
}

/**
 * bookingFor(bookings, placeId, date, firstDay?) → the trip.bookings record for a place on a date, or null: one dated that
 * day first, else one with no date (WP-12d: an undated booking belongs to the day its place is planned on). firstDay
 * (optional Map place → the first date it is planned on) keeps an undated record to that one day when a caller sees
 * several; without it the caller is planning the place on `date` itself. A record for another date never matches.
 */
export function bookingFor(bookings, placeId, date, firstDay = null) {
  const mine = (Array.isArray(bookings) ? bookings : []).filter((x) => x && typeof x === 'object' && placeId && x.place === placeId);
  return mine.find((x) => x.for_date === date) || (!firstDay || firstDay.get(placeId) === date ? mine.find((x) => !x.for_date) : null) || null;
}
/** A trip.bookings record as one line (≤ 160): "Booked" · "No booking needed" · "To book: <rule> · <how> · from N people". */
export function bookingRecordLine(b) {
  const base = b.status === 'booked' ? 'Booked' : b.status === 'not_needed' ? 'No booking needed' : `To book: ${b.rule}`;
  return [base, b.status === 'todo' && b.how ? b.how : null, b.status === 'todo' && b.party_min ? `from ${b.party_min} people` : null].filter(Boolean).join(' · ').slice(0, 160);
}
/** The dinner place's booking line: trip.bookings (same place; that date, else undated) first, then its facts.booking; null when neither. */
export function dinnerBooking(trip, date, placeId, facts) {
  const b = bookingFor(trip.bookings, placeId, date);
  if (b) return bookingRecordLine(b);
  const f = facts && facts.booking;
  if (!f) return null;
  if (typeof f.text === 'string' && f.text.trim()) return f.text.trim().slice(0, 160);
  if (f.required === false) return 'No booking needed';
  if (f.required !== true && !f.lead && !f.how && !f.party_min) return null;
  return [f.required ? 'Booking required' : 'Booking advised', f.lead || null, f.how || null, f.party_min ? `from ${f.party_min} people` : null].filter(Boolean).join(' · ').slice(0, 160);
}

/** Plan the dinner for one day on straight-line estimates → { route: 'direct' | 'lodging', start } or null; `reach` caps lodging → place. */
function dryRun(c, ev, date, len, mode, reach = DINNER.RADIUS_KM) {
  const ws = dinnerWindows(c.hours[date]);
  if (!ws.length) return null;
  const lastKm = ev.last && ev.last.cand.loc ? haversineKm(ev.last.cand.loc, c.loc) : Infinity;
  if (ev.direct && lastKm <= DINNER.RADIUS_KM) {
    const arrive = ev.last.depart + estMinutes(ev.last.cand.loc, c.loc, mode);
    const f = earliestFit(ws, Math.max(arrive, DINNER_EARLIEST), len, DINNER.LATEST_END);
    if (f && f.start - arrive <= DINNER.MAX_WAIT) return { route: 'direct', start: f.start };
  }
  if (haversineKm(ev.lodging, c.loc) > reach) return null;
  const t = estMinutes(ev.lodging, c.loc, mode);
  const depart = Math.max(ev.finish + DINNER.FRESHEN_MIN, DINNER_EARLIEST - t);
  const f = earliestFit(ws, depart + t, len, DINNER.LATEST_END);
  return f ? { route: 'lodging', start: f.start } : null;
}

/**
 * addDinners({ built, pool, used, exclude, maps, trip, pace }) — `built`: [{ dayPlan, evening, day }] in date order;
 * `used`: dinner places already taken (kept days); `exclude`: place slugs scheduled as stops anywhere.
 * C12 `rain` ({ date, outdoor: Set of slugs }): on that date an outdoor dinner place is tried only after the others.
 */
export async function addDinners({ built, pool, used, exclude, maps, trip, pace, prefer = null, rain = null }) {
  const preferred = new Map(prefer ? [...prefer].map(([d, slug]) => [slug, d]) : []);
  const chosen = [];
  let route_calls = 0;
  for (const { dayPlan, evening: ev, day } of built) {
    if (!ev || ev.ends || !pool.length) continue;
    const { date, mode } = day;
    const near = (c) => Math.min(ev.last && ev.last.cand.loc ? haversineKm(ev.last.cand.loc, c.loc) : Infinity, haversineKm(ev.lodging, c.loc));
    const mine = (c) => (preferred.get(c.id) === date ? 0 : 1);
    const wet = (c) => (rain && rain.date === date && rain.outdoor.has(c.id) ? 1 : 0);   // C12: a rainy re-plan seats you indoors first
    const area = day.outline && day.outline.area;
    const reach = (c) => (mine(c) === 0 || (area && haversineKm(c.loc, area) <= area.radius_km) ? DINNER.HOME_KM : DINNER.RADIUS_KM);
    const options = pool.filter((c) => !used.has(c.id) && !exclude.has(c.id) && near(c) <= reach(c) && (!preferred.has(c.id) || preferred.get(c.id) === date))
      .sort((a, b) => mine(a) - mine(b) || wet(a) - wet(b) || a.rank - b.rank || menuRank(a) - menuRank(b) || near(a) - near(b) || a.id.localeCompare(b.id));
    let pick = null, plan = null;
    for (const c of options) { plan = dryRun(c, ev, date, pace.dinner, mode, reach(c)); if (plan) { pick = c; break; } }
    if (!pick) continue;
    const timed = await timeDinner({ pick, plan, ev, day, dayPlan, maps, trip, len: pace.dinner });
    route_calls += timed.requests;
    if (!timed.ok) continue;
    used.add(pick.id);
    chosen.push({ date, place: pick });
  }
  return { chosen, route_calls };
}

/** Fetch the two legs, time the dinner on them and write it into the DayPlan → { ok, requests } (not ok: the old dinner stays). */
async function timeDinner({ pick, plan, ev, day, dayPlan, maps, trip, len }) {
  const { date, mode } = day;
  const iso = (m) => localToIso(date, m, trip.timezone);
  const tp = mode === 'TRANSIT' ? transitPrefs(trip) : null, fallback = mode === 'TRANSIT' ? transitFallback(trip) : null;
  const allowance = legAllowance(extraCallsFor(mode, 2));
  const direct = plan.route === 'direct';
  const fromPoint = direct ? { placeId: ev.last.cand.place_id, lat: ev.last.cand.loc.lat, lng: ev.last.cand.loc.lng, name: ev.last.cand.name, id: ev.last.cand.id } : ev.lodging;
  const fromSlug = direct ? ev.last.cand.id : 'lodging';
  let depart = direct ? ev.last.depart : Math.max(ev.finish + DINNER.FRESHEN_MIN, plan.start - estMinutes(ev.lodging, pick.loc, mode));
  const out = await fetchLeg(maps, { from: fromPoint, to: pick.point, mode, departureTime: iso(depart), transitPreferences: tp, fallback, allowance });
  let requests = out.requests;
  const ws = dinnerWindows(pick.hours[date]);
  const fit = out.minutes < Infinity ? earliestFit(ws, Math.max(depart + out.minutes + bufferFor(out), DINNER_EARLIEST), len, DINNER.LATEST_END) : null;
  let back = null;
  if (fit) back = await fetchLeg(maps, { from: pick.point, to: ev.lodging, mode, departureTime: iso(fit.start + len), transitPreferences: tp, fallback, allowance });
  if (back) requests += back.requests;
  dayPlan.solver.route_calls += requests;
  if (!fit || !back || !(back.minutes < Infinity)) return { ok: false, requests };
  const buffer = bufferFor(out);
  if (!direct) depart = Math.max(depart, fit.start - buffer - out.minutes);   // leave the lodging so as not to wait
  const arrive = depart + out.minutes, start = fit.start, end = start + len;
  const legOut = legRecord({ from: fromSlug, to: pick.id, fromPoint, toPoint: pick.point, depart, arrive, leg: out, buffer: Math.min(buffer, Math.max(0, start - arrive)), mode });
  const legBack = legRecord({ from: pick.id, to: 'lodging', fromPoint: pick.point, toPoint: ev.lodging, depart: end, arrive: end + back.minutes, leg: back, mode });
  if (direct) {
    const last = dayPlan.legs[dayPlan.legs.length - 1];
    if (!last || last.from !== ev.last.cand.id || last.to !== 'lodging') return { ok: false, requests };
    dayPlan.legs.splice(dayPlan.legs.length - 1, 1, legOut, legBack);
    dayPlan.free = dayPlan.free.filter((f) => f.note !== BACK_EARLY_NOTE);
    const ready = arrive + (legOut.buffer_minutes || 0);
    if (start - ready >= FREE_MIN) dayPlan.free.push({ start: hm(ready), end: hm(start), note: `free time near ${pick.name} before dinner` });
  } else dayPlan.legs.push(legOut, legBack);
  const fits = pick.facts && pick.facts.menu_fits;
  const note = pick.menu_caveat ? `${pick.name} · ${pick.menu_caveat}` : fits === 'partly' ? `${pick.name} · the menu partly fits your diet` : pick.name;   // A4/A5
  const meal = { kind: 'dinner', start: hm(start), end: hm(end), at: pick.id, note: note.slice(0, 300) };
  const booking = dinnerBooking(trip, date, pick.id, pick.facts);
  if (booking) meal.booking = booking;
  const i = dayPlan.meals.findIndex((m) => m.kind === 'dinner');
  if (i >= 0) dayPlan.meals.splice(i, 1, meal); else dayPlan.meals.push(meal);
  dayPlan.warnings = dayPlan.warnings.filter((w) => w.code !== 'transit_estimated');
  const w = estimatedWarning(dayPlan.legs);
  if (w) dayPlan.warnings.push(w);
  return { ok: true, requests };
}

// Developed by: LightAISolutions

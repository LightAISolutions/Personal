/**
 * Tour Guide — semantic checks the JSON Schemas cannot express (the brochure kit's validator subset has no
 * cross-field rules). Each checker takes an entity that already passed its schema and returns [{ path, message }].
 */
import { isDate, daysBetween, tripDates, lodgingsForNight, toMinutes } from './tour-guide-dates.mjs';

export const MAX_TRIP_DAYS = 31;

function validTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export function checkTrip(t) {
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  for (const k of ['start_date', 'end_date']) if (!isDate(t[k])) e('/' + k, 'not a calendar date');
  if (!validTimeZone(t.timezone)) e('/timezone', 'unknown time zone');
  if (t.bookings) checkBookingList(t.bookings, '/bookings', errs);
  if (errs.length) return errs;
  const n = daysBetween(t.start_date, t.end_date) + 1;
  if (n < 1) e('/end_date', 'before start_date');
  else if (n > MAX_TRIP_DAYS) e('/end_date', `trip is ${n} days (at most ${MAX_TRIP_DAYS})`);
  if (toMinutes(t.day_start) >= toMinutes(t.day_end)) e('/day_end', 'day_end must be after day_start');
  const ids = new Set();
  t.lodging.forEach((l, i) => {
    if (ids.has(l.id)) e(`/lodging/${i}/id`, `duplicate lodging id "${l.id}"`);
    ids.add(l.id);
    if (!isDate(l.from)) e(`/lodging/${i}/from`, 'not a calendar date');
    if (!isDate(l.to)) e(`/lodging/${i}/to`, 'not a calendar date');
    else if (isDate(l.from) && l.to <= l.from) e(`/lodging/${i}/to`, 'check-out date must be after the first night');
    if (l.access) checkAccess(l.access, `/lodging/${i}/access`, errs);   // C12
  });
  if (n >= 1 && n <= MAX_TRIP_DAYS) {
    for (const d of tripDates(t)) {
      const c = lodgingsForNight(t, d).length;
      if (c !== 1) e('/lodging', `${c === 0 ? 'no lodging covers' : c + ' lodgings cover'} the night of ${d}`);
    }
  }
  const allowed = t.modes.allowed;
  if (new Set(allowed).size !== allowed.length) e('/modes/allowed', 'duplicate mode');
  if (!allowed.includes(t.modes.default)) e('/modes/default', 'default mode must be one of modes.allowed');
  for (const [d, m] of Object.entries(t.modes.by_date || {})) {
    if (!isDate(d) || d < t.start_date || d > t.end_date) e(`/modes/by_date/${d}`, 'not a trip date');
    if (!allowed.includes(m)) e(`/modes/by_date/${d}`, 'mode not in modes.allowed');
  }
  if (t.day_overrides) checkDayOverrides(t, errs);
  if (t.season) checkSeason(t.season, '/season', errs);
  return errs;
}

/** C11 — the shortest day an override may leave (minutes): the same 2-hour rule as `/dates hours`. */
export const MIN_OVERRIDE_DAY_MINUTES = 120;

/**
 * checkDayOverrides(trip, errs) — C11 day_overrides: dates real, unique and inside the trip; each day at least 2 hours
 * from its start (start.time, else the override's day_start, else the trip's) to its end (end.time, else day_end, else the trip's).
 */
function checkDayOverrides(t, errs) {
  const seen = new Set();
  t.day_overrides.forEach((o, i) => {
    const p = `/day_overrides/${i}`;
    if (!isDate(o.date)) { errs.push({ path: p + '/date', message: 'not a calendar date' }); return; }
    if (seen.has(o.date)) errs.push({ path: p + '/date', message: `duplicate override for ${o.date}` });
    seen.add(o.date);
    if (o.date < t.start_date || o.date > t.end_date) errs.push({ path: p + '/date', message: 'not a trip date' });
    const start = toMinutes(o.start ? o.start.time : o.day_start || t.day_start);
    const end = toMinutes(o.end ? o.end.time : o.day_end || t.day_end);
    if (start !== null && end !== null && end - start < MIN_OVERRIDE_DAY_MINUTES) {
      errs.push({ path: p + (o.end ? '/end/time' : '/day_end'), message: `the day must end at least ${MIN_OVERRIDE_DAY_MINUTES / 60} hours after it starts` });
    }
  });
}

/** checkSeason(season, path, errs) — C11 season sheet: real dates, bloom and event from ≤ to, event ids unique. Shared with season/normalizeSeason. */
export function checkSeason(s, path, errs) {
  const e = (q, message) => errs.push({ path: path + q, message });
  if (!isDate(s.checked)) e('/checked', 'not a calendar date');
  (s.sources || []).forEach((src, i) => { if (!isDate(src.accessed)) e(`/sources/${i}/accessed`, 'not a calendar date'); });
  (s.bloom || []).forEach((b, i) => {
    for (const k of ['from', 'to']) if (b[k] !== undefined && !isDate(b[k])) e(`/bloom/${i}/${k}`, 'not a calendar date');
    if (isDate(b.from) && isDate(b.to) && b.from > b.to) e(`/bloom/${i}/to`, 'before from');
  });
  const ids = new Set();
  (s.events || []).forEach((ev, i) => {
    if (ids.has(ev.id)) e(`/events/${i}/id`, `duplicate event id "${ev.id}"`);
    ids.add(ev.id);
    for (const k of ['from', 'to']) if (!isDate(ev[k])) e(`/events/${i}/${k}`, 'not a calendar date');
    if (isDate(ev.from) && isDate(ev.to) && ev.from > ev.to) e(`/events/${i}/to`, 'before from');
    if ((ev.lat === undefined) !== (ev.lng === undefined)) e(`/events/${i}/${ev.lat === undefined ? 'lat' : 'lng'}`, 'lat and lng go together');
  });
  return errs;
}

export function checkPlace(p) {
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  if (p.booking && !isDate(p.booking.date)) e('/booking/date', 'not a calendar date');
  for (const k of ['last_researched', 'last_verified']) if (p[k] !== undefined && !isDate(p[k])) e('/' + k, 'not a calendar date');
  (p.history || []).forEach((h, i) => {
    if (!isDate(h.on)) e(`/history/${i}/on`, 'not a calendar date');
    else if (i && isDate(p.history[i - 1].on) && h.on < p.history[i - 1].on) e(`/history/${i}/on`, 'history runs oldest first');
  });
  if (p.facts) checkFacts(p.facts, '/facts', errs);
  if (p.facts && p.facts.access) checkAccess(p.facts.access, '/facts/access', errs);   // C12
  if (p.facts && typeof p.facts.irregular_note === 'string' && !p.facts.irregular_note.trim()) e('/facts/irregular_note', 'must have visible text');   // C13
  // C14 (WP-14d): the owner's list names are unique, and each list note names one of them, once.
  const lists = Array.isArray(p.lists) ? p.lists : [];
  lists.forEach((l, i) => { if (lists.indexOf(l) < i) e(`/lists/${i}`, `"${l}" is already in lists`); });
  const noted = [];
  (Array.isArray(p.list_notes) ? p.list_notes : []).forEach((n, i) => {
    if (!lists.includes(n.list)) e(`/list_notes/${i}/list`, `"${n.list}" is not one of the place's lists`);
    else if (noted.includes(n.list)) e(`/list_notes/${i}/list`, `"${n.list}" already has a note`);
    noted.push(n.list);
  });
  return errs;
}

/**
 * checkAccess(access, path, errs) — C12 access notes (a place's `facts.access`, a lodging's `access`): the schema bounds
 * each entry; two entries naming the same station on the same line (case and spacing ignored) are refused. Shared with
 * facts/normalizeFacts.
 */
export function checkAccess(list, path, errs) {
  const seen = new Map();
  (Array.isArray(list) ? list : []).forEach((a, i) => {
    if (!a || typeof a.station !== 'string') return;
    const key = [a.station, a.line || ''].map((x) => String(x).trim().toLowerCase().replace(/\s+/g, ' ')).join('|');
    if (seen.has(key)) errs.push({ path: `${path}/${i}`, message: `repeats entry ${seen.get(key)} (the same station and line)` });
    else seen.set(key, i);
  });
  return errs;
}

/** checkFacts(facts, path, errs) — C11 place facts: real dates, visit_minutes.min ≤ max, closed_weekdays unique. Shared with facts/normalizeFacts. */
export function checkFacts(f, path, errs) {
  const e = (q, message) => errs.push({ path: path + q, message });
  if (!isDate(f.checked)) e('/checked', 'not a calendar date');
  (f.sources || []).forEach((src, i) => { if (!isDate(src.accessed)) e(`/sources/${i}/accessed`, 'not a calendar date'); });
  if (f.visit_minutes && f.visit_minutes.min > f.visit_minutes.max) e('/visit_minutes', 'min must not exceed max');
  if (Array.isArray(f.closed_weekdays) && new Set(f.closed_weekdays).size !== f.closed_weekdays.length) e('/closed_weekdays', 'each weekday is listed once');
  if (f.menu && !isDate(f.menu.checked)) e('/menu/checked', 'not a calendar date');
  return errs;
}

export function checkSnapshot(s) {
  const errs = [];
  const h = s.content && s.content.hours;
  if (h && h.weekday_descriptions.length !== 0 && h.weekday_descriptions.length !== 7) errs.push({ path: '/content/hours/weekday_descriptions', message: 'must hold 7 weekday lines (or none)' });
  return errs;
}

export function checkEstimate(v) {
  const errs = [];
  if (v.range && v.range.min > v.range.max) errs.push({ path: '/range', message: 'min must not exceed max' });
  if (!isDate(v.estimated_on)) errs.push({ path: '/estimated_on', message: 'not a calendar date' });
  return errs;
}

export function checkCalibration(c) {
  const errs = [];
  for (const [cat, r] of Object.entries(c.categories)) {
    const want = Math.min(1.4, Math.max(0.7, 1 + 0.1 * (r.longer - r.shorter)));
    if (Math.abs(r.factor - want) > 1e-6) errs.push({ path: `/categories/${cat}/factor`, message: `must be ${Math.round(want * 100) / 100} for these counts` });
  }
  return errs;
}

export function checkLaterList(l) {
  const errs = [], seen = new Set();
  l.items.forEach((it, i) => {
    if (seen.has(it.place)) errs.push({ path: `/items/${i}/place`, message: `"${it.place}" is already in this list` });
    seen.add(it.place);
  });
  return errs;
}

/** C11 — the reserved point names in a day's legs (the planner's planner-anchors.mjs uses the same three). */
export const DAY_START = 'day-start';
export const DAY_END = 'day-end';
export const LODGING = 'lodging';
const DAY_ANCHORS = new Set([DAY_START, DAY_END, LODGING]);
/** C12 — the reserved point name of a re-plan that started from a shared location (a leg's `from`; never a stop). */
export const HERE = 'here';
const isPoint = (x) => DAY_ANCHORS.has(x) || x === HERE;

/** The day's dinner out (Phase 11): its dinner meal when it is at a place rather than at an anchor, else null. */
export function dinnerOut(d) {
  return (d.meals || []).find((m) => m.kind === 'dinner' && m.at && !DAY_ANCHORS.has(m.at)) || null;
}

/**
 * Day plan rules. A plain day (no real start or end, no hotel or locker bag step, no dinner out) keeps the old shape:
 * lodging → stop 1 → … → lodging, one leg more than stops. Every day then passes the leg chain and timeline
 * (checkDayChain). Times are unwrapped across midnight (a time more than 12 h earlier than the previous one counts as
 * the next day) so a night stop ending after 24:00 still reads in order.
 */
export function checkDayPlan(d) {
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  if (!isDate(d.date)) e('/date', 'not a calendar date');
  if (!isDate(d.verified_on)) e('/verified_on', 'not a calendar date');
  const S = d.stops, L = d.legs;
  const plain = !d.start && !d.end && !dinnerOut(d) && !(d.bags && (d.bags.kind === 'hotel' || d.bags.kind === 'locker'));
  if (plain && S.length && L.length !== S.length + 1) e('/legs', `expected ${S.length + 1} legs (lodging → each stop → lodging), got ${L.length}`);
  if (plain && !S.length && L.length > 1) e('/legs', 'a day without stops has at most one lodging → lodging leg');
  errs.push(...checkDayChain(d));
  // Estimated legs: TRANSIT (WP-3e) or WALK when the WALK request failed (WP-10b); `estimated` and `estimate_basis`
  // together, one day warning. Leg flags (C10) carry no repeats (the validator has no uniqueItems).
  L.forEach((l, i) => {
    if (l.estimated && l.mode !== 'TRANSIT' && l.mode !== 'WALK') e(`/legs/${i}/estimated`, 'only a TRANSIT or WALK leg can be estimated');
    if (!!l.estimated !== !!l.estimate_basis) e(`/legs/${i}/estimate_basis`, 'estimated and estimate_basis go together');
    if (Array.isArray(l.flags) && new Set(l.flags).size !== l.flags.length) e(`/legs/${i}/flags`, 'duplicate flag');
  });
  const estimatedLegs = L.filter((l) => l.estimated).length;
  const estWarnings = (d.warnings || []).filter((w) => w.code === 'transit_estimated').length;
  if (estimatedLegs && estWarnings !== 1) e('/warnings', `a day with estimated legs carries exactly one "transit_estimated" warning (found ${estWarnings})`);
  if (!estimatedLegs && estWarnings) e('/warnings', '"transit_estimated" on a day without an estimated leg');
  const span = (arr, name) => arr.forEach((m, i) => { if (toMinutes(m.end) < toMinutes(m.start)) e(`/${name}/${i}`, 'ends before it starts'); });
  span(d.meals, 'meals');
  span(d.free, 'free');
  // C12: leave_by is the first leg's departure; areas name two different towns.
  if (d.leave_by !== undefined) {
    if (!L.length) e('/leave_by', 'a day without legs has no leave_by');
    else if (d.leave_by !== L[0].depart_at) e('/leave_by', `must be the first leg's departure (${L[0].depart_at})`);
  }
  if (Array.isArray(d.areas) && d.areas.length === 2 && d.areas[0] === d.areas[1]) e('/areas/1', 'repeats the morning area (list the night\'s area only when it differs)');
  return errs;
}

/**
 * checkDayChain(day) → [{ path, message }] — the leg chain and timeline of any day (WP-11a's rule, adopted at the
 * Phase 11 merge; on an old day it agrees with the old lodging → stops → lodging rule):
 *   · the legs form one chain (each leg starts where the previous one ended);
 *   · it starts at 'day-start' when the day has a `start`, else at 'lodging'; it ends at 'day-end' when the day has an
 *     `end`, else at 'lodging';
 *   · the points that are not 'lodging', 'day-start' or 'day-end' are the stops in order, each once, then at most the
 *     dinner's place (the dinner meal's `at`) as the last one;
 *   · times run forward (unwrapped across midnight): each leg's minutes match its times, a stop after the leg that
 *     reaches it, inside its window and starting by its last entry; the first leg leaves at or after the start's time and
 *     the day reaches 'day-end' by the end's time; the hotel bag step sits between the first two legs; dinner sits
 *     between the legs to and from its place.
 *   · Phase 13 (A1, A2): a day without stops that carries an `over_long_day` alert may reach 'day-end' after the end's
 *     time (a departure too early to fit, or an override whose end comes before its fixed start): the alert says so.
 * C12 (a re-plan from the current time, planner replanDays with `from`):
 *   · `visited` stops come first (no visited stop after one that is not);
 *   · one leg may start at the reserved point 'here' (a shared location): the first leg, or the leg after the one that
 *     reaches the last visited stop (the chain restarts there); 'here' is never a stop and never a leg's `to`;
 *   · the rest of the day may leave the last visited stop (or 'here') any time after that stop's arrival: the re-plan
 *     starts at the current time, which can be before the visit's planned end.
 */
export function checkDayChain(d) {
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  const L = d.legs || [], S = d.stops || [];
  const dinner = dinnerOut(d);
  S.forEach((s, k) => {
    if (s.place === HERE) e(`/stops/${k}/place`, `"${HERE}" is a reserved point, not a place`);
    if (s.visited && k && !S[k - 1].visited) e(`/stops/${k}/visited`, 'visited stops come first');
  });
  const lastVisited = S.reduce((n, s, k) => (s.visited ? k : n), -1);
  if (!L.length) { if (S.length) e('/legs', 'a day with stops needs legs'); return errs; }
  const first = d.start ? DAY_START : LODGING, last = d.end ? DAY_END : LODGING;
  if (L[0].from !== first && L[0].from !== HERE) e('/legs/0/from', `the first leg starts at "${first}"`);
  if (L[L.length - 1].to !== last) e(`/legs/${L.length - 1}/to`, `the last leg ends at "${last}"`);
  const restart = lastVisited >= 0 ? L.findIndex((l) => l.to === S[lastVisited].place) + 1 : 0;   // where a re-plan may restart
  for (let i = 0; i < L.length; i++) {
    if (L[i].to === HERE) e(`/legs/${i}/to`, `"${HERE}" is only ever where a re-plan starts`);
    if (L[i].from === HERE && i !== restart) e(`/legs/${i}/from`, `only the first leg${lastVisited >= 0 ? ' after the last visited stop' : ''} may start at "${HERE}"`);
    if (i && L[i].from !== L[i - 1].to && L[i].from !== HERE) e(`/legs/${i}/from`, `must be "${L[i - 1].to}", where leg ${i} ended`);
  }
  const visits = L.map((l, i) => ({ place: l.to, i })).filter((x) => !isPoint(x.place));
  const want = [...S.map((s) => s.place), ...(dinner ? [dinner.at] : [])];
  if (visits.length !== want.length || visits.some((x, k) => x.place !== want[k])) {
    e('/legs', `the places the legs reach (${visits.map((x) => x.place).join(', ') || 'none'}) must be the stops in order${dinner ? ', then dinner' : ''} (${want.join(', ') || 'none'})`);
    visits.forEach((x, k) => {
      if (k < want.length && x.place !== want[k]) e(`/legs/${x.i}/to`, `must be "${want[k]}" (${k < S.length ? 'stop ' + (k + 1) : 'dinner'})`);
      else if (k >= want.length) e(`/legs/${x.i}/to`, `"${x.place}" is not a stop of this day`);
    });
  }
  // Timeline: unwrap across midnight (each time read moves the floor, so a stop from 22:30 to 00:15 reads in order);
  // every leg, then the stop (or dinner) it reaches.
  let floor = null;
  const at = (t) => { let m = toMinutes(t); while (floor !== null && m < floor - 720) m += 1440; floor = Math.max(floor ?? m, m); return m; };
  let prevEnd = null;
  const item = (path, a, b) => {
    const A = at(a), B = at(b);
    if (prevEnd !== null && A < prevEnd) e(path, `starts at ${a}, before the previous item ends`);
    if (B < A) e(path, `ends (${b}) before it starts (${a})`);
    prevEnd = Math.max(prevEnd ?? B, B);
    return { A, B };
  };
  if (d.start && toMinutes(L[0].depart_at) < toMinutes(d.start.time)) e('/legs/0/depart_at', `leaves before the day starts at ${d.start.time}`);
  const stopAt = new Map(S.map((s, k) => [s.place, k]));
  // Phase 13 (A1, A2): a day without stops that misses its real end says so with an over_long_day alert; its start → end
  // leg is shown as it runs, late.
  const overrun = !S.length && (d.warnings || []).some((w) => w.severity === 'alert' && w.code === 'over_long_day');
  L.forEach((l, i) => {
    const { A, B } = item(`/legs/${i}`, l.depart_at, l.arrive_at);
    if (Math.abs(B - A - l.minutes) > 1) e(`/legs/${i}/minutes`, `${l.minutes} min does not match ${l.depart_at}–${l.arrive_at}`);
    if (i === 0 && d.bags && d.bags.kind === 'hotel' && d.bags.start && d.bags.end) item('/bags', d.bags.start, d.bags.end);
    if (stopAt.has(l.to) && visits.some((x) => x.i === i)) {
      const k = stopAt.get(l.to), s = S[k];
      const { A: a, B: b } = item(`/stops/${k}`, s.arrive, s.depart);
      if (k === lastVisited) prevEnd = a;   // C12: the re-plan may leave the last visited stop before its planned end
      if (s.minutes > b - a) e(`/stops/${k}/minutes`, `${s.minutes} min does not fit ${s.arrive}–${s.depart}`);
      if (s.window) {
        let open = toMinutes(s.window.open), close = toMinutes(s.window.close);
        if (close <= open) close += 1440;
        const base = Math.floor(a / 1440) * 1440;
        if (a - base < open) e(`/stops/${k}/arrive`, `arrives ${s.arrive}, before it opens (${s.window.open})`);
        if (b - base > close) e(`/stops/${k}/depart`, `leaves ${s.depart}, after it closes (${s.window.close})`);
      }
      if (s.last_entry && a - Math.floor(a / 1440) * 1440 > toMinutes(s.last_entry)) e(`/stops/${k}/arrive`, `arrives ${s.arrive}, after the last entry (${s.last_entry})`);
    } else if (dinner && l.to === dinner.at) item('/meals/dinner', dinner.start, dinner.end);
    if (d.end && l.to === DAY_END && toMinutes(l.arrive_at) > toMinutes(d.end.time) && !overrun) e(`/legs/${i}/arrive_at`, `reaches ${DAY_END} after ${d.end.time}`);
  });
  return errs;
}

/** Plan-level rules on top of each part's own schema: day order, one trip, every place scheduled (a stop or a dinner out) or in exactly one Later list. */
export function checkPlan(p) {
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  const keys = new Map(p.places.map((pl, i) => [pl.id, i]));
  if (keys.size !== p.places.length) e('/places', 'duplicate place id');
  const scheduled = new Set();
  p.days.forEach((d, i) => {
    if (d.trip_id !== p.trip_id) e(`/days/${i}/trip_id`, 'must equal the plan trip_id');
    if (i && d.date <= p.days[i - 1].date) e(`/days/${i}/date`, 'days must be in date order without duplicates');
    d.stops.forEach((s, j) => {
      scheduled.add(s.place);
      if (!keys.has(s.place)) e(`/days/${i}/stops/${j}/place`, `unknown place "${s.place}"`);
    });
    // Phase 11: a dinner out is a scheduled place too (a known place, never in a Later list), though not a stop.
    const dinner = dinnerOut(d);
    if (dinner) {
      scheduled.add(dinner.at);
      if (!keys.has(dinner.at)) e(`/days/${i}/meals/${d.meals.indexOf(dinner)}/at`, `unknown place "${dinner.at}"`);
    }
  });
  const later = new Map(), names = new Set();
  p.later.forEach((l, i) => {
    if (l.trip_id !== p.trip_id) e(`/later/${i}/trip_id`, 'must equal the plan trip_id');
    if (names.has(l.name)) e(`/later/${i}/name`, `duplicate list "${l.name}"`);
    names.add(l.name);
    l.items.forEach((it, j) => {
      if (later.has(it.place)) e(`/later/${i}/items/${j}/place`, `"${it.place}" is already in another Later list`);
      later.set(it.place, `/later/${i}/items/${j}`);
      if (!keys.has(it.place)) e(`/later/${i}/items/${j}/place`, `unknown place "${it.place}"`);
      if (scheduled.has(it.place)) e(`/later/${i}/items/${j}/place`, `"${it.place}" is both scheduled and in a Later list`);
    });
  });
  // Rainy-day swaps: a known place, not scheduled anywhere, offered on one day only, next to an outdoor stop of that day.
  const offered = new Map();
  p.days.forEach((d, i) => (d.rain_swaps || []).forEach((r, j) => {
    const at = `/days/${i}/rain_swaps/${j}`;
    if (!keys.has(r.place)) e(at + '/place', `unknown place "${r.place}"`);
    if (scheduled.has(r.place)) e(at + '/place', `"${r.place}" is a rain swap but is scheduled`);
    if (offered.has(r.place)) e(at + '/place', `"${r.place}" is already a rain swap on ${offered.get(r.place)}`); else offered.set(r.place, d.date);
    if (!d.stops.some((s) => s.place === r.instead_of)) e(at + '/instead_of', `"${r.instead_of}" is not a stop of ${d.date}`);
  }));
  // Owner choices (planTrip input.choices): picks were the whole pool, so a place the owner did not pick may stay a
  // plain candidate outside every day and every list; skipped places are rejected; kept-for-later ones are never scheduled.
  const ch = p.choices || null;
  const picks = new Set(ch ? ch.picks : []), keep = new Set(ch ? ch.later : []), skip = new Set(ch ? ch.skip : []);
  if (ch) {
    const seen = new Map();
    for (const name of ['picks', 'later', 'skip']) {
      ch[name].forEach((slug, j) => {
        if (!keys.has(slug)) e(`/choices/${name}/${j}`, `unknown place "${slug}"`);
        if (seen.has(slug)) e(`/choices/${name}/${j}`, `"${slug}" is also in choices.${seen.get(slug)}`);
        else seen.set(slug, name);
      });
    }
    for (const slug of skip) {
      if (scheduled.has(slug)) e('/choices/skip', `"${slug}" was skipped but is scheduled`);
      if (later.has(slug)) e('/choices/skip', `"${slug}" was skipped but is in a Later list`);
      if (keys.has(slug) && p.places[keys.get(slug)].status !== 'rejected') e(`/places/${keys.get(slug)}/status`, `"${slug}" was skipped; status must be "rejected"`);
    }
    for (const slug of keep) if (scheduled.has(slug)) e('/choices/later', `"${slug}" was kept for later but is scheduled`);
  }
  const unpicked = (pl) => ch && picks.size > 0 && pl.status === 'candidate' && !picks.has(pl.id) && !keep.has(pl.id) && !skip.has(pl.id);
  p.places.forEach((pl, i) => {
    if (pl.status === 'rejected') return;
    if (!scheduled.has(pl.id) && !later.has(pl.id) && !unpicked(pl)) e(`/places/${i}`, `"${pl.id}" is neither scheduled nor in a Later list`);
    if (scheduled.has(pl.id) && pl.status !== 'scheduled') e(`/places/${i}/status`, `"${pl.id}" is in a day plan; status must be "scheduled"`);
    if (!scheduled.has(pl.id) && pl.status === 'scheduled') e(`/places/${i}/status`, `"${pl.id}" is marked scheduled but in no day plan`);
  });
  return errs;
}

// ── Payloads of the pack's envelope types (SPEC §2; TG-PHASE-4.md §3) ──

/** Whole-payload character ceiling for the digests (the core's own limit is 65 536; SPEC §2). */
export const DIGEST_MAX_CHARS = 60000;
const sizeCheck = (x, errs) => {
  const n = JSON.stringify(x).length;
  if (n > DIGEST_MAX_CHARS) errs.push({ path: '/', message: `payload is ${n} characters (at most ${DIGEST_MAX_CHARS})` });
};
const dupes = (arr, key, base, label, errs) => {
  const seen = new Set();
  arr.forEach((x, i) => {
    if (seen.has(x[key])) errs.push({ path: `${base}/${i}/${key}`, message: `duplicate ${label} ${JSON.stringify(x[key])}` });
    seen.add(x[key]);
  });
};

export function checkShortlist(s) {
  const errs = [];
  const slugs = new Map();
  s.groups.forEach((g, gi) => {
    dupes(g.items, 'n', `/groups/${gi}/items`, 'number', errs);
    g.items.forEach((it, i) => {
      if (slugs.has(it.slug)) errs.push({ path: `/groups/${gi}/items/${i}/slug`, message: `"${it.slug}" is already listed at ${slugs.get(it.slug)}` });
      else slugs.set(it.slug, `/groups/${gi}/items/${i}`);
    });
    if (g.gems_shown !== undefined && g.gems_shown > g.items.length) errs.push({ path: `/groups/${gi}/gems_shown`, message: `${g.gems_shown} gems shown but the group has ${g.items.length} items` });
  });
  dupes(s.groups, 'id', '/groups', 'group', errs);
  return errs;
}

export function checkTripFacts(t) {
  const errs = [];
  dupes(t.found, 'n', '/found', 'number', errs);
  t.found.forEach((f, i) => {
    for (const k of ['start', 'end']) if (typeof f[k] === 'string' && !isDate(f[k])) errs.push({ path: `/found/${i}/${k}`, message: 'not a calendar date' });
    if (isDate(f.start) && isDate(f.end) && f.end < f.start) errs.push({ path: `/found/${i}/end`, message: 'before start' });
  });
  if (new Set(t.missing).size !== t.missing.length) errs.push({ path: '/missing', message: 'duplicate entry' });
  return errs;
}

export function checkPlanDigest(d) {
  const errs = [];
  if (!isDate(d.verified_on)) errs.push({ path: '/verified_on', message: 'not a calendar date' });
  d.days.forEach((day, i) => {
    if (!isDate(day.date)) errs.push({ path: `/days/${i}/date`, message: 'not a calendar date' });
    else if (i && day.date <= d.days[i - 1].date) errs.push({ path: `/days/${i}/date`, message: 'days must be in date order without duplicates' });
    dupes(day.stops, 'n', `/days/${i}/stops`, 'stop number', errs);
  });
  dupes(d.later, 'slug', '/later', 'place', errs);
  // C10 (TG-PHASE-10): a known zone; leg flags unique.
  if (d.tz !== undefined && !validTimeZone(d.tz)) errs.push({ path: '/tz', message: 'unknown time zone' });
  d.days.forEach((day, i) => (day.legs || []).forEach((l, j) => {
    if (Array.isArray(l.flags) && new Set(l.flags).size !== l.flags.length) errs.push({ path: `/days/${i}/legs/${j}/flags`, message: 'duplicate flag' });
  }));
  // C11 (TG-PHASE-11): a digest in parts names both its part and the count; a later part carries no Later list (part 1's
  // is the plan's). The size cap applies to each part; the core joins the days and checks them as one plan.
  if ((d.part === undefined) !== (d.parts === undefined)) errs.push({ path: d.part === undefined ? '/part' : '/parts', message: 'part and parts go together' });
  else if (d.part !== undefined && d.part > d.parts) errs.push({ path: '/part', message: `part ${d.part} of ${d.parts}` });
  if (d.part !== undefined && d.part > 1 && d.later.length) errs.push({ path: '/later', message: 'only part 1 carries the Later list (send [] in later parts)' });
  d.days.forEach((day, i) => (day.stops || []).forEach((s, j) => {
    if (s.menu_checked !== undefined && !isDate(s.menu_checked)) errs.push({ path: `/days/${i}/stops/${j}/menu_checked`, message: 'not a calendar date' });
  }));
  // C12 (TG-PHASE-12, WP-12b): a leg's stations only on a train leg (the stations at both ends of a train ride).
  d.days.forEach((day, i) => (day.legs || []).forEach((l, j) => {
    if (l.stations !== undefined && l.mode !== 'TRANSIT') errs.push({ path: `/days/${i}/legs/${j}/stations`, message: 'stations only on a TRANSIT leg' });
  }));
  sizeCheck(d, errs);
  return errs;
}

// ── Bookings (WP-10a) ──
/** A date-time that passed the schema pattern and is a real instant (2027-02-30T10:00+13:00 is refused). */
const isZoned = (s) => typeof s === 'string' && isDate(s.slice(0, 10)) && !Number.isNaN(Date.parse(s));
/** One booking record (tour-guide-booking.schema.json): real dates and date-times, opens_at ≤ book_by. */
export function checkBooking(b, base = '') {
  const errs = [];
  for (const k of ['for_date', 'updated']) if (b[k] !== undefined && !isDate(b[k])) errs.push({ path: `${base}/${k}`, message: 'not a calendar date' });
  for (const k of ['opens_at', 'book_by']) if (b[k] !== undefined && !isZoned(b[k])) errs.push({ path: `${base}/${k}`, message: 'not a real date-time' });
  if (isZoned(b.opens_at) && isZoned(b.book_by) && Date.parse(b.opens_at) > Date.parse(b.book_by)) errs.push({ path: `${base}/book_by`, message: 'book_by is before opens_at' });
  return errs;
}
function checkBookingList(list, base, errs) {
  (list || []).forEach((b, i) => errs.push(...checkBooking(b, `${base}/${i}`)));
  dupes(list || [], 'id', base, 'booking id', errs);
}
/** The bookings envelope payload: a known zone, unique ids, each record checked, ≤ 60 000 characters. */
export function checkBookings(p) {
  const errs = [];
  if (!validTimeZone(p.tz)) errs.push({ path: '/tz', message: 'unknown time zone' });
  checkBookingList(p.bookings, '/bookings', errs);
  sizeCheck(p, errs);
  return errs;
}

export function checkProfileSummary(p) {
  if (p.updated === undefined) return [];
  return !isDate(p.updated.slice(0, 10)) || Number.isNaN(Date.parse(p.updated)) ? [{ path: '/updated', message: 'not a real date-time' }] : [];
}

export function checkPrefsReview(r) {
  const errs = [];
  dupes(r.items, 'cid', '/items', 'candidate', errs);
  r.items.forEach((it, i) => it.buttons.forEach((row, j) => row.forEach((b, k) => {
    if (b.data.split(':')[1] !== it.cid) errs.push({ path: `/items/${i}/buttons/${j}/${k}/data`, message: `must name ${it.cid}` });
  })));
  return errs;
}

export function checkPlacesDigest(d) {
  const errs = [];
  d.places.forEach((pl, i) => {
    for (const k of ['last_researched', 'last_verified']) if (typeof pl[k] === 'string' && !isDate(pl[k])) errs.push({ path: `/places/${i}/${k}`, message: 'not a calendar date' });
  });
  dupes(d.places, 'slug', '/places', 'place', errs);
  sizeCheck(d, errs);
  return errs;
}

/** Scout payload (TG-SCOUT §3): ranks 1..N in order, slugs / place ids / labels unique, real dates, ≤ 60 000 chars. */
export function checkScout(p) {
  const errs = [];
  if (!isDate(p.created_on)) errs.push({ path: '/created_on', message: 'not a calendar date' });
  const d = /^sc-(\d{4})(\d{2})(\d{2})-/.exec(p.scout_id);
  if (d && !isDate(`${d[1]}-${d[2]}-${d[3]}`)) errs.push({ path: '/scout_id', message: 'the date part is not a calendar date' });
  p.items.forEach((it, i) => {
    if (it.n !== i + 1) errs.push({ path: `/items/${i}/n`, message: `rank ${it.n} out of order (expected ${i + 1})` });
    if (new Set(it.labels).size !== it.labels.length) errs.push({ path: `/items/${i}/labels`, message: 'duplicate label' });
  });
  dupes(p.items, 'slug', '/items', 'slug', errs);
  dupes(p.items.filter((it) => it.place_id !== undefined), 'place_id', '/items', 'place id', errs);
  sizeCheck(p, errs);
  return errs;
}

// ── Outline and day versions (TG-PHASE-11 wave 2, WP-11f) ──
export const OUTLINE_KEYS = Object.freeze(['A', 'B', 'C']);
/**
 * Outline payload: option keys unique; every option covers the same dates once and in order — consecutive calendar
 * days (a trip's dates), at most 31; anchor slugs unique within a day; ≤ 60 000 characters.
 */
export function checkOutline(p) {
  const errs = [];
  dupes(p.options, 'key', '/options', 'option key', errs);
  const first = p.options[0].days.map((d) => d.date);
  p.options.forEach((o, i) => {
    o.days.forEach((d, j) => {
      if (!isDate(d.date)) { errs.push({ path: `/options/${i}/days/${j}/date`, message: 'not a calendar date' }); return; }
      const prev = j ? o.days[j - 1].date : null;
      if (prev && isDate(prev) && daysBetween(prev, d.date) !== 1) errs.push({ path: `/options/${i}/days/${j}/date`, message: 'every trip date once, in order (the day after the previous one)' });
      dupes(d.anchors || [], 'slug', `/options/${i}/days/${j}/anchors`, 'anchor', errs);
    });
    const dates = o.days.map((d) => d.date);
    if (i && dates.join() !== first.join()) errs.push({ path: `/options/${i}/days`, message: `covers ${dates[0]} … ${dates[dates.length - 1]} (${dates.length} days); every option covers the same dates as option ${p.options[0].key}` });
  });
  sizeCheck(p, errs);
  return errs;
}
/** Day-versions payload: a calendar date, version keys unique, chosen one of them, slugs unique per version, ≤ 60 000 characters. */
export function checkDayVersions(p) {
  const errs = [];
  if (!isDate(p.date)) errs.push({ path: '/date', message: 'not a calendar date' });
  dupes(p.versions, 'key', '/versions', 'version key', errs);
  if (p.chosen !== undefined && !p.versions.some((v) => v.key === p.chosen)) errs.push({ path: '/chosen', message: `"${p.chosen}" is not one of the versions` });
  p.versions.forEach((v, i) => {
    dupes(v.stops, 'slug', `/versions/${i}/stops`, 'stop', errs);
    dupes(v.leaves_out, 'slug', `/versions/${i}/leaves_out`, 'place', errs);
  });
  sizeCheck(p, errs);
  return errs;
}

// Developed by: LightAISolutions

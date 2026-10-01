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
  return errs;
}

export function checkPlace(p) {
  return p.booking && !isDate(p.booking.date) ? [{ path: '/booking/date', message: 'not a calendar date' }] : [];
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

/**
 * Day timeline: lodging → stop 1 → … → lodging. Times are unwrapped across midnight (a time more than 12 h earlier
 * than the previous one counts as the next day) so a night stop ending after 24:00 still reads in order.
 */
export function checkDayPlan(d) {
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  if (!isDate(d.date)) e('/date', 'not a calendar date');
  if (!isDate(d.verified_on)) e('/verified_on', 'not a calendar date');
  let last = null;
  const at = (t) => {
    let m = toMinutes(t);
    while (last !== null && m < last - 720) m += 1440;
    last = Math.max(last ?? m, m);
    return m;
  };
  const S = d.stops, L = d.legs;
  if (S.length) {
    if (L.length !== S.length + 1) e('/legs', `expected ${S.length + 1} legs (lodging → each stop → lodging), got ${L.length}`);
  } else if (L.length > 1) e('/legs', 'a day without stops has at most one lodging → lodging leg');
  if (L.length) {
    if (L[0].from !== 'lodging') e('/legs/0/from', 'the first leg starts at "lodging"');
    if (L[L.length - 1].to !== 'lodging') e(`/legs/${L.length - 1}/to`, 'the last leg ends at "lodging"');
  }
  S.forEach((s, i) => {
    if (L[i] && L[i].to !== s.place) e(`/legs/${i}/to`, `must be "${s.place}" (stop ${i + 1})`);
    if (L[i + 1] && L[i + 1].from !== s.place) e(`/legs/${i + 1}/from`, `must be "${s.place}" (stop ${i + 1})`);
  });
  // Walk the timeline in order: leg 0, stop 0, leg 1, stop 1, …, last leg.
  const seq = [];
  for (let i = 0; i < Math.max(L.length, S.length); i++) {
    if (L[i]) seq.push({ kind: 'leg', i, a: L[i].depart_at, b: L[i].arrive_at });
    if (S[i]) seq.push({ kind: 'stop', i, a: S[i].arrive, b: S[i].depart });
  }
  let prevEnd = null;
  for (const x of seq) {
    const base = x.kind === 'leg' ? `/legs/${x.i}` : `/stops/${x.i}`;
    const a = at(x.a), b = at(x.b);
    if (prevEnd !== null && a < prevEnd) e(base, `starts at ${x.a}, before the previous item ends`);
    if (b < a) e(base, `ends (${x.b}) before it starts (${x.a})`);
    if (x.kind === 'leg' && Math.abs(b - a - L[x.i].minutes) > 1) e(`${base}/minutes`, `${L[x.i].minutes} min does not match ${x.a}–${x.b}`);
    if (x.kind === 'stop') {
      const s = S[x.i];
      if (s.minutes > b - a) e(`${base}/minutes`, `${s.minutes} min does not fit ${x.a}–${x.b}`);
      if (s.window) {
        let open = toMinutes(s.window.open), close = toMinutes(s.window.close);
        if (close <= open) close += 1440;
        const day = Math.floor(a / 1440) * 1440;
        if (a - day < open) e(`${base}/arrive`, `arrives ${x.a}, before it opens (${s.window.open})`);
        if (b - day > close) e(`${base}/depart`, `leaves ${x.b}, after it closes (${s.window.close})`);
      }
    }
    prevEnd = b;
  }
  const span = (arr, name) => arr.forEach((m, i) => { if (toMinutes(m.end) < toMinutes(m.start)) e(`/${name}/${i}`, 'ends before it starts'); });
  span(d.meals, 'meals');
  span(d.free, 'free');
  return errs;
}

/** Plan-level rules on top of each part's own schema: day order, one trip, every place scheduled or in exactly one Later list. */
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
  p.places.forEach((pl, i) => {
    if (pl.status === 'rejected') return;
    if (!scheduled.has(pl.id) && !later.has(pl.id)) e(`/places/${i}`, `"${pl.id}" is neither scheduled nor in a Later list`);
    if (scheduled.has(pl.id) && pl.status !== 'scheduled') e(`/places/${i}/status`, `"${pl.id}" is in a day plan; status must be "scheduled"`);
    if (!scheduled.has(pl.id) && pl.status === 'scheduled') e(`/places/${i}/status`, `"${pl.id}" is marked scheduled but in no day plan`);
  });
  return errs;
}

// Developed by: LightAISolutions

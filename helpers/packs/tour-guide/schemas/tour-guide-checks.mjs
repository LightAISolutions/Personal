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
  const errs = [];
  const e = (path, message) => errs.push({ path, message });
  if (p.booking && !isDate(p.booking.date)) e('/booking/date', 'not a calendar date');
  for (const k of ['last_researched', 'last_verified']) if (p[k] !== undefined && !isDate(p[k])) e('/' + k, 'not a calendar date');
  (p.history || []).forEach((h, i) => {
    if (!isDate(h.on)) e(`/history/${i}/on`, 'not a calendar date');
    else if (i && isDate(p.history[i - 1].on) && h.on < p.history[i - 1].on) e(`/history/${i}/on`, 'history runs oldest first');
  });
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
  // Estimated TRANSIT legs (WP-3e): TRANSIT only, `estimated` and `estimate_basis` together, one day warning.
  L.forEach((l, i) => {
    if (l.estimated && l.mode !== 'TRANSIT') e(`/legs/${i}/estimated`, 'only a TRANSIT leg can be estimated');
    if (!!l.estimated !== !!l.estimate_basis) e(`/legs/${i}/estimate_basis`, 'estimated and estimate_basis go together');
  });
  const estimatedLegs = L.filter((l) => l.estimated).length;
  const estWarnings = (d.warnings || []).filter((w) => w.code === 'transit_estimated').length;
  if (estimatedLegs && estWarnings !== 1) e('/warnings', `a day with estimated transit legs carries exactly one "transit_estimated" warning (found ${estWarnings})`);
  if (!estimatedLegs && estWarnings) e('/warnings', '"transit_estimated" on a day without an estimated leg');
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
  sizeCheck(d, errs);
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

// Developed by: LightAISolutions

'use strict';
// A test-only stand-in for the private repo's plan_digest builder, shared by the Phase 11 end-to-end tests. It applies the
// C11 mapping WP-11g ports there: our names, the plan's own times, Maps links from place ids, the facts lines from facts/,
// and day-start / day-end kept as leg ends. Not shipped; the real builder lives in the private repo.
// C12 (WP-12r): the morning fields — country_code, a day's leave_by and areas, a stop's visited / local_name / address /
// payment / close, the dinner's local_name / address / payment / price_line, leg ends 'here', and a train leg's stations
// built only from the two ends' own access notes (place facts.access, the lodging's access) or a day start / end the
// owner named — never from the planner's rail estimates. A plan and trip without C12 fields digest exactly as before.
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const clip = (t, max) => (String(t).length > max ? String(t).slice(0, max - 1) + '…' : String(t));
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

/** The own-research access notes of one leg end, or null: a place's facts.access, the lodging's access, an owner-named anchor. */
function endAccess(slug, i, legs, d, byId, lodgings) {
  if (slug === 'here') return null;   // a shared location has no station
  if (slug === 'day-start' || slug === 'day-end') {
    const a = slug === 'day-start' ? d.start : d.end;
    const name = a && str(a.name, 60);
    return name ? [{ station: name }] : null;   // the owner named it: its name is the station
  }
  if (slug === 'lodging') {
    // The morning lodging leaves the day's first leg; the night lodging ends its last; between them a moving day's
    // 'lodging' is ambiguous, so it has no stations unless both lodgings are the same.
    const ls = d.lodging_start, le = d.lodging_end;
    const id = ls === le ? ls : (i === 0 && legs[0].from === 'lodging' && !d.start) ? ls
      : (i === legs.length - 1 && legs[i].to === 'lodging' && !d.end) ? le : null;
    const lg = id ? lodgings.get(id) : null;
    return lg && Array.isArray(lg.access) && lg.access.length ? lg.access : null;
  }
  const f = (byId.get(slug) || {}).facts;
  return f && Array.isArray(f.access) && f.access.length ? f.access : null;
}

/** A train leg's stations from both ends' own access notes: the first pair on one line, else the first of each. */
function stationsOf(l, i, legs, d, byId, lodgings) {
  if (l.mode !== 'TRANSIT') return undefined;
  const a = endAccess(l.from, i, legs, d, byId, lodgings), b = a && endAccess(l.to, i, legs, d, byId, lodgings);
  if (!a || !b) return undefined;
  let pair = null;
  for (const x of a) for (const y of b) if (!pair && x.line && x.line === y.line) pair = [x, y];
  const [x, y] = pair || [a[0], b[0]];
  const from = str(x.station, 60), to = str(y.station, 60);
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return undefined;
  return keep({ from, to, from_line: str(x.line, 60), to_line: str(y.line, 60) });
}
/** A place's own C12 lines: local name, address, payment (facts) and the closing time its own facts give. */
const ownLines = (f) => (f ? keep({ local_name: str(f.local_name, 80), address: str(f.address, 160), payment: str(f.payment, 80),
  close: TIME.test(f.close || '') ? f.close : undefined }) : {});

/** plan + trip → a plan_digest payload. opts: { now, diet, drive? } (now and diet feed the facts lines). */
async function digestOf(plan, trip, { now, diet, drive } = {}) {
  const { factsLines } = await import('../../packs/tour-guide/facts/index.mjs');
  const byId = new Map(plan.places.map((p) => [p.id, p]));
  const name = (id) => (byId.get(id) || {}).name || id;
  const link = (placeId) => 'https://www.google.com/maps/place/?q=place_id:' + encodeURIComponent(placeId);
  const overrides = new Map((trip.day_overrides || []).map((o) => [o.date, o]));
  const lodgings = new Map((trip.lodging || []).map((l) => [l.id, l]));
  const anchor = (a, o) => (a ? keep({ name: a.name, time: a.time, maps_url: o && o.place_id ? link(o.place_id) : undefined }) : undefined);
  const days = plan.days.map((d) => {
    const o = overrides.get(d.date) || {};
    const dn = (d.meals || []).find((x) => x.kind === 'dinner' && byId.has(x.at));
    const note = dn ? String(dn.note || '').replace(name(dn.at), '').replace(/^\s*·\s*/, '') : '';
    const dnFacts = dn ? byId.get(dn.at).facts : null;
    const dnOwn = dnFacts ? (({ close, ...rest }) => rest)(ownLines(dnFacts)) : {};
    return keep({
      date: d.date, theme: d.theme || '', spare_minutes: d.spare_minutes, sunset: d.sunset,   // a free day has no theme: '' as the real builder sends
      leave_by: d.leave_by, areas: Array.isArray(d.areas) && d.areas.length ? d.areas.slice(0, 2) : undefined,   // C12
      start: anchor(d.start, o.start), end: anchor(d.end, o.end), bags: d.bags ? d.bags.text : undefined,
      dinner: dn ? keep({ name: name(dn.at), slug: dn.at, start: dn.start, end: dn.end, maps_url: link(byId.get(dn.at).place_id),
        note_line: note ? note[0].toUpperCase() + note.slice(1) : undefined, booking_line: dn.booking,
        ...dnOwn, price_line: dnFacts ? factsLines(dnFacts, { now, diet }).price_line : undefined }) : undefined,
      extras: d.extras ? d.extras.map((x) => keep({ kind: x.kind, name: x.name, time: x.time, note_line: x.note,
        maps_url: x.kind === 'saved' && byId.has(x.ref) ? link(byId.get(x.ref).place_id) : undefined })) : undefined,
      stops: d.stops.map((s, i) => keep({ n: i + 1, slug: s.place, name: name(s.place), arrive: s.arrive, depart: s.depart, minutes: s.minutes,
        maps_url: link(s.place_id), note_line: '', time_style: s.time_style, last_entry: s.last_entry, minutes_source: s.minutes_source,
        crowd_slot: s.crowd_slot, ...factsLines((byId.get(s.place) || {}).facts, { now, diet }),
        visited: s.visited === true ? true : undefined, ...ownLines((byId.get(s.place) || {}).facts) })),
      legs: d.legs.slice(0, 30).map((l, i, legs) => keep({ from: l.from, to: l.to, mode: l.mode, minutes: l.minutes, maps_url: l.maps_url,
        estimated: l.estimated === true ? true : undefined, distance_m: l.distance_m, flags: l.flags, taxi_minutes: l.taxi_minutes, buffer_minutes: l.buffer_minutes,
        stations: stationsOf(l, i, legs, d, byId, lodgings) })),
      warnings: d.warnings.slice(0, 20).map((w) => clip(w.text, 200)),   // the digest's bounds (a planner warning may run to 400)
      rain: (d.rain_swaps || []).length ? d.rain_swaps.slice(0, 2).map((r) => ({ slug: r.place, name: name(r.place), instead_of: name(r.instead_of), km: r.km, maps_url: link(r.place_id) })) : undefined
    });
  });
  const later = [], seen = new Set();
  for (const l of plan.later || []) for (const it of l.items || []) if (!seen.has(it.place)) { seen.add(it.place); later.push({ slug: it.place, name: name(it.place), reason: it.reason }); }
  return { v: 1, kind: 'plan_digest', trip: plan.trip_id, build_id: plan.build_id, tz: trip.timezone, verified_on: plan.days[0].verified_on,
    ...(/^[A-Z]{2}$/.test(trip.country_code || '') ? { country_code: trip.country_code } : {}),   // C12
    days, later, drive: drive || { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null } };
}

/** The digest in two parts of consecutive days (part 1 takes `first` days); only part 1 carries the Later list. */
const inParts = (dg, first = 2) => [{ ...dg, part: 1, parts: 2, days: dg.days.slice(0, first) }, { ...dg, part: 2, parts: 2, days: dg.days.slice(first), later: [] }];

module.exports = { digestOf, inParts, stationsOf };

// Developed by: LightAISolutions

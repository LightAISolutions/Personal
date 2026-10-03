'use strict';
// A test-only stand-in for the private repo's plan_digest builder, shared by the Phase 11 end-to-end tests. It applies the
// C11 mapping WP-11g ports there: our names, the plan's own times, Maps links from place ids, the facts lines from facts/,
// and day-start / day-end kept as leg ends. Not shipped; the real builder lives in the private repo.
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

/** plan + trip → a plan_digest payload. opts: { now, diet, drive? } (now and diet feed the facts lines). */
async function digestOf(plan, trip, { now, diet, drive } = {}) {
  const { factsLines } = await import('../../packs/tour-guide/facts/index.mjs');
  const byId = new Map(plan.places.map((p) => [p.id, p]));
  const name = (id) => (byId.get(id) || {}).name || id;
  const link = (placeId) => 'https://www.google.com/maps/place/?q=place_id:' + encodeURIComponent(placeId);
  const overrides = new Map((trip.day_overrides || []).map((o) => [o.date, o]));
  const anchor = (a, o) => (a ? keep({ name: a.name, time: a.time, maps_url: o && o.place_id ? link(o.place_id) : undefined }) : undefined);
  const days = plan.days.map((d) => {
    const o = overrides.get(d.date) || {};
    const dn = (d.meals || []).find((x) => x.kind === 'dinner' && byId.has(x.at));
    const note = dn ? String(dn.note || '').replace(name(dn.at), '').replace(/^\s*·\s*/, '') : '';
    return keep({
      date: d.date, theme: d.theme || '', spare_minutes: d.spare_minutes, sunset: d.sunset,   // a free day has no theme: '' as the real builder sends
      start: anchor(d.start, o.start), end: anchor(d.end, o.end), bags: d.bags ? d.bags.text : undefined,
      dinner: dn ? keep({ name: name(dn.at), slug: dn.at, start: dn.start, end: dn.end, maps_url: link(byId.get(dn.at).place_id),
        note_line: note ? note[0].toUpperCase() + note.slice(1) : undefined, booking_line: dn.booking }) : undefined,
      extras: d.extras ? d.extras.map((x) => keep({ kind: x.kind, name: x.name, time: x.time, note_line: x.note,
        maps_url: x.kind === 'saved' && byId.has(x.ref) ? link(byId.get(x.ref).place_id) : undefined })) : undefined,
      stops: d.stops.map((s, i) => keep({ n: i + 1, slug: s.place, name: name(s.place), arrive: s.arrive, depart: s.depart, minutes: s.minutes,
        maps_url: link(s.place_id), note_line: '', time_style: s.time_style, last_entry: s.last_entry, minutes_source: s.minutes_source,
        crowd_slot: s.crowd_slot, ...factsLines((byId.get(s.place) || {}).facts, { now, diet }) })),
      legs: d.legs.slice(0, 30).map((l) => keep({ from: l.from, to: l.to, mode: l.mode, minutes: l.minutes, maps_url: l.maps_url,
        estimated: l.estimated === true ? true : undefined, distance_m: l.distance_m, flags: l.flags, taxi_minutes: l.taxi_minutes, buffer_minutes: l.buffer_minutes })),
      warnings: d.warnings.map((w) => w.text),
      rain: (d.rain_swaps || []).length ? d.rain_swaps.slice(0, 2).map((r) => ({ slug: r.place, name: name(r.place), instead_of: name(r.instead_of), km: r.km, maps_url: link(r.place_id) })) : undefined
    });
  });
  const later = [], seen = new Set();
  for (const l of plan.later || []) for (const it of l.items || []) if (!seen.has(it.place)) { seen.add(it.place); later.push({ slug: it.place, name: name(it.place), reason: it.reason }); }
  return { v: 1, kind: 'plan_digest', trip: plan.trip_id, build_id: plan.build_id, tz: trip.timezone, verified_on: plan.days[0].verified_on,
    days, later, drive: drive || { plan: 'fixtureDrivePlanFile01', brochure_html: null, brochure_pdf: null } };
}

/** The digest in two parts of consecutive days (part 1 takes `first` days); only part 1 carries the Later list. */
const inParts = (dg, first = 2) => [{ ...dg, part: 1, parts: 2, days: dg.days.slice(0, first) }, { ...dg, part: 2, parts: 2, days: dg.days.slice(first), later: [] }];

module.exports = { digestOf, inParts };

// Developed by: LightAISolutions

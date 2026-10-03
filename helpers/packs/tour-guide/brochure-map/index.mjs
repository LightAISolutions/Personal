/**
 * Tour Guide brochure-map — the planner's Plan (plus the Trip, Places, PlaceNotes, build-scoped GoogleSnapshots and
 * VisitEstimates) → the brochure kit's model (helpers/kits/brochure/schema/brochure.schema.json), and a render
 * convenience through the kit.
 *   toBrochureModel({ trip, plan, places?, notes?, snapshots?, estimates?, options:{ generator?, built_on?, verified_on?, show_google_content = true, owner_tz?, now? } }) → model
 *     trip.bookings (WP-10a) open the practical page as "Bookings", times in the trip's zone and in options.owner_tz;
 *     options.now (ISO or ms) lets past deadlines read "Was due" / "Open since", and marks C11 facts older than the
 *     freshness limits "check again" (without it, the build date); options.diet (e.g. 'vegetarian') words the menu line.
 *     Contract C11: trip.day_overrides, trip.season (the season page after the overview), place.facts and place.flags,
 *     and the DayPlan's start/end/bags/sunset/extras, dinner booking and stop facts map through brochure-map-facts.mjs.
 *   renderPlan(args, { page?, embedFonts? }) → { html, model, warnings }
 *   renderPlanPdf(args, outPath, { page?, shotsDir? }) → { html, model, warnings, pdf, pages, available }   (no PDF when pdfAvailable() is false)
 * Pure: never mutates its input, never calls the network.
 */
import { renderHtml, renderPdf, pdfAvailable } from '../../../kits/brochure/index.mjs';
import { placeUrl } from '../../../kits/maps/lib/maps-urls.mjs';
import { clip, compact, localDate, snapshotIndex, SHORT, TEXT } from './brochure-map-text.mjs';
import { placeCard, mapsLink } from './brochure-map-cards.mjs';
import { mapDay, freeDay } from './brochure-map-days.mjs';
import { mapLater } from './brochure-map-later.mjs';
import { tripPractical, dayRoutes, freeDays, verifySections, PRACTICAL_LIMITS } from './brochure-map-practical.mjs';
import { bookingsSection } from './brochure-map-bookings.mjs';
import { buildAttribution } from './brochure-map-attribution.mjs';
import { seasonModel, factsSourceRows, seasonSourceRows } from './brochure-map-facts.mjs';

export { placeCard, closedDays, hoursLine, hoursToday, categoryLabel } from './brochure-map-cards.mjs';
export { mapDay, freeDay, legMode, MODE_MAP } from './brochure-map-days.mjs';
export { mapLater } from './brochure-map-later.mjs';
export { buildAttribution, mergeSources, sourceKey } from './brochure-map-attribution.mjs';
export { cardFacts, seasonModel, stopLines, IMPL as FACTS_IMPL } from './brochure-map-facts.mjs';
export { pdfAvailable };

const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const byPlaceId = (list, pick) => {
  const m = new Map();
  for (const x of Array.isArray(list) ? list : []) if (x && x.place_id) pick(m, x);
  return m;
};

function lodgingEntry(l) {
  const ok = (v, lo, hi) => (Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
  let url;
  try { url = placeUrl({ name: l.name, address: l.address, lat: l.lat, lng: l.lng, placeId: l.place_id }); } catch { url = undefined; }
  return compact({ name: clip(l.name, SHORT) || l.id, address: clip(l.address, SHORT), from: l.from, to: l.to, lat: ok(l.lat, -90, 90), lng: ok(l.lng, -180, 180), maps_url: url, note: clip(l.note, TEXT), check_in: l.check_in, check_out: l.check_out });
}

/** toBrochureModel(args) → brochure model v1 (see the file header). Throws on a stop whose place is unknown. */
export function toBrochureModel({ trip, plan, places, notes = [], snapshots = [], estimates = [], options = {} } = {}) {
  if (!trip || !plan || !Array.isArray(plan.days)) throw new Error('brochure-map: needs { trip, plan } with plan.days');
  const showGoogle = options.show_google_content !== false;
  const placeList = Array.isArray(places) ? places : (plan.places || []);
  const placesBySlug = new Map(placeList.filter((p) => p && p.id).map((p) => [p.id, p]));
  const notesByPlace = byPlaceId(notes, (m, n) => { const cur = m.get(n.place_id); if (!cur || String(n.last_researched || '') > String(cur.last_researched || '')) m.set(n.place_id, n); });
  const estimatesByPlace = byPlaceId(estimates, (m, e) => m.set(e.place_id, [...(m.get(e.place_id) || []), e]));
  const snaps = snapshotIndex(snapshots, plan.build_id);
  const lodgingBySlug = new Map((trip.lodging || []).map((l) => [l.id, l]));
  const lodgingName = (slug) => (lodgingBySlug.get(slug) || {}).name;
  // Contract C11: facts lines need a "now" for the stale marks (options.now, else the build date; none → never stale),
  // the travellers' diet for the menu line, and the trip's locale for the times.
  const locale = LOCALE.test(String(trip.locale || '')) ? trip.locale : 'en-US';
  const factsOptions = { now: options.now ?? (DATE.test(String(options.built_on || plan.built_on || '')) ? (options.built_on || plan.built_on) : undefined), diet: typeof options.diet === 'string' || (Array.isArray(options.diet) && options.diet.every((x) => typeof x === 'string')) ? options.diet : undefined, locale };
  const overrides = new Map((Array.isArray(trip.day_overrides) ? trip.day_overrides : []).filter((o) => o && DATE.test(String(o.date || ''))).map((o) => [o.date, o]));

  const days = plan.days.filter((d) => d && d.date >= trip.start_date && d.date <= trip.end_date).slice().sort((a, b) => a.date.localeCompare(b.date));
  // Card order: places as the days use them, then Later-list places. Stops must resolve; other references may not.
  const order = [], visitDates = new Map(), visits = new Map();
  const want = (slug, date) => {
    if (!slug || slug === 'lodging' || !placesBySlug.has(slug)) return;
    if (!visitDates.has(slug)) { visitDates.set(slug, []); order.push(slug); }
    if (date && !visitDates.get(slug).includes(date)) visitDates.get(slug).push(date);
  };
  for (const d of days) {
    for (const s of d.stops || []) {
      if (!placesBySlug.has(s.place)) throw new Error(`brochure-map: ${d.date} stop "${s.place}" is not among the places`);
      want(s.place, d.date);
      visits.set(s.place, [...(visits.get(s.place) || []), { arrive: s.arrive, depart: s.depart, window: s.window || null }]);
    }
    for (const x of d.meals || []) want(x.at);
    for (const l of d.legs || []) { want(l.from); want(l.to); }
    for (const w of d.warnings || []) want(w.place);
    for (const r of d.rain_swaps || []) want(r.place);
  }
  for (const l of plan.later || []) for (const it of l.items || []) want(it.place);
  if (order.length > 200) throw new Error(`brochure-map: ${order.length} places; the brochure takes at most 200`);
  const cards = {};
  for (const slug of order) {
    const p = placesBySlug.get(slug);
    cards[slug] = placeCard({ place: p, snapshot: snaps.get(p.place_id), notesByPlace, estimatesByPlace, visitDates: visitDates.get(slug), visits: visits.get(slug), showGoogle, timeZone: trip.timezone, factsOptions });
  }

  const bDays = [], free = [], routes = [];
  for (const d of days) {
    if (!(d.stops || []).length) { const f = freeDay(d, overrides.get(d.date)); free.push({ date: d.date, note: f.text, url: f.url }); continue; }
    bDays.push(mapDay(d, { placesBySlug, cards, lodgingName, override: overrides.get(d.date), season: trip.season, factsOptions }));
    routes.push({ n: bDays.length, date: d.date, url: d.day_url });
  }
  if (!bDays.length) throw new Error('brochure-map: the plan has no day with a stop; the brochure needs at least one');

  const builtOn = options.built_on || plan.built_on;
  const verifiedOn = options.verified_on || days.map((d) => d.verified_on).filter((v) => DATE.test(String(v || ''))).sort().pop() || builtOn;
  const tripOut = compact({
    title: clip(trip.title, SHORT) || clip(trip.destination, SHORT), destination: clip(trip.destination, SHORT), country: clip(trip.country, SHORT),
    start_date: trip.start_date, end_date: trip.end_date, timezone: trip.timezone ? String(trip.timezone).slice(0, 64) : undefined,
    locale: LOCALE.test(String(trip.locale || '')) ? trip.locale : undefined,
    travelers: (trip.travelers || []).map((t) => clip(t, SHORT)).filter(Boolean).slice(0, 12),
    pace: trip.pace, day_start: trip.day_start, day_end: trip.day_end, intro: clip(trip.intro, TEXT),
    lodging: (trip.lodging || []).slice(0, 12).map(lodgingEntry),
    build_id: plan.build_id ? String(plan.build_id).slice(0, 64) : undefined,
    built_on: DATE.test(String(builtOn || '')) ? builtOn : undefined,
    verified_on: DATE.test(String(verifiedOn || '')) ? verifiedOn : undefined
  });

  const practical = tripPractical(trip.practical);
  // Bookings first: deadlines are what the practical page is opened for before the trip, and the section cap never cuts them.
  const bookSec = bookingsSection(trip.bookings, { tripTz: trip.timezone, ownerTz: options.owner_tz, now: options.now });
  if (bookSec) practical.unshift(bookSec);
  const routeSec = dayRoutes(routes); if (routeSec) practical.push(routeSec);
  const freeSec = freeDays(free); if (freeSec) practical.push(freeSec);
  if (!showGoogle) {
    const rows = order.map((slug) => { const p = placesBySlug.get(slug), s = snaps.get(p.place_id); return { name: cards[slug].name, url: mapsLink(p), checked: (s && s.fetched_at && localDate(s.fetched_at, trip.timezone)) || verifiedOn }; });
    practical.push(...verifySections(rows, verifiedOn));
  }

  const ids = new Set(order.map((s) => placesBySlug.get(s).place_id));
  const attribution = buildAttribution({
    notes: [...notesByPlace.values()].filter((n) => ids.has(n.place_id)),
    estimates: [...estimatesByPlace.values()].flat().filter((e) => ids.has(e.place_id)),
    generator: options.generator, showGoogle,
    extra: [...order.flatMap((s) => factsSourceRows(placesBySlug.get(s).facts)), ...seasonSourceRows(trip.season)]
  });
  const season = seasonModel(trip.season, { start_date: trip.start_date, end_date: trip.end_date, cards });
  return compact({ version: 1, trip: tripOut, season, days: bDays, places: cards, later: mapLater(plan.later, { cards }), practical: practical.slice(0, PRACTICAL_LIMITS.sections), attribution });
}

/** renderPlan(args, renderOptions) → { html, model, warnings } — model is the brochure model (not the kit's prepared one). */
export function renderPlan(args, renderOptions = {}) {
  const model = toBrochureModel(args);
  const r = renderHtml(model, renderOptions);
  return { html: r.html, model, warnings: r.warnings };
}
/** renderPlanPdf(args, outPath, opts) → also writes the PDF when Playwright and Chromium are present (else pdf: null). */
export async function renderPlanPdf(args, outPath, opts = {}) {
  const r = renderPlan(args, { page: opts.page, embedFonts: opts.embedFonts });
  if (!pdfAvailable()) return { ...r, pdf: null, pages: 0, available: false };
  const p = await renderPdf(r.html, outPath, { page: opts.page, shotsDir: opts.shotsDir });
  return { ...r, warnings: r.warnings.concat(p.warnings || []), pdf: outPath, pages: p.pages, available: true };
}

// Developed by: LightAISolutions

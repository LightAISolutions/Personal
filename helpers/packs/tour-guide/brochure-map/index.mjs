/**
 * Tour Guide brochure-map — the planner's Plan (plus the Trip, Places, PlaceNotes, build-scoped GoogleSnapshots and
 * VisitEstimates) → the brochure kit's model (helpers/kits/brochure/schema/brochure.schema.json), and a render
 * convenience through the kit.
 *   toBrochureModel({ trip, plan, places?, notes?, snapshots?, estimates?, options:{ generator?, built_on?, verified_on?, show_google_content = true } }) → model
 *   renderPlan(args, { page?, embedFonts? }) → { html, model, warnings }
 *   renderPlanPdf(args, outPath, { page?, shotsDir? }) → { html, model, warnings, pdf, pages, available }   (no PDF when pdfAvailable() is false)
 * Pure: never mutates its input, never calls the network.
 */
import { renderHtml, renderPdf, pdfAvailable } from '../../../kits/brochure/index.mjs';
import { placeUrl } from '../../../kits/maps/lib/maps-urls.mjs';
import { clip, compact, localDate, snapshotIndex, SHORT, TEXT } from './brochure-map-text.mjs';
import { placeCard, mapsLink } from './brochure-map-cards.mjs';
import { mapDay } from './brochure-map-days.mjs';
import { mapLater } from './brochure-map-later.mjs';
import { tripPractical, dayRoutes, freeDays, verifySections, PRACTICAL_LIMITS } from './brochure-map-practical.mjs';
import { buildAttribution } from './brochure-map-attribution.mjs';

export { placeCard, closedDays, hoursLine, hoursToday, categoryLabel } from './brochure-map-cards.mjs';
export { mapDay, legMode, MODE_MAP } from './brochure-map-days.mjs';
export { mapLater } from './brochure-map-later.mjs';
export { buildAttribution, mergeSources, sourceKey } from './brochure-map-attribution.mjs';
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

  const days = plan.days.filter((d) => d && d.date >= trip.start_date && d.date <= trip.end_date).slice().sort((a, b) => a.date.localeCompare(b.date));
  // Card order: places as the days use them, then Later-list places. Stops must resolve; other references may not.
  const order = [], visitDates = new Map();
  const want = (slug, date) => {
    if (!slug || slug === 'lodging' || !placesBySlug.has(slug)) return;
    if (!visitDates.has(slug)) { visitDates.set(slug, []); order.push(slug); }
    if (date && !visitDates.get(slug).includes(date)) visitDates.get(slug).push(date);
  };
  for (const d of days) {
    for (const s of d.stops || []) { if (!placesBySlug.has(s.place)) throw new Error(`brochure-map: ${d.date} stop "${s.place}" is not among the places`); want(s.place, d.date); }
    for (const x of d.meals || []) want(x.at);
    for (const l of d.legs || []) { want(l.from); want(l.to); }
    for (const w of d.warnings || []) want(w.place);
  }
  for (const l of plan.later || []) for (const it of l.items || []) want(it.place);
  if (order.length > 200) throw new Error(`brochure-map: ${order.length} places; the brochure takes at most 200`);
  const cards = {};
  for (const slug of order) {
    const p = placesBySlug.get(slug);
    cards[slug] = placeCard({ place: p, snapshot: snaps.get(p.place_id), notesByPlace, estimatesByPlace, visitDates: visitDates.get(slug), showGoogle, timeZone: trip.timezone });
  }

  const bDays = [], free = [], routes = [];
  for (const d of days) {
    if (!(d.stops || []).length) { free.push({ date: d.date, note: (d.free || []).map((f) => f.note).filter(Boolean).join(' ') }); continue; }
    bDays.push(mapDay(d, { placesBySlug, cards, lodgingName }));
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
    generator: options.generator, showGoogle
  });
  return compact({ version: 1, trip: tripOut, days: bDays, places: cards, later: mapLater(plan.later, { cards }), practical: practical.slice(0, PRACTICAL_LIMITS.sections), attribution });
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

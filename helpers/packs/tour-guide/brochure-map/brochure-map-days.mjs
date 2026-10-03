/**
 * Tour Guide brochure-map — DayPlan → brochure day. Stops keep arrive/depart/minutes/activity/booked; legs map the
 * Routes travel mode to the brochure's (TRANSIT→transit, WALK→walk, DRIVE→drive, anything else→other) and carry the
 * transit `line`; meals at "lodging" name the lodging; warn/alert warnings go to the day's "Mind" block, info
 * warnings become a note on their stop (or stay as an info line when they name no stop of the day); `rain_swaps` become
 * the day's "If it rains" alternatives. Phase 10 fields (Contract C10) pass through when the DayPlan has them: a leg's
 * `estimated` mark, `flags`, `taxi_minutes` and `buffer_minutes`; a stop's `time_style` and `check_on_day`; the day's
 * `spare_minutes`. Contract C11 fields pass through the same way: the day's real `start`/`end` (with the override's
 * coordinates and a Maps link), the `bags` step, `sunset` and the evening `extras`; a dinner's restaurant and booking
 * line; a stop's `last_entry`, `minutes_source`, `crowd_slot` and the booking line from its place's facts; legs from
 * `day-start` or to `day-end`. An older DayPlan without them maps as before.
 */
import { placeUrl } from '../../../kits/maps/lib/maps-urls.mjs';
import { clip, compact, SHORT, TEXT } from './brochure-map-text.mjs';
import { stopLines, https, MINUTES_SOURCES, CROWD_SLOTS } from './brochure-map-facts.mjs';

export const MODE_MAP = Object.freeze({ TRANSIT: 'transit', WALK: 'walk', DRIVE: 'drive', BICYCLE: 'bike', TWO_WHEELER: 'other' });
export const LEG_FLAGS = Object.freeze(['footpath', 'trail', 'uphill', 'downhill']);
export const LIMITS = Object.freeze({ stops: 14, legs: 20, meals: 8, free: 8, warnings: 12 });
const SEVERITY_RANK = { alert: 0, warn: 1, info: 2 };
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const time = (t) => (typeof t === 'string' && TIME.test(t) ? t : undefined);
const mins = (n) => (Number.isInteger(n) && n >= 0 && n <= 1440 ? n : (Number.isFinite(n) && n >= 0 ? Math.min(1440, Math.round(n)) : undefined));

export const legMode = (m) => MODE_MAP[String(m || '').toUpperCase()] || 'other';

/** Booking text for a stop: the DayPlan's `booked`, else the Place's timed booking when it is for this date. */
function bookedText(stop, place, date) {
  if (stop.booked) return clip(stop.booked, SHORT);
  const b = place && place.booking;
  if (b && b.date === date && b.time) return clip(`Timed entry ${b.time}, booked${b.ref ? ` (ref ${b.ref})` : ''}`, SHORT);
  return undefined;
}
/** Default headline when the plan gives none: the first two stops' names. */
function defaultTheme(stops, cards) {
  const names = stops.slice(0, 2).map((s) => cards[s.place] && cards[s.place].name).filter(Boolean);
  return clip(names.join(' and ') + (stops.length > 2 ? ', and more' : ''), SHORT);
}

export const RAIN_TITLE = 'If it rains';
/** "Instead of Green Park · 1.1 km away" (+ "· check the hours" when Google has none for that date). */
function rainNote(r, cards) {
  const other = cards[r.instead_of] && cards[r.instead_of].name;
  return clip([other ? `Instead of ${other}` : '', Number.isFinite(r.km) ? `${r.km} km away` : '', r.hours === 'unknown' ? 'check the hours' : ''].filter(Boolean).join(' · '), SHORT);
}
const coord = (v, lim) => (Number.isFinite(v) && Math.abs(v) <= lim ? v : undefined);
/** The day's real start or end: the DayPlan's { name, time } plus the override's coordinates, Maps link and note. */
function dayPoint(p, ov, note) {
  if (!p || !time(p.time)) return undefined;
  const name = clip(p.name, SHORT) || clip(ov && ov.name, SHORT);
  if (!name) return undefined;
  const lat = coord(ov && ov.lat, 90), lng = coord(ov && ov.lng, 180);
  let url;
  try { url = ov && (ov.place_id || (lat !== undefined && lng !== undefined)) ? placeUrl({ name, lat, lng, placeId: ov.place_id }) : undefined; } catch { url = undefined; }
  return compact({ name, time: p.time, maps_url: url, lat, lng, note: clip(note, SHORT) });
}
const BAG_KINDS = ['carry', 'locker', 'hotel', 'forward'];
/** The bag step: where = the night's lodging (at 'lodging') or the start point's name (at 'day-start'). */
function dayBags(b, { start, lodging }) {
  if (!b || !BAG_KINDS.includes(b.kind)) return undefined;
  const where = b.at === 'day-start' ? start && start.name : lodging;
  return compact({ kind: b.kind, text: clip(b.text, 160), start: time(b.start), end: time(b.start) && time(b.end), where: clip(where, SHORT) });
}
/** Evening extras (≤ 3): an event links to its page (https) or its place card; a saved place to its card or Maps. */
function dayExtras(list, { cards, placesBySlug, events }) {
  return (Array.isArray(list) ? list : []).filter((x) => x && (x.kind === 'event' || x.kind === 'saved') && clip(x.name, SHORT)).slice(0, 3).map((x) => {
    const ev = x.kind === 'event' ? events.find((e) => e && e.id === x.ref) : null;
    const slug = x.kind === 'saved' ? x.ref : ev && ev.place;
    const place = slug && cards[slug] ? slug : undefined;
    const p = !place && x.kind === 'saved' ? placesBySlug.get(x.ref) : null;
    let url = ev ? https(ev.url) : undefined;
    if (!url && p) { try { url = placeUrl({ name: p.name, placeId: p.place_id }); } catch { url = undefined; } }
    return compact({ kind: x.kind, name: clip(x.name, SHORT), place, time: time(x.time), km: Number.isFinite(x.km) && x.km >= 0 ? Math.min(100, Math.round(x.km * 10) / 10) : undefined, note: clip(x.note, 160), url });
  });
}
/**
 * mapDay(dayPlan, { placesBySlug, cards, lodgingName, override?, season?, factsOptions? }) → brochure day.
 * cards: brochure places already built (keys = slugs); lodgingName(slug) → the lodging's name; override: the trip's
 * `day_overrides` entry for this date (coordinates and note of the real start/end); season: the trip's season sheet
 * (event links for the extras); factsOptions: { now, diet, locale } for the facts lines.
 * Throws when the day has more stops than the brochure takes (the planner caps clusters well below it).
 */
export function mapDay(dp, { placesBySlug, cards, lodgingName, override, season, factsOptions = {} }) {
  if (dp.stops.length > LIMITS.stops) throw new Error(`brochure-map: ${dp.date} has ${dp.stops.length} stops; the brochure takes at most ${LIMITS.stops}`);
  const stopSlugs = new Set(dp.stops.map((s) => s.place));
  const ov = override || {};
  const start = dayPoint(dp.start, ov.start, ov.note);
  const end = dayPoint(dp.end, ov.end, start ? undefined : ov.note);
  const stops = dp.stops.map((s) => {
    const place = placesBySlug.get(s.place);
    const booked = bookedText(s, place, dp.date);
    return compact({
      place: s.place, arrive: s.arrive, depart: s.depart,
      activity: clip(s.activity, SHORT), minutes: mins(s.minutes),
      booked,
      time_style: s.time_style === 'about' || s.time_style === 'exact' ? s.time_style : undefined,
      check_on_day: clip(s.check_on_day, SHORT),
      last_entry: time(s.last_entry),
      minutes_source: MINUTES_SOURCES.includes(s.minutes_source) ? s.minutes_source : undefined,
      crowd_slot: CROWD_SLOTS.includes(s.crowd_slot) ? s.crowd_slot : undefined,
      booking_line: booked ? undefined : stopLines(place && place.facts, factsOptions).booking_line
    });
  });
  const ends = (x) => (x === 'lodging' || cards[x] || (x === 'day-start' && start) || (x === 'day-end' && end) ? x : undefined);
  const legs = (dp.legs || []).slice(0, LIMITS.legs).map((l) => compact({
    from: ends(l.from), to: ends(l.to), mode: legMode(l.mode), minutes: mins(l.minutes) ?? 0,
    distance_m: Number.isFinite(l.distance_m) && l.distance_m >= 0 ? l.distance_m : undefined,
    depart_at: time(l.depart_at), arrive_at: time(l.arrive_at),
    maps_url: l.maps_url ? String(l.maps_url).slice(0, 2000) : undefined,
    line: clip(l.line, SHORT), note: clip(l.note, SHORT),
    estimated: l.estimated ? true : undefined,
    flags: Array.isArray(l.flags) ? [...new Set(l.flags.filter((f) => LEG_FLAGS.includes(f)))] : undefined,
    taxi_minutes: mins(l.taxi_minutes),
    buffer_minutes: Number.isInteger(l.buffer_minutes) && l.buffer_minutes >= 0 && l.buffer_minutes <= 120 ? l.buffer_minutes : undefined
  }));
  const meals = (dp.meals || []).slice(0, LIMITS.meals).map((x) => {
    const m = { kind: x.kind, start: x.start, end: time(x.end), note: clip(x.note, SHORT) };
    if (x.at === 'lodging') m.name = clip(lodgingName(x.kind === 'breakfast' ? dp.lodging_start : dp.lodging_end), SHORT);
    else if (x.at && cards[x.at]) m.place = x.at;
    if (x.booking) m.booking = clip(x.booking, 160);
    return compact(m);
  });
  const free = (dp.free || []).slice(0, LIMITS.free).map((x) => compact({ start: x.start, end: x.end, note: clip(x.note, SHORT) }));
  const notes = new Map();
  const warnings = [];
  for (const w of dp.warnings || []) {
    const sev = SEVERITY_RANK[w.severity] !== undefined ? w.severity : 'warn';
    if (sev === 'info' && w.place && stopSlugs.has(w.place)) { notes.set(w.place, [...(notes.get(w.place) || []), w.text]); continue; }
    warnings.push(compact({ severity: sev, text: clip(w.text, SHORT) || w.code || 'Check this day', place: w.place && cards[w.place] ? w.place : undefined }));
  }
  warnings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  for (const s of stops) if (notes.has(s.place)) s.note = clip(notes.get(s.place).join(' '), TEXT);
  const swaps = (dp.rain_swaps || []).filter((r) => cards[r.place]).slice(0, 3).map((r) => compact({ place: r.place, note: rainNote(r, cards) }));
  const lodging = clip(lodgingName(dp.lodging_end), SHORT);
  const c11 = compact({
    start, end,
    bags: dayBags(dp.bags, { start, lodging }),
    sunset: time(dp.sunset),
    extras: dayExtras(dp.extras, { cards, placesBySlug, events: season && Array.isArray(season.events) ? season.events : [] })
  });
  return compact({
    date: dp.date,
    theme: clip(dp.theme, SHORT) || defaultTheme(dp.stops, cards),
    lodging,
    stops, legs, meals, free,
    warnings: warnings.slice(0, LIMITS.warnings),
    alternatives: swaps.length ? { title: RAIN_TITLE, items: swaps } : undefined,
    verified_on: dp.verified_on,
    spare_minutes: mins(dp.spare_minutes),
    ...c11
  });
}

// Developed by: LightAISolutions

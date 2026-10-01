/**
 * Tour Guide brochure-map — DayPlan → brochure day. Stops keep arrive/depart/minutes/activity/booked; legs map the
 * Routes travel mode to the brochure's (TRANSIT→transit, WALK→walk, DRIVE→drive, anything else→other) and carry the
 * transit `line`; meals at "lodging" name the lodging; warn/alert warnings go to the day's "Mind" block, info
 * warnings become a note on their stop (or stay as an info line when they name no stop of the day); `rain_swaps` become
 * the day's "If it rains" alternatives.
 */
import { clip, compact, SHORT, TEXT } from './brochure-map-text.mjs';

export const MODE_MAP = Object.freeze({ TRANSIT: 'transit', WALK: 'walk', DRIVE: 'drive', BICYCLE: 'bike', TWO_WHEELER: 'other' });
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
/**
 * mapDay(dayPlan, { placesBySlug, cards, lodgingName }) → brochure day.
 * cards: brochure places already built (keys = slugs); lodgingName(slug) → the lodging's name.
 * Throws when the day has more stops than the brochure takes (the planner caps clusters well below it).
 */
export function mapDay(dp, { placesBySlug, cards, lodgingName }) {
  if (dp.stops.length > LIMITS.stops) throw new Error(`brochure-map: ${dp.date} has ${dp.stops.length} stops; the brochure takes at most ${LIMITS.stops}`);
  const stopSlugs = new Set(dp.stops.map((s) => s.place));
  const stops = dp.stops.map((s) => compact({
    place: s.place, arrive: s.arrive, depart: s.depart,
    activity: clip(s.activity, SHORT), minutes: mins(s.minutes),
    booked: bookedText(s, placesBySlug.get(s.place), dp.date)
  }));
  const ends = (x) => (x === 'lodging' || cards[x] ? x : undefined);
  const legs = (dp.legs || []).slice(0, LIMITS.legs).map((l) => compact({
    from: ends(l.from), to: ends(l.to), mode: legMode(l.mode), minutes: mins(l.minutes) ?? 0,
    distance_m: Number.isFinite(l.distance_m) && l.distance_m >= 0 ? l.distance_m : undefined,
    depart_at: time(l.depart_at), arrive_at: time(l.arrive_at),
    maps_url: l.maps_url ? String(l.maps_url).slice(0, 2000) : undefined,
    line: clip(l.line, SHORT), note: clip(l.note, SHORT)
  }));
  const meals = (dp.meals || []).slice(0, LIMITS.meals).map((x) => {
    const m = { kind: x.kind, start: x.start, end: time(x.end), note: clip(x.note, SHORT) };
    if (x.at === 'lodging') m.name = clip(lodgingName(x.kind === 'breakfast' ? dp.lodging_start : dp.lodging_end), SHORT);
    else if (x.at && cards[x.at]) m.place = x.at;
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
  return compact({
    date: dp.date,
    theme: clip(dp.theme, SHORT) || defaultTheme(dp.stops, cards),
    lodging: clip(lodgingName(dp.lodging_end), SHORT),
    stops, legs, meals, free,
    warnings: warnings.slice(0, LIMITS.warnings),
    alternatives: swaps.length ? { title: RAIN_TITLE, items: swaps } : undefined,
    verified_on: dp.verified_on
  });
}

// Developed by: LightAISolutions

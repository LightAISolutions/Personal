/**
 * Brochure kit — model preparation. Runs the schema, then the checks a schema cannot express (stop keys exist,
 * days fall inside the trip, times are ordered), and derives what the sections need: numbered days, resolved
 * places, a merged timeline per day (stops, legs, meals, free time in clock order) and per-day statistics.
 * Throws ModelError with every problem listed; never mutates the input.
 */
import { directionsUrl } from './directions.mjs';
import { validate, formatErrors } from './validate.mjs';
import { parseDate, parseTime, daySpan, minutesBetween, addDays } from './format.mjs';

export class ModelError extends Error {
  constructor(errors) { super('brochure model invalid:\n' + formatErrors(errors)); this.name = 'ModelError'; this.errors = errors; }
}
export const GOOGLE_FIELDS = ['hours', 'hours_today', 'rating', 'review_count', 'website', 'maps_url', 'place_id', 'business_status', 'editorial', 'reviews', 'phone', 'price_level', 'google_photo'];

/** Semantic checks → [{path, message}]. */
export function semanticErrors(m) {
  const errs = [];
  const push = (path, message) => errs.push({ path, message });
  const span = daySpan(m.trip.start_date, m.trip.end_date);
  if (span === null) push('/trip', 'start_date or end_date is not a real date');
  else if (span < 1) push('/trip/end_date', 'ends before it starts');
  else if (span > 31) push('/trip', `${span} days is longer than the 31-day cap`);
  const key = (k) => Object.prototype.hasOwnProperty.call(m.places, k);
  const seen = new Set();
  m.days.forEach((d, i) => {
    const p = `/days/${i}`;
    if (!parseDate(d.date)) push(p + '/date', 'not a real date');
    else if (span !== null && (d.date < m.trip.start_date || d.date > m.trip.end_date)) push(p + '/date', `outside the trip (${m.trip.start_date} – ${m.trip.end_date})`);
    if (seen.has(d.date)) push(p + '/date', 'duplicate day'); seen.add(d.date);
    let last = -1;
    d.stops.forEach((s, j) => {
      const q = `${p}/stops/${j}`;
      if (!key(s.place)) push(q + '/place', `unknown place "${s.place}"`);
      const a = parseTime(s.arrive), b = parseTime(s.depart);
      if (a !== null && b !== null && b < a) push(q, 'departs before it arrives');
      if (a !== null && a < last) push(q + '/arrive', 'earlier than the previous stop');
      if (b !== null) last = b;
    });
    (d.legs || []).forEach((l, j) => ['from', 'to'].forEach((k) => { if (l[k] && l[k] !== 'lodging' && !key(l[k])) push(`${p}/legs/${j}/${k}`, `unknown place "${l[k]}"`); }));
    (d.meals || []).forEach((x, j) => { if (x.place && !key(x.place)) push(`${p}/meals/${j}/place`, `unknown place "${x.place}"`); if (x.end && minutesBetween(x.start, x.end) === null) push(`${p}/meals/${j}`, 'ends before it starts'); });
    (d.free || []).forEach((x, j) => { if (minutesBetween(x.start, x.end) === null) push(`${p}/free/${j}`, 'ends before it starts'); });
    (d.warnings || []).forEach((x, j) => { if (x.place && !key(x.place)) push(`${p}/warnings/${j}/place`, `unknown place "${x.place}"`); });
    ((d.alternatives && d.alternatives.items) || []).forEach((x, j) => { if (!key(x.place)) push(`${p}/alternatives/items/${j}/place`, `unknown place "${x.place}"`); });
  });
  (m.later || []).forEach((l, i) => l.items.forEach((it, j) => { if (it.place && !key(it.place)) push(`/later/${i}/items/${j}/place`, `unknown place "${it.place}"`); }));
  return errs;
}
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TRANSIT = new Set(['transit', 'train', 'ferry']);
/** The opening-hours line for a date from Google's seven weekday lines ('Thursday: 9:30 AM – 5:00 PM' → '9:30 AM – 5:00 PM'). */
export function hoursOn(place, date) {
  const d = parseDate(date);
  if (!d || !Array.isArray(place.hours)) return '';
  const name = WEEKDAYS[d.getUTCDay()];
  const line = place.hours.find((h) => typeof h === 'string' && h.toLowerCase().startsWith(name.toLowerCase() + ':'));
  return line ? line.slice(name.length + 1).trim() : '';
}
export function isClosedOn(place, date) {
  const d = parseDate(date);
  if (!d) return false;
  const name = WEEKDAYS[d.getUTCDay()].toLowerCase();
  if ((place.closed_days || []).some((c) => String(c).toLowerCase().startsWith(name.slice(0, 3)))) return true;
  return /^closed$/i.test(hoursOn(place, date));
}
const sortKey = { leg: 0, stop: 1, meal: 2, free: 3 };

/** prepare(model) → derived model; throws ModelError. The input is not mutated. */
export function prepare(input) {
  const errors = validate(input).concat(validate(input).length ? [] : semanticErrors(input));
  if (errors.length) throw new ModelError(errors);
  const m = JSON.parse(JSON.stringify(input));
  const locale = m.trip.locale || 'en-US';
  const places = {};
  for (const [id, p] of Object.entries(m.places)) places[id] = { id, ...p, google: GOOGLE_FIELDS.some((f) => p[f] !== undefined) };
  const lodgings = m.trip.lodging || [];
  const cardOrder = [], cardSeen = new Set();
  const days = m.days.map((d, i) => {
    const lodging = lodgings.find((l) => l.name === d.lodging) || lodgings.find((l) => (!l.from || l.from <= d.date) && (!l.to || d.date < l.to)) || lodgings[0] || null;
    const stops = d.stops.map((s, j) => {
      const place = places[s.place];
      const minutes = s.minutes ?? minutesBetween(s.arrive, s.depart) ?? 0;
      return { kind: 'stop', ...s, n: j + 1, place, minutes, start: parseTime(s.arrive), end: parseTime(s.depart), hours: s.hours_today || place.hours_today || hoursOn(place, d.date), closedToday: isClosedOn(place, d.date) };
    });
    const meals = (d.meals || []).map((x) => ({ ...x, kind: 'meal', meal: x.kind, place: x.place ? places[x.place] : null, start: parseTime(x.start), end: x.end ? parseTime(x.end) : null }));
    const free = (d.free || []).map((x) => ({ kind: 'free', ...x, start: parseTime(x.start), end: parseTime(x.end) }));
    const endOf = (ref) => { const s = stops.find((x) => x.place.id === ref); if (s) return s.end; const ml = meals.find((x) => x.place && x.place.id === ref); return ml ? (ml.end ?? ml.start) : null; };
    const legs = (d.legs || []).map((l, j) => {
      let start = l.depart_at ? parseTime(l.depart_at) : null;
      if (start === null) start = l.from && l.from !== 'lodging' ? endOf(l.from) : (stops[0] ? stops[0].start - l.minutes : null);
      const end = (k) => (l[k] === 'lodging' ? lodging : l[k] ? places[l[k]] : null);
      return { kind: 'leg', ...l, j, start: start ?? 0, end: l.arrive_at ? parseTime(l.arrive_at) : (start ?? 0) + l.minutes, fromPlace: l.from && l.from !== 'lodging' ? places[l.from] : null, toPlace: l.to && l.to !== 'lodging' ? places[l.to] : null, transit: TRANSIT.has(l.mode), directions_url: l.maps_url || directionsUrl(end('from'), end('to'), l.mode) };
    });
    const timeline = [...legs, ...stops, ...meals, ...free].sort((a, b) => (a.start - b.start) || (sortKey[a.kind] - sortKey[b.kind]) || ((a.j ?? a.n ?? 0) - (b.j ?? b.n ?? 0)));
    const sum = (f) => legs.filter(f).reduce((a, l) => a + (l.minutes || 0), 0);
    const starts = timeline.map((t) => t.start).filter((t) => t !== null), ends = timeline.map((t) => t.end ?? t.start).filter((t) => t !== null);
    const stats = { stops: stops.length, visitMin: stops.reduce((a, s) => a + s.minutes, 0), walkMin: sum((l) => l.mode === 'walk'), transitMin: sum((l) => l.transit), walkEstimated: legs.some((l) => l.mode === 'walk' && l.estimated), transitEstimated: legs.some((l) => l.transit && l.estimated), spareMin: Number.isInteger(d.spare_minutes) ? d.spare_minutes : null, driveMin: sum((l) => ['drive', 'taxi', 'bike'].includes(l.mode)), firstStart: starts.length ? Math.min(...starts) : null, lastEnd: ends.length ? Math.max(...ends) : null };
    for (const t of timeline) if ((t.kind === 'stop' || t.kind === 'meal') && t.place && !cardSeen.has(t.place.id)) { cardSeen.add(t.place.id); cardOrder.push({ place: t.place, day: i + 1, n: t.kind === 'stop' ? t.n : null, mealKind: t.kind === 'meal' ? t.meal : null }); }
    const alternatives = d.alternatives ? { title: d.alternatives.title || 'If it rains', items: d.alternatives.items.map((x) => ({ ...x, place: places[x.place] })) } : null;
    return { ...d, index: i + 1, weekday: WEEKDAYS[parseDate(d.date).getUTCDay()], lodging, stops, meals, free, legs, timeline, stats, warnings: d.warnings || [], alternatives };
  });
  const later = (m.later || []).map((l) => ({ ...l, items: l.items.map((it) => ({ ...it, place: it.place ? places[it.place] : null })) }));
  const hasImg = (x) => Boolean(x && typeof x.src === 'string' && x.src.trim());
  const google = { maps: hasImg(m.trip.map_image) || days.some((d) => hasImg(d.map_image)), photos: Object.values(places).some((p) => hasImg(p.google_photo)) };
  const anyGoogle = Object.values(places).some((p) => p.google) || google.maps;
  const attribution = { ...(m.attribution || {}), google: m.attribution && m.attribution.google !== undefined ? m.attribution.google : anyGoogle, reviews: Object.values(places).flatMap((p) => (p.reviews || []).map((r) => ({ ...r, place: p }))), ...google };
  return { trip: m.trip, locale, places, days, cards: cardOrder, later, practical: m.practical || [], attribution, span: daySpan(m.trip.start_date, m.trip.end_date), dates: Array.from({ length: daySpan(m.trip.start_date, m.trip.end_date) }, (_, i) => addDays(m.trip.start_date, i)) };
}

// Developed by: LightAISolutions

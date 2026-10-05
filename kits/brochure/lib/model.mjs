/**
 * Brochure kit — model preparation. Runs the schema, then the checks a schema cannot express (stop keys exist,
 * days fall inside the trip, times are ordered), and derives what the sections need: numbered days, resolved
 * places, a merged timeline per day (stops, legs, meals, free time in clock order) and per-day statistics.
 * Throws ModelError with every problem listed; never mutates the input.
 */
import { directionsUrl } from './directions.mjs';
import { validate, formatErrors } from './validate.mjs';
import { parseDate, parseTime, daySpan, minutesBetween, addDays, withHourCycle, retimeText } from './format.mjs';

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
    (d.legs || []).forEach((l, j) => ['from', 'to'].forEach((k) => {
      const v = l[k];
      if (!v || v === 'lodging') return;
      if (v === HERE && !key(HERE)) { if (k === 'to') push(`${p}/legs/${j}/to`, `"${HERE}" (where you were) can only start a leg`); return; }
      if (POINT[v]) { if (!d[POINT[v]]) push(`${p}/legs/${j}/${k}`, `"${v}" needs the day's ${POINT[v]}`); return; }
      if (!key(v)) push(`${p}/legs/${j}/${k}`, `unknown place "${v}"`);
    }));
    (d.extras || []).forEach((x, j) => { if (x.place && !key(x.place)) push(`${p}/extras/${j}/place`, `unknown place "${x.place}"`); });
    if (d.bags && d.bags.start && d.bags.end && minutesBetween(d.bags.start, d.bags.end) === null) push(`${p}/bags`, 'ends before it starts');
    (d.meals || []).forEach((x, j) => { if (x.place && !key(x.place)) push(`${p}/meals/${j}/place`, `unknown place "${x.place}"`); if (x.end && minutesBetween(x.start, x.end) === null) push(`${p}/meals/${j}`, 'ends before it starts'); });
    (d.free || []).forEach((x, j) => { if (minutesBetween(x.start, x.end) === null) push(`${p}/free/${j}`, 'ends before it starts'); });
    (d.warnings || []).forEach((x, j) => { if (x.place && !key(x.place)) push(`${p}/warnings/${j}/place`, `unknown place "${x.place}"`); });
    ((d.alternatives && d.alternatives.items) || []).forEach((x, j) => { if (!key(x.place)) push(`${p}/alternatives/items/${j}/place`, `unknown place "${x.place}"`); });
    c18DayErrors(d, p, key, push);
  });
  (m.later || []).forEach((l, i) => l.items.forEach((it, j) => { if (it.place && !key(it.place)) push(`/later/${i}/items/${j}/place`, `unknown place "${it.place}"`); }));
  ((m.season && m.season.events) || []).forEach((x, j) => {
    if (!parseDate(x.from) || !parseDate(x.to)) push(`/season/events/${j}`, 'not a real date');
    else if (x.to < x.from) push(`/season/events/${j}`, 'ends before it starts');
    if (x.place && !key(x.place)) push(`/season/events/${j}/place`, `unknown place "${x.place}"`);
  });
  ((m.season && m.season.bloom) || []).forEach((x, j) => { if (x.from && x.to && x.to < x.from) push(`/season/bloom/${j}`, 'ends before it starts'); });
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
const sortKey = { start: -1, leg: 0, stop: 1, bags: 1.5, meal: 2, free: 3, end: 4 };
/** Reserved leg endpoints (Contract C11): the day's real start and end points, when the day has them. */
export const POINT = Object.freeze({ 'day-start': 'start', 'day-end': 'end' });
const isPoint = (v) => Object.prototype.hasOwnProperty.call(POINT, v);
/**
 * Contract C12 (Phase 12): the reserved leg start `here` is where the traveller was when a day was re-planned from a
 * shared location. It has a name ("where you were") and never coordinates, so a link that starts there has no origin
 * (Google then starts from the viewer's own location). It is reserved only while no place is keyed `here`.
 */
export const HERE = 'here';
export const HERE_NAME = 'where you were';
const herePoint = () => ({ name: HERE_NAME, here: true });

/** The Contract C12 fields: a re-planned day's visited stops and its `here` leg start. Without them, no C12 CSS. */
export function usesC12(m) {
  const placeHere = Object.prototype.hasOwnProperty.call(m.places || {}, HERE);
  return (m.days || []).some((d) => (d.stops || []).some((s) => s.visited === true) || (!placeHere && (d.legs || []).some((l) => l.from === HERE)));
}

/** The Contract C11 fields (Phase 11). A model without any of them renders byte for byte as before (usesC11 false). */
export const C11_DAY = ['start', 'end', 'bags', 'sunset', 'extras'];
export const C11_STOP = ['last_entry', 'minutes_source', 'crowd_slot', 'booking_line'];
export function usesC11(m) {
  const has = (o, keys) => o && keys.some((k) => o[k] !== undefined);
  return Boolean(m.season)
    || Object.values(m.places || {}).some((p) => p.facts || (p.flags && p.flags.length))
    || (m.days || []).some((d) => has(d, C11_DAY) || (d.stops || []).some((s) => has(s, C11_STOP)) || (d.meals || []).some((x) => x.booking !== undefined));
}
/**
 * The Contract C18 fields (Phase 18, wave 1): the trip's clock and temperature settings; a day's checklist, prep and
 * departure; `fixed` on stops, meals and the day's start and end; `tip` on stops and meals; a free window's title and
 * options. A model without any of them renders byte for byte as before (usesC18 false).
 */
export const C18_TRIP = ['clock', 'temp'];
export const C18_DAY = ['checklist', 'prep', 'departure'];
export function usesC18(m) {
  const has = (o, keys) => Boolean(o) && keys.some((k) => o[k] !== undefined);
  return has(m.trip, C18_TRIP)
    || (m.days || []).some((d) => has(d, C18_DAY) || has(d.start, ['fixed']) || has(d.end, ['fixed'])
      || (d.stops || []).some((s) => has(s, ['fixed', 'tip'])) || (d.meals || []).some((x) => has(x, ['fixed', 'tip']))
      || (d.free || []).some((x) => has(x, ['title', 'options'])));
}
/** C18 checks a schema cannot express: prep steps in time order, leave-by not after the departure, free options. */
function c18DayErrors(d, p, key, push) {
  let last = -1;
  ((d.prep && d.prep.steps) || []).forEach((s, j) => {
    const t = parseTime(s.time);
    if (t !== null && t < last) push(`${p}/prep/steps/${j}/time`, 'earlier than the step before (steps go in time order)');
    if (t !== null) last = t;
  });
  const dep = d.departure;
  if (dep && dep.by && parseTime(dep.by) !== null && parseTime(dep.at) !== null && parseTime(dep.by) > parseTime(dep.at)) push(`${p}/departure/by`, 'the leave-by time is after the departure');
  const names = new Set();
  (d.free || []).forEach((x, j) => (x.options || []).forEach((o, k) => {
    const q = `${p}/free/${j}/options/${k}`;
    if (o.walk_min !== undefined && !(Number.isInteger(o.walk_min) && o.walk_min >= 0 && o.walk_min <= 120)) push(q + '/walk_min', 'walk minutes must be 0–120');
    if (o.place && !key(o.place)) push(q + '/place', `unknown place "${o.place}"`);
    const n = String(o.name || '').trim().toLowerCase();
    if (names.has(n)) push(q + '/name', `"${o.name}" is offered twice on this day`);
    names.add(n);
  }));
}
/** prepare(model) → derived model; throws ModelError. The input is not mutated. */
export function prepare(input) {
  const errors = validate(input).concat(validate(input).length ? [] : semanticErrors(input));
  if (errors.length) throw new ModelError(errors);
  const m = JSON.parse(JSON.stringify(input));
  const c18 = usesC18(m);
  const locale = withHourCycle(m.trip.locale || 'en-US', m.trip.clock); // C18: the clock setting rides on the locale
  const places = {};
  const rt = (p) => (m.trip.clock === '24h' ? { ...p, ...(Array.isArray(p.hours) ? { hours: p.hours.map((h) => retimeText(h, '24h')) } : {}), ...(p.hours_today ? { hours_today: retimeText(p.hours_today, '24h') } : {}) } : p);
  for (const [id, p] of Object.entries(m.places)) places[id] = { id, ...rt(p), google: GOOGLE_FIELDS.some((f) => p[f] !== undefined) };
  const lodgings = m.trip.lodging || [];
  const cardOrder = [], cardSeen = new Set();
  const days = m.days.map((d, i) => {
    const lodging = lodgings.find((l) => l.name === d.lodging) || lodgings.find((l) => (!l.from || l.from <= d.date) && (!l.to || d.date < l.to)) || lodgings[0] || null;
    const stops = d.stops.map((s, j) => {
      const place = places[s.place];
      const minutes = s.minutes ?? minutesBetween(s.arrive, s.depart) ?? 0;
      return { kind: 'stop', ...s, n: j + 1, place, minutes, start: parseTime(s.arrive), end: parseTime(s.depart), hours: retimeText(s.hours_today, m.trip.clock) || place.hours_today || hoursOn(place, d.date), closedToday: isClosedOn(place, d.date) };
    });
    const meals = (d.meals || []).map((x) => ({ ...x, kind: 'meal', meal: x.kind, place: x.place ? places[x.place] : null, start: parseTime(x.start), end: x.end ? parseTime(x.end) : null }));
    const free = (d.free || []).map((x) => ({ kind: 'free', ...x, start: parseTime(x.start), end: parseTime(x.end), ...(x.options ? { options: x.options.map((o) => ({ ...o, place: o.place ? places[o.place] : null })) } : {}) }));
    const endOf = (ref) => { const s = stops.find((x) => x.place.id === ref); if (s) return s.end; const ml = meals.find((x) => x.place && x.place.id === ref); return ml ? (ml.end ?? ml.start) : null; };
    const isHere = (v) => v === HERE && !places[HERE];
    const point = (v) => (isPoint(v) ? d[POINT[v]] || null : isHere(v) ? herePoint() : null);
    const legs = (d.legs || []).map((l, j) => {
      let start = l.depart_at ? parseTime(l.depart_at) : null;
      if (start === null && isPoint(l.from)) start = parseTime(point(l.from) && point(l.from).time);
      if (start === null && isHere(l.from) && l.arrive_at) start = Math.max(0, parseTime(l.arrive_at) - l.minutes);
      if (start === null) start = l.from && l.from !== 'lodging' ? endOf(l.from) : (stops[0] ? stops[0].start - l.minutes : null);
      const end = (k) => (l[k] === 'lodging' ? lodging : isPoint(l[k]) || isHere(l[k]) ? point(l[k]) : l[k] ? places[l[k]] : null);
      const placeAt = (k) => (l[k] && l[k] !== 'lodging' && !isPoint(l[k]) && !isHere(l[k]) ? places[l[k]] : null);
      return { kind: 'leg', ...l, j, start: start ?? 0, end: l.arrive_at ? parseTime(l.arrive_at) : (start ?? 0) + l.minutes, fromPlace: placeAt('from'), toPlace: placeAt('to'), fromPoint: point(l.from), toPoint: point(l.to), transit: TRANSIT.has(l.mode), directions_url: l.maps_url || directionsUrl(end('from'), end('to'), l.mode) };
    });
    // C11 rows, only when the day has them: the real start (with an untimed bag step), a timed bag step, the real end.
    const anchors = [];
    const bags = d.bags || null, bagsTimed = Boolean(bags && bags.start);
    if (d.start) anchors.push({ kind: 'start', point: d.start, start: parseTime(d.start.time), end: null, bags: bags && !bagsTimed ? bags : null });
    if (bags && (bagsTimed || !d.start)) anchors.push({ kind: 'bags', bags, start: bagsTimed ? parseTime(bags.start) : null, end: bags.end ? parseTime(bags.end) : null });
    if (d.end) anchors.push({ kind: 'end', point: d.end, start: parseTime(d.end.time), end: null });
    const at = (t) => (t.start === null ? -1 : t.start);
    const timeline = [...legs, ...stops, ...meals, ...free, ...anchors].sort((a, b) => (at(a) - at(b)) || (sortKey[a.kind] - sortKey[b.kind]) || ((a.j ?? a.n ?? 0) - (b.j ?? b.n ?? 0)));
    // Evening extras in clock order (untimed ones last, otherwise as given).
    const xt = (x) => (x.time ? parseTime(x.time) : 1e9);
    const extras = (d.extras || []).map((x, j) => ({ ...x, j, place: x.place ? places[x.place] : null })).sort((a, b) => (xt(a) - xt(b)) || (a.j - b.j));
    // Sunset is left out on a day that ends at a departure before it (the travellers are gone by then).
    const sunset = d.sunset && !(d.end && parseTime(d.sunset) > parseTime(d.end.time)) ? parseTime(d.sunset) : null;
    const evening = sunset !== null || extras.length ? { sunset, extras } : null;
    const sum = (f) => legs.filter(f).reduce((a, l) => a + (l.minutes || 0), 0);
    const starts = timeline.map((t) => t.start).filter((t) => t !== null), ends = timeline.map((t) => t.end ?? t.start).filter((t) => t !== null);
    const stats = { stops: stops.length, visitMin: stops.reduce((a, s) => a + s.minutes, 0), walkMin: sum((l) => l.mode === 'walk'), transitMin: sum((l) => l.transit), walkEstimated: legs.some((l) => l.mode === 'walk' && l.estimated), transitEstimated: legs.some((l) => l.transit && l.estimated), spareMin: Number.isInteger(d.spare_minutes) ? d.spare_minutes : null, driveMin: sum((l) => ['drive', 'taxi', 'bike'].includes(l.mode)), firstStart: starts.length ? Math.min(...starts) : null, lastEnd: ends.length ? Math.max(...ends) : null };
    for (const t of timeline) if ((t.kind === 'stop' || t.kind === 'meal') && t.place && !cardSeen.has(t.place.id)) { cardSeen.add(t.place.id); cardOrder.push({ place: t.place, day: i + 1, n: t.kind === 'stop' ? t.n : null, mealKind: t.kind === 'meal' ? t.meal : null }); }
    const alternatives = d.alternatives ? { title: d.alternatives.title || 'If it rains', items: d.alternatives.items.map((x) => ({ ...x, place: places[x.place] })) } : null;
    return { ...d, c18, index: i + 1, weekday: WEEKDAYS[parseDate(d.date).getUTCDay()], lodging, stops, meals, free, legs, timeline, stats, warnings: d.warnings || [], alternatives, evening };
  });
  // An evening extra links to a place card only when that place has one (cards are for the stops and meals).
  for (const d of days) if (d.evening) for (const x of d.evening.extras) x.hasCard = Boolean(x.place && cardSeen.has(x.place.id));
  for (const d of days) for (const f of d.free) for (const o of f.options || []) o.hasCard = Boolean(o.place && cardSeen.has(o.place.id));
  const later = (m.later || []).map((l) => ({ ...l, items: l.items.map((it) => ({ ...it, place: it.place ? places[it.place] : null })) }));
  const hasImg = (x) => Boolean(x && typeof x.src === 'string' && x.src.trim());
  const google = { maps: hasImg(m.trip.map_image) || days.some((d) => hasImg(d.map_image)), photos: Object.values(places).some((p) => hasImg(p.google_photo)) };
  const anyGoogle = Object.values(places).some((p) => p.google) || google.maps;
  const attribution = { ...(m.attribution || {}), google: m.attribution && m.attribution.google !== undefined ? m.attribution.google : anyGoogle, reviews: Object.values(places).flatMap((p) => (p.reviews || []).map((r) => ({ ...r, place: p }))), ...google };
  return { trip: m.trip, locale, c18, temp: m.trip.temp || 'c', places, days, cards: cardOrder, later, practical: m.practical || [], attribution, season: m.season || null, span: daySpan(m.trip.start_date, m.trip.end_date), dates: Array.from({ length: daySpan(m.trip.start_date, m.trip.end_date) }, (_, i) => addDays(m.trip.start_date, i)) };
}

// Developed by: LightAISolutions

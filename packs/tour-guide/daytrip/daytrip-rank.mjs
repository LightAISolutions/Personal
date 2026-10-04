/**
 * Tour Guide — Day trip: the board's ranking (TG-PHASE-15 WP-15a). Pure; no clock, no network.
 *   reachPart(minutes, maxMinutes) → 100 up to 30 minutes, linear to 40 at maxMinutes, null beyond it (or unknown)
 *   rankDayTrips(candidates, { maxMinutes, date?, tripDays? }) → { items (≤ 8, numbered), more, left_out (≤ 20) }
 * A candidate is the private driver's record: { slug, name, area?, ride: { minutes, estimated, from_station?, to_station? }
 * | null, length, why, see, eat?, food: confirmed | likely | unknown | none, season: in | neutral | out, season_line?,
 * closed: [dates], fit: 0–100, labels?, stops, place_id?, maps_url }. Only our own words, scores and ids go out: an item
 * is rebuilt field by field, so nothing else the record carries reaches the payload.
 * Screens, in order: duplicate (the same slug, or the same name ignoring case and accents; the first one stays) · no_rail
 * (ride null) · too_far (reachPart null) · closed_on_dates (closed on the asked date, or without one on every trip day) ·
 * out_of_season. Score: round(0.45·fit + 0.25·reach + 0.15·season + 0.15·food); ties to the shorter ride, then the name.
 */
export const WEIGHTS = Object.freeze({ fit: 0.45, reach: 0.25, season: 0.15, food: 0.15 });
export const SEASON_PART = Object.freeze({ in: 100, neutral: 60, out: 0 });
export const FOOD_PART = Object.freeze({ confirmed: 100, likely: 70, unknown: 40, none: 0 });
export const REACH = Object.freeze({ full_minutes: 30, floor: 40 });
export const ITEMS_MAX = 8;
export const MORE_MAX = 50;
export const LEFT_MAX = 20;
export const LABELS = Object.freeze(['gem', 'veg_easy', 'booking', 'crowded', 'rain_ok', 'seen_before']);
export const LABELS_MAX = 4;
export const REASONS = Object.freeze(['too_far', 'no_rail', 'closed_on_dates', 'out_of_season', 'duplicate', 'other']);
export const LENGTHS = Object.freeze(['half', 'full']);
const SEE_MAX = 4, STOPS_MAX = 6, CLOSED_MAX = 7;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (s, max) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
/** A name for the duplicate screen: lower case, accents and punctuation gone. */
export const normName = (s) => String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function reachPart(minutes, maxMinutes) {
  if (!Number.isFinite(minutes) || !Number.isFinite(maxMinutes) || minutes > maxMinutes) return null;
  if (minutes <= REACH.full_minutes) return 100;
  return 100 - ((100 - REACH.floor) * (minutes - REACH.full_minutes)) / (maxMinutes - REACH.full_minutes);
}

function labelsOf(c) {
  const confirmed = c.food === 'confirmed';
  const own = [...new Set((Array.isArray(c.labels) ? c.labels : []).filter((l) => LABELS.includes(l) && l !== 'veg_easy'))];
  const keep = confirmed ? own.slice(0, LABELS_MAX - 1).concat(['veg_easy']) : own.slice(0, LABELS_MAX);
  return LABELS.filter((l) => keep.includes(l));
}

function itemOf(c, reach, closed) {
  const r = c.ride;
  const ride = { minutes: clamp(Math.round(r.minutes), 1, 600), estimated: r.estimated === true };
  if (typeof r.from_station === 'string' && r.from_station.trim()) ride.from_station = text(r.from_station, 80);
  if (typeof r.to_station === 'string' && r.to_station.trim()) ride.to_station = text(r.to_station, 80);
  const it = { slug: c.slug, name: text(c.name, 120) };
  if (typeof c.area === 'string' && c.area.trim()) it.area = text(c.area, 80);
  it.ride = ride;
  it.length = c.length === 'half' ? 'half' : 'full';
  it.why = text(c.why, 200);
  it.see = (Array.isArray(c.see) ? c.see : []).map((s) => text(s, 80)).filter(Boolean).slice(0, SEE_MAX);
  if (typeof c.eat === 'string' && c.eat.trim()) it.eat = text(c.eat, 160);
  if (typeof c.season_line === 'string' && c.season_line.trim()) it.season = text(c.season_line, 120);
  if (closed.length) it.closed = closed.slice(0, CLOSED_MAX);
  const parts = { fit: clamp(Math.round(Number(c.fit) || 0), 0, 100), reach: Math.round(reach), season: SEASON_PART[c.season] ?? SEASON_PART.neutral, food: FOOD_PART[c.food] ?? FOOD_PART.unknown };
  const raw = WEIGHTS.fit * parts.fit + WEIGHTS.reach * reach + WEIGHTS.season * parts.season + WEIGHTS.food * parts.food;
  it.score = clamp(Math.round(raw), 0, 100);
  it.parts = parts;
  it.labels = labelsOf(c);
  it.stops = (Array.isArray(c.stops) ? c.stops : []).filter(isObj).map((s) => {
    const o = { name: text(s.name, 120) };
    if (typeof s.place_id === 'string' && PLACE_ID_RE.test(s.place_id)) o.place_id = s.place_id;
    return o;
  }).filter((s) => s.name).slice(0, STOPS_MAX);
  if (typeof c.place_id === 'string' && PLACE_ID_RE.test(c.place_id)) it.place_id = c.place_id;
  it.maps_url = String(c.maps_url || '');
  return it;
}

export function rankDayTrips(candidates, { maxMinutes, date = null, tripDays = [] } = {}) {
  const days = Array.isArray(tripDays) ? tripDays : [];
  const slugs = new Set(), names = new Set(), left = [], pass = [];
  const out = (c, reason) => left.push({ name: text(isObj(c) ? c.name || c.slug || 'unnamed' : 'unnamed', 120) || 'unnamed', reason });
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (!isObj(c)) continue;
    const nm = normName(c.name);
    if (slugs.has(c.slug) || (nm && names.has(nm))) { out(c, 'duplicate'); continue; }
    slugs.add(c.slug); if (nm) names.add(nm);
    if (!isObj(c.ride) || !Number.isFinite(c.ride.minutes)) { out(c, 'no_rail'); continue; }
    const reach = reachPart(c.ride.minutes, maxMinutes);
    if (reach === null) { out(c, 'too_far'); continue; }
    const closedAll = (Array.isArray(c.closed) ? c.closed : []).filter((d) => typeof d === 'string');
    const shut = date ? closedAll.includes(date) : days.length > 0 && days.every((d) => closedAll.includes(d));
    if (shut) { out(c, 'closed_on_dates'); continue; }
    if (c.season === 'out') { out(c, 'out_of_season'); continue; }
    const closed = date ? [] : [...new Set(closedAll.filter((d) => days.includes(d)))].sort();
    pass.push(itemOf(c, reach, closed));
  }
  pass.sort((a, b) => b.score - a.score || a.ride.minutes - b.ride.minutes || (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0));
  const items = pass.slice(0, ITEMS_MAX).map((it, i) => ({ n: i + 1, ...it }));
  return { items, more: Math.min(MORE_MAX, Math.max(0, pass.length - ITEMS_MAX)), left_out: left.slice(0, LEFT_MAX) };
}

// Developed by: LightAISolutions

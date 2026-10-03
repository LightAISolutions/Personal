/**
 * Tour Guide planner — the journey outline as planner input (Phase 11 wave 2, WP-11e).
 *   input.outline = { by_date: { <date>: { kind, area?: { name, lat, lng, radius_km? }, anchors?: [slug ≤ 3] } } }
 * kind: full (as today) · light (at most OUTLINE.LIGHT_STOPS stops) · travel (a moving day: its override's start, end and
 * bag step stand, as today) · rain_spare (a light day of indoor and covered places) · free (no stops).
 * area: that day's stops lie within radius_km (default AREA_KM by the day's mode) of its centre, in a straight line.
 * anchors: those places are scheduled on that date (pinned like a booking, priority 1, exempt from the area and the
 * "too far" screen); an anchor that is a dinner place (offered in input.dinners) is that evening's preferred dinner.
 * A date without an entry plans as without an outline. Without `outline` nothing here runs.
 *   normalizeOutline(raw, dates) → null | { byDate: Map(date → { kind, area, anchors }) }   (throws `planner:` errors)
 *   applyOutline(ctx, outline, places) — marks ctx.days, ctx.cands; fills ctx.outlineNotes and ctx.preferDinner
 *   outlineCode(c, day) → null | 'outline_kind' | 'outside_area'   (why an outline day cannot take a non-anchor place)
 *   outlineCap(day, cap) → that day's stop capacity under the outline
 */
import { haversineKm, isLoc } from './planner-geo.mjs';
import { isIndoor, isCoveredSight } from './planner-rain.mjs';

export const OUTLINE_KINDS = Object.freeze(['full', 'light', 'travel', 'rain_spare', 'free']);
/** Default area radius (km, straight line from the centre) by the day's mode, and the stops a light day takes. */
export const AREA_KM = Object.freeze({ WALK: 2, TRANSIT: 6, DRIVE: 30 });
export const OUTLINE = Object.freeze({ LIGHT_STOPS: 3, MAX_ANCHORS: 3, RADIUS_MIN: 0.2, RADIUS_MAX: 100 });
/** The free line of a free day (the early-return line on other days). */
export const FREE_DAY_NOTE = 'a free day: nothing planned';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const fail = (m) => { throw new Error('planner: ' + m); };

export function normalizeOutline(raw, dates) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('outline must be an object { by_date }');
  const extra = Object.keys(raw).filter((k) => k !== 'by_date');
  if (extra.length) fail(`outline has unknown key(s) ${extra.join(', ')}`);
  const bd = raw.by_date;
  if (!bd || typeof bd !== 'object' || Array.isArray(bd)) fail('outline.by_date must be an object keyed by date');
  const byDate = new Map(), anchored = new Map();
  for (const date of Object.keys(bd).sort()) {
    if (!dates.includes(date)) fail(`outline.by_date names ${date}, which is not a trip date`);
    const o = bd[date], at = `outline.by_date.${date}`;
    if (!o || typeof o !== 'object' || Array.isArray(o)) fail(`${at} must be an object`);
    const bad = Object.keys(o).filter((k) => !['kind', 'area', 'anchors'].includes(k));
    if (bad.length) fail(`${at} has unknown key(s) ${bad.join(', ')}`);
    if (!OUTLINE_KINDS.includes(o.kind)) fail(`${at}.kind must be one of ${OUTLINE_KINDS.join(', ')}`);
    let area = null;
    if (o.area !== undefined && o.area !== null) {
      const a = o.area;
      if (!a || typeof a !== 'object' || Array.isArray(a)) fail(`${at}.area must be an object`);
      const ak = Object.keys(a).filter((k) => !['name', 'lat', 'lng', 'radius_km'].includes(k));
      if (ak.length) fail(`${at}.area has unknown key(s) ${ak.join(', ')}`);
      if (typeof a.name !== 'string' || !a.name.trim() || a.name.length > 60) fail(`${at}.area.name must be 1–60 characters`);
      if (!isLoc(a) || Math.abs(a.lat) > 90 || Math.abs(a.lng) > 180) fail(`${at}.area needs lat and lng`);
      if (a.radius_km !== undefined && !(Number.isFinite(a.radius_km) && a.radius_km >= OUTLINE.RADIUS_MIN && a.radius_km <= OUTLINE.RADIUS_MAX)) fail(`${at}.area.radius_km must be ${OUTLINE.RADIUS_MIN}–${OUTLINE.RADIUS_MAX}`);
      area = { name: a.name.trim(), lat: a.lat, lng: a.lng, radius_km: Number.isFinite(a.radius_km) ? a.radius_km : null };
    }
    const anchors = o.anchors === undefined ? [] : o.anchors;
    if (!Array.isArray(anchors) || anchors.length > OUTLINE.MAX_ANCHORS) fail(`${at}.anchors must be an array of at most ${OUTLINE.MAX_ANCHORS} place slugs`);
    for (const s of anchors) {
      if (typeof s !== 'string' || !SLUG_RE.test(s)) fail(`${at}.anchors holds ${JSON.stringify(s)}, not a place slug`);
      if (anchored.has(s)) fail(`${s} is an anchor on ${anchored.get(s)} and ${date}`);
      anchored.set(s, date);
    }
    if (o.kind === 'free' && anchors.length) fail(`${at}: a free day has no anchors`);
    byDate.set(date, { kind: o.kind, area, anchors: [...anchors] });
  }
  return { byDate };
}

/**
 * Mark the planner's working records: day.outline = { kind, area (with its radius), anchors }; an anchor candidate gets
 * `anchor` (its date) and priority 1; on a rain-spare day every candidate's `covered` flag is known. An anchor that is
 * no candidate: a dinner place offered in input.dinners becomes that evening's preferred dinner (ctx.preferDinner),
 * anything else is a day warning (ctx.outlineNotes) — never an error.
 */
export function applyOutline(ctx, outline, { places, dinners }) {
  const byId = new Map(places.map((p) => [p && p.id, p]));
  const dinnerIds = new Set((Array.isArray(dinners) ? dinners : []).filter((p) => p && p.id).map((p) => p.id));
  const cands = new Map(ctx.cands.map((c) => [c.id, c]));
  ctx.outlineNotes = {};
  ctx.preferDinner = new Map();
  for (const day of ctx.days) {
    const o = outline.byDate.get(day.date);
    if (!o) continue;
    const area = o.area ? { ...o.area, radius_km: o.area.radius_km || AREA_KM[day.mode] } : null;
    day.outline = { kind: o.kind, area, anchors: o.anchors };
    for (const slug of o.anchors) {
      const c = cands.get(slug);
      if (c) { c.anchor = day.date; c.priority = 1; continue; }
      if (dinnerIds.has(slug)) { ctx.preferDinner.set(day.date, slug); continue; }
      const p = byId.get(slug);
      (ctx.outlineNotes[day.date] ||= []).push(`${p ? p.name : slug} was meant for this day but is not on your list of places to plan`.slice(0, 200));
    }
  }
  if ([...outline.byDate.values()].some((o) => o.kind === 'rain_spare')) {
    for (const c of ctx.cands) { const p = byId.get(c.id); c.covered = !!p && (isIndoor(p) === true || isCoveredSight(p)); }
  }
}

/** Why an outline day cannot take a (non-anchor) candidate, or null. */
export function outlineCode(c, day) {
  const o = day.outline;
  if (!o || c.anchor) return null;
  if (o.kind === 'free') return 'outline_kind';
  if (o.kind === 'rain_spare' && !c.covered) return 'outline_kind';
  if (o.area && (!c.loc || haversineKm(c.loc, o.area) > o.area.radius_km)) return 'outside_area';
  return null;
}

/** A day's stop capacity under the outline (free 0; light and rain-spare at most OUTLINE.LIGHT_STOPS). */
export function outlineCap(day, cap) {
  const o = day.outline;
  if (!o) return cap;
  if (o.kind === 'free') return 0;
  if (o.kind === 'light' || o.kind === 'rain_spare') return Math.min(cap, OUTLINE.LIGHT_STOPS);
  return cap;
}

// Developed by: LightAISolutions

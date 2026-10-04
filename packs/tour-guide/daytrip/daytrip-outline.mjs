/**
 * Tour Guide — Day trip: a kept trip as the planner's outline entry (TG-PHASE-15 WP-15a). Pure.
 *   dayTripOutlineEntry({ name, center: { lat, lng }, anchors }) → { kind: 'full', area: { name, lat, lng, radius_km: 3 }, anchors }
 * The private side plans a kept trip's day with it (planner/planner-outline.mjs normalizeOutline reads it): the day's stops
 * lie within 3 km of the destination's centre, and its first 3 stops (place slugs) are pinned to that date.
 */
export const DAYTRIP_RADIUS_KM = 3;
export const ANCHORS_MAX = 3;
const AREA_NAME_MAX = 60;   // planner-outline's area.name limit
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function dayTripOutlineEntry({ name, center, anchors = [] } = {}) {
  const ok = center && Number.isFinite(center.lat) && Number.isFinite(center.lng) && Math.abs(center.lat) <= 90 && Math.abs(center.lng) <= 180;
  if (!ok) throw new Error('daytrip: dayTripOutlineEntry needs center { lat, lng }');
  let label = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!label) throw new Error('daytrip: dayTripOutlineEntry needs a name');
  if (label.length > AREA_NAME_MAX) label = label.slice(0, AREA_NAME_MAX - 1).trimEnd() + '…';
  const pins = [...new Set((Array.isArray(anchors) ? anchors : []).filter((s) => typeof s === 'string' && SLUG_RE.test(s)))].slice(0, ANCHORS_MAX);
  return { kind: 'full', area: { name: label, lat: center.lat, lng: center.lng, radius_km: DAYTRIP_RADIUS_KM }, anchors: pins };
}

// Developed by: LightAISolutions

/**
 * Gem Funnel — straight-line geometry for the off-track test. Distances run from a place to OUR OWN geocoded anchors
 * (stations, squares, the lodging) only; there is no point-in-polygon test on any Google coordinate (Maps terms
 * §3.2.3(c)(iv), proposal §2 fact 7).
 */
import { MODE_SPEEDS_KMH, MODES_DEFAULT } from './gems-weights.mjs';

const R_KM = 6371.0088;
const rad = (d) => (d * Math.PI) / 180;

export function isLatLng(p) { return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180; }

/** haversineKm({lat,lng}, {lat,lng}) → great-circle kilometres. */
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** straightLineMinutes(km, modes) → minutes at the fastest of the trip's modes (conservative speeds, MODE_SPEEDS_KMH). */
export function straightLineMinutes(km, modes = MODES_DEFAULT) {
  const speeds = (modes || []).map((m) => MODE_SPEEDS_KMH[m]).filter((s) => s > 0);
  if (!speeds.length) throw new Error(`gems: no usable travel mode in ${JSON.stringify(modes)} (use ${Object.keys(MODE_SPEEDS_KMH).join(', ')})`);
  return (km / Math.max(...speeds)) * 60;
}

/** minutesToNearestAnchor(location, anchors, modes) → the smallest straight-line estimate, or null without anchors. */
export function minutesToNearestAnchor(location, anchors, modes = MODES_DEFAULT) {
  if (!isLatLng(location) || !Array.isArray(anchors) || !anchors.length) return null;
  let best = Infinity;
  for (const a of anchors) {
    if (!isLatLng(a)) throw new Error('gems: every anchor needs numeric lat and lng');
    best = Math.min(best, straightLineMinutes(haversineKm(location, a), modes));
  }
  return best;
}

// Developed by: LightAISolutions

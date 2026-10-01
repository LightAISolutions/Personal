/** Tour Guide planner — great-circle distance for clustering and the "too far" screen (no API call). */
const R_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;
export function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function centroid(points) {
  const ps = points.filter(Boolean);
  if (!ps.length) return null;
  return { lat: ps.reduce((s, p) => s + p.lat, 0) / ps.length, lng: ps.reduce((s, p) => s + p.lng, 0) / ps.length };
}
export const isLoc = (p) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

// Developed by: LightAISolutions

/**
 * Tour Guide fixtures — geometry: great-circle distance and snapping a lat/lng to the nearest snapshot.
 */
const R = 6371008.8; // mean Earth radius, metres
const rad = (d) => (d * Math.PI) / 180;

/** haversineMeters({lat,lng}, {lat,lng}) → metres along the great circle. */
export function haversineMeters(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** nearestSnapshot(snapshots, {lat,lng}, maxMeters = 50) → the closest snapshot with a location within maxMeters, or null. */
export function nearestSnapshot(snapshots, point, maxMeters = 50) {
  let best = null, bestD = Infinity;
  for (const s of snapshots) {
    if (!s.location) continue;
    const d = haversineMeters(point, s.location);
    if (d < bestD) { best = s; bestD = d; }
  }
  return bestD <= maxMeters ? best : null;
}

// Developed by: LightAISolutions

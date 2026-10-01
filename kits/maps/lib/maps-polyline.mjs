/**
 * Maps kit — Google's encoded polyline format (the `encodedPolyline` the Routes API returns and the `enc:` form
 * the Maps Static API accepts). encode([{lat,lng}], precision) ↔ decode(string, precision), plus a Douglas–Peucker
 * simplifier used to keep static-map URLs under their length limit. Pure functions, no I/O.
 */

/** encodePolyline([{ lat, lng }], precision = 5) → string ('' for no points). */
export function encodePolyline(points, precision = 5) {
  const f = 10 ** precision;
  let out = '', lastLat = 0, lastLng = 0;
  const chunk = (v) => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
  for (const p of points) {
    const lat = Math.round(p.lat * f), lng = Math.round(p.lng * f);
    out += chunk(lat - lastLat) + chunk(lng - lastLng);
    lastLat = lat; lastLng = lng;
  }
  return out;
}
/** decodePolyline(string, precision = 5) → [{ lat, lng }]; throws on a malformed string. */
export function decodePolyline(str, precision = 5) {
  const f = 10 ** precision, out = [];
  let i = 0, lat = 0, lng = 0;
  const next = () => {
    let shift = 0, result = 0, b;
    do { if (i >= str.length) throw new Error('maps: malformed encoded polyline'); b = str.charCodeAt(i++) - 63; if (b < 0 || b > 63) throw new Error('maps: malformed encoded polyline'); result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) { lat += next(); lng += next(); out.push({ lat: lat / f, lng: lng / f }); }
  return out;
}
/** Perpendicular distance of p from segment a–b in degrees (lat/lng treated as a plane; fine for simplification). */
function segDist(p, a, b) {
  const dx = b.lng - a.lng, dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) return Math.hypot(p.lng - a.lng, p.lat - a.lat);
  const t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.lng - (a.lng + t * dx), p.lat - (a.lat + t * dy));
}
/** simplifyPoints(points, toleranceDeg) — Douglas–Peucker; endpoints always kept. */
export function simplifyPoints(points, tol) {
  if (points.length <= 2 || !(tol > 0)) return points.slice();
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let best = -1, bi = -1;
    for (let i = s + 1; i < e; i++) { const d = segDist(points[i], points[s], points[e]); if (d > best) { best = d; bi = i; } }
    if (best > tol) { keep[bi] = true; stack.push([s, bi], [bi, e]); }
  }
  return points.filter((_, i) => keep[i]);
}

// Developed by: LightAISolutions

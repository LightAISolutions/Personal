/**
 * Brochure kit — the one build step that talks to Google: addGoogleImages(model, { client }) returns a NEW model with
 *   · each day's `map_image` and the trip's `map_image`: a Google Maps Static API image at a known centre and zoom, with
 *     the day's routes drawn by Google in the day's hue (the renderer adds the numbered markers on top);
 *   · each place's `google_photo.src`: the Place Photo named in `google_photo.name`, with its author credit;
 *   · missing leg `polyline`s, from Compute Routes, so route lines follow streets instead of cutting across blocks.
 * Every image is inlined as a data URI, so nothing is written to disk and nothing outlives the build (Google content
 * is build-scoped: the delivered brochure is the only copy). The renderer stays offline.
 * `client` is duck-typed (the maps kit's createMapsClient): staticMap(spec), placePhoto(name, opts), computeRoutes(opts).
 * Any failure degrades to the drawn sketch / no photo / a straight line, with a warning; it never throws for Google.
 */
import { prepare } from './model.mjs';
import { daySequence, tripSequence, fitView, MAP_PAD } from './mapframe.mjs';
import { dayHue } from './tokens.mjs';

export const DAY_MAP = Object.freeze({ width: 260, height: 320 });
export const TRIP_MAP = Object.freeze({ width: 420, height: 300 });
/** Keep Google's map, hide anything that would compete with the brochure's own markers: business and medical POIs,
 *  every other POI's pin icon (names and park greens stay), and road shields (green numbered highway shields read as
 *  numbered stops on a green day). */
export const MAP_STYLES = Object.freeze(['feature:poi.business|visibility:off', 'feature:poi.medical|visibility:off', 'feature:poi|element:labels.icon|visibility:off', 'feature:road|element:labels.icon|visibility:off']);
const ROUTE_MODE = { walk: 'WALK', drive: 'DRIVE', taxi: 'DRIVE', bike: 'BICYCLE', transit: 'TRANSIT', train: 'TRANSIT' };
const hex = (i, alpha = 'E6') => '0x' + dayHue(i)[0].slice(1).toUpperCase() + alpha;
const ok = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
const dataUri = (r) => `data:${r.contentType || 'image/png'};base64,${Buffer.from(r.bytes).toString('base64')}`;

/** decode Google's encoded polyline (precision 5). Local copy so the brochure kit does not import the maps kit. */
export function decodePolyline(str) {
  const out = [];
  let i = 0, lat = 0, lng = 0;
  const next = () => { let r = 0, s = 0, b; do { if (i >= str.length) throw new Error('bad polyline'); b = str.charCodeAt(i++) - 63; if (b < 0 || b > 63) throw new Error('bad polyline'); r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < str.length) { lat += next(); lng += next(); out.push({ lat: lat / 1e5, lng: lng / 1e5 }); }
  if (out.some((p) => Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)) throw new Error('bad polyline');
  return out;
}
const usable = (s) => { try { return decodePolyline(s).length >= 2; } catch { return false; } };
function hopPoints(points, pair) {
  const a = points[pair.from], b = points[pair.to];
  if (pair.leg && typeof pair.leg.polyline === 'string' && pair.leg.polyline) { try { const pts = decodePolyline(pair.leg.polyline); if (pts.length >= 2) return { pts, poly: pair.leg.polyline }; } catch { /* fall through */ } }
  return { pts: [a, b], poly: null };
}
/** One static map: fit every marker and route point, request it centred and zoomed exactly, return a mapImage. */
async function fetchMap(client, { points, hops, size, alt }) {
  const all = points.filter(ok).concat(hops.flatMap((h) => h.pts));
  const view = fitView(all, size);
  if (!view) return null;
  const paths = hops.filter((h) => h.pts.length >= 2).map((h) => (h.poly ? { polyline: h.poly, color: h.color, weight: h.weight } : { points: h.pts.map((p) => ({ lat: p.lat, lng: p.lng })), color: h.color, weight: h.weight }));
  const r = await client.staticMap({ width: size.width, height: size.height, scale: 2, format: 'png', center: view.center, zoom: view.zoom, paths, styles: [...MAP_STYLES] });
  return { src: dataUri(r), alt, credit: 'Map data © Google', view };
}

/**
 * addGoogleImages(model, { client, maps = true, photos = true, routes = true, photoWidth = 900, maxPhotos = 40 })
 *   → { model, stats: { maps, photos, routes }, warnings }
 * The input is not mutated. The model must already be valid (prepare() throws ModelError otherwise).
 */
export async function addGoogleImages(input, { client, maps = true, photos = true, routes = true, photoWidth = 900, maxPhotos = 40 } = {}) {
  if (!client) throw new Error('brochure: addGoogleImages needs a maps client');
  const m = JSON.parse(JSON.stringify(input));
  const warnings = [], stats = { maps: 0, photos: 0, routes: 0 };
  const warn = (what, e) => warnings.push(`${what}: ${String(e && e.message || e).slice(0, 200)}`);

  // 1. route polylines for legs that have none (Compute Routes; one call per leg, Essentials SKU)
  if (routes && typeof client.computeRoutes === 'function') {
    const p = prepare(m);
    for (const [i, d] of p.days.entries()) {
      const { points, pairs } = daySequence(d);
      for (const q of pairs) {
        const t = q.leg, mode = ROUTE_MODE[q.mode];
        if (!t || t.polyline || !mode || !ok(points[q.from]) || !ok(points[q.to])) continue;
        try {
          const r = await client.computeRoutes({ origin: { lat: points[q.from].lat, lng: points[q.from].lng }, destination: { lat: points[q.to].lat, lng: points[q.to].lng }, travelMode: mode });
          const poly = r && r.route && r.route.polyline;
          if (poly && usable(poly)) { m.days[i].legs[t.j].polyline = poly; stats.routes++; }
          else warnings.push(`day ${i + 1} route ${t.j + 1}: no usable route line (straight line kept)`);
        } catch (e) { warn(`day ${i + 1} route ${t.j + 1}`, e); }
      }
    }
  }

  // 2. static maps: one per day, one for the whole trip
  if (maps && typeof client.staticMap === 'function') {
    const p = prepare(m);
    for (const [i, d] of p.days.entries()) {
      const { points, pairs } = daySequence(d);
      const hops = pairs.map((q) => ({ ...hopPoints(points, q), color: hex(i), weight: q.mode === 'walk' ? 4 : 5 }));
      try {
        const img = await fetchMap(client, { points, hops, size: DAY_MAP, alt: `Map of day ${i + 1}: ${d.theme || ''}`.trim() });
        if (img) { m.days[i].map_image = img; stats.maps++; }
      } catch (e) { warn(`day ${i + 1} map`, e); }
    }
    const t = tripSequence(p, (i) => i);
    const dayPairs = p.days.map((d) => daySequence(d));
    const hops = [];
    p.days.forEach((d, i) => { const s = dayPairs[i]; for (const q of s.pairs) hops.push({ ...hopPoints(s.points, q), color: hex(i, 'CC'), weight: 3 }); });
    try {
      const img = await fetchMap(client, { points: t.points, hops, size: TRIP_MAP, alt: `Map of all ${p.days.length} days` });
      if (img) { m.trip.map_image = img; stats.maps++; }
    } catch (e) { warn('trip map', e); }
  }

  // 3. place photos (one Place Photos call each; the image download itself is not a Places call)
  if (photos && typeof client.placePhoto === 'function') {
    const order = prepare(m).cards.map((c) => c.place.id);
    for (const id of order) {
      const g = m.places[id] && m.places[id].google_photo;
      if (!g || g.src || !g.name || m.places[id].image) continue;
      if (stats.photos >= maxPhotos) { warnings.push(`photos: stopped at ${maxPhotos}`); break; }
      try {
        const r = await client.placePhoto(g.name, { maxWidthPx: photoWidth });
        const a = (r.authorAttributions || [])[0] || {};
        m.places[id].google_photo = { ...g, src: dataUri(r), author: g.author || a.displayName || undefined, author_url: g.author_url || a.uri || undefined };
        for (const k of ['author', 'author_url']) if (m.places[id].google_photo[k] === undefined) delete m.places[id].google_photo[k];
        stats.photos++;
      } catch (e) { warn(`photo for ${id}`, e); }
    }
  }
  return { model: m, stats, warnings };
}

// Developed by: LightAISolutions

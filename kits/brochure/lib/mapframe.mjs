/**
 * Brochure kit — real maps. A map image fetched during the build (Google Maps Static API, see google-images.mjs) is
 * shown with the brochure's own markers projected on top, so a Google map and a drawn sketch carry the same numbered
 * badges, meal rings and lodging houses. The image is requested at a known centre and zoom (`view`), which makes the
 * Web Mercator projection exact; the routes are drawn by Google into the image, the markers by us. Pure functions.
 * The bottom strip of the image (Google logo and copyright) is kept clear by the padding and is never covered.
 */
import { esc, attr } from './escape.mjs';
import { markersSvg } from './sketch.mjs';

const TILE = 256;
/** World pixel coordinates of {lat,lng} at zoom z (Web Mercator, as the Static Maps API renders). */
export function mercator(lat, lng, z) {
  const s = TILE * 2 ** z, phi = (Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180;
  return [((lng + 180) / 360) * s, (0.5 - Math.log((1 + Math.sin(phi)) / (1 - Math.sin(phi))) / (4 * Math.PI)) * s];
}
function unmercator(x, y, z) {
  const s = TILE * 2 ** z;
  const lng = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng };
}
export const MAP_PAD = Object.freeze({ top: 26, right: 26, bottom: 40, left: 26 });
const ok = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/**
 * fitView(points, { width, height, pad, maxZoom = 17, minZoom = 1 }) → { center:{lat,lng}, zoom, width, height } | null.
 * The highest integer zoom at which every point fits inside the padded box; the centre is shifted so the padding can be
 * uneven (more room at the bottom for Google's attribution).
 */
export function fitView(points, { width, height, pad = MAP_PAD, maxZoom = 17, minZoom = 1 } = {}) {
  const pts = points.filter(ok);
  if (!pts.length) return null;
  const inner = [width - pad.left - pad.right, height - pad.top - pad.bottom];
  let zoom = minZoom;
  for (let z = maxZoom; z >= minZoom; z--) {
    const xy = pts.map((p) => mercator(p.lat, p.lng, z));
    const w = Math.max(...xy.map((q) => q[0])) - Math.min(...xy.map((q) => q[0]));
    const h = Math.max(...xy.map((q) => q[1])) - Math.min(...xy.map((q) => q[1]));
    if (w <= inner[0] && h <= inner[1]) { zoom = z; break; }
  }
  const xy = pts.map((p) => mercator(p.lat, p.lng, zoom));
  const midX = (Math.max(...xy.map((q) => q[0])) + Math.min(...xy.map((q) => q[0]))) / 2;
  const midY = (Math.max(...xy.map((q) => q[1])) + Math.min(...xy.map((q) => q[1]))) / 2;
  const c = unmercator(midX + (pad.right - pad.left) / 2, midY + (pad.bottom - pad.top) / 2, zoom);
  return { center: { lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) }, zoom, width, height };
}
/** projector(view) → (p) → [x, y] in the image's logical pixels (0..width, 0..height). */
export function projector(view) {
  const [cx, cy] = mercator(view.center.lat, view.center.lng, view.zoom);
  return (p) => { const [x, y] = mercator(p.lat, p.lng, view.zoom); return [view.width / 2 + (x - cx), view.height / 2 + (y - cy)]; };
}

/**
 * daySequence(d) → { points, pairs } for one prepared day: the lodging, then every place on the timeline in clock
 * order (stops numbered, meals as rings), and the hops between them with the leg that covers each hop (if any).
 * The same sequence feeds the drawn sketch, the Google map's route lines and the marker overlay.
 */
export function daySequence(d) {
  const points = [], pairs = [], idx = new Map();
  const add = (key, p, extra) => { if (!idx.has(key)) { idx.set(key, points.length); points.push({ lat: p.lat, lng: p.lng, ...extra }); } return idx.get(key); };
  if (d.lodging) add('lodging', d.lodging, { kind: 'lodging', label: 'inn' });
  let prev = d.lodging ? 0 : null, mode = 'walk', leg = null;
  for (const t of d.timeline) {
    if (t.kind === 'leg') {
      mode = t.mode; leg = t;
      if (t.to === 'lodging' && d.lodging && prev !== 0) { pairs.push({ from: prev, to: 0, mode, leg }); prev = 0; leg = null; }
      continue;
    }
    // C11: a day's real start or end point (an arrival or a departure) is drawn as a labelled diamond
    if ((t.kind === 'start' || t.kind === 'end') && t.point && Number.isFinite(t.point.lat) && Number.isFinite(t.point.lng)) {
      const k = add(`day-${t.kind}`, t.point, { kind: 'point', label: t.kind });
      if (t.kind === 'end' && prev !== null && prev !== k) pairs.push({ from: prev, to: k, mode, leg });
      prev = k; mode = 'walk'; leg = null;
      continue;
    }
    if (!t.place || !Number.isFinite(t.place.lat)) continue;
    const k = add(t.place.id, t.place, { kind: t.kind === 'stop' ? 'stop' : 'meal', n: t.n });
    if (prev !== null && prev !== k) pairs.push({ from: prev, to: k, mode, leg });
    prev = k; mode = 'walk'; leg = null;
  }
  return { points, pairs };
}
/** tripSequence(m, hueOf) → { points, pairs } for the whole trip: lodgings, each day's first stop numbered, the rest rings. */
export function tripSequence(m, hueOf) {
  const points = [], pairs = [], idx = new Map();
  const add = (key, p, extra) => { if (!idx.has(key)) { idx.set(key, points.length); points.push({ lat: p.lat, lng: p.lng, ...extra }); } return idx.get(key); };
  (m.trip.lodging || []).forEach((l) => add('lodging:' + l.name, l, { kind: 'lodging', label: l.name }));
  m.days.forEach((d, i) => {
    let prev = d.lodging ? idx.get('lodging:' + d.lodging.name) : null, first = true;
    d.timeline.forEach((t) => {
      if (!t.place) return;
      const k = add(t.place.id || t.place.name, t.place, { kind: t.kind === 'stop' && first ? 'stop' : 'meal', n: d.index, hue: hueOf(i) });
      if (t.kind === 'stop') first = false;
      if (prev !== null && prev !== undefined && prev !== k) pairs.push({ from: prev, to: k, mode: 'other', hue: hueOf(i), day: i });
      prev = k;
    });
  });
  return { points, pairs };
}

/**
 * mapFigure({ src, image, points, hue, title, caption }) → `<div class="gmap">` with the inlined image and, when the
 * image carries a `view`, an SVG overlay of the markers. `src` is the already-resolved data URI.
 */
export function mapFigure({ src, image, points = [], hue, title = 'Map', caption = '' }) {
  const v = image && image.view;
  const w = v ? v.width : 4, h = v ? v.height : 3;
  const overlay = v ? `<svg class="gmap-marks" viewBox="0 0 ${w} ${h}" aria-hidden="true">${markersSvg(points, projector(v), { hue, halo: true })}</svg>` : '';
  const alt = (image && image.alt) || title;
  return `<figure class="map-fig"><div class="gmap"${v ? ` style="aspect-ratio:${w}/${h}"` : ''}><img src="${attr(src)}" alt="${attr(alt)}">${overlay}</div>${caption ? `<figcaption class="legend">${caption}</figcaption>` : ''}</figure>`;
}
export const mapCredit = (image) => esc((image && image.credit) || 'Map data © Google');

// Developed by: LightAISolutions

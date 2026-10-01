/**
 * Brochure kit — the route sketch: a small schematic map drawn as SVG from the stops' coordinates. No tiles,
 * no network: an equirectangular projection fitted to the box, legs as gently curved strokes dashed by mode,
 * numbered markers, a scale bar and a north mark. Degenerate input (one point, no coordinates) still draws.
 */
import { esc } from './escape.mjs';

export const DASH = { walk: '1.5 4', transit: '7 4', train: '7 4', drive: '', taxi: '7 2.5 1.5 2.5', bike: '4 3', ferry: '1 5', other: '3 3' };
const EARTH = 6371000;

/** Fit [{lat,lng}] into w×h with padding → { x(i), y(i), metersPerUnit, ok }. */
export function project(points, w, h, pad) {
  const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!pts.length) return { ok: false, xy: () => [w / 2, h / 2], metersPerUnit: 0 };
  const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p.lng * k), ys = pts.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
  const ox = (w - spanX * scale) / 2, oy = (h - spanY * scale) / 2;
  const degPerUnit = 1 / scale; // degrees of latitude per SVG unit
  return {
    ok: true,
    metersPerUnit: (degPerUnit * Math.PI * EARTH) / 180,
    xy: (p) => (Number.isFinite(p.lat) && Number.isFinite(p.lng)) ? [ox + (p.lng * k - minX) * scale, oy + (-p.lat - minY) * scale] : [w / 2, h / 2]
  };
}
/** A round number of metres for a scale bar about `targetUnits` long. */
export function niceScale(metersPerUnit, targetUnits) {
  if (!(metersPerUnit > 0)) return null;
  const target = metersPerUnit * targetUnits;
  const steps = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const m = steps.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), steps[0]);
  return { meters: m, units: m / metersPerUnit, label: m >= 1000 ? m / 1000 + ' km' : m + ' m' };
}
/** Quadratic path between two points, bowed to one side by `bow` × length. */
export function curve([x1, y1], [x2, y2], bow = 0.12) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const cx = (x1 + x2) / 2 - (dy / len) * len * bow, cy = (y1 + y2) / 2 + (dx / len) * len * bow;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
const HOUSE = 'M-6 1.5V-2.5L0 -7.5L6 -2.5V1.5Q6 3 4.5 3H-4.5Q-6 3 -6 1.5Z';

/**
 * routeSketch({ points:[{lat,lng,kind:'stop'|'lodging'|'meal',n,label,hue}], legs:[{from,to,mode,hue}], w,h, hue, frame })
 * → SVG markup. `from`/`to` index `points`. Points without coordinates are skipped (legs touching them too).
 */
export function routeSketch({ points = [], legs = [], w = 320, h = 230, hue = '#b2492f', ink = '#1c1a17', frame = true, title = 'Route sketch' } = {}) {
  const pad = 30;
  const P = project(points, w, h, pad);
  let out = `<svg class="sketch" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">`;
  if (frame) out += `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="3" fill="#f6f1e7" stroke="#e2dbcf"/>`;
  if (!P.ok) return out + `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="9" fill="#7a736b" font-style="italic">no coordinates for this day</text></svg>`;
  // faint dotted graticule — the paper of the map
  out += `<defs><pattern id="sk-dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r=".55" fill="${ink}" fill-opacity=".12"/></pattern></defs><rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="url(#sk-dots)"/>`;
  const has = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
  legs.forEach((l, i) => {
    const a = points[l.from], b = points[l.to];
    if (!has(a) || !has(b)) return;
    const [x1, y1] = P.xy(a), [x2, y2] = P.xy(b);
    if (Math.hypot(x2 - x1, y2 - y1) < 1) return;
    const dash = DASH[l.mode] ?? DASH.other;
    const width = l.mode === 'ferry' ? 2.4 : l.mode === 'walk' ? 1.9 : 1.6;
    out += `<path d="${curve([x1, y1], [x2, y2], i % 2 ? 0.1 : -0.1)}" fill="none" stroke="${l.hue || hue}" stroke-width="${width}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-opacity=".9"/>`;
  });
  const drawn = [];
  points.forEach((p) => {
    if (!has(p)) return;
    const [x, y] = P.xy(p);
    if (p.kind === 'lodging' && drawn.some((d) => Math.hypot(d[0] - x, d[1] - y) < 2 && d[2] === 'lodging')) return;
    drawn.push([x, y, p.kind]);
    const c = p.hue || hue;
    if (p.kind === 'lodging') out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="${HOUSE}" fill="#fff" stroke="${ink}" stroke-width="1.3" stroke-linejoin="round"/>${p.label ? `<text x="9" y="3.5" font-size="8.5" font-style="italic" fill="${ink}">${esc(p.label)}</text>` : ''}</g>`;
    else if (p.kind === 'meal') out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="#fff" stroke="${c}" stroke-width="1.4"/>`;
    else out += `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8.5" fill="${c}" stroke="#fff" stroke-width="1.5"/><text x="${x.toFixed(1)}" y="${(y + 3.3).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff">${esc(p.n ?? '')}</text></g>`;
  });
  const sc = niceScale(P.metersPerUnit, w * 0.22);
  if (sc) out += `<g stroke="${ink}" stroke-width="1"><path d="M${pad - 14} ${h - 13}h${sc.units.toFixed(1)}M${pad - 14} ${h - 16}v6M${(pad - 14 + sc.units).toFixed(1)} ${h - 16}v6"/></g><text x="${pad - 14}" y="${h - 19}" font-size="7.5" fill="${ink}">${sc.label}</text>`;
  out += `<g transform="translate(${w - 18} 20)"><path d="M0 -9L3 2L0 0L-3 2Z" fill="${ink}"/><text x="0" y="12" text-anchor="middle" font-size="7.5" fill="${ink}">N</text></g>`;
  return out + '</svg>';
}
/** Legend chips for the modes present. */
export function sketchLegend(modes, hue = '#1c1a17') {
  const names = { walk: 'on foot', transit: 'transit', train: 'train', drive: 'car', taxi: 'taxi', bike: 'bike', ferry: 'ferry', other: 'travel' };
  return [...new Set(modes)].filter((m) => names[m]).map((m) => `<span class="legend-item"><svg viewBox="0 0 28 8" width="28" height="8" aria-hidden="true"><path d="M1 4H27" stroke="${hue}" stroke-width="1.8" stroke-linecap="round"${DASH[m] ? ` stroke-dasharray="${DASH[m]}"` : ''}/></svg>${names[m]}</span>`).join('');
}

// Developed by: LightAISolutions

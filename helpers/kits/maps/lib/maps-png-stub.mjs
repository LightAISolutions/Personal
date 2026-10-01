/**
 * Maps kit — a stand-in map image generated at run time (no asset, no network, no base64 in the repo): a neutral
 * paper-coloured raster with a faint street grid, the markers and paths of a static-map request drawn roughly in
 * place, and a grey strip where Google's copyright line would sit. Used by the mock transport (so tests and
 * offline builds get a real PNG of the requested size) and by `static-map … --mock`. It is NOT a map and never
 * imitates Google's logo or cartography.
 *   encodePng(width, height, rgb: Buffer)   → PNG bytes (8-bit RGB, filter 0, zlib)
 *   stubMapPng({ width, height, markers: [{ x, y, rgb }], paths: [{ points: [[x, y]], rgb }] }) → PNG bytes
 *   stubFromStaticUrl(url)                  → PNG bytes sized and drawn from a Maps Static API URL
 */
import { deflateSync } from 'node:zlib';
import { decodePolyline } from './maps-polyline.mjs';

const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** encodePng(width, height, rgb) — `rgb` is width*height*3 bytes, row-major. */
export function encodePng(width, height, rgb) {
  if (rgb.length !== width * height * 3) throw new Error('maps: rgb buffer size mismatch');
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 3 + 1)] = 0; rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

class Canvas {
  constructor(w, h, bg) { this.w = w; this.h = h; this.px = Buffer.alloc(w * h * 3); for (let i = 0; i < w * h; i++) { this.px[i * 3] = bg[0]; this.px[i * 3 + 1] = bg[1]; this.px[i * 3 + 2] = bg[2]; } }
  set(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 3; this.px[i] = c[0]; this.px[i + 1] = c[1]; this.px[i + 2] = c[2]; }
  rect(x0, y0, x1, y1, c) { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.set(x, y, c); }
  disc(cx, cy, r, c) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.set(cx + x, cy + y, c); }
  line(x0, y0, x1, y1, c, w = 1) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let i = 0; i <= n; i++) this.disc(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, Math.max(0, (w - 1) >> 1), c); }
}
const hex = (s, fallback) => { const m = /^0x([0-9a-f]{6})/i.exec(String(s || '')); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : fallback; };
const NAMED = { red: [200, 60, 50], blue: [60, 90, 200], green: [70, 140, 70], black: [20, 20, 20], white: [255, 255, 255], gray: [128, 128, 128], orange: [230, 140, 40], purple: [120, 60, 140], yellow: [220, 190, 40], brown: [120, 80, 50] };

/** stubMapPng({ width, height, markers, paths, scale }) — positions in pixels of the final image. */
export function stubMapPng({ width = 320, height = 240, markers = [], paths = [], scale = 1 } = {}) {
  const c = new Canvas(width, height, [236, 232, 224]);
  const step = Math.max(18, Math.round(28 * scale));
  for (let x = step; x < width; x += step) c.rect(x, 0, x + Math.max(1, Math.round(scale)), height, [250, 248, 243]); // "streets"
  for (let y = step; y < height; y += step) c.rect(0, y, width, y + Math.max(1, Math.round(scale)), [250, 248, 243]);
  c.rect(0, Math.round(height * 0.72), Math.round(width * 0.38), height, [205, 220, 228]); // a "water" corner
  c.rect(Math.round(width * 0.55), Math.round(height * 0.1), Math.round(width * 0.8), Math.round(height * 0.3), [218, 226, 206]); // a "park"
  for (const p of paths) for (let i = 1; i < p.points.length; i++) c.line(p.points[i - 1][0], p.points[i - 1][1], p.points[i][0], p.points[i][1], p.rgb || [80, 80, 80], p.width || Math.round(4 * scale));
  for (const m of markers) { const r = Math.round((m.small ? 4 : 9) * scale); c.disc(m.x, m.y, r + Math.round(1.5 * scale), [255, 255, 255]); c.disc(m.x, m.y, r, m.rgb || [40, 40, 40]); }
  const strip = Math.round(12 * scale);
  c.rect(0, height - strip, width, height, [225, 221, 213]); // where a real image carries Google's logo and copyright line
  c.rect(Math.round(4 * scale), height - strip + Math.round(3 * scale), Math.round(50 * scale), height - Math.round(3 * scale), [190, 186, 178]);
  return encodePng(width, height, c.px);
}

/** stubPhotoPng({ width, height, seed }) — a soft gradient with a horizon and a few shapes: a neutral stand-in for a place photo. */
export function stubPhotoPng({ width = 1200, height = 800, seed = 1 } = {}) {
  const c = new Canvas(width, height, [214, 206, 190]);
  const r = (n) => { seed = (seed * 9301 + 49297) % 233280; return (seed / 233280) * n; };
  const horizon = Math.round(height * (0.45 + r(0.2)));
  for (let y = 0; y < height; y++) { const t = y / height; const col = y < horizon ? [226 - 40 * t, 220 - 30 * t, 206 - 10 * t] : [150 - 60 * (t - 0.5), 140 - 50 * (t - 0.5), 120 - 40 * (t - 0.5)]; c.rect(0, y, width, y + 1, col.map(Math.round)); }
  for (let i = 0; i < 5; i++) { const x = Math.round(r(width)), w = Math.round(40 + r(width / 4)), h = Math.round(height * (0.12 + r(0.35))); c.rect(x, horizon - h, Math.min(width, x + w), horizon + Math.round(height * 0.05), [96 + Math.round(r(40)), 84 + Math.round(r(30)), 70 + Math.round(r(20))]); }
  c.disc(Math.round(width * (0.15 + r(0.7))), Math.round(horizon * (0.3 + r(0.3))), Math.round(height * 0.05), [240, 234, 218]);
  return encodePng(width, height, c.px);
}

/** stubFromStaticUrl(url) — reads size, scale, markers and paths from a Maps Static API URL and draws them in place. */
export function stubFromStaticUrl(url) {
  const u = new URL(url);
  const [w, h] = (u.searchParams.get('size') || '320x240').split('x').map(Number);
  const scale = Number(u.searchParams.get('scale') || 1);
  const pts = [], markers = [], paths = [];
  const parse = (s) => { const parts = s.split('|'); const style = Object.fromEntries(parts.filter((p) => /^[a-z]+:/.test(p) && !/^-?\d/.test(p)).map((p) => p.split(/:(.*)/s).slice(0, 2))); const locs = parts.filter((p) => /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(p)).map((p) => p.split(',').map(Number)); return { style, locs }; };
  for (const m of u.searchParams.getAll('markers')) { const { style, locs } = parse(m); for (const [lat, lng] of locs) { markers.push({ lat, lng, rgb: NAMED[style.color] || hex(style.color, [40, 40, 40]), small: style.size === 'small' || style.size === 'tiny' }); pts.push([lat, lng]); } }
  for (const p of u.searchParams.getAll('path')) {
    const { style, locs } = parse(p);
    const at = p.indexOf('enc:'); // the encoded polyline is always last and may itself contain '|'
    const line = at >= 0 ? decodePolyline(p.slice(at + 4)).map((q) => [q.lat, q.lng]) : locs;
    paths.push({ line, rgb: NAMED[style.color] || hex(style.color, [80, 80, 80]), width: style.weight ? Number(style.weight) * scale : undefined });
    pts.push(...line);
  }
  const W = w * scale, H = h * scale, pad = Math.round(28 * scale);
  const lats = pts.map((p) => p[0]), lngs = pts.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const sx = (maxLng - minLng) * k || 1e-6, sy = (maxLat - minLat) || 1e-6, s = Math.min((W - 2 * pad) / sx, (H - 2 * pad) / sy);
  const ox = (W - sx * s) / 2, oy = (H - sy * s) / 2;
  const xy = ([lat, lng]) => [ox + (lng - minLng) * k * s, oy + (maxLat - lat) * s];
  return stubMapPng({ width: W, height: H, scale, markers: pts.length ? markers.map((m) => { const [x, y] = xy([m.lat, m.lng]); return { ...m, x, y }; }) : [], paths: pts.length ? paths.map((p) => ({ ...p, points: p.line.map(xy) })) : [] });
}

// Developed by: LightAISolutions

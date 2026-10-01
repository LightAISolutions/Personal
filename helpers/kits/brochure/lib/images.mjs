/**
 * Brochure kit — images. The document is self-contained, so every image the model names is read from disk at
 * render time and inlined as a data URI. Remote URLs are never fetched (no network at render or view time):
 * they are dropped with a warning. Caps keep the document inside the private-Artifact limit (plan fact 9).
 */
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, extname, isAbsolute } from 'node:path';

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;     // one image
export const IMAGES_TOTAL_MAX_BYTES = 12 * 1024 * 1024; // all images in one document
const DATA_URI_RE = /^data:(image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml));base64,([A-Za-z0-9+/]+={0,2})$/i;
const SVG_ACTIVE_RE = /<script|javascript:|\son[a-z]+\s*=|<foreignObject|<iframe|<embed|<object|\burl\s*\(/i;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif' };

/** A per-render budget: resolve({src}) → data URI or '' (with a warning pushed), never throws. */
export function imageResolver({ baseDir = process.cwd(), warnings = [] } = {}) {
  let total = 0;
  const cache = new Map();
  return {
    warnings,
    resolve(src, label = 'image') {
      if (src && typeof src === 'object') src = src.src; // the model's image object { src, alt, credit }
      if (typeof src !== 'string' || !src.trim()) return '';
      if (/^data:/i.test(src)) {
        // Only a well-formed base64 image URI is emitted: anything else (a quote, a space, an event handler, a text
        // payload) would otherwise land verbatim inside src="…". The URI is emitted through attr() as well.
        const m = DATA_URI_RE.exec(src.replace(/\s+/g, ''));
        if (!m) { warnings.push(`${label}: data URI rejected (not a base64 image)`); return ''; }
        const clean = `data:${m[1].toLowerCase()};base64,${m[2]}`;
        if (m[1].toLowerCase() === 'image/svg+xml' && SVG_ACTIVE_RE.test(Buffer.from(m[2], 'base64').toString('utf8'))) { warnings.push(`${label}: SVG rejected (script content)`); return ''; }
        total += clean.length;
        return total <= IMAGES_TOTAL_MAX_BYTES ? clean : (warnings.push(`${label}: dropped, image budget exceeded`), '');
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(src)) { warnings.push(`${label}: remote image skipped (${src.slice(0, 60)}) — the document never fetches at render or view time`); return ''; }
      const p = isAbsolute(src) ? src : resolve(baseDir, src);
      if (cache.has(p)) return cache.get(p);
      const mime = MIME[extname(p).toLowerCase()];
      let out = '';
      if (!mime) warnings.push(`${label}: unsupported image type ${extname(p) || '(none)'}`);
      else if (!existsSync(p)) warnings.push(`${label}: file not found: ${src}`);
      else {
        const size = statSync(p).size;
        if (size > IMAGE_MAX_BYTES) warnings.push(`${label}: skipped, ${Math.round(size / 1024)} KB exceeds ${IMAGE_MAX_BYTES / 1024 / 1024} MB`);
        else if (total + size > IMAGES_TOTAL_MAX_BYTES) warnings.push(`${label}: skipped, image budget exceeded`);
        else {
          const buf = readFileSync(p);
          if (mime === 'image/svg+xml' && SVG_ACTIVE_RE.test(buf.toString('utf8'))) warnings.push(`${label}: SVG rejected (script content)`);
          else { total += size; out = `data:${mime};base64,${buf.toString('base64')}`; }
        }
      }
      cache.set(p, out);
      return out;
    }
  };
}

// Developed by: LightAISolutions

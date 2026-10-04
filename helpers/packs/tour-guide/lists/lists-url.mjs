/**
 * Tour Guide — Lists: the Google Maps link parser (TG-PHASE-14 WP-14d). Pure, never throws, never follows a link.
 *
 *   parseMapsUrl(url) → { kind, cid, place_id, lat, lng, query, name }
 *
 * kind, strongest first:
 *   cid       the feature id `!1s0x…:0x…` (or `ftid=`; the second number, unsigned 64-bit, is the CID in decimal) or `cid=`
 *   place_id  `query_place_id=`
 *   name      `/maps/place/<name>/` (a name hint; `@lat,lng` beside it is kept as the location bias)
 *   query     `query=` / `q=` with words
 *   pin       coordinates only: `/maps/search/<lat>,<lng>`, `/maps/place/<lat>,<lng>`, `@lat,lng`, a `lat,lng` query
 *   short     `goo.gl/maps/…`, `maps.app.goo.gl/…` — never followed
 *   none      any other host, or nothing usable
 * Every field the link carries is filled, whatever the kind (a feature-id link usually has a name and `@lat,lng` too).
 */
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
const COORDS_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const FTID_RE = /0x([0-9a-f]{1,16}):0x([0-9a-f]{1,16})/i;
const empty = (kind) => ({ kind, cid: null, place_id: null, lat: null, lng: null, query: null, name: null });

function decode(s) {
  const t = String(s).replace(/\+/g, ' ');
  try { return decodeURIComponent(t); } catch (e) { return null; }
}
function coords(s) {
  const m = COORDS_RE.exec(String(s ?? ''));
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
const isMapsHost = (h) => /^(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(h);

/** parseMapsUrl(url) — see the header. */
export function parseMapsUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return empty('none');
  let u;
  try { u = new URL(url.trim()); } catch (e) { return empty('none'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return empty('none');
  const host = u.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && /^\/maps(?:\/|$)/.test(u.pathname))) return empty('short');
  if (!isMapsHost(host) || (!host.startsWith('maps.') && !/^\/maps(?:\/|$|@)/.test(u.pathname))) return empty('none');

  const out = empty('none');
  const q = u.searchParams;
  const whole = u.pathname + u.search;
  // The CID: the feature id in the data blob (or ftid=), else cid=.
  const ft = FTID_RE.exec(/!1s0x/i.test(whole) ? whole.slice(whole.search(/!1s0x/i)) : (q.get('ftid') || ''));
  if (ft) out.cid = BigInt('0x' + ft[2]).toString();
  else if (/^\d{1,20}$/.test(q.get('cid') || '')) out.cid = BigInt(q.get('cid')).toString();
  if (out.cid !== null && (out.cid.length > 20 || out.cid === '0')) out.cid = null;
  const pid = q.get('query_place_id');
  if (pid && PLACE_ID_RE.test(pid)) out.place_id = pid;

  const at = /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/.exec(u.pathname);
  if (at) { const c = coords(at[1] + ',' + at[2]); if (c) { out.lat = c.lat; out.lng = c.lng; } }
  const seg = /^\/maps\/(place|search)\/([^/]+)/.exec(u.pathname);
  if (seg) {
    const text = decode(seg[2]);
    const c = text === null ? null : coords(text);
    if (c) { out.lat = c.lat; out.lng = c.lng; } else if (text && seg[1] === 'place' && !text.startsWith('@')) out.name = text.trim() || null;
    else if (text && seg[1] === 'search' && !text.startsWith('@')) out.query = text.trim() || null;
  }
  const qq = q.get('query') ?? q.get('q');
  if (qq !== null) {
    const c = coords(qq);
    if (c) { out.lat = c.lat; out.lng = c.lng; } else if (qq.trim()) out.query = qq.trim();
  }
  out.kind = out.cid ? 'cid' : out.place_id ? 'place_id' : out.name ? 'name' : out.query ? 'query' : out.lat !== null ? 'pin' : 'none';
  return out;
}

// Developed by: LightAISolutions

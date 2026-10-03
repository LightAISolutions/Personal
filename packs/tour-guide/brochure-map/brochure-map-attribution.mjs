/**
 * Tour Guide brochure-map — sources and attribution. Estimate sources (visit length) and PlaceNote sources (research)
 * become brochure `source` rows ({ title, url, accessed, supports }); the trip-level ledger is their union,
 * deduplicated by normalised URL with the latest access date kept and the "supports" phrases merged.
 */
import { clip, SHORT } from './brochure-map-text.mjs';

export const MAX_TRIP_SOURCES = 100;
export const MAX_PLACE_SOURCES = 12;
export const ESTIMATE_SUPPORTS = 'visit length';
export const DEFAULT_GENERATOR = 'Tour Guide · brochure-map';

/** sourceKey(url) → the dedupe key: scheme and host lower-cased, fragment dropped, one trailing slash dropped. */
export function sourceKey(url) {
  const raw = String(url || '').trim();
  try {
    const u = new URL(raw);
    u.hash = '';
    let s = u.protocol.toLowerCase() + '//' + u.host.toLowerCase() + u.pathname + u.search;
    if (s.endsWith('/') && !u.search) s = s.slice(0, -1);
    return s;
  } catch { return raw; }
}
/** A readable title for a source with none: host + path, without the scheme. */
export function fallbackTitle(url) {
  const raw = String(url || '').trim();
  try { const u = new URL(raw); return clip(u.host.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname), 90); } catch { return clip(raw, 90); }
}
/** toSource(contractSource, supportsDefault) → brochure source row, or null without a URL. */
export function toSource(s, supportsDefault) {
  if (!s || !s.url) return null;
  const url = String(s.url).trim();
  const row = { title: clip(s.title, SHORT) || fallbackTitle(url), url: url.slice(0, 2000) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(s.accessed || ''))) row.accessed = s.accessed;
  const supports = clip(s.supports || supportsDefault, SHORT);
  if (supports) row.supports = supports;
  return row;
}
/** mergeSources(rows, max) → rows deduplicated by sourceKey: first title, latest accessed, supports joined. */
export function mergeSources(rows, max = MAX_TRIP_SOURCES) {
  const byKey = new Map();
  for (const r of rows) {
    if (!r) continue;
    const k = sourceKey(r.url);
    const cur = byKey.get(k);
    if (!cur) { byKey.set(k, { ...r, _supports: r.supports ? [r.supports] : [] }); continue; }
    if (r.accessed && (!cur.accessed || r.accessed > cur.accessed)) cur.accessed = r.accessed;
    if (r.supports && !cur._supports.includes(r.supports)) cur._supports.push(r.supports);
  }
  return [...byKey.values()].slice(0, max).map(({ _supports, ...r }) => {
    const supports = clip(_supports.join('; '), SHORT);
    const out = { title: r.title, url: r.url };
    if (r.accessed) out.accessed = r.accessed;
    if (supports) out.supports = supports;
    return out;
  });
}
/** Every source row for one place id: its PlaceNote's sources first, then its estimates' sources. */
export function placeSourceRows(placeId, { notesByPlace, estimatesByPlace }) {
  const note = notesByPlace.get(placeId);
  const rows = (note && Array.isArray(note.sources) ? note.sources : []).map((s) => toSource(s, null));
  for (const e of estimatesByPlace.get(placeId) || []) for (const s of e.sources || []) rows.push(toSource(s, ESTIMATE_SUPPORTS));
  return rows.filter(Boolean);
}
/**
 * buildAttribution({ notes, estimates, generator, showGoogle, extra }) → brochure attribution.
 * sources = union of every note and estimate source, then the `extra` rows (C11 facts and season sources, built by
 * brochure-map-facts.mjs), deduplicated by URL. With Google content hidden the Google
 * block is forced off (nothing from Places is printed); otherwise the kit's default applies (on when a card carries
 * Google fields) and the note says when the Google fields were read.
 */
export function buildAttribution({ notes = [], estimates = [], generator, showGoogle = true, extra = [] }) {
  const rows = [];
  for (const n of notes) for (const s of (n && n.sources) || []) rows.push(toSource(s, null));
  for (const e of estimates) for (const s of (e && e.sources) || []) rows.push(toSource(s, ESTIMATE_SUPPORTS));
  for (const r of Array.isArray(extra) ? extra : []) rows.push(r && r.url ? r : null); // C11: facts and season sources, already rows
  const a = { generator: clip(generator || DEFAULT_GENERATOR, SHORT), sources: mergeSources(rows) };
  if (!a.sources.length) delete a.sources;
  if (showGoogle) a.note = 'Opening hours, ratings and review counts were read from Google Maps on the date shown on each card; check anything that matters on the morning.';
  else { a.google = false; a.note = 'No Google Maps content is printed in this brochure; the Maps links open each place on Google Maps so you can check hours and status on the day.'; }
  return a;
}

// Developed by: LightAISolutions

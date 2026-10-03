/**
 * Tour Guide brochure-map — the practical page: the trip's own `practical` sections, then (when any day has one)
 * a "Day routes" section with each day's one-link Maps route, a "Free days" section for days with no stops, and,
 * when Google content is hidden, a dated "Verify before you go" section with each place's Maps link.
 */
import { clip, compact, SHORT, TEXT } from './brochure-map-text.mjs';

export const PRACTICAL_LIMITS = Object.freeze({ sections: 30, items: 30 });
export const VERIFY_TITLE = 'Verify before you go';

function item(x) {
  if (typeof x === 'string') return clip(x, SHORT);
  if (!x || typeof x !== 'object') return undefined;
  const label = clip(x.label, SHORT), text = clip(x.text, TEXT);
  if (!label || !text) return clip(label || text, SHORT);
  return compact({ label, text, url: x.url ? String(x.url).slice(0, 2000) : undefined });
}
/** tripPractical(trip.practical) → brochure practical sections (titles required; items strings or {label,text,url}). */
export function tripPractical(sections) {
  return (sections || []).filter((s) => s && clip(s.title, SHORT)).map((s) => compact({
    title: clip(s.title, SHORT), text: clip(s.text, TEXT),
    items: (s.items || []).map(item).filter(Boolean).slice(0, PRACTICAL_LIMITS.items)
  }));
}
/** dayRoutes([{ n, date, url }]) → one section with a Maps link per day, or null. */
export function dayRoutes(rows) {
  const items = rows.filter((r) => r.url).map((r) => ({ label: `Day ${r.n} · ${r.date}`, text: 'The whole day as one Google Maps route.', url: String(r.url).slice(0, 2000) }));
  return items.length ? { title: 'Day routes', items: items.slice(0, PRACTICAL_LIMITS.items) } : null;
}
/** freeDays([{ date, note, url? }]) → a section listing days with no stops (url: the day's end or start on Maps), or null. */
export function freeDays(rows) {
  if (!rows.length) return null;
  return { title: 'Free days', items: rows.slice(0, PRACTICAL_LIMITS.items).map((r) => compact({ label: r.date, text: clip(r.note, TEXT) || 'No stops planned — a free day.', url: r.url ? String(r.url).slice(0, 2000) : undefined })) };
}
/**
 * verifySections([{ name, url, checked }], verifiedOn) → "Verify before you go" sections (split every 30 places).
 * checked = the date the place was last checked against Google Maps (its snapshot date, else the plan's).
 */
export function verifySections(rows, verifiedOn) {
  if (!rows.length) return [];
  const text = `Opening hours, ratings and closures are not printed in this brochure. The plan was checked against Google Maps on ${verifiedOn}; open each place's Maps link and check it on the day you go.`;
  const out = [];
  for (let i = 0; i < rows.length; i += PRACTICAL_LIMITS.items) {
    const chunk = rows.slice(i, i + PRACTICAL_LIMITS.items).map((r) => ({ label: clip(r.name, SHORT), text: `Check hours and status before you go (last checked ${r.checked}).`, url: r.url }));
    out.push(i === 0 ? { title: VERIFY_TITLE, text, items: chunk } : { title: `${VERIFY_TITLE}, continued`, items: chunk });
  }
  return out;
}

// Developed by: LightAISolutions

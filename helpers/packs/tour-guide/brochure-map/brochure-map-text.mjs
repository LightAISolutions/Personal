/**
 * Tour Guide brochure-map — small shared helpers: clipping to the brochure schema's string limits, weekday and
 * date arithmetic on YYYY-MM-DD strings, a date in the trip's time zone, and snapshot lookup by place id.
 */
export const SHORT = 300;
export const TEXT = 4000;
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** clip(s, n) → trimmed string of at most n characters (ellipsis when cut), or undefined for empty input. */
export function clip(s, n = SHORT) {
  if (s === undefined || s === null) return undefined;
  const t = String(s).trim();
  if (!t) return undefined;
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…';
}
/** weekdayIndex('2027-05-13') → 4 (0 = Sunday, as Google's periods). */
export function weekdayIndex(date) {
  const d = new Date(String(date) + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) throw new Error(`brochure-map: not a date: ${date}`);
  return d.getUTCDay();
}
export const weekdayName = (date) => WEEKDAYS[weekdayIndex(date)];
/** localDate('2027-04-20T22:30:00Z', 'Etc/GMT-2') → '2027-04-21'; falls back to the UTC date on a bad zone. */
export function localDate(iso, timeZone) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch { return d.toISOString().slice(0, 10); }
}
/** Drop undefined / null / empty-array keys so the model carries only what it has. */
export function compact(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue;
    out[k] = v;
  }
  return out;
}
/**
 * snapshotIndex(snapshots, buildId) → Map place_id → GoogleSnapshot. Accepts an array or an object keyed by place id.
 * Several records for one place: the one from this build wins, else the most recently fetched.
 */
export function snapshotIndex(snapshots, buildId) {
  const list = Array.isArray(snapshots) ? snapshots : Object.values(snapshots || {});
  const idx = new Map();
  for (const s of list) {
    if (!s || !s.place_id) continue;
    const cur = idx.get(s.place_id);
    if (!cur) { idx.set(s.place_id, s); continue; }
    const rank = (x) => [x.build_id === buildId ? 1 : 0, String(x.fetched_at || '')];
    const [a1, a2] = rank(s), [b1, b2] = rank(cur);
    if (a1 > b1 || (a1 === b1 && a2 > b2)) idx.set(s.place_id, s);
  }
  return idx;
}

// Developed by: LightAISolutions

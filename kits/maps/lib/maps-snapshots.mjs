/**
 * Maps kit — GoogleSnapshot records (plan §4.4) and the purge that keeps them inside the Maps terms.
 * Terms read 2026-10-01 (decisions WP-2a, finding F1): place ids may be cached indefinitely; latitude/longitude from the
 * Places API and the Routes API may be cached for up to 30 consecutive calendar days; NO other Places content (hours,
 * rating, website, address, names) has a caching permission ("Customer will not cache Google Maps Content except as
 * expressly permitted"). So a record splits into three retention classes:
 *   place_id                → kept until the record is dropped (callers keep place ids forever in their own data)
 *   location {lat,lng}      → record dropped once fetched_at is older than latLngMaxDays (default 30)
 *   content {…}             → stripped once older than contentMaxAgeHours (default 0 = at every purge: content is
 *                             build-scoped; a later build fetches it fresh)
 * Store file (v1): { "v": 1, "kind": "maps-snapshot-store", "records": [GoogleSnapshot…] }; the caller names the path
 * (option `path` / env MAPS_SNAPSHOT_STORE) and keeps it outside any public repo.
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const STORE_KIND = 'maps-snapshot-store';
export const LATLNG_MAX_DAYS = 30;
export const CONTENT_MAX_AGE_HOURS = 0;

/**
 * Caps and shapes for snapshot content — the same limits the pack's google-snapshot schema enforces, applied here so a
 * hostile or malformed Details response (a 5 000-character displayName, HTML in an address, a rating of "4.9 stars",
 * unknown keys) can never produce an oversize or mis-typed record. Strings are cut, numbers outside their range become
 * null, unknown fields are dropped: only the kit's own field names leave this module (WP-6b red team).
 */
export const SNAPSHOT_LIMITS = Object.freeze({ build_id: 120, display_name: 300, address: 500, weekday_line: 200, weekday_lines: 7, periods: 70, url: 2000, time_zone: 64, place_id: 300 });
export const BUSINESS_STATUSES = Object.freeze(['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY', 'BUSINESS_STATUS_UNSPECIFIED']);
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const str = (v, max) => (typeof v === 'string' && v.length ? v.slice(0, max) : null);
const httpUrl = (v) => (typeof v === 'string' && v.length <= SNAPSHOT_LIMITS.url && /^https?:\/\/\S+$/.test(v) ? v : null);
const lines = (arr, { minLength = 0 } = {}) => (Array.isArray(arr) ? arr : []).filter((d) => typeof d === 'string' && d.length >= minLength).map((d) => d.slice(0, SNAPSHOT_LIMITS.weekday_line)).slice(0, SNAPSHOT_LIMITS.weekday_lines);
const point = (p) => (p && Number.isInteger(p.day) && p.day >= 0 && p.day <= 6 && Number.isInteger(p.hour) && p.hour >= 0 && p.hour <= 23 && Number.isInteger(p.minute) && p.minute >= 0 && p.minute <= 59 ? { day: p.day, hour: p.hour, minute: p.minute } : null);
const periods = (arr) => (Array.isArray(arr) ? arr : []).map((per) => {
  const open = point(per?.open);
  if (!open) return null;
  const close = point(per?.close);
  return close ? { open, close } : { open };
}).filter(Boolean).slice(0, SNAPSHOT_LIMITS.periods);

/** capContent(content) → the content object with only the kit's fields, every value capped or nulled (null in → null out). */
export function capContent(c) {
  if (c === null || c === undefined) return null;
  if (typeof c !== 'object') return null;
  return {
    display_name: str(c.display_name, SNAPSHOT_LIMITS.display_name),
    address: str(c.address, SNAPSHOT_LIMITS.address),
    business_status: BUSINESS_STATUSES.includes(c.business_status) ? c.business_status : null,
    hours: c.hours && typeof c.hours === 'object' ? { weekday_descriptions: lines(c.hours.weekday_descriptions, { minLength: 1 }), periods: periods(c.hours.periods) } : null,
    current_hours: c.current_hours && typeof c.current_hours === 'object' ? { open_now: typeof c.current_hours.open_now === 'boolean' ? c.current_hours.open_now : null, weekday_descriptions: lines(c.current_hours.weekday_descriptions) } : null,
    rating: typeof c.rating === 'number' && Number.isFinite(c.rating) && c.rating >= 0 && c.rating <= 5 ? c.rating : null,
    review_count: Number.isInteger(c.review_count) && c.review_count >= 0 ? c.review_count : null,
    website: httpUrl(c.website),
    maps_uri: httpUrl(c.maps_uri),
    time_zone: str(c.time_zone, SNAPSHOT_LIMITS.time_zone)
  };
}

/** toSnapshot(placeJson, { buildId, fetchedAt }) → GoogleSnapshot from a Place Details (New) response; content is capped. */
export function toSnapshot(place, { buildId, fetchedAt = new Date() } = {}) {
  if (!place || !place.id) throw new Error('maps: toSnapshot needs a place with an id');
  if (!buildId) throw new Error('maps: toSnapshot needs a buildId');
  const loc = place.location && Number.isFinite(place.location.latitude) ? { lat: place.location.latitude, lng: place.location.longitude } : null;
  const content = capContent({
    display_name: place.displayName?.text ?? null,
    address: place.formattedAddress ?? null,
    business_status: place.businessStatus ?? null,
    hours: place.regularOpeningHours ? { weekday_descriptions: place.regularOpeningHours.weekdayDescriptions || [], periods: place.regularOpeningHours.periods || [] } : null,
    current_hours: place.currentOpeningHours ? { open_now: place.currentOpeningHours.openNow ?? null, weekday_descriptions: place.currentOpeningHours.weekdayDescriptions || [] } : null,
    rating: place.rating ?? null,
    review_count: place.userRatingCount ?? null,
    website: place.websiteUri ?? null,
    maps_uri: place.googleMapsUri ?? null,
    time_zone: place.timeZone?.id ?? null
  });
  return { build_id: String(buildId).slice(0, SNAPSHOT_LIMITS.build_id), place_id: place.id, fetched_at: new Date(fetchedAt).toISOString(), location: loc, content };
}

/**
 * sanitizeSnapshot(record) → a record with only the kit's own fields and capped content, or null when the record is not
 * a usable snapshot (bad place_id, bad timestamps, non-numeric location). Used on every store load so a poisoned store
 * file cannot smuggle extra fields or oversize text into a build.
 */
export function sanitizeSnapshot(r) {
  if (!r || typeof r !== 'object') return null;
  if (typeof r.place_id !== 'string' || !PLACE_ID_RE.test(r.place_id)) return null;
  if (typeof r.fetched_at !== 'string' || !ISO_RE.test(r.fetched_at)) return null;
  if (typeof r.build_id !== 'string' || !r.build_id.length) return null;
  let location = null;
  if (r.location !== null && r.location !== undefined) {
    const { lat, lng } = r.location;
    if (!(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null;
    location = { lat, lng };
  }
  const out = { build_id: r.build_id.slice(0, SNAPSHOT_LIMITS.build_id), place_id: r.place_id, fetched_at: r.fetched_at, location, content: capContent(r.content) };
  if (typeof r.content_purged_at === 'string' && ISO_RE.test(r.content_purged_at)) out.content_purged_at = r.content_purged_at;
  return out;
}

/** openSnapshotStore({ path? }) — in memory without a path. Writes are atomic (tmp + rename). */
export function openSnapshotStore({ path = null } = {}) {
  let doc = { v: 1, kind: STORE_KIND, records: [] };
  let rejected = 0;
  if (path && existsSync(path)) {
    doc = JSON.parse(readFileSync(path, 'utf8'));
    if (doc.v !== 1 || doc.kind !== STORE_KIND || !Array.isArray(doc.records)) throw new Error('maps: not a v1 maps snapshot store');
    const clean = doc.records.map(sanitizeSnapshot).filter(Boolean);
    rejected = doc.records.length - clean.length;
    doc = { v: 1, kind: STORE_KIND, records: clean };
  }
  const save = () => {
    if (!path) return;
    mkdirSync(dirname(path), { recursive: true });
    const tmp = path + '.tmp-' + process.pid;
    writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
    renameSync(tmp, path);
  };
  return {
    path,
    /** Records the last load dropped because they were not usable snapshots (a poisoned or hand-edited store). */
    rejected,
    /** Replace any record with the same build_id + place_id; the record is sanitized first and refused when unusable. */
    put(rec) {
      const clean = sanitizeSnapshot(rec);
      if (!clean) throw new Error('maps: not a usable snapshot record (place_id, fetched_at, build_id, location)');
      doc.records = doc.records.filter((r) => !(r.build_id === clean.build_id && r.place_id === clean.place_id));
      doc.records.push(clean);
      save();
      return clean;
    },
    /** Freshest record for a place (optionally within one build). */
    latest(placeId, { buildId } = {}) {
      return doc.records.filter((r) => r.place_id === placeId && (!buildId || r.build_id === buildId)).sort((a, b) => b.fetched_at.localeCompare(a.fetched_at))[0] || null;
    },
    all() { return doc.records.slice(); },
    /**
     * purge({ now, latLngMaxDays = 30, contentMaxAgeHours = 0 }) → { dropped, stripped, kept }
     * dropped: records whose fetched_at is older than latLngMaxDays (location must go; nothing else is left to keep).
     * stripped: records whose content was older than contentMaxAgeHours (content set to null, content_purged_at stamped).
     */
    purge({ now = new Date(), latLngMaxDays = LATLNG_MAX_DAYS, contentMaxAgeHours = CONTENT_MAX_AGE_HOURS } = {}) {
      if (!(latLngMaxDays >= 0 && latLngMaxDays <= LATLNG_MAX_DAYS)) throw new Error('maps: latLngMaxDays must be 0–30 (Maps Service Specific Terms)');
      if (!(contentMaxAgeHours >= 0)) throw new Error('maps: contentMaxAgeHours must be ≥ 0');
      const t = new Date(now).getTime();
      let dropped = 0, stripped = 0;
      doc.records = doc.records.filter((r) => {
        const age = t - new Date(r.fetched_at).getTime();
        if (!(age < latLngMaxDays * 86400000)) { dropped++; return false; }
        if (r.content && !(age < contentMaxAgeHours * 3600000)) { r.content = null; r.content_purged_at = new Date(t).toISOString(); stripped++; }
        return true;
      });
      save();
      return { dropped, stripped, kept: doc.records.length };
    }
  };
}

// Developed by: LightAISolutions

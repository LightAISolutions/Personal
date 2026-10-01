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

/** toSnapshot(placeJson, { buildId, fetchedAt }) → GoogleSnapshot from a Place Details (New) response. */
export function toSnapshot(place, { buildId, fetchedAt = new Date() } = {}) {
  if (!place || !place.id) throw new Error('maps: toSnapshot needs a place with an id');
  if (!buildId) throw new Error('maps: toSnapshot needs a buildId');
  const loc = place.location && Number.isFinite(place.location.latitude) ? { lat: place.location.latitude, lng: place.location.longitude } : null;
  const content = {
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
  };
  return { build_id: String(buildId), place_id: place.id, fetched_at: new Date(fetchedAt).toISOString(), location: loc, content };
}

/** openSnapshotStore({ path? }) — in memory without a path. Writes are atomic (tmp + rename). */
export function openSnapshotStore({ path = null } = {}) {
  let doc = { v: 1, kind: STORE_KIND, records: [] };
  if (path && existsSync(path)) {
    doc = JSON.parse(readFileSync(path, 'utf8'));
    if (doc.v !== 1 || doc.kind !== STORE_KIND || !Array.isArray(doc.records)) throw new Error('maps: not a v1 maps snapshot store');
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
    /** Replace any record with the same build_id + place_id. */
    put(rec) {
      doc.records = doc.records.filter((r) => !(r.build_id === rec.build_id && r.place_id === rec.place_id));
      doc.records.push(rec);
      save();
      return rec;
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

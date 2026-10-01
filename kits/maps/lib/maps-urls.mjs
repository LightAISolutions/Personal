/**
 * Maps kit — Google Maps URLs (https://developers.google.com/maps/documentation/urls/get-started). No key, no API call,
 * no billing. Every parameter is URL-encoded; multi-value parameters are joined with "|" which is encoded as %7C.
 * A point is { placeId?, lat?, lng?, name? / address? }: the text part (name, address or "lat,lng") is the visible
 * query and the place id, when present, pins it (`*_place_id`).
 */
import { MapsInputError } from './maps-errors.mjs';

export const MAPS_URL_BASE = 'https://www.google.com/maps';
export const URL_TRAVEL_MODES = Object.freeze({ DRIVE: 'driving', WALK: 'walking', BICYCLE: 'bicycling', TRANSIT: 'transit', TWO_WHEELER: 'two-wheeler', driving: 'driving', walking: 'walking', bicycling: 'bicycling', transit: 'transit', 'two-wheeler': 'two-wheeler' });
export const URL_MAX_WAYPOINTS = 9; // the lowest per-platform limit in the Maps URLs docs; more are ignored on some platforms

const enc = (s) => encodeURIComponent(String(s));
function text(p, label) {
  if (typeof p === 'string' && p.trim()) return p.trim();
  if (p && (p.name || p.address)) return [p.name, p.address].filter(Boolean).join(', ');
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) return `${p.lat},${p.lng}`;
  if (p && p.placeId) return null; // place id only: the URL still needs a text value, filled below
  throw new MapsInputError(`maps: ${label} needs a name, address, lat/lng or placeId`);
}
const pid = (p) => (p && typeof p === 'object' && p.placeId ? String(p.placeId) : null);
function qs(pairs) { return pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${v}`).join('&'); }

/**
 * directionsUrl({ origin?, destination, waypoints?, travelMode?, navigate? }) →
 *   https://www.google.com/maps/dir/?api=1&origin=…&destination=…&travelmode=walking&waypoints=a%7Cb
 * Origin omitted = the viewer's current location. Transit links take no waypoints (Maps ignores them).
 */
export function directionsUrl({ origin = null, destination, waypoints = [], travelMode = null, navigate = false } = {}) {
  if (!destination) throw new MapsInputError('maps: directionsUrl needs a destination');
  const mode = travelMode ? URL_TRAVEL_MODES[travelMode] : null;
  if (travelMode && !mode) throw new MapsInputError('maps: unknown travelMode for a Maps URL: ' + travelMode);
  if (waypoints.length > URL_MAX_WAYPOINTS) throw new MapsInputError(`maps: a Maps URL takes at most ${URL_MAX_WAYPOINTS} waypoints`);
  if (waypoints.length && mode === 'transit') throw new MapsInputError('maps: transit directions links take no waypoints; link each leg instead');
  const dText = text(destination, 'destination') ?? 'Destination';
  const oText = origin ? text(origin, 'origin') ?? 'Origin' : null;
  const wText = waypoints.map((w, i) => text(w, `waypoints[${i}]`) ?? `Stop ${i + 1}`);
  const wIds = waypoints.map(pid);
  return MAPS_URL_BASE + '/dir/?' + qs([
    ['api', '1'],
    ['origin', oText && enc(oText)], ['origin_place_id', pid(origin) && enc(pid(origin))],
    ['destination', enc(dText)], ['destination_place_id', pid(destination) && enc(pid(destination))],
    ['travelmode', mode],
    ['waypoints', wText.length ? wText.map(enc).join('%7C') : null],
    ['waypoint_place_ids', wIds.some(Boolean) ? (wIds.every(Boolean) ? wIds.map(enc).join('%7C') : null) : null],
    ['dir_action', navigate ? 'navigate' : null]
  ]);
}

/** placeUrl({ name?, address?, lat?, lng?, placeId? }) → https://www.google.com/maps/search/?api=1&query=…&query_place_id=… */
export function placeUrl(p) {
  const t = text(p, 'place') ?? 'Place';
  return MAPS_URL_BASE + '/search/?' + qs([['api', '1'], ['query', enc(t)], ['query_place_id', pid(p) && enc(pid(p))]]);
}

/** dayUrl(stops, travelMode) → one directions link for a whole day: first stop = origin, last = destination, rest = waypoints. */
export function dayUrl(stops, travelMode) {
  if (!Array.isArray(stops) || stops.length < 2) throw new MapsInputError('maps: dayUrl needs at least two stops');
  return directionsUrl({ origin: stops[0], destination: stops[stops.length - 1], waypoints: stops.slice(1, -1), travelMode });
}

// Developed by: LightAISolutions

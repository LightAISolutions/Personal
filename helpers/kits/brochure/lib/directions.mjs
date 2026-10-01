/**
 * Brochure kit — a Google Maps directions link for each leg (Maps URLs: no key, no billing). Tapping it opens the
 * Google Maps app with that hop's route; for taxi legs it opens the train options, because the Routes API returns no
 * transit routes in some countries (Japan among them) while the Google Maps app does.
 * directionsUrl(from, to, mode) → URL string, or '' when either end has no coordinates.
 */
export const DIRECTIONS_BASE = 'https://www.google.com/maps/dir/';
export const TRAVELMODE = Object.freeze({ walk: 'walking', bike: 'bicycling', drive: 'driving', taxi: 'transit', transit: 'transit', train: 'transit', ferry: 'transit', other: 'transit' });
/** Link text per leg mode: a taxi leg links to the train alternative. */
export const DIRECTIONS_LABEL = Object.freeze({ taxi: 'by train ↗' });
const ok = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
const ll = (p) => `${+p.lat.toFixed(6)},${+p.lng.toFixed(6)}`;

export function directionsUrl(from, to, mode) {
  if (!ok(from) || !ok(to)) return '';
  const q = new URLSearchParams({ api: '1', origin: ll(from), destination: ll(to), travelmode: TRAVELMODE[mode] || 'transit' });
  if (from.place_id) q.set('origin_place_id', from.place_id);
  if (to.place_id) q.set('destination_place_id', to.place_id);
  return `${DIRECTIONS_BASE}?${q}`;
}

// Developed by: LightAISolutions

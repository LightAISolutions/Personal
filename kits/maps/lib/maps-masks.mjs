/**
 * Maps kit — the ONLY field masks the kit sends. Callers pick a tier name, never a field list, so every call maps to
 * exactly one known SKU (plan fact 2; field → SKU lists from the SKU details page, 2026-09-30 UTC). Masks are cumulative:
 * a tier includes every field of the tiers below it, so the highest tier it touches is the tier itself.
 * Note vs plan fact 2: `businessStatus` is a Pro field (not Essentials) and Place Details `photos` are IDs-only; the kit
 * follows the current SKU page.
 */
const DETAILS_FIELDS = {
  essentials: ['id', 'photos', 'location', 'formattedAddress', 'shortFormattedAddress', 'types', 'viewport'], // photos: IDs-only field, carried by every mask (Place Photos, WP-2e)
  pro: ['displayName', 'primaryType', 'primaryTypeDisplayName', 'businessStatus', 'googleMapsUri', 'timeZone', 'utcOffsetMinutes', 'accessibilityOptions'],
  enterprise: ['regularOpeningHours', 'currentOpeningHours', 'nationalPhoneNumber', 'priceLevel', 'priceRange', 'rating', 'userRatingCount', 'websiteUri'],
  enterprise_atmosphere: ['editorialSummary', 'reviewSummary', 'reviews', 'goodForChildren', 'servesVegetarianFood', 'reservable', 'restroom', 'outdoorSeating']
};
const TEXT_FIELDS = {
  ids_only: ['places.id'],
  pro: ['places.displayName', 'places.formattedAddress', 'places.location', 'places.types', 'places.primaryType', 'places.businessStatus', 'places.googleMapsUri'],
  enterprise: ['places.rating', 'places.userRatingCount', 'places.regularOpeningHours', 'places.websiteUri', 'places.priceLevel']
};
const TIER_ORDER = ['ids_only', 'essentials', 'pro', 'enterprise', 'enterprise_atmosphere'];

function cumulative(table, tier) {
  const tiers = Object.keys(table);
  const i = tiers.indexOf(tier);
  return Object.freeze(tiers.slice(0, i + 1).flatMap((t) => table[t]));
}
/** PLACE_DETAILS_MASKS.enterprise → 'id,location,…,websiteUri' (frozen strings). */
export const PLACE_DETAILS_MASKS = Object.freeze(Object.fromEntries(Object.keys(DETAILS_FIELDS).map((t) => [t, cumulative(DETAILS_FIELDS, t).join(',')])));
/** Text Search masks; `nextPageToken` is IDs-only and always included. Essentials (non-ID) does not exist for Text Search. */
export const TEXT_SEARCH_MASKS = Object.freeze(Object.fromEntries(Object.keys(TEXT_FIELDS).map((t) => [t, cumulative(TEXT_FIELDS, t).concat('nextPageToken').join(',')])));
export const PLACE_DETAILS_SKU = Object.freeze({ essentials: 'places.details.essentials', pro: 'places.details.pro', enterprise: 'places.details.enterprise', enterprise_atmosphere: 'places.details.enterprise_atmosphere' });
export const TEXT_SEARCH_SKU = Object.freeze({ ids_only: 'places.text_search.ids_only', pro: 'places.text_search.pro', enterprise: 'places.text_search.enterprise' });

/** Routes masks. In Routes the mask does not change the SKU (only request features do — see maps-routes.mjs). */
export const ROUTE_MASKS = Object.freeze({
  basic: ['routes.duration', 'routes.staticDuration', 'routes.distanceMeters', 'routes.polyline.encodedPolyline', 'routes.legs.duration', 'routes.legs.distanceMeters', 'routes.legs.startLocation', 'routes.legs.endLocation', 'routes.optimizedIntermediateWaypointIndex', 'routes.warnings'].join(','),
  transit: ['routes.duration', 'routes.distanceMeters', 'routes.polyline.encodedPolyline', 'routes.legs.duration', 'routes.legs.distanceMeters', 'routes.legs.startLocation', 'routes.legs.endLocation', 'routes.legs.steps.travelMode', 'routes.legs.steps.staticDuration', 'routes.legs.steps.transitDetails', 'routes.warnings'].join(',')
});
export const ROUTE_MATRIX_MASK = 'originIndex,destinationIndex,status,condition,distanceMeters,duration';

/** Tier of one Places field name (with or without the `places.` prefix), or null if the kit does not know it. */
export function fieldTier(field) {
  const f = field.replace(/^places\./, '');
  if (f === 'nextPageToken' || f === 'id' || f === 'photos') return 'ids_only';
  for (const [t, list] of Object.entries(DETAILS_FIELDS)) if (list.includes(f)) return t;
  return null;
}
/** Highest tier a comma-separated Places mask touches (used by tests to prove each constant bills as declared). */
export function highestTier(mask) {
  return mask.split(',').map(fieldTier).reduce((hi, t) => (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(hi) ? t : hi), 'ids_only');
}

// Developed by: LightAISolutions

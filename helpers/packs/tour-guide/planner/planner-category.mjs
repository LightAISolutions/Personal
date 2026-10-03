/**
 * Tour Guide — place categories (Phase 10, WP-10b fix (b)). A stable module path: the private repo's digest builder
 * imports it as well as the planner, the rain swaps and the brochure.
 *   refineCategory(place) → the category the planner should use for a Place (or pool record) as stored:
 *     · a legacy `church` whose name reads as a Buddhist temple → 'temple', as a Shinto shrine → 'shrine'
 *       (Phase ≤ 9 records mapped Google's buddhist_temple / place_of_worship to church);
 *     · a `neighbourhood` or `other` whose activity is a session with a set length (ceremony, class, workshop, tasting,
 *       performance) → 'experience' (a tea ceremony was a 90-minute "neighbourhood");
 *     · anything else unchanged. Pure; never mutates the place.
 *   COVERED_SIGHTS — categories a rainy-day swap may name (planner-rain.mjs): covered sights, never a meal.
 *   MIN_VISIT — the shortest sensible visit per category, for "a 45-minute visit would fit" offers (planner-day.mjs).
 */
import { activityDefault } from '../estimator/estimator-defaults.mjs';

export const TEMPLE_NAME = /\btemple\b|\bpagoda\b|\bmonastery\b|\bmandir\b|\bwat\b|-(ji|dera|tera)\b/i;
export const SHRINE_NAME = /\bshrine\b|\bjinja\b|\bjing[uū]\b|\btaisha\b|-g[uū]\b/i;
export const SESSION_CATEGORIES = Object.freeze(['neighbourhood', 'other']);
export const NEW_CATEGORIES = Object.freeze(['temple', 'shrine', 'garden', 'experience']);

/** refineCategory({ category, name, activity }) → category (see the file header). */
export function refineCategory(place) {
  const cat = place && typeof place.category === 'string' ? place.category : 'other';
  const name = String((place && place.name) || '');
  if (cat === 'church') {
    if (SHRINE_NAME.test(name)) return 'shrine';
    if (TEMPLE_NAME.test(name)) return 'temple';
    return cat;
  }
  if (SESSION_CATEGORIES.includes(cat) && activityDefault(place && place.activity)) return 'experience';
  return cat;
}
/** withRefinedCategory(place) → the same place, or a shallow copy carrying the refined category when it changed. */
export function withRefinedCategory(place) {
  const c = refineCategory(place);
  return place && c !== place.category ? { ...place, category: c } : place;
}

/** Categories that are covered sights (a rainy-day swap may offer them). Markets count only when the place says indoor. */
export const COVERED_SIGHTS = Object.freeze(['museum', 'gallery', 'aquarium', 'theatre', 'cinema', 'library', 'church', 'onsen', 'spa', 'bathhouse', 'arcade', 'workshop', 'experience']);
/** Meals: never offered "instead of" a sight, whatever their `indoor` says. */
export const MEAL_CATEGORIES = Object.freeze(['restaurant', 'cafe', 'bar']);

/** Shortest sensible visit (minutes) per category; `null` = a set session that cannot be shortened. Default 30. */
export const MIN_VISIT = Object.freeze({
  museum: 45, gallery: 30, aquarium: 45, market: 30, viewpoint: 15, park: 20, garden: 30, temple: 20, shrine: 15, church: 15,
  neighbourhood: 30, hike: 90, restaurant: 45, cafe: 20, bar: 30, shop: 15, experience: null, other: 30
});
export function minVisit(category) {
  return Object.prototype.hasOwnProperty.call(MIN_VISIT, category) ? MIN_VISIT[category] : MIN_VISIT.other;
}

// Developed by: LightAISolutions

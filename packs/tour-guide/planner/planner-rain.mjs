/**
 * Tour Guide planner — rainy-day swaps. For each planned day with an outdoor stop: up to MAX_SWAPS indoor places that
 * are covered sights (isCoveredSight — never a meal or a shop), are not on the plan, are open (or of unknown hours) that date and lie within reach of one of the day's outdoor stops.
 * "Open that date" follows the place's own facts where they speak (factsHours, Phase 11): a museum whose own site says it
 * is closed on Mondays is never a Monday swap, whatever Google says.
 * Straight-line distance only, no API call: a swap is a suggestion the owner can promote with a replan, never a stop.
 *   isIndoor(place)  → true | false | null   (the Place's own `indoor`, else its category; null = cannot tell)
 *   rainSwaps({ day, places, snapshots, exclude, used }) → [{ place, place_id, instead_of, km, hours }]
 */
import { hoursOn } from './planner-hours.mjs';
import { placeFacts, factsHours } from './planner-facts.mjs';
import { haversineKm, isLoc } from './planner-geo.mjs';
import { refineCategory, COVERED_SIGHTS, MEAL_CATEGORIES } from './planner-category.mjs';

export const MAX_SWAPS = 2;
/** How far (km, straight line) a swap may be from the outdoor stop it replaces, by the day's travel mode. */
export const SWAP_KM = Object.freeze({ WALK: 1.5, TRANSIT: 5, DRIVE: 20 });
export const INDOOR_CATEGORIES = Object.freeze(['museum', 'gallery', 'aquarium', 'shop', 'mall', 'cafe', 'restaurant', 'bar', 'church', 'theatre', 'cinema', 'library', 'onsen', 'spa', 'bathhouse', 'arcade', 'workshop', 'experience']);
export const OUTDOOR_CATEGORIES = Object.freeze(['viewpoint', 'hike', 'park', 'garden', 'beach', 'neighbourhood', 'trail', 'zoo', 'temple', 'shrine', 'castle', 'waterfall', 'lake', 'island']);
const SWAP_STATUSES = ['candidate', 'chosen', 'scheduled', 'saved-for-later'];

export function isIndoor(place) {
  if (!place) return null;
  if (typeof place.indoor === 'boolean') return place.indoor;
  const cat = refineCategory(place);
  if (INDOOR_CATEGORIES.includes(cat)) return true;
  if (OUTDOOR_CATEGORIES.includes(cat)) return false;
  return null;
}
/**
 * isCoveredSight(place) → true when a rainy-day swap may name it (Phase 10 fix (c)): a covered sight — museum, gallery,
 * aquarium, indoor market, a session that is not a meal — never a restaurant, cafe or bar (no swap beats a meal), never a
 * shop. A market counts only when the place itself says `indoor: true`; `indoor: false` always rules a place out.
 */
export function isCoveredSight(place) {
  if (!place || place.indoor === false) return false;
  const cat = refineCategory(place);
  if (MEAL_CATEGORIES.includes(cat)) return false;
  if (COVERED_SIGHTS.includes(cat)) return true;
  return place.indoor === true && cat !== 'shop' && cat !== 'mall';
}

const locOf = (snapshots, placeId) => { const s = snapshots.get(placeId); return s && isLoc(s.location) ? s.location : null; };

/**
 * rainSwaps({ day, places, snapshots, exclude, used })
 *   day       — the built DayPlan (its stops and mode)
 *   places    — the trip's Place records as given to the planner (their own statuses; `rejected` ones never swap in)
 *   snapshots — Map place_id → GoogleSnapshot (location, hours)
 *   exclude   — Set of slugs that may not swap in (scheduled anywhere, or skipped by the owner)
 *   used      — Set of slugs already offered on an earlier day; this call adds its picks, so a place is offered once
 * Nearest first; ties go to the higher priority (1 before 3), then the slug.
 */
export function rainSwaps({ day, places, snapshots, exclude = new Set(), used = new Set() }) {
  const bySlug = new Map(places.map((p) => [p.id, p]));
  const outdoor = day.stops.map((s) => ({ slug: s.place, loc: locOf(snapshots, s.place_id), p: bySlug.get(s.place) }))
    .filter((s) => s.loc && isIndoor(s.p) === false);
  if (!outdoor.length) return [];
  const reach = SWAP_KM[day.mode] || SWAP_KM.TRANSIT;
  const onDay = new Set(day.stops.map((s) => s.place));
  const options = [];
  for (const p of places) {
    if (!SWAP_STATUSES.includes(p.status) || exclude.has(p.id) || used.has(p.id) || onDay.has(p.id) || !isCoveredSight(p)) continue;
    const loc = locOf(snapshots, p.place_id);
    if (!loc) continue;
    const snap = snapshots.get(p.place_id);
    const h = factsHours(hoursOn(snap, day.date), placeFacts(p), day.date, snap, p.name).hours.status;
    if (h === 'closed' || h === 'closed_business') continue;
    let best = null;
    for (const o of outdoor) { const km = haversineKm(o.loc, loc); if (!best || km < best.km) best = { km, slug: o.slug }; }
    if (best.km > reach) continue;
    options.push({ place: p.id, place_id: p.place_id, instead_of: best.slug, km: Math.round(best.km * 10) / 10, hours: h === 'unknown' || h === 'irregular' ? 'unknown' : 'open', priority: p.priority || 2 });
  }
  options.sort((a, b) => a.km - b.km || a.priority - b.priority || a.place.localeCompare(b.place));
  const out = options.slice(0, MAX_SWAPS).map(({ priority, ...o }) => o);
  for (const o of out) used.add(o.place);
  return out;
}

// Developed by: LightAISolutions

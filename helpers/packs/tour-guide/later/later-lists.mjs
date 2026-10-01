/**
 * Tour Guide Later lists (plan §5.5) — named lists of places that were not scheduled, each with a reason code.
 * Default lists: "Didn't fit" (the planner's codes) and "Next time" (code "owner": the owner saved it). A place is in
 * at most one list: adding it again moves it. Every function returns new arrays and objects; inputs are never mutated.
 */
export const DIDNT_FIT = "Didn't fit";
export const NEXT_TIME = 'Next time';
export const LATER_CODES = Object.freeze(['closed_day', 'outside_hours', 'outside_day', 'day_full', 'too_far', 'closed_business', 'hours_unknown', 'owner', 'other']);
export const PLACE_STATUSES = Object.freeze(['candidate', 'scheduled', 'saved-for-later', 'rejected']);
const DESCRIPTIONS = Object.freeze({
  [DIDNT_FIT]: 'Places the planner could not fit into this trip, with the reason.',
  [NEXT_TIME]: 'Places you saved for another trip.'
});
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const PLACE_ID_RE = /^[A-Za-z0-9_-]{6,300}$/;

const copyLists = (lists) => lists.map((l) => ({ ...l, items: l.items.map((it) => ({ ...it })) }));

/** createLists(trip_id) → [LaterList "Didn't fit", LaterList "Next time"] (both empty). */
export function createLists(trip_id) {
  if (!SLUG_RE.test(String(trip_id || ''))) throw new TypeError('later: trip_id must be a slug');
  return [DIDNT_FIT, NEXT_TIME].map((name) => ({ v: 1, trip_id, name, description: DESCRIPTIONS[name], items: [] }));
}

/** defaultListFor('owner') → "Next time"; any other code → "Didn't fit". */
export const defaultListFor = (code) => (code === 'owner' ? NEXT_TIME : DIDNT_FIT);

/** findItem(lists, place) → { list, index, item } | null */
export function findItem(lists, place) {
  for (const list of lists) {
    const index = list.items.findIndex((it) => it.place === place);
    if (index >= 0) return { list: list.name, index, item: list.items[index] };
  }
  return null;
}

/** removeItem(lists, place) → lists without that place (unchanged copy when it is in no list). */
export function removeItem(lists, place) {
  return copyLists(lists).map((l) => ({ ...l, items: l.items.filter((it) => it.place !== place) }));
}

/**
 * addItem(lists, { place, place_id, reason, code, from_date?, list?, added_on }) → lists (new array).
 * The place leaves any list it was in; `list` defaults by code; an unknown list name is created.
 */
export function addItem(lists, { place, place_id, reason, code, from_date, list, added_on } = {}) {
  if (!Array.isArray(lists)) throw new TypeError('later: lists must be an array');
  if (!SLUG_RE.test(String(place || ''))) throw new TypeError('later: place must be a slug');
  if (!PLACE_ID_RE.test(String(place_id || ''))) throw new TypeError('later: place_id must be a Google place id');
  if (!reason || typeof reason !== 'string') throw new TypeError('later: a reason is required');
  if (!LATER_CODES.includes(code)) throw new TypeError(`later: code must be one of ${LATER_CODES.join(', ')}`);
  if (!DATE_RE.test(String(added_on || ''))) throw new TypeError('later: added_on must be YYYY-MM-DD');
  if (from_date !== undefined && from_date !== null && !DATE_RE.test(String(from_date))) throw new TypeError('later: from_date must be YYYY-MM-DD');
  const name = list || defaultListFor(code);
  const out = removeItem(lists, place);
  let target = out.find((l) => l.name === name);
  if (!target) {
    const trip_id = lists[0] && lists[0].trip_id;
    if (!trip_id) throw new TypeError(`later: cannot create list "${name}" without a trip_id (start from createLists())`);
    target = { v: 1, trip_id, name, items: [] };
    out.push(target);
  }
  const item = { place, place_id, reason: reason.slice(0, 300), code, added_on };
  if (from_date) item.from_date = from_date;
  target.items.push(item);
  return out;
}

/** setStatus(places, slug, status) → places (new array; the one place gets the status). */
export function setStatus(places, slug, status) {
  if (!PLACE_STATUSES.includes(status)) throw new TypeError(`later: status must be one of ${PLACE_STATUSES.join(', ')}`);
  if (!places.some((p) => p.id === slug)) throw new Error(`later: unknown place "${slug}"`);
  return places.map((p) => (p.id === slug ? { ...p, status } : { ...p }));
}

// Developed by: LightAISolutions

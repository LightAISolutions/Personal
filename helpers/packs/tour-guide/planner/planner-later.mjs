/**
 * Tour Guide planner — the default LaterLists: "Didn't fit" for planner drops, "Next time" for owner-saved places, and
 * "Saved by you" (created on first use) for places the owner kept for later from a shortlist (code owner_choice).
 */
export const DIDNT_FIT = "Didn't fit";
export const NEXT_TIME = 'Next time';
export const SAVED_BY_YOU = 'Saved by you';
const SAVED_BY_YOU_DESCRIPTION = 'Places you kept for later when you chose from the shortlist';

export function emptyLists(trip_id) {
  return [
    { v: 1, trip_id, name: DIDNT_FIT, description: 'Places the planner could not fit into this trip, with the reason', items: [] },
    { v: 1, trip_id, name: NEXT_TIME, description: 'Places you saved for another visit', items: [] }
  ];
}
/**
 * mergeLater({ trip_id, previous, pool, dropped, saved, today, kept?, refresh? }) → [LaterList]: previous items for
 * places outside `pool` (and outside `refresh`) are kept, pool places are re-decided; `kept` (places the owner kept for
 * later from a shortlist) go to "Saved by you" with code owner_choice.
 */
export function mergeLater({ trip_id, previous = null, pool, dropped, saved, today, kept = null, refresh = null }) {
  const lists = (previous && previous.length ? previous : emptyLists(trip_id)).map((l) => ({ ...l, items: l.items.filter((it) => !pool.has(it.place) && !(refresh && refresh.has(it.place))) }));
  const list = (name) => lists.find((l) => l.name === name) || (lists.push({ v: 1, trip_id, name, items: [] }), lists[lists.length - 1]);
  const has = (slug) => lists.some((l) => l.items.some((it) => it.place === slug));
  for (const d of dropped) {
    const item = { place: d.cand.id, place_id: d.cand.place_id, reason: d.reason, code: d.code, added_on: today };
    if (d.from_date) item.from_date = d.from_date;
    list(DIDNT_FIT).items.push(item);
  }
  if (kept && kept.length) {
    if (!lists.some((l) => l.name === SAVED_BY_YOU)) lists.push({ v: 1, trip_id, name: SAVED_BY_YOU, description: SAVED_BY_YOU_DESCRIPTION, items: [] });
    for (const k of kept) if (!has(k.id)) list(SAVED_BY_YOU).items.push({ place: k.id, place_id: k.place_id, reason: k.reason, code: 'owner_choice', added_on: today });
  }
  for (const p of saved) if (!has(p.id)) list(NEXT_TIME).items.push({ place: p.id, place_id: p.place_id, reason: 'saved by you for another visit', code: 'owner', added_on: today });
  return lists;
}

// Developed by: LightAISolutions

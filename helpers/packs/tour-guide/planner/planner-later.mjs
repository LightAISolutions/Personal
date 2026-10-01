/** Tour Guide planner — the two default LaterLists ("Didn't fit" for planner drops, "Next time" for owner-saved places). */
export const DIDNT_FIT = "Didn't fit";
export const NEXT_TIME = 'Next time';

export function emptyLists(trip_id) {
  return [
    { v: 1, trip_id, name: DIDNT_FIT, description: 'Places the planner could not fit into this trip, with the reason', items: [] },
    { v: 1, trip_id, name: NEXT_TIME, description: 'Places you saved for another visit', items: [] }
  ];
}
/** mergeLater({ trip_id, previous, pool, dropped, saved, today }) → [LaterList]: previous items for places outside `pool` are kept, pool places are re-decided. */
export function mergeLater({ trip_id, previous = null, pool, dropped, saved, today }) {
  const lists = (previous && previous.length ? previous : emptyLists(trip_id)).map((l) => ({ ...l, items: l.items.filter((it) => !pool.has(it.place)) }));
  const list = (name) => lists.find((l) => l.name === name) || (lists.push({ v: 1, trip_id, name, items: [] }), lists[lists.length - 1]);
  const has = (slug) => lists.some((l) => l.items.some((it) => it.place === slug));
  for (const d of dropped) {
    const item = { place: d.cand.id, place_id: d.cand.place_id, reason: d.reason, code: d.code, added_on: today };
    if (d.from_date) item.from_date = d.from_date;
    list(DIDNT_FIT).items.push(item);
  }
  for (const p of saved) if (!has(p.id)) list(NEXT_TIME).items.push({ place: p.id, place_id: p.place_id, reason: 'saved by you for another visit', code: 'owner', added_on: today });
  return lists;
}

// Developed by: LightAISolutions

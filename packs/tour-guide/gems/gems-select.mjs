/**
 * Gem Funnel — stage 5, shortlist selection and the "Gems not chosen" Later list (proposal §4; §5.9 step 3, decision 15).
 * Per group (activities 8, food 6): the 💎 floor by appetite is filled first from the gems, the rest by score; items
 * are then ordered by score. `decided` (slugs or place ids already shown or chosen) never appear. A group reports
 * `gems_shown < gems_wanted` as `floor_met: false` so the shortlist can say the floor could not be met.
 */
import { PER_GROUP_DEFAULT, APPETITE_DEFAULT, GEMS_NOT_CHOSEN_LIST, GEMS_NOT_CHOSEN_CODE, gemFloorFor, clampAppetite } from './gems-weights.mjs';
import { groupOf as defaultGroupOf, slugFor, SLUG_RE } from './gems-record.mjs';

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][Math.min(n % 10, 4) % 4] || 'th');
/** byScore: gem_score desc, gems first on a tie, then place_id asc — a total, deterministic order. */
export const byScore = (a, b) => (b.gem_score - a.gem_score) || ((b.gem === true) - (a.gem === true)) || (a.place_id < b.place_id ? -1 : a.place_id > b.place_id ? 1 : 0);

/** isDecided(record, decidedSet) → the record's place_id, slug or derived slug is in the set (exact, case-sensitive). */
export function isDecided(record, decidedSet) {
  return decidedSet.has(record.place_id) || (record.slug != null && decidedSet.has(record.slug)) || decidedSet.has(slugFor(record));
}

/**
 * selectShortlist(scored, { appetite = 3, per_group = { activities: 8, food: 6 }, decided = [], group_of = groupOf })
 *   → { groups: [{ id, items: [{ ...record, rank }], gems_wanted, gems_shown, floor_met }],
 *       not_shown: [{ place_id, slug, group, gem_score, gem, reason }], excluded: [place_id…] }
 */
export function selectShortlist(scored, opts = {}) {
  if (!Array.isArray(scored)) throw new Error('gems: selectShortlist needs the scored records as an array');
  const appetite = clampAppetite(opts.appetite ?? APPETITE_DEFAULT);
  const per_group = opts.per_group || PER_GROUP_DEFAULT;
  const group_of = opts.group_of || defaultGroupOf;
  const decided = new Set((opts.decided || []).map(String));
  for (const [id, n] of Object.entries(per_group)) if (!Number.isInteger(n) || n < 0) throw new Error(`gems: per_group.${id} must be a non-negative integer`);
  const floors = gemFloorFor(appetite);
  const buckets = Object.fromEntries(Object.keys(per_group).map((id) => [id, []]));
  const excluded = [];
  for (const r of scored) {
    if (typeof r.gem_score !== 'number') throw new Error(`gems: record ${r.place_id} has no gem_score (run scoreGems first)`);
    if (isDecided(r, decided)) { excluded.push(r.place_id); continue; }
    const g = group_of(r);
    if (!(g in buckets)) throw new Error(`gems: group_of returned "${g}", not one of ${Object.keys(per_group).join(', ')}`);
    buckets[g].push(r);
  }
  const groups = [], not_shown = [];
  for (const [id, size] of Object.entries(per_group)) {
    const ranked = buckets[id].slice().sort(byScore);
    const gems_wanted = Math.min(floors[id] ?? 0, size);
    const chosen = new Set();
    for (const r of ranked) { if (chosen.size >= gems_wanted) break; if (r.gem === true) chosen.add(r); }
    for (const r of ranked) { if (chosen.size >= size) break; chosen.add(r); }
    const items = ranked.filter((r) => chosen.has(r)).map((r, i) => ({ ...r, rank: i + 1 }));
    const gems_shown = items.filter((r) => r.gem === true).length;
    groups.push({ id, items, gems_wanted, gems_shown, floor_met: gems_shown >= gems_wanted });
    ranked.forEach((r, i) => {
      if (chosen.has(r)) return;
      const reason = `${r.gem === true ? 'Gem ranked' : 'Ranked'} ${ordinal(i + 1)} of ${ranked.length} in ${id} (score ${r.gem_score}); the round showed ${size}.`;
      not_shown.push({ place_id: r.place_id, slug: slugFor(r), group: id, gem_score: r.gem_score, gem: r.gem === true, reason });
    });
  }
  return { groups, not_shown, excluded };
}

/**
 * gemsNotChosenList({ trip_id, not_shown, today, name = 'Gems not chosen' }) → a LaterList
 *   { v: 1, trip_id, name, description, items: [{ place, place_id, reason, code: 'not_shown', added_on }] }
 * Highest scores first, at most 200 items (the schema's cap), slugs made unique.
 */
export function gemsNotChosenList({ trip_id, not_shown, today, name = GEMS_NOT_CHOSEN_LIST } = {}) {
  if (!SLUG_RE.test(String(trip_id || ''))) throw new Error('gems: trip_id must be a slug');
  if (!DATE_RE.test(String(today || ''))) throw new Error('gems: today must be YYYY-MM-DD');
  if (!Array.isArray(not_shown)) throw new Error('gems: not_shown must be an array (from selectShortlist)');
  const used = new Set();
  const items = not_shown.slice().sort((a, b) => (b.gem_score - a.gem_score) || (a.place_id < b.place_id ? -1 : 1)).slice(0, 200).map((x) => {
    let place = x.slug || slugFor(x), base = place.slice(0, 60), k = 2;
    while (used.has(place)) place = `${base}-${k++}`;
    used.add(place);
    return { place, place_id: x.place_id, reason: String(x.reason || 'Not shown in this round.').slice(0, 300), code: GEMS_NOT_CHOSEN_CODE, added_on: today };
  });
  return { v: 1, trip_id, name, description: 'Scored places that were not shown in a shortlist round, with the reason; /later can promote them.', items };
}

// Developed by: LightAISolutions

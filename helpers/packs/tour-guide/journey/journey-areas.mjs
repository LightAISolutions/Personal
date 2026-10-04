/**
 * Tour Guide journey — where the candidate places cluster and where the travellers sleep (no API call).
 *   journeyCandidates({ trip, places, snapshots, season, dinners? }) → [{ id, name, loc, category, priority, pick, covered, booking, open: { date: bool } }]
 *     (a meal place offered in `dinners` is an evening, not a sight: the planner keeps it for dinner, so it is no candidate)
 *   journeyDays(trip) → [{ date, mode, lodging, travel, start, end, note }]   (the planner's own day records underneath)
 *   staysOf(days) → [{ lodging, dates }]   (runs of nights at one lodging; a moving day belongs to where it ends)
 *   clusterStay(cands, stay, mode) → [{ key, name, centre, radius_km, members, km, day_trip, weight }]
 *   areaScore(cluster, date, season) → a number (open weight, the season's evening events and peak blooms)
 * Clusters are greedy: the strongest unclustered place (a ✅ pick first, then priority) seeds a cluster of every
 * unclustered place within CLUSTER_KM[mode] of it. A cluster whose centre is more than DAY_TRIP_FACTOR × AREA_KM[mode]
 * from the lodging is a day trip.
 */
import { buildDays, isIndoor, isCoveredSight, hoursOn, isWithheldDinner, AREA_KM, WEIGHT, FAR_KM } from '../planner/index.mjs';
import { haversineKm, centroid, isLoc } from '../planner/planner-geo.mjs';
import { placeFacts } from '../planner/planner-facts.mjs';
import { clip, LIMITS } from './journey-text.mjs';

export const CLUSTER_KM = Object.freeze({ WALK: 1, TRANSIT: 3, DRIVE: 15 });
export const DAY_TRIP_FACTOR = 1.5;
export const SCORE = Object.freeze({ PICK: 50, EVENT: 30, BLOOM: 20 });
const POOL = new Set(['candidate', 'scheduled', 'chosen']);
const BLOOM_CATEGORIES = new Set(['garden', 'park', 'viewpoint', 'hike', 'temple', 'shrine']);
const EVENING_KINDS = new Set(['light_up', 'special_opening', 'festival', 'market', 'exhibition', 'performance']);   // C15: every kind the planner may offer in the evening (planner-evening.mjs NOT_EVENING)

const snapMap = (s) => (s instanceof Map ? s : new Map((Array.isArray(s) ? s : []).filter((x) => x && x.place_id).map((x) => [x.place_id, x])));
const inRange = (e, date) => (!e.from || e.from <= date) && (!e.to || date <= e.to);

export function journeyDays(trip) {
  return buildDays(trip).map((d) => ({
    date: d.date, mode: d.mode, lodging: d.lodging_end, lodging_start: d.lodging_start,
    travel: d.lodging_start.id !== d.lodging_end.id || !!d.start || !!d.end, start: d.start || null, end: d.end || null, note: d.note || null
  }));
}

export function journeyCandidates({ trip, places, snapshots, season = trip.season, dinners = [] }) {
  const snaps = snapMap(snapshots);
  const dinnerIds = new Set((Array.isArray(dinners) ? dinners : []).filter((d) => d && d.id).map((d) => d.id));
  const dates = journeyDays(trip).map((d) => d.date);
  const closures = ((season && season.events) || []).filter((e) => e.kind === 'closure' && e.place);
  const out = [];
  for (const p of Array.isArray(places) ? places : []) {
    if (!p || !POOL.has(p.status) || isWithheldDinner(p, dinnerIds)) continue;
    const s = snaps.get(p.place_id);
    if (!s || !isLoc(s.location)) continue;
    const open = {};
    const pf = placeFacts(p);
    const irregular = p.opening_days === 'irregular' || !!(pf && pf.irregular);   // Phase 13 (B7): facts can say the opening days vary
    for (const date of dates) {
      const h = hoursOn(s, date, { irregular });
      open[date] = h.status !== 'closed' && h.status !== 'closed_business' && !closures.some((e) => e.place === p.id && inRange(e, date));
    }
    out.push({ id: p.id, name: p.name, loc: s.location, category: p.category, priority: [1, 2, 3].includes(p.priority) ? p.priority : 3, pick: p.status === 'chosen', covered: isIndoor(p) === true || isCoveredSight(p), booking: p.booking || null, open });
  }
  return out;
}

export function staysOf(days) {
  const out = [];
  for (const d of days) {
    const last = out[out.length - 1];
    if (last && last.lodging.id === d.lodging.id) last.dates.push(d.date);
    else out.push({ lodging: d.lodging, dates: [d.date], mode: d.mode });
  }
  return out;
}

const weightOf = (c) => WEIGHT[c.priority] + (c.pick ? SCORE.PICK : 0);
const strongest = (a, b) => (b.pick - a.pick) || (a.priority - b.priority) || a.id.localeCompare(b.id);

/** The clusters of the places nearest this stay's lodging (and within FAR_KM of it). */
export function clusterStay(cands, stay, mode, lodgings) {
  const r = CLUSTER_KM[mode] || CLUSTER_KM.TRANSIT;
  const mine = cands.filter((c) => {
    const km = haversineKm(c.loc, stay.lodging);
    return km <= FAR_KM[mode] && lodgings.every((l) => l.id === stay.lodging.id || haversineKm(c.loc, l) >= km);
  }).sort(strongest);
  const left = new Set(mine.map((c) => c.id));
  const clusters = [];
  for (const seed of mine) {
    if (!left.has(seed.id)) continue;
    const members = mine.filter((c) => left.has(c.id) && haversineKm(c.loc, seed.loc) <= r);
    members.forEach((c) => left.delete(c.id));
    const centre = centroid(members.map((c) => c.loc));
    const spread = Math.max(...members.map((c) => haversineKm(c.loc, centre)));
    const km = haversineKm(centre, stay.lodging);
    const hood = members.find((c) => c.category === 'neighbourhood');
    clusters.push({
      key: `${stay.lodging.id}:${clusters.length}`, name: clip(hood ? hood.name : `around ${seed.name}`, LIMITS.AREA),
      centre: { lat: round5(centre.lat), lng: round5(centre.lng) }, radius_km: Math.round(Math.min(AREA_KM[mode], Math.max(1, spread + 0.5)) * 10) / 10,
      members, km, day_trip: km > DAY_TRIP_FACTOR * AREA_KM[mode], weight: members.reduce((s, c) => s + weightOf(c), 0)
    });
  }
  return clusters.sort((a, b) => b.weight - a.weight || a.km - b.km || a.key.localeCompare(b.key));
}
const round5 = (x) => Math.round(x * 1e5) / 1e5;

/** How well a cluster suits a date: the weight of its places open that day, plus evening events and a peak bloom. */
export function areaScore(cl, date, season) {
  let s = cl.members.filter((c) => c.open[date]).reduce((t, c) => t + weightOf(c), 0);
  const events = ((season && season.events) || []).filter((e) => EVENING_KINDS.has(e.kind) && inRange(e, date));
  if (events.some((e) => (e.place && cl.members.some((c) => c.id === e.place)) || (isLoc(e) && haversineKm(e, cl.centre) <= cl.radius_km + 0.5))) s += SCORE.EVENT;
  if (bloomOn(season, date) && cl.members.some((c) => BLOOM_CATEGORIES.has(c.category) && !c.covered)) s += SCORE.BLOOM;
  return s;
}
/** The season's bloom at its best (peak or starting) on `date`, or null. */
export function bloomOn(season, date) {
  return ((season && season.bloom) || []).find((b) => (b.status === 'peak' || b.status === 'starting') && inRange(b, date)) || null;
}
/** The evening event of a cluster on a date (for the day's note), or null. */
export function eventOn(cl, date, season) {
  return ((season && season.events) || []).find((e) => EVENING_KINDS.has(e.kind) && inRange(e, date) && ((e.place && cl.members.some((c) => c.id === e.place)) || (isLoc(e) && haversineKm(e, cl.centre) <= cl.radius_km + 0.5))) || null;
}

// Developed by: LightAISolutions

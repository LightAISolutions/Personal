/**
 * Tour Guide journey — whole-journey outlines (suggestion 8). No API call: everything comes from the input.
 *   outlineDraft({ trip, places, snapshots, season?, profile?, choices?, dinners?, build_id? })
 *     → { payload (the `outline` payload: 1–3 options), areas: { <key>: { <date>: area | null } }, measure, reason? }
 *   outlineInput(draft, { base, mix? }) → the planner's `outline` input ({ by_date }) for the owner's choice
 * Fixed facts hold in every option: a moving day (a lodging change, or a day override with its own start or end) is
 * `travel`; a dated booking (trip.bookings with place and for_date, or a place's own booking) is an anchor on its date
 * and that date takes the booked place's area; ✅ picks are anchors on a day whose area holds them — a full day before a
 * light one, and a moving day only when no other day of that area has room (an arrival day does not hoard a stay's
 * sights). A meal place offered in `dinners` is an evening, not a sight: it is no candidate and anchors only its
 * booked date. A moving day spends part of a day in its area (the stay's nearest, or a booked place's): that area counts
 * half its weight when the stay's full days are handed out, and when another day of the stay already visits it, the
 * moving day goes to an area of picks no day visits instead. Each option's gives-up line first names the ✅ picks it
 * leaves out (anchored on no day and inside no open day's area). The options:
 *   A "Balanced days" — the strongest areas on their best dates, a rain-spare day (indoor places exist and the stay has
 *     at least RAIN_MIN free dates), a calm last day, no day trip;
 *   B "Full days" — every free date full, a day trip when there is one;
 *   C "Slow and easy" — about half the free dates in an area, the rest light near the lodging, a free day (the stay has
 *     at least FREE_MIN free dates), a rain-spare day and a calm last day.
 * The measure: two options differ on at least ceil(n / 3) of the n dates (area or kind). An option too close to one
 * already kept is dropped (a re-ordered Balanced option is tried last). When only Balanced is left (a short trip, or one
 * held by moving days, bookings and picks), the payload carries it alone and `reason` says why there is nothing to
 * compare: the core takes a one-option outline as it is and asks for the day versions, so the journey never stalls.
 */
import { normalizeChoices, applyChoices, isWithheldDinner, AREA_KM } from '../planner/index.mjs';
import { hm } from '../planner/planner-time.mjs';
import { haversineKm } from '../planner/planner-geo.mjs';
import { journeyDays, journeyCandidates, staysOf, clusterStay, areaScore, bloomOn, eventOn, CLUSTER_KM } from './journey-areas.mjs';
import { clip, cap, joinWords, LIMITS, KEYS } from './journey-text.mjs';

export const DRAFT = Object.freeze({ RAIN_MIN: 3, FREE_MIN: 4, COVERED_MIN: 2 });
const ANCHOR_RANK = Object.freeze({ full: 0, light: 1, travel: 2 });   // where a pick goes first among the days of its area
const OPEN_STATUS = new Set(['candidate', 'scheduled', 'chosen']);
const fail = (m) => { throw new Error('journey: ' + m); };
const BLOOM_WORDS = { autumn_leaves: 'the autumn leaves', cherry: 'the cherry blossom', plum: 'the plum blossom' };
const bloomWords = (b) => BLOOM_WORDS[b.kind] || `the ${String(b.kind).replace(/_/g, ' ')}`;

export function outlineDraft(input) {
  const { trip, snapshots, dinners = [] } = input || {};
  if (!trip || trip.v !== 1) fail('trip must be a v1 Trip');
  const season = input.season !== undefined ? input.season : trip.season || null;
  let places = Array.isArray(input.places) ? input.places : fail('places must be an array of Place');
  const ch = input.choices ? normalizeChoices(input.choices, places) : null;
  if (ch) places = applyChoices(places, ch, { explicit: true }).places;
  const build_id = String(input.build_id || `${trip.id}-outline`).slice(0, 80);
  const days = journeyDays(trip), dates = days.map((d) => d.date), n = dates.length;
  const dayOf = new Map(days.map((d) => [d.date, d]));
  const cands = journeyCandidates({ trip, places, snapshots, season, dinners });
  const byId = new Map(cands.map((c) => [c.id, c]));
  const stays = staysOf(days);
  const lodgings = stays.map((s) => s.lodging);
  for (const s of stays) { s.clusters = clusterStay(cands, s, s.mode, lodgings); s.home = s.clusters.slice().sort((a, b) => a.km - b.km)[0] || null; s.covered = s.clusters.reduce((t, c) => t + c.members.filter((m) => m.covered).length, 0); }
  const clusterOf = new Map();
  for (const s of stays) for (const cl of s.clusters) for (const m of cl.members) clusterOf.set(m.id, cl);

  // Dated anchors (every option): trip bookings with a place and a date, then places with their own booking date.
  const dinnerById = new Map((Array.isArray(dinners) ? dinners : []).filter((d) => d && d.id).map((d) => [d.id, d]));
  const dated = Object.fromEntries(dates.map((d) => [d, []]));
  const add = (date, slug, name, sight) => { if (dated[date] && !Object.values(dated).some((l) => l.some((a) => a.slug === slug))) dated[date].push({ slug, name: clip(name, LIMITS.NAME), sight }); };
  for (const b of Array.isArray(trip.bookings) ? trip.bookings : []) {
    if (!b || !b.place || !b.for_date) continue;
    const named = byId.get(b.place) || dinnerById.get(b.place) || places.find((p) => p && p.id === b.place);
    add(b.for_date, b.place, named ? named.name : b.title || b.place, byId.has(b.place));
  }
  for (const c of cands) if (c.booking && c.booking.date) add(c.booking.date, c.id, c.name, true);
  const dinnerIds = new Set(dinnerById.keys());   // a booked dinner the planner keeps for the evening: anchored on its date, never a sight
  for (const p of places) if (p && OPEN_STATUS.has(p.status) && p.booking && p.booking.date && isWithheldDinner(p, dinnerIds)) add(p.booking.date, p.id, p.name, false);
  const forced = {};
  for (const date of dates) { const a = dated[date].find((x) => x.sight && clusterOf.has(x.slug)); if (a) forced[date] = clusterOf.get(a.slug); }

  const styles = [
    { id: 'balanced', calm: true, rain: true, free: false, dayTrips: false, share: 1, order: 0 },
    { id: 'full', calm: false, rain: false, free: false, dayTrips: true, share: 1, order: 0 },
    { id: 'slow', calm: true, rain: true, free: true, dayTrips: false, share: 0.5, order: 0 },
    { id: 'reordered', calm: false, rain: true, free: false, dayTrips: false, share: 1, order: 1 }
  ];
  const lastDate = dates[n - 1];
  const compose = (st) => {
    const plan = {};
    for (const stay of stays) {
      for (const d of stay.dates) if (dayOf.get(d).travel) plan[d] = { kind: 'travel', cluster: forced[d] || stay.home, stay };
      if (st.calm && plan[lastDate] && plan[lastDate].stay === stay && !forced[lastDate]) plan[lastDate] = { kind: 'travel', cluster: null, near: true, calm: true, stay };   // a departure day kept calm, near the lodging
      const F = stay.dates.filter((d) => !plan[d]);
      const used = new Set();
      for (const d of F) if (forced[d]) { plan[d] = { kind: 'full', cluster: forced[d], stay }; used.add(forced[d].key); }
      let open = F.filter((d) => !plan[d]);
      const take = (d, v) => { plan[d] = { ...v, stay }; open = open.filter((x) => x !== d); };
      if (st.calm && open.includes(lastDate) && F.length >= 2) take(lastDate, { kind: 'light', cluster: stay.home, calm: true });
      if (st.free && F.length >= DRAFT.FREE_MIN) { const free = open.filter((d) => !dated[d].length); if (free.length) take(free[Math.floor(free.length / 2)], { kind: 'free', cluster: null }); }
      if (st.rain && F.length >= DRAFT.RAIN_MIN && stay.covered >= DRAFT.COVERED_MIN && open.length >= 2) take(open[open.length - 1], { kind: 'rain_spare', cluster: null });
      // A moving day already spends part of a day in its area: that area counts half its weight for the full days, so
      // an area no day visits takes a full day first (an equal weight goes to the area with no day).
      const moved = new Set(stay.dates.filter((d) => plan[d] && plan[d].kind === 'travel' && plan[d].cluster).map((d) => plan[d].cluster.key));
      const worth = (c) => (moved.has(c.key) ? c.weight / 2 : c.weight);
      let pool = stay.clusters.filter((c) => !used.has(c.key) && (st.dayTrips || !c.day_trip))
        .sort((a, b) => worth(b) - worth(a) || moved.has(a.key) - moved.has(b.key) || a.km - b.km || a.key.localeCompare(b.key));
      if (st.dayTrips) pool = [...pool.filter((c) => c.day_trip), ...pool.filter((c) => !c.day_trip)];
      if (st.order && pool.length > 1) pool = [...pool.slice(st.order), ...pool.slice(0, st.order)];
      let budget = Math.ceil(open.length * st.share);
      for (const cl of pool) {
        if (!budget || !open.length) break;
        const best = open.slice().sort((a, b) => areaScore(cl, b, season) - areaScore(cl, a, season) || a.localeCompare(b))[0];
        take(best, { kind: 'full', cluster: cl });
        used.add(cl.key); budget -= 1;
      }
      for (const d of open.slice()) take(d, { kind: st.share < 1 ? 'light' : 'full', cluster: null, near: true });
      // A moving day in an area that another day of the stay already gives time to goes to an area of picks no day
      // visits instead (one with a pick open that day), so a booked day by the lodging does not leave those picks out.
      for (const d of stay.dates) {
        const p = plan[d];
        if (p.kind !== 'travel' || !p.cluster || p.calm || forced[d]) continue;
        if (!stay.dates.some((x) => x !== d && plan[x].kind !== 'travel' && plan[x].cluster === p.cluster)) continue;
        const spare = stay.clusters.filter((c) => !c.day_trip && !stay.dates.some((x) => plan[x].cluster === c) && c.members.some((m) => m.pick && m.open[d]))
          .sort((a, b) => areaScore(b, d, season) - areaScore(a, d, season) || a.km - b.km || a.key.localeCompare(b.key))[0];
        if (spare) plan[d] = { ...p, cluster: spare };
      }
    }
    return plan;
  };
  const label = (date, p) => {
    const lodging = p.stay.lodging.name;
    if (p.kind === 'free') return clip(`free, near ${lodging}`, LIMITS.AREA);
    if (p.kind === 'rain_spare') return clip(`indoors near ${lodging}`, LIMITS.AREA);
    if (p.cluster) return clip(p.cluster.day_trip ? `day trip ${p.cluster.name}` : p.cluster.name, LIMITS.AREA);
    return clip(`near ${lodging}`, LIMITS.AREA);
  };
  const plannerArea = (date, p) => {
    const mode = dayOf.get(date).mode, lodging = p.stay.lodging;
    if (p.kind === 'free') return null;
    if (p.kind === 'rain_spare') return { name: label(date, p), lat: lodging.lat, lng: lodging.lng, radius_km: AREA_KM[mode] };
    if (p.cluster) return { name: label(date, p), lat: p.cluster.centre.lat, lng: p.cluster.centre.lng, radius_km: p.cluster.radius_km };
    return { name: label(date, p), lat: lodging.lat, lng: lodging.lng, radius_km: CLUSTER_KM[mode] };
  };
  const noteFor = (date, p) => {
    const d = dayOf.get(date);
    if (p.kind === 'travel') {
      const base = d.note || (d.start ? `starts at ${d.start.name} at ${hm(d.start.time)}` : d.end ? `ends at ${d.end.name} by ${hm(d.end.time)}` : `moving to ${d.lodging.name}`);
      return p.calm ? `a calm last day; ${base}` : base;
    }
    if (p.kind === 'free') return 'nothing planned';
    if (p.kind === 'rain_spare') return 'indoor places, kept for a rainy day';
    const ev = p.cluster && eventOn(p.cluster, date, season);
    if (ev) return `${ev.name} that evening`;
    const bloom = p.cluster && bloomOn(season, date);
    if (bloom && p.cluster.members.some((m) => !m.covered && ['garden', 'park', 'viewpoint', 'hike', 'temple', 'shrine'].includes(m.category))) return `${bloomWords(bloom)} at their best: go in the morning`;
    if (p.cluster && p.cluster.day_trip) return `a day trip, about ${Math.round(p.cluster.km)} km from ${p.stay.lodging.name}`;
    if (p.calm) return 'a calm last day';
    return null;
  };
  const anchorsFor = (plan) => {
    const out = Object.fromEntries(dates.map((d) => [d, p0(plan[d]).kind === 'free' ? [] : dated[d].map(({ slug, name }) => ({ slug, name }))]));
    const taken = new Set(Object.values(out).flat().map((a) => a.slug));
    for (const c of cands.filter((x) => x.pick && !taken.has(x.id)).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))) {
      const cl = clusterOf.get(c.id);
      const room = cl ? dates.filter((d) => plan[d].cluster === cl && ANCHOR_RANK[plan[d].kind] !== undefined && c.open[d] && out[d].length < LIMITS.ANCHORS) : [];
      const date = room.sort((a, b) => ANCHOR_RANK[plan[a].kind] - ANCHOR_RANK[plan[b].kind] || out[a].length - out[b].length || a.localeCompare(b))[0];
      if (date) { out[date].push({ slug: c.id, name: clip(c.name, LIMITS.NAME) }); taken.add(c.id); }
    }
    for (const d of dates) out[d] = out[d].slice(0, LIMITS.ANCHORS);
    return out;
  };
  const p0 = (x) => x || {};
  const sig = (plan) => Object.fromEntries(dates.map((d) => [d, `${plan[d].kind}|${label(d, plan[d])}`]));
  const min = Math.ceil(n / 3);
  const differs = (a, b) => dates.filter((d) => a[d] !== b[d]).length >= min;
  const kept = [];
  for (const st of styles) {
    if (kept.length === LIMITS.OPTIONS_MAX) break;
    const plan = compose(st);
    const s = sig(plan);
    if (kept.every((k) => differs(k.sig, s))) kept.push({ st, plan, sig: s });
  }
  const measure = { min_days: min, of: n };
  const allClusters = stays.flatMap((s) => s.clusters);
  const options = [], areas = {};
  kept.forEach((k, i) => {
    const key = KEYS[i];
    const anchors = anchorsFor(k.plan);
    areas[key] = {};
    const optDays = dates.map((date) => {
      const p = k.plan[date];
      areas[key][date] = plannerArea(date, p);
      const day = { date, area: label(date, p), kind: p.kind, anchors: anchors[date] };
      const note = noteFor(date, p);
      if (note) day.note = clip(note, LIMITS.NOTE);
      return day;
    });
    // The ✅ picks this option leaves out: anchored on no day and inside no open day's area (a rain-spare day takes
    // covered places only; a free day none). Its gives-up line names them first.
    const held = new Set(optDays.flatMap((d) => d.anchors.map((a) => a.slug)));
    const fits = (c, d) => { const a = areas[key][d]; return !!a && c.open[d] && (k.plan[d].kind !== 'rain_spare' || c.covered) && haversineKm(c.loc, a) <= a.radius_km; };
    const missed = cands.filter((c) => c.pick && !held.has(c.id) && !dates.some((d) => fits(c, d))).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    options.push({ key, ...words(k, optDays, allClusters, season, missed), days: optDays });
  });
  const payload = { v: 1, kind: 'outline', trip: trip.id, build_id, options };
  const fixed = [days.some((d) => d.travel) && 'moving days keep their trains and bag steps', Object.values(dated).some((l) => l.length) && 'booked places stay on their dates'].filter(Boolean);
  if (fixed.length) payload.notes = clip(cap(joinWords(fixed)) + '.', LIMITS.NOTES);
  const out = { payload, areas, measure };
  if (kept.length < LIMITS.OPTIONS_MIN) out.reason = `only one way to shape the trip: the other outlines differed on fewer than ${min} of the ${n} days`;
  return out;
}

/** The title, gains and gives-up lines of one option, from what it actually holds. */
/** "around X" (a day trip's too) stays as it is; a named area reads "in <area>". */
const where = (area) => { const a = area.replace(/^day trip /, ''); return /^(around|near|indoors) /.test(a) ? a : `in ${a}`; };

function words(k, optDays, allClusters, season, missed = []) {
  const plan = k.plan, ds = Object.keys(plan);
  const usedKeys = new Set(ds.map((d) => plan[d].cluster && plan[d].cluster.key).filter(Boolean));
  const lost = new Set(missed.map((c) => c.id));
  const dayTrips = [...new Set(ds.filter((d) => plan[d].cluster && plan[d].cluster.day_trip && plan[d].kind !== 'travel').map((d) => plan[d].cluster.name.replace(/^around /, '')))];
  const unusedTrips = allClusters.filter((c) => c.day_trip && !usedKeys.has(c.key)).map((c) => c.name.replace(/^around /, ''));
  const unused = allClusters.filter((c) => !c.day_trip && !usedKeys.has(c.key) && !c.members.some((m) => lost.has(m.id))).map((c) => c.name);   // an area of a lost pick is named by the pick
  const has = (kind) => optDays.some((d) => d.kind === kind);
  const calm = ds.some((d) => plan[d].calm);
  const bloom = optDays.find((d) => /at their best/.test(d.note || ''));
  const event = optDays.find((d) => /that evening$/.test(d.note || ''));
  const full = optDays.filter((d) => d.kind === 'full').length;
  const gains = [], gives = [];
  let title;
  if (k.st.id === 'full') {
    title = dayTrips.length ? `Full days, with a day trip to ${dayTrips[0]}` : 'Full days, more to see';
    if (dayTrips.length) gains.push(`a day trip to ${joinWords(dayTrips)}`);
    gains.push(`${full} full days and the most places seen`);
  } else if (k.st.id === 'slow') {
    title = 'Slow and easy';
    gains.push('unhurried days with time to rest');
    if (has('free')) gains.push('a free day');
  } else {
    title = k.st.id === 'reordered' ? 'Balanced days, another order' : 'Balanced days';
    gains.push('a steady pace');
  }
  if (has('rain_spare')) gains.push('a spare indoor day for rain');
  if (calm) gains.push('a calm last day');
  if (bloom) gains.push(`${bloom.note.replace(/: go in the morning$/, '').replace(/ at their best$/, '')} at their best ${where(bloom.area)}`);
  if (event) gains.push(`${event.note.replace(/ that evening$/, '')} on your day ${where(event.area)}`);
  if (!has('rain_spare')) gives.push('no spare day for rain');
  if (!calm && k.st.id === 'full') gives.push('long days to the end');
  if (unusedTrips.length) gives.push(`the day trip to ${joinWords(unusedTrips)}`);
  if (unused.length) gives.push(`less time ${joinWords(unused.slice(0, 3).map(where))}`);
  if (k.st.id === 'slow') gives.push('fewer places seen');
  const names = missed.map((c) => clip(c.name, LIMITS.PICK_NAME));
  const picks = names.length ? `Leaves out your ${names.length === 1 ? 'pick' : 'picks'} ${names.length <= 3 ? joinWords(names) : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`}.` : '';
  if (!gives.length && !picks) gives.push('a little time at each place');
  const rest = gives.length ? cap(joinWords(gives)) + '.' : '';
  return { title: clip(title, LIMITS.TITLE), gains: clip(cap(joinWords(gains)) + '.', LIMITS.GAINS), gives_up: clip([picks, rest].filter(Boolean).join(' '), LIMITS.GIVES_UP) };
}

/** The planner's `outline` input for the owner's choice: { base, mix? } (a later duplicate anchor yields to the earlier date). */
export function outlineInput(draft, choice) {
  if (!draft || !draft.payload || !Array.isArray(draft.payload.options)) fail('outlineInput needs an outlineDraft result with a payload');
  if (!choice || typeof choice !== 'object' || Array.isArray(choice)) fail('the choice must be { base, mix? }');
  const extra = Object.keys(choice).filter((k) => k !== 'base' && k !== 'mix');
  if (extra.length) fail(`the choice has unknown key(s) ${extra.join(', ')}`);
  const opts = new Map(draft.payload.options.map((o) => [o.key, o]));
  if (!opts.has(choice.base)) fail(`the choice's base "${choice.base}" is not an option`);
  const dates = opts.get(choice.base).days.map((d) => d.date);
  const mix = choice.mix || {};
  if (typeof mix !== 'object' || Array.isArray(mix)) fail('choice.mix must be { <date>: <key> }');
  for (const [d, k] of Object.entries(mix)) { if (!dates.includes(d)) fail(`choice.mix names ${d}, which is not a trip date`); if (!opts.has(k)) fail(`choice.mix gives ${d} the option "${k}", which does not exist`); }
  const by_date = {}, seen = new Set();
  for (const date of dates) {
    const key = mix[date] || choice.base;
    const day = opts.get(key).days.find((x) => x.date === date);
    const anchors = day.anchors.map((a) => a.slug).filter((s) => !seen.has(s));
    anchors.forEach((s) => seen.add(s));
    const area = draft.areas[key] && draft.areas[key][date];
    by_date[date] = { kind: day.kind, ...(area ? { area: { ...area } } : {}), ...(anchors.length ? { anchors } : {}) };
  }
  return { by_date };
}

// Developed by: LightAISolutions

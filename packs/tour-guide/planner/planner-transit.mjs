/**
 * Tour Guide planner — rail first on TRANSIT days. Unless the trip lists its own `transit_preferences.allowedTravelModes`,
 * the planner asks Google for train, metro and tram routes only. withBusFallback(maps) then re-asks without that limit
 * (buses allowed) for just the pairs that got no rail route, so a bus appears only where rail has nothing. Where Google
 * has no transit at all (Japan) one probe element says so and the wrapper stops re-asking; those legs stay with the
 * station-based train estimates (planner-rail.mjs), which never model buses.
 *   const tp = transitPrefs(trip);                       // { allowedTravelModes: ['TRAIN','SUBWAY','LIGHT_RAIL','RAIL'], … }
 *   const maps2 = withBusFallback(maps);                 // wrap before withRailEstimates
 */
export const RAIL_MODES = Object.freeze(['TRAIN', 'SUBWAY', 'LIGHT_RAIL', 'RAIL']);

/** The trip's transit preferences with rail first: the trip's own allowedTravelModes win, otherwise RAIL_MODES. */
export function transitPrefs(trip) {
  const t = (trip && trip.transit_preferences) || {};
  return Array.isArray(t.allowedTravelModes) && t.allowedTravelModes.length ? { ...t } : { ...t, allowedTravelModes: [...RAIL_MODES] };
}
/** True when `tp` limits TRANSIT to modes without buses. */
export const railOnly = (tp) => !!tp && Array.isArray(tp.allowedTravelModes) && tp.allowedTravelModes.length > 0 && !tp.allowedTravelModes.includes('BUS');
/** The same preferences with the mode limit lifted (routingPreference kept), or undefined when nothing is left. */
function anyMode(tp) {
  const { allowedTravelModes, ...rest } = tp; // eslint-disable-line no-unused-vars
  return Object.keys(rest).length ? rest : undefined;
}
const sameKey = (w) => JSON.stringify(w);

export function withBusFallback(maps) {
  let googleTransit = null; // null unknown · true Google returns transit here · false it does not (Japan)
  const stats = { bus_matrix_elements: 0, bus_routes: 0, probes: 0 };
  async function retryMatrix(opts, r) {
    const failed = r.elements.filter((e) => !e.ok && e.originIndex !== undefined && sameKey(opts.origins[e.originIndex]) !== sameKey(opts.destinations[e.destinationIndex]));
    if (!failed.length) return r;
    if (googleTransit === null) googleTransit = r.elements.some((e) => e.ok && sameKey(opts.origins[e.originIndex]) !== sameKey(opts.destinations[e.destinationIndex])) || null;
    let requests = r.requests || 0, units = r.units || 0;
    const loose = { ...opts, transitPreferences: anyMode(opts.transitPreferences) };
    if (loose.transitPreferences === undefined) delete loose.transitPreferences;
    if (googleTransit === null) { // all rail asks failed: one element tells whether Google has any transit here
      stats.probes += 1;
      const f = failed[0];
      const p = await maps.computeRouteMatrix({ ...loose, origins: [opts.origins[f.originIndex]], destinations: [opts.destinations[f.destinationIndex]] });
      requests += p.requests || 0; units += p.units || 0;
      googleTransit = p.elements.some((e) => e.ok);
      if (!googleTransit) return { ...r, requests, units };
    }
    if (!googleTransit) return r;
    const oi = [...new Set(failed.map((e) => e.originIndex))], di = [...new Set(failed.map((e) => e.destinationIndex))];
    const b = await maps.computeRouteMatrix({ ...loose, origins: oi.map((i) => opts.origins[i]), destinations: di.map((i) => opts.destinations[i]) });
    requests += b.requests || 0; units += b.units || 0;
    const got = new Map();
    for (const e of b.elements) if (e.ok && e.originIndex !== undefined) got.set(oi[e.originIndex] + '|' + di[e.destinationIndex], { ...e, originIndex: oi[e.originIndex], destinationIndex: di[e.destinationIndex], bus: true });
    stats.bus_matrix_elements += got.size;
    return { ...r, requests, units, elements: r.elements.map((e) => (!e.ok && got.has(e.originIndex + '|' + e.destinationIndex) ? got.get(e.originIndex + '|' + e.destinationIndex) : e)) };
  }
  return {
    ...maps,
    busStats: () => ({ ...stats, google_transit: googleTransit }),
    async computeRouteMatrix(opts) {
      const r = await maps.computeRouteMatrix(opts);
      return opts.travelMode === 'TRANSIT' && railOnly(opts.transitPreferences) && googleTransit !== false ? retryMatrix(opts, r) : r;
    },
    async computeRoutes(opts) {
      const r = await maps.computeRoutes(opts);
      if (opts.travelMode !== 'TRANSIT' || !railOnly(opts.transitPreferences) || googleTransit === false || (r.route && r.route.durationSec != null) || (opts.intermediates && opts.intermediates.length)) return r;
      const loose = { ...opts, transitPreferences: anyMode(opts.transitPreferences) };
      if (loose.transitPreferences === undefined) delete loose.transitPreferences;
      const b = await maps.computeRoutes(loose);
      if (googleTransit === null) googleTransit = !!(b.route && b.route.durationSec != null);
      if (!(b.route && b.route.durationSec != null)) return r;
      stats.bus_routes += 1;
      return { ...b, route: { ...b.route, bus: true } };
    }
  };
}

// Developed by: LightAISolutions

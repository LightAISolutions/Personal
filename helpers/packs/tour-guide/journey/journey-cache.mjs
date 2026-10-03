/**
 * Tour Guide journey — one Maps request per point pair across a version set. cachedMaps(maps) wraps a Maps-kit client:
 *   · computeRoutes: answered once per request (origin, destination, intermediates, mode, preferences); the departure
 *     time is not part of the key, so a leg between the same two points is asked once and its answer reused at another
 *     hour of the same day;
 *   · computeRouteMatrix: each origin → destination pair (per mode and preferences) is asked once; a matrix with new
 *     points asks only for the missing pairs, origins with the same missing destinations in one request;
 *   · errors are never cached; the ledger is the wrapped client's, so every unit is still counted before it is sent.
 *   stats() → { route_requests, route_hits, matrix_requests, matrix_units, pair_hits }
 */
const stable = (x) => {
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}';
  return JSON.stringify(x);
};
const clone = (x) => JSON.parse(JSON.stringify(x));

export function cachedMaps(maps) {
  if (!maps || typeof maps.computeRouteMatrix !== 'function' || typeof maps.computeRoutes !== 'function') throw new Error('journey: maps must be a Maps-kit client');
  const routes = new Map(), pairs = new Map(), skus = new Map();
  const stats = { route_requests: 0, route_hits: 0, matrix_requests: 0, matrix_units: 0, pair_hits: 0 };
  return {
    ...maps,
    stats: () => ({ ...stats }),
    async computeRoutes(opts) {
      const { departureTime, arrivalTime, ...rest } = opts || {}; // eslint-disable-line no-unused-vars
      const k = stable(rest);
      if (routes.has(k)) { stats.route_hits += 1; return clone(routes.get(k)); }
      const r = await maps.computeRoutes(opts);
      stats.route_requests += 1;
      routes.set(k, clone(r));
      return r;
    },
    async computeRouteMatrix(opts) {
      const { origins, destinations, departureTime, arrivalTime, ...rest } = opts || {}; // eslint-disable-line no-unused-vars
      if (!Array.isArray(origins) || !Array.isArray(destinations)) return maps.computeRouteMatrix(opts);
      const mk = stable(rest);
      const ok = origins.map(stable), dk = destinations.map(stable);
      const pk = (o, d) => mk + '|' + o + '|' + d;
      const missing = new Map();   // origin key → Set(destination key)
      const firstO = new Map(), firstD = new Map();
      origins.forEach((w, i) => { if (!firstO.has(ok[i])) firstO.set(ok[i], w); });
      destinations.forEach((w, i) => { if (!firstD.has(dk[i])) firstD.set(dk[i], w); });
      for (const o of firstO.keys()) for (const d of firstD.keys()) {
        if (o === d) continue;
        if (pairs.has(pk(o, d))) continue;
        if (!missing.has(o)) missing.set(o, new Set());
        missing.get(o).add(d);
      }
      const groups = new Map();   // the sorted destination keys → origin keys
      for (const [o, ds] of missing) { const g = [...ds].sort().join('\n'); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(o); }
      let requests = 0, units = 0;
      for (const [g, os] of groups) {
        const ds = g.split('\n');
        const r = await maps.computeRouteMatrix({ ...opts, origins: os.map((o) => firstO.get(o)), destinations: ds.map((d) => firstD.get(d)) });
        requests += r.requests || 0; units += r.units || 0;
        if (r.sku) skus.set(mk, r.sku);
        const got = new Map();
        for (const e of r.elements || []) if (e.originIndex !== undefined) got.set(e.originIndex + '|' + e.destinationIndex, e);
        os.forEach((o, i) => ds.forEach((d, j) => {
          const e = got.get(i + '|' + j);
          pairs.set(pk(o, d), e ? { durationSec: e.durationSec, distanceMeters: e.distanceMeters ?? null, condition: e.condition || null, ok: !!e.ok } : { durationSec: null, distanceMeters: null, condition: null, ok: false });
        }));
      }
      stats.matrix_requests += requests; stats.matrix_units += units;
      const elements = [];
      let hits = 0;
      ok.forEach((o, i) => dk.forEach((d, j) => {
        if (o === d) { elements.push({ originIndex: i, destinationIndex: j, durationSec: 0, distanceMeters: 0, condition: 'ROUTE_EXISTS', ok: true }); return; }
        const e = pairs.get(pk(o, d));
        elements.push({ originIndex: i, destinationIndex: j, ...e });
        hits += 1;
      }));
      stats.pair_hits += Math.max(0, hits - units);
      return { elements, requests, units, sku: skus.get(mk) || null };
    }
  };
}

// Developed by: LightAISolutions

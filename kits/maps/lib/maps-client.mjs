/**
 * Maps kit — the client the planner and skills use. Every method goes through the SKU ledger (hard stop before
 * sending) and a fixed field mask.
 *   const maps = createMapsClient({ ledgerPath: process.env.MAPS_USAGE_LEDGER });
 *   await maps.placeDetails(id, { tier: 'enterprise' });  await maps.textSearch('…', { tier: 'pro' });
 *   await maps.computeRoutes({ origin, destination, travelMode: 'WALK' });  await maps.computeRouteMatrix({ origins, destinations });
 * Options: transport (default: zero-dependency HTTPS through HTTPS_PROXY), ledger | ledgerPath (required unless
 * allowMemoryLedger: a live client must persist its counter), ceilings, apiKey (only outside Claude Code cloud, where
 * the proxy injects the key), timeoutMs.
 */
import { createLedger } from './maps-ledger.mjs';
import { createHttpsTransport } from './maps-transport.mjs';
import { placeDetails, textSearch } from './maps-places.mjs';
import { computeRoutes, computeRouteMatrix } from './maps-routes.mjs';
import { parseCeilingsEnv } from './maps-skus.mjs';

export function createMapsClient({ transport, ledger, ledgerPath, ceilings, apiKey = null, timeoutMs = 20000, allowMemoryLedger = false, env = process.env } = {}) {
  const path = ledgerPath || env.MAPS_USAGE_LEDGER || null;
  if (!ledger && !path && !allowMemoryLedger) throw new Error('maps: a usage ledger path is required (ledgerPath option or MAPS_USAGE_LEDGER); the counter must outlive this process');
  const led = ledger || createLedger({ path, ceilings: ceilings || parseCeilingsEnv(env.MAPS_SKU_CEILINGS) });
  const ctx = Object.freeze({ transport: transport || createHttpsTransport({ env }), ledger: led, apiKey: apiKey || null, timeoutMs });
  return {
    ledger: led,
    placeDetails: (placeId, opts) => placeDetails(ctx, placeId, opts),
    textSearch: (query, opts) => textSearch(ctx, query, opts),
    computeRoutes: (opts) => computeRoutes(ctx, opts),
    computeRouteMatrix: (opts) => computeRouteMatrix(ctx, opts),
    usage: (month) => led.usage(month)
  };
}

// Developed by: LightAISolutions

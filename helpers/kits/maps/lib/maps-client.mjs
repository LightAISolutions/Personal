/**
 * Maps kit — the client the planner and skills use. Every method goes through the SKU ledger (hard stop before
 * sending) and a fixed field mask.
 *   const maps = createMapsClient({ ledgerPath: process.env.MAPS_USAGE_LEDGER });
 *   await maps.placeDetails(id, { tier: 'enterprise' });  await maps.textSearch('…', { tier: 'pro' });
 *   await maps.computeRoutes({ origin, destination, travelMode: 'WALK' });  await maps.computeRouteMatrix({ origins, destinations });
 * Options: transport (default: zero-dependency HTTPS through HTTPS_PROXY), ledger | ledgerPath (required unless
 * allowMemoryLedger: a live client must persist its counter), ceilings, apiKey (only outside Claude Code cloud, where
 * the proxy injects the key), timeoutMs, staticKey / staticSigningSecret (Maps Static API; default env MAPS_STATIC_KEY and
 * MAPS_STATIC_SIGNING_SECRET — that host gets no key from the proxy, so the key goes in `key=` at send time only).
 */
import { createLedger } from './maps-ledger.mjs';
import { createHttpsTransport } from './maps-transport.mjs';
import { placeDetails, textSearch } from './maps-places.mjs';
import { computeRoutes, computeRouteMatrix } from './maps-routes.mjs';
import { parseCeilingsEnv } from './maps-skus.mjs';
import { staticMap } from './maps-static.mjs';
import { placePhoto } from './maps-photos.mjs';

export function createMapsClient({ transport, ledger, ledgerPath, ceilings, apiKey = null, timeoutMs = 20000, allowMemoryLedger = false, env = process.env, staticKey, staticSigningSecret } = {}) {
  const path = ledgerPath || env.MAPS_USAGE_LEDGER || null;
  if (!ledger && !path && !allowMemoryLedger) throw new Error('maps: a usage ledger path is required (ledgerPath option or MAPS_USAGE_LEDGER); the counter must outlive this process');
  const led = ledger || createLedger({ path, ceilings: ceilings || parseCeilingsEnv(env.MAPS_SKU_CEILINGS) });
  const ctx = Object.freeze({ transport: transport || createHttpsTransport({ env }), ledger: led, apiKey: apiKey || null, timeoutMs, staticKey: staticKey ?? env.MAPS_STATIC_KEY ?? null, staticSigningSecret: staticSigningSecret ?? env.MAPS_STATIC_SIGNING_SECRET ?? null });
  return {
    ledger: led,
    placeDetails: (placeId, opts) => placeDetails(ctx, placeId, opts),
    textSearch: (query, opts) => textSearch(ctx, query, opts),
    computeRoutes: (opts) => computeRoutes(ctx, opts),
    computeRouteMatrix: (opts) => computeRouteMatrix(ctx, opts),
    /** Maps Static API → { bytes (PNG), width, height, … }; SKU static_maps; refuses without a static key (code NO_KEY). */
    staticMap: (spec) => staticMap(ctx, spec),
    /** Place Photos (New) → { bytes, contentType, authorAttributions, … }; SKU places.details.photos (the media call); the image GET is free. */
    placePhoto: (photo, opts) => placePhoto(ctx, photo, opts),
    hasStaticKey: () => Boolean(ctx.staticKey),
    usage: (month) => led.usage(month)
  };
}

// Developed by: LightAISolutions

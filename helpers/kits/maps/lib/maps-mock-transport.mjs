/**
 * Maps kit — an in-memory transport for tests and the offline smoke. It answers from the hand-written fixtures in
 * ../fixtures/ (invented places, real API shapes) and records every request so tests can assert the mask, body and
 * headers that would have been sent. No network.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
export function fixture(name) { return JSON.parse(readFileSync(join(FIXTURES_DIR, `maps-fixture-${name}.json`), 'utf8')); }

/** Default fixture routing by endpoint (and travel mode / optimize flag for Compute Routes). */
export function fixtureResponder(req) {
  const u = new URL(req.url);
  const body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : null;
  if (u.hostname === 'places.googleapis.com' && u.pathname.endsWith(':searchText')) return { status: 200, body: fixture('text-search-pro') };
  if (u.hostname === 'places.googleapis.com' && u.pathname.startsWith('/v1/places/')) return { status: 200, body: fixture('place-details-enterprise') };
  if (u.pathname.endsWith('v2:computeRoutes')) {
    if (body?.travelMode === 'TRANSIT') return { status: 200, body: fixture('compute-routes-transit') };
    if (body?.optimizeWaypointOrder) return { status: 200, body: fixture('compute-routes-optimized') };
    return { status: 200, body: fixture('compute-routes-walk') };
  }
  if (u.pathname.endsWith('v2:computeRouteMatrix')) {
    const O = body.origins.length, D = body.destinations.length, out = [];
    for (let o = 0; o < O; o++) for (let d = 0; d < D; d++) out.push({ originIndex: o, destinationIndex: d, status: {}, condition: 'ROUTE_EXISTS', distanceMeters: 100 * (o + d), duration: `${60 * (o + d)}s` });
    return { status: 200, body: out };
  }
  return { status: 404, body: { error: { code: 404, message: 'fixture: no route for ' + u.pathname, status: 'NOT_FOUND' } } };
}

/** createMockTransport(responder = fixtureResponder) → transport with `.calls` (method, url, headers, body). */
export function createMockTransport(responder = fixtureResponder) {
  const calls = [];
  const transport = async (req) => {
    calls.push({ method: req.method, url: req.url, headers: { ...req.headers }, body: req.body ? JSON.parse(JSON.stringify(req.body)) : null });
    const r = await responder(req, calls.length);
    return { status: r.status, headers: { 'content-type': 'application/json' }, text: typeof r.body === 'string' ? r.body : JSON.stringify(r.body), ms: 1 };
  };
  transport.calls = calls;
  return transport;
}

// Developed by: LightAISolutions

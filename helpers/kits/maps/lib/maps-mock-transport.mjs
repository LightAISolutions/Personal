/**
 * Maps kit — an in-memory transport for tests and the offline smoke. It answers from the hand-written fixtures in
 * ../fixtures/ (invented places, real API shapes) and records every request so tests can assert the mask, body and
 * headers that would have been sent. No network.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stubFromStaticUrl, stubPhotoPng } from './maps-png-stub.mjs';

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
export function fixture(name) { return JSON.parse(readFileSync(join(FIXTURES_DIR, `maps-fixture-${name}.json`), 'utf8')); }

/** Default fixture routing by endpoint (field mask tier for Places searches and Details, travel mode / optimize flag for
 * Compute Routes, requested insights for the Places Aggregate API). */
export function fixtureResponder(req) {
  const u = new URL(req.url);
  const body = req.body ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) : null;
  const mask = String(req.headers?.['X-Goog-FieldMask'] || '');
  if (u.hostname === 'places.googleapis.com' && u.pathname.endsWith(':searchText')) return { status: 200, body: fixture(/\bplaces\.rating\b/.test(mask) ? 'text-search-enterprise' : 'text-search-pro') };
  if (u.hostname === 'places.googleapis.com' && u.pathname.endsWith(':searchNearby')) return { status: 200, body: fixture('nearby-search-enterprise') };
  if (u.hostname === 'areainsights.googleapis.com' && u.pathname === '/v1:computeInsights') {
    // INSIGHT_PLACES answers from the small-cell fixture (3 ids, count 3); INSIGHT_COUNT alone from the count fixture (37).
    const want = body?.insights || [], small = want.includes('INSIGHT_PLACES') ? fixture('aggregate-places') : null, out = {};
    if (want.includes('INSIGHT_COUNT')) out.count = small ? small.count : fixture('aggregate-count').count;
    if (small) out.placeInsights = small.placeInsights;
    return { status: 200, body: out };
  }
  if (u.hostname === 'places.googleapis.com' && /^\/v1\/places\/[^/]+\/photos\/[^/]+\/media$/.test(u.pathname)) return { status: 200, body: { name: u.pathname.slice(4, -6), photoUri: 'https://photos.example.com/fixture/' + u.pathname.split('/')[5] + '?w=' + (u.searchParams.get('maxWidthPx') || '') } };
  if (u.hostname === 'photos.example.com') { const w = Number(u.searchParams.get('w')) || 1200; return { status: 200, contentType: 'image/png', bytes: stubPhotoPng({ width: Math.min(w, 1200), height: Math.round(Math.min(w, 1200) * 2 / 3), seed: u.pathname.length }) }; }
  if (u.hostname === 'places.googleapis.com' && u.pathname.startsWith('/v1/places/')) return { status: 200, body: fixture(/(^|,)reviews(,|$)/.test(mask) ? 'place-details-atmosphere' : 'place-details-enterprise') };
  if (u.pathname.endsWith('v2:computeRoutes')) {
    if (body?.travelMode === 'TRANSIT') return { status: 200, body: fixture('compute-routes-transit') };
    if (body?.optimizeWaypointOrder) return { status: 200, body: fixture('compute-routes-optimized') };
    return { status: 200, body: fixture('compute-routes-walk') };
  }
  if (u.hostname === 'maps.googleapis.com' && u.pathname === '/maps/api/staticmap') {
    if (!u.searchParams.get('key')) return { status: 403, contentType: 'text/plain', body: 'The Google Maps Platform server rejected your request. You must use an API key to authenticate each request to Google Maps Platform APIs.' };
    return { status: 200, contentType: 'image/png', bytes: stubFromStaticUrl(req.url) };
  }
  if (u.pathname.endsWith('v2:computeRouteMatrix')) {
    const O = body.origins.length, D = body.destinations.length, out = [];
    for (let o = 0; o < O; o++) for (let d = 0; d < D; d++) out.push({ originIndex: o, destinationIndex: d, status: {}, condition: 'ROUTE_EXISTS', distanceMeters: 100 * (o + d), duration: `${60 * (o + d)}s` });
    return { status: 200, body: out };
  }
  return { status: 404, body: { error: { code: 404, message: 'fixture: no route for ' + u.pathname, status: 'NOT_FOUND' } } };
}

/** createMockTransport(responder = fixtureResponder) → transport with `.calls` (method, url, headers, body). A responder
 * answers { status, body } (JSON or string) or { status, bytes, contentType } for binary answers such as a static map. */
export function createMockTransport(responder = fixtureResponder) {
  const calls = [];
  const transport = async (req) => {
    calls.push({ method: req.method, url: req.url, headers: { ...req.headers }, body: req.body ? JSON.parse(JSON.stringify(req.body)) : null });
    const r = await responder(req, calls.length);
    const text = r.bytes ? r.bytes.toString('utf8') : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    return { status: r.status, headers: { 'content-type': r.contentType || 'application/json' }, text, bytes: r.bytes || Buffer.from(text, 'utf8'), ms: 1 };
  };
  transport.calls = calls;
  return transport;
}

// Developed by: LightAISolutions

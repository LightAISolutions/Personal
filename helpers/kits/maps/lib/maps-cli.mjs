/**
 * Maps kit — command-line front end. Network commands (details, search, route, matrix, smoke --live) refuse to run
 * without --live and without a ledger path (--ledger or MAPS_USAGE_LEDGER), so nothing reaches Google by accident and
 * every call is counted in a file that outlives the process.
 */
import { createMapsClient } from './maps-client.mjs';
import { createLedger } from './maps-ledger.mjs';
import { createMockTransport } from './maps-mock-transport.mjs';
import { PLACE_DETAILS_MASKS, TEXT_SEARCH_MASKS, ROUTE_MASKS, ROUTE_MATRIX_MASK, PLACE_DETAILS_SKU, TEXT_SEARCH_SKU } from './maps-masks.mjs';
import { SKUS, DEFAULT_CEILINGS, parseCeilingsEnv } from './maps-skus.mjs';
import { openSnapshotStore, toSnapshot } from './maps-snapshots.mjs';
import { directionsUrl, placeUrl } from './maps-urls.mjs';
import { staticMapRequest } from './maps-static.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

export const USAGE = `usage: node helpers/kits/maps/index.mjs <command> [options]
  masks                                         print the fixed field masks and their SKUs
  usage   --ledger P [--month YYYY-MM]          SKU counts, ceilings and free caps for a month
  purge   --store P [--now ISO] [--latlng-days N] [--content-hours N]
  url     dir|place --json '<spec>'             Maps URL (see README); no network
  details <placeId> [--tier T] --live --ledger P
  search  <query> [--tier T] [--page-size N] --live --ledger P
  route   --json '<computeRoutes spec>' --live --ledger P
  matrix  --json '<computeRouteMatrix spec>' --live --ledger P
  smoke   [--live --ledger P]                   1 Text Search + 1 Place Details + 1 Compute Routes (offline: fixtures)
  photo   <photoName> <out> [--max-width N] --live --ledger P   one Place Photo (SKU places.details.photos); --mock offline
  static-url <spec.json>                        Maps Static API URL for a spec, no key, no network (length + reductions)
  static-map <spec.json> <out.png> --live --ledger P   fetch one static map (SKU static_maps); --mock draws a stand-in offline
env: MAPS_USAGE_LEDGER (ledger path), MAPS_SKU_CEILINGS ("sku=n,sku=n"), MAPS_SNAPSHOT_STORE (store path),
     MAPS_STATIC_KEY (Maps Static API key, sent as key= — the proxy injects none), MAPS_STATIC_SIGNING_SECRET (optional)`;

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') out.live = true;
    else if (a === '--mock') out.mock = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}
const print = (o) => console.log(typeof o === 'string' ? o : JSON.stringify(o, null, 2));
export function formatUsage(u) {
  const lines = [`maps usage ${u.month} (${u.tz})`, 'sku'.padEnd(40) + 'units'.padStart(7) + 'reqs'.padStart(6) + 'fail'.padStart(6) + 'ceiling'.padStart(9) + 'free'.padStart(8)];
  for (const r of u.skus) lines.push(r.sku.padEnd(40) + String(r.units).padStart(7) + String(r.requests).padStart(6) + String(r.failed).padStart(6) + String(r.ceiling).padStart(9) + String(r.free ?? '∞').padStart(8));
  return lines.join('\n');
}

/** Keys only, nested one level — what a live smoke reports instead of content. */
export function fieldsOf(o) {
  if (!o || typeof o !== 'object') return [];
  return Object.keys(o).sort();
}

/**
 * smoke({ client, query, routeTo, log }) — exactly three calls: Text Search (Pro, pageSize 1) → Place Details
 * (Enterprise) on the first result → Compute Routes (WALK, Essentials) from that place to `routeTo`. Returns a summary
 * with statuses, latencies, returned field names and SKUs; never place ids or content.
 */
export async function smoke({ client, query, routeTo, log = () => {} }) {
  const steps = [];
  const step = async (name, fn) => {
    const t = Date.now();
    try { const r = await fn(); steps.push({ name, ok: true, ms: r.ms ?? Date.now() - t, sku: r.sku, fields: r.fields }); log(`ok   ${name} (${r.sku}, ${r.ms ?? Date.now() - t} ms) fields: ${r.fields.join(', ')}`); return r; }
    catch (e) { steps.push({ name, ok: false, code: e.code || 'ERROR', status: e.status ?? null, message: e.message }); log(`FAIL ${name}: ${e.message}`); return null; }
  };
  const s = await step('text_search', async () => { const r = await client.textSearch(query, { tier: 'pro', pageSize: 1 }); return { ...r, fields: fieldsOf(r.places[0]), id: r.places[0]?.id }; });
  const id = s?.id;
  if (id) await step('place_details', async () => { const r = await client.placeDetails(id, { tier: 'enterprise' }); return { ...r, fields: fieldsOf(r.place) }; });
  if (id) await step('compute_routes', async () => { const r = await client.computeRoutes({ origin: { placeId: id }, destination: routeTo, travelMode: 'WALK' }); return { ...r, fields: fieldsOf(r.route), summary: r.route && { durationSec: r.route.durationSec, distanceMeters: r.route.distanceMeters } }; });
  return { ok: steps.length === 3 && steps.every((x) => x.ok), steps, usage: client.usage() };
}

export const SMOKE_DEFAULTS = Object.freeze({ query: 'Eiffel Tower, Paris', routeTo: { address: 'Arc de Triomphe, Place Charles de Gaulle, Paris' } });

function needLive(a) {
  if (!a.live) { console.error('refused: this command calls Google; add --live to mean it'); return false; }
  if (!(a.ledger || process.env.MAPS_USAGE_LEDGER)) { console.error('refused: give --ledger <path> or MAPS_USAGE_LEDGER so the SKU counter persists'); return false; }
  return true;
}
const liveClient = (a) => createMapsClient({ ledgerPath: a.ledger || process.env.MAPS_USAGE_LEDGER, ceilings: parseCeilingsEnv(process.env.MAPS_SKU_CEILINGS) });
const json = (s) => { try { return JSON.parse(s); } catch { throw new Error('--json is not valid JSON'); } };

export async function runCli(argv) {
  const a = parseArgs(argv);
  const cmd = a._[0];
  try {
    switch (cmd) {
      case 'masks':
        print({ place_details: Object.fromEntries(Object.entries(PLACE_DETAILS_MASKS).map(([t, m]) => [t, { sku: PLACE_DETAILS_SKU[t], mask: m }])), text_search: Object.fromEntries(Object.entries(TEXT_SEARCH_MASKS).map(([t, m]) => [t, { sku: TEXT_SEARCH_SKU[t], mask: m }])), routes: ROUTE_MASKS, route_matrix: ROUTE_MATRIX_MASK, skus: SKUS, default_ceilings: DEFAULT_CEILINGS });
        return 0;
      case 'usage': {
        const path = a.ledger || process.env.MAPS_USAGE_LEDGER;
        if (!path) { console.error(USAGE); return 2; }
        print(formatUsage(createLedger({ path, ceilings: parseCeilingsEnv(process.env.MAPS_SKU_CEILINGS) }).usage(a.month)));
        return 0;
      }
      case 'purge': {
        const path = a.store || process.env.MAPS_SNAPSHOT_STORE;
        if (!path) { console.error(USAGE); return 2; }
        const opts = { now: a.now ? new Date(a.now) : new Date() };
        if (a['latlng-days'] != null) opts.latLngMaxDays = Number(a['latlng-days']);
        if (a['content-hours'] != null) opts.contentMaxAgeHours = Number(a['content-hours']);
        print(openSnapshotStore({ path }).purge(opts));
        return 0;
      }
      case 'url': {
        const spec = json(a.json || '{}');
        if (a._[1] === 'dir') print(directionsUrl(spec)); else if (a._[1] === 'place') print(placeUrl(spec)); else { console.error(USAGE); return 2; }
        return 0;
      }
      case 'details': case 'search': case 'route': case 'matrix': {
        if (!needLive(a)) return 2;
        const c = liveClient(a);
        if (cmd === 'details') { const r = await c.placeDetails(a._[1], { tier: a.tier }); print(r.place); if (a.store) openSnapshotStore({ path: a.store }).put(toSnapshot(r.place, { buildId: a.build || 'adhoc' })); }
        if (cmd === 'search') print((await c.textSearch(a._.slice(1).join(' '), { tier: a.tier, pageSize: a['page-size'] ? Number(a['page-size']) : undefined })));
        if (cmd === 'route') print((await c.computeRoutes(json(a.json))));
        if (cmd === 'matrix') print((await c.computeRouteMatrix(json(a.json))));
        return 0;
      }
      case 'photo': {
        if (!a._[1] || !a._[2]) { console.error(USAGE); return 2; }
        let client;
        if (a.mock) client = createMapsClient({ transport: createMockTransport(), allowMemoryLedger: true, env: {} });
        else { if (!needLive(a)) return 2; client = liveClient(a); }
        const r = await client.placePhoto(a._[1], { maxWidthPx: a['max-width'] ? Number(a['max-width']) : undefined });
        writeFileSync(a._[2], r.bytes);
        console.error(`${a.mock ? 'stand-in' : 'fetched'} ${r.contentType} (${r.bytes.length} bytes) → ${a._[2]}; photo by ${r.authorAttributions.map((x) => x.displayName || 'unnamed').join(', ') || 'unknown'}`);
        return 0;
      }
      case 'static-url': {
        if (!a._[1]) { console.error(USAGE); return 2; }
        const r = staticMapRequest(JSON.parse(readFileSync(a._[1], 'utf8')));
        print({ url: r.url, chars: r.url.length, pixels: `${r.pixelWidth}x${r.pixelHeight}`, notes: r.notes });
        return 0;
      }
      case 'static-map': {
        if (!a._[1] || !a._[2]) { console.error(USAGE); return 2; }
        const spec = JSON.parse(readFileSync(a._[1], 'utf8'));
        let client;
        if (a.mock) client = createMapsClient({ transport: createMockTransport(), allowMemoryLedger: true, staticKey: 'mock', env: {} });
        else { if (!needLive(a)) return 2; client = liveClient(a); if (!client.hasStaticKey()) { console.error('refused: MAPS_STATIC_KEY is not set (the egress proxy injects no key for maps.googleapis.com)'); return 2; } }
        const r = await client.staticMap(spec);
        writeFileSync(a._[2], r.bytes);
        console.error(`${a.mock ? 'stand-in' : 'fetched'} ${r.width}x${r.height} ${r.contentType} (${r.bytes.length} bytes) → ${a._[2]}${r.notes.length ? '; ' + r.notes.join('; ') : ''}`);
        return 0;
      }
      case 'smoke': {
        let client;
        if (a.live) { if (!needLive(a)) return 2; client = liveClient(a); }
        else client = createMapsClient({ transport: createMockTransport(), allowMemoryLedger: true });
        console.log(a.live ? 'maps smoke: LIVE (3 calls)' : 'maps smoke: offline, fixture transport (add --live --ledger P for real calls)');
        const r = await smoke({ client, query: a.query || SMOKE_DEFAULTS.query, routeTo: a.to ? { address: a.to } : SMOKE_DEFAULTS.routeTo, log: (l) => console.log('  ' + l) });
        console.log(formatUsage(r.usage).split('\n').filter((l, i) => i < 2 || !/\s0\s+0\s+0\s/.test(l)).join('\n'));
        return r.ok ? 0 : 1;
      }
      default:
        console.error(USAGE);
        return 2;
    }
  } catch (e) {
    console.error(`${e.code || 'ERROR'}: ${e.message}`);
    return 1;
  }
}

// Developed by: LightAISolutions

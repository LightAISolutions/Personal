# Maps kit (`helpers/kits/maps/`)

Places API (New) + Routes API client for helpers: **fixed field masks**, a **SKU counter with a hard stop**, a **GoogleSnapshot store with a terms-driven purge**, and a **Google Maps URL builder**. Zero runtime dependencies (Node ≥ 22). Built in Phase 2a; consumed by the Tour Guide planner (Phase 3) and skills (Phase 4). Choices and findings: `helpers/decisions/WP-2a.md`.

## Library

```js
import { createMapsClient, directionsUrl, placeUrl, dayUrl, openSnapshotStore, toSnapshot } from '../vendor/helpers/kits/maps/index.mjs';
const maps = createMapsClient({ ledgerPath: process.env.MAPS_USAGE_LEDGER });          // ledger path is required
const { place } = await maps.placeDetails(placeId, { tier: 'enterprise' });             // essentials | pro | enterprise | enterprise_atmosphere
const { places, nextPageToken } = await maps.textSearch('lantern museum', { tier: 'pro', pageSize: 10, locationBias: { lat, lng, radiusMeters: 3000 } }); // ids_only | pro | enterprise
const { route } = await maps.computeRoutes({ origin: { placeId }, destination: { lat, lng }, intermediates: [...], optimizeWaypointOrder: true, travelMode: 'WALK' });
const { route: leg } = await maps.computeRoutes({ origin, destination, travelMode: 'TRANSIT', departureTime: '2026-10-06T09:00:00Z', transitPreferences: { allowedTravelModes: ['SUBWAY', 'BUS'] } });
const { elements } = await maps.computeRouteMatrix({ origins, destinations, travelMode: 'TRANSIT', departureTime });   // split automatically past the caps
```

Waypoints are `{ placeId }`, `{ lat, lng }` or `{ address }`. Results are normalized (`durationSec`, `distanceMeters`, `legs`, `optimizedOrder`, matrix `elements` with global `originIndex` / `destinationIndex`). Errors are typed with a stable `code`: `SKU_CEILING` (`MapsBudgetError`, nothing was sent), `BAD_INPUT` (`MapsInputError`, nothing was sent), `AUTH` / `QUOTA` / `UPSTREAM` / `HTTP_<n>` / `NETWORK` / `TIMEOUT` / `PROXY_REFUSED` / `BAD_JSON` (`MapsRequestError`).

## Field masks and SKUs (one call = one SKU)

Callers choose a **tier name**, never a field list; the masks are frozen constants in `lib/maps-masks.mjs` (`node helpers/kits/maps/index.mjs masks` prints them). Masks are cumulative, and a test proves each one's highest field tier equals its name, so every request bills exactly one known SKU.

| Call | Tier → SKU | Free / month | Kit ceiling (default) |
|---|---|---|---|
| Place Details | `essentials` · `pro` · `enterprise` · `enterprise_atmosphere` | 10,000 · 5,000 · 1,000 · 1,000 | 8,000 · 4,000 · 800 · 800 |
| Text Search | `ids_only` · `pro` · `enterprise` (there is no non-ID Essentials Text Search) | ∞ · 5,000 · 1,000 | 2,000 (loop guard) · 4,000 · 800 |
| Compute Routes | Essentials; **Pro** when `optimizeWaypointOrder`, 11–25 intermediates, or `TRAFFIC_AWARE*` | 10,000 · 5,000 | 8,000 · 4,000 |
| Compute Route Matrix (per **element**) | Essentials; Pro with `TRAFFIC_AWARE*` | 10,000 · 5,000 | 8,000 · 4,000 |

Not exposed (so no call can bill Enterprise or turn Pro by accident): two-wheeler routing, tolls, traffic on polylines, location modifiers (heading, side of road, vehicle stopover), `via` waypoints. Prices per SKU are in `lib/maps-skus.mjs` (pricing page of 2026-09-28).

Request rules enforced before sending: ≤ 25 intermediates; `TRANSIT` takes no intermediates (fetch legs pair by pair) but takes `departureTime` / `arrivalTime` and `transitPreferences`; `routingPreference` only with `DRIVE`; `optimizeWaypointOrder` needs ≥ 2 intermediates and not `TRAFFIC_AWARE_OPTIMAL`. Route Matrix: ≤ 625 elements per request, ≤ 100 for `TRANSIT` or `TRAFFIC_AWARE_OPTIMAL`, ≤ 50 origins + destinations when any is a place id or address — bigger matrices are split into several requests (`chunk: false` refuses instead).

## The SKU counter (hard stop)

Every call reserves its units (requests, or elements for Route Matrix) on the **usage ledger before it is sent**; if that would pass the SKU's monthly ceiling the call throws `MapsBudgetError` and nothing goes out. A whole matrix is checked before its first request. Failed calls still count (conservative) and are annotated `failed`. Months are billing months in `America/Los_Angeles`.

The ledger is a JSON file **the caller names** — `ledgerPath` / `--ledger` / `MAPS_USAGE_LEDGER` — because routines run in throwaway containers; keep it in the helper's private repo (e.g. a memory directory) and commit it with the run. Format v1:

```json
{ "v": 1, "kind": "maps-usage-ledger", "tz": "America/Los_Angeles", "updated_at": "…",
  "months": { "2026-10": { "places.details.enterprise": { "units": 3, "requests": 3, "failed": 0 } } } }
```

Ceilings: `ceilings` option or `MAPS_SKU_CEILINGS="places.details.enterprise=300,routes.compute_routes.pro=50"`; `0` blocks a SKU. The counter only sees calls made through this kit.

## Snapshots and the purge (Maps terms, read 2026-10-01)

The Service Specific Terms allow caching **place ids indefinitely** and **latitude/longitude from the Places API and the Routes API for up to 30 consecutive calendar days**; no other Places content (hours, rating, website, address, names) has a caching permission. So a `GoogleSnapshot` (`toSnapshot(place, { buildId })`) holds `place_id`, `location`, `fetched_at` and a `content` block, and `purge()`:
- drops every record older than **30 days** (`latLngMaxDays`, cannot be raised above 30);
- strips `content` older than `contentMaxAgeHours` — default **0**: content is build-scoped, so call `purge` at the end of each build and let the next build fetch fresh data.

Store file (`openSnapshotStore({ path })`, `MAPS_SNAPSHOT_STORE`): `{ "v": 1, "kind": "maps-snapshot-store", "records": [ … ] }`. Keep it outside any public repo.

## Maps URLs (no key, no billing)

`directionsUrl({ origin?, destination, waypoints?, travelMode?, navigate? })`, `placeUrl({ name?, address?, lat?, lng?, placeId? })`, `dayUrl(stops, travelMode)` build `https://www.google.com/maps/dir/?api=1&…` and `…/search/?api=1&query=…&query_place_id=…` links with every value URL-encoded and waypoints joined by `%7C`. ≤ 9 waypoints; transit links take none.

## Network and keys

- **Claude Code cloud (Claude HQ):** the egress proxy injects the Maps key as `X-Goog-Api-Key` for `places.googleapis.com` and `routes.googleapis.com`; the client sends **no key**. The transport tunnels through `HTTPS_PROXY` with `CONNECT` and verifies TLS against the CA Node loads from `NODE_EXTRA_CA_CERTS`; it never disables verification. (Built-in `fetch` is not used: on Node 22 it ignores `HTTPS_PROXY` without `NODE_USE_ENV_PROXY=1`, and a direct connection gets no key.)
- **Elsewhere:** pass `apiKey` to `createMapsClient` from the caller's own secret store. The kit never reads a key from a file, never logs headers, and keeps keys out of errors.

## CLI

```
node helpers/kits/maps/index.mjs masks
node helpers/kits/maps/index.mjs usage  --ledger <file> [--month YYYY-MM]
node helpers/kits/maps/index.mjs purge  --store <file> [--now ISO] [--latlng-days N] [--content-hours N]
node helpers/kits/maps/index.mjs url    dir|place --json '<spec>'
node helpers/kits/maps/index.mjs details <placeId> [--tier T] [--store F --build B] --live --ledger <file>
node helpers/kits/maps/index.mjs search  <query> [--tier T] [--page-size N]        --live --ledger <file>
node helpers/kits/maps/index.mjs route   --json '<computeRoutes spec>'              --live --ledger <file>
node helpers/kits/maps/index.mjs matrix  --json '<computeRouteMatrix spec>'         --live --ledger <file>
node helpers/kits/maps/index.mjs smoke  [--live --ledger <file>]   # 1 Text Search Pro + 1 Place Details Enterprise + 1 Compute Routes (WALK)
```

Use the file path (`index.mjs`): Node does not run a directory's `index.mjs`. Network commands refuse without `--live` and a ledger (exit 2). Exit 1 = failure or refused call.

## What it never does

Free-form field masks · Enterprise route features · calls past a ceiling · keys in code, config, logs or errors · caching Places content beyond the build or lat/lng beyond 30 days · writing anything into a public repo · retries (a failed call is reported; the caller decides).

## Files

`index.mjs` (exports + CLI) · `lib/maps-errors.mjs` · `maps-skus.mjs` (SKU table, ceilings) · `maps-masks.mjs` · `maps-ledger.mjs` · `maps-transport.mjs` · `maps-http.mjs` (guarded call) · `maps-places.mjs` · `maps-routes.mjs` · `maps-urls.mjs` · `maps-snapshots.mjs` · `maps-client.mjs` · `maps-cli.mjs` · `maps-mock-transport.mjs` (fixture transport for tests and the offline smoke) · `fixtures/maps-fixture-*.json` (hand-written, invented city "Velmora", real API shapes). Tests: `helpers/tests/kit_maps_*.test.js`.

Developed by: LightAISolutions

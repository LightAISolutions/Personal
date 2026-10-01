# Maps kit (`helpers/kits/maps/`)

Places API (New) + Routes API client for helpers: **fixed field masks**, a **SKU counter with a hard stop**, a **GoogleSnapshot store with a terms-driven purge**, and a **Google Maps URL builder**. Zero runtime dependencies (Node ≥ 22). Built in Phase 2a; consumed by the Tour Guide planner (Phase 3) and skills (Phase 4). Choices and findings: `helpers/decisions/WP-2a.md`.

## Library

```js
import { createMapsClient, directionsUrl, placeUrl, dayUrl, openSnapshotStore, toSnapshot } from '../vendor/helpers/kits/maps/index.mjs';
const maps = createMapsClient({ ledgerPath: process.env.MAPS_USAGE_LEDGER });          // ledger path is required
const { place } = await maps.placeDetails(placeId, { tier: 'enterprise' });             // essentials | pro | enterprise | enterprise_atmosphere
const { places, nextPageToken } = await maps.textSearch('lantern museum', { tier: 'pro', pageSize: 10, locationBias: { lat, lng, radiusMeters: 3000 } }); // ids_only | pro | enterprise | enterprise_atmosphere
const { places: near } = await maps.searchNearby({ center: { lat, lng }, radiusMeters: 500, includedTypes: ['cafe'], rankPreference: 'DISTANCE' }, { tier: 'enterprise' }); // pro | enterprise | enterprise_atmosphere
const { count, placeIds } = await maps.computeInsights({ insights: ['INSIGHT_COUNT'], area: { circle: { center: { lat, lng }, radiusMeters: 600 } }, typeFilter: { includedTypes: ['restaurant'] }, ratingFilter: { minRating: 4.5 }, operatingStatus: ['OPERATIONAL'] });
const { route } = await maps.computeRoutes({ origin: { placeId }, destination: { lat, lng }, intermediates: [...], optimizeWaypointOrder: true, travelMode: 'WALK' });
const { route: leg } = await maps.computeRoutes({ origin, destination, travelMode: 'TRANSIT', departureTime: '2026-10-06T09:00:00Z', transitPreferences: { allowedTravelModes: ['SUBWAY', 'BUS'] } });
const { elements } = await maps.computeRouteMatrix({ origins, destinations, travelMode: 'TRANSIT', departureTime });   // split automatically past the caps
```

Waypoints are `{ placeId }`, `{ lat, lng }` or `{ address }`. Place results (`textSearch`, `searchNearby`, `placeDetails`) are Google's own place objects for the tier's mask; `placeEvidence(place)` flattens the rating, count, reviews (`normalizeReviews`: rating, text, author `displayName` / `uri` / `photoUri`, `publishTime`, `relativePublishTimeDescription`, Maps links), oldest / newest review time and the summaries for evidence checks. Results are normalized (`durationSec`, `distanceMeters`, `legs`, `optimizedOrder`, matrix `elements` with global `originIndex` / `destinationIndex`). Errors are typed with a stable `code`: `SKU_CEILING` (`MapsBudgetError`, nothing was sent), `BAD_INPUT` (`MapsInputError`, nothing was sent), `AUTH` / `QUOTA` / `UPSTREAM` / `HTTP_<n>` / `NETWORK` / `TIMEOUT` / `PROXY_REFUSED` / `BAD_JSON` (`MapsRequestError`).

## Static maps and place photos (Phase 2e, for the brochure)

```js
const maps = createMapsClient({ ledgerPath });                 // staticKey defaults to env MAPS_STATIC_KEY
maps.hasStaticKey();                                           // false → callers fall back to a drawn sketch
const { bytes } = await maps.staticMap({ width: 260, height: 320, scale: 2, center: { lat, lng }, zoom: 15,
  paths: [{ polyline: route.polyline, color: '0xB5482DE6', weight: 4 }], styles: ['feature:poi.business|visibility:off'] });
const { bytes: jpg, authorAttributions } = await maps.placePhoto(place.photos[0], { maxWidthPx: 900 });
```

- **Static maps.** `staticMapUrl(spec)` builds and validates the URL with **no key** (sides ≤ 640, scale 1|2, zoom 0–21, markers, encoded paths, styles); past `URL_MAX_CHARS` it lowers path precision and then simplifies points, noting what it did. The egress proxy injects no key for `maps.googleapis.com` (a header key answers 403), so `staticMap` appends `key=` from `MAPS_STATIC_KEY` at send time only; without a key it refuses with `NO_KEY` and sends nothing. The keyed URL is never returned or logged and errors are redacted. Optional URL signing: `MAPS_STATIC_SIGNING_SECRET`.
- **Place photos.** `photos[]` sits in the IDs-only tier, so every Details mask lists it. `placePhoto` does `GET /v1/{name}/media?skipHttpRedirect=true` (one Photos unit, key injected by the proxy) and then downloads the returned `photoUri`. It returns the bytes **and** `authorAttributions`, which must be shown with the photo. Photo names expire and are not cached.
- **Build-scoped.** Images are inlined into the build's output and never written to a reusable cache. **Street View is not offered**: Google forbids it in print.
- **Offline.** The mock transport draws stand-in PNGs (`stubFromStaticUrl`, `stubPhotoPng`) so tests and `--mock` runs need no network.

## Field masks and SKUs (one call = one SKU)

Callers choose a **tier name**, never a field list; the masks are frozen constants in `lib/maps-masks.mjs` (`node helpers/kits/maps/index.mjs masks` prints them). Masks are cumulative, and a test proves each one's highest field tier equals its name, so every request bills exactly one known SKU.

| Call | Tier → SKU | Free / month | Kit ceiling (default) |
|---|---|---|---|
| Place Details | `essentials` · `pro` · `enterprise` · `enterprise_atmosphere` | 10,000 · 5,000 · 1,000 · 1,000 | 8,000 · 4,000 · 800 · 800 |
| Text Search | `ids_only` · `pro` · `enterprise` · `enterprise_atmosphere` (there is no non-ID Essentials Text Search) | ∞ · 5,000 · 1,000 · 1,000 | 2,000 (loop guard) · 4,000 · 800 · 800 |
| Nearby Search (`places.nearby_search.*`) | `pro` · `enterprise` · `enterprise_atmosphere` (no IDs-only or Essentials SKU: `places.id` bills Pro) | 5,000 · 1,000 · 1,000 | 4,000 · 800 · 800 |
| Places Aggregate (`computeInsights`, `places.aggregate.compute_insights`, no mask) | one SKU, count or ids | 5,000 | 4,000 |
| Compute Routes | Essentials; **Pro** when `optimizeWaypointOrder`, 11–25 intermediates, or `TRAFFIC_AWARE*` | 10,000 · 5,000 | 8,000 · 4,000 |
| Compute Route Matrix (per **element**) | Essentials; Pro with `TRAFFIC_AWARE*` | 10,000 · 5,000 | 8,000 · 4,000 |

| Maps Static API (`staticMap`) | Static Maps | 10,000 | 8,000 |
| Place Photo (`placePhoto`, the `/media` lookup; the image download is not billed) | Place Details Photos | 1,000 | 800 |

Nearby Search masks equal the Text Search masks of the same tier (minus `nextPageToken`), so both searches return places of the same shape. The Atmosphere search masks add the Details Atmosphere fields (`editorialSummary`, `reviewSummary`, `generativeSummary`, `reviews` ≤ 5, amenity flags); the Details Atmosphere mask also carries `priceRange`, `regularOpeningHours`, `websiteUri` from the tiers below. List prices: Nearby Search Pro $32 · Enterprise $35 · Enterprise + Atmosphere $40, Text Search Enterprise + Atmosphere $40, Places Aggregate $10 per 1,000 (pricing page of 2026-09-28, read 2026-10-01).

**Search request options.** Text Search sends `pageSize`, `pageToken`, `languageCode`, `regionCode`, `includedType`, `strictTypeFiltering` (only together with `includedType`), `openNow`, `minRating` (0–5 in 0.5 steps), `priceLevels` (`FREE` … `VERY_EXPENSIVE`, short or `PRICE_LEVEL_` form), `rankPreference` (`RELEVANCE` | `DISTANCE`), `includePureServiceAreaBusinesses`, `locationBias` (circle `{ lat, lng, radiusMeters }` or rectangle `{ low, high }`) or `locationRestriction` (rectangle only — not both). Nearby Search sends `center` + `radiusMeters` (required; clamped to (0, 50,000] m and noted in `notes`), `includedTypes` / `excludedTypes` / `includedPrimaryTypes` / `excludedPrimaryTypes` (≤ 50 each, never both including and excluding a type), `rankPreference` (`POPULARITY` | `DISTANCE`), `maxResultCount` (1–20), `languageCode`, `regionCode`; it has no pagination (`nextPageToken: null`). An option a search does not take (e.g. `minRating` on Nearby, `maxResultCount` on Text Search) is **not sent** and is listed in the result's `notSent`; a malformed value is refused with `BAD_INPUT` before the ledger.

Not exposed (so no call can bill Enterprise or turn Pro by accident): two-wheeler routing, tolls, traffic on polylines, location modifiers (heading, side of road, vehicle stopover), `via` waypoints. Prices per SKU are in `lib/maps-skus.mjs` (pricing page of 2026-09-28).

Request rules enforced before sending: ≤ 25 intermediates; `TRANSIT` takes no intermediates (fetch legs pair by pair) but takes `departureTime` / `arrivalTime` and `transitPreferences`; `routingPreference` only with `DRIVE`; `optimizeWaypointOrder` needs ≥ 2 intermediates and not `TRAFFIC_AWARE_OPTIMAL`. Route Matrix: ≤ 625 elements per request, ≤ 100 for `TRANSIT` or `TRAFFIC_AWARE_OPTIMAL`, ≤ 50 origins + destinations when any is a place id or address — bigger matrices are split into several requests (`chunk: false` refuses instead).

## Places Aggregate (Phase 4b, Gem Funnel stream 3)

`computeInsights({ insights, area, typeFilter, ratingFilter?, operatingStatus?, priceLevels? })` → `{ count, placeIds, sku, ms }` calls `POST https://areainsights.googleapis.com/v1:computeInsights` through the kit's transport (same `X-Goog-Api-Key` convention, no field mask).
- `insights`: `INSIGHT_COUNT` and/or `INSIGHT_PLACES`. Google lists ids only when **≤ 100** places match, so ask for the count first; `count` comes back as a number (an int64 string on the wire) and ids lose their `places/` prefix.
- `area`: **circles only** — `{ circle: { center: { lat, lng } | { placeId }, radiusMeters } }`, radius 23–50,000 m (Google's area floor is 1,556.86 m²). Regions and custom polygons are refused (`MapsInputError`): the funnel lays circles around its own anchors and never tests points against polygons.
- `typeFilter`: at least one non-empty list of `includedTypes` / `excludedTypes` / `includedPrimaryTypes` / `excludedPrimaryTypes`. `ratingFilter`: `minRating` / `maxRating` 1.0–5.0, min ≤ max. `operatingStatus`: `OPERATIONAL`, `TEMPORARILY_CLOSED`, `PERMANENTLY_CLOSED` (short or `OPERATING_STATUS_` form). `priceLevels`: `FREE` … `VERY_EXPENSIVE`.
- **Owner action (Phase 7):** enable the Places Aggregate API on the Maps Cloud project and add `areainsights.googleapis.com` to the Claude HQ credential's hosts. Until then a live call fails at the proxy (`PROXY_REFUSED`) or, without a key, at Google (`AUTH`); the call is still counted (as failed). Tests and `--live`-less CLI runs answer from fixtures.

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

- **Claude Code cloud (Claude HQ):** the egress proxy injects the Maps key as `X-Goog-Api-Key` for `places.googleapis.com` and `routes.googleapis.com` (and `areainsights.googleapis.com` once the owner adds it, Phase 7); the client sends **no key**. The transport tunnels through `HTTPS_PROXY` with `CONNECT` and verifies TLS against the CA Node loads from `NODE_EXTRA_CA_CERTS`; it never disables verification. (Built-in `fetch` is not used: on Node 22 it ignores `HTTPS_PROXY` without `NODE_USE_ENV_PROXY=1`, and a direct connection gets no key.)
- **Elsewhere:** pass `apiKey` to `createMapsClient` from the caller's own secret store. The kit never reads a key from a file, never logs headers, and keeps keys out of errors.

## CLI

```
node helpers/kits/maps/index.mjs masks
node helpers/kits/maps/index.mjs usage  --ledger <file> [--month YYYY-MM]
node helpers/kits/maps/index.mjs purge  --store <file> [--now ISO] [--latlng-days N] [--content-hours N]
node helpers/kits/maps/index.mjs url    dir|place --json '<spec>'
node helpers/kits/maps/index.mjs details <placeId> [--tier T] [--store F --build B] --live --ledger <file>
node helpers/kits/maps/index.mjs search  <query> [--tier T] [--page-size N]        --live --ledger <file>
node helpers/kits/maps/index.mjs nearby  --json '<searchNearby params>' [--tier T] [--live --ledger <file>]   # fixtures without --live
node helpers/kits/maps/index.mjs aggregate --json '<computeInsights params>'      [--live --ledger <file>]   # fixtures without --live
node helpers/kits/maps/index.mjs route   --json '<computeRoutes spec>'              --live --ledger <file>
node helpers/kits/maps/index.mjs matrix  --json '<computeRouteMatrix spec>'         --live --ledger <file>
node helpers/kits/maps/index.mjs static-url <spec.json>                            # URL without a key, no network
node helpers/kits/maps/index.mjs static-map <spec.json> <out.png>                  --live --ledger <file> | --mock
node helpers/kits/maps/index.mjs photo   <photoName> <out> [--max-width N]         --live --ledger <file> | --mock
node helpers/kits/maps/index.mjs smoke  [--live --ledger <file>]   # 1 Text Search Pro + 1 Place Details Enterprise + 1 Compute Routes (WALK)
```

Use the file path (`index.mjs`): Node does not run a directory's `index.mjs`. Network commands refuse without `--live` and a ledger (exit 2). Exit 1 = failure or refused call.

## What it never does

Free-form field masks · Street View images · Enterprise route features · calls past a ceiling · keys in code, config, logs or errors · caching Places content beyond the build or lat/lng beyond 30 days · storing reviews or AI / editorial summaries (the kit returns them for in-run reading; the caller never persists them, and shows a review only with its author block and a summary only with its disclosure text and Maps link) · point-in-polygon tests on Google coordinates (area questions go to the Aggregate API, circles only) · writing anything into a public repo · retries (a failed call is reported; the caller decides).

## Files

`index.mjs` (exports + CLI) · `lib/maps-errors.mjs` · `maps-skus.mjs` (SKU table, ceilings) · `maps-masks.mjs` · `maps-ledger.mjs` · `maps-transport.mjs` · `maps-http.mjs` (guarded call) · `maps-places.mjs` (Details, Text Search, Nearby Search, review / evidence helpers) · `maps-aggregate.mjs` (Places Aggregate) · `maps-routes.mjs` · `maps-urls.mjs` · `maps-snapshots.mjs` · `maps-static.mjs` (Maps Static API) · `maps-photos.mjs` (Place Photos) · `maps-polyline.mjs` (encode/decode/simplify) · `maps-png-stub.mjs` (offline stand-in PNGs) · `maps-client.mjs` · `maps-cli.mjs` · `maps-mock-transport.mjs` (fixture transport for tests and the offline smoke) · `fixtures/maps-fixture-*.json` (hand-written, invented city "Velmora", real API shapes). Tests: `helpers/tests/kit_maps_*.test.js`.

Developed by: LightAISolutions

# WP-2g-kits — Gem Funnel: Maps kit and research kit additions: status

**State: done** (2026-10-01). Branch `wp-2g-kits`, worktree `/home/user/wt-4b-2g-kits` (from `origin/main` b308e52, v01.18r), never pushed. Defaults and reasons: `helpers/decisions/WP-2g-kits.md`. No live Google, Telegram or Drive call was made; Google's official pages were read with WebFetch (sources table in the decisions file).

## Contract (hidden-gems-proposal.md §6, Maps kit and Research kit rows; brief items 1–7)
| Item | State |
|---|---|
| 1. `searchNearby(params, { tier })`: `pro` / `enterprise` / `enterprise_atmosphere`, frozen cumulative masks, radius clamp, types, `rankPreference`, `maxResultCount` ≤ 20, language / region; same result shape as `textSearch` | done — `lib/maps-places.mjs`, `NEARBY_SEARCH_MASKS` / `NEARBY_SEARCH_SKU` in `lib/maps-masks.mjs`; decisions 1, 2, 6, 7 |
| Mask-tier proof extended to the new masks | done — `kit_maps_ledger.test.js` (Nearby loop, Atmosphere fields, Nearby = Text Search shape) |
| 2. Text Search `enterprise_atmosphere` tier; `minRating`, `pageSize`, `pageToken`, `locationRestriction` (rectangle) / `locationBias` (circle or rectangle), `strictTypeFiltering`, `includedType`, `openNow`, `priceLevels`, `rankPreference` sent; other options not sent and listed in `notSent`; IDs-only stays free | done — decisions 3, 7, 8 |
| 3. Place Details `enterprise_atmosphere`: reviews ≤ 5 with `authorAttribution.displayName` / `uri`, `publishTime`, `relativePublishTimeDescription`; `reviewSummary`, `editorialSummary`, `generativeSummary`, `priceRange`, `regularOpeningHours`, `websiteUri` | done — tier existed; `generativeSummary` added; `normalizeReviews(place)` / `placeEvidence(place)` added (decisions 4, 9) |
| 4. Places Aggregate client `computeInsights` against `https://areainsights.googleapis.com/v1:computeInsights`, `{ count, placeIds }`, circles only (polygons / regions → `MapsInputError`), proxy refusal → existing `PROXY_REFUSED` / `AUTH`, mock answers from fixtures | done — `lib/maps-aggregate.mjs`; decisions 10–12 |
| 5. Ledger SKUs with default ceilings (`places.nearby_search.{pro,enterprise,enterprise_atmosphere}`, `places.text_search.enterprise_atmosphere`, `places.aggregate.compute_insights`), reservation before sending, `MAPS_SKU_CEILINGS` covers them; prices and free tiers with source and date | done — `lib/maps-skus.mjs`; decision 5 |
| 6. Fixtures, mock transport, CLI `nearby` / `aggregate` (fixtures by default, live behind `--live` + ledger), README (tables, Aggregate section, owner action, "What it never does") | done — decisions 13, 14 |
| 7. Research kit `--source-kind editorial\|community\|local-language` and `--language <BCP47>` on `record-search` / `record-fetch` and library `search()` / `fetch()`; stored and validated on the ledger entry; schema; `mentions(run)`; summary `source_kinds`; README | done — decisions 15–18 |
| Tests | done — `kit_maps_gems.test.js` (9 tests), `kit_maps_ledger.test.js` (2 tests extended), `kit_research_sources.test.js` (4 tests) |

## Signatures for the engine builder and WP-4d
```js
import { createMapsClient, placeEvidence, normalizeReviews } from '../vendor/helpers/kits/maps/index.mjs';
const maps = createMapsClient({ ledgerPath });
// Stream 1 — Text Search Enterprise; minRating in 0.5 steps only (4.3 is refused: send 4.0 or 4.5 and apply 4.3 in screening)
await maps.textSearch(q, { tier: 'enterprise', minRating: 4.5, pageSize: 20, locationRestriction: { low: { lat, lng }, high: { lat, lng } }, includedType, strictTypeFiltering: true, languageCode })
  // → { places, nextPageToken, sku, ms, notSent }
// Stream 2 / 4 — free name → id
await maps.textSearch(`${name}, ${area}`, { tier: 'ids_only', pageSize: 1, locationBias: { lat, lng, radiusMeters } })
// Stream 3 — area count, then Nearby on chosen cells
await maps.computeInsights({ insights: ['INSIGHT_COUNT'] /* or ['INSIGHT_PLACES'] when count ≤ 100 */, area: { circle: { center: { lat, lng }, radiusMeters: 600 } },
  typeFilter: { includedTypes: ['restaurant'] }, ratingFilter: { minRating: 4.5 }, operatingStatus: ['OPERATIONAL'], priceLevels? })
  // → { count: number|null, placeIds: string[], sku, ms }
await maps.searchNearby({ center: { lat, lng }, radiusMeters: 450, includedTypes: ['restaurant'], rankPreference: 'DISTANCE', maxResultCount: 20, languageCode? }, { tier: 'enterprise' })
  // → { places, nextPageToken: null, sku, ms, notSent, notes }
// Stage 4 — evidence
const { place } = await maps.placeDetails(id, { tier: 'enterprise_atmosphere' });
placeEvidence(place) // → { id, rating, userRatingCount, reviews: [{ rating, text, languageCode, author: { displayName, uri, photoUri }, publishTime, relativePublishTimeDescription, googleMapsUri, … }], oldestReviewTime, newestReviewTime, reviewSummary, editorialSummary, generativeSummary, priceLevel, priceRange, regularOpeningHours, websiteUri, googleMapsUri }

// Research kit (stream 2): tag while recording, read back without re-reading pages
RK record-fetch --run $RUN --url U --text-file F --source-kind local-language --language ja
RK record-search --run $RUN --query Q --results R.json --source-kind editorial --language en
RK mentions --run $RUN [--source-kind local-language] [--language ja]
import { mentions } from '../vendor/helpers/kits/research/index.mjs';
mentions(run, { source_kind?, language? }) // → [{ ref, kind: 'fetch'|'snippet', url, domain, publisher, source_kind, language, official }] (usable sources only)
session.search(q, { source_kind, language }); session.fetch(url, { …, source_kind, language }); session.mentions(filter)
```
Errors: `MapsBudgetError` (`SKU_CEILING`, nothing sent), `MapsInputError` (`BAD_INPUT`), `MapsRequestError` (`AUTH`, `PROXY_REFUSED`, `HTTP_400`, …). Until Phase 7, every live `computeInsights` fails with `PROXY_REFUSED` or `AUTH`; the engine should treat stream 3 as unavailable on those codes (proposal §7 decision 19).

## Checks (run from /home/user/wt-4b-2g-kits at the last code commit)
- `node --test helpers/tests/` →
  ```
  # tests 240
  # pass 239
  # fail 0
  # skipped 1
  ```
  (227 before this package; the skip is the Maps kit's by-hand live smoke.)
- `node helpers/tools/bundle.mjs --all --check` →
  ```
  ok: hello — 16 files, 99311 chars, 4 scopes
  ok: tour-guide — 15 files, 97738 chars, 4 scopes
  ```
- `node helpers/tools/boundary-check.mjs` → `boundary-check: clean — 274 file(s) under /home/user/wt-4b-2g-kits/helpers`

## Requests to the coordinator (files WP-2g-kits does not own)
1. **`helpers/decisions/WP-2a.md` default 1 (Tier names)** is now incomplete: Text Search also has `enterprise_atmosphere`, and Nearby Search has `pro` / `enterprise` / `enterprise_atmosphere`. Suggest a one-line pointer: "Extended by WP-2g-kits decisions 1–5."
2. **Owner action, Phase 7** (proposal §7 decision 19): enable the Places Aggregate API on the Maps Cloud project and add `areainsights.googleapis.com` to the Claude HQ credential's hosts. Then run once by hand: `node helpers/kits/maps/index.mjs aggregate --live --ledger <scratch> --json '{"insights":["INSIGHT_COUNT"],"area":{"circle":{"center":{"lat":48.8584,"lng":2.2945},"radiusMeters":500}},"typeFilter":{"includedTypes":["restaurant"]}}'` and record the status and latency in the BUILD-STATE, as WP-2a F3 did. The same smoke would confirm decision 11's inference (an `INSIGHT_PLACES` request over 100 matches answers an error).
3. **Note for the engine builder (`packs/tour-guide/gems/`)**: Text Search accepts `minRating` only in 0.5 steps, so proposal §4's floor of 4.3 cannot be sent as is; send 4.0 (or 4.5 at appetite ≥ 4) and drop below 4.3 in stage-2 screening.
4. **Push-time bookkeeping** (README tree, CHANGELOG, REPO-ARCHITECTURE if it lists kit files). New files:
   - `helpers/kits/maps/lib/maps-aggregate.mjs`
   - `helpers/kits/maps/fixtures/maps-fixture-{nearby-search-enterprise,text-search-enterprise,place-details-atmosphere,aggregate-count,aggregate-places}.json`
   - `helpers/tests/kit_maps_gems.test.js`, `helpers/tests/kit_research_sources.test.js`
   - `helpers/status/WP-2g-kits.md`, `helpers/decisions/WP-2g-kits.md`

   Changed: `helpers/kits/maps/{README.md,index.mjs}`, `helpers/kits/maps/lib/maps-{masks,skus,places,client,cli,http,mock-transport}.mjs`, `helpers/tests/kit_maps_ledger.test.js`, `helpers/kits/research/{README.md,index.mjs}`, `helpers/kits/research/lib/{ledger,run,session,cli}.mjs`, `helpers/kits/research/schemas/research-run.schema.json`.

Developed by: LightAISolutions

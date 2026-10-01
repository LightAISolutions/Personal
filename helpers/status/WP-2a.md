# WP-2a — Maps kit: status

**State: done** (2026-10-01). Branch `wp-2a`, worktree `../wt-2a`, never pushed. Decisions and findings: `helpers/decisions/WP-2a.md`.

## Contract (TG-PHASE-2.md §2, row 2a)
| Item | State |
|---|---|
| Places API (New) client: Place Details by tier, Text Search Pro / Enterprise (+ free IDs-only) | done — `lib/maps-places.mjs` |
| Routes client: Compute Routes (incl. `optimizeWaypointOrder`, TRANSIT with departure/arrival time + transit preferences), Compute Route Matrix (100 / 625 element caps, 50 id waypoints, chunk or refuse) | done — `lib/maps-routes.mjs` |
| Fixed field masks as constants, never free-form; each mask proven to bill its declared tier | done — `lib/maps-masks.mjs`, test `kit_maps_ledger` |
| SKU counter by SKU (elements for Route Matrix), hard stop before sending, configurable monthly ceilings ≤ free caps, persisted in a caller-named file | done — `lib/maps-ledger.mjs`, `lib/maps-skus.mjs` |
| 30-day snapshot purge; fact 7 checked against current terms and recorded | done, with a design change — finding **F1**: only lat/lng get 30 days; other Google content is build-scoped by default |
| Maps URL builder (directions incl. waypoints / place ids / travel mode, place links, whole-day link) | done — `lib/maps-urls.mjs` |
| Network mocked in tests | done — fixture transport + local fake proxy; no test touches the internet |
| Live smoke behind `--live` (1 Place Details, 1 Text Search, 1 Compute Routes) from Claude HQ; credential header confirmed by the call; counter shows the calls | done — finding **F2/F3** (all three HTTP 200; counter printed) |
| Optional Grounding Lite spike | done as feasibility note — **F5** |

## Checks (in this worktree)
- `node --test helpers/tests/` → 79 tests, 78 pass, 1 skipped (the by-hand live smoke), 0 fail; the 25 new ones are in `kit_maps_ledger`, `kit_maps_client`, `kit_maps_urls_snapshots`, `kit_maps_transport`.
- `node helpers/tools/bundle.mjs --all --check` → ok.
- `node helpers/tools/boundary-check.mjs` → clean.

## How to run
```
node helpers/kits/maps/index.mjs smoke                         # offline, fixtures
node helpers/kits/maps/index.mjs smoke --live --ledger <file>  # 3 billable calls, Claude HQ only
node helpers/kits/maps/index.mjs usage --ledger <file>
node --test helpers/tests/kit_maps_*.test.js
```

## Requests to the coordinator (files WP-2a does not own)
1. **SPEC §16 kit CLI form** (finding F6). Node never resolves a directory to `index.mjs`, so `node helpers/kits/<kit>/ <command>` fails with MODULE_NOT_FOUND. Proposed patch to `helpers/SPEC.md` §16 kit layout block: replace `index.mjs        CLI entry — node helpers/kits/<kit>/ <command> …   (node vendor/helpers/kits/<kit>/ … from a private repo)` with `index.mjs        CLI entry — node helpers/kits/<kit>/index.mjs <command> …   (node vendor/helpers/kits/<kit>/index.mjs … from a private repo)`, and the same wording in `helpers/prompts/TG-PHASE-2.md` "Rules" if Phase 3 copies it. (A per-kit `index.js` shim would collide with `helpers/tests/index.js` under [PC-UNIQUE-FILES]; a `package.json` per kit would collide across kits.)
2. **Plan fact 7 / §4.4 / §9** (F1): in `repository-information/TOUR-GUIDE-BUILD-PLAN.md` and in `TG-PHASE-3.md`, change "GoogleSnapshot … purged after 30 days" to: place ids kept forever; lat/lng ≤ 30 days; other Google fields build-scoped (refetched per plan/brochure build, not kept in the state Sheet); and add the open owner question about Google content inside delivered brochures (decisions F1).
3. **Plan fact 2** (F4): `businessStatus` is Pro; Place Details photos are IDs-only; Text Search has no non-ID Essentials SKU.
4. **`helpers/decisions/TG-PHASE-2.md`**: record F2 (credential injected only through the proxy tunnel; a direct connection gets no key; header confirmed as an API-key header by the 200s) and the smoke results table from F3.
5. **README tree / CHANGELOG** (push-time bookkeeping): new files — `helpers/kits/maps/{README.md,index.mjs}`, `helpers/kits/maps/lib/maps-{errors,skus,masks,ledger,transport,http,places,routes,urls,snapshots,client,cli,mock-transport}.mjs`, `helpers/kits/maps/fixtures/maps-fixture-{place-details-enterprise,text-search-pro,compute-routes-walk,compute-routes-optimized,compute-routes-transit,route-matrix,error-403}.json`, `helpers/tests/kit_maps_{ledger,client,urls_snapshots,transport}.test.js`, `helpers/status/WP-2a.md`, `helpers/decisions/WP-2a.md`.
6. Phase 4 note: the private repo needs a memory path for the usage ledger (e.g. `log/maps-usage-ledger.json` or a pack `memory_dirs` entry) so `merge-routine-memory` lands it; set `MAPS_USAGE_LEDGER` in the routine prompts.

## Log
- 2026-10-01 — read SPEC, plan facts 2–8/12, §4.4, §5.4, §7, §8; read the current Service Specific Terms, Terms of Service, Places policies, pricing and SKU-details pages (F1, F4); built masks, SKU table, ledger, transport, Places/Routes clients, URLs, snapshots, CLI, fixtures, 25 tests.
- 2026-10-01 — first live smoke: 403 "unregistered callers" (transport bypassed the proxy, F2); one curl retry on the free IDs-only SKU → 200; fixed the transport, added a regression test, re-ran the smoke → 3 × 200 (F3). Grounding Lite spike (F5). Checks green.

Developed by: LightAISolutions

# WP-3e — Tour Guide planner: transit fallback: status

**State: done** (2026-10-01). Built by WP-3d's builder in the same worktree (`../wt-4b-3d`, branch `wp-3d`, never pushed), after WP-3d's items. Defaults and reasons: `helpers/decisions/WP-3e.md`.

## Contract (coordinator's scope message)
| Item | State |
|---|---|
| A TRANSIT Route Matrix element with no route (missing element, condition not `ROUTE_EXISTS`, e.g. `ROUTE_NOT_FOUND`) → distance estimate, not driving | done — `planner/planner-legs.mjs` `fetchMatrix(…, { fallback })`. The Maps kit gives such an element `ok: false` and no duration; a missing element never appears |
| A TRANSIT Compute Routes call with no route (`{}` / empty `routes`) → the same estimate | done — `fetchLeg(…, { fallback })`; the kit's `normalizeRoute` returns `route: null` |
| Estimate = haversine × 1.3 at `trip.transit_fallback.kmh` (default 20) + `overhead_min` (default 12) | done — `estimateTransit(a, b, fallback)`: minutes = ceil(km × 1.3 / kmh × 60 + overhead), ≥ 1; `distance_m` = the 1.3 × straight-line distance |
| The solver uses the same estimate for missing matrix pairs | done — the matrix table holds the estimate, so the solver and the real-leg step agree |
| Leg `estimated: true`, `estimate_basis: 'distance'`, the normal Maps directions link with travel mode transit | done — `legUrl` (Maps kit `directionsUrl`, `travelmode=transit`); no `line` on an estimate |
| DayPlan warning `transit_estimated`, "Transit times on this day are estimates; check the Maps link before you go", once per affected day | done — severity `warn` (the brochure shows it in the day's "Mind" block) |
| Trip `transit_fallback: { kmh, overhead_min, source?: 'default'\|'researched', note? ≤ 200 }` | done — `tour-guide-trip.schema.json` (kmh 1–200, overhead_min integer 0–120) |
| DayPlan schema: leg `estimated?`, `estimate_basis?`, warning code | done — `tour-guide-day-plan.schema.json` |
| `tour-guide-checks.mjs`: the leg-minutes property exempts estimated legs | done — see decision 5: the checks add estimated-leg rules; the fixture-table property in the integration and choices tests skips estimated legs |
| Tests with a transport wrapper that strips TRANSIT routes / elements on transit-city | done — `helpers/tests/pack_tour-guide_planner_transit-fallback.test.js` (6 tests): plan builds and validates, every leg estimated with the exact formula, warning once per day, `{kmh 30, overhead_min 5}` changes every leg accordingly, re-planning keeps other days byte-identical, schema/check refusals |
| Driving fixture byte-identical | done — the wrapped driving-loop plan equals the plain one (test), and both fixtures' plans hash the same as on `c17cd68` (`helpers/status/WP-3d.md`) |
| `fixtures/` untouched | yes |

## Checks
Run from `/home/user/wt-4b-3d` at the last commit (WP-3d + WP-3e + the sibling schema requests):
- `node --test helpers/tests/` →
  ```
  # tests 249
  # pass 248
  # fail 0
  # skipped 1
  ```
  The skip is the Maps kit's by-hand live smoke. Base `c17cd68` had 227 tests (226 pass, 1 skip).
- `node helpers/tools/bundle.mjs --all --check` →
  ```
  ok: hello — 16 files, 99311 chars, 4 scopes
  ok: tour-guide — 15 files, 97858 chars, 4 scopes
  ```
- `node helpers/tools/boundary-check.mjs` → `boundary-check: clean — 279 file(s) under /home/user/wt-4b-3d/helpers`

## Requests to the coordinator
1. **Bookkeeping**: new files `helpers/tests/pack_tour-guide_planner_transit-fallback.test.js`, `helpers/status/WP-3e.md`, `helpers/decisions/WP-3e.md`. Changed: `planner/planner-legs.mjs`, `planner/planner-day.mjs`, `planner/index.mjs` (exports `transitFallback`, `estimateTransit`, `TRANSIT_FALLBACK_DEFAULT`, `ROUTE_FACTOR`, `TRANSIT_ESTIMATED_TEXT`), the trip and day-plan schemas, `tour-guide-checks.mjs`, the pack README.
2. **For the private repo (research skill)**: when a trip's country is known to have no Google transit data, research a realistic `transit_fallback` (`source: 'researched'`, a one-line `note`) instead of relying on 20 km/h + 12 min.
3. **Brochure (optional, WP-3c's files)**: the brochure shows the leg minutes as usual; marking estimated legs ("≈ 18 min") in the brochure kit would need a field on the brochure model. Not needed for correctness: the day warning already says so.

Developed by: LightAISolutions

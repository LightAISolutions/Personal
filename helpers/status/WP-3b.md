# WP-3b — Planner + solver: status

**State: done** (2026-10-01). Branch `wp-3b`, worktree `../wt-3b`, never pushed; built by the Phase 3 coordinator (Fable 5.1 · high). Defaults and limits: `helpers/decisions/WP-3b.md`.

## Contract (TG-PHASE-3.md §2, row 3b)
| Item | State |
|---|---|
| `planTrip(input) → Plan` over the contract entities (Trip, Place, GoogleSnapshot, VisitEstimate, profile, calibration) | done — `planner/index.mjs`, `planner-input.mjs` |
| Candidates assigned to days by geography, lodging anchors, priority and feasibility; capacity capped so the TRANSIT matrix stays ≤ 100 elements and the solver exact | done — `planner-assign.mjs` (`FAR_KM`, `CAP`) |
| Exact order per day under opening hours, bookings, day bounds, visit lengths; lunch in a 12:00–14:00 window; breakfast at the lodging; dinner after the return | done — `planner-solve.mjs` (Held-Karp over subsets with time windows, ≤ 12 stops), `planner-day.mjs` |
| One Route Matrix per day for the solver, then real legs pair by pair with the transit line; re-timeline on the real legs; re-solve once; drop a stop at a time if it still cannot be timed | done — `planner-legs.mjs`, `planner-day.mjs` |
| `optimizeWaypointOrder` cross-check on DRIVE / WALK days (≥ 2 stops, one Pro request), recorded in `solver.cross_check` with an `order_disagreement` info warning | done |
| Maps links per leg (`directionsUrl`) and per day (`dayUrl`; null on TRANSIT or > 9 waypoints) | done |
| Warnings: `closed_day`, `tight_connection`, `over_long_day`, `hours_unknown`, `order_disagreement`, `other`; free blocks for waits and early returns | done |
| Leftovers → LaterList "Didn't fit" with code + reason (`closed_business`, `closed_day`, `outside_day`, `outside_hours`, `too_far`, `day_full`, `other`); owner-saved places → "Next time" (`owner`) | done — `planner-later.mjs` |
| `estimateBudget(input)` before any call; `PlanBudgetError` when the ledger cannot carry the build (nothing sent) | done — `planner-budget.mjs` |
| `replanDays(plan, dates, input)`: other days byte-identical, Later items outside the pool kept, usage accumulated | done |
| Deterministic from `seed` (tie-breaks only) | done — `planner-rng.mjs` |
| Property tests: no stop outside hours, no closed-day visit, legs match the recorded route, day inside bounds or `over_long_day`, every candidate scheduled xor in a Later list with a reason, re-planning one day leaves the others unchanged | done — `helpers/tests/pack_tour-guide_planner.test.js` on the mini world `pack_tour-guide_planner_world.js`; the same properties run on the two pack fixtures in `pack_tour-guide_integration.test.js` (coordinator, after the WP-3a merge) |

## Checks (in this worktree)
- `node --test helpers/tests/` → 154 tests, 153 pass, 1 skipped, 0 fail (6 new in `pack_tour-guide_planner`).
- `node helpers/tools/bundle.mjs --all --check` → ok (hello, tour-guide).
- `node helpers/tools/boundary-check.mjs` → clean (182 files).

## README section
### Planner (`planner/`)
```js
import { planTrip, replanDays, estimateBudget, PlanBudgetError } from './planner/index.mjs';
const plan = await planTrip({ trip, places, snapshots, estimates, profile, calibration, maps, build_id, now, seed });
const plan2 = await replanDays(plan, ['2027-05-04'], { trip, places: plan.places, snapshots, estimates, profile, maps });
const budget = await estimateBudget({ … same input … });   // no API call
```
`maps` is a Maps-kit client; its ledger counts every unit before it is sent. For each trip date the planner assigns candidates (geography + lodging anchors, priority first, bookings pinned, a promoted place's `scheduled_hint` preferred; too-far and never-open places go straight to *Didn't fit*), fetches **one Route Matrix** (stops + lodging endpoints, ≤ 10 points on TRANSIT days), solves the exact best subset and order under opening hours, bookings and the day bounds (lunch 12:00–14:00 is mandatory on a day that runs past it; breakfast at the lodging from `day_start`; dinner suggested after the return), then fetches the **real legs pair by pair** at the planned departure times (TRANSIT legs carry the line), re-timelines on them (one re-solve, then drops a stop at a time), cross-checks the order with Google on DRIVE / WALK days, and writes the DayPlan with Maps links, meals, free blocks and warnings. Visit lengths come from the estimator's `chooseMinutes` (pace, interest, calibration); a caller may inject its own. `replanDays` rebuilds only the dates given and keeps every other day byte-identical. Limits: ≤ 12 stops per day (≤ 9 on TRANSIT with one lodging, ≤ 8 with two), ≤ 31 days, modes TRANSIT / DRIVE / WALK, return leg may spill ≤ 90 min past `day_end` (warned), a stop waits ≤ 75 min for a window or booking.

## Requests to the coordinator
1. Integration test on the WP-3a fixtures (both fixtures → feasible plans → brochure model via WP-3c → HTML).
2. `helpers/tests/tools_bundle.test.js` now checks that `hello` is *in* the pack list (the tour-guide pack made the exact-list assertion fail on every Phase 3 branch) — carried on this branch.
3. README tree / CHANGELOG at push time: `helpers/packs/tour-guide/planner/{index,planner-time,planner-geo,planner-rng,planner-hours,planner-input,planner-assign,planner-solve,planner-legs,planner-day,planner-budget,planner-later}.mjs`, `helpers/tests/pack_tour-guide_planner.test.js`, `helpers/tests/pack_tour-guide_planner_world.js`, `helpers/status/WP-3b.md`, `helpers/decisions/WP-3b.md`.

## Log
- 2026-10-01 — read the Maps kit (routes, matrix, URLs, mock transport, ledger, SKUs); wrote time/hours/geo/rng helpers, input normalisation, day assignment, the Held-Karp solver, legs + cross-check, per-day assembly, budget, Later merge, entry module; mini world + 6 tests; all three checks green.

Developed by: LightAISolutions

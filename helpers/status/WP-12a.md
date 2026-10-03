# WP-12a — Planner and contracts: when to leave, the day's town, re-plans from where you are

**State: done.**
- Brief: `helpers/prompts/TG-PHASE-12.md` (Contract C12, WP-12a, Rules). Decisions and defaults: `helpers/decisions/WP-12a.md`.
- Worktree branch `worktree-agent-adc6f4b7d1506afb4`, from `origin/main` a7350b7 (v01.55r). Not pushed.
- Step 0: `node --test helpers/tests/` 781 tests, 780 pass, 1 skipped, 0 fail; `bundle.mjs --all --check` ok; `boundary-check.mjs` clean.
- Finish: the three checks are clean (counts in the final report).

## Done
- C12 schema fields: trip `country_code`, lodging `area` and `access`; place facts `local_name`, `address`, `access`
  (and `normalizeFacts`); DayPlan `leave_by`, `areas`, stop `visited`, the reserved point `here` in legs.
  `checkAccess` (no station and line twice), `checkDayPlan` (leave_by = first leg), `checkDayChain` (here, visited).
- Planner: `leave_by` and `areas` on every built day (`planner-morning.mjs`).
- Planner: `replanDays(plan, [date], { ...input, from, visited, rain })` (`planner-restart.mjs`): visited part kept
  verbatim, the rest planned from the place or the shared point at the given time; rain ranks and weighs covered
  places and indoor meals first and drops the day's `rain_swaps`; late places return (`lateAgain`); budgeted and
  recorded. `restartErrors` checks the request shape (usable by the core).
- Fixture `rehearsal-day` (`C12_FIXTURE_NAMES`), invented.
- Tests: `pack_tour-guide_c12_contracts.test.js` (7), `pack_tour-guide_planner_c12.test.js` (17); the golden test in
  `pack_tour-guide_planner_c11_units.test.js` strips `leave_by` after checking it, hashes unchanged.

## Next
- Nothing in WP-12a. The coordinator merges, then the rehearsal test joins this with WP-12b.

## REQUESTs
- `helpers/packs/tour-guide/brochure-map/brochure-map-days.mjs` (mapDay, `ends`) — name a leg end `here` "where you
  were" and show `visited` stops as done; today a `here` leg renders with no start name. Why: a re-planned day
  (C12) can reach the brochure. Owner: whoever owns the brochure-map in the merge (not WP-12a, not WP-12b's list).
- WP-12b (core, digest schema/checks) — map `leave_by`, `areas`, stop `visited` and leg ends `here` into the digest
  per C12, and validate the `replan` request with the planner's exported `restartErrors` (or the same bounds).
  `checkAccess` is exported from `schemas/tour-guide-checks.mjs` for the digest's station notes. Why: one rule each.
- WP-12b / coordinator — call `replanDays` with `places: plan.places` (or the trip's places plus the dinner places):
  with only the trip's own places a kept day's dinner place is missing from `plan.places` and the Plan fails
  validation (older behaviour, decisions §28).

Developed by: LightAISolutions

# Phase 3 — Tour Guide engine: decisions

> Coordinator: Fable 5.1 · high (thread "Tour Guide Phase 3", 2026-10-01). Three work packages: 3a schemas / estimator / Later lists / fixtures (`hb-builder-opus`, Opus 5.5 · high, worktree `wt-3a`), 3b planner + solver (built by the coordinator in this session, worktree `wt-3b`), 3c plan → brochure mapping (`hb-builder-opus`, Opus 5.5 · high, worktree `wt-3c`). Per-WP defaults: `helpers/decisions/WP-3{a,b,c}.md`; per-WP state: `helpers/status/WP-3{a,b,c}.md`. Nothing personal: every trip, place, person and id in `helpers/` is invented.

## 1. Coordinator defaults

1. **Data contract v1 written before fan-out.** The brief fixed the entity shapes (plan §4.4 made concrete: `Trip`, `Place`, `GoogleSnapshot` as the Maps kit emits it, `VisitEstimate`, `PlaceNote`, profile excerpt, calibration state, `DayPlan`, `LaterList`, `Plan`), the fixture layout (`fixtures/<name>/tg-fixture-<name>-<part>.json`, eight parts), and the module APIs each WP exposes, so three worktrees could build against each other without waiting. WP-3a added one kind (`profile-excerpt`) and one Place field (`scheduled_hint`), both adopted.
2. **Pack skeleton first.** `helper.json` + `gas/.gitkeep` landed on the session branch before the worktrees were cut so `bundle --all --check` stayed meaningful: name `tour-guide`, display name "Tour Guide", `drive_root` `TourGuide`, `producer` `tour-guide-core`, `property_prefix: ""` (Phase 1 decision 2), `inbound_routine` `CHAT`, `memory_dirs` `trips places profile`, **`timezone` `America/New_York`** as the manifest default (the `TIMEZONE` Script Property overrides it at run time; trips carry their own destination zone and the planner never reads the manifest's). `envelope_types` and `action_allowlist` stay empty until Phase 5 defines the chatbot's.
3. **`tools_bundle.test.js` relaxed** from `listPacks() === ['hello']` to "`hello` is listed": the second pack made the exact-list assertion fail on every Phase 3 branch (both agents reported it). Coordinator-owned test file; carried on `wp-3b`.
4. **Solver on the coordinator's own session**, not an agent: it is the judgment-heavy part (plan §6) and the one place a wrong contract would have cost the other two WPs time.
5. **Integration test is coordinator-owned** (`helpers/tests/pack_tour-guide_integration.test.js`): it is the only test that crosses all three WPs (fixtures → estimator → planner → schemas → brochure map → HTML) and it checks the Phase 3 property set on real output rather than on the planner's own mini world. It found one real gap (§3 item 3).
6. **Pack README assembled from the three WP README sections**, in the order the data flows (schemas, estimator, Later, fixtures, planner, brochure map), plus the manifest, a "how a plan is built" example and a "what the pack never does" block.
7. **Template fix carried in this push**: `helpers/templates/private-repo/CLAUDE.md` wrapped `{{MEMORY_DIRS}}` in backticks on one line although the placeholder already renders each directory in backticks (seen when test-rendering the private repo for the Phase 4 prompt). Coordinator-owned path.
8. **Brochure-map fix after the preview**: Google's weekday line "Open 24 hours" printed as "open Open 24 hours" because the brochure kit prefixes the word; the map now strips a leading "Open". WP-3c was merged by then, so the coordinator made the change (ownership map §2 gives merged pack paths to the coordinator).
9. **Fixture brochures rendered for the owner** (plan prompt Step 3, optional): both fixture plans as HTML and PDF (11 and 12 pages) in the project's shared folder under `tour-guide/phase-3/`, with the Plan JSONs. No question asked of the owner; the Google-content question from Phase 2 stays open and is carried to Phase 4 (§4).
10. **Worktree flow as in Phase 2**: `git worktree add ../wt-3<x> -b wp-3<x>`, plain commit messages inside a WP, `--no-ff` merges by the coordinator, one push. Order of landing: 3b, 3c, 3a (3a finished last because the fixtures needed one geometry fix after its own test).

11. **`REPO-ARCHITECTURE.md` left unchanged.** The Helper Framework subgraph's `helpers/` node already lists `packs/`; a per-pack node would turn a structural overview into a pack inventory, so the mermaid.live URL was not regenerated this phase. Phase 5 adds the pack's Apps Script and may revisit.

## 2. Ownership map — Phase 3 extension (SPEC §16)

| Path | Owner | Notes |
|---|---|---|
| `helpers/packs/tour-guide/helper.json`, `gas/`, `README.md` | coordinator | Manifest, the empty feature-pack directory (Phase 5), the assembled README |
| `helpers/packs/tour-guide/{schemas,estimator,later,fixtures}/`, `helpers/tests/pack_tour-guide_{schemas,estimator,later,fixtures}.test.js`, `helpers/status/WP-3a.md`, `helpers/decisions/WP-3a.md` | WP-3a | Contract files for the other two WPs; semantic checks in `schemas/tour-guide-checks.mjs` |
| `helpers/packs/tour-guide/planner/`, `helpers/tests/pack_tour-guide_planner.test.js`, `helpers/tests/pack_tour-guide_planner_world.js`, `helpers/status/WP-3b.md`, `helpers/decisions/WP-3b.md` | WP-3b (coordinator) | Consumes the estimator lazily (`chooseMinutes`), builds Later lists itself |
| `helpers/packs/tour-guide/brochure-map/`, `helpers/tests/pack_tour-guide_brochure-map*.test.js`, `helpers/status/WP-3c.md`, `helpers/decisions/WP-3c.md` | WP-3c | Consumes the brochure kit's validator and renderer |
| `helpers/tests/pack_tour-guide_integration.test.js`, `helpers/tests/tools_bundle.test.js` | coordinator | Cross-WP test; the relaxed pack-list assertion |
| merged pack paths after Phase 3 | coordinator of the phase that touches them | A later phase that changes the engine keeps the pack README and these tests green |

Phase 4 adds nothing under `helpers/packs/tour-guide/` except through `/update-helpers` consumers; Phase 5 owns `helpers/packs/tour-guide/gas/`.

## 3. Solver design and its limits (summary of `decisions/WP-3b.md`)

1. **Exact, not heuristic.** Each day is solved by Held-Karp dynamic programming over (visited subset, last stop, lunch taken) — ≤ 12 stops, so ≤ 2¹²·13·2 states, milliseconds — maximising Σ priority weight (1 → 100, 2 → 10, 3 → 1), then the earliest return, then the lowest subset index. Google's `optimizeWaypointOrder` ignores hours and bookings, so it is a cross-check only (`order_disagreement` info warning on DRIVE / WALK days; TRANSIT days never ask).
2. **Time model.** Breakfast at the lodging from `day_start` (45 / 35 / 25 min by pace, unless the profile says otherwise); lunch 12:00–14:00 is mandatory on any day running past 14:00, taken where you stand; dinner is a suggestion after the return; a stop waits ≤ 75 min for its opening window (a **booked** stop may wait any length — §3 item 3); only the return leg may spill, ≤ 90 min, with `over_long_day`. Opening hours come from the snapshot's periods (overnight windows, 24-hour places, previous-night tails), `business_status ≠ OPERATIONAL` is `closed_business`, no hours at all schedules the place with `hours_unknown`.
3. **Fix found by the integration test.** With one seed the transit fixture's timed booking (11:00) was dropped as `day_full`: nothing short enough fitted before it and the wait cap refused "go there first and wait". Booked stops are now exempt from the wait cap; the wait becomes a free block ("before your 11:00 booking at …"). The planner's own mini-world test had not hit it because its booking was in the afternoon.
4. **Days before stops.** Candidates are assigned to dates greedily and deterministically (bookings pinned, promoted places' `scheduled_hint` next, then priority, seeded tie-breaks) by a score of distance to the day's lodging anchor, mean distance to the stops already on the day and a load term; TRANSIT days hold ≤ 10 matrix points (one request under the 100-element cap), other modes ≤ 12 stops; a place farther than 30 / 12 / 120 km (TRANSIT / WALK / DRIVE) from every lodging goes to *Didn't fit* as `too_far` before any Maps unit is spent.
5. **Maps usage.** One Route Matrix per day at Essentials (origins = destinations = the day's points, diagonal filled locally), real legs pair by pair at the planned departure (Essentials), one `optimizeWaypointOrder` route per DRIVE / WALK day with ≥ 2 stops (Pro). `estimateBudget` gives the SKU count and USD estimate before any call; `planTrip` throws `PlanBudgetError` when the ledger's ceiling would be crossed. The two fixtures cost 75 + 15 and 108 + 21 (matrix elements + route calls).
6. **Later lists** are built by the planner with the WP-3a shapes ("Didn't fit" with codes `closed_business` > `outside_hours` > `outside_day` > `closed_day` > `too_far` > `day_full` > `other`; "Next time" for owner-saved places); `replanDays` re-decides only the dates given and keeps every other DayPlan byte-identical.
7. **Limits (recorded, not enforced beyond the checks):** ≤ 31 days; modes TRANSIT / DRIVE / WALK; one lodging per night; every place needs a snapshot with a location; no multi-day or overnight stops; one matrix per day (times of day are approximated by the departure-time matrix, the real legs correct them); no second re-solve after the real legs (a stop is dropped instead); meals are not placed at restaurants (dinner candidates such as the driving fixture's fish shack are planned as stops if they fit, otherwise Later). Phase 8 revisits the weights, the wait cap and the meal rules with real trips.

## 4. Requests carried to later phases

| For | Request | From |
|---|---|---|
| Owner (Phase 4 `brochure-build`) | Still open from Phase 2: may a delivered brochure show Google hours and ratings? Default `show_google_content: true` (attribution block + `verified_on`); the map's `false` mode prints a dated "Verify before you go" section instead | TG-PHASE-2 §4, WP-3c decision 4 |
| Phase 4 | Request kinds the skills accept (`research`, `plan`, `replan`, `notes`, `brochure`, `prefs`, free text) are a contract Phase 5's core emits — written in `TG-PHASE-4.md` defaults | coordinator |
| Phase 4 | `plan-days` passes `calibration` and the profile excerpt into `planTrip`; after a trip, calibration taps go through the estimator's `applyTap` (Phase 5 collects the taps) | WP-3a decision 8 |
| Phase 5 | Later-list promotion (`promote`) returns `affected_days`; the core's `/later` handler fires a `replan` request for exactly those dates | WP-3a decision 10 |
| Phase 5 | Chat `/route A → B` uses the built-in Maps service; the planner's own leg links (`maps_url`) are already in the Plan JSON and should be reused for `/today` | WP-3b decision 16 |
| Phase 8 | Tune the objective weights, the 75-minute wait cap, the 90-minute spill and the meal rules against real trips; consider a second matrix per day for afternoon departures | WP-3b decision 24 |

## 5. Checks at push

`node --test helpers/tests/` 206 tests (205 pass, 1 skipped: the Maps kit's by-hand live smoke); `node helpers/tools/bundle.mjs --all --check` ok for `hello` and `tour-guide`; `node helpers/tools/boundary-check.mjs` clean. No live API call was made in this phase; `TourGuide` and `AssistantBrain` received no commit.

Developed by: LightAISolutions

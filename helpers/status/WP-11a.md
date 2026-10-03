# WP-11a — Planner: real starts, dinners, evenings, facts in the schedule, crowd timing

**State: done.**
- Brief: `helpers/prompts/TG-PHASE-11.md` (Contract C11, WP-11a, Rules). Decisions and defaults: `helpers/decisions/WP-11a.md`.
- Worktree branch `worktree-agent-ae29e3a8797e32fef`, from `origin/main` 683c9e6 (v01.50r). Not pushed.
- Step 0: `node --test helpers/tests/` 611 tests, 610 pass, 1 skipped, 0 fail; `bundle.mjs --all --check` ok; `boundary-check.mjs` clean.
- Finish: `node --test helpers/tests/` 634 tests, 633 pass, 1 skipped, 0 fail; `node helpers/tools/bundle.mjs --all --check` ok; `node helpers/tools/boundary-check.mjs` clean.

## Done
- **Day overrides** (`planner-anchors.mjs`, `planner-input.mjs`, `planner-day.mjs`, `planner-assign.mjs`, `planner-budget.mjs`): per-date `day_start`/`day_end`; `start` (arrival point and time, no breakfast) and `end` (departure, reached `END_MARGIN` early, no spill); bags `hotel` (15-min stop at the night's lodging first), `locker` (10 min at the start point, the sights loop back through it, 10 min to collect), `forward`/`carry` (the line only); reserved slugs `day-start`/`day-end`; DayPlan `start`, `end`, `bags`; a departure day gets "time to spare near <end> before HH:MM" instead of dinner and the back-early line.
- **Dinner** (`planner-dinner.mjs`): from `input.dinners` — open, within 1.5 km of the last stop or the lodging, never `fits: no`, never twice, ✅ picks then the Later list; honest legs counted in the budget; booking line from `trip.bookings` or `facts.booking`; falls back to "near <lodging>"; dinner places in `plan.places`.
- **Evening** (`planner-evening.mjs`, `planner-sun.mjs`): sunset (NOAA) at the night's lodging; extras — season events that evening within 2 km, saved places on an early finish, ≤ 3, events first, replacing the back-early line.
- **Facts** (`planner-facts.mjs`, `planner-hours.mjs`): own close and last entry bound the windows (`earliestFit` honours `last`), `closed_weekdays`, `visit_minutes` → `minutes_source: 'official'`, stop `last_entry`, one info warning per own-hours conflict through `ownHoursConflict` (WP-11b's kinds and 15-min tolerance).
- **Country defaults** (`estimator-defaults.mjs`, `estimator-minutes.mjs`): Japan — temple 60, shrine 40, garden 75, tea ceremony 45, course meal 120; nowhere else; the `chooseMinutes` return shape unchanged.
- **Crowd timing** (`planner-crowd.mjs`, `planner-solve.mjs` `waitAny`): with the profile rule, a `crowd_magnet` (boolean or flag) goes in its opening or late slot and carries `crowd_slot`; otherwise a warning, never dropped.
- **Chain check** (`planner-chain.mjs` `checkDayChain`): the generalised leg chain and timeline, offered for `checkDayPlan` (REQUEST 1).
- **Schema**: `tour-guide-day-plan.schema.json` gains the C11 day and stop fields; `legs.maxItems` 30. `tour-guide-plan.schema.json` unchanged.
- **Fixture**: invented `fixtures/moving-day/` (slow first morning, moving day by train with bags to the hotel, a last day ending at a station, dinner pool, season sheet, facts, a crowd magnet); `loadFixture('moving-day')` returns `dinners`; `listFixtures()` unchanged (`C11_FIXTURE_NAMES`).
- **Tests**: `pack_tour-guide_planner_c11.test.js` (13: each bags kind, per-date hours, departure day, dinner rules and fallback, extras, sunset, facts, country, crowd, fixture) and `pack_tour-guide_planner_c11_units.test.js` (10: sunset references and an independent algorithm, country defaults, ownHoursConflict, factsHours, crowd helpers, overrides, dinner booking and evening rules, the chain check, old plans byte-identical to 683c9e6).

## Commits
9f508e9, a049eea, d6713fc, ae3da07, 1415e90, and the status/decisions commit after them.

## REQUESTs
1. **`helpers/packs/tour-guide/schemas/tour-guide-checks.mjs` `checkDayPlan`** — generalise the leg chain and timeline: the first leg starts at `day-start` when the day has `start`, the last ends at `day-end` when it has `end`; legs chain contiguously; points other than `lodging`/`day-start`/`day-end` are the stops in order then at most the dinner meal's `at`; the hotel bag step and the dinner sit in the timeline. Why: today it rejects every C11 day with a start, end, bag leg or dinner legs ("expected N legs (lodging → each stop → lodging)"). `planner/planner-chain.mjs` `checkDayChain(day)` implements exactly this and agrees with the old rule on every old fixture day — call it from `checkDayPlan` or copy it.
2. **`tour-guide-checks.mjs` `checkPlan`** — a dinner meal's `at` (not `lodging`) counts as scheduled (a known place, not in a Later list). Why: dinner places are `status: 'scheduled'` in `plan.places` without being a stop.
3. **Coordinator (merge)** — point `ownHoursConflict(facts, hours, date, name)` in `planner/planner-facts.mjs` at WP-11b's `facts/index.mjs` `factsConflict(facts, googleHours, date)` (map its kinds to the line), or keep it: it mirrors the kinds and the 15-minute tolerance. Why: one conflict rule.
4. **WP-11b place schema (merge order)** — plans carrying places with `facts` / `crowd_magnet` (the moving-day plan, dinner places) validate only once WP-11b's `tour-guide-place.schema.json` is merged. Why: `validate(plan, 'plan')` checks `places[]` against the place schema.
5. **WP-11d `kits/brochure/lib/model.mjs:40` and `brochure-map/brochure-map-days.mjs:56`** — accept `day-start` and `day-end` (and a dinner slug that is in `places`) as leg endpoints; draw `start`/`end` names from the DayPlan. Why: they flag any endpoint other than `lodging` as an unknown place / drop it.
6. **WP-11c GAS digest validator (`gas/20_envelopes.js:246`) and `tour-guide-plan-digest.schema.json` legs `maxItems` 26** — DayPlan legs may now be up to 30 (bag and dinner legs); raise to 30 or have the digest builder keep ≤ 26. Why: a long moving day with dinner can exceed 26.
7. **WP-11g digest builder / plan request (private repo)** — pass `input.dinners` (saved places with snapshots that fit the diet) and the profile excerpt's `avoid`; map DayPlan `start`, `end`, `bags`, `sunset`, `extras`, meal `booking`, stop `last_entry`/`minutes_source`/`crowd_slot` to the digest. Why: the planner produces them only when given the inputs.

Developed by: LightAISolutions

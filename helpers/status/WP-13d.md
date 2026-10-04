# WP-13d status — Scout engine: been before, city days, one grammar, the vegetarian flag, own names

Branch `wp-13d` (worktree of `origin/main` at v01.63r). Brief: `helpers/prompts/TG-PHASE-13.md` "WP-13d".
Decisions and defaults: `helpers/decisions/WP-13d.md`; the contract as built: `helpers/decisions/TG-SCOUT.md` §9.

## Step 0
- Read the brief, Contract C13, SPEC §5/§16/§18, the pack README, TG-SCOUT.md and the Scout engine, the core's
  `tgScoutParse`, and review §4 (faults 8–12) and §3.1 (B9, B11) for the technical details only.
- Baseline: `node --test helpers/tests/` 882 tests (881 pass, 1 skipped), `bundle.mjs --all --check` ok,
  `boundary-check.mjs` clean.
- Each finding reproduced first: the six tests in `pack_tour-guide_p13d_scout.test.js` all fail on the unchanged engine.

## Done
- Fault 8, been before: `known` in `rankScout` and `scoutPayload` → `seen_before`.
- Fault 9, city dates: `city_dates` in `rankScout` / `screenReason` (screen and penalty) and `renderScoutBoard` (hours,
  compare table, left-out wording); no seven-date cap; `hoursRows` groups consecutive identical days.
- Fault 11, one grammar: `parseScoutText` → `{ what, where, city, area }` in the core's separator order; the table is
  `fixtures/p13d-scout/tg-fixture-p13d-scout.mjs` `GRAMMAR` (with `core_same` for the parity test).
- B11: `diet_rule` in `rankScout` / `screenReason`; Google's flag alone → `diet_unproven` ("vegetarian not confirmed"),
  café topics excepted.
- B9: judgment `name` → item `name` / `own_name`; `scoutPlaceFields(…, { own_name })`, `{ place: null, reason:
  'no_own_name' }` for a new pick without one.
- `TG-SCOUT.md` §9; engine tests updated for the new shapes (see decisions 11).
- Checks: `node --test helpers/tests/` 888 tests, 887 pass, 0 fail, 1 skipped; `bundle.mjs --all --check` ok;
  `boundary-check.mjs` clean.

## Next
- Nothing; waiting for the merge.

## REQUESTs
1. **WP-13c — pack README** (`helpers/packs/tour-guide/README.md`, "Scout — `scout/`"): add the new engine inputs and
   outputs: `parseScoutText` → `{ what, where, city, area }` (TG-SCOUT §9 grammar); `rankScout` options `known`,
   `city_dates`, `diet_rule` and the judgment's `name` (item `own_name`); `scoutPayload` option `known`;
   `renderScoutBoard` option `city_dates` and the new `hoursRows`; `scoutPlaceFields` option `own_name` and its
   `{ place: null, reason: 'no_own_name' }`. Why: the README is WP-13c's this phase.
2. **WP-13c — `gas/16_scout.js`, the ranked chat line**: show a mark for the `seen_before` label (the line shows only
   💎 and 🌱 today; the app's Scout screen already words it "seen before"). Why: the review's fault 8 is that "been
   before" never lights for the owner; the engine now sets it, the chat still drops it. No validator change is needed
   (the label is already in `TG_SCOUT_LABELS`).
3. **Coordinator — the parity test** (merge step 2): run the core's `tgScoutParse` and `parseScoutText` over
   `GRAMMAR` from `packs/tour-guide/fixtures/p13d-scout/tg-fixture-p13d-scout.mjs`; for every case with `core_same:
   true` the core's `{ what, where }` equals the engine's. (Checked by hand on this branch: all 19 cases match their
   `core_same` mark.)
4. **Coordinator / WP-13p — the private drivers** (after the re-pin): pass `known` (the place ids already in Places),
   `city_dates` (the dates the owner is in the searched city, from the trip's stays and day towns) to `rankScout` and
   to `renderScoutBoard`, and `diet_rule` (the profile's hidden-stock rule); ask the judgment step for each place's own
   `name` (its own site or a local source, ≤ 120) and pass it to `scoutPlaceFields` as `own_name`, counting the
   `no_own_name` picks in the run's log line; take the city from `parseScoutText(text).city` (falling back to the
   trip when it is ''), never from the first comma part of `where`.

## Tests outside my paths changed
- None. (`pack_tour-guide_scout.test.js` and `pack_tour-guide_scout_redteam.test.js` are the Scout engine's tests,
  this WP's; changed assertions are marked with fault 11 / B9.)

Developed by: LightAISolutions

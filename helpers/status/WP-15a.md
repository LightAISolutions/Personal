# WP-15a status — Day trip (item 19) and the rail estimate

Branch `wp-15a` (worktree of `origin/main` 6a27371, v01.68r, fast-forwarded to `p15-skeleton` 3e19825). Brief:
`helpers/prompts/TG-PHASE-15.md` "WP-15a". Decisions: `helpers/decisions/WP-15a.md`.

## Step 0
- Baseline after the skeleton: `node --test helpers/tests/` 1120 tests, 1119 pass, 0 fail, 1 skipped;
  `bundle.mjs --all --check` ok; `boundary-check.mjs` clean; `new-branch.mjs --check daytrip` complete.

## Done
- **Step 1, the rail estimate (R).** Fault reproduced first (40 km → 114 min, 41 km → 70). `RAIL.CITY_FULL_KM: 15`,
  `city(km)` / `conventional(km)` named in `planner/planner-rail.mjs`; the band pinned in
  `tests/pack_tour-guide_p13b_rail_season.test.js` (three `R:` tests). Whole suite green.

- **Steps 2–5, 6 (core side) and 7 (docs).** The engine (`daytrip/daytrip-text.mjs`, `daytrip-rank.mjs`,
  `daytrip-outline.mjs`, `daytrip-payload.mjs`), C15's schema, the fixture and the shared parse cases; the core module
  `gas/41_daytrip.js` (`/daytrip`, `/daytrips`, `tgDaytripParse`, the validator, the handler, the `DayTrips` tab, the
  card, the `dt` buttons, the replan, `daytrips_kept`) and the app ops in `gas/33_daytrip_app.js`
  (`daytrip.list/get/keep/new`). Tests: `pack_tour-guide_daytrip.test.js` (rewritten on the real fields),
  `pack_tour-guide_daytrip_gas.test.js`, `pack_tour-guide_daytrip_engine.test.js`. Branch README and the pack README's
  rows for `33_daytrip_app.js` and `41_daytrip.js`. Suite 1146 pass, 0 fail, 1 skipped; bundle, boundary and
  `--check daytrip` clean.

- **Step 6, the Day trips screen** in `live-site-pages/helper-app.html` (no version file, no changelog): the list (a
  form asking `daytrip.new`, the kept trips from `daytrip.list`'s new `kept_trips`, the boards) and one board (ride,
  length, why, highlights, food, season, closed days, four bars, labels, Keep, the day picker, more, left out in words).
  Test: `pack_tour-guide_daytrip_app.test.js` (fake DOM). Suite 1152 tests, 1151 pass, 0 fail, 1 skipped.

## Final checks (all clean)
- `node --test helpers/tests/`: 1152 tests, 1151 pass, 0 fail, 1 skipped. Vendored layout: 1134 pass, 0 fail, 18 skipped.
- `bundle.mjs --all --check` ok; `boundary-check.mjs` clean; `new-branch.mjs --check daytrip` complete.

## Next
- Done; handed back to the coordinator.

## REQUESTs
- REQUEST (SPEC §16): add the row `helpers/packs/tour-guide/daytrip/**`, `gas/41_daytrip.js`, `gas/33_daytrip_app.js`,
  `schemas/tour-guide-daytrip.schema.json`, `tests/pack_tour-guide_daytrip*.test.js` → WP-15a (Day trip, C15).
- REQUEST (`schemas/index.mjs`, frozen this phase): set `KINDS.daytrip` to `checkDaytrip`, imported from
  `../daytrip/daytrip-payload.mjs` (or call `validateDaytripPayload` and map each message to `{ path: '/', message }`),
  so `validatePayload('daytrip', p)` also refuses rank order, duplicate slugs and labels, unreal dates, Google field
  names and payloads over 20 000 characters, as both validators do. Beware the import cycle: `daytrip-payload.mjs`
  imports `validatePayload` from `schemas/index.mjs`; a lazy call inside `KINDS.daytrip` or moving the schema check out
  of `daytripPayload` breaks it.
- Heads-up (pack README): WP-15b adds rows for `34_whatson_app.js` and `42_whatson.js`; mine sit just before
  `35_scout_app.js` and just after `40_interview_bank.js`, so the merge may need both sets of rows kept by hand.
- Heads-up (`helper-app.html`, the vegcard test): WP-15b's What's on screen touches the same wiring lines (`SCREENS`,
  `S`, `readParams`, `go()`'s map, the nav reset) and probably the Veg card test's `shows` list; keep both entries.

## Tests outside my paths that I changed
- `helpers/tests/pack_tour-guide_vegcard_app.test.js` (`C15`): its fake `go()` context lists `showDaytrip`, since
  `go()` now dispatches the Day trips screen. No assertion changed.

Developed by: LightAISolutions

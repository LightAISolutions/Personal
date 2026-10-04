# WP-14d status — the owner's lists (item 11)

Branch `wp-14d` (worktree of `origin/main` at v01.66r, a5fe28d). Brief: `helpers/prompts/TG-PHASE-14.md` "WP-14d",
the Wave 2 section and Contract C14 — wave 2. Decisions and defaults: `helpers/decisions/WP-14d.md`.

## Step 0
- Read the brief, the tools README "Branches", WP-14a/b/c and TG-PHASE-14 decisions, the Places tab code
  (`gas/21_sheets.js`), the places digest validator (`gas/20_envelopes.js`), `places.search` (`gas/32_app_api.js`), the
  place and places-digest schemas, the app's Places screen and their tests.
- Baseline: `node --test helpers/tests/` 1024 tests (1023 pass, 1 skipped), `bundle.mjs --all --check` ok,
  `boundary-check.mjs` clean.
- Generated the branch once: `new-branch.mjs lists --title "Lists" --command /lists --kind lists --no-envelope --no-tab
  --no-app --prefix 28` (commit 3bc027a).

## In progress
- Nothing: the final checks are below.

## Done
- The skeleton.
- The engine (`lists/`): `readSavedExport` (.tgz, .zip, bare .csv; RFC 4180; the limits), `parseMapsUrl`,
  `mergeLists` + `recordResolution`, `lookupFor` + `acceptResult`, `destinationFor`, `listNotesFor`, `listedPlace` and
  `applyListTags` (`tests/pack_tour-guide_lists_engine.test.js`, invented export `lists/fixtures/lists-export.json`).
- The place file (C14): `lists`, `list_notes`, `cid` and the `listed` history event in
  `schemas/tour-guide-place.schema.json`; uniqueness and "a note names one of the place's lists" in `checkPlace`.
- The core (`tests/pack_tour-guide_lists.test.js`): `gas/28_lists.js` (`/lists`, `/lists sync`, `/list <name>`,
  `tgListNames()`, RESEARCH routing from this file); the Places tab's `lists` column (`registerSheet`, `TG_PLACE_OPT`,
  `tgShPlaceOut`, `tgPlacesUpsert` in `gas/21_sheets.js`); `lists` in `tgEnvValidatePlacesDigest` and the places-digest
  schema; `places.search`'s `list` filter and `lists` facet (`tgAppOpPlacesSearch` and its `TG_APP_OPS` args in
  `gas/32_app_api.js`); `/places` showing a place's lists (`tgCmdPlaceLine` in `gas/10_commands.js`); the Places
  screen's list filter in `live-site-pages/helper-app.html` (no version file, no changelog).
- The docs: `lists/README.md` (the export, link forms, merge and resolution rules, the destination and place file, the
  chat and the app, the limits, the owner's export steps) and the "Lists" section in `packs/tour-guide/README.md`.
- The decisions file: every default with its reason.

## Final checks
- `node --test helpers/tests/`: 1052 tests, 1051 pass, 1 skipped, 0 fail.
- `node helpers/tools/bundle.mjs --all --check` ok · `node helpers/tools/boundary-check.mjs` clean ·
  `node helpers/tools/new-branch.mjs --check lists` complete.
- The copy test (helpers copied to `vendor/helpers` in a temp dir): 1052 tests, 1041 pass, 11 skipped (the tests that read live-site-pages), 0 fail.

## REQUESTs
- None.

## Tests outside my paths changed
Each changed assertion is marked "C14"; each break comes from the new last Places column or the new facet.
- `helpers/tests/pack_tour-guide_gas_app.test.js` — `places.search` filters now include `lists: []`.
- `helpers/tests/pack_tour-guide_gas_sheets.test.js` — the Places tab's columns end with `lists`.
- `helpers/tests/pack_tour-guide_p13c_scouted.test.js` (two tests) — the last two Places columns are `scouted`, `lists`
  (was: the last is `scouted`).

## Edits outside the named functions (flagged)
- `gas/21_sheets.js`: `registerSheet(PLACES, …)` gains `lists` (ensureSheets can only add a registered column) and
  `TG_PLACE_OPT` gains `lists` (the digest validator's optional keys); two small helpers `tgShPlaceLists`, `tgPlaceListsIn`
  beside `tgShPlaceOut`.
- `gas/32_app_api.js`: `TG_APP_OPS['places.search'].args` gains `list` (the op refuses unknown args otherwise).
- `gas/10_commands.js`: `tgCmdPlaceLine` adds "📋 <lists>" — the brief's "`/places` search results show a place's lists".

Developed by: LightAISolutions

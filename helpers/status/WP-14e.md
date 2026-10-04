# WP-14e status — Compare (item 12) and the Discover routing (item 16's core half)

Branch `wp-14e` (worktree of `origin/main` at v01.66r, a5fe28d). Brief: `helpers/prompts/TG-PHASE-14.md` "WP-14e".
Decisions and defaults: `helpers/decisions/WP-14e.md`. **State: done**, pending the coordinator's merge (after WP-14d).

## Step 0
- Read the brief (Step 0, Wave 2, Contract C14 wave 2, WP-14e, Rules), `helpers/tools/README.md` "Branches",
  `helpers/decisions/WP-14a.md`, `WP-14b.md`, `WP-14c.md`, `TG-SCOUT.md`, `TG-PHASE-14.md`, and Scout end to end.
- Baseline: `node --test helpers/tests/` 1024 tests (1023 pass, 1 skipped), `bundle.mjs --all --check` ok,
  `boundary-check.mjs` clean.
- Generated once: `node helpers/tools/new-branch.mjs compare --title "Compare" --command /compare --kind compare
  --no-envelope --no-app --no-tab --prefix 29`. `--check compare` passes (with `discover routing` ok).

## Done
- **Discover routing.** `TG_DISCOVER_KINDS` and `tgKindRoutine` in `gas/00_common.js` (`pack_tour-guide_p14e_routing.test.js`).
- **The scout schema and both validators.** `mode`, `source` (both shapes), item `flags`, `not_found`, and the pairing
  refusals.
- **The engine's compare mode** (`scout/`): no topic screen; flags instead of drops; hard flags sort last; the ten-place
  cut and `more`; `not_found`. Scout mode is pinned unchanged.
- **The payload and the board.** Compare title, warnings, no topic bar, a Warnings column.
- **`/compare`** (`gas/29_compare.js`): names, a list via `tgListNames()`, `in <place>`, the usage line.
- **The core.** It stores compare boards (Scouts `mode`, `source_json`) and adds the ⚖️ card with its warnings, the
  `/scouts` mark, and `scout.get`/`scout.list` heads.
- **The app's Scout screen** (`live-site-pages/helper-app.html`, Scout screen only; no version file or changelog).
- **`new-branch.mjs --discover`.** The guarded push, `discover=yes`, and the `discover routing` row. Output without the
  flag is byte-identical: the sha1s of all 41 files for the four old shapes match.
- **Docs.** TG-SCOUT.md §11 Compare; pack README "Discover routing" and a Compare paragraph; tools README `--discover`.

## REQUESTs
- **Coordinator, pack README `gas/` table.** Add a row for `29_compare.js` ("`/compare <a>, <b>[, …] | <list> [in
  <place>]` → request kind `compare` (a discovery kind: DISCOVER when configured, else RESEARCH); the answer is a
  `scout` board with mode `compare`"). Extend the `00_common.js` row with "`TG_DISCOVER_KINDS` → DISCOVER when
  configured". Left out to avoid a conflict with WP-14d's `28_lists.js` row in the same spot.
- **WP-14p (private, wave 2).** The compare driver passes, per record:
  - `in_where`;
  - `listed_on` (ISO date);
  - names it could not find, as `not_found`;
  - `source` (`{ names }` or `{ list }`) and `mode: 'compare'` to `rankScout`/`scoutPayload`.
- **Merge note.** `29_compare.js` calls `tgListNames` only when it exists. Once WP-14d is merged, its tests still stub
  it, so the order does not matter for the suite.

## Tests outside my paths that I changed
- None outside my paths. For the record, inside my paths: `pack_tour-guide_scout_gas.test.js` (a Scout test) has its
  Scouts column list extended with `mode` and `source_json`, marked C14. `pack_tour-guide_p14e_routing.test.js` (mine)
  now pins `00_common.js`'s declaration instead of the exact run-time list.

Developed by: LightAISolutions

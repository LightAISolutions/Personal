# WP-14a status — the branch scaffold (item 15)

Branch `wp-14a` (worktree of `origin/main` at v01.65r). Brief: `helpers/prompts/TG-PHASE-14.md` "WP-14a" (read from the
coordinator's checkout; not committed here). Decisions and defaults: `helpers/decisions/WP-14a.md`.

## Step 0
- Read the brief, Contract C14, SPEC §5/§16/§18, the pack README, TG-SCOUT.md, WP-13c/13d, and Scout end to end
  (`gas/16_scout.js`, `gas/35_scout_app.js`, `scout/`, its schema, its tests).
- Baseline: `node --test helpers/tests/` 978 tests (977 pass, 0 fail, 1 skipped); `bundle.mjs --all --check` ok;
  `boundary-check.mjs` clean.
- `tgKindRoutine` reads `TG_KIND_ROUTINE` at call time (`hasOwnProperty` lookup inside the function), so a key added by a
  later file is seen: no REQUEST needed for routing.

## Done
- `helpers/tools/new-branch.mjs`: the generator (`<name>` plus every option in the brief, `--no-tab`, `--dry-run`, `--force`, `--private-out`) and `--check <name>`. Exit 0 done/complete, 1 missing, 2 usage/clash.
- `helpers/tools/branch-templates/`: core module, app file, schema, payload module, `index.mjs`, README, fixture, test, private `SKILL.md` and its two drivers.
- `helpers/tests/tools_new_branch.test.js` (11 tests):
  - four shapes in one temp copy (everything; `--no-tab`; `--no-envelope`; all three off) each pass their own check, their own test, `bundle --all --check`, the boundary check and the whole suite on the copy;
  - eleven removed pieces are each named; removing the `@branch` line names the missing tab;
  - 19 clashes and usage errors are refused with nothing written;
  - `--dry-run` writes nothing, and `--force` is byte-identical;
  - `--check scout` passes on the real tree;
  - the modules load in the harness;
  - the private drivers run in a private layout and pass `envelope.mjs --pack`;
  - library unit tests.
- `helpers/tools/README.md` (new) "Branches"; `helpers/decisions/WP-14a.md`.
- Checks on `wp-14a`: `node --test helpers/tests/` 989 tests, 988 pass, 0 fail, 1 skipped; `bundle.mjs --all --check` ok; `boundary-check.mjs` clean. Vendored layout (`<tmp>/vendor/helpers`, `node --test vendor/helpers/tests/`): 989 tests, 987 pass, 0 fail, 2 skipped (the page test, which has no `live-site-pages/` there, and the live smoke).

## Next
- Coordinator: run `node helpers/tools/new-branch.mjs --check vegcard` once WP-14c lands. A part it lacks on purpose needs an `@branch` line with `-` (decisions 1, 8).
- Wave 2: `new-branch.mjs lists --no-envelope --no-tab --no-app` and `new-branch.mjs compare --no-envelope --no-tab --no-app` (both shapes are covered by the tests).

## REQUESTs
- **R1 — the three tests that pin the pack's type and kind lists** should read the list from `helper.json`, so a new envelope branch does not break them:
  - `pack_tour-guide_payloads.test.js` "PAYLOAD_KINDS maps exactly the manifest envelope_types": `TYPES` vs `manifest.envelope_types`;
  - `pack_tour-guide_schemas.test.js` "every kind has a schema file…": the fixed `listKinds()` list;
  - `tools_envelope.test.js` "output passes core validateEnvelope…": the fixed `typesFor('tour-guide')` list.

  Suggested shape:
  - assert the original ten are present, in order, as a prefix;
  - assert every extra type has a `PAYLOAD_KINDS` entry and a strict schema;
  - assert `typesFor` equals core types plus `manifest.envelope_types`.

  Until then:
  - every WP that adds a type (WP-14c's own included) must update those three lists by hand;
  - `tools_new_branch.test.js` allows exactly those three failures on its temp copy.

  I did not edit them.

Developed by: LightAISolutions

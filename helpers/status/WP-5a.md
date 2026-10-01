# WP-5a — Commands and flows: the interview and the `/plan` journey

**State: done.** All four gas files built and tested; defaults and deviations in `helpers/decisions/WP-5a.md`.

## Built
- `helpers/tools/bundle.mjs`: generated-file step (`GENERATED` table, `generatedFor`, `generatedScript`, `staleGenerated`, `writeGenerated`). Normal mode rewrites `packs/tour-guide/gas/40_interview_bank.js` from `kits/prefs/presets/travel.interview.json`; `--check` fails with "generated file out of date" on drift. Test: `helpers/tests/tools_bundle.test.js`.
- `gas/40_interview_bank.js` — generated (never hand-edited).
- `gas/11_flow_interview.js` — flow `interview`, `/interview [section|all]` + `pack_tour-guide_gas_interview.test.js` (5).
- `gas/10_commands.js` — `core_start` renderer, `/profile /trip /today /day /later /place /places /replan /notes /brochure /lodging`, callbacks `dy lt ps pl` + `pack_tour-guide_gas_commands.test.js` (6).
- `gas/12_flow_plan.js` — flow `plan` (intake → facts → questions → research → shortlist rounds → plan → digest), `/plan`, `/seed`, renderers `tg_trip_facts tg_shortlist tg_plan_digest`, callbacks `tf sl`, plan action `pl:sc` + `pack_tour-guide_gas_plan.test.js` (5).
- `gas/13_flow_review.js` — flow `review`, `/review [trip]`, callback `rv:go`, daily job `tg_review_offer` + `pack_tour-guide_gas_review.test.js` (6).
- wp-5b merged (d5946ff) after its status said "storage API: done".
- Plan flow keeps the missing-fact questions inside stage `confirm` (`state.ask`), so `state.stage` stays in the contract set (9e79102).
- `helpers/decisions/WP-5a.md` — 28 decisions (deviations 1–8).

## Tests
Full suite 351 tests: 350 pass / 1 skipped / 0 fail; bundle `--all --check` ok (tour-guide 24 files); boundary-check clean (346 files).

## Requests to other owners
None.

Developed by: LightAISolutions

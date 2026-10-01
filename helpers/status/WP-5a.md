# WP-5a — Commands and flows: the interview and the `/plan` journey

**State: in progress (paused on the usage-limit cue).**

## Built so far
- `helpers/tools/bundle.mjs`: generated-file step (`GENERATED` table, `generatedFor`, `generatedScript`, `staleGenerated`, `writeGenerated`). Normal mode rewrites `packs/tour-guide/gas/40_interview_bank.js` (`var TG_INTERVIEW_BANK = {...}` from `kits/prefs/presets/travel.interview.json`, "DO NOT EDIT" banner + Developed-by line); `bundle()` / `--check` fail with "generated file out of date" when the file on disk differs.
- `helpers/packs/tour-guide/gas/40_interview_bank.js` — generated (never hand-edited).
- `helpers/tests/tools_bundle.test.js` — new test for the generator (current file, loads in a vm, drift caught, writeBundle regenerates).

## Where I stopped / next steps
1. `gas/11_flow_interview.js` (flow `interview`, bank-driven, Skip/multi Done/scale, progress line, resumable ttl 7 days, `/interview [section]`, answers `{version:1, answers:[{qid,dimension,value,polarity,kind}]}`; text answers split on newlines/commas/semicolons, ≤5 values, each ≤60 chars, polarity '+') + `pack_tour-guide_gas_interview.test.js`.
2. `gas/10_commands.js` (`core_start` renderer, `/profile`, `/trip`, `/today`, `/day`, `/later`, `/place`, `/replan`, `/notes`, `/brochure`, `/places`, `/lodging`, `/seed`), `gas/12_flow_plan.js` (flow `plan` + renderers `tg_trip_facts`, `tg_shortlist`, `tg_plan_digest`, callbacks `sl tf lt pl dy ps`), `gas/13_flow_review.js` (flow `review`, `rv`, daily job `tg_review_offer`) — after merging `wp-5b` (its status file did not yet say "storage API: done").
3. Owner seeds marked "your pick": the shortlist schema has no owner_seed field, so the plan flow remembers the seed names it sent and matches item names case-insensitively (plus `labels` containing `owner_seed` defensively) — to record in `helpers/decisions/WP-5a.md`.

## Tests
`node --test helpers/tests/tools_bundle.test.js` — 5/5 pass. Full suite was 303 pass / 1 skipped before this WP.

## Requests to other owners
None yet.

Developed by: LightAISolutions

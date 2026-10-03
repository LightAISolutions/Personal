# WP-11b — research inputs: place facts, the season sheet, local favourites, crowd magnets

**State: done.**
- Brief: `helpers/prompts/TG-PHASE-11.md` (Contract C11, Step 0, WP-11b, Rules). Decisions and defaults: `helpers/decisions/WP-11b.md`.
- Branch `worktree-agent-a8ce2fde9fcaca7e1` (the coordinator's `wp-11b`), worktree `/home/user/Personal/.claude/worktrees/agent-a8ce2fde9fcaca7e1`, from `origin/main` 683c9e6.

## Done
- Step 0: the three checks were clean at the start (611 tests, 610 pass, 1 skipped; bundle ok; boundary clean).
- Schemas to C11's bounds: trip `day_overrides` (≤ 31) and `season` (weather, bloom ≤ 6, events ≤ 40, sources 1–10); place `facts` and the flags `local_favourite`, `crowd_magnet`. All optional; every old fixture trip and place validates.
- `checkTrip`: override dates real, unique, inside the trip; each overridden day ≥ 2 h from its real start and end; season dates real, `from ≤ to`, event ids unique, event lat/lng together. `checkPlace`: facts dates real, `visit_minutes.min ≤ max`, weekdays once each.
- `facts/`: `normalizeFacts`, `factsLines` (each ≤ 160), `menuLine`, `factsStale` (90 / 30 days), `factsConflict` (15-min tolerance). README and an invented full fixture.
- `season/`: `normalizeSeason`, `eventsOn`, `bloomOn`, `bloomKindOf`, `usualMonths`, `outOfSeason` (by hemisphere; the sheet's bloom wins; tropics and unknowns never drop). README and an invented full fixture.
- Gem screen: drop reason `out_of_season` (activities, not owner seeds); `local_favourite` (≥ 2 distinct publishers; floor 3.8 + offset; off-track ×1.5); `crowd_magnet` (mass-tourism top ten, or top decile of counts ≥ 2 000); flags on kept records, kept by `flagEvidence`, labels and line words, `local_favourite: true` on the shortlist item. Gems README updated.
- Tests: `pack_tour-guide_facts`, `_season`, `_c11_inputs`, `_gems_c11` (new) and `_gems` (updated), all calling the real functions.
- Final checks: `node --test helpers/tests/` 627 tests, 626 pass, 0 fail, 1 skipped; `bundle.mjs --all --check` ok; `boundary-check.mjs` clean (469 files).

## REQUESTs
- **REQUEST (WP-11c) — `helpers/packs/tour-guide/README.md`:** document `facts/` and `season/` (one line each in the module table), the drop reason `out_of_season` and the flags `local_favourite` / `crowd_magnet`. Why: the pack README lists the modules and I do not own it.
- **REQUEST (WP-11c) — `helpers/packs/tour-guide/schemas/tour-guide-shortlist.schema.json`:** accept the optional `local_favourite: true` (boolean `const: true`) on a shortlist item, per C11. Why: `toShortlistFields` now emits it for flagged records; until the schema allows it a flagged item fails validation (unflagged items are unchanged).
- **REQUEST (coordinator → WP-11d) — `brochure-map-facts.mjs`:** build the facts and season lines from `factsLines(facts, { now, diet }) → { facts_line?, booking_line?, price_line?, menu_checked? }`, `menuLine(facts, { now, diet }) → string`, `eventsOn(season, date, { kinds? }) → event[]` and `bloomOn(season, date) → string` (from `facts/index.mjs` and `season/index.mjs`) rather than a second formatter. Why: one wording and one 160-character rule everywhere.
- **REQUEST (coordinator) — `helpers/SPEC.md` §16 / TG-PHASE-11 decisions:** add ownership rows for `helpers/packs/tour-guide/facts/*` and `helpers/packs/tour-guide/season/*` (WP-11b). Why: new directories with no row in the ownership map.
- **REQUEST (WP-11a) — planner:** `factsConflict(facts, googleHours, date)` exists for the "own site and Google disagree" info warning; `crowd_magnet` is on places as a flag for timing advice; read `facts.visit_minutes`, `last_entry`, `close`, `closed_weekdays` through `normalizeFacts`. Why: the planner consumes these and I do not own it.
- **REQUEST (WP-11g) — `trip-research` routine/skill:** pass `season` (the trip's sheet) and `lat` (optional) to `gems.screen`, write `facts` through `normalizeFacts` and the sheet through `normalizeSeason`, and fill each local mention's `publisher` so local favourites count outlets, not pages. Why: without `season` the screen falls back to usual months only; without `publisher` two pages of one outlet count as two.

Developed by: LightAISolutions

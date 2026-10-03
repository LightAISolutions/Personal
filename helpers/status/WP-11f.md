# WP-11f — Core and Mini App: compare outlines and days

**State: done.**
- Brief: `helpers/prompts/TG-PHASE-11.md` (WP-11f, wave 2 rules). Decisions and defaults: `helpers/decisions/WP-11f.md`.
- Worktree branch `worktree-agent-afc0f3580ad9e65b5`, from c6d935e (v01.53r). Not pushed.
- Step 0: `node --test helpers/tests/` 735 tests, 734 pass, 1 skipped; `bundle.mjs --all --check` ok; `boundary-check.mjs` clean.
- Finish: see the last section.

## Done
- **Envelopes** `outline` and `day_versions`: `schemas/tour-guide-outline.schema.json`, `tour-guide-day-versions.schema.json`, their cross-field checks in `tour-guide-checks.mjs` (consecutive calendar dates, the same dates in every option, unique keys, unique stop slugs, `chosen` among the keys), registered in `schemas/index.mjs` and `helper.json`; the core mirror `tgEnvValidateOutline` / `tgEnvValidateDayVersions` in `gas/17_journey.js`. Old pin payloads still validate (tests unchanged and passing).
- **Core** (`gas/17_journey.js`, `00_common.js` routing, `12_flow_plan.js`): two sheets (`Journeys`, `DayVersions`, 6 builds kept per trip); the plan flow gains the stages `outline` and `versions` after the shortlist (dated trip of 3–31 days → outlines; 1–2 days → versions; else straight to the plan, also with the ⏩ button); **off by default** — the owner's `/journey on|off` (Settings `tg_journey`, audited, like `/smart`) turns it on after the private routine's Phase 11 update; while off, Done choosing plans as before and `/outline`, `/versions`, the buttons (but ⏩) and the app's operations answer one line and send no request; chat cards with ✅ per option, a per-day grid, `/outline` and `/versions`; callbacks `ol:` and `dv:` (≤ 64 bytes); 🧱 Build my plan sends `plan` with the outline and the chosen versions; a planned day's other version replans it (`replan.alternative`); stale builds are refused and logged.
- **App ops** (`gas/36_journey_app.js`): `journey.get`, `outline.choose`, `versions.get`, `versions.choose` (`replace`), `versions.done`; refusals carry the chat's sentence as `text`; while off, `journey.get` answers `on: false` and the others refuse `409 off`. `shortlist.done` answers `stage` for the journey stages. `trip.digest` passes the C10 day fields and applies the note guard (`tgAppNote`).
- **Mini App** `live-site-pages/helper-app.html` v01.07w: the Compare screen (option cards, the tappable outline grid with a mix, the day versions with Suggested / ✓ Chosen, replace with a confirm, 🧱 Build my plan on the MainButton); entry from Home, the shortlist and `start_param` `compare_<slug>`; day cards that read like the chat card (legs, start/end, bags, dinner, extras, sunset, rain lines); an old day renders exactly as before. Changelog under [Unreleased].
- **Docs**: SPEC §5 (outlines and day versions), §6 (29 app operations), §16 (WP-11f row), §18 (`TG_JY` limits); the pack README (payloads, gas files, app bullets).
- **Tests**: `pack_tour-guide_journey_payloads.test.js` (every bound at its edge and past it, Node validator and core mirror agreeing), `pack_tour-guide_gas_journey.test.js` (15: the default off and `/journey`, thresholds, cards, callbacks, choose/mix, versions, build, replace, stale, re-delivery, app ops, refusals, note guard), additions to the payloads, schemas and envelope tests (the plan and e2e tests are back to their original text now that the journey is off by default), `shell_helper-app_compare.playwright.mjs` (the screen in Chromium at 390×844, stubbed network).

## Screenshots read and checked (390×844, out of the repo)
light-1-outlines (and full page), light-2-mixed, light-3-versions, light-4-version-chosen, dark-1-outlines, light-5-day-card (and full page), light-6-off (the switch off: the title and "Send /journey on in the chat to turn them on."). No overflow or clipping on any screen (the test's `fits()` check). The only oddity is the fixed footer over content in full-page captures, an artifact of the capture. Run: `node helpers/tests/shell_helper-app_compare.playwright.mjs --out <dir>`; WP-9c's `shell_helper-app.playwright.mjs` still passes.

## Commits
c6ea9bd, 558e3c9, 662b72a, f0603dc, 6eb9167 (docs, status, decisions), and the follow-up "journey off by default" commit after them.

## REQUESTs
1. **WP-11e (journey/, planner/)** — emit `outline` and `day_versions` payloads that satisfy the two schemas: consecutive calendar dates covering the trip, the same dates in every option, keys `A`/`B`/`C` (2–3), `area` may be empty, `build_id` ≤ 120 characters and the same for an outline and the day versions built from it, `chosen` (optional) one of the version keys, stop slugs unique within a version. Why: the core and the Node validator refuse anything else, and the old-build check keys on `build_id`.
2. **Coordinator / WP-11h (routines, re-pin)** — the PLAN routine must answer the new request kinds: `outline {trip, dates, picks, later, skip}` → an `outline` envelope; `day_versions {…, outline {build_id, base, mix?}}` → one `day_versions` envelope per date; `plan` may carry `outline?` and `versions?: [{date, build_id, key}]`; `replan` may carry `alternative {date, build_id, key}`. The journey ships **off**: after the re-pin, the owner sends `/journey on` (say so in the WP-11h hand-over). Switched on too early, a trip waits at the outline stage; ⏩ Plan straight away instead or `/journey off` is the way out.
3. ~~Coordinator (README): rows for `16_scout.js` and `35_scout_app.js`~~ — done in the follow-up at the coordinator's request.

**Coordinator, wave-2 merge:** 1 met, then widened: both payloads now carry one to three options or versions, and the core takes a one-option outline as it is and shows a one-version day with no choice (`decisions/WP-11f.md`, "Coordinator changes"). 2 is the private-repo update (WP-11h); the hand-over says to send `/journey on` after it. 3 done.

## Finish
`node --test helpers/tests/` 752 tests, 751 pass, 1 skipped, 0 fail; `node helpers/tools/bundle.mjs --all --check` ok; `node helpers/tools/boundary-check.mjs` clean; `git status` clean.

Developed by: LightAISolutions

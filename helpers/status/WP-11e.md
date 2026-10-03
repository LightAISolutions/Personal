# WP-11e — Journey: outlines, day versions, the chosen mix

**State: done.**
- Brief: `helpers/prompts/TG-PHASE-11.md` (Wave 2, WP-11e, Rules) and the coordinator's wave-2 brief. Decisions and defaults: `helpers/decisions/WP-11e.md`.
- Worktree branch `worktree-agent-a8003c4663700abe3`, from c6d935e (v01.53r). Not pushed.
- Step 0: `node --test helpers/tests/` 735 tests, 734 pass, 1 skipped, 0 fail; `bundle.mjs --all --check` ok (hello 19 files, tour-guide 34 files); `boundary-check.mjs` clean (519 files).
- Finish: see the last section.

## Done
- **Planner `outline` input** (`planner/planner-outline.mjs`; hooks in `planner-assign.mjs`, `planner-day.mjs`, `planner-dinner.mjs`, `planner-solve.mjs`, `planner/index.mjs`): kinds full · light · travel · rain_spare · free, area (default radius by mode), anchors pinned and always kept by the solver, a dinner anchor as that evening's dinner, outline reasons in Later. Without `outline` the planner is byte-identical to c6d935e on every fixture.
- **Planner entry points for the journey**: `planDates(input, dates, { only, sink })`, `outlinePools(input)`, `versionSetBudget(...)`, `budgetFor`, `mergeLater` exported.
- **Journey module** `helpers/packs/tour-guide/journey/`: `outlineDraft`, `checkOutline`, `outlineInput`, `planVersions` (place versions with the day's anchors held, the keep rule, a slower day after a busy one, set budget; the split mode it had was removed at the wave-2 merge), `cachedMaps` (one request per point pair), `summarize`, `checkDayVersions`, `assembleChosen` (one Plan, rebuilt Later, dinner-clash rule, alternatives).
- **Fixture** `fixtures/two-stays/` (invented; `JOURNEY_FIXTURE_NAMES`).
- **Tests** `helpers/tests/pack_tour-guide_journey.test.js` (16): fixture hygiene; outlines cover each date once, moving days travel, dated bookings and picks anchored, checkOutline clean; picks and closures; options differ by the measure; checkOutline negatives; outlineInput; normalizeOutline errors; planTrip under an outline (free, light, rain-spare, areas, anchors, moving days); outline reasons in Later; no outline = unchanged; versions (2–3, share ≤ half, payload bounds, checkDayPlan and checkPlan on every version, moving days intact); no Places call and every pair asked once with exact usage; assembleChosen valid with Later; every option and a mix assemble; dinner clash and stop-twice; budget guard refuses the set with nothing sent.

## Commits
2e20167, 095ae4c, c1e7127, 6a7656b, 5a9bb81, c8a7fcc, and the commits after them (tests, status and decisions).

## REQUESTs
1. **WP-11f — `tour-guide-outline.schema.json` and `tour-guide-day-versions.schema.json`**: the journey module builds both payloads to the prompt's bounds; `journey/journey-check.mjs` (`checkOutline`, `checkDayVersions`) is the module's own check and can serve as a reference. Details the schemas should allow: an outline day's `anchors` may be `[]`; `note` is optional; a `day_versions` stop always carries `time` (HH:MM); `bookings` entries are "Name: line" strings; `chosen` is never set by the module. Why: the coordinator validates `outlineDraft` and `planVersions` outputs against the schemas at merge.
2. **WP-11f / coordinator — pack `README.md` and `helpers/SPEC.md`**: document `journey/` (the six functions), the planner's `outline` input (`{ by_date: { <date>: { kind, area?: { name, lat, lng, radius_km? }, anchors? } } }`, default radius `AREA_KM`, light cap 3), the new exports `planDates`, `outlinePools`, `versionSetBudget`, and the fixture list `JOURNEY_FIXTURE_NAMES`. Why: README and SPEC are WP-11f's.
3. **WP-11h (private repo plan routine)**: pass the whole `planVersions` result (not one version) per date to `assembleChosen` so Later can say "in another version you did not choose" and usage covers the whole set; keep `alternatives` in trip memory for `/versions <date>`; share one `cachedMaps(maps)` across all dates of a request; give `outlineDraft` the snapshots (it reads locations and hours from them) and the season sheet. Why: the routine owns these calls.
4. **Coordinator (wave-2 end-to-end test)**: `outlineDraft` → `outlineInput` → `planVersions` → `assembleChosen` on `loadFixture('two-stays')` exercises a moving day, a day trip, a rain-spare day and a booked dinner; the assembled Plan already passes `validate(plan, 'plan')` and `checkPlan`. Why: the prompt's coordinator step 1.

**Coordinator, wave-2 merge:** 1 met (WP-11f's schemas; the merge then let both payloads carry one option or one version). 2 done by the coordinator (pack README `journey/` section, SPEC §5 and §16). 3 is for the private-repo update (WP-11h). 4 done: `helpers/tests/pack_tour-guide_phase11_wave2_e2e.test.js`; it and a probe before it found the faults fixed at the merge (`decisions/TG-PHASE-11.md` §6).

## Finish
- `node --test helpers/tests/` — 751 tests, 750 pass, 1 skipped, 0 fail.
- `node helpers/tools/bundle.mjs --all --check` — ok (hello 19 files, tour-guide 34 files).
- `node helpers/tools/boundary-check.mjs` — clean.

Developed by: LightAISolutions

# WP-10b — honest travel legs and the six tidy-up fixes

**State: done (awaiting the coordinator's merge).**
- Brief: `helpers/prompts/TG-PHASE-10.md` (Done when, Contract C10, Step 0, WP-10b, Rules). Decisions and defaults: `helpers/decisions/WP-10b.md`.
- Branch `wp-10b`, worktree `/home/user/wt-10b`, from `origin/main` 33e67ae.

## Done
- (b) new categories temple, shrine, garden, experience: estimator defaults, Google-type mapping, legacy `church` refinement on load (`planner/planner-category.mjs`), indoor/outdoor.
- (c) rain swaps name covered sights only (`isCoveredSight`).
- (a) note guard `planner/planner-notes.mjs`, applied to brochure place-card notes (GAS day-card port comes with the day card).

- Suggestion 2 (planner side): a WALK route for every walked leg, estimates stay marked through `fetchLeg`, flags `footpath`/`trail`/`uphill`/`downhill`, `taxi_minutes` from one DRIVE request, per-leg `buffer_minutes`, per-day `spare_minutes`, per-day request budget (`extraCallsFor`). Schemas: day-plan leg/stop/day fields, place `opening_days`/`opening_note`.
- Invented hill-town fixture (`fixtures/hill-town/`) and `helpers/tests/pack_tour-guide_planner_legs.test.js`.

- (d) a dropped pick says how many minutes it was short and offers a shorter visit (`shortfall`, planner-day.mjs) in the Later reason and a day warning; (e) irregular (own record `opening_days`, or Google text) and unknown opening days are kept with `check_on_day`; (f) `time_style` on every stop (`timeStyle`).

- Day card (`tgCmdDayMessages` and `tgCmdDay…` helpers next to it): "walk 22 min", "about 20 min walk (estimate)", flags, "taxi about 11 min", "+5 min spare", "Spare time: …", "about 11:45" times, `check_on_day` lines, `tgBkDayLines` behind a `typeof` guard, the note guard port, Google's walking-route notice; an old day renders as before (plus that notice).
- Brochure: kit schema, model and sections (day rail, day stats, at-a-glance footer) and `brochure-map` `mapDay` carry the C10 fields; walks count as walks, estimates marked; `helpers/tests/pack_tour-guide_brochure_legs.test.js`.
- Decisions and defaults recorded; Google facts checked (`decisions/WP-10b.md` 14–30).

## Next
- Nothing; ready for the coordinator. Checks at the last commit: `node --test helpers/tests/` 573 tests, 572 pass, 1 skipped (the hand-run Maps live smoke), 0 fail; `bundle.mjs --all --check` ok; `boundary-check.mjs` clean.

## REQUESTs
- REQUEST (`helpers/packs/tour-guide/schemas/tour-guide-checks.mjs`, `checkDayPlan`, the "Estimated TRANSIT legs" block ~line 121): allow `estimated` on a `WALK` leg as well as `TRANSIT` (a WALK request that fails keeps the rail estimator's walking estimate: `mode: 'WALK', estimated: true, estimate_basis: 'distance'`). Keep "estimated and estimate_basis go together" and "exactly one `transit_estimated` warning" unchanged. Suggested line: `if (l.estimated && l.mode !== 'TRANSIT' && l.mode !== 'WALK') e(`/legs/${i}/estimated`, 'only a TRANSIT or WALK leg can be estimated');`. Test: `pack_tour-guide_planner_legs.test.js` "a failed WALK request…" accepts either message today and needs no change.
- REQUEST (same file, optional): the validator subset has no `uniqueItems`, so `checkDayPlan` could check that a leg's `flags` has no repeats (`/legs/i/flags`, "flags are listed once").

Developed by: LightAISolutions

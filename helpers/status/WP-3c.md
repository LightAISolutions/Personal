# WP-3c status — Plan → brochure mapping

**State: done.** Everything WP-3c owns is built and tested, and its tests pass. One test in the full suite fails, and it already failed before this WP started (see Checks): it comes from the pack skeleton commit, not from WP-3c. Branch `wp-3c`, worktree only, not pushed.

## Contract, item by item

| Item (brief "Brochure-map API" / TG-PHASE-3 row 3c) | Where | State |
|---|---|---|
| `toBrochureModel({ trip, plan, places, notes, snapshots, estimates, options })` → model that passes the kit's `validate()` (and `semanticErrors()`) | `brochure-map/index.mjs` | done, tested |
| `renderPlan(args)` → `{ html, model }` (+ `warnings`) through `renderHtml` | `index.mjs` | done, tested |
| `renderPlanPdf(args, outPath, opts)`, guarded by `pdfAvailable()` | `index.mjs` | done; the test renders a real PDF when Chromium is present and checks the no-PDF path otherwise |
| DayPlan legs → brochure legs: mode TRANSIT→transit, WALK→walk, DRIVE→drive; `line`, `maps_url`, times, distance | `brochure-map-days.mjs` | done |
| Stops: arrive / depart / minutes / activity / booked | `brochure-map-days.mjs` | done |
| Meals (incl. `at: "lodging"`), free blocks | `brochure-map-days.mjs` | done |
| Warnings: warn/alert on the day; info → stop note (or an info line) | `brochure-map-days.mjs` | done (decision 1) |
| Place cards: Place + PlaceNote + snapshot (`hours`, `hours_today`, `closed_days`, `rating`, `review_count`, `website`, `maps_url` = `maps_uri` or `placeUrl`, `business_status`, `fetched_on`) | `brochure-map-cards.mjs` | done |
| Later lists → `later[]` with reasons | `brochure-map-later.mjs` | done |
| `trip.practical` → `practical[]` (+ Day routes, Free days) | `brochure-map-practical.mjs` | done |
| `attribution.sources` = union of estimate and note sources, deduplicated by URL, with access dates; `attribution.generator` | `brochure-map-attribution.mjs` | done |
| `show_google_content: false` → Google fields replaced by a dated "Verify before you go" practical section with Maps links | cards + practical + attribution | done (decision 4) |
| Every stop's place has a card | test | done |
| `sampleInput()` for the coordinator's integration test | `brochure-map/brochure-map-sample.mjs` | done (92 lines) |

## Files
- `helpers/packs/tour-guide/brochure-map/index.mjs`
- `helpers/packs/tour-guide/brochure-map/brochure-map-text.mjs` (clipping, weekdays, date in the trip's zone, snapshot lookup)
- `helpers/packs/tour-guide/brochure-map/brochure-map-cards.mjs`
- `helpers/packs/tour-guide/brochure-map/brochure-map-days.mjs`
- `helpers/packs/tour-guide/brochure-map/brochure-map-later.mjs`
- `helpers/packs/tour-guide/brochure-map/brochure-map-practical.mjs`
- `helpers/packs/tour-guide/brochure-map/brochure-map-attribution.mjs`
- `helpers/packs/tour-guide/brochure-map/brochure-map-sample.mjs`
- `helpers/tests/pack_tour-guide_brochure-map.test.js` (8 tests)
- `helpers/tests/pack_tour-guide_brochure-map_units.test.js` (7 tests)
- `helpers/status/WP-3c.md`, `helpers/decisions/WP-3c.md`

## Checks (run in /home/user/wt-3c)
- `node --test helpers/tests/`: 163 tests, 161 pass, 1 skipped, **1 fail**. The failure is `tools_bundle.test.js` "bundle(hello)…", which expects `listPacks()` to return `['hello']`. It fails the same way on the base commit `4804e6c` ("Add tour-guide pack skeleton"), before any WP-3c change, because that commit added `packs/tour-guide/`. All 15 WP-3c tests pass, including the real PDF render (Chromium is present here: 8 pages).
- `node helpers/tools/bundle.mjs --all --check`: ok (hello 16 files, tour-guide 15 files).
- `node helpers/tools/boundary-check.mjs`: clean (178 files).

## Requests to the coordinator
1. **Fix `helpers/tests/tools_bundle.test.js:46`** (tools, coordinator-owned). Assert that `hello` is in `listPacks()` rather than deep-equal `['hello']`, or list `tour-guide` too. Until then the suite is red on every Phase 3 branch.
2. Paste the README section below into `helpers/packs/tour-guide/README.md`.
3. For the integration test: `sampleInput()` returns `{ trip, plan, places, notes, snapshots, estimates, options }`. With the planner's real output, call `toBrochureModel({ ...loadFixture(name), plan, options })`. `places` defaults to `plan.places`.
4. Owner question (TG-PHASE-2 §4) is still open. `show_google_content` defaults to `true`. Phase 4 `brochure-build` should pass the owner's answer. If the answer also covers coordinates, see decision 5.
5. README tree and CHANGELOG entries for the files listed above, at push time.

## README section
```
### brochure-map — a Plan → the brochure kit's model

`packs/tour-guide/brochure-map/index.mjs` (library; no CLI, no network):

    toBrochureModel({ trip, plan, places?, notes?, snapshots?, estimates?,
                      options: { generator?, built_on?, verified_on?, show_google_content = true } }) → brochure model
    renderPlan(args, { page?, embedFonts? })           → { html, model, warnings }   (kit renderHtml)
    renderPlanPdf(args, outPath, { page?, shotsDir? }) → { …, pdf, pages, available } (PDF only when pdfAvailable())

- Days: one brochure day per DayPlan with stops. Stops keep arrive/depart/minutes/activity/booked. Legs map
  TRANSIT/WALK/DRIVE → transit/walk/drive and keep `line` and the Maps link. Meals at "lodging" name the lodging.
  Warn/alert warnings go in the day's "Mind" block; an info warning becomes a note on its stop. Days with no stops
  are listed under "Free days" on the practical page; `day_url`s go under "Day routes".
- Cards: our Place (name, category, why it fits) + PlaceNote + the build's GoogleSnapshot content (address, weekday
  hours, the visit day's line, closed days, rating, reviews count, website, Maps link, business status, fetched
  date) + the note's and the estimate's sources. Every place a stop, meal, warning or Later item uses gets a card.
- Later lists keep their names and reasons (empty lists are dropped). `trip.practical` passes through.
- Attribution: the union of note and estimate sources of the brochure's places, deduplicated by URL (latest
  access date, merged "supports"), plus the generator line.
- `show_google_content: false` prints no Places content. Cards keep only our Maps link and the place id, a dated
  "Verify before you go" section lists every place with its Maps link, and the Google block is off.
- `brochure-map-sample.mjs` → `sampleInput()`: an invented two-day trip for tests.
Defaults and their reasons: `helpers/decisions/WP-3c.md`.
```

## Log
- 2026-10-01: read the brief, phase prompt, brochure kit (README, schema, model.mjs, sections), Maps URLs and snapshots, TG-PHASE-2 §4. Baseline suite already had the `tools_bundle` failure.
- Built the mapping (7 modules) and the sample input. Validated against the kit schema and semantic checks. Rendered HTML and a PDF (8 pages) and reviewed the day page by eye. Commit `af5ed55`.
- Added 15 tests (two files). Commit `d424fa0`. Ran the three checks (results above). Wrote this status and the decisions file.

Developed by: LightAISolutions

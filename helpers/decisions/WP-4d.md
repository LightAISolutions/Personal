# WP-4d — Phase 4b skill deltas: decisions

> Generic copy of the private repo's `repository-information/decisions/WP-4d.md` (TourGuide, branch `claude/tg-phase-4b-s94tru`); every trip, place and id named here is invented fixture data. Status, checks and requests: `helpers/status/WP-4d.md`.

Every default this WP picked, with why. Constants live in the named files; change them there.

## Shared
- **S1 · One digest builder.** `tools/tg-places.mjs` → `placesDigest(repo, destination, { slugs?, area? })` returns a validated `places_digest`; trip-research, plan-days, trip-check and prefs-build import it (trip-check re-exports it). Three builders had written three near-identical row builders; the owner must see the same rows whichever routine answers. Rows: `area` = the destination's display name from a trip that goes there; `history_summary` = consecutive (event, month) pairs merged, newest kept within 120 chars, a `checked` entry tagged `(closed)` / `(gone)` / `(moved)` / `(reopened)` from trip-check's codes or plain words; `note_line` = the note's *why you* else the place's `why_fit` (≤ 160); `maps_url` = the place-id link; caps 500 rows / 60 000 chars; every key but `name` checked against the Google list (names stored as today — Phase 6).
- **S2 · `schemaTrip()` is the identity.** The pinned Trip schema carries the six-word status enum, so the Phase 4 mapping is gone; the export stays so drivers keep one call site.
- **S3 · Places carry `destination` and `history`.** `seed-from-fixture.mjs` stamps `destination: slugify(trip.destination)` on seeded places; `appendHistory()` validates the event (9 words), the date and the note (≤ 120), caps history at 200, oldest first (the Place schema checks the order). `place-notes-write.mjs` merges onto the stored place so a note rewrite never drops them.
- **S4 · Dry runs take `--now`.** Every driver that reads the clock (`brochure-build-render.mjs` was the last) accepts `--now <ISO>` so the journey is reproducible; routines omit it.
- **S5 · Journey order.** The post-trip review runs before the next trip to the same destination: history is oldest-first by schema, so a May review after an August round is a schema error, not a skill bug. `tools/journey-dryrun.mjs` sets trip 2's lodging itself (status R1) and writes one invented closed place through `tg-memory` so the re-check has a closure to show.

## trip-research (builder A)
- **A1 · Driver split.** `trip-research-candidates.mjs` reads memory and writes `funnel.json` only; `trip-research-record.mjs` does every write (funnel mode; the Phase 4 `candidates.json` path still works as optional enrichment matched by `place_id`). A candidate the funnel did not select goes to the dossier only.
- **A2 · Known places lead a `new` round**, at most 4 activities and 3 food places (the rest counted as "N more places you know"), so new places keep room. "Closed" = `CLOSED_PERMANENTLY` or `CLOSED_TEMPORARILY`; an hours change cannot be detected (no hours stored); "moved" needs the trip's `locations` baseline (> 150 m); claims older than `--recheck-days` (90) are flagged unless the routine re-read the official site and passed `--rechecked`, else the item is `unverified`. In dry runs the recorded pool stands in for the snapshot.
- **A3 · Closed places keep their file**: status `rejected`, a `checked` history entry with the reason, an item on the trip's Later list "Closed since last visit" (`closed_business`). Not-shown funnel places go to "Gems not chosen" (`not_shown`) and join the trip as `candidate`, so `/later` can promote them and `more` rounds re-surface them.
- **A4 · Seeds are not force-shown**: they enter the funnel as stream `owner_seed`; the reply says when a seed scored below the cut or could not be resolved. `--gems-only` is valid only with `--scope more`.
- **A5 · Shortlist fields.** `fit` = gem score / 100; `dims` = category → interest, food words, price → our own coarse budget band, crowds from obscurity; items without mentions are `unverified`; `run_id` = `f<yyyymmdd><round>` when no research run; the research entry gains `scope`, `shown`, `gems`.
- **A6 · Floor not met** is said by `gems_shown < gems_wanted` (the pinned schema's group has no other field) and explained in the reply ("activities: 0 💎 of the 2 your appetite asks for; no more gems passed screening this round"). See status R2.
- **A7 · `gem_line` keeps the rating digits** the gems module produces, in the shortlist payload and reply only (status R3).
- **A8 · Source kinds, not publishers.** `sources/source-kinds.json` holds generic kinds (`editorial`, `community`, `local-language`), languages and query shapes per country; the research kit resolves actual sources at run time. `sources/transit-fallback.json` holds researched per-country door-to-door fallbacks; the only row is the invented fixture one.
- **A9 · Fixture Maps.** `tools/tg-maps.mjs` `mapsFor('fixture:<name>')` composes the pack's responder (details, routes, matrix) with the Maps kit's `fixtureResponder` (text search, nearby, `computeInsights`); a pack 404 falls through to the kit.

## plan-days and trip-check (builder B)
- **B1 · Choices go through the planner** (`planTrip({ choices })`); the `OWNER_CHOICE` prefix is gone. `plan-days-run.mjs` stages plan → notes → places → brochure, resumable (`run-state.json`), `--attach plan=,html=,pdf=,notes=` fills `drive_file_ids` (`plan, brochure_html, brochure_pdf, notes`) and the `plan_digest`'s `drive` block; statuses `planned` after the plan, `delivered` after the brochure.
- **B2 · History and evidence.** The places stage records `chosen · later · skipped · scheduled` per place, fills `destination`, and hands choice evidence (`+` for picks, `−` for skips, `source_ref choice:<trip>:<slug>`, the shortlist item's `dims`) to the prefs kit's `ingest` at `--min-support 2`; seeded fixture places without `dims` are listed under `no_dims`, not refused. `places_digest` only when a place file changed.
- **B3 · `locations` baseline** (lat/lng + `fetched_at`, ≤ 30 days) is written by every build so trip-check and the known-place re-check can tell a place has moved; never Google content beyond coordinates.
- **B4 · `places` kind.** `scope: list` = the digest with no Maps call; `scope: check` = fresh Place Details per stored place (`--slugs` to narrow), codes `closed_business · gone · moved · reopened`, a `checked` entry per place, a digest only when something changed; the weekly run re-checks stored places of upcoming destinations and skips the ones the owner rejected.

## prefs-build and routines (builder C)
- **C1 · Three paths, one driver each.** A request with `interview` and/or `review` runs only those (no connector read; interview first); neither → the window path. `reply` only when the owner must be told something the typed payloads cannot carry (answers or review refused, items left out, profile refused, trip unknown).
- **C2 · Review evidence** maps category → interview-bank values (museum → museums, church → religious sites, park → gardens and parks, market → markets …) plus a small tag table, ≤ 3 per place; `--min-support 2` applies to the whole review run so one review never proposes on its own; the review payload lists only candidates touched by this review.
- **C3 · Calibration taps** `longer | shorter | right` → the estimator's `applyTap` (`right` = `about-right`, counted, factor unchanged), into the trip's `calibration`; ignored on `skipped`.
- **C4 · Idempotency.** An item is `already` when the place's latest `rated_up | rated_down` for that trip has the same event and calibration note; already items write nothing, so a re-run is byte-identical. A reviewed place missing from `places/` is created from the trip's own Place entry.
- **C5 · Dedupe keys** `prefs-review-<batch_id>`, `profile-summary-<request id>`, `places-digest-<request id>`, `prefs-reply-<request id>`.
- **C6 · Routine table.** `trip-check` is fired for `places` (fire name `PLACES`) besides its weekly schedule; request-kinds → routine and envelope-types → routine tables live in `routines/README.md`; prompt files unchanged.

## Recorded from the project (not this WP's to decide)
- **P1 · Places Aggregate** is live-verified by the hidden-gems design thread (2026-10-01); this phase made no live call (forbidden); Phase 7 smoke.
- **P2 · Japan transit** — decided by the owner elsewhere: the Google-based station estimate (`planner-rail.mjs`, in this pin), Ekispert's paid timetable service as the named upgrade, NAVITIME dropped; Phase 8 asks the owner how the estimates feel.
- **P3 · Decision 19** (the Mini App, Phase 9) confirmed by the owner: after the pilot. Decisions 18, 20, 21 at their defaults.

Developed by: LightAISolutions

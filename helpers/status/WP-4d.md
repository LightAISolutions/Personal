# WP-4d — Phase 4b skill deltas (`trip-research`, `plan-days`, `prefs-build`, `trip-check`, `routines/`, journey dry-run): status

> Generic copy of the private repo's `repository-information/status/WP-4d.md` (TourGuide, branch `claude/tg-phase-4b-s94tru`); every trip, place and id named here is invented fixture data.

**State: done** (2026-10-01). Session branch `claude/tg-phase-4b-s94tru`, built on the unmerged Phase 4 branch (`claude/tg-phase-4-18ndyh`, head `5852e74`); three builders in worktrees (`wp-4d-a` trip-research, `wp-4d-b` plan-days + trip-check, `wp-4d-c` prefs-build + routines) merged after the shared contract commit. Defaults and their reasons: `helpers/decisions/WP-4d.md`.

## Contract (Personal → `helpers/prompts/TG-PHASE-4B.md`, Step 2)
| Item | State |
|---|---|
| Pin bump to the Phase 4b `helpers-dist` (`87be955` = Personal v01.25r: flows, interview, choices, payload schemas, transit fallback, Gem Funnel, planner rail leg) | done — `dc47ffe`; `vendor/helpers/` otherwise untouched |
| `trip-research`: `intake` scope typed as `trip_facts` (`found[].kind` enum); `shortlist` as the pack envelope type; `scope: more` honours `decided`; `gems_only: true` and `seeds: [names]` accepted | done — `trip-research-intake.mjs`, `trip-research-start.mjs`, `trip-research-record.mjs` |
| Gem Funnel stages 1–5 as the candidate step; per-country source-kind table (generic kinds and languages, no publishers) | done — `trip-research-candidates.mjs`, `sources/source-kinds.json` |
| `scope: new` re-checks the destination's known places first (`seen_before`, `changes`), closed → Later "Closed since last visit", `RECHECK_DAYS` 90 | done — `trip-research-candidates.mjs` (known-place re-check), `trip-research-record.mjs` |
| `toPlaceFields` into `places/`; "Gems not chosen" Later list; researched `transit_fallback` (`source: 'researched'`, one-line note) when the probe finds no transit; status researched → choosing | done — `trip-research-record.mjs`, `sources/transit-fallback.json` (invented row only) |
| `plan-days`: chain notes/brochure, `plan_digest` with Drive ids, statuses planned → delivered, place history `chosen · later · skipped · scheduled`, choice evidence via prefs `ingest` (`dims`, `--min-support 2`, `source_ref choice:<trip>:<slug>`), `places_digest` when the repository changed | done — `plan-days-run.mjs`, `plan-days-digest.mjs`, `plan-days-places.mjs`; `OWNER_CHOICE` prefix dropped |
| `prefs-build`: kit `interview` in one call; `prefs_review` + `profile_summary`; `review` payload → `rated_up` / `rated_down` history, evidence, calibration taps, `places_digest` | done — `prefs-build-ingest.mjs`, `prefs-build-review.mjs`, `prefs-build-common.mjs`; `interview-answers.json` fixed (15 answers, bank-valid) |
| `trip-check`: `places` kind (`scope: check \| list`); the weekly run also re-checks stored places | done — `trip-check-places.mjs`, `trip-check-run.mjs` |
| `tools/tg-memory.mjs`: `schemaTrip` identity, places by destination, history append/cap | done — `c1c8ed0` |
| `routines/*`, `skills/README.md` (request kinds, six pack envelope types, memory layout) | done — `routines/README.md` (request-kinds and envelope-types tables, `PLACES` fire name), `skills/README.md` |
| One shared `places_digest` builder | done — `tools/tg-places.mjs`; trip-research, plan-days, trip-check and prefs-build all emit the same rows |
| `tools/journey-dryrun.mjs`: the whole `/plan` journey, the interview path, a second `/plan` for the same destination with `seen_before` + `changes`, a `places_digest` after the plan, a `places` request answered with a `places_digest`, every envelope validated | done — 10 steps, 83 checks, 23 envelopes stamped |
| Chat hand-off: `gems_only`, `seeds` pass through to a `research` request | done — `skills/chat/chat-check.mjs`, `skills/chat/SKILL.md` |
| `place-notes` keeps a stored place's `destination` and `history`; `brochure-build` takes `--now` | done — found by the plan-days dry run |

## Checks (this checkout, 2026-10-01)
- `node tools/journey-dryrun.mjs` → `ok: true`, 83 checks, 0 failed, 23 envelopes validated (`envelope.mjs … --pack tour-guide`, `errors: []`), trips `port-sorrel-spring-2027`, `port-sorrel-2027-09`, `carrow-coast-loop-2027`.
- `node --test vendor/helpers/tests/` → 303 tests, 302 pass, 1 skipped, 0 fail. `node vendor/helpers/tools/boundary-check.mjs` → clean (283 files).
- Google-field scan (journey step 10, keys `rating · user_rating_count · hours · regularOpeningHours · website · address · business_status · price_level · reviews · types · googleMapsUri …`): none in `places/` (both repos), none in the trips' data blocks outside the owner's own lodging, none in any digest, `prefs_review`, `profile_summary` or `trip_facts` payload; coordinates only in the owner's lodging and the ≤ 30-day `locations` baseline of `trips/` (by design, trip-check's moved check).
- Branch diff since Phase 4 scanned for e-mail addresses, phone numbers, key shapes and the owner's name: only fixture dates and the invented `00000000-…` ids. Every `skills/*/examples/*.json` parses.

## Dry runs (the journey, scratch under `--out`, no network: `--maps fixture:<name>`, `--pool fixture:port-sorrel`)
| Step | Result |
|---|---|
| interview (`prefs-build-ingest.mjs --interview`) | 12 answers applied, 3 held (one instruction-shaped answer held back), profile written; `prefs_review`, `profile_summary` valid |
| intake (`--scope intake` + invented facts) | `trip_facts` with typed `found[]`, `reply` valid |
| research round 1 (start → candidates → record, two owner seeds) | pool 58 → kept 43; activities 8 (2/2 💎), food 6 (2/2 💎), every 💎 with a gem line, every item with `dims`; "Gems not chosen" 20; status `choosing`; `shortlist`, `places_digest`, `reply` valid |
| choices → plan (plan → invented notes → places → brochure → `--attach`) | status `delivered`; `plan_digest` with Drive ids, `places_digest`, `reply` valid; history `chosen` / `later` / `skipped` in `places/`; 21 choice-evidence records held by the prefs kit |
| review (invented ratings on the picks) | ratings recorded as history, calibration taps, evidence; `prefs_review`, `profile_summary`, `places_digest` valid |
| trip 2, same destination (`--rechecked` one slug) | known places first with `seen_before` (incl. `chosen`) and a `changes` line each; the closed place → "Closed since last visit", file kept with status `rejected` + `checked`; plan run emits a `places_digest`; `shortlist`, `plan_digest`, `places_digest`, `reply` valid |
| `places` request (`trip-check-run.mjs --kind places --scope list`) | 31 rows with history from both trips (`chosen …`, `checked 2027-08 (closed)`); `places_digest` valid |
| driving-loop (no transit data) | probe `has_transit: false`, fallback `{32 km/h, 18 min, source: researched}` written into the trip; both groups below their 💎 floor with the reason in the reply; plan built; `plan_digest`, `reply` valid |

## Requests and open items (for Phase 5 and later)
- **R1 · Lodging for a later trip.** No driver writes `trip.lodging`; the fixture seeds it for trip 1 and the journey sets it for trip 2 through `tools/tg-memory.mjs`. Phase 5: the core's confirmed intake facts (`lodging`, `booked` on a `research` request) or a `/lodging` command need a driver step that writes the lodging entry (name, nights, a resolved `place_id`).
- **R2 · Floor reason.** The pinned shortlist schema says "floor not met" as `gems_shown < gems_wanted` (group has no other field); the sentence is in the `reply`. If the core should show it, add `floor_reason` to the schema in Personal (`packs/tour-guide/schemas/tour-guide-shortlist.schema.json`) and re-pin.
- **R3 · `gem_line` carries rating digits** ("4.7 from 140 ratings where peers typically have 280") by the gems module's design — in the `shortlist` payload, its Drive copy and the reply only, never in `places/`, `trips/`, the dossier or a digest. Phase 6 (terms) confirms whether that is allowed to reach Telegram.
- **R4 · Core routing.** `places` → the trip-check routine (`ROUTINE_FIRE_URL_PLACES`); `prefs` with `review` (slugs from the trip's places, ratings `up | down | skipped`, calibration `longer | shorter | right`); `pf:<cid>:y|e|n` buttons on a `prefs_review` still need their flow (TG-PHASE-4B §8 item 1). A claude.ai routine is assumed able to carry both an API trigger and the weekly schedule; if not, add `routines/places.prompt.md` with the same text.
- **R5 · Live rounds.** `MAPS_USAGE_LEDGER` must be set; one research round makes about 37 Google calls on the fixture (≤ 6 Text Search, 12 Aggregate, 6 Nearby, snapshots, ≤ 4 TRANSIT routes). `--pool` is dry-run only. `sources/transit-fallback.json` holds only the invented row: a real destination without transit needs `--transit-fallback` from web research, then a row added in a development session. `sources/source-kinds.json` has generic rows for jp, fr, it, es, pt, de, mx, us, uk.
- **R6 · Places Aggregate** (`computeInsights`, the quiet stream): live-verified by the hidden-gems design thread on 2026-10-01 (not called from this phase — the phase forbids live Google calls); Phase 7 smoke stands.
- **R7 · Phase 4 branch merge.** The owner approved merging `claude/tg-phase-4-18ndyh` into `main`; this session's fast-forward push to `main` was refused by its own guard, so the owner merged it through a pull request (PR #1 in the private repo); this branch (which already contains that head) fast-forwards too.
- **R8 · Japan transit** is decided (layered transit leg with the Google-based station estimate, `planner-rail.mjs`, in this pin; Ekispert's paid timetable service as the named upgrade); Phase 8 asks the owner how the estimates feel.
- **R9 · `drive_file_ids` labels** are `plan, brochure_html, brochure_pdf, notes` (plan-days `--attach plan=,html=,pdf=,notes=`); the decisions §5 contract in Personal should read the same.

Developed by: LightAISolutions

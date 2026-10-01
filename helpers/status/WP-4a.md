# WP-4a — trip-research, plan-days: status

> Generic copy of the private repo's `repository-information/status/WP-4a.md` (TourGuide, branch `claude/tg-phase-4-18ndyh`); every trip, place and id named here is invented fixture data.

**State: done** (2026-10-01). Written by the phase coordinator directly on the session branch (no worktree, no builder agent — recorded per TG-PHASE-4 step 2). Defaults and reasons: `helpers/decisions/WP-4a.md`.

## Contract (TG-PHASE-4 row 4a + coordinator design points)
| Item | State |
|---|---|
| `skills/trip-research/SKILL.md` — frontmatter + six sections (+ Procedure); `research` request; research kit procedure with budgets 20/40/30; refs only, injection-flagged pages never cited | done |
| `skills/trip-research/trip-research-start.mjs` — opens or creates the trip, writes `brief.json` (profile excerpt → look_for / go_easy_on / must_avoid, existing places, how many to find); findings `trip_needed`, `trip_not_found`, `dates_needed`, `unknown_place` as `reply.json`, exit 1 | done |
| `skills/trip-research/trip-research-record.mjs` — `candidates.json` → verified places (Place Details pro tier), `VisitEstimate`s from `buildEstimate`, research-run entry, `quarantine/`, `dossier.md`, `reply.json` | done |
| `skills/plan-days/SKILL.md` — `plan` and `replan` requests; prior plan from Drive for `replan`; `--allow-over-budget` only from the owner's words | done |
| `skills/plan-days/plan-days-build.mjs` — `planTrip` / `replanDays` through the engine, enterprise-tier snapshots into the scratch store (purged in `finally`), `picks`, `promote` / `demote`, `builds[]` + Later lists + statuses written back, `plan-<build_id>.json` + `reply.json`; findings `lodging_missing`, `unknown_place`, `plan_missing`, `plan_mismatch`, `date_not_in_plan`, `budget` | done |
| `--show-google true\|false` records the owner's standing `show_google_content` in the trip's `profile_overrides` (WP-4b request 3) | done |
| `routines/{trip-research,plan-days}.prompt.md` — exact prompt shape, nothing else | done |
| `examples/` per skill — invented data, reserved domains, fixture trips only | done |
| `skills/README.md` request-kinds table: `picks` semantics, `replan` gains `promote` / `demote` / `reason`, `plan` gains `show_google_content` | done |
| Dry run of each skill on both fixtures, every envelope through `envelope.mjs --pack tour-guide` with no `errors` | done — below |

## Dry runs (scratch outside the repo; `S` = the WP scratch dir)
Seed: `node tools/seed-from-fixture.mjs transit-city|driving-loop $S/<tree>`.
- **plan-days**, `MAPS_SNAPSHOT_STORE=$S/snapshots.json node skills/plan-days/plan-days-build.mjs --repo $S/<tree> --trip <slug> --out $S/<out> --maps fixture:<fixture> --build-id … --now 2027-…`: transit-city → 3 days, 12 stops, 2 Later, 1 warning, 14 snapshots, usage 75 matrix elements + 15 route calls; driving-loop → 4 days, 13 stops, 2 Later, 2 warnings, 15 snapshots, 108 + 21 (4 Pro cross-checks). Both plans pass the pack's `plan` schema; the trip files gain a `builds[]` entry, statuses and Later lists; the store holds `content: null` for every record afterwards. `--kind replan --dates 2027-05-13 --plan <prior> --demote clock-tower-climb --reason "…"` → that day re-planned with 3 stops, 3 Later items (the demoted place under "Didn't fit" with the owner's reason). `--picks` of four slugs → 4 stops, every unpicked place back to `candidate`. `--show-google false` → `profile_overrides.show_google_content: false` in the trip file. A seeded trip with `lodging: []` → exit 1, `lodging_missing` reply; an unknown slug → exit 1 listing the known slugs. `envelope.mjs reply plan-days … --pack tour-guide --in-reply-to …` → no errors (both fixtures, plan and replan).
- **trip-research**, on an invented destination: `trip-research-start.mjs --repo $S/new --out $S/out-new --destination "Port Sorrel, Example" --start-date … --end-date … --tz Etc/GMT+2` → draft trip created (`lodging: []`, status `draft`), `brief.json` with the profile excerpt and `wanted: 15`; a second run `--scope more --like sorrel-lantern-museum` lists the existing places and `wanted: 6`; no dates → exit 1 `dates_needed`. A research-kit run recorded by hand (3 searches, 4 fetches, one planted "ignore previous instructions" page flagged `injection_suspect`, claims and durations with refs) then `trip-research-record.mjs --repo $S/new --trip port-sorrel-spring-2027 --run $S/run.json --out $S/out-new $S/candidates.json --maps fixture:transit-city` → 3 places verified and written with estimates (one marked non-operational from Google's business status), 1 candidate with an unknown place id dropped (HTTP_404 from the mock), the flagged page's mention and citation ignored, 1 quarantine file written, `dossier.md` rendered, research entry appended to the trip. `envelope.mjs reply trip-research …` → no errors. (Dossier facts show "stale" only because `--now` was 2027 while the pages were recorded in 2026.)

## Checks
- `node --test vendor/helpers/tests/` → 206 tests, 205 pass, 1 skipped, 0 fail (vendor untouched).
- `node vendor/helpers/tools/boundary-check.mjs` clean; `--root . skills/trip-research skills/plan-days routines tools` clean.
- grep for e-mail addresses, phone numbers and the owner's name over the new files → none.

## Requests to the coordinator
1. `routines/README.md` rows (owned by WP-4c): `| TRIP_RESEARCH | trip-research | fired by the core (research) | Google Drive | Fable 5.1 · high |`, `| PLAN_DAYS | plan-days | fired by the core (plan, replan) | Google Drive | Opus 5.5 · high |`. TRIP_RESEARCH needs web search/fetch and the Maps credentials; PLAN_DAYS needs the Maps credentials (`MAPS_USAGE_LEDGER`, `MAPS_SNAPSHOT_STORE`).
2. Phase 5: a `/plan` flow calls the two research steps and the plan driver in order (start → research → record → plan); the request kinds already carry what each step needs.
3. No framework patch requested; one template fix noted for Personal (`merge-routine-memory.sh` allow-list, done here in the shared-contract commit).

## Log
- 2026-10-01 — orientation (TG-PHASE-4, TG-PHASE-3 decisions, WP-3a/3b files, kit READMEs); shared contract and tools committed; plan-days driver and skill; trip-research drivers and skill; examples; dry runs on both fixtures; `--show-google` added for WP-4b; status and decisions written.
- 2026-10-01 — Phase 4 delta applied (decisions 21–26): trip statuses + `schemaTrip`, plan-days `--later` / `--skip`, `plan-days-run.mjs` (plan → notes → brochure, resumable, `--attach`), trip-research shortlist file, `--decided`, intake scope + `trip-research-intake.mjs`, chat-check fields, README contract, SKILL.md updates, new examples; seven-skill dry run and the new paths green on both fixtures.

Developed by: LightAISolutions

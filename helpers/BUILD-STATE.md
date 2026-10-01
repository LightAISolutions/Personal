# Build State — Tour Guide helper and the shared helper framework

> Maintained by each phase's session. A new session resumes from this file, the previous phase's `helpers/decisions/TG-PHASE-<n>.md`, `repository-information/SESSION-CONTEXT.md` and the git log.
> Plan: `repository-information/TOUR-GUIDE-BUILD-PLAN.md` (v01.07r, **amended v01.15r on 2026-10-01** for the owner's Telegram vision — plan §5.9 and §11b). This file records **generic progress only** — no trip, place, person, account or secret (this repo is public).

## Repos and environments
| Thing | State |
|---|---|
| `LightAISolutions/Personal` (public) | Framework home: everything under `helpers/`. Changes land through `claude/*` branches and `.github/workflows/auto-merge-claude.yml`; one push per interaction (Pre-Push Checklist) |
| `LightAISolutions/TourGuide` (private) | **Created by the owner and attached to the Tour Guide project 2026-09-30.** Verified private; the Phase 0 session pushed the §4.2 skeleton as the first commit on `main` (14 files, no personal data; `helpers/decisions/TG-PHASE-0.md` §3). **Phase 4 (2026-10-01)** replaced the stub with the rendered template, the first `vendor/helpers/` pin of `helpers-dist` and the seven routine skills, on branch `claude/tg-phase-4-18ndyh` (pushed; the owner merges into `main`) |
| `LightAISolutions/AssistantBrain` (private) | Reference only. Read for patterns and generic code; **never modified** by this build |
| Claude HQ environment (`Claude HQ - full network access`) | Build sessions and, by default, the routines. Maps API credential **added by the owner 2026-09-30** for hosts `places.googleapis.com` and `routes.googleapis.com` (custom header `X-Goog-Api-Key`, empty prefix). Applies to sessions started after it was added; first live call is Phase 2a |
| Google Cloud Maps project | **Created 2026-09-30**: Places API (New) + Routes API enabled, key restricted to both, budget alert. **Per-API daily caps deferred** — the account is on the Google Cloud free trial, which does not allow quota edits; set them at Phase 7 switch-on once the account is upgraded (the trial itself cannot bill beyond its credit) |
| Telegram bot token | **Created by the owner 2026-09-30** in BotFather; held by the owner until Phase 7 (never pasted into a session or a repo) |

## Phases
| Phase | What | Model · effort | Prompt | Status |
|---|---|---|---|---|
| 0 | Setup + decisions | Fable 5.1 · high | plan §12 | **done** 2026-09-30 — all thirteen decisions confirmed as defaults by the owner (`decisions/TG-PHASE-0.md`); private repo created, attached and seeded; Maps key credential added; bot token created and held by the owner |
| 1 | Helper framework foundation (`helpers/core`, `tools/`, `templates/private-repo/`, setup page, `SPEC.md`, `.claude/agents/hb-*.md`, `helpers-ci.yml`, `helpers-dist.yml`, `deploy-helper.yml`, routine-mode guard in `CLAUDE.md`) | Fable 5.1 · xhigh | `prompts/TG-PHASE-1.md` | **done** 2026-10-01 — scrub report approved by the owner; core, tools, template, hello pack, 54 tests, SPEC v1, agents, three workflows, guard; subtree decision measured (`decisions/TG-PHASE-1.md`). `helpers-dist` publishes on the merge of v01.12r — confirm the branch exists on GitHub at the start of Phase 2 |
| 2 | Shared kits: 2a Maps · 2b Research · 2c Brochure · 2d Prefs | coordinator Opus 5.5 · high; 2a Opus 5.5 · high; 2b, 2d Opus 5.5 · high (planned medium, see decisions); 2c Fable 5.1 · high | `prompts/TG-PHASE-2.md` | **done** 2026-10-01 — four kits in `helpers/kits/` (maps, research, brochure, prefs), 148 tests, live Maps smoke green, plan facts 2/7/10/12 corrected (`decisions/TG-PHASE-2.md`). Brochure rating by the owner pending at push; any changes land in a follow-up push |
| 3 | Tour Guide engine (`packs/tour-guide`: schemas, estimator, planner + solver, Later lists, fixtures) | solver Fable 5.1 · high; rest Opus 5.5 · high | `prompts/TG-PHASE-3.md` (written by Phase 2) | **done** 2026-10-01 — `helpers/packs/tour-guide/` (manifest, schemas, estimator, planner + solver, Later lists, brochure map, two invented fixture trips), 206 tests incl. the cross-WP integration test, both fixture brochures rendered as a preview (`decisions/TG-PHASE-3.md`) |
| 1b | Gap WP (core): flows primitive (`core/15_flows.js` — per-chat multi-step conversations, pause/resume, expiry, `/cancel`) + `tgSendDocument` | Fable 5.1 · high (the Phase 4b coordinator) | `prompts/TG-PHASE-4B.md` | not started — built in Phase 4b |
| 2f | Gap WP (prefs kit): extended travel vocabulary (climate tolerance and ten more dimensions), 25–40-question interview bank, `interview` command | Opus 5.5 · high | `prompts/TG-PHASE-4B.md` | not started — built in Phase 4b |
| 3d | Gap WP (engine): `planTrip` honours the owner's choices, trip and place statuses, payload schemas for the five pack envelope types, manifest | Opus 5.5 · high | `prompts/TG-PHASE-4B.md` | not started — built in Phase 4b |
| 4 | Brain side in the private repo (routine `CLAUDE.md`, skills, memory dirs, routine prompts, vendored helpers), **amended by `prompts/TG-PHASE-4-DELTA.md`** (`plan` fields `picks` · `later` · `skip` · `deliverables`, structured shortlist, `intake` scope, interview answers on `prefs`, trip statuses, hand-off to Phase 4b) | coordinator + `trip-research` + `plan-days` Fable 5.1 · high; rest Opus 5.5 · high | `prompts/TG-PHASE-4.md` (written by Phase 3) + `prompts/TG-PHASE-4-DELTA.md` (written by the v01.15r amendment) | **done** 2026-10-01 — private repo rendered from the template and pinned to `helpers-dist` (`vendor/helpers/`), seven skills with drivers, routine prompts and table, memory tools, the delta applied (owner choices on `plan`, chained deliverables, structured shortlist, `intake`, interview answers, trip statuses), seven-skill dry run on both fixtures, ledger merge driver mirrored into the template (`decisions/TG-PHASE-4.md`). TourGuide branch `claude/tg-phase-4-18ndyh` pushed, awaiting the owner's merge |
| 4b | Gap closure for the Telegram vision: WP-1b, 2f, 3d in `Personal`, then WP-4d in the private repo (skill deltas — `trip_facts`, `shortlist`, `plan_digest`, `profile_summary` as envelope types, notes + brochure chained after the plan, interview ingest through the kit's command — pin bump, scripted dry-runs of the `/plan` journey and the interview); finalizes `prompts/TG-PHASE-5.md` | coordinator + WP-1b Fable 5.1 · high; 2f, 3d, 4d Opus 5.5 · high | `prompts/TG-PHASE-4B.md` (written by the v01.15r amendment) | **next** — Phase 4 handed off 2026-10-01 |
| 5 | Chatbot feature pack (`packs/tour-guide/gas`): the `/interview` flow, the `/plan <destination>` journey (intake → confirm → shortlist → choices → plan + notes + brochure → PDF in the chat), instant commands over the plan digest, envelope handlers for the five pack types, Lane B behind `CHAT_API_ENABLED`, wake route and fallbacks | Opus 5.5 · high | `prompts/TG-PHASE-5.md` (written by the v01.15r amendment, finalized by Phase 4b) | not started |
| 6 | Integration, red-team (research, notes, chat, plus the interview's free-text answers and the shortlist), switch-on guide | Fable 5.1 · xhigh | written by Phase 5 | not started |
| 7 | Owner switch-on (interactive): deploy, pair, routines, the live interview, a real `/plan` | Opus 5.5 · high | written by Phase 6 | not started |
| 8 | Live review + tuning (planning, interview and shortlist quality, brochure, estimates, costs) | Opus 5.5 · high (brochure pass Fable 5.1 · high) | written by Phase 7 | not started |

Finish priority if usage runs short: 1 → 2a → 3 → 4 → 4b (1b + 3d first, 2f second) → 5 (`/plan` journey first, `/interview` second, Lane B last) → 6.

## Conventions every phase follows
- New session per phase, started from `helpers/prompts/TG-PHASE-<n>.md`, at the model and effort the table above names; the previous phase writes the next prompt.
- Each phase ends with `helpers/decisions/TG-PHASE-<n>.md`, this file updated, and a `remember session` run (`repository-information/SESSION-CONTEXT.md`).
- Parallel work packages (Phase 2 onward) use one worktree each (`git worktree add ../wt-<wp> -b wp-<wp>`), with `helpers/status/<wp>.md` and `helpers/decisions/<wp>.md` per package; the coordinator merges into the session's `claude/*` branch and pushes once.
- Nothing personal in this repo: fixtures use invented data; the Phase 1 boundary check enforces it in CI.

## Phase 0 log
- 2026-09-30 — session read the plan, confirmed no `TourGuide` repo exists and that the GitHub integration cannot create one (403), recorded all thirteen §10 decisions with their defaults, wrote `prompts/TG-PHASE-1.md`, prepared the private-repo skeleton, and asked the owner for the repo, the Maps key credential and the bot token.
- 2026-09-30 (later) — owner added the Maps key to Claude HQ as an API credential (both hosts, `X-Goog-Api-Key` header); console quota caps deferred because the free trial blocks quota edits.
- 2026-09-30 (later) — owner created `LightAISolutions/TourGuide` and attached it; session verified it is private and empty and pushed the skeleton to `main` (owner chose `main` over the session branch for the first commit of an empty repo).
- 2026-09-30 (close) — owner created the bot token (kept by the owner) and confirmed all thirteen defaults ("defaults"); Phase 0 closed.

## Phase 1 log
- 2026-10-01 — session read the plan and the first helper's generic files (read only), wrote the scrub report (15 rows, `decisions/TG-PHASE-1.md` §1) and posted it in the thread as the owner gate; built `helpers/core/` (15 files), `tools/` (bundle, envelope, new-helper, boundary-check), `templates/private-repo/` (15 files), the hello pack and 14 test suites (54 tests) while waiting; measured subtree vs clone-at-run (subtree stays, SPEC §15).
- 2026-10-01 — wrote `helpers/SPEC.md` (18 sections) and `helpers/README.md`, the four `.claude/agents/hb-*.md`, `helpers-ci.yml`, `helpers-dist.yml` (dist procedure tested in a scratch repo), `deploy-helper.yml`, the routine-mode guard at the top of `CLAUDE.md`; Step 4 checks green (tests, bundle `--check`, boundary check, secret/PII/provenance greps empty outside the owner's prompt file; AB and TourGuide received no commits).
- 2026-10-01 — owner approved the scrub report; Phase 1 pushed as v01.12r; `prompts/TG-PHASE-2.md` written.

## Phase 2 log
- 2026-10-01 — coordinator confirmed `helpers-dist` exists and the three checks were clean, opened four worktrees and briefed one agent per kit with a shared rules brief.
- 2026-10-01 — 2a Maps merged: masks per tier, SKU ledger with a hard stop, build-scoped snapshots, Maps URLs, proxy-tunnel transport; one live smoke run (Text Search, Place Details, Compute Routes all 200). Findings corrected plan facts 2, 7, 10 and 12 and the SPEC §16 CLI form.
- 2026-10-01 — 2d Prefs and 2b Research merged (both on Opus 5.5 · high; the medium agent could not load mid-session). 2c Brochure merged: self-contained HTML, in-browser paginator, 12-page PDF sample of an invented trip, Charter fonts with notice.
- 2026-10-01 — sample brochure posted to the owner for the "hand it to a friend" rating; per the owner's standing instruction the phase pushed without waiting (v01.13r). `prompts/TG-PHASE-3.md` written.

## Phase 3 log
- 2026-10-01 — coordinator confirmed the three checks were clean, wrote the data contract v1 and the WP briefs, landed the pack skeleton (`helper.json`, `gas/`), opened three worktrees and briefed 3a and 3c (`hb-builder-opus`); built 3b (planner + solver) itself: Held-Karp time-window solver, day assignment, real legs, cross-check, meals, warnings, Maps links, budget, Later merge.
- 2026-10-01 — 3b merged (mini-world tests), 3c merged (plan → brochure model, HTML/PDF), 3a merged (ten schemas with semantic checks, estimator + calibration, Later lists, two fixture trips with recorded Maps answers); `tools_bundle.test.js` relaxed for a second pack.
- 2026-10-01 — integration test across all three WPs on both fixtures found a booking dropped under the wait cap (fixed: booked stops may wait any length); pack README assembled; both fixture brochures rendered for the owner; `prompts/TG-PHASE-4.md` written; pushed as v01.14r.

## Plan amendment log (v01.15r)
- 2026-10-01 — the owner described the end product: an interview-first Telegram bot whose `/plan <destination>` runs connectors → web research → a shortlist to choose from → day plans, notes and a brochure delivered to the chat. A plan-amendment session (Fable 5.1 · xhigh) added plan §5.9, §11b and decisions 14–17, gap WPs 1b / 2f / 3d on built phases, a new Phase 4b, rewrote Phases 5–8, and wrote `prompts/TG-PHASE-4-DELTA.md` (for the running Phase 4), `prompts/TG-PHASE-4B.md` and `prompts/TG-PHASE-5.md` (finalized by Phase 4b). Nothing built was changed; the Phase 2 thread's brochure Maps-image work continues separately.

## Phase 4 log
- 2026-10-01 — coordinator rendered the private-repo template from the pack manifest over the Phase 0 stub, pinned `helpers-dist` as a git subtree under `vendor/helpers/`, committed the shared skill contract (request kinds, memory layout, drivers) and `tools/tg-memory.mjs`; opened two worktrees and briefed WP-4b and WP-4c (`hb-builder-opus`); built WP-4a (`trip-research`, `plan-days`) itself. The session was paused by a usage limit and resumed at the same model and effort.
- 2026-10-01 — WP-4b and WP-4c merged and their requests applied (ledger merge driver, `locations` baseline for the weekly check, `promote` / `demote` hand-offs, `--show-google`); `prompts/TG-PHASE-4-DELTA.md` applied (trip statuses, `later` / `skip` / `deliverables`, `plan-days-run.mjs` chaining, structured shortlist, `intake`, `prefs-build --interview`); seven-skill dry run green on both fixtures; TourGuide branch pushed; the template fixes and this bookkeeping pushed here as v01.16r.

## Next
Phase 4 is done; its hand-off is **Phase 4b**. Start Phase 4b in a **new session** on **Fable 5.1 · high**: "Read helpers/prompts/TG-PHASE-4B.md and execute it exactly." It builds WP-1b, 2f and 3d here, then WP-4d in the private repo (pin bump and skill deltas), and finalizes `prompts/TG-PHASE-5.md`; Phase 5 then runs on **Opus 5.5 · high**. Carry `decisions/TG-PHASE-4.md` §8 ("For Phase 4b") and the requests in `decisions/TG-PHASE-3.md` §4 and `decisions/TG-PHASE-2.md` §4. Open with the owner: merging the TourGuide branch `claude/tg-phase-4-18ndyh`, and `show_google_content` (default yes stands).

Developed by: LightAISolutions

# Build State — Tour Guide helper and the shared helper framework

> Maintained by each phase's session. A new session resumes from this file, the previous phase's `helpers/decisions/TG-PHASE-<n>.md`, `repository-information/SESSION-CONTEXT.md` and the git log.
> Plan: `repository-information/TOUR-GUIDE-BUILD-PLAN.md` (v01.07r). This file records **generic progress only** — no trip, place, person, account or secret (this repo is public).

## Repos and environments
| Thing | State |
|---|---|
| `LightAISolutions/Personal` (public) | Framework home: everything under `helpers/`. Changes land through `claude/*` branches and `.github/workflows/auto-merge-claude.yml`; one push per interaction (Pre-Push Checklist) |
| `LightAISolutions/TourGuide` (private) | **Created by the owner and attached to the Tour Guide project 2026-09-30.** Verified private; the Phase 0 session pushed the §4.2 skeleton as the first commit on `main` (14 files, no personal data; `helpers/decisions/TG-PHASE-0.md` §3). Phase 1's template replaces the stub files |
| `LightAISolutions/AssistantBrain` (private) | Reference only. Read for patterns and generic code; **never modified** by this build |
| Claude HQ environment (`Claude HQ - full network access`) | Build sessions and, by default, the routines. Maps API credential **added by the owner 2026-09-30** for hosts `places.googleapis.com` and `routes.googleapis.com` (custom header `X-Goog-Api-Key`, empty prefix). Applies to sessions started after it was added; first live call is Phase 2a |
| Google Cloud Maps project | **Created 2026-09-30**: Places API (New) + Routes API enabled, key restricted to both, budget alert. **Per-API daily caps deferred** — the account is on the Google Cloud free trial, which does not allow quota edits; set them at Phase 7 switch-on once the account is upgraded (the trial itself cannot bill beyond its credit) |
| Telegram bot token | **Owner to create** in BotFather; held by the owner until Phase 7 |

## Phases
| Phase | What | Model · effort | Prompt | Status |
|---|---|---|---|---|
| 0 | Setup + decisions | Fable 5.1 · high | plan §12 | **in progress** 2026-09-30 — decisions recorded with defaults (`decisions/TG-PHASE-0.md`); private repo created, attached and seeded; Maps key credential added; owner actions still open: bot token, objections to the defaults |
| 1 | Helper framework foundation (`helpers/core`, `tools/`, `templates/private-repo/`, setup page, `SPEC.md`, `.claude/agents/hb-*.md`, `helpers-ci.yml`, `helpers-dist.yml`, `deploy-helper.yml`, routine-mode guard in `CLAUDE.md`) | Fable 5.1 · xhigh | `prompts/TG-PHASE-1.md` | not started |
| 2 | Shared kits: 2a Maps · 2b Research · 2c Brochure · 2d Prefs | coordinator Opus 5.5 · high; 2a Opus 5.5 · high; 2b Opus 5.5 · medium; 2c Fable 5.1 · high; 2d Opus 5.5 · medium | `prompts/TG-PHASE-2.md` (written by Phase 1) | not started |
| 3 | Tour Guide engine (`packs/tour-guide`: schemas, estimator, planner + solver, Later lists, fixtures) | solver Fable 5.1 · high; rest Opus 5.5 · high | written by Phase 2 | not started |
| 4 | Brain side in the private repo (routine `CLAUDE.md`, skills, memory dirs, routine prompts, vendored helpers) | `trip-research` + `plan-days` Fable 5.1 · high; rest Opus 5.5 · high | written by Phase 3 | not started |
| 5 | Chatbot feature pack (`packs/tour-guide/gas`) | Opus 5.5 · high | written by Phase 4 | not started |
| 6 | Integration, red-team, switch-on guide | Fable 5.1 · xhigh | written by Phase 5 | not started |
| 7 | Owner switch-on (interactive) | Opus 5.5 · high | written by Phase 6 | not started |
| 8 | Live review + tuning | Opus 5.5 · high (brochure pass Fable 5.1 · high) | written by Phase 7 | not started |

Finish priority if usage runs short: 1 → 2a → 3 → 4 (`plan-days`, `trip-research`) → 2c + `brochure-build` → 5 → 2d + `prefs-build` → 6.

## Conventions every phase follows
- New session per phase, started from `helpers/prompts/TG-PHASE-<n>.md`, at the model and effort the table above names; the previous phase writes the next prompt.
- Each phase ends with `helpers/decisions/TG-PHASE-<n>.md`, this file updated, and a `remember session` run (`repository-information/SESSION-CONTEXT.md`).
- Parallel work packages (Phase 2 onward) use one worktree each (`git worktree add ../wt-<wp> -b wp-<wp>`), with `helpers/status/<wp>.md` and `helpers/decisions/<wp>.md` per package; the coordinator merges into the session's `claude/*` branch and pushes once.
- Nothing personal in this repo: fixtures use invented data; the Phase 1 boundary check enforces it in CI.

## Phase 0 log
- 2026-09-30 — session read the plan, confirmed no `TourGuide` repo exists and that the GitHub integration cannot create one (403), recorded all thirteen §10 decisions with their defaults, wrote `prompts/TG-PHASE-1.md`, prepared the private-repo skeleton, and asked the owner for the repo, the Maps key credential and the bot token.
- 2026-09-30 (later) — owner added the Maps key to Claude HQ as an API credential (both hosts, `X-Goog-Api-Key` header); console quota caps deferred because the free trial blocks quota edits.
- 2026-09-30 (later) — owner created `LightAISolutions/TourGuide` and attached it; session verified it is private and empty and pushed the skeleton to `main` (owner chose `main` over the session branch for the first commit of an empty repo).

## Next
Owner: create the bot token (keep it), and object to any of the thirteen defaults or say "defaults". Then this Phase 0 thread marks Phase 0 done and closes. Phase 1 starts in a **new session** on **Fable 5.1 · xhigh**: "Read helpers/prompts/TG-PHASE-1.md and execute it exactly."

Developed by: LightAISolutions

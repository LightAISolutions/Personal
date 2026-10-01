# Build State — Tour Guide helper and the shared helper framework

> Maintained by each phase's session. A new session resumes from this file, the previous phase's `helpers/decisions/TG-PHASE-<n>.md`, `repository-information/SESSION-CONTEXT.md` and the git log.
> Plan: `repository-information/TOUR-GUIDE-BUILD-PLAN.md` (v01.07r). This file records **generic progress only** — no trip, place, person, account or secret (this repo is public).

## Repos and environments
| Thing | State |
|---|---|
| `LightAISolutions/Personal` (public) | Framework home: everything under `helpers/`. Changes land through `claude/*` branches and `.github/workflows/auto-merge-claude.yml`; one push per interaction (Pre-Push Checklist) |
| `LightAISolutions/TourGuide` (private) | **Created by the owner and attached to the Tour Guide project 2026-09-30.** Verified private; the Phase 0 session pushed the §4.2 skeleton as the first commit on `main` (14 files, no personal data; `helpers/decisions/TG-PHASE-0.md` §3). Untouched in Phase 1; the template in `helpers/templates/private-repo/` replaces the stub files in **Phase 4**, together with the first `vendor/helpers/` pin of `helpers-dist` |
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
| 3 | Tour Guide engine (`packs/tour-guide`: schemas, estimator, planner + solver, Later lists, fixtures) | solver Fable 5.1 · high; rest Opus 5.5 · high | `prompts/TG-PHASE-3.md` (written by Phase 2) | not started |
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

## Next
Phase 2 is done (brochure rating pending; if the owner asks for changes, iterate the brochure kit in a follow-up push before Phase 3c). Start Phase 3 in a **new session** on **Fable 5.1 · high**: "Read helpers/prompts/TG-PHASE-3.md and execute it exactly." The coordinator builds the solver itself and fans out 3a and 3c to `hb-builder-opus` in worktrees. Carry the requests in `decisions/TG-PHASE-2.md` §4.

Developed by: LightAISolutions

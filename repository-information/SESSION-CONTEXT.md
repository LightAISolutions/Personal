# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

**Date:** 2026-10-01 02:50:57 AM EST
**Repo version:** v01.15r
**Branch:** `claude/tg-plan-telegram-vision-610o9x` (Tour Guide project, thread "Amend plan for Telegram vision", Fable 5.1 · xhigh)

**What we worked on**
- Amended `repository-information/TOUR-GUIDE-BUILD-PLAN.md` for the owner's Telegram vision: an interview-first preference profile, `/plan <destination>` as a five-step Telegram flow (intake facts, shortlist of activities and food, picks, then plan + notes + brochure PDF in chat), new §5.9 owner's journey, §6 gap work packages for the built phases (1b core flows + document delivery, 2f prefs interview, 3d engine choices + five envelope types), new Phase 4b, Phases 5–8 rewritten, §9 risks, §10 decisions 14–17, §11b summary, §12 kickoff
- Updated `helpers/BUILD-STATE.md` (gap rows, Phase 4 in progress, Phase 4b, amendment log, Next)
- Wrote `helpers/prompts/TG-PHASE-4-DELTA.md` (for the running Phase 4 session), `helpers/prompts/TG-PHASE-4B.md` and `helpers/prompts/TG-PHASE-5.md` (with a FINALIZE block Phase 4b fills in)

**Where we left off**
- Amendment pushed as v01.15r. Phase 4 is running in its own thread on the TourGuide branch `claude/tg-phase-4-18ndyh`; the coordinator relays the delta file to it. `helpers/prompts/TG-PHASE-4.md` was deliberately left untouched

**Key decisions made**
- Phase 4 keeps `plan.picks` (already committed in the TourGuide `skills/README.md`) and adds `later`, `skip` and `deliverables`; `shortlist` and `trip_facts` go out as prose replies until Phase 4b registers the envelope types
- Decisions 14–17 taken at their defaults (the owner can override in thread)
- §11b added instead of renumbering §12, because `helpers/BUILD-STATE.md` row 0 cites "plan §12"

**Active context**
- Phase 2 thread owns the Maps Static brochure change; AssistantBrain reference only; the TourGuide private repo was not touched by this session

**Recommendation for next session**
- When Phase 4 hands off, start Phase 4b in a new session on Fable 5.1 · high

**To continue:** type `Read helpers/prompts/TG-PHASE-4B.md and execute it exactly.`

## Previous Sessions

**Date:** 2026-10-01 01:56:30 AM EST
**Repo version:** v01.14r
**Branch:** `claude/tg-phase-3-2udjs1` (Tour Guide project, thread "Tour Guide Phase 3", coordinator Fable 5.1 · high)

**What we worked on**
- Tour Guide Phase 3 per `helpers/prompts/TG-PHASE-3.md`: the `helpers/packs/tour-guide/` engine. WP-3a (schemas, estimator, Later lists, fixtures) and WP-3c (brochure map) built by `hb-builder-opus` agents in worktrees; WP-3b (planner + Held-Karp solver) built by the coordinator; all merged, 206 tests, bundle check and boundary check clean, no live calls
- Cross-WP integration test on both fixtures; pack README; both fixture brochures rendered to the project's shared folder as a preview
- Wrote `helpers/decisions/TG-PHASE-3.md`, updated `helpers/BUILD-STATE.md`, wrote `helpers/prompts/TG-PHASE-4.md`

**Where we left off**
- Phase 3 pushed as v01.14r. Nothing is owed by the owner for Phase 3; the owner's Phase 2 brochure rating and the Google-content question (hours/ratings in a delivered brochure) stay open and are carried into Phase 4's owner-input step

**Key decisions made**
- Booked stops are exempt from the solver's wait cap (the plan may go there first and wait for the booking)
- Fixture travel times are the single source of truth: every leg the planner emits must match the fixture's answer within a minute
- `REPO-ARCHITECTURE.md` unchanged (its `helpers/` node already lists `packs/`)
- Phase 4 request kinds `research, plan, replan, notes, brochure, prefs` + free-text `chat`; `show_google_content` defaults to true until the owner answers

**Active context**
- `helpers-dist` carries the pack after this merge; the TourGuide private repo is still at its Phase 0 skeleton and receives the template + first `vendor/helpers/` pin in Phase 4; AssistantBrain reference only
- Worktrees `wt-3a/b/c` are local only (branches `wp-3a/b/c`, never pushed)

**Recommendation for next session**
- Start Phase 4 in a new session on Fable 5.1 · high

**To continue:** type `Read helpers/prompts/TG-PHASE-4.md and execute it exactly.`


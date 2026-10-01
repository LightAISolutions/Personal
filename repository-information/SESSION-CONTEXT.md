# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

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

## Previous Sessions

**Date:** 2026-10-01 01:12:03 AM EST
**Repo version:** v01.13r
**Branch:** `claude/tg-phase-2-svjmub` (Tour Guide project, thread "Tour Guide Phase 2", coordinator Opus 5.5 · high)

**What we worked on**
- Tour Guide Phase 2 per `helpers/prompts/TG-PHASE-2.md`: four shared kits built in worktrees by agents and merged: `helpers/kits/maps` (2a), `research` (2b), `brochure` (2c), `prefs` (2d); 148 tests, bundle check and boundary check clean
- One live Maps smoke run (Text Search, Place Details, Compute Routes all 200); findings corrected plan facts 2, 7, 10, 12 and SPEC §16
- Wrote `helpers/decisions/TG-PHASE-2.md`, updated `helpers/BUILD-STATE.md`, wrote `helpers/prompts/TG-PHASE-3.md`

**Where we left off**
- Phase 2 pushed as v01.13r. The sample brochure (invented trip, 12 pages) was posted to the owner for the "would hand it to a friend" rating; the rating was pending at push time. If changes are asked for, iterate the brochure kit in a follow-up push and update decisions §3

**Key decisions made**
- Owner's standing instruction: never park on a question; do every task that does not need the owner first
- 2b and 2d ran on Opus 5.5 · high (the medium agent could not load mid-session); Charter fonts embedded; Google content other than place ids and coordinates is build-scoped
- Open owner question: may a delivered brochure show Google hours and ratings (decisions §4)

**Active context**
- `helpers-dist` exists; next phase builds `helpers/packs/tour-guide/`; TourGuide private repo untouched since Phase 0; AssistantBrain reference only

**Recommendation for next session**
- Start Phase 3 in a new session on Fable 5.1 · high (after any brochure changes the owner asks for)

**To continue:** type `Read helpers/prompts/TG-PHASE-3.md and execute it exactly.`

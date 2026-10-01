# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

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

## Previous Sessions

**Date:** 2026-09-30 11:33:51 PM EST
**Repo version:** v01.12r
**Branch:** `claude/project-thread-c84ih5` (Tour Guide project thread, Claude HQ environment, Fable 5.1 · xhigh)

**What we worked on:**

- **Phase 1 of the Tour Guide build is complete** (`helpers/prompts/TG-PHASE-1.md`): the public helper framework under `helpers/` — Apps Script core (15 files, manifest-driven), tools (`bundle.mjs`, `envelope.mjs`, `new-helper.mjs`, `boundary-check.mjs`), the private-repo template, the hello pack, 14 test suites (54 tests), `SPEC.md` v1 (18 sections), `README.md`
- Build process files: `.claude/agents/hb-architect.md` / `hb-builder-fable.md` / `hb-builder-opus.md` / `hb-reader.md`, `.github/workflows/helpers-ci.yml` / `helpers-dist.yml` / `deploy-helper.yml`, the routine-mode guard at the top of `CLAUDE.md`, `helpers/dist/` ignored
- Scrub report (15 rows) posted as the owner gate and approved before the copied core landed in a commit; subtree vs clone-at-run measured, subtree stays (SPEC §15, decisions §2)
- `helpers/decisions/TG-PHASE-1.md`, `helpers/BUILD-STATE.md` (Phase 1 done) and `helpers/prompts/TG-PHASE-2.md` written

**Where we left off:**

- Everything pushed as v01.12r; the merge to `main` runs `helpers-ci` and publishes the `helpers-dist` branch for the first time — Phase 2's first check is that the branch exists on GitHub
- Phase 2 (four shared kits + coordinator) runs in a **new session** on Opus 5.5 · high

**Key decisions made:**

- `hb-builder-opus` runs at effort high (the Agent tool cannot override effort per call); the Phase 2 coordinator may add an `hb-builder-opus-medium.md` for 2b/2d
- `helpers-dist` carries only `core/ tools/ kits/ packs/ templates/ tests/ SPEC.md README.md`; `BUILD-STATE.md`, `decisions/`, `prompts/`, `status/`, `dist/` stay out
- Deploy secrets `CLASPRC_JSON`, `<HELPER>_SCRIPT_ID`, `<HELPER>_DEPLOYMENT_ID` are named, not created; the `production` environment is created by the owner at Phase 7 with a `main`-only branch rule
- The private-repo template reaches `TourGuide` in Phase 4 together with the first `vendor/helpers/` pin; neither `TourGuide` nor `AssistantBrain` received a commit in Phase 1
- Recommended `property_prefix: ""` for the Tour Guide pack so Script Property names read exactly as plan §7
- `REPO-ARCHITECTURE.md` has no `<details>` copy blocks under any diagram (the CLAUDE.md rule describes them); left as found, flagged

**Active context:**

- `Personal`: repo v01.12r · all pages v01.00w · AutoUpdate.ahk v01.01a · `helpers/` = framework v1 (`CORE_VERSION` 1.0.0, hello pack 0.1.0)
- `TourGuide` (private): skeleton only, `main` at the Phase 0 seed commit
- `AssistantBrain`: reference only, not modified
- Toggles: START_OF_RESPONSE_BLOCK `On` · CHAT_BOOKENDS `Off` · TIMING_ESTIMATES `On` · END_OF_RESPONSE_BLOCK `On`

**Recommendation for next session:**

- Start **Phase 2** in a new Tour Guide session on **Opus 5.5 · effort high** from `helpers/prompts/TG-PHASE-2.md` (first check: the `helpers-dist` branch exists on GitHub after the v01.12r merge).

**To continue:** type `Read helpers/prompts/TG-PHASE-2.md and execute it exactly.`

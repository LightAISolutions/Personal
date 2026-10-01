# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

**Date:** 2026-09-30 09:10:27 PM EST
**Repo version:** v01.10r
**Branch:** `claude/project-thread-20mnqb` (Tour Guide project thread, Claude HQ environment, Fable 5.1 · High)

**What we worked on:**

- Phase 0 of the Tour Guide build (plan §12 kickoff): all thirteen §10 decisions recorded with their defaults in `helpers/decisions/TG-PHASE-0.md`, owner to object in the thread
- `helpers/BUILD-STATE.md` (phase tracker) and `helpers/prompts/TG-PHASE-1.md` (Phase 1 kickoff on Fable 5.1 · Xhigh) written
- `LightAISolutions/TourGuide` created by the owner (the GitHub connector cannot create repos, 403), attached, verified private, and seeded with the §4.2 skeleton on `main` (14 files, no personal data)

**Where we left off:**

- Maps key added to Claude HQ as an API credential (both hosts, `X-Goog-Api-Key`); console quota caps deferred to Phase 7 (free trial blocks quota edits)
- Waiting on the owner for: a new BotFather token (owner keeps it) and any objection to the thirteen defaults (or "defaults")
- When those are in, the Phase 0 thread marks Phase 0 done in `helpers/BUILD-STATE.md`
- Do not start Phase 1 in this thread

**Key decisions made:**

- Private repo is owner-created (connector cannot create repos); session verifies it is private before pushing
- Decisions were presented in one message rather than one at a time (thread round trips are slow); defaults assumed until the owner objects
- `REPO-ARCHITECTURE.md` gets its `helpers/` node in Phase 1, not Phase 0 (one mermaid regeneration)
- Phase 1 runs as a single architect session on this repo's branch and push conventions; worktrees start in Phase 2

**Active context:**

- `Personal`: repo v01.08r · all pages v01.00w · AutoUpdate.ahk v01.01a · `helpers/` holds only build-process files
- `AssistantBrain`: reference only, not modified
- Toggles: START_OF_RESPONSE_BLOCK `On` · CHAT_BOOKENDS `Off` · TIMING_ESTIMATES `On` · END_OF_RESPONSE_BLOCK `On`

**Recommendation for next session:**

- Once the owner has created the private repo, added the Maps credential and the bot token, start **Phase 1** in a new Tour Guide session on **Fable 5.1 · effort Xhigh** from `helpers/prompts/TG-PHASE-1.md`.

**To continue:** type `Read helpers/prompts/TG-PHASE-1.md and execute it exactly.`

## Previous Sessions

**Date:** 2026-09-30 07:55:53 PM EST
**Repo version:** v01.07r
**Branch:** `claude/project-thread-zn7wsu` (Tour Guide project thread, Claude HQ environment)

**What we worked on:**

- The owner objected that the Tour Guide plan was being written on Opus 5.5 · Medium; planning moved to a Fable 5.1 · Xhigh thread
- The stopped Opus thread had already merged its draft as v01.06r. **v01.07r replaces it** at the same path (`repository-information/TOUR-GUIDE-BUILD-PLAN.md`), authored by a Fable 5.1 · Xhigh worker after this session fell back to Opus 5.5 · Xhigh
- All web facts re-checked on official pages (Maps pricing and SKUs, Routes transit and matrix limits, caching terms, Apps Script quotas, routines, cloud environments, Grounding Lite MCP); Chromium for PDFs checked on the machine

**Where we left off:**

- Plan pushed; nothing built. Next is Phase 0 with the owner (13 decisions, private repo, Google Cloud key, bot token)

**Key decisions made:**

- Important phases run on Fable 5.1 (Xhigh for foundation and integration; High for Phase 0, the solver, brochure design and the two core skills); bulk building on Opus 5.5 · High/Medium
- Chatbot has three lanes (instant Apps Script, optional Claude API fast lane off by default, deep routine via request envelopes + wake route); no permanent Apps Script tick
- Routines attach only the private `TourGuide` repo with `helpers/` vendored from a `helpers-dist` branch; this repo gets a routine-mode guard in `CLAUDE.md`
- Personal travel data never enters this public repo (three-home split + CI boundary check)

**Active context:**

- `Personal`: repo v01.07r · all pages v01.00w · AutoUpdate.ahk v01.01a
- `AssistantBrain`: reference only, not modified
- Toggles: START_OF_RESPONSE_BLOCK `On` · CHAT_BOOKENDS `Off` · TIMING_ESTIMATES `On` · END_OF_RESPONSE_BLOCK `On`

**Recommendation for next session:**

- Run **Phase 0** from `TOUR-GUIDE-BUILD-PLAN.md` §12 in a new Tour Guide session on Claude HQ with **Fable 5.1 · effort High**, with a private repo (or permission to create one), a restricted Maps key and a new bot token ready.

**To continue:** type `Read repository-information/TOUR-GUIDE-BUILD-PLAN.md and run Phase 0 with me.`

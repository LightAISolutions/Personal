# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

**Date:** 2026-09-30 10:05:26 PM EST
**Repo version:** v01.11r
**Branch:** `claude/project-thread-20mnqb` (Tour Guide project thread, Claude HQ environment, Fable 5.1 · High)

**What we worked on:**

- **Phase 0 of the Tour Guide build is complete** (plan §12 kickoff). All thirteen §10 decisions confirmed as defaults by the owner (`helpers/decisions/TG-PHASE-0.md`)
- Owner actions all done: private `LightAISolutions/TourGuide` created, attached and seeded with the §4.2 skeleton on `main`; Google Cloud Maps project (Places API (New) + Routes API, key restricted, budget alert; daily caps deferred to Phase 7 because the free trial blocks quota edits); Maps key added to Claude HQ as an API credential for both hosts with the `X-Goog-Api-Key` header; BotFather token created and kept by the owner
- `helpers/BUILD-STATE.md` (phase tracker) and `helpers/prompts/TG-PHASE-1.md` (Phase 1 kickoff) written

**Where we left off:**

- Phase 0 closed; nothing built yet. Phase 1 has not started
- The Phase 0 thread is resolved; Phase 1 runs in a **new session**

**Key decisions made:**

- Private repo is owner-created (the GitHub connector cannot create repos, 403)
- Decisions were presented in one message rather than one at a time; the owner confirmed with "defaults"
- `REPO-ARCHITECTURE.md` gets its `helpers/` node in Phase 1, not Phase 0
- Phase 1 runs as a single architect session on this repo's branch and push conventions; worktrees start in Phase 2
- Per-API daily caps in Google Cloud wait for Phase 7 (account upgrade from the free trial)

**Active context:**

- `Personal`: repo v01.11r · all pages v01.00w · AutoUpdate.ahk v01.01a · `helpers/` holds only build-process files
- `TourGuide` (private): skeleton only, `main` at the Phase 0 seed commit
- `AssistantBrain`: reference only, not modified
- Toggles: START_OF_RESPONSE_BLOCK `On` · CHAT_BOOKENDS `Off` · TIMING_ESTIMATES `On` · END_OF_RESPONSE_BLOCK `On`

**Recommendation for next session:**

- Start **Phase 1** in a new Tour Guide session on **Fable 5.1 · effort Xhigh** from `helpers/prompts/TG-PHASE-1.md` (the scrub-report owner gate comes before any Assistant Brain code is copied into this public repo).

**To continue:** type `Read helpers/prompts/TG-PHASE-1.md and execute it exactly.`

## Previous Sessions

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


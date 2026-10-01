# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

**Date:** 2026-10-01 03:32:47 AM EST
**Repo version:** v01.16r
**Branch:** `claude/tg-interaction-design-awq6bh` (Tour Guide project, thread "Ways to interact with Tour Guide", Fable 5.1 · high)

**What we worked on**
- Evaluated seven ways to interact with Tour Guide (chat commands, a standalone web app, a Telegram Mini App, Drive, the Sheet, inline mode, an Artifact) and recommended: Telegram stays the front door; the places repository and the learning loop land in Phase 4b and Phase 5; the Tour Guide app (Telegram Mini App) becomes Phase 9 after the pilot
- Amended `repository-information/TOUR-GUIDE-BUILD-PLAN.md` (new §5.10 places repository + learning loop, new §5.11 interaction options and the app, §4 architecture and data model, §5.9 `/places` and `/review`, §6 rows and Phase 9, §8–§10, new §11c, §12), `helpers/BUILD-STATE.md`, `helpers/prompts/TG-PHASE-4B.md`, `helpers/prompts/TG-PHASE-5.md`; wrote `helpers/prompts/TG-PHASE-9.md` (draft, finalized by Phase 8)

**Where we left off**
- Amendment pushed as v01.16r. Phase 4 is still running in its own thread; `TG-PHASE-4.md` and `TG-PHASE-4-DELTA.md` were left untouched and no new delta was needed (the repository fields land in Phase 4b because `tg-memory.mjs` is the sole reader/writer of `places/`)
- Decision 19 (when to build the app: after Phase 8 by default, or right after Phase 6) was put to the owner as a card in the thread; the plan records the default

**Key decisions made**
- Decisions 18–21 at their defaults: 18 the app, yes — a generic data-free shell on this repo's Pages plus `?route=app` with signed launch data; 19 after the pilot; 20 the repository is Phase 4's `places/<slug>.md` with a per-trip history, re-check before re-research (`RECHECK_DAYS` 90), own claims only and no Google field stored (place names flagged as an open point for Phase 6's terms review); 21 the learning loop from shortlist and post-trip taps, negatives held until support 2
- The shell is a standalone top-level page `live-site-pages/helper-app.html` (not a subdirectory) so the `<basename>html.version.txt` convention holds
- No `registerRoute` exists yet; Phase 9 adds it as the fifteenth registry with the four built-in routes not overridable

**Active context**
- Phase 2 thread owns the Maps Static brochure change; AssistantBrain reference only; the TourGuide private repo was not touched by this session

**Recommendation for next session**
- When Phase 4 hands off, start Phase 4b in a new session on Fable 5.1 · high (its prompt now carries the places-repository fields and the sixth envelope type)

**To continue:** type `Read helpers/prompts/TG-PHASE-4B.md and execute it exactly.`

## Previous Sessions

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

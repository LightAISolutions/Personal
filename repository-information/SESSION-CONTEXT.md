# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

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

## Previous Sessions

### 2026-09-30 07:30:47 PM EST

**Date:** 2026-09-30 07:30:47 PM EST
**Repo version:** v01.06r
**Branch:** `claude/project-thread-7dwkct` (Tour Guide project thread, Claude HQ environment)

**What we worked on:**

- New claude.ai project **"Tour Guide"** set up (repos `Personal` + `AssistantBrain`, environment Claude HQ). Project instructions: build reusable helper infrastructure in `Personal`; AssistantBrain is reference only; reuse its Apps Script / Telegram / Routines patterns; research autonomously; record model + effort per phase and keep CHANGELOG, version and session context current
- **v01.06r — `repository-information/TOUR-GUIDE-BUILD-PLAN.md`**: phased plan (Phases 0–8) for the Tour Guide helper and a shared `helpers/` framework, with verified Maps/Places/Routes/Apps Script/Routines facts, model and effort per phase, environment and key needs, costs, risks and eight owner decisions

**Where we left off:**

- Plan pushed; nothing built. Waiting for the owner to review the plan and answer the §10 decisions in Phase 0

**Key decisions made:**

- The travel planning helper is now called **Tour Guide** and lives in `Personal` (framework + generic code) with a private `LightAISolutions/TourGuide` repo for persona, skills, memory and trip data (supersedes the 2026-09-29 note about starting it in `AssistantBrain`)
- Visit durations come from research + calibration (no official Google API); route ordering uses our own solver because Google does not optimize transit waypoints
- Tour Guide chatbot: separate Telegram bot, no permanent tick (shares the 90 min/day trigger budget with the Chief of Staff)

**Active context:**

- `Personal`: repo v01.06r · all pages v01.00w · AutoUpdate.ahk v01.01a
- `AssistantBrain`: live, Phase 4 customization in progress (see its `BUILD-STATE.md`); not modified by the Tour Guide work
- Toggles: START_OF_RESPONSE_BLOCK `On` · CHAT_BOOKENDS `Off` · TIMING_ESTIMATES `On` · END_OF_RESPONSE_BLOCK `On`

**Recommendation for next session:**

- Run **Phase 0** of `TOUR-GUIDE-BUILD-PLAN.md` in a new Tour Guide project session (Claude HQ, **Opus 5.5 · Medium**) with the private `TourGuide` repo created, a Google Cloud key for Places API (New) + Routes API, and a new BotFather token ready.

**To continue:** type `Read repository-information/TOUR-GUIDE-BUILD-PLAN.md and run Phase 0 with me.`

Developed by: LightAISolutions

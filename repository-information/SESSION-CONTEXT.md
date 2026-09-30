# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

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

## Previous Sessions

### 2026-09-29 07:35:54 AM EST

**Date:** 2026-09-29 07:35:54 AM EST
**Repo version:** v01.05r
**Branch:** `claude/charming-cori-pjkafh`

**What we worked on (since the 2026-09-25 save):**

- **Chief-of-Staff build finished and switched on.** This session completed Phase 0 in the private `LightAISolutions/AssistantBrain` repo (foundation spec + Apps Script core, gold email eval set, 2026 backfill) and pushed it; Phases 1–2 ran in separate `AssistantBrain` sessions (Phase 1 merged four feature packages at 154/154 tests). The owner has since switched the assistant on and is waiting for its first scheduled run before doing the customization run
- **v01.05r — ranked "Potential Future Projects"** added to `repository-information/FUTURE-CONSIDERATIONS.md`: (1) personal knowledge wiki, (2) career system (job scanning + tailored résumés), (3) a Claude survey of Simon Willison's single-page tools for inspiration, (4) Windows power-user kit, (5) health coach from wearable data once a wearable is in use — each with a trigger condition
- **Next project chosen: a personal Travel Guide**, ahead of the knowledge wiki. The owner will write the implementation requirements in a new planning session and approve a detailed action plan before any building

**Where we left off:**

- Waiting on the Chief of Staff's first run → then the owner's customization run (profile, tax questionnaire, tuning) in an `AssistantBrain` session
- Travel Guide: nothing built yet; the next step is a **plan-only** session (see recommendation)

**Key decisions made:**

- Travel Guide planning session: **Fable 5.1 · effort Xhigh**, started in **plan mode** so nothing is built before approval; build sessions afterwards can drop to Opus 5.5 · High for bulk implementation (the approach used for the Chief-of-Staff build)
- Start it on the private `AssistantBrain` repo so the plan can reuse the assistant's architecture, data and delivery channel (the plan itself decides whether the guide lives there or in its own private repo) — personal travel data must never go in this public repo
- Future projects are tracked in `FUTURE-CONSIDERATIONS.md` (ranked), not TODO.md

**Active context:**

- `Personal`: repo v01.05r · all pages v01.00w · AutoUpdate.ahk v01.01a
- `AssistantBrain` (private) holds the assistant's code, memory, data and its own `BUILD-STATE.md`; nothing personal is stored in `Personal`
- Toggles: START_OF_RESPONSE_BLOCK `On` · CHAT_BOOKENDS `Off` · TIMING_ESTIMATES `On` · END_OF_RESPONSE_BLOCK `On`

**Recommendation for next session:**

- Start a new Claude Code session on the **`LightAISolutions/AssistantBrain`** repo with **Fable 5.1 · effort Xhigh** in **plan mode**, paste your Travel Guide requirements, and ask for a detailed action plan (architecture, phases, model/effort per phase, what you must do) to approve before anything is built.

**To continue:** type `Plan only, don't build yet: here is how I want my Travel Guide to work — …` (then your details)

Developed by: LightAISolutions

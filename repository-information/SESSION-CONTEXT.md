# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

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

## Previous Sessions

### 2026-09-25 09:26:20 PM EST

**Date:** 2026-09-25 09:26:20 PM EST
**Repo version:** v01.04r
**Branch:** `claude/charming-cori-pjkafh`

**What we worked on:**

- **v01.03r — Personal assistant AI research.** Six parallel research passes produced `repository-information/PERSONAL-ASSISTANT-RESEARCH.md` (Sept 2026 landscape, Claude subscription rules, building blocks, security, use-case scoring, stack limits) and `PERSONAL-ASSISTANT-ROADMAP.md` (hybrid architecture, phased roadmap, token-dump playbook). Key finding: **this `Personal` repo is public**, so nothing personal may ever be committed here
- **v01.04r — two stale references fixed:** `autoHotkey/AutoUpdate.ahk` `GITHUB_REPO` now points at `Personal` instead of the template repo (root cause: `scripts/init-repo.sh` `REPLACE_FILES` omits that file); `FUTURE-CONSIDERATIONS.md` quota lines corrected (20k/day is UrlFetch; triggers get 90 min/day)
- **Chief-of-Staff prototype build started** in a separate **private** repo, `LightAISolutions/AssistantBrain` (owner-created 09:15 PM; the GitHub integration may not create repos). Build runs in phases; Phase 0 (foundation spec + Apps Script core, gold email eval set, 2026 backfill) runs in this session. Backfill finished and pushed; foundation and eval set were still running when this was saved

**Where we left off:**

- **This session finishes Phase 0 by itself** (background workers + one-shot check-ins), pushes it to `AssistantBrain` `main`, then stands down. Keep it open (don't archive) until `AssistantBrain/BUILD-STATE.md` shows Phase 0 done
- **Phase 1 runs in a new session started on the `AssistantBrain` repo** (not this one): model Opus 5.5, effort High, prompt `Read prompts/PHASE-1.md and execute it exactly.` It waits for Phase 0 automatically, then builds four feature packages in parallel (ledger + briefs, money & tax, capture + desktop, meeting dossiers). Phase 1 writes the Phase 2 prompt (triage + integration + switch-on guide; Fable 5.1 · Xhigh)
- The authoritative tracker is `AssistantBrain/BUILD-STATE.md` (private) — this file only points to it

**Key decisions made:**

- All assistant code, memory and data live in the private `AssistantBrain` repo; `Personal` holds only generic research/plans
- Architecture: Claude Code Routines as the brain + a separate Apps Script project as the always-on layer + Telegram for delivery/approvals + a Google Drive "mailbox" folder as the only bridge; drafts-only; two-lane (reader/actor) security enforced in code
- Build sessions run with container-local deny rules (no Gmail/Calendar/Drive writes, no web/network egress); worker model + effort come from `.claude/agents/` definitions committed in `AssistantBrain`
- GitHub repo names can't contain spaces → named `AssistantBrain`
- A recurring hourly heartbeat trigger was refused by the auto-mode safety check; the build uses one-shot `send_later` check-ins instead

**Active context:**

- `Personal`: repo v01.04r · all pages v01.00w · AutoUpdate.ahk v01.01a (any copy already installed on the owner's PC still points at the template and needs one manual replacement)
- Owner's weekly usage reset ≈ 07:00 AM EST 2026-09-26; after it: ~45-min switch-on via `AssistantBrain/docs/SWITCH-ON.md` (written in Phase 2), then a customization run
- Toggles: START_OF_RESPONSE_BLOCK `On` · CHAT_BOOKENDS `Off` · TIMING_ESTIMATES `On` · END_OF_RESPONSE_BLOCK `On`

**Recommendation for next session:**

- Start a new Claude Code session on the **`LightAISolutions/AssistantBrain`** repo with **Opus 5.5 · effort High** and paste the Phase 1 prompt; it waits for Phase 0 to land, then builds the four feature packages in parallel and hands off Phase 2 on its own.

**To continue:** type `Read prompts/PHASE-1.md and execute it exactly.`

Developed by: LightAISolutions

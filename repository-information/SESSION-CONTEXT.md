# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.


## Latest Session

**Date:** 2026-10-02 08:03:06 PM EST
**Repo version:** v01.45r
**Branch:** `claude/project-thread-rarais` (Tour Guide project, thread started by "i want to do as much as I can do now", Opus 5.5 · high)

**What we worked on**
- Phase 8 part 1: every Phase 8 item that needs no trip evidence (decisions in `helpers/decisions/TG-PHASE-8.md`)
- Round-prefixed typed picks, `/repick` with numbers, the app Shortlist with every round, `/dates` and `trip_update`
- Other travellers: people list, who comes, in-app interviews on the owner's phone, the party excerpt
- The profile excerpt moved into the pack (`packs/tour-guide/travellers/`) with `dietary` required; booking and activity visit lengths; `upload.mjs --key-from`; the `/smart on` wording; core route `lock` and formula escaping; masthead name

**Where we left off**
- Personal v01.45r pushed; the private repo re-pin and skill changes go on its `claude/project-thread-rarais` branch as a PR for the owner to merge
- Two decision cards open with the owner: Japan train estimates (Keep · Tune · Pay) and how companions count (default: their limits, your lead)

**Key decisions made**
- Stored Google hours in the quick lane declined (Maps terms forbid storing hours)
- The module is named `travellers/` because the boundary check treats `profile*` names as personal data
- Companion interviews run on the owner's phone (the app opens only for the owner)

**Active context**
- Trip is mid-November; Phase 8 part 2 (tuning) waits for the owner's account of it
- `/smart` off by default; routines on Opus 5.5

**Recommendation for next session**
- After the trip, run Phase 8 part 2 from `helpers/status/PHASE-8-RESUME.md`, starting with the owner's account of the trip and the two decision cards' answers.

**To continue:** type `Read helpers/prompts/TG-PHASE-8.md and execute it exactly.`

## Previous Sessions

**Date:** 2026-10-02 07:29:11 PM EST
**Repo version:** v01.44r
**Branch:** `claude/project-thread-yjuszy` (Tour Guide project, thread "Tour Guide Phase 7 switch-on", Opus 5.5 · high)

**What we worked on**
- Phase 7, the owner switch-on: core deployed and paired, seven routines, the live interview, the pilot `/plan` (v01.29r–v01.41r; findings F1–F23)
- v01.42r wrap-up: switch-on guide corrected against every step, routine-model and `/smart` choices recorded, `helpers/prompts/TG-PHASE-8.md` written
- v01.43r: the `/smart` trial showed quick answers reading trip dates a day early; the core now keeps the state Sheet on the owner's time zone (F24); hours questions fall to the routine as designed (F25)
- v01.44r: the owner kept `/smart` off by default and accepted the rebuilt pilot day; Phase 7 marked done

**Where we left off**
- Phase 7 is done; Personal BUILD-STATE shows Phases 0–7 and 9 done. The owner takes the pilot trip next
- Phase 8 (live review + tuning) starts after the trip in a new session on Opus 5.5 · high

**Key decisions made**
- Routines run on Opus 5.5 set in the routine editor (chat medium, the rest high), the owner's step
- `/smart` stays off by default; on only when the owner sends `/smart on`
- Owner trip data stays out of the public repo (redacted in CHANGELOG and decisions)

**Active context**
- TourGuide PRs #5–#13 merged by the owner; the stale `claude/tg-phase-4-707ano` branch on TourGuide is still safe to delete
- Phase 8 inputs: `helpers/decisions/TG-PHASE-7.md` (F1–F25, §2 choices), `helpers/decisions/TG-PHASE-9.md` §7, `helpers/prompts/TG-PHASE-8.md` (incl. the Japan train-estimate question and a one-time check that a date-based answer names the right day)

**Recommendation for next session**
- After the trip, start Phase 8 on Opus 5.5 · high and begin with the owner's trip feedback and the Japan train-estimate question

**To continue:** type `Read helpers/prompts/TG-PHASE-8.md and execute it exactly.`

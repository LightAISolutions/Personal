# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

**Date:** 2026-10-01 03:16:38 AM EST
**Repo version:** v01.16r
**Branch:** `claude/tg-phase-4-18ndyh` (Tour Guide project, thread "Tour Guide Phase 4 (resumed)", coordinator Fable 5.1 · high)

**What we worked on**
- Tour Guide Phase 4 per `helpers/prompts/TG-PHASE-4.md` + `TG-PHASE-4-DELTA.md`, built in the private repo `LightAISolutions/TourGuide` on its branch `claude/tg-phase-4-18ndyh`: template rendered from the pack manifest, `vendor/helpers/` pinned to `helpers-dist`, seven routine skills with drivers (trip-research, plan-days, place-notes, brochure-build, prefs-build, chat, trip-check), memory tools, routine prompts and table; WP-4b and WP-4c by `hb-builder-opus` agents in worktrees, WP-4a by the coordinator
- The delta: trip statuses, `plan` `later` / `skip` / `deliverables` with `plan-days-run.mjs` chaining plan → notes → brochure, structured shortlist, `intake` scope, `prefs-build --interview`
- In this repo: `helpers/decisions/TG-PHASE-4.md`, `helpers/status/WP-4a..c.md`, `helpers/decisions/WP-4a..c.md`, the ledger merge driver mirrored into `helpers/templates/private-repo/` (`scripts/merge-maps-ledger.mjs`, `.gitattributes`, workflow config, allow-list), `helpers/BUILD-STATE.md`

**Where we left off**
- Phase 4 done and pushed as v01.16r; the TourGuide branch is pushed and waits for the owner's merge. The owner was told to start Phase 4b in a new session on Fable 5.1 · high. The Google-content question (`show_google_content`, default yes) is still open with the owner

**Key decisions made**
- Trip statuses live in `tools/tg-memory.mjs` with `schemaTrip()` mapping onto the closed schema enum until Phase 4b widens it; `owner_choice` rides in the Later reason text
- Chaining is a separate resumable run driver; Drive ids are attached after the fact (`--attach`)
- Enterprise tier for every brain-side snapshot (Essentials has no hours); the ledger merge driver replaces "conflicts are rare"
- Models: Opus 5.5 · high default, chat medium, trip-research Fable for a trip that matters; WP-4b's Sonnet suggestion recorded for the owner

**Active context**
- `helpers/packs/tour-guide/` untouched this phase; AssistantBrain reference only; worktrees `tg-wt-4b` / `tg-wt-4c` local to the private clone (branches `wp-4b` / `wp-4c`, never pushed); Phase 2 thread owns the Maps Static brochure change

**Recommendation for next session**
- Start Phase 4b in a new session on Fable 5.1 · high; it builds WP-1b, 2f, 3d here, then WP-4d in the private repo, and finalizes `helpers/prompts/TG-PHASE-5.md` (see `helpers/decisions/TG-PHASE-4.md` §8)

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

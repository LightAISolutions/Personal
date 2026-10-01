# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.


## Latest Session

**Date:** 2026-10-01 10:03:09 AM EST
**Repo version:** v01.28r
**Branch:** `claude/project-thread-orkxn4` (Tour Guide project, thread "Tour Guide", Fable 5.1 · xhigh — Phase 6 architect)

**What we worked on**
- Phase 6 of the Tour Guide build: carried items (core `tgSplit`/`tgClip`, Maps scope, web-verified Lane B prices and trigger quotas, `MAX_ROUTINE_FIRES_PER_DAY` 24), three builders in worktrees — WP-6a pack gas red-team + PDF delivery, WP-6b kits/engines red-team (R3: words-only `gem_line`), WP-6c integration dry run + skills red-team in TourGuide — all merged; 97 new tests (374 → 471), bundle and boundary clean
- `helpers/decisions/TG-PHASE-6.md` (briefs, findings and fixes §2.1–§2.3, cost and quota audit §3 with sources, carried decisions §4, accepted risk §5), `helpers/docs/TG-SWITCH-ON.md` (the owner's switch-on guide), `helpers/prompts/TG-PHASE-7.md`
- WP-6c's framework requests: `tools/envelope.mjs` reply checks + `--now`, `/replan` `deliverables`, the `tg_brochure_reply` observer with core `mailboxReadRequest(id)` (SPEC §5)

**Where we left off**
- Phase 6 is done (v01.28r). TourGuide PR #4 (`claude/project-thread-orkxn4`, head `ff7811c`) is ready for review: vendor re-pin to the Phase 5 dist, `tools/integration-dryrun.mjs` (392 checks / 0 failed), skill fixes, `trip-research-lodging.mjs`. PR #3 must merge first (PR #4 was cut from its head)
- The private repo still pins the Phase 5 `helpers-dist`; Phase 7 Step 0 re-pins it to the v01.28r dist before any routine is created

**Key decisions made**
- Located lodging = option (a) in trip-research; destination clip (120) stands; the review closes the trip on any recorded rating; WP-6c's optional R2 (pack digest cap in the stamp tool) not taken; C6 skill-only request kinds documented, not removed
- Google content: `gem_line` carries no Google digits (Maps ToS); brochure hours/ratings stay an open owner question for Phase 8 (`show_google_content`)

**Active context**
- Branch `claude/project-thread-orkxn4` pushed as the single Phase 6 push (auto-merges to `main`); worktrees `../wt-6a`, `../wt-6b` were session-local and are merged
- Open owner questions for Phase 7/8 are listed in `helpers/prompts/TG-PHASE-7.md` and `helpers/decisions/TG-PHASE-6.md` §5

**Recommendation for next session**
- Start Phase 7 on Opus 5.5 · high: merge TourGuide PR #3 then PR #4, re-pin `vendor/helpers/` to the v01.28r `helpers-dist`, then switch the helper on with the owner following `helpers/docs/TG-SWITCH-ON.md`

**To continue:** type `Read helpers/prompts/TG-PHASE-7.md and execute it exactly.`

## Previous Sessions

**Date:** 2026-10-01 08:10:13 AM EST
**Repo version:** v01.27r
**Branch:** `claude/project-thread-m0kbpq` (Tour Guide project, thread "Phase 5 Telegram commands", Opus 5.5 · high)

**What we worked on**
- Phase 5: the Tour Guide Telegram chatbot pack `helpers/packs/tour-guide/gas/` — contract (`helpers/decisions/TG-PHASE-5.md` §1), WP-5a commands and flows, WP-5b envelope handlers and sheets, WP-5c Lane B / `/route` / measurement / mock end-to-end, an audit pass, core hooks `core_start` + `core_status`, `*_API_KEY` redaction, bundler-generated interview bank. 373 tests pass, 1 skipped; bundle and boundary clean.
- Private repo: `prefs-build-ingest.mjs --decisions` (review taps → kit `apply`) on TourGuide branch `claude/project-thread-m0kbpq`, PR #3, rebased on main after the owner merged Phase 4b (PR #2).

**Where we left off**
- Phase 5 done and pushed as v01.27r; `helpers/prompts/TG-PHASE-6.md` written; BUILD-STATE Next = Phase 6.
- Paused once for the owner's usage cue (10:00–11:10 UTC); `helpers/status/PHASE-5-RESUME.md` records it.

**Key decisions made**
- Lane B (owner, 10:07 UTC): both lanes, free routines by default, `/smart on|off` toggles Claude API answers (needs `CLAUDE_API_KEY`), `/status` shows the mode.
- Review decisions travel as a `prefs` request with `payload.decisions`; capture handlers are named `tg_capture_*`; review ratings use the core `fl` buttons.

**Active context**
- TourGuide PR #3 awaits the owner's merge. Recommend `MAX_ROUTINE_FIRES_PER_DAY` 20–24 (Phase 6 decides). Lane B prices in `30_chat_api.js` are unverified (Phase 6 checks).

**Recommendation for next session**
- Start Phase 6 in a new session on Fable 5.1 · xhigh.
**To continue:** type `Read helpers/prompts/TG-PHASE-6.md and execute it exactly.`

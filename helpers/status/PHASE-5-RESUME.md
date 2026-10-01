# Phase 5 — resume note

> For a session that picks Phase 5 up after a pause (usage limit, new session). Prompt: `helpers/prompts/TG-PHASE-5.md` (Opus 5.5 · high). Keep this file accurate after every finished step.

| Step | State |
|---|---|
| 0 Orient (three checks clean: 302 pass / 1 skip, bundle ok, boundary clean) | done 2026-10-01 |
| 2 Owner input (Lane B on or off) | asked in the thread as a decision card; building with the default **off** |
| Contract | `gas/00_common.js` + `helpers/decisions/TG-PHASE-5.md` §1 written |
| 1 WP-5a / 5b / 5c in worktrees `../wt-5a`, `../wt-5b`, `../wt-5c` | in progress — worktrees are local to the session container; if they are gone, re-run the WPs from §1 of the decisions file |
| Merges, checks, bookkeeping, push | not started |
| 5 Hand-off (TG-PHASE-6.md, BUILD-STATE, remember session) | not started |

Developed by: LightAISolutions

## Paused 2026-10-01 10:00 UTC (usage cue, 98% of the 5-hour limit; resets 10:30 UTC)
- Personal: contract commits are **local only** on `claude/project-thread-m0kbpq` (not pushed: a Personal push auto-merges into main, and Phase 5 owns a single bookkept push). WPs 5a/5b/5c were told to commit in `../wt-5{a,b,c}`, update `helpers/status/WP-5{a,b,c}.md` and stop.
- TourGuide: branch `claude/project-thread-m0kbpq` pushed with `prefs-build-ingest.mjs --decisions` (contract §1.8), **untested**.
- Next on resume: (1) resume the three WP agents; (2) TourGuide: test `--decisions` against an invented fixture, document it in `skills/prefs-build/SKILL.md` and `skills/README.md`, push; (3) merge WPs, checks, bookkeeping, hand-off as in the step table above.
- WP-5c stopped before any code (status committed on `wp-5c`). Its two requests to act on at resume: (a) core `redactSecrets()` should also redact properties ending in `_API_KEY` (`helpers/core/01_util.js`, coordinator-owned); (b) tell 5a/5b that free-text capture handlers must be named to sort before `tg_lane_b` (e.g. `tg_capture_*`) — add to contract §1.6.
- **Lane B answered by the owner (10:07 UTC):** build both, free lane (routines) is the default; add an owner toggle in Telegram (`/smart on|off`, stored in Settings, shown in `/status`) that switches Lane B on. It works only when `CLAUDE_API_KEY` is set in Script Properties; without it `/smart on` explains what to set. Tell WP-5c at resume; record in TG-PHASE-5.md.

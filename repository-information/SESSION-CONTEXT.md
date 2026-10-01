# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.


## Latest Session

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

## Previous Sessions

**Date:** 2026-10-01 05:45:21 AM EST
**Repo version:** v01.26r
**Branch:** `claude/tg-phase-4b-s94tru` (Tour Guide project, thread "Tour Guide Phase 4b", Fable 5.1 · high)

**What we worked on**
- Phase 4b end to end: the `Personal` side (WP-1b flows + documents, WP-2f interview, WP-3d choices/statuses/payload schemas, WP-2g Gem Funnel kits + engine, WP-3e transit fallback) merged and pushed as v01.25r, then WP-4d in the private repo on its own `claude/tg-phase-4b-s94tru` branch: pin bump, the skill deltas by three builders in worktrees, one shared places digest, `tools/journey-dryrun.mjs` (the whole `/plan` journey on invented fixtures, every envelope validated), vendor tests and scans green
- Close-out here as v01.26r: BUILD-STATE rows 4 / 4b / 8 and Next, `decisions/TG-PHASE-4B.md` §1 / §5 / §6 / §8, `prompts/TG-PHASE-5.md` open items and `drive_file_ids` labels, the plan's status line, generic copies `status/WP-4d.md` + `decisions/WP-4d.md`

**Where we left off**
- Phase 4b is done. Phase 5 (Opus 5.5 · high) starts from `helpers/prompts/TG-PHASE-5.md` in a new session; nothing in it waits on the owner except merging the TourGuide branch `claude/tg-phase-4b-s94tru` (the Phase 4 branch is merged, PR #1)
- Coordinator relays recorded during the phase: Places Aggregate live-verified by the design thread (Phase 7 smoke); decision 19 confirmed (Mini App after the pilot); Japan transit decided (Google-based station estimate, Ekispert as the upgrade, Phase 8 asks the owner); this session's own push to the private repo's `main` was refused by its guard, the owner merged through a pull request instead

**Key decisions made**
- Only our own dated research claims and the owner's choices are stored; Google's hours, rating, review count, website, address and business status stay build-scoped; place names stored as today (Phase 6's open point)
- One `places_digest` builder for every routine; known places lead a `new` research round with `seen_before` / `changes`; the post-trip review runs before the next trip to the same destination (history is oldest-first by schema)
- Requests carried back here: R2 `floor_reason` on the shortlist group schema (optional), R3 `gem_line` rating digits for Phase 6's terms review

**Active context**
- `main` moved three times during the phase (v01.23r / v01.24r rail estimates, the Aggregate credential, `[skip ci]` bookkeeping); rebased before each push. Never push while another `claude/*` branch is on the remote or a branch whose head equals `origin/main`
- Private repo: `vendor/helpers/` changes only through the pin bump; dry runs on fixtures only (`--maps fixture:<name>`, `--pool fixture:<name>`); no live Google, Telegram, Drive or wake-route call in this phase

**Recommendation for next session**
- Start Phase 5 in a new session on Opus 5.5 · high and paste `Read helpers/prompts/TG-PHASE-5.md and execute it exactly.`; it reads the skills from the TourGuide branch `claude/tg-phase-4b-s94tru` until the owner merges it

**To continue:** type `Read helpers/prompts/TG-PHASE-5.md and execute it exactly.`


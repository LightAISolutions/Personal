# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.


## Latest Session

**Date:** 2026-10-01 10:41:22 PM EST
**Repo version:** v01.39r
**Branch:** `claude/project-thread-rf0581` (Tour Guide project, thread "Tour Guide Phase 9 — Mini App", Fable 5.1 · high)

**What we worked on**
- Phase 9, the Telegram Mini App: WP-9a core contract (`registerRoute`, `CORE_ROUTES`, `tgVerifyInitData`, `tgSetMenuButton`), WP-9b pack `32_app_api.js` (`?route=app`, 16 ops, setup step `app_menu_button`), WP-9c shell `live-site-pages/helper-app.html` with a no-network Playwright check; security review, single push v01.37r auto-merged, Pages and "Deploy helper" green
- Step 4 live check with the owner: menu button set, Home/Shortlist/Interview/Brochure/Places open from the app; "Done choosing" and Facts returned `no_flow` because the shell showed a closed round as open (trip status stays `choosing` while the plan flow is at `planning`)
- v01.39r fix: `home.choice_round.stage` and `shortlist.get.stage` from the trip's plan flow; the shell shows closed rounds read-only, maps refusals to plain words, quiet Facts/Brochure empty states; shell v01.01w; Playwright `state-round-closed` check
- Step 5 bookkeeping: `helpers/decisions/TG-PHASE-9.md` §6 live findings + §7 next-phase items, `helpers/BUILD-STATE.md` Phase 9 row done + Phase 9 log + Next, `helpers/docs/TG-SWITCH-ON.md` §3 "Open from the app", `helpers/decisions/TG-PHASE-7.md` §1 row F18

**Where we left off**
- Phase 9 is done (v01.39r pushed; auto-merge → Pages → Deploy helper). The owner retests the app after the deploy (Home shows the round as closed with the stage, Facts "Nothing to confirm", Shortlist "Round N is closed")
- Phase 7 (switch-on) continues in its own thread and has one Personal bookkeeping push pending; it rebases on v01.39r and keeps the Phase 9 rows in BUILD-STATE and TG-PHASE-7 §1

**Key decisions made**
- The shell never guesses flow state: the pack reports `stage` and the shell renders closed rounds and `no_flow` as quiet states with a "Back home" button; the adopt path (`stage: ''`) still accepts a round with no flow
- Owner request (live check): future interviews for other travellers should run in the app, not in Telegram — needs a profile slot in the pack, scoped in Phase 8 (`TG-PHASE-9.md` §7)
- Owner trip data seen in screenshots stays out of the public repo (redacted in CHANGELOG and decisions)

**Active context**
- Branch `claude/project-thread-rf0581` is the single Phase 9 push (auto-merges to `main`); `APP_SHELL_URL` is the Pages URL of `helper-app.html`; the owner's web-app URL is session-only and never written anywhere
- Open items for Phase 8 are in `helpers/decisions/TG-PHASE-9.md` §7 and `helpers/prompts/TG-PHASE-8.md` (written by the Phase 7 thread)

**Recommendation for next session**
- After Phase 7 finishes, start Phase 8 on Opus 5.5 · high and take the Phase 9 items in `helpers/decisions/TG-PHASE-9.md` §7 (in-app interviews for other travellers, masthead name, carried `lock: true` and formula escaping) into its scope

**To continue:** type `Read helpers/prompts/TG-PHASE-8.md and execute it exactly.`

## Previous Sessions

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

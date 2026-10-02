# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.


## Latest Session

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

## Previous Sessions

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

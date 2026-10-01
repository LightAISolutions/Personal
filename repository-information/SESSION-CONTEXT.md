# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.


## Latest Session

**Date:** 2026-10-01 03:53:32 AM EST
**Repo version:** v01.22r
**Branch:** `claude/tg-hidden-gems-dn7epo` (Tour Guide project, thread "Hidden gems methodology", Fable 5.1 · high)

**What we worked on**
- Evaluated the owner's hidden-gems idea (sweep every business on Google Maps and score each) against seven other methods and wrote `helpers/decisions/hidden-gems-proposal.md`: keep the scoring half, replace the enumeration with the Gem Funnel (taste queries in two languages, local-voices research, Aggregate-API neighbourhood probes, free screening, gem score, evidence pass, 💎 marks on the shortlist); ≈ $4 per round at list, $0 inside the free caps
- Recorded the owner's answers to decisions 22–26 (renumbered after the plan's 18–21) and walked him through enabling the Places Aggregate API, the key's API restrictions and the Claude HQ credential form; verified the API with one live call

**Where we left off**
- Everything delivered and pushed (v01.18r proposal, v01.20r answers, v01.22r verified enablement). The plan and the phase prompts are untouched; the coordinator routes §6 into a new WP-2g inside Phase 4b, where stream 3 can now run live
- Owner's remaining action, not blocking: rotate the Static Maps key whose value appeared in a screenshot, and update the `MAPS_STATIC_KEY` environment variable

**Key decisions made**
- Evaluate at the search layer (Text / Nearby Search Enterprise return 20 places with rating, count, hours and website per call) and pay for Place Details only on finalists
- A place is a 💎 only with corroboration outside Google; nothing from Google persists beyond place ids; no polygon tests on Google coordinates
- Decisions 22, 24, 25, 26 confirmed at their defaults; 23 (Aggregate API) chosen as "enable now" and done the same day

**Active context**
- Credentials cannot be edited in the environment dialog, only deleted or added, so the Aggregate host is a third entry next to the Places/Routes one; package numbering: WP-2e brochure maps, WP-2f prefs gap, WP-2g gems
- `main` moved repeatedly during this session (Phase 4, interaction design, brochure maps, the v01.21r collision repair); rebased before every push

**Recommendation for next session**
- When Phase 4b builds WP-2g, read `helpers/decisions/hidden-gems-proposal.md` §4 and §6 and build stream 3 against the live Aggregate API from the start

**To continue:** type `Read helpers/decisions/hidden-gems-proposal.md §6 and fold WP-2g into Phase 4b.`

## Previous Sessions

**Date:** 2026-10-01 03:44:29 AM EST
**Repo version:** v01.21r
**Branch:** `claude/tg-interaction-design-awq6bh` (Tour Guide project, thread "Ways to interact with Tour Guide", Fable 5.1 · high)

**What we worked on**
- Evaluated seven ways to interact with Tour Guide (chat commands, a standalone web app, a Telegram Mini App, Drive, the Sheet, inline mode, an Artifact) and recommended: Telegram stays the front door; the places repository and the learning loop land in Phase 4b and Phase 5; the Tour Guide app (Telegram Mini App) becomes Phase 9 after the pilot
- Amended `repository-information/TOUR-GUIDE-BUILD-PLAN.md` (new §5.10 places repository + learning loop, new §5.11 interaction options and the app, §4 architecture and data model, §5.9 `/places` and `/review`, §6 rows and Phase 9, §8–§10, new §11c, §12), `helpers/BUILD-STATE.md`, `helpers/prompts/TG-PHASE-4B.md`, `helpers/prompts/TG-PHASE-5.md`; wrote `helpers/prompts/TG-PHASE-9.md` (draft, finalized by Phase 8)

**Where we left off**
- Pushed twice: v01.16r (the amendment) and v01.21r (repair — three branches landed within minutes and the auto-merge's "theirs" strategy dropped changelog and build-state entries, now restored; `helpers/prompts/TG-PHASE-4B-DELTA.md` written for the Phase 4b thread, which started before the amendment merged). The hidden-gems thread renumbered its decisions to 22–26, so 18–21 stay ours
- Phase 4 finished while this session ran; Phase 4b is running in its own thread. `TG-PHASE-4.md` and `TG-PHASE-4-DELTA.md` were left untouched and no new delta was needed (the repository fields land in Phase 4b because `tg-memory.mjs` is the sole reader/writer of `places/`)
- Decision 19 (when to build the app: after Phase 8 by default, or right after Phase 6) was put to the owner as a card in the thread; the plan records the default

**Key decisions made**
- Decisions 18–21 at their defaults: 18 the app, yes — a generic data-free shell on this repo's Pages plus `?route=app` with signed launch data; 19 after the pilot; 20 the repository is Phase 4's `places/<slug>.md` with a per-trip history, re-check before re-research (`RECHECK_DAYS` 90), own claims only and no Google field stored (place names flagged as an open point for Phase 6's terms review); 21 the learning loop from shortlist and post-trip taps, negatives held until support 2
- The shell is a standalone top-level page `live-site-pages/helper-app.html` (not a subdirectory) so the `<basename>html.version.txt` convention holds
- No `registerRoute` exists yet; Phase 9 adds it as the fifteenth registry with the four built-in routes not overridable

**Active context**
- Phase 2 thread owns the Maps Static brochure change; AssistantBrain reference only; the TourGuide private repo was not touched by this session

**Recommendation for next session**
- When Phase 4 hands off, start Phase 4b in a new session on Fable 5.1 · high (its prompt now carries the places-repository fields and the sixth envelope type)

**To continue:** type `Read helpers/prompts/TG-PHASE-4B.md and execute it exactly.`

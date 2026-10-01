# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.


## Latest Session

**Date:** 2026-10-01 03:38:59 AM EST
**Repo version:** v01.20r
**Branch:** `claude/tg-hidden-gems-dn7epo` (Tour Guide project, thread "Hidden gems methodology", Fable 5.1 · high)

**What we worked on**
- Evaluated the owner's idea for uncovering hidden gems (sweep every business on Google Maps, evaluate hours / website / menu / rating / review count / preference-relevant reviews, score, recommend the top) against seven other methods, with web research on Google's limits, pricing and terms and on third-party APIs
- Wrote `helpers/decisions/hidden-gems-proposal.md`: keep the owner's scoring idea, drop the city-wide enumeration (terms §3.2.3(a), the 20-result / 5-review API shape, cost that follows density, run time, fake-review exposure); recommend the **Gem Funnel** (interview gem appetite → taste queries + local-voices research + quiet-neighbourhood probes → free screening → gem score → evidence pass → 💎 shortlist + "Gems not chosen" Later list), ≈ $4 per round at list price and $0 inside the free caps
- Answered the owner's follow-up (enable Nearby Search and the Places Aggregate API now?): Nearby Search needs nothing (a Places API (New) method), the Aggregate API is worth enabling now; recorded his answers to decisions 22–26 and renumbered them (the plan's 18–21 belong to the interaction-design amendment)

**Where we left off**
- Proposal merged as v01.18r, decisions recorded as v01.20r; the plan and the phase prompts are untouched. The coordinator routes §6 (plan changes: facts, §5.1 / §5.2 / §5.5 / §5.9, data model, Maps and research kit additions, a `gems/` engine module) into a new WP-2g inside Phase 4b
- Waiting only for the owner to say the Places Aggregate API is enabled and `areainsights.googleapis.com` is on the Claude HQ credential; until then stream 3 of the funnel is dormant

**Key decisions made**
- Evaluate at the search layer (Text / Nearby Search Enterprise return 20 places with rating, count, hours and website per call) and pay for Place Details only on finalists
- A place is a 💎 only with corroboration outside Google (a local-language or local-editorial mention); "high rating, few reviews" alone is not enough
- Nothing from Google persists beyond place ids; area questions go to the Aggregate API, distances use our own anchors (no polygon tests on Google coordinates)
- Decisions 22–26: 22 gem appetite 3, 24 in-run reading of Google reviews and AI summaries, 25 no third-party review APIs, 26 owner seeds — all confirmed by the owner 2026-10-01; 23 Places Aggregate API — owner chose "enable now" over the Phase 7 default

**Active context**
- `main` advanced four times while this session ran (Phase 4, the interaction-design amendment, the brochure's real Google maps as v01.17r and v01.19r); rebased each time. The TourGuide repo, AssistantBrain and the plan file were not touched
- Package numbering: WP-2e is the brochure maps package, WP-2f the prefs gap, so the gem package is WP-2g

**Recommendation for next session**
- When Phase 4b starts, read `helpers/decisions/hidden-gems-proposal.md` §6 and fold WP-2g (the Gem Funnel) into it, with stream 3 live only once the owner has enabled the Aggregate API

**To continue:** type `Read helpers/decisions/hidden-gems-proposal.md §6 and fold WP-2g into Phase 4b.`

## Previous Sessions

**Date:** 2026-10-01 03:32:47 AM EST
**Repo version:** v01.16r
**Branch:** `claude/tg-interaction-design-awq6bh` (Tour Guide project, thread "Ways to interact with Tour Guide", Fable 5.1 · high)

**What we worked on**
- Evaluated seven ways to interact with Tour Guide (chat commands, a standalone web app, a Telegram Mini App, Drive, the Sheet, inline mode, an Artifact) and recommended: Telegram stays the front door; the places repository and the learning loop land in Phase 4b and Phase 5; the Tour Guide app (Telegram Mini App) becomes Phase 9 after the pilot
- Amended `repository-information/TOUR-GUIDE-BUILD-PLAN.md` (new §5.10 places repository + learning loop, new §5.11 interaction options and the app, §4 architecture and data model, §5.9 `/places` and `/review`, §6 rows and Phase 9, §8–§10, new §11c, §12), `helpers/BUILD-STATE.md`, `helpers/prompts/TG-PHASE-4B.md`, `helpers/prompts/TG-PHASE-5.md`; wrote `helpers/prompts/TG-PHASE-9.md` (draft, finalized by Phase 8)

**Where we left off**
- Amendment pushed as v01.16r. Phase 4 is still running in its own thread; `TG-PHASE-4.md` and `TG-PHASE-4-DELTA.md` were left untouched and no new delta was needed (the repository fields land in Phase 4b because `tg-memory.mjs` is the sole reader/writer of `places/`)
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

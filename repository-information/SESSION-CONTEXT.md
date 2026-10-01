# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

**Date:** 2026-10-01 03:27:41 AM EST
**Repo version:** v01.18r
**Branch:** `claude/tg-hidden-gems-dn7epo` (Tour Guide project, thread "Hidden gems methodology", Fable 5.1 · high)

**What we worked on**
- Evaluated the owner's idea for uncovering hidden gems (sweep every business on Google Maps, evaluate hours / website / menu / rating / review count / preference-relevant reviews, score, recommend the top) against seven other methods, with web research on Google's limits, pricing and terms and on third-party APIs
- Wrote `helpers/decisions/hidden-gems-proposal.md`: keep the owner's scoring idea, drop the city-wide enumeration (terms §3.2.3(a), the 20-result / 5-review API shape, cost that follows density, run time, fake-review exposure); recommend the **Gem Funnel** (interview gem appetite → taste queries + local-voices research + quiet-neighbourhood probes → free screening → gem score → evidence pass → 💎 shortlist + "Gems not chosen" Later list), ≈ $4 per round at list price and $0 inside the free caps

**Where we left off**
- Proposal pushed as v01.18r and delivered in the thread; the plan and the phase prompts are untouched. The coordinator routes §6 (plan changes: facts, §5.1 / §5.2 / §5.5 / §5.9, data model, Maps and research kit additions, a `gems/` engine module, WP-2g inside Phase 4b) to the thread that owns the plan. Decisions 18–22 (gem appetite default 3, enable the Places Aggregate API at Phase 7, reading API reviews for fit, no third parties for now, owner seeds) wait for the owner, defaults stand meanwhile

**Key decisions made**
- Evaluate at the search layer (Text / Nearby Search Enterprise return 20 places with rating, count, hours and website per call) and pay for Place Details only on finalists
- A place is a 💎 only with corroboration outside Google (a local-language or local-editorial mention); "high rating, few reviews" alone is not enough
- Nothing from Google persists beyond place ids; area questions go to the Aggregate API, distances use our own anchors (no polygon tests on Google coordinates)

**Active context**
- Phase 4 merged as v01.16r while this session ran (rebased onto it); Phase 4b is next and is the proposed home of WP-2g; the TourGuide repo, AssistantBrain and the plan file were not touched
- The Phase 2 brochure follow-up (WP-2e, real Google maps and place photos) merged as v01.17r while this session ran, without saving session context; its summary is in CHANGELOG v01.17r. The gem package therefore takes the next free number, WP-2g

**Recommendation for next session**
- When Phase 4b starts, read `helpers/decisions/hidden-gems-proposal.md` §6 and decide with the owner whether WP-2g joins Phase 4b or waits for its own package

**To continue:** type `Read helpers/decisions/hidden-gems-proposal.md §6 and fold WP-2g into Phase 4b.`

## Previous Sessions

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


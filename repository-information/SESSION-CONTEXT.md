# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.


## Latest Session

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

## Previous Sessions

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

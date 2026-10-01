# Phase 6 — resume note

> For a session that picks Phase 6 up after a pause (usage limit, new session). Prompt: `helpers/prompts/TG-PHASE-6.md` (Fable 5.1 · xhigh). Keep this file accurate after every finished step.

| Step | State |
|---|---|
| 0 Orient (three checks clean: 374 tests / 373 pass / 1 skip, bundle ok, boundary clean; TourGuide journey dry run 0 failures) | done 2026-10-01 |
| Carried 6 Re-pin TourGuide `vendor/helpers` to the Phase 5 dist (87be955 → 4afb9cd), journey dry run | done — TourGuide branch `claude/project-thread-orkxn4` pushed, draft PR LightAISolutions/TourGuide#4 (based on PR #3's head; subscribed) |
| 1 Integration (WP-6c in TourGuide: `tools/integration-dryrun.mjs`) | not started |
| 2 Red-team — WP-6a pack gas (`../wt-6a`, hb-builder-opus), WP-6b kits + engines (`../wt-6b`, hb-builder-fable), WP-6c skills | WP-6a done and merged (51 tests); WP-6b done and merged (34 tests, R3 words-only `gem_line`); WP-6c skills red-team running in TourGuide |
| 3 PDF delivery (inside WP-6a) | done — I1–I7, `/brochure` attaches only files inside the helper root (`driveFileWhere`) |
| Carried 7 Core truncation hardening + Maps scope (architect) | done — `05_telegram.js` tag/entity-safe `tgSplit`/`tgClip`, plain-text retries; `tests/core_telegram.test.js` (9); Maps service needs no OAuth scope (decision in TG-PHASE-6.md §4) |
| Carried 1/3/4/5 Lane B prices, fires cap, R3 terms, trigger quotas — web-verified | done — TG-PHASE-6.md §4 |
| 4 Cost and quota audit (`helpers/decisions/TG-PHASE-6.md` §3, §4) | done — every figure cited; `MAX_ROUTINE_FIRES_PER_DAY` → 24 recommended; R3 decided and implemented by WP-6b (gem_line without Google digits) |
| 5 Switch-on guide `helpers/docs/TG-SWITCH-ON.md` | written (10 sections); re-read once more after the WP merges for anything they changed |
| 6/7 Merges, checks, bookkeeping (v01.28r), TG-PHASE-7.md, remember session, single push | `helpers/prompts/TG-PHASE-7.md` written; **WP-6a merged** (`cdd91ad`, core R1–R4 applied `89c987e`); **WP-6b merged** (`2a4449a`; 470 tests / 469 pass / 1 skipped, bundle + boundary clean; Q-2/Q-3 applied, Q-1 relayed to WP-6c); TG-PHASE-6.md §2.1, §2.2 and §5 filled; waiting on WP-6c (TourGuide `claude/project-thread-orkxn4`, status files land in Personal `helpers/status/WP-6c.md` + `helpers/decisions/WP-6c.md`); then §2.3, suites in both repos (TourGuide: `node --test vendor/helpers/tests/`, `tools/journey-dryrun.mjs`, `tools/integration-dryrun.mjs`), re-read `docs/TG-SWITCH-ON.md`, bookkeeping, remember session, single push, PR #4 ready |

## Log
- 2026-10-01: WP-6a merged and its core requests R1–R4 applied; WP-6b merged with its three follow-ups (Q-1 → WP-6c, Q-2 test fixture, Q-3 superseded notes); decisions §2.1/§2.2/§5 recorded. Only WP-6c outstanding.
- 2026-10-01 (Fable 5.1 xhigh): Step 0 done; vendor re-pin pushed as draft PR #4. Personal has no commits yet beyond this note; everything in Personal stays local until the single bookkept push (a Personal push auto-merges into main). Worktrees `../wt-6a` and `../wt-6b` are local to the session container — if they are gone, re-run the WPs from the briefs in `helpers/decisions/TG-PHASE-6.md` §1.
- 2026-10-01: carried item 7 committed locally (core Telegram hardening + tests; 383 tests / 382 pass / 1 skip, bundle ok, boundary clean). WP-6a/6b/6c builders running in the background.
- 2026-10-01: §3 cost/quota audit and §4 carried decisions written; `docs/TG-SWITCH-ON.md` written; committed locally. Finding sent to WP-6c: `routines/README.md` lists no Gmail/Calendar connector for `trip-research` though its intake step reads both.

Developed by: LightAISolutions

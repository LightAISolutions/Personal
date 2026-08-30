# Previous Session Context

Claude writes to this file when the developer says **"Remember Session"** — capturing enough context for a future session to pick up the train of thought quickly. This is separate from "Reminders for Developer" (REMINDERS.md), which is the developer's own notes.

> **Note on stale-context auto-reconstruction** — when a session starts and this file's `Repo version:` doesn't match the current repo version, Claude reconstructs the missing entry from CHANGELOG.md and commits it **without pushing**. The commit rides along with the session's first user-task commit on the next push. If a session ends before any user-task push happens, the reconstructed entry stays **local-only** and the next session will just re-reconstruct from CHANGELOG if still stale. This is intentional — pushing a dedicated reconstruction commit on its own would force every subsequent user push in the same session to wait for the auto-merge workflow to finish before it could push too (push-once enforcement). The reconstructed entry is a convenience hint, not load-bearing state, so the small persistence risk is a fair trade.

## Latest Session

**Date:** 2026-08-29 10:54:00 PM EST
**Repo version:** v03.83r
**Branch:** `claude/industry-guidance-cleanup-9jsnzi`

**What we worked on (v03.83r — the two remaining guidance improvements, one pass):**

- **#5 Per-module revision notes (page v01.68w):** all six guidance modules in `Profiler.gs` carry a `revisions: [{date, note}]` meta field, seeded with the 2026-08-29 scrub/generalization as each module's first entry; `guidanceIndex_()` emits a `revised` date (latest entry); the page renders a "Revision notes" block under the module header (newest first) and a `↻ revised` chip on library cards
- **#4 Server-side reading-progress sync (GAS v01.27g):** new role-gated `gop=progress` / `gop=setprogress` ops in `handleGuidanceOp_` store each account's section ticks in one Script Property (`gd_progress:<email>`), doc/section ids validated against registered modules, writes under a script lock; the page prefers the server map once a sync succeeds, keeps localStorage as the offline fallback, migrates local-only ticks up in one batch on first sync, and repaints the open module when a sync lands (done buttons now carry `data-sec` for the repaint)
- **Data-loss guard (found via `verify-profiler-roles.py`'s isolation test):** a sync response without a real `progress` object counts as "sync unavailable" — never as an empty server map — and a failed migration aborts adoption, so a legacy backend or network failure can never wipe local ticks
- **Deploy verified end-to-end:** commit merged to main, `op=deploy` probe returned "Already up to date (v01.27g)" (webhook had already fired), Pages serving `|v01.68w|` / `|v01.27g|`
- Profiler diagram's guidance bullet updated to the real op set + role gate; README tree/timestamp synced

**Where we left off:**

- **All six module-audit improvements are now delivered** (#1 lens, #2 freshness, #3 cross-links, #4 progress sync, #5 revision notes, #6 search/glossary) — the Industry Guidance improvement thread is closed
- Everything committed, merged, and live; working tree clean
- One manual check remains (needs two real signed-in accounts, no probe can do it): tick a section on one device, confirm it appears on another device on the same account — existing local ticks migrate up on each account's first sign-in after the deploy

**Key decisions made:**

- **Progress storage medium (decided before coding, per prior session's instruction):** Script Properties, one property per account — tiny per-user blobs, no cross-project consumers, no spreadsheet round-trip per tick; the Master ACL spreadsheet pattern stays reserved for cross-app access control
- **Sync trust rule:** the server map is authoritative only after a response carrying a real `progress` object; localStorage is mirrored down post-sync (including removals) and stays the offline source until then
- Revision notes are meta, not content — adding them bumped versions but did not add a new `revisions` entry to the modules themselves

**Active context:**

- **Branch:** `claude/industry-guidance-cleanup-9jsnzi` · **Repo:** v03.83r · **Profiler:** v01.68w / GAS v01.27g
- **Profiler page changelog is FULL at 50/50 — the next page version bump exceeds capacity and triggers its archive rotation (SHA enrichment mandatory)**; repo CHANGELOG 93/100; GAS changelog 27/50
- Inherited watch item (automated, verify after it fires): Monday 2026-08-31's scheduled Scraper digest run is the first real end-to-end execution of the 06:00 ET build / 07:00 ET send schedule
- Toggles: START_OF_RESPONSE_BLOCK On · CHAT_BOOKENDS Off · TIMING_ESTIMATES On · END_OF_RESPONSE_BLOCK On

**Recommendation for next session:**

- **Check how Monday 2026-08-31's scheduled Scraper digest run went** — the first real end-to-end execution of the 06:00 ET build / 07:00 ET send schedule: verify it built from the 72-hour window, replaced the day's edition, and actually mailed. (The guidance thread is fully delivered — nothing is deferred there; the only guidance follow-up is the manual two-device tick check noted above, which needs the developer's own accounts.)

**To continue:** type `check how Monday's scheduled Scraper run went`

## Previous Sessions

### Session — 2026-08-29 (Industry Guidance scrub + improvement build-out, v03.76r–v03.82r)

**Date:** 2026-08-29 09:54:32 PM EST
**Repo version:** v03.82r
**Branch:** `claude/industry-guidance-cleanup-xblq61`

**What we worked on (v03.76r–v03.82r — the Industry Guidance scrub + improvement build-out):**

- **Content scrub (v03.76r, GAS v01.24g + page v01.63w):** all six guidance modules stripped of company-specific guidance (Zhonhen, Hithium) — modules now address supplier/buyer groups only ("BESS suppliers", "TRU/SST suppliers", "§154-listed suppliers", developers, integrators, hyperscalers); statutory facts naming companies (the NDAA §154(b) list) stay as objective information. The `zh` note field renamed `sales`, rendered under a neutral "Sales angle" label (the renderer had leaked "For the Zhonhen conversation" to all guidance viewers). Repo CHANGELOG's 2026-08-22 date group (15 sections) rotated to the archive, SHA-enriched
- **Admin lens (v03.77r, page v01.64w):** reports declare `guidanceOverlays[]` (`{moduleId, sectionId, ps}`) and admins (the `reports` capability) see 🔒 rose panels inside the anchored module sections with a "View source report" link; stale anchors fall back to module end; non-admin tiers never fetch report data. `check-profiler-reports.py` validates anchors against the live modules parsed from Profiler.gs, forbids citation tokens in overlay prose, and reconciles the index's new `overlayModules` field
- **Two overlay-bearing reports** restoring the company lens the scrub removed: `s154-listed-bess-suppliers--risk--2026-08-29` (v03.78r — CATL/BYD/Envision/EVE/Hithium, 24 citations, 5 overlays onto China Policy / Bankability / Power Infra / Utility-AIDC; carries the *current* Hithium file: third listing lapse Apr 2026, equity freeze, ~10 CATL suits) and `aidc-power-conversion--competitive--2026-08-29` (v03.79r — Delta/LITEON/Megmeet/Zhonhen/Sinexcel/Vertiv/Eaton/Schneider, 29 citations, 3 overlays onto the NVIDIA module; carries the CATL RMB 4.1B/49% Zhonhen-holdco re-rating and the roster-absence read)
- **Freshness discipline (v03.80r, GAS v01.25g + page v01.65w):** every module carries a gate-derived `reviewBy` (Bankability → Oct 1 PRC-029-1; Utility-AIDC + Power Infra → Dec 10 Batch Zero; China Policy → Dec 31 Treasury PFE regs; NVIDIA → Nov 30; BESS Tech → Feb 24) rendered as plain/gold/red chips; report library + report view show fresh ≤45d / aging ≤120d / stale age chips; quarterly review Routine armed (`trig_01CrhxzfBV6uKQNKpUXLLMSZ`, Jan/Apr/Jul/Oct 15 13:00 UTC, fresh session, first fire 2026-10-15)
- **Company-chip cross-links (v03.81r, GAS v01.26g + page v01.66w):** covered company names in module text link to dossiers (`gdLinkCompanies` — registry name authority + `ovRelDerive` ambiguity guard; buttons/links/headings/term-spans excluded); dossiers show "✦ Covered in guidance modules" for guidance-capable tiers via the new role-gated `gop=mentions` op (server scan, 6h `CacheService`)
- **Search + unified glossary (v03.82r, page v01.67w, client-only):** library search across every module's flattened section text + glossary (ranked, highlighted snippets, hit → module scrolled to section via `ovGuideLoadDoc`'s new scroll arg); "📖 Unified glossary" merges all terms alphabetically, duplicates grouped with per-module definitions and source chips

**Where we left off:**

- Everything through v03.82r committed, pushed, and auto-merged; working tree clean; the v01.24g GAS deploy was live-verified via the `op=deploy` probe (later bumps ride the same webhook)
- **Of the six improvement recommendations from the module audit, four are delivered (#1 lens, #2 freshness, #3 cross-links, #6 search/glossary). #4 and #5 are deferred to next session at the developer's instruction** — see the recommendation below
- Profiler page changelog at **49/50 — the next page bump triggers its rotation** (SHA enrichment mandatory); repo CHANGELOG at 92/100; GAS changelog 26/50

**Key decisions made:**

- **Content scope rule (in `industry-guidance.md` step 4):** modules give guidance to groups only, never to a single named company; single-company specificity lives in admin-only reports and reaches modules through the Admin lens; statutory name-lists stay as fact
- Report overlays carry no `[c:id]` citation tokens (the report link is the citation path); reports stay immutable — the two new reports were authored fresh rather than retrofitting the existing one
- `reviewBy` derives from each module's own nearest dated gate, not a fixed cadence; the quarterly Routine is the backstop, the in-app chips the primary signal
- Cross-link matching inherits the ambiguity guard (one-word capitalized names skip sentence starts/post-colon) — under-linking beats false-linking
- Search and glossary are client-only over the existing role-gated ops — no new server surface, no content exposure beyond what the viewer's tier can already open

**Active context:**

- **Branch:** `claude/industry-guidance-cleanup-xblq61` · **Repo:** v03.82r · **Profiler:** v01.67w / GAS v01.26g
- Reports library: 3 reports, all `current`; the two new ones carry `overlayModules`; the older competitive report's coverage pins are aging by design (12 checker warnings, not errors)
- Imminent external events (no action needed — automated): Zhonhen H1 2026 report due by Aug 31 (feeds the NVIDIA-module lens's checkpoint); Sungrow + BYD post-earnings refresh triggers fire Aug 30; **inherited watch item: Monday 2026-08-31's scheduled Scraper digest run is the first real end-to-end execution — verify it built from the 72-hour window, replaced the day's edition, and mailed**
- Toggles: START_OF_RESPONSE_BLOCK On · CHAT_BOOKENDS Off · TIMING_ESTIMATES On · END_OF_RESPONSE_BLOCK On

**Recommendation for next session:**

- **Finish the two remaining guidance improvements in one pass (developer instruction, 2026-08-29):** **#5 per-module revision notes** — a `revisions: [{date, note}]` meta field on each module rendered near the header (seed each module with the 2026-08-29 scrub/generalization as its first entry; emit via `guidanceIndex_()` if the library should show a "revised" hint), then **#4 server-side reading-progress sync** — replace/augment the per-device localStorage `gdProgress` with a per-user store behind new role-gated guidance ops (e.g. `gop=progress` read / `gop=setprogress` write in `handleGuidanceOp_`, keyed by the validated session's account; keep localStorage as the offline fallback and migrate local ticks up on first sync). #4 is server-handler work only (not the served auth shell) but touches Profiler.gs storage — plan the storage medium (Script Properties vs the Master ACL spreadsheet pattern) before coding, and run the full gate set (node --check, inner-scripts, Playwright, harness). Both land as one interaction commit with GAS + page bumps.

**To continue:** type `finish the guidance improvements`

Developed by: LightAISolutions

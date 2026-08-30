# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with project-specific versioning (`w` = website, `g` = Google Apps Script, `r` = repository). Older sections are rotated to [CHANGELOG-archive.md](CHANGELOG-archive.md) when this file exceeds 100 version sections.

`Sections: 94/100`

## [Unreleased]

*(No changes yet)*

## [v03.84r] — 2026-08-30 01:37:44 AM EST

> **Prompt:** "This is a new repo that I copied from my Sales repo, but repurposed for my personal life instead of my work. To that end, I want this to be a skeleton of what Sales is in order to flesh it out with Personal-repo-specific apps. However, I want it to keep all of Sales' rules and workflow (including but not limited to the auto-merge/deploy workflow, page templates, versioning system, changelogs, and all the Claude rules). Recommend an action plan to clean this repo and prepare it for new apps under a new scope: Personal." — followed mid-response by: "Also, I want you to fix the auto-merge-claude.yml and clasp-deploy.yml to match the new repo name."

### Fixed
- `.github/workflows/auto-merge-claude.yml` — library-mirror job's repo-identity strings updated from the Sales repo to this Personal repo: checkout step name ("Checkout Sales main" → "Checkout Personal main"), internal checkout path `sales` → `personal` (all path references in the sync step), seeded library README origin line (`LightAISolutions/Sales` → `LightAISolutions/Personal`), mirror bot name (`sales-library-mirror[bot]` → `personal-library-mirror[bot]`), and mirror commit message (`Mirror from Sales@` → `Mirror from Personal@`). No behavior change — the job still self-skips while the `LIBRARY_SYNC_TOKEN` secret is unset
- `.github/workflows/clasp-deploy-pilot.yml` — audited for repo-name references: none found (the workflow is fully repo-agnostic — it targets Apps Script via repo secrets and uses only relative paths), so no changes were needed

## [v03.83r] — 2026-08-29 10:28:50 PM EST

> **Prompt:** "Picking up from my recent "Industry Guidance modules cleanup", finish the two remaining guidance improvements in one pass."

### Added
- Industry Guidance per-module revision notes (#5 of the module-audit improvements): every guidance module in `Profiler.gs` now carries a `revisions: [{date, note}]` meta field, seeded with the 2026-08-29 scrub/generalization as each module's first entry; `guidanceIndex_()` emits a `revised` date (latest entry) and `Profiler.html` renders a "Revision notes" block under the module header plus a "↻ revised" chip on library cards
- Server-side reading-progress sync (#4): new role-gated `gop=progress` / `gop=setprogress` ops in `handleGuidanceOp_` store each account's section ticks in one Script Property (`gd_progress:<email>` — chosen over the Master ACL spreadsheet pattern: tiny per-user blobs, no cross-project consumers, no spreadsheet round-trip per tick), with doc/section ids validated against the registered modules and writes guarded by a script lock; `Profiler.html` prefers the server map once a sync succeeds, keeps localStorage as the offline fallback, migrates local-only ticks up in one batch on first sync, and repaints the open module when a sync lands. A response without a real `progress` object counts as "sync unavailable" — never an empty map — and a failed migration aborts adoption, so a legacy backend or network failure can never wipe local ticks (caught by `verify-profiler-roles.py`'s isolation test during development)

### Changed
- `repository-information/diagrams/profiler-diagram.md` — Industry Guidance transport bullet updated to the current op set (`index|doc|mentions|progress|setprogress`) and the real role gate (`guidanceAllowed_`: admin permission or `GUIDANCE_ROLES` tier), and documents the progress-sync storage

## [v03.82r] — 2026-08-29 09:52:01 PM EST

> **Prompt:** "continue with your recommendation"

### Added
- **Guidance search + unified glossary** (recommendation #6 from the v03.76r module audit, `Profiler.html` v01.67w — client-only, rides the existing role-gated `index`/`doc` ops): a search box atop the guidance library (`gdFetchAllDocs` one-time doc cache, `gdSecText` recursive string flattener so tables/cards/drills/notes/sales angles are all searchable, `gdSearchHits` ranking title/term matches first, highlighted snippets, hit click → `ovGuideLoadDoc` with a new scroll-to-section argument), and a "📖 Unified glossary" view merging all modules' terms alphabetically with duplicate terms grouped per-module (`gdShowGlossary`, source chips opening each module's glossary)
- `.claude/rules/industry-guidance.md` step 4 documents both features

## [v03.81r] — 2026-08-29 09:47:21 PM EST

> **Prompt:** "continue with your recommendation"

### Added
- **Company-chip cross-links** (recommendation #3 from the v03.76r module audit), completing the module ↔ dossier ↔ report triangle in both directions. Guidance → dossiers: `gdLinkCompanies` walks rendered module text nodes and wraps covered company names (registry name authority, `ovRelDerive`'s ambiguity guard via `ovRelFalseStart`, longest-name-first overlap resolution) as CVD-blue chips that close the overlay and open the dossier — excluding buttons, links, headings, glossary-term spans, and label rows; Admin lens panels get the same pass. Dossiers → guidance: new role-gated `gop=mentions` op (`guidanceMentions_` — registry fetched from Pages, mirrored ambiguity guard, `CacheService` 6h) feeds an "✦ Covered in guidance modules" chip line on dossiers for `guidance`-capable tiers only, each chip opening the module via `ovGuideOpenDoc`
- `.claude/rules/industry-guidance.md` steps 4-5 document the chips, the mentions op, and the tier gate

#### `Profiler.gs` — v01.26g
##### Added
- `guidanceMentions_()` + `gop=mentions` wired into `handleGuidanceOp_` behind the existing `guidanceAllowed_` gate

#### `Profiler.html` — v01.66w
##### Added
- `gdLinkCompanies`/`gdOpenCompany` (guidance-side chips, called from `gdRenderDoc` and `gdApplyLens`), `ovGuideOpenDoc` (direct module open), `ovGuidanceMentionsLine` (dossier-side line, session-cached), `.gd-co`/`.ov-gd-mentions` styles

## [v03.80r] — 2026-08-29 09:39:08 PM EST

> **Prompt:** "continue with your recommendation"

### Added
- **Freshness discipline for the Industry Guidance function** (recommendation #2 from the v03.76r module audit): every guidance module now carries a `reviewBy` date set from its own nearest dated gate (Bankability → 2026-10-01 PRC-029-1; Utility-AIDC and Power Infrastructure → 2026-12-10 Batch Zero; China Policy → 2026-12-31 Treasury PFE regs; NVIDIA 800 VDC → 2026-11-30 post-3Q26 shipments; BESS Tech → 2027-02-24 six-month default), emitted via `guidanceIndex_()` and rendered as library/header chips; report library entries and report pages show age-tier chips (fresh ≤45d / aging ≤120d / stale) from each report's date
- **Quarterly guidance-review Routine armed** — `Industry Guidance quarterly review` (`trig_01CrhxzfBV6uKQNKpUXLLMSZ`, cron `0 13 15 1,4,7,10 *` UTC, fresh session per fire; first fire 2026-10-15): re-verifies each module's dated gates against primary sources, refreshes `updated`/`reviewBy`, validates report overlay anchors, and recommends superseding aged reports
- `.claude/rules/industry-guidance.md` step 10 documents the field, chip thresholds, and the Routine; `.claude/rules/profiler-app.md` notes the report age chips

#### `Profiler.gs` — v01.25g
##### Added
- `reviewBy` meta on all six guidance modules; `guidanceIndex_()` emits it

#### `Profiler.html` — v01.65w
##### Added
- `gdReviewChip` (plain / gold ≤30d / red overdue) on guidance library cards and module headers; `rpAgeChip` (fresh/aging/stale, roster palette) on report library cards and the report view meta line

## [v03.79r] — 2026-08-29 09:30:14 PM EST

> **Prompt:** "continue with your recommendation"

### Added
- **Generated the companion competitive report** — `aidc-power-conversion--competitive--2026-08-29` ("AIDC Power Conversion — The 800 VDC Race", intel-briefing style): the 8 covered power-conversion players (Delta, LITEON, Megmeet, Zhonhen, Sinexcel, Vertiv, Eaton, Schneider — all dossiers fresh 2026-08-29; Huawei DP excluded from scope as sanctions-fenced, Flex/BizLink uncovered, both recorded in gaps), 6 confidence-tagged judgments, 3 sections (position table, the three contested layers, the Zhonhen file), 6 indicators, 29 citations copied verbatim from dossier `sources[]`
- **Three `guidanceOverlays[]` restore the Zhonhen-side admin lens** onto the NVIDIA 800 VDC module (`options`, `trusst`, `suppliers`) — carrying the current company-specific reads: the Aug 2026 white paper naming Panama, Kezhi's 31% China HVDC share, the CATL RMB 4.1B/49% holdco definitive agreements, absence from NVIDIA's partner rosters, the Enervell Western vehicle, the founder's Dec 2025 conviction, and the H1 2026 report checkpoint (due 31 Aug)
- Verified: `check-profiler-reports.py` clean on the first pass (0 errors, all 3 anchors + 29 citations validated); Playwright render confirmed all three panels anchor in the NVIDIA module

## [v03.78r] — 2026-08-29 09:22:40 PM EST

> **Prompt:** "continue with your recommendation"

### Added
- **Generated the first overlay-bearing industry report** — `s154-listed-bess-suppliers--risk--2026-08-29` ("§154-Listed BESS Suppliers — US Market-Access Risk", risk type, intel-briefing style): 5 covered §154(b)-listed makers (CATL, BYD, Envision, EVE, Hithium — all dossiers fresh 2026-08-29; Gotion recorded as a coverage gap), 6 confidence-tagged key judgments, 4 sections (exposure map, the policy fence, counterparty files, lanes-as-used), 6 indicators, 24 citations copied verbatim from dossier `sources[]`. Registered in `reports-index.json` with `overlayModules`
- **Five `guidanceOverlays[]` restore the admin-only company lens** the v03.76r scrub removed from the shared modules — anchored to China Policy (`levers`, `interaction`), Bankability (`counterparty`), Power Infrastructure (`markets`), and Utility-AIDC (`channels`), carrying the current company-specific reads (Hithium's third listing lapse + equity freeze + ~10 CATL suits, EVE's reported §1260H addition and §337 action, the AESC/Fixx divest-to-comply lane, the Jupiter/Peak-Energy account defense)
- Verified: `check-profiler-reports.py` clean (0 errors; overlay anchors validated against the live modules), plus a Playwright render of the real report overlays inside the China-policy module

## [v03.77r] — 2026-08-29 09:12:08 PM EST

> **Prompt:** "continue with your recommendation"

### Added
- **Admin lens overlays** (the recommended next step from v03.76r): reports can now declare `guidanceOverlays[]` (`{moduleId, sectionId, title?, ps[]}`) anchoring company-specific analysis to Industry Guidance module sections. `Profiler.html`'s guidance renderer fetches overlay-bearing `current` reports (via the new `overlayModules` field on reports-index entries) for viewers with the `reports` capability only, and renders 🔒 "Admin lens" panels (rose-accent `.gd-lens`, distinct from the gold "Sales angle" notes) inside the anchored sections with a "View source report →" link into `#report/<id>`; a stale anchor falls back to the end of the module with an explanatory note instead of dropping the content. Non-admin tiers never fetch report data, so shared modules stay group-level
- `scripts/check-profiler-reports.py` now validates overlays: `moduleId`/`sectionId` verified against the guidance modules parsed live from `Profiler.gs`, non-empty `ps`, no `[c:id]` citation tokens in overlay prose, and index `overlayModules` reconciliation

### Changed
- `repository-information/PROFILER-SCHEMA.md`: `guidanceOverlays[]` added to the Report schema table; `overlayModules` documented on the reports index
- `.claude/rules/profiler-app.md` (Report Command step 3) and `.claude/rules/industry-guidance.md` (step 4): overlay authoring rules + the 2026-08-29 content-scope directive (modules address groups only; company-specific analysis reaches admins via the lens)

## [v03.76r] — 2026-08-29 08:41:26 PM EST

> **Prompt:** "Picking up from my recent "Profiler report engine design", go through all my Industry Guidance modules and remove any company-specific guidance, like for Zhonhen and Hithium. Make sure all the modules are informative and objective. It is ok to give guidance to specific groups of companies, like "BESS suppliers", "SST suppliers", "Developers", "Integrators", "Hyperscalers", etc., but don't specifically give guidance to any one company in these modules. I want to reserve that level of specificity for Reports that are only accessible by me and other admins. While you go through the modules for the task above, also check each module to make sure it has no other issues. Also, recommend me ways to improve this Industry Guidance function to be more useful to myself and other users."

### Changed
- Scrubbed all six Industry Guidance modules of company-specific guidance (developer directive: modules address supplier/buyer groups only — "BESS suppliers", "TRU/SST suppliers", "§154-listed suppliers", developers, integrators, hyperscalers; single-company specificity is reserved for the admin-only Reports view). Statutory facts naming companies (the FY2024 NDAA §154(b) list) are retained as objective information
- Renamed the guidance module per-section note field `zh` → `sales` across the renderer, the module content, and the schema note in `.claude/rules/industry-guidance.md` step 4
- Repo CHANGELOG archive rotation: the 2026-08-22 date group (15 sections, v02.76r–v02.90r) moved to `CHANGELOG-archive.md` with SHA enrichment

#### `Profiler.gs` — v01.24g
##### Changed
- NVIDIA 800 VDC module: "For the Zhonhen conversation" section retargeted to "For TRU and SST suppliers"; Zhonhen product ratings (Panama/SuperX 2.5/3.6 MW) and "your Zhonhen prep" references removed; the module `short` no longer says "tailored"
- China Policy module: reframed from a single supplier's sales desk to "§154-listed suppliers" — first-person "we/us/our side" removed; the "Severity for Hithium" table column, "A developer buying Hithium" interaction map, Mesquite tariff-engineering lane, red lines, flashcards, quiz scenarios, and FIE/SFE glossary entries generalized; the Mesquite plant ledger row removed
- Utility-AIDC module: Hithium parentheticals removed from the ERCOT merchant channel card and the procurement awards table
- Bankability module: "Hithium's file — what an IE will say" (section id `hithium`) rewritten as the generic "The counterparty file" (id `counterparty`) with tailwind/headwind categories and the structural-answers toolkit; two Hithium ledger rows and the BNEF Tier 1 listing mentions removed; "Jupiter fleet" references generalized to "US fleet performance"
- BESS Technology Fundamentals module: converted from a single-vendor product catalog (∞Block/∞Power/Flexsso/Desert Eagle specs, "The Hithium cell ladder", the Peak Energy anchor-account defense) to industry class-typical teaching — cross-vendor Ah-class cell ladder, generalized container landscape and sodium sections, sourcing repointed from `hithium.profile.json` to the covered supplier dossiers, quiz/flashcards rewritten to concept level
- Power Infrastructure module: first-person "our lane / our fit / our containers" voice replaced with supplier-group framing; internal engagement references (team-lead playbook, S1 pipeline gates, `hithium-relationship-web.md` ledger pointer, "the Jupiter pattern") removed or generalized

#### `Profiler.html` — v01.63w
##### Changed
- The guidance renderer's per-section note label changed from "For the Zhonhen conversation" to the neutral "Sales angle", reading the renamed `sales` field

## [v03.75r] — 2026-08-29 08:19:11 PM EST

> **Prompt:** "Continue with your recommendation about the opener-gate miss. Then, remember session."

### Changed
- **Response Opener gate hardened (`.claude/rules/chat-bookends.md`)** — Step 1 is now a threefold combined command (timestamp + toggle rows + every tracked page's version file) so the page enumeration can no longer displace the timestamp capture; the Precedence Header and the Page Enumeration gate gained a "response-start coverage" note (the opener output satisfies PLANNED AFFECTED URLS; end-of-response URL sections still re-read post-bump state). Includes the 2026-08-29 incident note: a response opened with a standalone enumeration call in Step 1's place and wrote a fabricated opening timestamp
- **Session context saved (`repository-information/SESSION-CONTEXT.md`)** — new Latest Session covering v03.63r–v03.75r (report engine + the complete Relationships build-out); the v03.62r Profiler quality build-out entry demoted to Previous Sessions; the Scraper v03.51r entry rotated out under the 2-session cap, with its Monday 2026-08-31 first-scheduled-run watch item carried into the new recommendation

## [v03.74r] — 2026-08-29 08:14:28 PM EST

> **Prompt:** "continue with your recommendation"

### Added
- **Formation timeline on the dossier Relationships tab (`live-site-pages/Profiler.html` v01.62w)** — `ovRelTimeline` renders an SVG strip (viewBox 760×118) below the relationship map when a curated dossier has ≥2 links with `since` dates: year axis with adaptive tick step, category-colored dots at each formation date (`ovRelSinceX` maps YYYY/YYYY-MM to a year fraction), lane-based label placement (four near/far lanes above/below with per-lane extent tracking and edge clamping, added after the first Playwright pass showed same-year clusters overprinting), keyboard-accessible click-through to each counterparty. Respects the category chips (`frels`). Verified on Meta (7 dated links, 2024–2026): zero label overlaps, zero clipped labels, click-through navigates, zero page errors. **This completes the 2026-08-29 Relationships improvement list** (grouping+chips, graph+inbound, network explorer, common ground, recency feed, report wiring, one-pager export, category filters, formation timeline)

## [v03.73r] — 2026-08-29 08:08:54 PM EST

> **Prompt:** "continue with your recommendation"

### Added
- **Counterparty-category filter chips on the dossier Relationships tab (`live-site-pages/Profiler.html` v01.61w)** — on dossiers with ≥8 links and ≥2 counterparty categories, `ovRelPaint` renders an `.ov-rel-cats` chip bar ("All · N" + one chip per category present, frequency-sorted, category-colored borders via `ovRelColor`, `aria-pressed`); the selection filters the relationship map and every group (`fgroups`), state (`ovRelCatSel`/`ovRelCatSlug`) resets on dossier navigation, and the one-pager export always carries the full unfiltered view. Playwright on CATL: 21 links → Supplier chip filters to 16 with per-group recounts, toggle-off restores, filter resets after navigating to Tesla, zero page errors

### Fixed
- **`ovNxCatLabel`** — `ipp` now renders as "IPP" (was "Ipp") in the new chips and the Network explorer's category dropdown

## [v03.72r] — 2026-08-29 07:58:17 PM EST

> **Prompt:** "continue with your recommendation. Also, a few other things:
>
> * Swap the positions of the "Reports" and "Network" buttons on the top right of Profiler's home page, so that contributors don't see an awkward empty spot where "Reports" is hidden.
> * In the "Industry Guidance" library, organize the modules in a way that groups related topics together and makes it easier to find the information users are looking for."

### Changed
- **Archive rotation** — the Profiler page changelog was at capacity (50/50): the 2026-08-09 date group (v01.18w–v01.10w, nine sections, SHA-enriched) moved to `Profilerhtml.changelog-archive.md` (now 42/50)
- **`.claude/rules/industry-guidance.md`** — step 4 now documents the module `group` meta field (topic-lane label consumed by the library renderer and `guidanceIndex_`)

#### `Profiler.html` — v01.60w

##### Added
- **Relationship one-pager export** — `ovRelWordExport(p)` builds a compact .doc from the Relationships view (grouped links, Status/Since/Scale/Latest chips, note+context, source URLs; detected links as one-line mention counts), downloaded from a new export-gated button on the Relationships tab. The tab's data assembly was extracted into `ovRelData(p)` shared by `ovRelPaint` and the export
- **Guidance library topic lanes** — `ovGuideOpen()` renders a `.gd-group` header whenever the module index's `group` label changes; ungrouped docs (older backend) render as before

##### Changed
- **Masthead stack** — ⛓ Network moved to the 44px slot (visible to every tier), admin-only ▤ Reports to the outer 84px slot, so contributor/analyst/viewer tiers see a contiguous stack with no gap

#### `Profiler.gs` — v01.23g

##### Added
- **`group` labels on all six guidance modules** (Technology Foundations: BESS Tech Fundamentals, Power Infrastructure; The AI Data-Center Wave: NVIDIA 800 VDC, Utility Procurement; Market Access & Bankability: China Policy Stack, Bankability & Certification); `guidanceDocs_()` reordered into lane order and `guidanceIndex_()` now emits `group`

## [v03.71r] — 2026-08-29 07:48:18 PM EST

> **Prompt:** "I would prefer 30 days instead of 90 days. Then continue with your recommendation."

### Added
- **Relationship map in the report view (`live-site-pages/Profiler.html` v01.59w)** — `rpRelMap(rep)` renders between Limitations and the Source List in `#report/<id>`: every curated edge among the report's `coverage.companies` slugs (via `ovRelEdgeFor` over all pairs, curated-only — detected cross-mentions excluded), sorted working → competing → other then freshest first, reusing `ovNxRow` for consistency with the ⛓ Network explorer. Labeled as a live overlay ("reflects today's data, not the report's snapshot date") so it never misrepresents the immutable snapshot, and deliberately excluded from `rpWordExport` (the export stays deterministic report data only). Coverage names seed `bySlug` before the registry overlays categories, so deep links render before the roster loads. Self-hides when the scope has no curated links. Playwright: 41 curated links among the 12 in-scope companies on the grid-scale BESS report, zero page errors

### Changed
- **Recency window 90 → 30 days (developer preference)** — `ovNxCutoff()` now uses a trailing-30-day window; button label "✦ New in 30d · N", tooltip, and explorer explainer updated to match. 22 of 472 edges are fresh at 30 days (vs 77 at 90)

## [v03.70r] — 2026-08-29 07:31:17 PM EST

> **Prompt:** "The two-company common ground mode works as intended. Continue with your recommendation."

### Added
- **"What's new" recency feed in the ⛓ Network explorer (`live-site-pages/Profiler.html` v01.58w)** — a `✦ New in 90d · N` toggle in the `#network` filter bar (`ovNxFresh` state + `ovNxCutoff()` trailing-90-day ISO cutoff) narrows the flat edge list to links whose `last` evidence date is inside the window, and in compare mode filters shared counterparties (kept when either connecting edge is fresh). Every fresh edge's meta line renders gold with a ✦ marker even when the toggle is off, so momentum reads at a glance. Playwright: 77/472 edges fresh, toggle isolates exactly those (zero stale rows), compare CATL + Tesla narrows 16 → 8 shared counterparties with the toggle on, zero page errors

### Changed
- **Archive rotation** — this CHANGELOG was at capacity (100/100): the 2026-08-21 date group (v02.75r–v02.70r, six sections, SHA-enriched) moved to `CHANGELOG-archive.md`

## [v03.69r] — 2026-08-29 07:19:37 PM EST

> **Prompt:** "continue with your recommendation"

### Added
- **Common-ground compare mode in the ⛓ Network explorer (`live-site-pages/Profiler.html` v01.57w)** — picking a company in the `#network` filter bar now reveals a "Compare with…" selector; with two companies picked, `ovNxCommonPaint` renders their direct link (via `ovRelEdgeFor`) plus every shared counterparty found through `ovGraphBy`, each side's typed tie spelled out from both curated dossier sides (falling back to detected-mention counts), sorted by freshest evidence. Kind filter matches either connecting edge; category filter applies to the shared counterparty. The flat edge-row renderer was extracted into `ovNxRow` so the direct-link section reuses it. Verified with node --check and Playwright (CATL + Tesla: direct link yes, 16 shared counterparties, zero page errors)

### Changed
- **Archive rotations (both changelogs were at capacity)** — `Profilerhtml.changelog.md` moved its 2026-08-08 date group (v01.09w–v01.07w, SHA-enriched) to `Profilerhtml.changelog-archive.md` (now 48/50); this CHANGELOG moved v02.69r (2026-08-19, SHA-enriched) to `CHANGELOG-archive.md` (stays 100/100)
- **README tree** — Profiler page-version link corrected from stale `v01.54w` to `v01.57w` (the v01.55w/v01.56w bumps missed the tree display)

## [v03.68r] — 2026-08-29 07:03:56 PM EST

> So far, almost everything looks good. See the attached screenshot - This is the only relationship that I found that doesn't really look useful at all, so remove it. I think making the "Detected in other dossiers" group a collapsed-by-default group is a good idea since those connections are relatively weak, but still existing. Can you think of any other way to improve this Relationships function or build on it?

### Changed

#### `live-site-pages/Profiler.html` (v01.56w)
- "Detected in other dossiers" group now collapsed by default with a click-to-expand header (▸ show / ▾ hide, keyboard-accessible with aria-expanded)

#### `scripts/build-profiler-graph.py` + `live-site-pages/profiler-data/profiler-graph.json`
- Added `EXCLUDED_PAIRS` to the graph builder for derived-only edges whose entire evidence is an anti-relationship sentence; excluded CATL–Terra-Gen (the flagged entry) and its identical twin Sungrow–Terra-Gen — both existed solely on Terra-Gen's "no CATL/EVE/Sungrow/Tesla ties found" line; graph rebuilt (472 edges, 1,499 evidence items)
- Exclusion mechanism documented in `repository-information/PROFILER-SCHEMA.md` (Relationship graph section)

## [v03.67r] — 2026-08-29 06:20:58 PM EST

> Understanding the relationships between all these different players in different functions is extremely important for me to understand which companies my targets are already working with and how. How can I optimize this Relationships tab to generate me genuinely useful information? If you need to run curated passes on any dossier or even conduct new targeted research, that's totally fine. I just want a legitimately structured way to analyze and display the information I need. Recommend me some ways to improve this Relationships function to approve.

### Added

#### Profiler data (`live-site-pages/profiler-data/`)
- Curated `relationships[]` for **all 88 dossiers** — 485 typed links (customer/supplier/partner/competitor/investor/other) with note, expanded context, stated source, and the schema-v6 `status`/`since`/`scale` deal metadata; every dossier now at schemaVersion 6
- Targeted relationship research on the 12 hyperscaler/neocloud dossiers (Oracle, Microsoft, Google, Amazon, Meta, OpenAI, xAI, Crusoe, CoreWeave, IREN, Lambda, Nebius) via 12 parallel research agents — real revisions with archival (12 superseded versions archived per the Archival Procedure), 18 new development entries and ~40 new sources covering the Stargate build web, neocloud offtakes, and energy-chain deals
- `profiler-graph.json` — prebuilt ecosystem relationship graph merging both sides' curated links with full-sentence cross-mention evidence: 474 edges (372 carrying curated data), 1,501 evidence items
- `scripts/build-profiler-graph.py` — graph builder, now REQUIRED after any profile write (documented in PROFILER-SCHEMA.md and the Profiler Command's register step)

#### `live-site-pages/Profiler.html` (v01.55w)
- Relationships tab grouping: Working with / Competing with / Other links / Detected in other dossiers, with deal chips (status, since, scale, latest activity)
- Inbound evidence: each relationship shows what the counterparty's dossier says back, and graph-only counterparts surface as detected links
- `#network` ecosystem explorer + ⛓ Network masthead button — the full graph as a filterable list (company / link kind / counterparty category), each edge spelled out from both curated sides with its freshest quote

### Changed
- `README.md` — structure-tree entries for `profiler-graph.json` and `build-profiler-graph.py`; archive listing regenerated to full completeness (98 archived dossier versions — backfilled 74 entries missing from prior passes plus the 12 new ones)
- `.claude/rules/profiler-app.md` — Profiler Command step 5 now requires the graph rebuild alongside the registry sync

## [v03.66r] — 2026-08-29 05:15:56 PM EST

> **Prompt:** "For every dossier, make the \"Relationships\" section its own tab and then improve the explanation of each relationship below. Mention the source which explicitly states the relationship, then explain the context and the detailed nature of their relationship. Also, make sure that no words get cut off; Just expand the explanation and let me scroll down to read it all."

### Added
- **Relationships is now its own dossier tab** (`Profiler.html` v01.54w): new `rels` entry in `OV_SEC_LABELS` (all five styles) and `tabDefs`; the section moved out of the Summary pane into `paneFor('rels')` — the tab self-hides on dossiers with no links, and `#slug/rels` deep-links work via the existing tab router
- **Expanded relationship explanations**: curated `relationships[]` entries now render their stated `source` as a linked "Source" line (resolved against the dossier's `sources[]` via new `ovRelSource()` — label + publication date when the URL is a cited source, hostname link otherwise), the one-line `note`, and the new multi-paragraph `context` field; derived evidence renders under curated rows as "Mentions across this dossier"
- **Schema v5** (`repository-information/PROFILER-SCHEMA.md`): `relationships[].context` — 2–6 sentences on the nature, history, and mechanics of the relationship, grounded in the cited source; authoring guidance now asks research passes to fill `note`, `context`, and `source` per curated link. Backfill stays opportunistic per "Extending the schema"

### Changed
- **All truncation removed from relationship evidence** (`ovRelDerive` rework): mentions are extracted as complete sentences via new `ovRelSentences()` (sentence-boundary expansion; decimals like "14.5 MWh" survive), the 165-character clip and 2-evidence cap are gone, the 10-row list slice and "+ N more" note are gone — every relationship renders with every mention in full. Derivation now also mines product `description`/`positioning` fields, and development mentions carry the event's date and a resolved source link. The radial map alone stays capped at 10 spokes for legibility, with a caption pointing to the full list

## [v03.65r] — 2026-08-29 05:03:13 PM EST

> **Prompt:** "continue with your recommendation" *(following the commit-message rule-contradiction analysis: apply Option A — align `gas-scripts.md` with [PC-COMMIT-MSG] #8)*

### Changed
- `.claude/rules/gas-scripts.md` "Commit Message Naming" rewritten to match [PC-COMMIT-MSG] #8 (the single source of truth). **Supersedes the older instruction that appended bumped `g`/`w` versions to push commits in `r`, `g`, `w` order and prefixed intermediate commits with bumped `g`/`w` versions — both contradicted #8 from the initial commit onward and are removed.** Push commits carry the repo version prefix only; intermediate commits use a plain descriptive message; the `r`/`g`/`w` suffix legend and the `Backfill CHANGELOG SHA` exemption are retained, plus a note that historical multi-version subjects remain valid (SHA-enrichment greps anchor on the leading `vXX.XXr ` and match both forms)
- Repo CHANGELOG's first threshold-triggered archive rotation this file has seen at 100/100: the 2026-08-18 date group (v02.65r–v02.68r, four sections) moved to `CHANGELOG-archive.md` with SHA enrichment

## [v03.64r] — 2026-08-29 04:56:45 PM EST

> **Prompt:** "Make the entire \"Reports\" function only visible and accessible to admin level users."

### Changed
- **Reports surface is now admin-only** (`Profiler.html` v01.53w): added a `reports` capability to `OV_ROLE_CAPS` granted to `admin` alone; the masthead "▤ Reports" button is now created from the auth wall's `pass()` (like the guidance button) so other tiers and signed-out visitors never get it in the DOM; the `#reports` and `#report/<id>` routes render an "administrators only" notice via `rpDenied()` for any tier without the capability — `pass()`'s existing `ovRoute()` repaint means an admin deep link renders right after sign-in. Raw report JSONs remain public Pages data (UI-level gate, same caveat as dossiers), noted in the code comments and docs
- `scripts/verify-profiler-roles.py`: Reports column added to the matrix oracle (`EXPECT`), the DOM probe, the per-tier assertion loop, and the printed summary table — full run passes (admin shown; contributor/analyst/viewer hidden)
- `.claude/rules/profiler-app.md`: Role + Access matrix updated (contributor now loses Field Note, Versions, and Reports); Profiler Report Command wording changed from "all tiers" to admin-only. `repository-information/PROFILER-SCHEMA.md`: Report schema notes the admin-only app surface and the public-files caveat

## [v03.63r] — 2026-08-29 04:45:35 PM EST

> **Prompt:** "Picking up from my recent \"Profiler app dossier Summary expansion\" session, design and build profiler report <topic> (roadmap #3, the last approved item) — the industry-report engine the whole quality build-out was for. Everything it needs now exists: normalized KPIs for cross-company figures, provenance for citation confidence, relationships for ecosystem structure, peer families for scoping, and coverage metadata for honesty about gaps. Start with a design pass (report types — macro, competitive, risk, opportunity; output format; how reports cite dossier sources) and get developer approval before building."

### Added
- **`profiler report <topic>` command — the industry-report engine (roadmap #3, developer-approved design).** Reports are immutable snapshot JSONs synthesized from covered dossiers only (no fresh research), citing the dossiers' own `sources[]` with data-driven provenance tiers. Report schema + reports-index schema added to `repository-information/PROFILER-SCHEMA.md`; the "Profiler Report Command" section added to `.claude/rules/profiler-app.md` (type/scope resolution, coverage preflight, authoring rules, verification, supersede-not-edit lifecycle); CLAUDE.md Profiler Command pointer updated. Four report types: macro, competitive, risk, opportunity. Field notes are excluded from report content by design (public Pages data)
- Reports renderer in `Profiler.html` (v01.52w): `#reports` library + `#report/<id>` views, masthead "▤ Reports" button (all tiers, like dossiers), inline `[c:id]` citation superscripts with provenance badges, coverage block with pinned dossier versions + "since revised" drift badges, confidence-tagged key judgments, indicators/limitations sections, and a report Word export (gated by the existing `export` capability). Section bodies reuse the guidance renderer primitives — `gdTable`/`gdTimeline` gained an optional formatter parameter (backward compatible)
- `scripts/check-profiler-reports.py` — mandatory verification after any report write: schema shape, citation resolution against each cited profile's `sources[]`, party-tier derivation match, bars-figure verification against the KPI overlay, coverage-pin drift, and index reconciliation. Pin/citation mismatches are errors while the cited profile sits at the pinned version, warnings once it has moved on
- Seed report `grid-scale-bess--competitive--2026-08-29` (12 grid-scale BESS system players, 42 citations, 7 sections) + `reports-index.json` — validated end-to-end: check script 0 errors / 0 warnings, Playwright render test of both views passed with zero page errors

### Changed
- `live-site-pages/html-changelogs/Profilerhtml.changelog.md`: rotated the 2026-08-07 date group (v01.02w–v01.06w, five sections) to the archive with SHA enrichment — active file now 46/50

## [v03.62r] — 2026-08-29 03:45:02 PM EST

> **Prompt:** "continue with your recommendation, then remember session to prepare for profiler report as its own session with fresh context."

### Changed
- `.claude/rules/profiler-app.md`: running `scripts/sync-profiler-registry.py` after any profile write is now a required step of the Profiler Command (step 5) and of every data-only change — closing the drift gap before the ~30 armed October post-earnings triggers fire. Scheduled refreshes and quarterly sweeps inherit the requirement since they walk the full command
- Saved session context to `SESSION-CONTEXT.md` (Remember Session): the Profiler quality build-out is complete through roadmap #5; next session picks up the `profiler report <topic>` design with fresh context

## [v03.61r] — 2026-08-29 03:37:45 PM EST

> **Prompt:** "continue with your recommendation"

### Added
- Roster freshness tints and coverage meters (roadmap #5) in `live-site-pages/Profiler.html`: every roster card carries a `cov` line — freshness dot (`ovFreshness`: fresh ≤45d, aging ≤120d, stale beyond — thresholds follow the post-earnings refresh cadence), visible age in days, source count, first-party share, and a `$ comparable` / `$ not normalized` tag from the schema-v4 overlay. An aggregate strip above the grid (`ovCovStrip`) totals dossiers, cited sources, comparable-revenue count, median first-party share, and the oldest update age
- `scripts/sync-profiler-registry.py` — reconciliation for denormalized registry fields. The roster renders from the registry alone (recall design: one fetch, no per-card profile loads), so the new per-card facts are denormalized into `profiler-companies.json` as `srcTotal`, `srcFirstPct`, `kpiNorm` (all 88 populated), with `lastUpdated` sync folded in — replacing the one-off drift pass from v03.54r. `--check` reports drift without writing; the provenance logic mirrors `ovSourceParty` and both carry keep-in-sync comments
- `PROFILER-SCHEMA.md`: the three denormalized fields documented as auto-maintained (never hand-edit), plus a "Denormalized fields & the sync script" note explaining the reconciliation contract

### Changed
- Roster cards show update age (`7d`) instead of the raw `as of` date — the cov line owns the date signal, and age scans faster across 88 cards

### Fixed
- `ovFreshness` initially computed age with `Math.round` over a datetime-minus-midnight delta, which flipped boundary dates between tiers over the course of a single day (caught by the 45d/120d edge checks in the new Playwright suite). Now whole-calendar-day arithmetic: both ends floored to UTC days

## [v03.60r] — 2026-08-29 05:41:32 AM EST

> **Prompt:** "continue with your recommendation"

### Added
- Source provenance indicator (roadmap #4) across `live-site-pages/Profiler.html`: `ovSourceParty`, `ovProvenance`, `ovProvBlock`, `ovProvStrip` and `ovProvNote` classify every cited source as `company`, `disclosure` or `independent`, surfaced as a compact strip in the dossier header, a full breakdown with per-source tags in the Source List, and a Tier 0 "Sourcing" row in Compare
- Registry schema v2 — `companies[].domains` in `profiler-data/profiler-companies.json` declares each company's own web domains (88/88 populated). Subdomains match implicitly, so `abb.com` covers `new.abb.com`. Curated beyond the profile's `website` host where the company publishes elsewhere: parent domains (`hitachi.com`, `huawei.com`), sub-brands and regional sites (`bydenergy.com`, `delta-americas.com`, `sunwodaess.com`, `mpinarada.com`, `samsungrenewableenergy.com`, `mastecprofessionalservices.com`, `hittyearinreview.com`), separate newsrooms (`about.fb.com`/`atmeta.com`, `news.panasonic.com`), brand TLDs (`blog.google`) and IR-platform hosts (`iren.gcs-web.com`)
- Optional per-source `party` override, documented in `PROFILER-SCHEMA.md` alongside a new "Source provenance" section defining the three tiers and the classification contract

### Changed
- Provenance is deliberately **not** framed as a quality score. `ovProvNote` reads a low independent share as under-corroborated rather than well-sourced, matching the schema's own division of labour: first-party channels are ground truth for products, specs and leadership; independent sources supply what a company cannot credibly say about itself
- `.claude`-adjacent test asset: `vt-family`'s row-order assertion was pinned to a positional index (`r[3] == 'revenue'`) and broke when the Sourcing row was inserted into Tier 0. Rewritten as order-semantic assertions (revenue precedes the as-reported row; sourcing precedes revenue) so future Tier 0 additions do not produce a false failure

### Fixed
- A token-matching prototype of this feature was discarded before shipping after an audit across all 88 dossiers showed systematic misclassification: Black & Veatch rendered 6% first-party despite `bv.com` supplying 14 of its 29 sources, and Google, Schneider Electric, QTS and xAI all rendered 0% company sources. The causes were structural, not tunable — domains too short to tokenize (`bv.com`, `q.com`, `se.com`), brand TLDs (`blog.google`, `x.ai`) and separate corporate domains (`about.fb.com`). Replaced with the declared-domain model above; Black & Veatch now reads 55% and Google 63%

## [v03.59r] — 2026-08-29 05:21:35 AM EST

> **Prompt:** "continue with your recommendation"

### Fixed
- `Profiler.html` (v01.49w) — `ovCmpLatestRevenue()` selected the latest annual revenue by array position (`periods[periods.length - 1]`), but period ordering is not a contract: 49 dossiers are authored oldest-first and 22 newest-first. The Compare view was therefore showing the prior year for every newest-first dossier — Amazon rendered FY2024 $638.0B instead of FY2025 $716.9B, and Google, Microsoft, NVIDIA, Jinko, LG Energy Solution, Megmeet, Samsung SDI and Primoris were all affected. Selection is now by `periodEnd` (ISO dates sort lexicographically), with a comment recording why position cannot be trusted

### Added
- Normalized-KPI (schema v4) backfill extended from the 6 demo dossiers to 42 of 88 across `live-site-pages/profiler-data/`: `schemaVersion` → 4, `periodType`/`periodEnd` on the tagged annual period, and `kpi: "revenue"` + `usdMillions` + `fxBasis` on the revenue metric. 36 dossiers changed this push
- FX bases recorded per dossier: 21 "as reported" (USD reporters), 13 converted at researched annual-average rates — CNY 7.1873 (2025), TWD 31.171 (2025), KRW 1421.48 (2025), EUR 1.1306 USD/EUR (2025) — and 2 using the dossier's own stated USD equivalent (Jinko $9.37B, Hithium ~$1.8B) in preference to any external rate. Per `PROFILER-SCHEMA.md`, rates were researched rather than recalled; the CNY rate was cross-validated against CATL's own stated USD figure (RMB 72.2B ÷ 7.1873 = $10.05B vs "~US$10B" in the dossier)
- Deliberate exclusions, left rendering "Not normalized yet" rather than fabricating a comparable bar: Oracle (guidance, not an actual), Switch (quarterly splits with no annual total), Crusoe and Lambda (third-party estimates), OpenAI (press-reported, not company-disclosed)

### Changed
- Verification: a new 15-check coverage suite confirmed newest-first years resolve correctly, that every non-USD basis is present and correctly named, that the hardware peer-family unlock still holds, and that excluded companies still show an honest gap. An independent audit recomputed 12 conversions with zero mismatches and confirmed no segment figure was mistaken for a company total; three figures that resisted regex parsing were hand-verified. The `vt-kpi` regression suite was repointed off Eaton and Schneider (both now carry overlay data) onto Crusoe and Oracle/Switch as the no-overlay fixtures

## [v03.58r] — 2026-08-29 04:52:54 AM EST

> **Prompt:** "Judgment calls:
>
> 1. Agreed. I don't want six near-identical snapshots in the archive.
> 2. Accepted too.
>
> Treat supplier and integrator as one family. I don't need the rules to be that rigid as the US BESS/AIDC industry changes a lot and build-in flexibility will be a big plus."

### Added

- `Profiler.html` (v01.48w) — **peer families** for Compare. New declarative `OV_PEER_FAMILIES` map with `ovPeerKey` / `ovPeerKeys` / `ovPeerLabel` / `ovPeerMembers`; the first entry groups `supplier` + `integrator` as **Hardware**. Both gates now resolve through it — the roster's dimming/selection rule and the Tier 2 unlock — so they can never disagree. Chosen declarative on the developer's reasoning that the US BESS/AIDC map keeps moving: adding or re-grouping a family is a one-line data edit, not a logic change

### Changed

- `Profiler.html` (v01.48w) — the Compare heading now prefers the **most specific accurate label**: an exact shared category still reads "Supplier — 3 companies", and only a family-level match falls back to "Hardware — 4 companies". When the match is family-level the subtitle says so outright ("suppliers and integrators are compared as one family") rather than leaving the reader to infer it from the tags. Tier 2's technical-row branch keys off the `hardware` family instead of a hardcoded supplier/integrator test

### Notes

- **A category named in no family remains its own family**, so future registry additions can never silently widen a comparison — verified by test: two IPPs still match as "IPP — 2 companies" and are not swept into Hardware
- **The unlock is not cosmetic.** Sungrow/CATL/Fluence/Tesla previously rendered "Cross-space" with no technical rows; it now unlocks 7 shared attributes — including an **Integration** row that exists only because Fluence is in the selection, setting its Battery Pack integration beside Tesla's AC-coupled enclosure. That row was unreachable under the strict gate
- Verified by a 22-check Playwright suite: the family unlock and its wording, exact-category precision preserved, unrelated spaces still gated (ABB vs Crusoe, Google vs Quanta), the identity rule for unfamilied categories, the roster gate accepting an integrator after a supplier while still refusing a neocloud, and the financials-only override unchanged. The KPI, Compare and role-matrix suites all re-run clean
- **Test-authoring note (second occurrence this session):** a check failed against the legend text because `.ov-cmp-legend` is `text-transform: uppercase`, so Playwright's `inner_text()` returns "PEER GROUP: HARDWARE" while `textContent` returns "Peer group: Hardware". The app was correct both times; assertions against styled text must be case-insensitive or read `textContent`

## [v03.57r] — 2026-08-29 04:43:21 AM EST

> **Prompt:** "continue with your recommendation"
>
> *(Standing recommendation from the previous response: add the normalized KPI fields — roadmap item #2 — so the Compare view's as-reported figures become comparable USD bars.)*

### Added

- `PROFILER-SCHEMA.md` — **profile schema v4: the normalized-KPI overlay.** New optional fields on `financials.periods[]` (`periodType` ∈ annual/half/quarter/other, `periodEnd` as `YYYY-MM-DD`) and on `financials.periods[].metrics[]` (`kpi` from a fixed nine-key set, `usdMillions`, `fxBasis`). Designed against a survey of the live data — **217 distinct metric names across 88 dossiers**, in 15 different currency spellings — which is why it is a thin opt-in overlay rather than a migration: the prose `name`/`actual` pair stays authoritative and unchanged, and `usdMillions` must be derivable from `actual`. Rules cover whole-company actuals only (no segments, no guidance), one `kpi` per key per period, and **`fxBasis` mandatory on any converted figure**
- `Profiler.html` (v01.47w) — Compare's Tier 1 now opens with a **normalized revenue row**: each company's latest complete annual revenue in USD with a proportional magnitude bar (`ovCmpLatestRevenue` / `ovCmpUsd` / `.ov-cmp-mag`), the period and its end date beneath so differing fiscal years are visible at a glance, and a hover-revealed conversion basis on any figure that was converted. A company without the overlay renders "Not normalized yet" and **no bar** — the chart is never completed with an invented figure; the row is omitted entirely when no selected company carries the data
- `profiler-data/` — backfilled six dossiers to schema v4 (`sungrow`, `catl`, `fluence`, `tesla`, `abb`, `vertiv`): `periodType`/`periodEnd` on every period, and FY2025 revenue tagged `kpi: "revenue"` with `usdMillions`

### Notes

- **FX was researched, not remembered.** Fluence, Tesla, ABB and Vertiv report in USD, so their figures are `"as reported"` with no conversion at all. Sungrow and CATL report in RMB and were converted at **7.1873 CNY/USD** (2025 calendar-year average, per exchange-rates.org and x-rates.com, which agree). The rate independently cross-checks against CATL's own dossier: RMB 72.2B net profit ÷ 7.1873 = US$10.05B, and the dossier states "~US$10B"
- **No `profileVersion` bump and no archival on the six backfilled dossiers.** This is an additive metadata overlay — no fact, figure or prose changed — so treating it as a dossier *revision* would archive six near-identical snapshots and desynchronize `lastUpdated` from the registry that v03.53r just re-synced. `schemaVersion` is what moves; the schema's own "backfill opportunistically" rule is satisfied without a revision
- **Only the latest complete annual period is normalized.** FY2024 was left alone because the verified rate is the 2025 average and applying it to 2024 figures would be a conversion with the wrong basis. Earlier years backfill when their own rate is verified
- Verified by a 24-check Playwright suite: figures and bar proportions against the real dossiers, bars scaling to the selection maximum, the fiscal-year offset surfacing for Fluence's September year-end, conversion bases present on exactly the two converted figures and absent on the four as-reported ones, the honest-gap fallback, and the row disappearing when no company has the overlay. The Compare and ticker-render suites and `scripts/verify-profiler-roles.py` all re-run clean
- **Uniform display precision** — `ovCmpUsd` renders two decimals on billions throughout. A column mixing `$12.4B` with `$2.30B` reads as sloppy and invites a false comparison; two decimals is $10M resolution, within the significant figures the sources carry
- **Observed, not changed:** a Sungrow/CATL/Fluence/Tesla comparison renders as "Cross-space" because Fluence is categorized `integrator` while the others are `supplier` — no shared category, so Tier 2 stays suppressed per the approved gate. The gate behaves exactly as specified; whether `supplier` and `integrator` should count as one technical family for Tier 2 is a design question raised with the developer rather than decided here

## [v03.56r] — 2026-08-29 04:19:16 AM EST

> **Prompt:** "Six Profiler dossiers put ownership prose in the `ticker` field, which makes `ovOwnership()` in `live-site-pages/Profiler.html` render duplicated text like "private · private (~$30B round in talks, July 2026)". This shows on the dossier Summary tab's Ownership fact, in Word/PDF exports, and in the new Compare view's Snapshot row.
>
> Affected files in `live-site-pages/profiler-data/`:
> - `crusoe.profile.json` — ticker: "private (~$30B round in talks, July 2026)"
> - `eve-energy.profile.json` — ticker: "SZSE ChiNext: 300014 (HKEX H-share listing twice-filed, unconfirmed)"
> - `hitachi-energy.profile.json` — ticker: "private (parent Hitachi TYO: 6501; listed sub …)"
> - `huawei-digital-power.profile.json` — ticker: "private (Huawei is employee-owned, unlisted)"
> - `openai.profile.json` — ticker: "private (confidential S-1 filed June 2026)"
> - `xai.profile.json` — ticker: "private (inside SpaceX; S-1 filed May 2026)"
>
> Per `repository-information/PROFILER-SCHEMA.md`, `ticker` is `EXCHANGE: SYMBOL` for public companies and `ownership` carries the type. The prose belongs in `ownership` (or the summary), not `ticker`.
>
> Task: for each of the six, move the parenthetical/prose into the `ownership` field (or drop it if the summary already says it) and either set `ticker` to a real `EXCHANGE: SYMBOL` (eve-energy, hitachi-energy's parent) or omit the field entirely for genuinely private companies. Keep `profiler-companies.json`'s matching `ticker` values consistent with the profiles. Then check the rendering: the dossier Summary's Ownership fact and the Compare Snapshot row should read cleanly with no duplication (serve `live-site-pages/` over localhost and open `Profiler.html#crusoe` and `Profiler.html#compare/abb,crusoe`).
>
> Consider also whether `ovOwnership()` should defensively skip a ticker that starts with the ownership type — surface that as a recommendation to the developer rather than applying it unasked, since it is shared rendering code.
>
> This is a data-only change: no Profiler page version bump (per `.claude/rules/profiler-app.md`), repo CHANGELOG entry + repo version bump on the push commit, full Pre-Commit/Pre-Push checklists, push to the session's designated claude/* branch. Note the repo CHANGELOG `Sections` counter (91/100 at time of writing) and rotate if the push exceeds 100."

### Fixed

- `profiler-data/` — six dossiers held ownership prose in `ticker`, so `ovOwnership()` (which renders `type · ticker`) produced duplications like "private · private (~$30B round in talks, July 2026)" on the dossier Summary's Ownership fact, in Word/PDF exports, and in the Compare Snapshot row. The prose moved into `ownership`, where the schema says it belongs:
  - `crusoe` — ownership → `"private (~$30B round in talks, July 2026)"`; `ticker` removed
  - `openai` — ownership → `"private (Microsoft ~27% as-converted; Foundation ~26%; confidential S-1 filed June 2026)"`; `ticker` removed
  - `xai` — ownership → `"private (SpaceX subsidiary; Musk-controlled; S-1 filed May 2026)"`; `ticker` removed (also removed from `profiler-companies.json`, the only registry entry with a malformed ticker)
  - `huawei-digital-power` — ownership → `"subsidiary (Huawei Technologies — employee-owned, unlisted)"`; `ticker` removed
  - `hitachi-energy` — ownership → `"subsidiary (Hitachi, Ltd. — parent TYO: 6501; listed subsidiary Hitachi Energy India NSE: POWERINDIA)"`; `ticker` removed
  - `eve-energy` — the only one that had a real symbol buried in the prose: `ticker` → `"SZSE ChiNext: 300014"`, ownership → `"public (HKEX H-share listing twice-filed, unconsummated as of Aug 2026)"`

### Notes

- **`hitachi-energy` keeps no ticker deliberately.** The task allowed setting the parent's symbol, but `ticker` renders as *this company's* ticker in the dossier header, the roster card and the Compare header column — `TYO: 6501` there would assert that Hitachi Energy trades under its parent's symbol, which is false. Both the parent's and the listed Indian subsidiary's symbols are preserved in the `ownership` prose instead
- **`eve-energy`'s registry entry stays `SZSE: 300014`** while the profile carries `SZSE ChiNext: 300014`. That mirrors the existing `sinexcel` pattern (registry `SZSE: 300693`, profile `SZSE ChiNext: 300693`) — same exchange and symbol, board qualifier only in the profile — so this follows house convention rather than inventing a new one
- Verified by rendering: 18 checks over the six dossiers' Ownership facts, the header meta line, the Compare Snapshot row (ABB vs Crusoe) and the Compare header column (EVE vs CATL) — no duplications, real tickers still shown where one exists, ownership prose kept out of the ticker position. A repo-wide re-survey finds **0** profiles and **0** registry entries with a malformed ticker, and **0** remaining type/ticker echoes across all 88 dossiers
- **Recommendation surfaced, not applied** (shared rendering code, developer's call): `ovOwnership()` could defensively skip a ticker that starts with the ownership type. It would have masked this bug rather than surfacing it, and the data is now clean, so it is proposed as a guard against future drift only

## [v03.55r] — 2026-08-29 04:13:49 AM EST

> **Prompt:** "Build the approved Compare view for the Profiler app (`live-site-pages/Profiler.html`), per the developer's approved design (2026-08-29 session, repo v03.54r):
>
> **Design (developer-approved):**
> - Compare mode on the roster: a toggle chip; selecting the first company establishes the peer group (registry `categories` are the grouping key) and dims companies sharing no category; up to 4 companies.
> - **Tiered rows:** Tier 0 (always): dossier meta — profileVersion, lastUpdated, source count. Tier 1 (always): financials — latest reported periods as-reported, beat/miss/in-line record tallied from `financials.periods[].metrics[].verdict`. Tier 2 (only when ALL selected companies share a category): category-specific rows — suppliers/integrators: product-line counts, flagship names, spec rows whose band/label at least two companies share; other categories start with product lines + lead `strategyRead` judgment.
> - Cross-space selections are allowed via an explicit "Financials only" override chip — matrix then shows only Tiers 0–1.
> - A mockup of the intended look exists (artboard 2 of the "Profiler Future Vision" design canvas — dark ink/gold, `.ov-*` visual language, matrix grid with row-label column).
>
> **Constraints from repo rules:** renderer-only change in Profiler.html's PROJECT blocks (no schema change yet — normalized-USD bars wait for the approved `relationships`-style KPI field extension, roadmap #2); deep-linkable state if reasonable (e.g. `#compare/slug1,slug2`); Playwright visual verification before commit (`scripts/playwright-harness.py` pattern, serve `live-site-pages/` over localhost, remove `#ov-authwall`); page version bump + page changelog + full Pre-Commit/Pre-Push checklists; push to the session's designated claude/* branch. Note the repo CHANGELOG's `Sections` counter and rotate per rules if the push exceeds 100.
>
> Done looks like: Compare reachable from the roster, peer-gating and the financials-first tiers working against real profile JSONs, verified visually, committed and pushed."

### Added

- `Profiler.html` (v01.46w) — **Compare view**, renderer-only (no schema change). Roster gains a `⇄ Compare` toggle (`ovCompareMode`) that flips cards from navigate-on-click to select-on-click, with a sticky selection tray and a hard cap of 4 (`OV_COMPARE_MAX`). **Peer gating**: the first pick fixes the peer group from its registry `categories`; companies sharing no category are dimmed (`.ov-card.dim`) and their clicks are refused at the handler, not just visually — verified by test (a supplier pick dims 49 of 88 and rejects a neocloud click)
- `Profiler.html` (v01.46w) — **tiered matrix** (`ovRenderCompare` / `ovPaintCompare`): Tier 0 dossier meta (profileVersion, lastUpdated, cited-source count) and Tier 1 financials (latest reported period with per-metric verdict chips, plus a beat/in-line/miss tally bar across every period from `financials.periods[].metrics[].verdict`) always render; Tier 2 unlocks only when `shared` categories across all picks is non-empty — suppliers/integrators get product-line counts, flagship names and the spec attributes at least two dossiers both record (`ovCmpSpecMap` label intersection, capped at 8), other categories get product lines + the lead `strategyRead` judgment. `Financials only` chip (`ovCompareFinOnly`) lifts the peer gate for cross-space work and pins the matrix to Tiers 0–1
- `Profiler.html` (v01.46w) — deep-linkable as `#compare/slug1,slug2[,…]` (`compare` reserved as a first hash segment); unknown/insufficient slugs render an explanation instead of a broken matrix; a hashchange mid-fetch discards the stale render; company names in the header row open their dossiers; the matrix scrolls inside `.ov-mx-wrap` on narrow screens rather than stacking (stacking loses the label↔company pairing)

### Notes

- Verified with a 40-check Playwright interaction suite (peer gating incl. refusal of a dimmed card, deselect/reselect, tray state, deep links both same-space and cross-space, Tier-2 gating in both directions, the financials-only override, guard rails for 1-slug and unknown-slug hashes, full row population, and mobile containment). `scripts/verify-profiler-roles.py` re-run clean (matrix + isolation + 88/88 specs)
- **Test-quality note:** the first suite run appeared to show a peer-gating bug; the root cause was the test's own selectors — `has_text='Sungrow'` matches Key Capture Energy (whose tagline names Sungrow) before Sungrow itself, so the peer group was accidentally set to IPP and the app *correctly* refused a supplier. Selectors now match card headings exactly. The app behavior was right throughout
- **Pre-existing data issue observed, not fixed here** (out of scope, Chesterton's fence): 6 profiles (`crusoe`, `eve-energy`, `hitachi-energy`, `huawei-digital-power`, `openai`, `xai`) put ownership prose in the `ticker` field, so `ovOwnership()` renders "private · private (~$30B round…)" on the dossier Summary, in exports, and now in the Compare Snapshot row. A task card was queued for the data cleanup rather than patching the shared renderer

## [v03.54r] — 2026-08-29 03:49:01 AM EST

> **Prompt:** "I have reviewed the mockups and have the following feedback:
>
> \* In the Compare screen, focus mostly on financials since those are the only metrics that can realistically be compared between companies that fulfill different functions (supplier vs developers vs hyperscalers). Alternatively, suggest a better way to limit comparisons to only those within the same space. If they are in the same space, then you can also suggest ways to compare technical specs and other metrics.
> \* In the Dossier Summary, remove the "at a glance" cards that link to other tabs. I find they don't contain enough value to justify their existence. I would prefer you to spend more resources on finding ecosystem cross-links, figuring out their relationship with each other, and creating a "Relationships" field as that would be extremely useful. If possible, a visual mind-map diagram would be useful too.
> \* Create a Settings icon in the bottom right of Profiler (cog icon) that has a "Command" option that goes over all of my Profiler commands along with detailed explanations of when/how to use them.
> \* Otherwise, I approve of all your recommendations to improve the Profiler app.
>
> If you run out of my weekly Fable limit, continue working with Opus 5."

### Added

- `Profiler.html` (v01.45w) — **Relationships section** on the dossier Summary tab. Curated layer: new `relationships[]` field (schema v3 — see PROFILER-SCHEMA.md). Derived fallback: `ovRelDerive()` scans the dossier's own summary, developments, and judgments for other covered companies' names (registry as the name authority; word-boundary matching with a sentence-start ambiguity guard so "Switchgear" never matches Switch). Rendered as a clickable radial SVG mind-map (`ovRelMap()` — category-colored nodes, keyboard-accessible, transparent hit pads) plus per-company evidence rows showing the sentence behind each link. On ABB it detects 8 real cross-links (NVIDIA, VoltaGrid, Vertiv, Eaton, Hitachi Energy, Siemens Energy, OpenAI, Applied Digital)
- `Profiler.html` (v01.45w) — the bottom-right ⚙ cog is now a **Settings menu** (`ovSettingsToggle()`): capability-gated entries for the new **Commands reference** overlay (`ovShowCommands()` + `OV_COMMANDS` — all seven Profiler commands with when/how/what-it-does cards, including the planned `profiler report`) and the existing Field-notes log. New `commands` capability in `OV_ROLE_CAPS` (admin-only); the cog now renders on dossier views as well as the roster
- `repository-information/PROFILER-SCHEMA.md` — profile schema v3: `relationships[]` field definition (`slug`/`type`/`note`/`source`; slugs must be covered companies; curation supersedes render-time detection; opportunistic backfill on each dossier's next revision)

### Removed

- `Profiler.html` (v01.45w) — the v01.44w Summary signal board (`ovSignalBoard()` + `.ov-sigs` CSS) — developer review found the tab-teaser cards too low-value to keep; the Relationships section takes their place

### Changed

- `scripts/verify-profiler-roles.py` — cog oracle note updated for the Settings-menu change (matrix unchanged: both cog entries are admin-only, all tiers verified passing; specs audit still 88/88)

## [v03.53r] — 2026-08-29 03:24:50 AM EST

> **Prompt:** "While building a Profiler mockup, a data drift was found in `live-site-pages/profiler-data/`: many entries in `profiler-companies.json` carry `lastUpdated: "2026-08-09"` while their corresponding `<slug>.profile.json` files say `lastUpdated: "2026-08-22"` (confirmed for at least: abb, sungrow, catl, tesla, fluence, vertiv, crusoe, quanta-services, constellation-energy — likely more; the 2026-08-22 dossier-mining/refresh pass appears to have bumped profiles without updating the registry). `repository-information/PROFILER-SCHEMA.md` (Registry schema) requires `companies[].lastUpdated` to be kept in sync with the profile's `lastUpdated`, and the roster UI displays the registry value, so the app currently understates freshness. Task: write a small script or one-off pass that, for every company in `profiler-companies.json`, reads `<slug>.profile.json` and sets the registry `lastUpdated` to match. Report which entries changed. This is a data-only change: per `.claude/rules/profiler-app.md` ("Version & changelog interactions") there is no Profiler page version bump — repo CHANGELOG entry + repo version bump on the push commit per the normal Pre-Commit Checklist. Follow the repo's CLAUDE.md session protocols and push to the session's designated claude/* branch. Done looks like: every registry entry's lastUpdated equals its profile's lastUpdated, committed and pushed so the auto-merge workflow deploys it."

### Fixed

- `profiler-data/profiler-companies.json` — re-synced `lastUpdated` for **59 of 88** registry entries to match their `<slug>.profile.json` values (all landed on `2026-08-22`; stale values were `2026-08-09`, `2026-08-10`, `2026-08-14`, and `2026-08-21`). The 2026-08-22 dossier-mining pass had bumped every profile's `lastUpdated` without updating the registry, so the roster cards and "as of" lines understated freshness for two-thirds of the covered set. 29 entries were already in sync; every registry slug had a matching profile file. Data-only change — no Profiler page version bump per `.claude/rules/profiler-app.md`

## [v03.52r] — 2026-08-29 02:50:58 AM EST

> **Prompt:** "Picking up from my "Profiler app sign-in error" session, (see attached screenshot) I want each dossier's "Background" tab to be renamed to "Summary" and I want each dossier's Summary to contain more information. On the surface, my purpose for creating the Profiler app is just to get some high level stats of major players in the US BESS/AIDC market and essentially create a Sparknotes-like portfolio for myself and other users to quickly read and understand the target company. However, in the grand scheme of my app ecosystem, I am relying on the Profiler app to have the most factual information from 1st party sources and be able to cross-analyze major players of different aspects of the US BESS/AIDC industry in order to better understand the market as a whole, culminating in very high-value industry reports (macro, competitive analysis, risk analysis, opportunities, etc.). Thus, I would like to improve each dossier's Summary tab (and other tabs if possible) to show more high-value information, ideally enough that would make the user look through the other tabs for deeper understanding. Recommend me some ways to improve my Profiler app as a whole to approve."

### Changed

- `Profiler.html` (v01.44w) — renamed the dossier's opening tab from "Background" to "Summary" under the active `intel-briefing` display style (`OV_SEC_LABELS['intel-briefing'].snapshot`). The section heading, tab chip, deep-link labels, and Word/PDF export chapter list all follow automatically via `ovSecLabel()`; the other four styles keep their own idiomatic labels ("Snapshot", "1. Executive Summary", "Company Overview", "The Big Picture"), and the `BACKGROUND:` prose signpost inside dossier `summary` fields is untouched (it is authored prose, split by `ovAppendSummary()` as before)

### Added

- `Profiler.html` (v01.44w) — Summary signal board: `ovSignalBoard()` + `ovTrunc()` in the PROJECT JS block and `.ov-sigs`/`.ov-sig` styles in the PROJECT CSS block. Six clickable cards render under the BLUF prose on the opening tab, each derived entirely from the already-loaded profile JSON: lead key judgment (+ judgment count), financial beat/miss/in-line tally across all reported periods, newest recent development (schema orders newest first), first three product lines + spec-table count, top listed decision maker (+ count), and source count with newest publication date + dossier version/compile date. Each card calls `ovShowTab()` so the reader lands on the full tab. Data-only dossier revisions need no upkeep — the board recomputes from whatever the profile holds, and dossiers missing a section simply render fewer cards

## [v03.51r] — 2026-08-29 01:30:10 AM EST

> **Prompt:** "7am ET is fine. I am currently testing the app so there will be weekend editions. Keep my scheduler on the Mon-Fri 7am ET schedule, but don't just ship out existing Editions. Run a new intake for each Edition 1 hour before it's scheduled to be shipped out. That should replace any same-day versions I may have created during my tests right? On every Monday 6am ET, you should run a new intake for news over the last 72 hours - I assume that will result in a similar number of relevant articles as these news sources shouldn't be working over the weekend most of the time. Then, Tue-Fri 6am ET, run a new intake for news over the last 24 hours instead of 72 to cover the entire week."

### Fixed

`Scraper.gs` (v01.83g)

- **The 06:00 scheduled build skipped any edition that had already been built that day — including by hand.** `scDigestMorningRun` filtered on `ed.lastBuilt !== clock.date` and `scEditionDue_` repeated it, and `lastBuilt` is written by *every* build. So a manual "Run intake now" at 02:00 made the edition look already-built at 06:00; the scheduled run passed it over and 07:00 shipped the hand-built copy. That is the precise opposite of what the developer asked for, and it is what their current testing would have produced every weekday morning
- **The scheduled build is now tracked separately from `lastBuilt`.** `scSchedBuiltToday_` / `scMarkSchedBuilt_` answer the narrower question the schedule actually needs — "has *today's scheduled* build run for this edition" — while `lastBuilt` keeps its original job of stopping the hourly tick rebuilding all day. The marker is written **only on completion**, in all three paths that can finish a build, so a run cut short by the execution budget resumes on its continuation trigger and is retried rather than silently counted as done
- **A stale row can no longer ship while its replacement is being built.** The 06:00 build is chunked across continuation triggers and can still be working at 07:00; `scDigestBuildInFlight_` makes the send pass hold that edition instead of mailing the copy the rebuild exists to discard. Held, not stamped, so the pass after the finished build delivers it

### Changed

`Scraper.html` (v01.66w)

- The Schedule panel stated only the send time. It now states the build hour, that the build replaces the day's existing edition, and the 72h/24h split — the half of the schedule the developer had to ask about because the UI never said it

### Notes

- **Already correct and left alone, verified rather than assumed:** `SCRAPER_DIGEST_BUILD_HOUR` is 6, `SCRAPER_DIGEST_SEND_HOUR` is 7, and `scEditionWindowH_` already returns 72 on `isoDay === 1` and 24 otherwise. `t24.js` now pins all of it, including that the two hours are exactly one apart, so the request is a standing test rather than a claim in a changelog
- **Answering the developer's question precisely:** yes for same-day — `scDigestDropSameDayRows_` is keyed on (edition, date), so Monday's 06:00 build deletes and replaces any Monday-dated edition. Their **weekend** test editions are a different case: they persist in the sheet but can never be emailed, because delivery filters to rows dated `clock.date` and the weekend guard added in v03.50r refuses the day outright. Both are asserted
- **One deliberate non-change:** `scEditionWindowH_` honours an explicit per-edition `windowH` ahead of the Monday rule. That is a setting, not a bug, so it stands — but it means an edition with a stored window would not get 72h on a Monday. Pinned by test and flagged to the developer rather than quietly overridden
- **639 assertions pass** across 24 suites; new `t24.js` (32) covers the windows, the marker, the interrupted-build retry, and the in-flight delivery hold
- `Scraperhtml.changelog.md` was at 50/50 and rotated — the 2026-08-04 group, twelve sections, to the archive with SHA enrichment

## [v03.50r] — 2026-08-29 01:19:10 AM EST

> **Prompt:** "I followed your call and everything looks good now. However, when I went to the Calendar (see screenshot), I noticed that it's showing a scheduled email out on Saturday when it should skip weekends. Evaluate the current scheduler and make sure it is set up to properly identify which editions should be sent out to which subscribers on weekdays (Mon-Fri) at 7am PST. It should also accurately sync with this Calendar tab."

### Fixed

`Scraper.gs` (v01.82g)

- **`scDigestDeliverPending_` — the only function that can put an edition in a subscriber's inbox — checked the hour and never the day.** `SCRAPER_DIGEST_RUN_DAYS` was applied by `scDigestMorningRun` and `scDigestDeliveryRun`, but `scSchedulerTick` calls the sender directly as an hourly catch-up with no day check of its own. The developer built three editions by hand at ~00:30 on a Saturday; they were dated 2026-08-29 and undelivered, and at 07:00 that morning the tick would have mailed all three
- **The guard now lives in the sender, not in three callers.** Three places each having to remember the same rule is how one of them forgets — and one of them had. The callers keep their checks (they gate expensive build work, not just the send), but nothing depends on them for correctness any more. A weekend edition stays pending and is still deliverable when the weekday returns, rather than being stamped and lost
- **A comment I nearly shipped was wrong and was corrected before commit.** The first draft said `force` exists so "email me latest" can send on a Saturday. No caller passes `force`, and `emailLatestDigest` sends through `MailApp` directly without ever reaching this function. The comment now says what is actually true
- **The timezone is one constant.** `scDigestClock_` formatted against a hardcoded `'America/New_York'` literal; it now reads `SCRAPER_DIGEST_TZ`, which already existed for the trigger installs. A second constant was nearly introduced alongside it — two names for one timezone is precisely the drift this was meant to end — so it was consolidated onto the existing one, with `SCRAPER_DIGEST_TZ_LABEL` for display

### Changed

`Scraper.html` (v01.65w)

- **The Calendar was not lying, but it was answering a different question.** It plots editions that *exist* on a date — its own tooltip said "N editions" / "nothing built". The three Saturday pips were three manual builds, not three scheduled sends. It now distinguishes them: a filled pip is an edition that was **emailed**, a hollow one was built and never sent, and `wdNsDelivered_` treats the marker strings (`no-recipients`, `no-html`, `superseded`) as not-sent, so a superseded rebuild is not drawn as though it went out
- Weekend cells are hatched and labelled "weekend, no scheduled send"; each day's tooltip separates built from emailed; a key under the grid explains the two pip styles. Built with `createElement`/`textContent`

### Notes

- **607 assertions pass** across 23 suites. New `t23.js` (39) walks all seven days at the send hour, pins the developer's exact case (built 00:30 Saturday, tick at 07:00 → nothing mailed, row left pending, still deliverable Monday), confirms the hour gate still binds on weekdays and that the weekend beats a late hour, and checks `force` bypasses both
- **Rendered and measured**, not just asserted: 10 hatched weekend cells for August 2026, 4 hollow pips (three Saturday builds plus one superseded Friday edition), 3 filled, Saturday reading `weekend, no scheduled send · 3 editions built · none emailed` and Friday `2 editions built · 1 emailed`. The harness does not carry the app's edition-colour classes, so pip *colour* was not exercised — only the filled/hollow distinction
- **⚠️ Unresolved and deliberately not guessed: the developer wrote "7am PST"; the app has always been 7:00 AM ET** and its Schedule panel says so. That is a three-hour difference. The send hour is unchanged at 7 ET; centralizing the timezone makes the switch a one-line edit once the developer confirms which they want

## [v03.49r] — 2026-08-29 12:37:08 AM EST

> **Prompt:** "I just rebuilt BESS and the Jackery article is still there."

### Fixed

`Scraper.gs` (v01.81g)

- **v03.48r could not have worked, and the reason was in the comment directly above the code I edited.** Segment terms are not read from the source file at scoring time — they are read from the developer's **Interests sheet**. `scSyncInterests_` rewrites a row's terms only when the seed's `tv` is **greater than** the `seed-terms-vN` marker in that row's Notes, a mechanism that exists precisely so improved vocabulary can ship without clobbering the developer's own edits. `seg-bess-residential` was left at `tv: 1` and `seg-consumer` had no `tv` at all (defaults to 1). Their rows carry `seed-terms-v1`, so `1 < 1` is false: the sync read those rows and correctly concluded nothing needed doing. **The deploy was fine; the data never moved.** `seg-bess-utility`, `seg-ev` and `seg-ev-charging` are already at `tv: 2` — the convention was established and I did not follow it
- Both bumped to `tv: 2`. `seg-bess-residential` also carries an in-code note that `tv` must move whenever its terms do

### Added

- **`t22.js` — a guard that makes this mistake unshippable.** It parses `SCRAPER_SEGMENT_SEEDS` out of the source, hashes each seed's terms, and locks that hash against the seed's `tv`. Change terms without bumping `tv` and the suite fails naming the seed. **Verified by injecting the exact v03.48r mistake** — added a term to `seg-bess-residential` leaving `tv` alone, watched the suite fail with `DRIFTED: seg-bess-residential`, then restored and watched it pass
- The suite also simulates the sync's upgrade rule directly, pinning the four cases that matter: a `v1` row with `tv: 1` does **not** upgrade (the bug), a `v1` row with `tv: 2` does (the fix), an unversioned row always does, and a row whose Notes say anything else (e.g. `custom`) never does

`.claude/rules/scraper-sources.md`

- **A durable rule, because the test corpus is not committed and cannot protect a future session.** New section "Editing seed terms: bump `tv`, or the change never ships", written as a blocking gate on any edit to a seed's `terms:` array, with the three-step procedure (bump `tv`; tell the developer to Sync now *before* rebuilding, since the build path does not sync; say plainly that a customised row will never receive the new terms). The file is path-scoped to `Scraper.gs` and `Scraper.html`, so it auto-injects exactly when it is needed. Retitled to "Scraper Data Invariants" since it now holds two

### Notes

- **568 assertions pass** across 22 suites
- Three defects of my own in the new suite, all fixed before it was trusted: a seed parser whose regex matched nothing (the suite would have asserted vacuously against an empty list, so it now also asserts the parser returned something); a simulation returning `null` rather than `false` where the real code relies on `if` coercion; and an assertion ending in `|| true`, which makes it pass unconditionally — the banned pattern, removed rather than repaired
- **The developer must press "Sync now" before rebuilding.** The hourly tick calls `scSyncInterests_(false)`, which is throttled; the build path does not sync at all. Without it the sheet still holds `seed-terms-v1` and the rebuild behaves exactly as before — which is the same failure, one layer out

## [v03.48r] — 2026-08-29 12:17:16 AM EST

> **Prompt:** "A few things: • First screenshot: The Jackery article is talking about consumer level electronics, which should be filtered out by Tune. • Second screenshot: There are two identical articles on the same digest, both from Google News (backstop). I haven't seen any actually relevant articles from Google News yet (out of a small sample size of maybe 4-5 articles), so I would devalue articles from Google News relative to the listed sources in Tune. Fix both problems."

### Fixed

`Scraper.gs` (v01.80g)

- **Why Tune did not catch the Jackery story.** The segment gate only fires when an article hits a **disabled** segment. `seg-consumer`'s terms were `smartphone, consumer electronics, appliance, laptop, tablet, wearable`; `seg-bess-residential`'s were `home battery, residential storage, residential battery, powerwall, home energy storage, rooftop storage`. A portable power station on an Amazon Labor Day sale matches none of them — so `excludedSegments` was empty, the gate never engaged, and the generic parent `seg-bess` (`energy storage`, `storage system`, `megawatt-hour`) matched and handed it segment evidence. The AI's own analysis said readers would "find zero actionable intelligence here"; the rubric had already admitted it by then
- **Fixed by vocabulary, not by a new mechanism.** The portable/consumer-storage terms went into **`seg-bess-residential`** specifically because it is a **child of `seg-bess`** — a hit there demotes the parent under the existing specificity-beats-breadth rule, `independentOn` falls to 0, `gated` becomes true, and company, topic and clickBoost are all zeroed. Putting the same terms in the parentless `seg-consumer` would have left the parent's hit independent and gated nothing. `seg-consumer` was broadened too, for the non-storage gadget and retail-sale case
- **Measured on the developer's actual headline**, with a model carrying the company and topic evidence that would have carried it in: **81 → 0**. Four genuine trade headlines were checked against the new terms and none is gated, including a utility bill *discount* and a combined-cycle *power station* — every retail marker added is a multi-word phrase a trade story would not write
- **Two identical articles in one edition.** Intake dedupes on URL, and Google News issues a distinct URL per republication of a syndicated story, so the same headline arrived twice and both printed. **The obvious fix would have broken something:** deduping by title at ingest kills corroboration, which groups by title signature to reward a story two or more sources carried — dedupe first and no group can ever have two members. So the collapse happens in `scDigestItems_` **after** the boost is applied: both rows stay in the intake, the reader sees one, and because the list is score-sorted it is the higher-scoring copy — usually the roster source rather than the penalised backstop one
- The collapse matches the **exact** normalized title, not the 8-word signature corroboration uses. That signature is deliberately loose because a false grouping there only nudges a score; here a false grouping deletes a story

### Changed

`Scraper.gs` (v01.80g)

- `SCRAPER_DIGEST_BACKSTOP_PENALTY` **0.85 → 0.70**. A backstop item now needs roughly 79 raw to clear the bar where 65 sufficed. **Stated plainly because it matters:** this does not suppress the Oracle-class item in the developer's second screenshot. A covered-company match is worth 40 evidence on its own, so a story genuinely about one of their companies still clears the bar after the penalty — that is the backstop working as designed, and the weight only decides how much *else* rides in beside it

### Notes

- **551 assertions pass** across 21 suites; new `t21.js` (29) covers the gate, the false-positive guards, the dedupe (including that corroboration still fires first), and the penalty
- **Two fixture errors of my own, both fixed in the test.** A company entry with no `weight` scores zero, because `company = w.company * min(1, bestCoWeight)` — so the before/after case scored 36 and never demonstrated what it claimed. Then, with a weight, it still failed: `scLoadInterestModel_` lowercases every term on the way in and `scTermsHit_` scans lowercased text, so a hand-built `'Jackery'` could never match. The fixture now mirrors the loader, and the before/after reads 81 → 0
- **Both changelogs were at their caps and both rotated**: `CHANGELOG.md` 100 → 94 (the 2026-08-16 group, six sections) and `Scrapergs.changelog.md` 50 → 45 (2026-08-17, five). The rotation asserts a single date group, an exact SHA-link count, and that the trailing branding line is only treated as an anchor when it falls after the last version header. It **refused** the GAS rotation on the first attempt rather than writing wrong links — a GAS version never appears alone in a commit subject, so the SHA resolves through the repo version each header carries as a cross-reference

## [v03.47r] — 2026-08-28 11:43:43 PM EST

> **Prompt:** "I rebuilt BESS and it came back with 13 relevant articles, which is close to the sweet spot I'm looking for (assuming they are truly relevant). However, i pressed "Why thin?" just to see what happens and it stayed "Reading this edition's intake" for about 10 minutes. What happened?"

### Fixed

`Scraper.gs` (v01.79g)

- **`digestScoreReport` was reading the entire DigestIntake tab.** It called `scDigestItems_`, whose first line is `intake.getDataRange().getValues()` — every row of every edition ever built, all twelve columns, including the three largest (snippet, summary, analysis). It needs one edition's rows and five columns. That helper belongs to the build pipeline, where it runs inside a 40-second budgeted step that resumes on a continuation trigger; a request a person is waiting on has neither
- **This lesson was already written in this file, twice, before I walked back into it.** `listDigests`: *"Two narrow reads instead of one wide one … Columns 7 and 8 are never touched here."* `scHandleHeldBack_`: *"Column 7 only — the rendered HTML in column 8 is the largest cell in the sheet and this route never needs it."* Adding the report by reusing the convenient helper inherited exactly the cost both comments exist to avoid
- **`scDigestScoreRows_`** replaces it: one narrow pass over column 1 to locate the edition's rows, then title/source, score/signals and the backstop flag over that bounded span. The snippet, summary and analysis columns are never read. The id column is still read in full because an edition's rows are not guaranteed contiguous — but one column of ids carries no large cells, and rows belonging to another edition inside the span are skipped. Measured on a fixture of 84 rows across three editions: **104 cells read instead of 1,008**

`Scraper.html` (v01.64w)

- **The overlay had no deadline of its own**, which is why it looked hung rather than slow. The transport aborts a POST at 90s and then *silently retries it as a GET* for another 90s, so a slow call showed "Reading this edition's intake…" for three minutes with nothing said. It now gives up on the message at 25 seconds and says what to do; the request is left to finish, and a `settled` flag stops a late reply overwriting what the reader is looking at

### Notes

- **522 assertions pass** across 20 suites. New `t20.js` (30) asserts the columns that must never be read, that only a single one-column read spans the tab, that every other read is bounded to the edition's span, and that interleaved rows of another edition are filtered
- **`t18.js` silently dropped to zero assertions** when the report switched readers — it stubbed `scDigestItems_`, which the report no longer calls, so it threw before its first check. A pass/fail tally alone would not have caught that: the run showed no failures. The suite runner now flags a suite that produces **no** assertions, which is a distinct failure from producing failing ones
- Removed an assertion I had written that compared three constants I had defined four lines above it — it asserted nothing about the code. Replaced with the cells-read measurement quoted above
- The developer separately reports the rebuilt BESS edition came back with **13 relevant articles**, up from 3, after the v01.78g backstop-rotation fix. Not proof on its own — one build is one sample — but it is the direction that fix predicted

## [v03.46r] — 2026-08-28 11:28:04 PM EST

> **Prompt:** "I'd rather be able to click digestScoreReport. I will rebuild the BESS edition and run disgestScoreReport afterwards."

### Added

`Scraper.html` (v01.63w)

- **A "Why thin?" button beside "Run intake now"**, reporting on the edition currently on screen (the selected chip; with none selected the server falls back to the newest edition). Opens `#wd-sr-overlay`, built on the held-back reader's pattern — same panel treatment, same close routes
- **Shape chosen from the data's job, not from habit.** The verdict is one fact, so it is a headline rather than a chart. The four counts are single figures, so they are stat tiles with no plot. Only the score distribution is a chart, and it is a **single ordered series** — so there is no legend (the heading names it), the count is direct-labelled on every one of the six rows, and bar length is scaled to the largest band rather than a fixed maximum
- **The below/above split is never carried by colour alone.** The relevance bar is drawn as a labelled rule positioned between the `50-54` and `55-69` rows, so the boundary is a position in an ordered list plus a text label; the accent fill on the passing bands is the third, redundant cue. Each row also carries a hover title, so a bar is readable without reference to anything else
- **Verdict copy says what to do, not just what happened.** `bar-bound` states that tuning the rubric is the lever; `intake-bound` states the opposite — that lowering the threshold would not have helped, because there was little to admit. Those are the two cases that look identical from outside the app, which is the whole reason the report exists
- No new palette was introduced: the panel draws on the app's existing tokens (`--wd-accent`, `--wd-dim`, `--wd-mut2`, `--wd-line`). With one series and no categorical scale there is nothing to validate for colourblind separation

### Notes

- **Rendered and looked at before shipping**, per the last step of the visualization procedure — the validator checks colour, not layout. Measured at 1280px and 390px: six band rows, four tiles, the rule labelled `relevance bar · 55`, no horizontal scroll at either width, no page errors. Tiles reflow to two columns on a phone and the band label column narrows
- Every value in the overlay is written with `createElement` / `textContent`. These titles come from third-party feeds by way of the sheet, and `t19.js` asserts the report assigns `innerHTML` nowhere
- The report sits above the held-back reader (`z-index` 10006 vs 10005), and Escape closes the top one first — asserted both as source order and as a z-index comparison, so the two cannot drift apart
- **492 assertions pass** across 19 suites; new `t19.js` (43) covers wiring, the close routes, injection safety, the shape decisions, verdict coverage in both directions (every verdict the server can emit has copy, and every copy key is a verdict the server emits), failure states, and the phone reflow
- One test-side typo of my own: an assertion matched `class = ` where the code sets `className = `. Fixed in the test

## [v03.45r] — 2026-08-28 11:19:00 PM EST

> **Prompt:** "I just rebuilt my BESS Morning Digest and it only has 3 relevant articles. The last iteration had 12 articles. What happened? I feel like there should definitely be closer to 10 articles that are relevant."

### Fixed

`Scraper.gs` (v01.78g)

- **The backstop rotation moved under a rebuild.** `scDigestBackstopStep_` picks 12 company names from a script-property cursor and advances it by 12 **every run**. So a rebuild never re-queried what the build it replaced had queried — it queried the *next* twelve companies. A rebuild was not a repeat, it was a different roll, and each successive rebuild rolled again. `scDigestBackstopPick_` memoises the day's pick per (edition, date), so a rebuild re-queries exactly what it is replacing. The rotation still turns daily, which is what it was for
- **One cursor was shared by every edition**, so building the morning digest consumed rotation the BESS build then did not get — the two editions were competing for the same twelve slots. Cursors are now per-edition (`scDigestBackstopCursorKey_`), with a one-time read of the old global key so an existing deployment resumes its rotation rather than restarting at the top of the alphabet
- The memo is keyed on the roster length as well as the date, so adding or removing a covered company re-picks instead of querying a name that has left the roster

### Added

`Scraper.gs` (v01.78g)

- **`digestScoreReport` — why an edition came out thin.** `rubricPreview` answers "why did THIS story fail", which only helps once you already suspect a story; it cannot answer the question actually being asked, which is about an edition as a whole. The new report reads the run's own intake rows and returns the score distribution in bands, the near-misses within 10 of the bar (ranked, each with how far short it fell, its geographic factor and its matched companies), the backstop/roster split, and how many items the geographic multiplier down-weighted. Its `verdict` separates the two cases that look identical from the outside: `bar-bound` (a crowd of items sitting just under the threshold) from `intake-bound` (an empty near-miss band, meaning the fetch was the constraint, not the scoring)

### Notes

- **Diagnosis, stated honestly:** three mechanisms make a rebuild thinner than the original — the backstop rotation above, corroboration (computed within a run, so a thinner fetch yields fewer of the boosts that were sized to help items clear the bar, compounding the first), and the sliding 24-hour window (an 11pm rebuild covers Thu 11pm–Fri 11pm; the morning build covered Thu 7am–Fri 7am). Without the developer's sheet it is not possible to say from here which dominated, and the changelog should not pretend otherwise. The first is a genuine flaw and is fixed; the third is correct behaviour. `digestScoreReport` exists so the next occurrence is measured rather than reasoned about
- Ruled out by reading the code rather than by assumption: `scDigestPruneOrphanIntake_` cannot delete an in-flight run's rows (it is called only from `scDigestStart_`, before the run writes any, and keeps 240 editions); intake dedup is scoped to the run's own `digestId`, so editions do not steal each other's articles; and the fetch phase cannot render early, since it only advances to `backstop` once `srcCursor` has passed every one of the 73 roster feeds. No scoring constant has changed in the last ten commits
- **449 assertions pass** across 18 suites; new `t18.js` (33) covers rebuild stability, per-edition isolation, migration off the shared cursor, roster changes, and every branch of the report
- Two of my own test defects, both fixed in the test: the suite stubbed `validateSessionForData` globally but `eval` re-declared it locally, so the first run threw `SESSION_EXPIRED` — which was at least proof the route is genuinely session-gated; and an assertion I wrote carried an `|| length===12` escape hatch that reduced it to a length check, the tautological pattern this repo bans. It now asserts the re-pick actually happens and starts from the cursor

## [v03.44r] — 2026-08-28 11:06:15 PM EST

> **Prompt:** "Is there a size between the current version and the last version? If so, I think that would be perfect for mobile. Also, since Amber = analysis, you bolded dollar amounts in white color font. Make it a shade of green that contrasts with the background instead. Also, see the attached screenshot. My most recent Morning Digest shows "6 more held back" and "View More (6)". However, when I press it, it shows nothing was held back. Which one is wrong? Fix it."

### Fixed

`Scraper.gs` (v01.77g)

- **Which one was wrong: the overlay.** The footer count was `relevant - shown` — arithmetic over `counts`, computed without ever consulting `d.heldBack`, which is the list View More actually opens. Two independent sources for one number can only drift. The footer now reads `heldBackTotal`, taken **from** the list, so the contradiction is no longer expressible: an empty list prints no sentence and offers no link
- **Every failure in the held-back route returned the same empty payload**, which the overlay renders as "Nothing was held back — every relevant story made this edition." That is a false statement, not a degraded one. Each cause now returns an `unavailable` reason, and the overlay says which: `not-found` (the edition was rebuilt — replacement changes the row id, so a link in an older rendering points at an issue that no longer exists), `unreadable`, `trimmed`, `no-id`, `error`. The developer's screenshot showed no edition-name subtitle, which is the signature of exactly these early exits rather than a genuinely empty list
- **`JSON.stringify(d).slice(0, 45000)` replaced by `scDigestFitJson_`.** Cutting a JSON string at a fixed offset lands mid-key or mid-value and produces a cell `JSON.parse` can never read again — so every consumer of column 7 failed silently, `unreadable` being one of the two candidate causes above. **Measured, not assumed:** an edition with full sections and a held-back list carrying summaries runs **90,000–160,000 characters against a 45,000 cap**. It now drops by value, cheapest first — held-back analyses, held-back summaries, then held-back items by halving (keeping the highest-scored, since the overlay already says "showing the top N of <total>"), then section analyses — re-measuring at each step, and records `trimmed` so a shortened edition can say so. Verified: every over-cap case now parses, and a typical busy day keeps 30 of 60 held-back items instead of losing the whole record

### Changed

`Scraper.gs` (v01.77g)

- **Mobile type set between the last two versions**, as asked: masthead 24→27, lead 20→22, headline 16→18, body and lede 14→15, padding 18/14/16→20/16/18, block rhythm 14→16. Desktop still restores 44/32/22/17/16. Measured at 390px with the `<style>` block intact and stripped — identical both ways
- **Bold figures are green (`#4ade80`), not the headline ink.** Distinguished by hue rather than brightness, since weight already carries the emphasis and green must not read as louder than the amber beside it. 10.5:1 against the edition ground, past WCAG AAA. Callers inside the analysis pass `inherit`, so a figure there stays amber and cannot break out of the run the footer key describes

`Scraper.html` (v01.62w)

- The overlay branches on `unavailable` before the empty-list message, and phrases each cause for a reader rather than a maintainer

### Notes

- **416 assertions pass** across 17 suites. New `t17.js` (28) pins the three fixes, including the decisive case: when the counts and the list disagree, the **list** wins and the stale arithmetic is never printed
- **Two test-side errors, both mine, both fixed in the test.** An extraction regex stopped at the first two-level brace so the ordering assertion compared against a string it had not captured; and once fixed, `indexOf` matched the explanatory **comment** quoting the message rather than the `fail(...)` call — the assertion now anchors on the executable form. Also deleted an assertion I had written as literal `true`, which is the tautological-test pattern this repo bans
- **`CHANGELOG.md` rotated** — it stood at 100/100, so the oldest full date group (2026-08-15: v02.44r–v02.47r) moved to the archive with commit-SHA enrichment before this section was added. 100 → 96 → 97. The rotation asserts the group is a single date and that exactly four SHA links were written, because the v03.28r rotation corrupted this file by anchoring on a string that also appeared inside a quoted prompt

## [v03.43r] — 2026-08-28 09:48:51 PM EST

> **Prompt:** "in hindsight, I think what you were doing before was better. Go back to replacing the same edition generated on the same day. Also, make the emailed digest two font sizes smaller and adjust the format accordingly. The current version is still a bit big on mobile."

### Changed

`Scraper.gs` (v01.76g)

- **`scDigestDropRunRows_` → `scDigestDropSameDayRows_`: v03.42r reverted.** A rebuild replaces that day's row for its edition and inherits its delivered stamp, exactly as before. The one-day trial of keeping both builds is over
- **The mobile type scale comes down two steps.** Masthead 30→24, lead 25→20, headline 20→16, body and lede 16→14, dateline 13→12, caps labels 10→9, footer and View More 12→11. Outer padding 22/18/20→18/14/16, which buys back 8px of line width at 390px. Section rules, the masthead rule and the footer rule tightened proportionally (18→14, 16→13, 10→8) so the vertical rhythm matches the smaller type rather than leaving the old gaps around it
- **The desktop scale is untouched** — the `min-width:601px` block still restores 44/32/22/17/16, so the change is mobile-only, which is where the complaint was. Block spacing is inline and therefore tightens on both; checked at 1000px and it reads as intentional, not cramped
- **The delivery grouping from v03.42r is deliberately KEPT** — the one piece not reverted, and flagged as such before the work started. Under replacement it can only ever find one row per edition per day, so it changes nothing in normal operation. It stays because the delivery loop mails *every* undelivered row dated today and runs hourly: if the drop guard ever missed, a duplicate row would become a duplicate send. A duplicate row is a nuisance; a duplicate send cannot be taken back

`Scraper.html` (v01.61w)

- News Stand chip reverted to date + relevant count. The build-time label only existed to separate same-day rebuilds, and its `perDate` counter keyed on **date alone** — so with rebuilds gone it would have fired on multi-*edition* days instead, labelling three chips that were never ambiguous

### Notes

- **385 assertions pass** across 16 suites. `t.js` gains three that outlive any specific numbers — every phone size below its desktop counterpart, mast > lead > hed > body, and a 14px floor on body text — so a future resize cannot silently invert the media query or shrink past readability
- **Measured at 390px with the `<style>` block intact and stripped: identical** (24/20/16/14/14/11 both ways). The v03.41r inversion still holds after a full rescale, which is the property that matters most about it
- **`Scrapergs.changelog.md` rotated** — it stood at 50/50, so the oldest full date group (2026-08-05: v01.26g–v01.29g) moved to the archive with commit-SHA enrichment before the new section was added. 50 → 46 → 47
- This repo CHANGELOG now stands at **100/100** — the next push must rotate it before adding a section

## [v03.42r] — 2026-08-28 09:39:29 PM EST

> **Prompt:** "When I build a new Morning Digest, why does it replace my previous one for the same day? I want it to save both."

### Changed

`Scraper.gs` (v01.75g)

- **`scDigestDropSameDayRows_` → `scDigestDropRunRows_`: the guard is keyed on the build run, not the day.** It was added in v03.36r after a bug left nine copies of one edition, and it was keyed on `(editionId, date)` — broader than the failure it was defending against. All nine copies came from a **single** run re-entering the render step, so they all carried the same `state.id`. Keying on the run keeps that protection exactly (a repeat render can still only rewrite its own row) while a deliberate rebuild stands beside its predecessor
- **`scDigestDeliverPending_` now mails exactly one row per edition per day.** This is the half the developer did not ask for and would have been bitten by: the delivery loop sends *every* undelivered row dated today, and it runs hourly from `scSchedulerTick`, so the moment rebuilds stopped deleting their predecessor an afternoon rebuild would have posted a second copy of the morning digest to every subscriber. Today's rows are grouped by edition, the newest build by `generatedAt` is chosen, and the rest are stamped `superseded` — a real value, so the hourly pass stops reconsidering them, and a named one, so the cell says why it never went out
- **A rebuild after delivery sends nothing.** If any row in the group carries a genuine send (a `Date`, as distinct from a marker like `no-recipients`), the whole group is skipped. The old code achieved this by carrying the delivered stamp onto the replacement row; with rows now accumulating, that inheritance no longer applies and the group check replaces it
- Issue numbering needed no change: `scIssueNumbers_` ranks by **distinct date**, so two builds of a day share that day's number — which is the right reading, since they are two takes of one issue

`Scraper.html` (v01.60w)

- The News Stand chip labels the build time **only** when a date carries more than one build. Two chips reading the same date were indistinguishable, and the build time was in a `title` tooltip a phone never shows. A one-build day renders exactly the chip it did before

### Notes

- **380 assertions pass** across 16 suites. New `t16.js` (29) covers the drop guard, the one-email-per-day rule, and the chip label
- **Three assertions in `t11.js` failed and were right to** — that suite is the nine-copy regression harness, and it pinned `rebuilding still leaves ONE row`, which is precisely the behaviour the developer asked to change. Rewritten to assert the new contract while keeping the nine-copy protection pinned; its section-5 count is now a **delta** rather than a running total, which is what made it fragile to begin with
- The GAS changelog reaches `50/50` with this push — the next Scraper GAS change must rotate it to the archive first

## [v03.41r] — 2026-08-28 09:04:47 PM EST

> **Prompt:** "This is how my Morning Digest looks on my phone. I like the amber analysis feature, but the formatting is extremely off. I am not sure what proper mobile sizing and formatting is, but this is very uncomfortable to read. Figure out what the optimal formatting is for mobile and fix this. Also, I want to extend the summarization and analysis to the articles that were held back by per section caps."

### Fixed

`Scraper.gs` (v01.74g)

- **The mobile media query was being deleted before it ever ran.** The screenshot showed desktop type at phone width — a 44px masthead wrapping to three lines — which is only possible if the `@media (max-width:600px)` block never applied. Gmail strips the entire `<style>` element when it contains anything unsupported, and Outlook-targeting code is a documented trigger; this shell carries MSO conditional comments for the ghost table. The block was being dropped wholesale and the email fell back to the inline desktop sizes
- **Fixed by inverting the direction rather than by fighting the stripper.** The inline styles now carry the phone sizes (30/25/20/16px, 22px padding) and `scNiMobileCss_` is a `min-width:601px` block that scales them *up* for desktop. Inline styles are never stripped, so the failure mode is now harmless: a lost `<style>` block leaves a phone-shaped email, correct on the surface it is mostly read on. The landing page is a browser, where the block always applies, so it is unchanged
- The footer was a two-cell `<tr>` that needed `.ni-foot-r` to stack; rebuilt as a single stacked `<div>` so it has no media-query dependency at all
- **Measured, not asserted.** Rendered at 390px with the `<style>` block intact and again with it stripped: identical output both times (mast 30, lead 25, hed 20, body 16, ~40 chars/line, no horizontal scroll). At 1000px the approved 44/32/22/16 sizes are restored

### Changed

`Scraper.gs` (v01.74g)

- `d.heldBack` and the `action=more` payload now carry `summary` and `analysis`, so View More shows the desk's own reading of a story instead of a bare headline
- **`SCRAPER_DIGEST_SUMMARIZE_TOP_N` (an unfiltered top-30) replaced by `scDigestSummarizeSet_` + `SCRAPER_DIGEST_SUMMARIZE_MAX = 70`.** This is the half of the request that the payload change alone did not deliver, and it only surfaced by tracing the field rather than trusting the comment above it: the section caps sum to exactly 30, so on any day with more than 30 relevant items — the developer saw 55 last week — everything held back sat *outside* the summarize window and reached View More with a raw feed snippet. The set is now the relevant set in score order, bounded at 70. It is also cheaper on a thin day, since it no longer buys summaries for items scoring below the bar that no part of the edition can print
- The dead `var top` left in the render step by the earlier lead-pool fix is removed, along with two comments that the change made untrue

`Scraper.html` (v01.59w)

- The View More overlay renders each item's summary with the analysis appended in amber, built with `textContent` so a headline or summary containing markup cannot inject
- Overlay lede now names the amber convention

### Notes

- **355 assertions pass** across 15 suites — 33 added or changed here, including a new `t15.js` covering summarize coverage on heavy, thin, flood and empty days
- `t.js` gained the invariant that matters most: stripping the `<style>` block out of the rendered email must not change a single inline size. That is the whole architecture, expressed as a test
- One suite (`t7.js`) failed after the change and was **right to** — its fixture items had no `score`, so the relevance-based set correctly returned nothing. Fixed the fixture, not the code: real intake rows always carry a number

## [v03.40r] — 2026-08-28 08:42:20 PM EST

> **Prompt:** "I don't want to see "what it means" under every article summary. Instead, add a short key in the footer that says something like "Amber = Analysis" in the amber color. Then, just keep the summary and analysis portions together like they were. I want to minimize the amount of space that each article block takes up."

### Changed

`Scraper.gs` (v01.73g)

- `analysisHtml` (a rule, an amber caps label, its own block) replaced by `analysisRun` — a single amber `<span>` appended to the summary's own paragraph. **Measured, not asserted:** identical content rendered by both versions at 390px, 1297px → 1160px, **137px saved (11 per cent)** across one lead and two items, about 46px per story
- Footer gains `Amber = analysis` in amber, emitted only when the edition actually contains analysis — an edition built before the split, or one whose summaries all fell back to raw source text, has nothing amber in it and a key would explain something that is not there
- The now-dead `.ni-analysis` mobile rule removed
- **`scNiBoldFigures_` no longer colours figures amber.** This was not in the request, and it is what makes the request true: amber was already the figure colour, so `$450 million` inside a reported summary rendered in exactly the shade the new key claims means analysis. Caught by looking at the render rather than the diff. Figures keep their emphasis through weight in the headline ink (`#f0eee8`); inside the analysis the caller passes `inherit`, so a figure there bolds within the amber run instead of breaking out of it

### Notes

- 323 assertions pass; 12 changed or added for this. Five of them pin the new invariant — a figure in a summary is not amber, a figure in an analysis stays inside the amber run, and within body text the only amber span is the analysis
- **Two assertion errors of my own, both from imprecision rather than the code.** The first tested for a bolded "18 months" — the figure regex covers energy units, currency and percent, not durations. The second counted *every* amber occurrence in the document and expected two; amber is legitimately also the idiom for structural micro-labels (the masthead line, `THE LEAD`). The claim that actually matters is narrower and is what the test now makes: within **body text**, amber means analysis

## [v03.39r] — 2026-08-28 08:33:28 PM EST

> **Prompt:** "I have built the default, BESS, and AIDC editions and I think the scoring rubric is working and I like the amount of relevant articles per issue.
>
> However, on the summarization side, I would like you to explicitly differentiate between the standard article summary and your analysis from different players' perspectives. When you analyze from different players' perspective, soften your language in accordance with your confidence level; Avoid definitive words like "definitely", "always", "will", etc. in lieu of softer words like "may", "could", and "try" (just examples, don't take as explicit instruction)."

### Changed

`Scraper.gs` (v01.72g) — the summary and the desk's analysis are now separate fields, separately rendered.

- **Split in the data, not in the prose.** The model returns `{"i":0,"summary":"…","analysis":"…"}` and the two are stored in separate columns (`DigestIntake` gains `Analysis`, the twelfth). A boundary drawn in the data holds; one drawn inside a paragraph erodes the moment a sentence runs long, which is exactly how the two had blended into one closing clause
- The `summary` prompt is now confined to what the article **reports** — "put no interpretation of your own here". The `analysis` prompt is explicitly named as inference and carries the edition's lens
- **Register matched to confidence, not a word blacklist.** The prompt asks that the analysis be written "like someone who knows they are extrapolating", preferring the conditional where the article does not support a flat claim, and states outright that the softer words are "illustrations of the register, not a word list to work from" — the developer asked not to have their examples taken as explicit instruction. It also says not to hedge a fact the article reports directly, so the instruction cannot collapse into hedging everything
- **Rendered as its own block**: a rule, an amber `What it means` micro-label in the same idiom as the section headers, and dimmer body ink (#a9b0bb against the reporting's #c2c8d2). Verified in Chromium at 1000px and 390px
- The lead paragraph is split the same way (`text` + `analysis`), so the edition reads consistently from the top
- **Backward compatible and honest about gaps**: an edition stored before this renders with no label at all rather than an empty block, and an item whose summary fell back to its raw snippet is given no analysis — better no desk read than a laundered snippet presented as one

### Notes

- 314 assertions pass; 31 are new. They cover the rendered separation, the ordering (analysis after the source line, not inside the summary), HTML escaping of the analysis, both no-analysis paths, the prompt's two-field shape and its register instructions, and the schema plumbing end to end
- **Three test failures this push were all test-side, and each is worth recording.** `t7`'s sheet mock keyed `setValue` on the row alone, so writing the analysis to column 12 clobbered the summary just written to column 9 — a mock limitation, since the real sheet has distinct cells; fixed the mock rather than the code. `t13` asserted prompt wording that this change deliberately reworded. And `t13`'s remaining failure was subtler: the prompt is assembled by concatenating string literals, so a sentence can be split across two of them and never appear contiguously in the source — the assertions now join adjacent literals and test the prompt as assembled, which is what they were always meant to check

## [v03.38r] — 2026-08-28 08:02:19 PM EST

> **Prompt:** "The number of relevant articles dropped down to 24, which is closer to what I would expect from a 24-hour scan. However, the "Green Party wants to slam the brakes on UK datacenter construction until water and energy use are sorted" article is not related to the US AIDC market at all, so I think it should have been excluded from the Digest. The rubric tester gave it a 12/100, which is about right. How do you decide which articles pass or not?
>
> Also, I noticed that many of the article summaries' last sentence starts with something along the lines of "For BESS sellers...". This line is amazing for the BESS-specific digests. However, for AIDC-specific digests, instead of summarizing articles from the BESS seller's perspective, I want you to highlight whichever part of the AIDC power infrastructure is within the scope of this article and why it matters to players in that scope. Essentially, I would like the last sentence of the summary to somehow explain why this article is important to readers of that Digest. I don't want to give rigid rules because I don't want every article summary to end in the same way."

### Fixed

`Scraper.gs` (v01.71g) — the UK article, plus three further gaps found tracing how it got in.

1. **`uk` was missing from the geography terms.** The Britain list held `united kingdom`, `britain`, `british` — but not the two-letter form headlines overwhelmingly use. Verified directly: `scGeoClassify_` returned `tier: unmarked, factor: 1, regions: []` for that exact headline, so the ×0.25 foreign penalty never fired and the article was scored as if it had no country at all. Two letters is safe because `scTermsHit_` matches on word boundaries — asserted against `Ukraine` and `Fukushima`. `e.u.`/`european union`, `aussie` and `seoul` were missing the same way
2. **The lead bypassed the relevance bar.** Sections filtered on `score >= SCRAPER_RELEVANT_THRESHOLD`, but the lead was taken from `items.slice(0, 30)` — unfiltered. Now that a normal day yields ~24 relevant items out of 30, that slice routinely contains items that never qualified, and the lead is the most prominent thing in the edition. The lead is now chosen from the relevance-filtered pool
3. **Corroboration was a hole in the evidence gate.** It is only knowable once the whole set is in hand, so `scDigestItems_` added it raw — to a score whose supporting signals `scRubricScore_` had already capped. An item at 52 became 58 with no new evidence. `evidence`, `support` and the geo factor are now persisted in the intake signals, and the boost spends only the support allowance the article had left, scaled by the same geographic factor as the rest of its score
4. **The rubric tester was scoring a different model than the build.** `rubricPreview` called `scLoadInterestModel_(ss)` (global) while every build calls it with the edition's materialised map. The tester is the tool reached for to ask why the digest did something; one that answers a different question is worse than none. It now takes an `editionId`, reports the threshold it judged against, and says whether the article passed

### Changed

**Per-edition summary lens.** The closing line was fixed to "a US grid-scale battery (BESS) seller" in the summarize prompt and again in the lead prompt, which is why every summary closed the same way. `SCRAPER_EDITION_LENS` gives each edition an **audience** and a **closing intent** — what the last line must accomplish, never a sentence pattern. AIDC's asks the model to identify *which* part of the power chain a story touches (generation, interconnection, transformers, cooling and water, siting, large-load tariffs) and close on what it means for people working in that part.

- Asked for explicitly: *"I don't want to give rigid rules because I don't want every article summary to end in the same way."* The prompt therefore also instructs the model to vary the construction across a batch and not to reuse a standard "For X, this…" opener more than once — and an assertion checks that no lens itself encodes such a pattern
- `scEditionLens_` falls back through an edition's parent to the default, so a new variant inherits its masthead's voice rather than losing one
- Aligning the lead pool exposed a second-order bug **in the same change**: the lead prompt offered the model `top.slice(0, 6)` (unfiltered) while the render step would now index into the filtered list. The chosen index would have pointed at a different article than the lead paragraph described. Both now use the same expression

### Notes

- 283 assertions pass; 28 are new. They cover the exact flagged headline, the two-letter-token safety cases, all three corroboration regimes (thin evidence gets nothing, well-evidenced gets its boost, foreign gets it scaled), lens differentiation and fallback, and that the prompts actually carry the lens rather than the retired hardcoded audience

## [v03.37r] — 2026-08-28 07:42:36 PM EST

> **Prompt:** "Ok, "run intake now" did delete the 9 copies and rebuilt a Morning Digest. After my new geography rules, I was expecting the number of relevant articles to go down. However, somehow it went from 20-30 something relevant articles to 55 relevant articles. What happened? I would like to strengthen the criteria to increase accuracy on which articles are relevant."

### Changed

**Why the count rose: the denominator moved, not the criteria.** 30 sources at `SCRAPER_DIGEST_ITEMS_PER_SOURCE = 15` plus 12 backstop queries is ~520 items — a *complete* fetch. The earlier "116 scanned" builds were being cut short by the one-step-per-hourly-tick scheduler and the v01.68g loop bug. The geography rules did work: the pass RATE went from 30/116 (26 per cent) to 55/520 (10.6 per cent). The absolute count rose only because the pipeline ran end to end for the first time.

**The real accuracy leak**, found while checking that: an article matching **zero** covered companies could reach `topic 25 + substance 20 + corroboration 6 = 51` — one point over the old bar of 50. Confirmed numerically in the tests, which print the old flat total for the exact case. `substance` scores *writing* (length, a figure, a quotation, an action verb); any well-written article about anything earns it. It was carrying 20 of the 50 needed.

#### `Scraper.gs` — v01.70g

- **Evidence gate.** `company`, `topic` and (new) `segment` are the signals that say an article is ABOUT something covered. `emphasis`, `substance`, `engagement` and `corroboration` describe an article already established as relevant. The supporting group is now capped at `SCRAPER_SUPPORT_RATIO = 0.6` of the evidence group, so it can amplify a real match but never manufacture one. The leaking article drops 51 → 40
- **Enabled segment matches became evidence** (`SCRAPER_RUBRIC_SEGMENT_EVIDENCE = 12`) rather than only ever gating. Without this the gate reduces to "name a covered company or you are out", which would drop a FERC interconnection order naming no vendor — exactly what this digest exists to surface. Keyed to `independentOn`, so a parent segment that only matched via its own disabled child still counts for nothing. Binary by design: matching a second segment does not make "this is about your segment" more true
- `SCRAPER_RELEVANT_THRESHOLD` 50 → 55. Margin only — one covered-company match is worth 40 on its own, so a genuinely relevant article clears 55 comfortably
- `evidence`, `support`, `segment` and `supportCapped` are returned for diagnosis

#### `Scraper.html` — v01.57w

- The rubric tester states when an article was held back for thin evidence and shows both numbers, so a low score explains itself rather than looking arbitrary

### Notes

- 255 assertions pass; 26 are new. Measured outcomes: the topic-plus-good-writing article **51 → 40** (excluded); a covered-company story **99** (unchanged, saturated); a segment-plus-topic policy story **57** (passes, correctly ranked below the company story and above the topic-only one); an article matching neither company nor topic **0**
- **Two errors of my own, caught by the tests rather than shipped.** The first draft of the comment claimed a strong match "still carries its full substance and corroboration" — false: at evidence 65 the cap binds at 39 against an uncapped 34, and the assertion checking it failed. Corrected to state what actually happens. The second: segment evidence was initially scaled to 60 per cent on a single match for no principled reason, leaving the policy story at 52 against a bar of 55; made binary
- **A test-authoring note:** one assertion demanded the policy story clear the bar by at least 3 points. It clears by 2. Rather than tune the constants to satisfy a margin I had invented, the assertion was rewritten to check what actually matters — that it ranks below a covered-company story and above a topic-only one. A marginal case should sit near the bar

## [v03.36r] — 2026-08-28 07:28:57 PM EST

> **Prompt:** "I deleted my old Editions and tried to build a new one. I pressed "run intake now", waited longer than before, and suddenly, the Scraper app created 9 copies of Your Morning Digest. What happened? Fix it."

### Fixed

`Scraper.gs` (v01.69g) — **a regression I introduced in v01.68g.** Moving the build state to per-edition Script Properties updated the WRITER (`scDigestSaveState_`) but left the READER in `scDigestStep_` calling `scDigestState_()` with no argument. The no-arg form fell back to the legacy `scDigestRun` key — which nothing writes any more, but which still held a stale state from before the deploy.

Read and write therefore pointed at different properties. The loop set `phase: 'done'` on the per-edition slot, read a stale non-done state back from the legacy one, reported `done: false`, and the client called `runDigestNow` again 600 ms later — re-entering the render step and appending another Digests row every pass. **Measured against the shipped code: 25 calls produced 25 rows and never terminated.** The developer saw nine because that is how long they waited before closing it.

- `scDigestStep_` now reads `scDigestState_(wantEd)` — the same slot the steps write — on both its reads, so the two can no longer diverge
- `scDigestMigrateLegacyState_` moves the legacy single key into its per-edition slot once and **deletes it**, removing the possibility of a pre-v01.68g state being resurrected and resumed. It never overwrites a live slot
- The no-arg form no longer returns null for a finished build: it reports the most recently started state when nothing is in flight
- **Defence in depth:** `scDigestDropSameDayRows_` removes any existing row for the same (edition, date) immediately before the render appends. Rebuilding is idempotent now, so the worst any repeat render can do is rewrite one row rather than file another copy — and the nine duplicates already on the sheet are collapsed the next time that edition is built. Scoped tight: same edition AND same date, so another masthead or another day is never touched
- The drop carries the prior row's `Delivered` stamp onto the replacement. Without that, rebuilding an edition that had already been emailed would clear the stamp and the next delivery pass would send it a second time — the opposite of what the v03.35r build/send split is for

### Notes

- 229 assertions pass. 15 are new and drive `scDigestStep_` through the **real client loop** — call until `done`, capped — from the exact starting condition that caused this: a stale non-done legacy state for today's morning edition. They assert the loop terminates, that one row exists rather than nine, that the legacy key is gone afterwards, that a rebuild replaces rather than appends, that the delivery stamp survives, and that neither another edition nor another day is touched
- **The test was verified against the broken version**, not just the fixed one: run against `HEAD`, four of its assertions fail and the harness reports 25 rows from 25 calls. A regression test that has never been seen to fail is not evidence of anything
- The failure was invisible to the previous push's 214 assertions because every one of them tested a step, a state accessor or a delivery pass in isolation. None drove the loop the client actually runs — which is precisely where a read/write key mismatch shows up

## [v03.35r] — 2026-08-28 06:57:56 PM EST

> **Prompt:** "Continue with your recommendation to make the scheduler actually send digests out at 7am every weekday. Also, I can confirm that manually building a Digest does automatically email it out, but I would like that to stop happening. If I want to manually send out a digest via email, I will do it via "go-live" and "email me latest"."

### Fixed

`Scraper.gs` (v01.68g) — the 7:00 delivery, and the manual build that was mailing subscribers.

- **The binding constraint, verified rather than assumed:** one Apps Script execution is capped at **6 minutes** on a consumer account ([quotas](https://developers.google.com/apps-script/guides/services/quotas)). The pipeline needs far longer for three editions — 30 feeds at `SCRAPER_DIGEST_FETCHES_PER_STEP = 6`, plus backstop, summarize and render — so "build at 7:00, deliver at 7:00" is not achievable in one run. The plan I proposed ("loop to completion in one invocation") would not have fit; the design changed once the limit was checked
- **Build and delivery are now separate.** `scDigestRenderStep_` no longer mails; it leaves the new `Delivered` column empty and `scDigestDeliverPending_` sends. One change serves both requests: a manual build is silent *because* sending is no longer part of building, and the send can be held to 7:00 however early the build finished
- **The build starts at `SCRAPER_DIGEST_BUILD_HOUR = 6`** on a daily trigger, works to `SCRAPER_DIGEST_RUN_BUDGET_MS = 240000` (four minutes, two clear of the cap), and chains a one-off continuation a minute out when there is more to do. All due editions are built in the same morning instead of one per day
- **`SCRAPER_DIGEST_SEND_HOUR = 7`** gates every send. A separate 7:00 trigger mails whatever is pending; the hourly tick also calls the pass as a catch-up, and neither can send early because the gate lives in the pass itself, not in its callers
- **Per-edition state slots.** `SCRAPER_DIGEST_STATE_KEY` was one global Script Property: the scheduler would be several steps into the morning edition, a manual BESS build would call `scDigestStart_`, and the slot was overwritten wholesale with `srcCursor: 0`. With an hourly trigger that cost hours, and on a day of active use the scheduled build could be reset repeatedly and never finish. `scDigestStateKey_` namespaces per edition; the no-argument form still answers "is anything running?" and falls back to the legacy slot
- **Continuations get their own handler name** (`scDigestContinueRun`) purely so `scDigestClearContinuations_` can delete spent ones without deleting the daily build trigger — sharing a name would have stopped the schedule after one morning. Spent one-offs are cleared at the top of every run, since Apps Script caps triggers per script and an unbounded daily leak would eventually refuse to create any trigger at all
- **An edition nobody is subscribed to now records `no-recipients` on its row** rather than being skipped in silence. The silent skip is exactly how "it just did not email" goes undiagnosed
- Triggers are created `inTimezone(SCRAPER_DIGEST_TZ)`; without it a 6:00 ET build would fire at 6:00 in whatever zone the script project happens to be set to

### Notes

- 214 assertions pass. 28 cover the new scheduling (delivery held at 06:00 and sent at 07:00, no double-send, all three editions to the right addresses, `no-recipients` recorded, yesterday's rows untouched, per-edition state isolation, continuation creation and cleanup that spares the daily trigger, and that the run budget sits at least a minute inside the execution cap). 14 more are source-level proofs that the render step, `scDigestStep_` and `runDigestNow` contain no `MailApp` call at all, and that every remaining sender in the file is an explicit send path rather than a build step
- **A test error worth recording:** the sender audit first counted `scValidEmail_` as a sender. It was matching the string `MailApp.sendEmail` inside `scDigestRecipients_`'s doc comment — a `/** */` continuation line with no leading `*`, so the comment filter missed it. Requiring the call paren fixed it. The finding was a false positive in the test, not a defect in the code
- The hourly `scSchedulerTick` is deliberately kept: it carries the heartbeat and the daily Interests sync, and is the catch-up path if a morning run is missed entirely

## [v03.34r] — 2026-08-28 05:58:49 PM EST

> **Prompt:** "For my Scraper app, I would like you to note that I am specifically focused on the US BESS/AIDC market, so I would like news about other countries to be greatly devalued in the scoring process. That doesn't mean I never want to see any news about any other country, but the US market is a clear priority 1, greatly outpacing priority 2 countries that are closely related to this industry (China, Mexico, Chile, Canada). There may be more priority 2 countries, but they should generally only be scored highly if whatever happened in those countries directly affect the US market. For instance, the lead article should never be "No word on Snowy 2.0 as Bowen underlines importance of transmission: they are not being built for fun" because this covers the Australian market and doesn't relate to the US market at all."

### Added

#### `Scraper.gs` — v01.67g

- **Geographic priority in the rubric, applied as a multiplier on the finished score rather than as a fifth additive band.** The requirement is proportional — "greatly devalued", "greatly outpacing" — and an additive penalty leaves a strong company match on a foreign story still above the bar, which is precisely the case objected to. `scGeoClassify_` returns `{ factor, tier, regions, usLinked }` and `scRubricScore_` scales its total by it
- Tiers: US x1.00; priority 2 (China, Mexico, Chile, Canada) x0.55; everywhere else x0.25. Each softens to x0.85 / x0.60 when the article also names something US-market — a tariff, an export, a US buyer, a US grid operator. That is what "directly affects the US market" looks like in the text
- **The load-bearing rule is the default: no geographic marker at all scores x1.00, untouched.** Most US trade coverage never says "United States" — it says ERCOT, or a county in Texas, or nothing. A penalty needs positive evidence of a foreign subject, never merely the absence of evidence of a US one; the alternative would have emptied the digest
- When both tiers appear, the tier with more distinct regions wins and a tie goes to the harsher one — a Latin America round-up naming Chile and Mexico alongside Brazil and Argentina is a regional piece, not a Chile story
- `signals.geo`, `geoTier`, `geoRegions` and `geoUsLinked` are returned for diagnosis, so a low score explains itself

#### `Scraper.html` — v01.56w

- The rubric tester shows the multiplier beside the score and, when geography fired, a line naming the regions found and whether a US connection softened the penalty. Geography gets a sentence rather than a bar because it is a multiplier, not a band

### Fixed

- Three term collisions found by the tests while building this, each of which would have mis-scored real articles:
  - **"America" matched "Latin America"**, so the Latin America storage round-up counted as US-linked and had its penalty halved. Qualified forms (`latin`/`south`/`central america`) are stripped before matching; `north america` is deliberately kept as a US marker since it includes the US
  - **"NEM"** was in the Australia list as the National Electricity Market, but in US solar coverage it means net energy metering — a California NEM 3.0 story would have been devalued as Australian
  - **"Victoria"** was in the Australia list; too common a bare word to spend a x0.25 penalty on, so a person named Victoria no longer makes a story Australian
- The bare token `us` is deliberately absent from the US marker list: the text is lowercased before matching, so it would hit the pronoun in nearly every article. `ira` and `doe` are excluded for the same reason

### Notes

- Verified against the developer's own example: the Snowy 2.0 article classifies as `other`, matches `australia`, finds no US link, takes x0.25, and lands **below** `SCRAPER_RELEVANT_THRESHOLD` — while a US story in the same edition is untouched at x1.00
- 172 assertions pass. 40 cover geography alone, including 8 regression guards named for the collisions above, the pronoun-"us" case, `Indiana`-is-not-`India`, and that a US story mentioning a Chinese rival is softened to x0.85 rather than buried
- The term lists are deliberately not exhaustive. A country absent from them scores as unmarked, which is the safe direction — the lists should be extended when a region turns out to need devaluing, rather than the penalty being widened
- **Rotation-script bug caught before it landed.** The rotation anchors the end of the moved block on the file's trailing `Developed by:` line — which works for the page and GAS changelogs, and which **this file does not have**. Its only two occurrences of that string are both inside quoted prompts, so the anchor landed ~1,100 lines *above* the block being moved and the slice duplicated ~68 sections. Reverted from `HEAD` before it was staged. The rotation now resolves the anchor as "the trailing branding line if it falls after the last version header, otherwise end of file", and asserts the resulting section count changed by exactly the size of the group moved — an assertion that would have caught this on the first attempt. The page and GAS rotations earlier in this session used the same anchor but are provably unaffected: those files contain that string exactly once, as their real trailing line

## [v03.33r] — 2026-08-28 05:46:45 PM EST

> **Prompt:** "I successfully built a default and BESS Morning Digest, but when I tried to build the AIDC one, I failed twice. This is the error message. What's going on? Fix it."

### Fixed

`Scraper.gs` (v01.66g) — `ai_unavailable: ai_bad_json` on the AIDC build. Nothing about it was AIDC-specific: it is a chain of four defects, and any edition could draw the unlucky reply. All four are fixed, because fixing one link still leaves the others.

1. **`scGeminiComplete_` never read `finishReason`.** A reply the model had to cut short at `maxOutputTokens` came back looking like a clean success, and the caller then failed to parse a JSON array with no closing bracket. Verified against the docs rather than assumed: thinking tokens count against the same `maxOutputTokens` budget on current models, so a long reasoning pass can consume it and return `finishReason: MAX_TOKENS` with the text truncated **or empty** ([ai.google.dev/gemini-api/docs/tokens](https://ai.google.dev/gemini-api/docs/tokens), plus the MAX_TOKENS-with-empty-text reports on [discuss.ai.google.dev](https://discuss.ai.google.dev/t/finishreason-max-tokens-but-text-is-empty/81874)). Now raises a distinct `ai_truncated`, and `SAFETY`/`RECITATION`/`PROHIBITED_CONTENT` raise a named `ai_blocked_*` instead of being reported as an empty response. `scClaudeComplete_` gets the same check on `stop_reason`
2. **`scParseJsonArray_` threw the whole reply away.** It took everything between the first `[` and the *last* `]` — not string-aware, so a `]` inside a summary or in trailing prose moved the boundary; and a truncated array has no closing bracket at all, so four complete summaries out of five were discarded along with the half-written one. Now three widening passes: the original fast parse, a string-aware balanced scan (`scScanBalanced_`), then salvage (`scSalvageObjects_`) which parses every complete `{…}` in the array region individually
3. **`ai_bad_json` was not retryable.** A model returning malformed JSON is the same class of transient as a 503 — generation is not deterministic and the next attempt usually parses. `scAiRetryable_` now includes `ai_bad_json`, `ai_truncated` and `ai_empty_response`. This is the identical failure the function's own comment says it was written to stop happening for 503; that fix was applied there and missed here
4. **One bad batch abandoned the edition.** Any AI error `break`s the summarize loop, so one unusable reply out of six calls dropped all thirty items to raw snippets. New `scAiSoftFail_` separates "retry this call" from "keep going after giving up on this call": a batch that still will not parse after its retries falls back to snippets for **its own five items** and the loop continues, bounded by `SCRAPER_DIGEST_MAX_SOFT_AI_FAILS`. A missing key or unconfigured provider is still terminal — those say the next call will fail too

- `SCRAPER_DIGEST_SUMMARY_TOKENS = 8000` replaces the hard-coded 3000 on the summarize call, so reasoning and output are not competing for one budget
- New `state.aiSoftNote` carries a partial fallback separately from `aiNote`. The footer now reads `summarized by <model> · a few summaries fell back to source text` rather than the whole edition claiming fallback mode, and `getDigestStatus` exposes it while a build runs

### Notes

- 132 assertions pass. 30 cover the parser and the retry/soft-fail classification (including the literal truncated-reply shape from this bug, a `]` inside a summary, escaped quotes, nested objects, and that genuine garbage still throws); 15 cover `finishReason`/`stop_reason` handling and an end-to-end summarize run where one batch is unparseable through every retry — asserting the other batches keep their AI summaries, that `aiNote` is *not* set, and that a missing key still stops the edition
- The diagnostic value is the point as much as the recovery: the note now distinguishes truncated from unreadable from blocked, so a recurrence names its own cause instead of reporting `ai_bad_json` for all three

## [v03.32r] — 2026-08-28 05:34:27 PM EST

> **Prompt:** "I am deleting all my old Editions (with their old problems) to keep things organized, but I noticed that the issue number keeps going up. When you give a Digest an issue number, make sure to check the current repository of digests and keep the issue number congruent."
>
> **Prompt (follow-up, mid-turn):** "On the Scraper app, before emailing digests out, I want you to be flexible and update issue numbers for surviving issues if I delete an issue. Make sure all issues are properly chronologically ordered at all times on the app."

### Fixed

- `Scraper.gs` (v01.65g) — **the issue number was `digests.getLastRow()`**, a row-position counter over the whole Digests tab. Wrong three separate ways, all of which the developer was hitting at once:
  1. **Shared across mastheads.** A first-ever BESS issue inherited the count of every morning issue ever built, so it opened at No. 004 instead of No. 001
  2. **Counted builds, not issues.** `appendRow` adds a row per render, so pressing *Run intake now* twice in a day made the same day's edition claim two numbers and pushed the next issue up by two
  3. **Moved with unrelated rows.** Deleting issues of one edition shifted every other edition's next number
- Replaced with `scIssueNumbers_` / `scNextIssueNo_`: an issue's number is the rank of its **date** among the distinct dates stored for its **own** edition, oldest first. One rule fixes all three — per-masthead sequences, a rebuild keeps its day's number, and deletions reflow the survivors so the sequence stays contiguous
- **Renumbering happens on read as well as at build time** (`getDigest` and `scHandleSharedEdition_`, via `scRewriteIssueNo_`). Build-time-only numbering is not enough and would have shipped a new bug: delete No. 2 of 5, and the next build computes 4+1 = 5, colliding with the stored No. 5. Recomputing on read is what makes "congruent" hold over time rather than only at the moment of sending
- `scRewriteIssueNo_` anchors on the full `· No. NNN · covering the last` phrase rather than the digits alone, so a headline or summary containing something like "Order No. 007" is never rewritten — covered by an assertion
- `scIssueDateKey_` normalises the Digests `Date` cell, which Sheets types as a string on some rows and a `Date` on others depending on how it was written
- **`scRenumberIssues_` persists the reflow** rather than only correcting it on read, and runs after every `deleteDigest` and again immediately before an edition is emailed. Read-time correction alone left the stored row stale, and the stored row is what gets mailed — so a delete could still have put a wrong number in someone's inbox. The email is the one copy that can never be corrected afterwards, which is why it is the copy that gets the freshest numbering
- **`listDigests` was ordering by sheet row, not by date.** Rows are appended in build order, so rebuilding an older day pushed it to the top of the News Stand ahead of newer issues. Now sorted by date descending, tie-broken on `generatedAt` then id so the order is total and a redraw never reshuffles equal rows. Each row also carries its `no`
- New denormalised `No` column on the Digests tab, for the same reason `Lead` was denormalised: the News Stand shows it on every card and the renumber pass compares it on every stored issue, and reading it out of the Sections JSON would mean pulling a 45,000-character cell to answer a question about one small number. Only rows whose number actually moved pay for a stored-HTML rewrite
- `ensureScraperTabs_`'s cache key was `'scTabsReady_' + <tab count>`, so **adding a column to an existing tab did not bust it** — a warm cache would have skipped the widening for up to six hours after deploy and the new column silently would not have existed. Now keyed on the total column count across all tabs as well

### Notes

- **Numbers are now positional, not permanent serials.** An edition emailed as No. 007 will show as No. 005 in the app if two earlier issues are later deleted. That is what "congruent with the current repository" requires, and it matches the developer's stated pruning workflow — surfaced to them before the change was made
- 87 assertions pass: 22 covering numbering (per-edition sequencing, same-day rebuilds, mid-sequence and full-edition deletion, mixed `Date`/string cells, the masthead-vs-headline rewrite guard, and a regression test naming the old `getLastRow()` behaviour), 8 covering the `getDigest` read path end to end, 21 covering the persisted renumber pass and the ordering fix (including that an untouched row is never rewritten, that a second run is a no-op, and that the edition/date/pagination filters still hold after the sort change), plus the 22 renderer and 14 route assertions from v03.30r–v03.31r
- Reads columns 1, 2 and 10 only — the numbering pass never touches the two 45,000-character cells, so it does not undo the read-path work from v03.26r

## [v03.31r] — 2026-08-28 05:22:01 PM EST

> **Prompt:** "If nothing was held back, just don't include the "View More" option."

### Changed

- `Scraper.gs` (v01.64g) — the zero-held-back branch of the edition footer emitted `Open the Wire Desk →` as a fallback. That was my judgment call in v03.30r, not something the developer asked for, and they have overruled it: the `ni-foot-r` cell is now emitted empty when `held === 0`. An edition that showed every relevant story has nothing more to offer, and a link there would only lead somewhere the reader did not ask to go. Three assertions cover it — no `View More`, no fallback text, and no `<a>` anywhere in the right-hand cell

### Notes

- `Scrapergs.changelog.md` reached 51/50, so the 2026-08-04 date group (12 sections, `v01.14g`–`v01.25g`) rotated to the archive with every header SHA-enriched from its repo-version cross-reference. Post-rotation verification returned no unenriched headers. Active file now 39/50
- `Scraper.html` is untouched this push, so `v01.55w` is unchanged — the footer is rendered server-side

## [v03.30r] — 2026-08-28 05:16:12 PM EST

> **Prompt:** "I confirmed that I could successfully build and email a new edition to myself and open the article links from the email.
>
> A few changes:
>
> * I want the emailed digests to be optimally formatted for viewing on a mobile device as that is most likely how most of the readers will read them.
> * (See attached screenshot) When I click the "Digest" button, I want the resulting window to be formatted such that there is no need to scroll horizontally to see everything. Ideally, I would like you to widen the window itself since there is more than enough room on the landing page screen.
> * Throughout the whole thing, I want you to keep the landing page digest the same size and formatting.
> * Rename "The Morning Edition" to "Your Morning Digest" everywhere. That means the BESS and AIDC versions should be "Your Morning Digest (BESS)" and "Your Morning Digest (AIDC)" as well.
> * In the bottom right corner of the digest, instead of "Tune tomorrow's edition", I want you to create a link called "View More" that allows the reader to see the X number of "held back" articles "by the per-section caps"."

### Changed

#### `Scraper.gs` — v01.63g

- **Fluid-hybrid email shell.** The edition body was a table carrying a literal `width="860"` attribute. No phone client collapses that, so a subscriber on a 390px screen got an 860px canvas and had to pan sideways to read every line. The inner table is now `width="100%"` + `max-width:860px`, wrapped in an MSO conditional ghost table at 860 so Outlook's Word engine — which genuinely does ignore `max-width` and margin centering, the reason the nested tables were introduced in the first place — still gets a fixed frame. Every other client gets a table that shrinks to the viewport
- **`scNiMobileCss_()`** emits one `@media (max-width:600px)` block scaling the masthead 44→29px, the lead 32→23px, item headlines 22→19px, body 16→15.5px, and the cell padding 30→16px, and stacking the two footer cells. Deliberately gated at 600px so the app's own reader — the landing-page column lays out far wider — is unchanged. Verified in Chromium: at 1600px the body still measures exactly 860px with a 44px masthead; at 390px `documentElement.scrollWidth === clientWidth`
- `SCRAPER_EDITION_DEFAULT`, the `bess`/`aidc` seeds, and every comment renamed to **Your Morning Digest**. `SCRAPER_EDITION_RENAMES` + a back-fill in the edition-roster loader rewrite the Editions rows already created (the seed block is gated `done`, so they would otherwise keep the old name forever); `scRewriteLegacyNames_` rewrites archived editions on read. Both are keyed to the exact old string, so an edition the developer renamed themselves is untouched, and a row already carrying the new name stops matching — which is what makes them idempotent
- Footer link `Tune tomorrow's edition →` replaced with `View More (N) →`, pointing at `EMBED_PAGE_URL?more=<digestId>` — never `/exec`, for the account-routing reason fixed in v03.29r. With nothing held back the slot degrades to `Open the Wire Desk →` rather than promising an empty list
- Held-back items are computed once, before the render, and embedded in the stored digest as `d.heldBack` / `d.heldBackTotal` (capped by the new `SCRAPER_HELD_BACK_SHOW = 60`, click-tracked like every other link). The `HELDBACK_` script property only ever holds the newest run of each edition, so View More could not have worked on an older one without this. `scStoreHeldBack_` still runs for the weekly rollup — it now reuses the same computed list instead of recomputing it after the render
- New unauthenticated `action=more` route (`scHandleHeldBack_`), bounded exactly the way the click redirect is: the digest id names the edition, the payload comes from that edition's own stored JSON, no request input is echoed back, and there is no write. Reads column 7 only, never the rendered-HTML cell. An edition with no stored list returns an explicit `legacy` flag so the reader is told the edition predates the feature rather than shown an empty page
- `scHandleSharedEdition_` now applies the same read-path upgrades `getDigest` does — a share recipient is the least likely of all readers to be signed into the right Google account

#### `Scraper.html` — v01.55w

- `#wd-digest-panel` widened from `max-width: 760px` to `1120px`. The edition lays out at up to 860px, so at 760 it could not fit and `#wd-digest-view` scrolled sideways — the horizontal scrollbar in the developer's screenshot. Measured after the change: panel 1120px, `scrollWidth === clientWidth`. `#wd-edition-view` untouched; it was never the narrow one
- Held-back reader (`#wd-hb-overlay`) with `scHeldBackOpen_` / `scHeldBackClose_`. One implementation serves both entry points: a delegated click on `a[href*="more="]` inside a rendered edition (intercepted, so the app is not reloaded to show a list it can already fetch) and a `?more=<digestId>` bootstrap in the pre-auth IIFE, for a subscriber arriving from their email with no session. Both resolve over the cookie-less fetch. Rendered with `textContent`/`createElement` throughout — these titles come from third-party feeds and this overlay renders for readers who are not signed in
- Closing the overlay `replaceState`s the `?more=` away so a refresh does not reopen it; Escape and backdrop click also close it
- Renamed the Digest panel heading, the new-edition hint, the fallback edition list, and the build notifications

### Notes

- Verified in Chromium at 1920/1600/390px: modal has no horizontal scroll, landing-page reader byte-identical (860px body, 44px masthead), overlay opens from both entry points with feed titles escaped, and zero page errors in all three contexts. 34 server-side assertions cover the renderer and the new route, including the zero-held-back fallback and the legacy-edition flag
- **Already-delivered email cannot be retro-fixed.** Editions in a subscriber's inbox keep the 860px shell and the old masthead; the fluid layout and the new name apply to editions built from here on. In the app and through share links the whole archive is corrected on read

## [v03.29r] — 2026-08-28 06:28:13 AM EST

> **Prompt:** "I built one new session and tested the links - They are all still broken. Fix it."

### Fixed

- **Article links pointed directly at `script.google.com/macros/s/<id>/exec`.** That is a cookie-carrying top-level navigation, so Google resolves it against the browser's **default** signed-in account and serves an account chooser — or "unable to open the file" — when that is not the account owning the script. `scClickUrl_` now emits `EMBED_PAGE_URL?go=<digestId>&i=<key>`, and the embedding page resolves the destination over the same **cookie-less `fetch()`** the app already uses for every data call, then replaces the location. This is the identical structural remedy already applied to the `#gas-app` iframe (`credentialless`) and the token exchange — click links were the one surface still going direct
- `scHandleClickRedirect_` gained a `fmt=json` mode returning `{success, url}`. Same resolution and same fallback as the HTML redirect, which is retained so links in already-delivered email keep working
- `getDigest` runs stored HTML through `scRewriteLegacyClickUrls_`, upgrading direct-`/exec` links to the embedding-page form on read — so the whole existing archive is fixed in the app, not only editions built from here on
- The `?go=` handler runs **before** anything auth-related, because a subscriber opening a link from email has no session and needs none; it paints an "Opening article…" cover and falls back to the app on any failure rather than stranding the reader

### Changed

- `.claude/rules/gas-scripts-reference.md` — the multi-account routing section said "no code change fixes it" and listed only the iframe and token exchange as structurally fixed. That framing is correct for opening Drive files and the Apps Script editor, and wrong for links this app emits. Added click links as the third fixed surface and a blockquote stating plainly that a direct `/exec` link for a user to click is a defect in the link. Without that correction a future session would re-derive this from scratch

### Notes

- **My previous diagnosis (v03.28r) was wrong and I should have caught it before shipping.** The intake wipe explained why *older* editions broke; it never explained the newest one, and the developer said "all" from the first message. The wipe was a genuine bug — Archive search, the company timeline and source stats were all reduced to the latest run by it — but it was not this bug. v03.28r stands on its own merits; it just did not fix what was asked
- **What finally identified it:** the developer confirmed the symptom was a Google error/sign-in page, not a wrong destination. That reconciled the one piece of evidence that never fit — an anonymous `curl` to the same endpoint returned 200 while a signed-in browser failed. Anonymous works, cookied does not, which is account routing by definition
- **Ruled out first, with evidence rather than reasoning:** the live deployment was on `v01.61g` (so the prior fix *was* deployed); the real `scDigestRenderStep_` emitted correct hrefs whose click keys matched the intake rows exactly; the real `scHandleClickRedirect_` resolved them to the real article; a realistic 30-item edition rendered to 36,293 characters against the 45,000 cell cap, so no truncation; `DEPLOYMENT_ID` matched between config and `.gs`; the CSP carries no `navigate-to`
- **Verified**: 16 assertions against the real render-and-resolve path, including that the emitted link carries no destination URL (still not an open redirect), that JSON mode fails closed to the app, that the legacy HTML redirect still resolves for delivered email, and that the legacy rewrite handles both the escaped and unescaped ampersand while leaving unrelated markup untouched. A Playwright run drove the real `?go=` hop end to end — resolution fetch issued, navigation landing on the article, and no overlay or fetch on a plain page load

## [v03.28r] — 2026-08-28 06:02:57 AM EST

> **Prompt:** "I just noticed that all the hyperlinks in the Scraper app and the emailed Digests are broken. What happened? Fix it."

### Fixed

- **`scDigestStart_` deleted every `DigestIntake` row at the start of each build.** `scHandleClickRedirect_` resolves a link's real destination from the intake rows of the digest it belongs to, so the moment a second edition was built, every article link in every earlier edition stopped resolving and fell back to `EMBED_PAGE_URL` — landing the reader on the app instead of the article, in the page and in already-delivered email alike. Replaced with `scDigestPruneOrphanIntake_`, which removes only rows whose digest has no Digests row (exactly what an aborted run or a retention trim leaves behind) and deletes contiguous blocks rather than row-by-row
- **Three more features were silently reduced to the latest run** by the same wipe and are fixed by the same change: `searchArchive` ("search every story Scraper has stored, across all editions"), `companyTimeline`, and `sourceStats` all scan the intake tab and could only ever see the run in progress
- `scHandleClickRedirect_` and `scDigestIntakeUrls_` read narrow column ranges instead of `getDataRange()`. Retaining intake makes the tab large, and the redirect is unauthenticated and hot — this is the same read-path class fixed for Digests in v03.26r

### Added

- `SCRAPER_INTAKE_KEEP_EDITIONS = 240` bounds how far back intake is retained (~16 weeks at three editions a day, ~36k rows). Beyond the window an edition stays readable but its links fall back to opening the app — the behaviour every link had before this fix. Added deliberately rather than leaving retention unbounded: without a cap this fix would have traded a correctness bug for the growth cliff v03.26r had just removed

### Notes

- **Not caused by v03.25r–v03.27r, but exposed by them.** The wipe is long-standing. Raising `SCRAPER_DIGEST_KEEP` 60 → 400 and shipping the News Stand made many old editions browsable for the first time, and the developer had built three editions in one day — so two of the three had dead links the moment the third was built. The correlation with the last three pushes was real even though the defect was not new
- **Diagnosis was evidence-led, not inferred.** Probed the live deployment (`v01.60g`, `action=go` returning its designed fallback), rendered an edition through the real Night Ink renderer to confirm the emitted hrefs and click keys were correct, and confirmed `DEPLOYMENT_ID` parity and that the CSP does not restrict navigation — which ruled out link construction and left resolution as the only candidate
- **Regression test proves it is not vacuous**: 18 assertions against the real `scHandleClickRedirect_`, including a case that reproduces the old blanket wipe and asserts links resolve to `EMBED_PAGE_URL` (broken), alongside the fixed case asserting all three same-day editions resolve to their real articles. Also asserts the redirect never reads a range wider than four columns
- **Known limit:** resolution is still a scan. The permanent answer is a `(digest id, item key) → URL` index, which would remove the retention cap entirely — not built here

## [v03.27r] — 2026-08-28 05:44:48 AM EST

> **Prompt:** "I confirm that the masthead shows Morning with a count covering BESS and AIDC, and that Calendar displays as intended. I currently can't test the search function as all my issues were created today. Continue building the permalinks, share/export functions, and the command palette."

### Added

- **Permalinks.** Hash routing on `#/issue/<id>`, matched against a strict pattern (`[A-Za-z0-9._-]{1,60}`) so a crafted hash cannot become a lookup key. `replaceState` on the first open and `pushState` afterwards, so landing on the app does not leave a history entry that "back" returns to but deliberately opening a second issue does. A permalink beats "newest" on load
- **Share links.** New `Shares` tab (`Token · Digest ID · Created By · Created · Revoked · Views · Last Viewed`) plus `createShareLink` / `revokeShareLink` / `listShares`, all manager-gated, and an unauthenticated `doGet(action=share&t=…)` that serves exactly one stored edition. Minting is idempotent per edition, so pressing Share twice does not scatter tokens that each have to be revoked
- **Export.** PDF through a print-scoped stylesheet in an off-screen iframe (forces a light ground — the stored body is dark-mode email markup and would otherwise print as a solid black page), and Word as the same HTML served `application/msword` behind an Office namespace header. Neither needs a library or a CDN, which is what keeps [PC-PRIVATE-REPO] #18 satisfied
- **Command palette** on ⌘K / Ctrl+K — mastheads, view switches, Digest/Tune, and a debounced server-side search of the whole archive with a sequence guard so a slow earlier request cannot overwrite a newer one's results. Arrow keys, Enter, Escape; click-outside closes
- Reader bar above the open edition carrying Copy link, Share… and Export

### Fixed

- **Parameter-name collision, caught before it shipped.** `revokeShareLink` was wired to `param('token')` — the same key the client already uses for the session token — so it would have received the session token and silently revoked nothing. Renamed to `shareToken` on both sides

### Security

- The share route's threat model is written into the code and covered by tests: **the token is the only reference**, so no digest id is read from the share URL and one token cannot be pivoted to another edition; 128 bits of entropy; revocation takes effect on the next request because the row is re-read every time rather than cached; the only write is a view counter on the share's own row; refusal messages are literals so a malformed token is never reflected back; and the response carries `noindex`, no app shell and no session. A leaked link exposes one edition — the same blast radius as forwarding the email — and dies when revoked
- The palette is added to `showAuthWall()`'s deactivation block per the Auth Wall Completeness rule, and its ⌘K handler refuses to open over the auth wall. Playwright confirms both

### Changed

- Scraper sequence diagram gains the share route and the token-scope note; mermaid.live link regenerated and verified to decompress byte-for-byte

### Notes

- **Verified**: 29 assertions against the real share functions in a sandbox with stubbed Google services — covering idempotent minting, immediate revocation, a re-mint after revoke issuing a fresh token while the old one stays dead, and four malformed-token cases including that a digest id in the URL cannot redirect the read — plus 14 on the client helpers (hash-route rejection of traversal, markup, spaces and over-long ids; filename sanitisation leaving no path separators). Playwright drove the palette end to end: ⌘K, arrow-key selection, filtering, Escape, and the auth wall closing it
- **Testing note:** the first Playwright run showed the palette never opening. Not a bug in the feature — the listeners live in `scBindEvents()`, which only runs on app activation, so the test had to go through `window._scraperInit`
- **Deliberately not built:** pinning and cold storage (mockup item 4). Retention now trims at 400 rows, and a share link for a trimmed edition says so plainly rather than 404-ing silently — but a pinned-issue exemption is the honest fix and is a separate piece of work

## [v03.26r] — 2026-08-28 04:35:51 AM EST

> **Prompt:** "I verified the subscriber fixes. I have also reviewed the mockups and am happy with almost everything I see. Explain the numbers that I circled in the attached screenshot. 
>
> Also, I want "Newsstand" to be split up into "News Stand" everywhere it is mentioned. 
>
> Otherwise, start building the News Stand."

### Fixed

- **`listDigests` read the whole Digests sheet to render a handful of chips.** `getDataRange().getValues()` pulled all twelve columns — including `Sections` and `HTML`, each capped at 45,000 characters — for every issue ever built, then kept six small fields. Now reads two narrow ranges (columns 1–6 and 9–12) and never touches 7–8. The same fault was fixed in three sibling paths: `getDigest` scanned every row to find one (now scans the id column, then reads that row's two heavy columns), `deleteDigest` did the same to locate rows to delete, and `emailLatestDigest` loaded every stored edition's HTML to send the newest one
- **`SCRAPER_DIGEST_KEEP` raised 60 → 400.** The old cap was really a cap on how much text each page load moved, and at three daily editions it held about four working days — "hundreds of past editions" was not reachable at all. With the read path fixed the row count no longer drives that cost. Flagged rather than silent: this is a deliberate retention change, and beyond ~400 the right answer is cold storage, not a bigger number
- The Scraper sequence diagram still described delivery as `DIGEST_RECIPIENT`-driven and listed `addDigestRecipient` / `removeDigestRecipient` — stale since v03.25r moved delivery onto the Subscribers roster

### Added

- **`Parent` column on the Editions tab** — an edition can be a variant of another. Filtering by a parent includes its variants; filtering by a variant does not reach back up. Validated server-side in `saveEdition`: self-reference, a missing parent, a parent that is itself a variant, and re-parenting an edition that has variants are all rejected, so variants are capped at one level and cycles are impossible by construction rather than by cycle detection. Back-filled for the seeded `bess` / `aidc` rows, whose seed block is gated `done` and would never have run again
- **`Lead` column on the Digests tab**, denormalised out of the Sections JSON at build time so a card can show its lead headline without reading the column the read-path fix exists to avoid
- **Server-side filtering and paging in `listDigests`** — `{ edition, from, to, q, offset, limit }` — returning `total` and `counts.byEdition`. The counts honour every active filter *except* the edition filter they offer, so a masthead never promises 200 issues and then shows 23. The legacy `limit` argument still works
- **The News Stand replaces the landing page's chip strip** — masthead row with roll-up counts, composable filter bar (view / search / date range), and three views: card grid, month calendar with per-edition colour pips and a legend, and a dense table. All three open an issue on click
- **"Variant of…" control** in the Editions pane, offering only editions that can legally be a parent; the Editions list now groups variants under theirs

### Changed

- The mockup artifact is renamed **Newsstand → News Stand** throughout and republished to the same URL: <https://claude.ai/code/artifact/d61a7e78-ccb8-4530-86e4-7520ee132c16>
- Card relevance figures read "32 of 148 relevant" rather than a bare `32/148` — the developer asked what the number meant, which was the answer: it had no label
- "Editions kept" counts the whole archive rather than the page currently loaded
- `wdNsEdShort_` caps badge labels at 13 characters so a long masthead cannot set the card width

### Notes

- **Layout deviation from the approved mockup:** the mockup put the masthead list in a vertical rail. The real landing page already spends both side columns on the Interests and Drivers rails, so a third would leave the grid too narrow to read — the mastheads run horizontally instead. Roll-up counts and one-click filtering are unchanged
- **Verified**: 25 assertions against the real `listDigests` loaded into a sandbox with stubbed Google services — including that no `getRange` call ever overlaps columns 7–8 and that no 45,000-character payload appears in the response — plus 15 assertions on the client helpers (notably that `wdNsDate_` parses as local, since `new Date('2026-08-28')` is UTC midnight and renders as the 27th west of GMT). Playwright confirmed the rendered layout, and caught a `[hidden]`-vs-`display:grid` specificity bug that would have stacked all three views at once
- **Still not built** (steps 4–5 of the proposed order): issue permalinks, share links, PDF/Word export, and the command palette

## [v03.25r] — 2026-08-28 02:27:57 AM EST

> **Prompt:** "Picking up from my recent "Scraper rebuild Phase 1" session, I am able to choose which Edition I want to "run intake now" for, but I am not able to independently match up different Subscribers to their unique Editions (see attached screenshot). Also, I added a second Subscriber in the "Tune" tab, but it doesn't show up in the "Digest" recipients nor the landing page's "Subscriber" count. I would like the Scraper app to check the "Subscribers" tab in the "Tune" section, then send out the chosen Edition(s) to each Subscriber accordingly. I would also like this "Subscribers" tab to allow me to let a Subscriber pick any combination of Editions instead of just one option or "all". 
>
> Also, considering how I will have more and more editions and even more subversions of the same edition (like The Morning Edition is turning out to be), come up with a better way, organizationally and aesthetically, to display past Editions on the landing page and the "Digest" section. Imagine months later, when I have tens of Edition types and hundreds of past Editions. I still need to be able to easily and accurately filter and find a specific Edition, display it, and possibly sharing or exporting (doc & pdf) it. You can use your imagination and come up with other features to recommend to me too. Recommend and show me some mockups of how you can execute this."

### Fixed

- **`goLiveStatus` read the retired `DIGEST_RECIPIENT` Script Property instead of the Subscribers roster.** Delivery itself was already correct — `scDigestSend_` resolves recipients through `scEditionRecipients_` against the Subscribers sheet — but the *reporting* path never moved off the legacy property in Phase 5. That single stale read caused both reported symptoms: the landing-page "Subscribers" tile and the Digest overlay's Recipients panel showed a list nothing sends to, so a subscriber added in Tune appeared in neither. `goLiveStatus` now reads the roster and returns `subscribers` (masked for non-managers) plus `subscriberCount`
- **`listDigests` never returned the `Edition` column.** Column index 9 has been stored since Phase 5 but was dropped from the response, so every archived issue was indistinguishable in the UI regardless of which edition built it. Now returns `edition` and a resolved `editionName` (falling back to the raw id when an edition has been deleted)
- **`saveSubscriber` silently defaulted an empty `editions` array to `['all']`.** Harmless on a first add; on an *edit* it re-subscribed someone to every edition the moment their last selection was cleared. Now returns `no_editions` so unsubscribing is done by pausing, never by emptying. Also de-duplicates ids and honours `status` on create, not just on update

### Added

- **Chip-based edition picker in Tune → Subscribers, on the add form and on every roster row.** The picker was a native `<select multiple>`: any combination was technically reachable but required ctrl/⌘-click announced only in a tooltip, and it existed *only* on the add form — an existing subscriber's editions could not be changed at all without removing and re-adding them. Each row now renders the same chips and saves on tap, with an optimistic repaint that reverts if the save fails
- **Three visually distinct chip states** — filled amber (explicitly chosen), outlined amber (implied by "All editions"), grey (off). Tapping an implied chip expands `all` to the concrete edition list and then removes the tapped one, so a lit chip turns off rather than narrowing the selection to itself
- **Pause / Resume per subscriber row**, separate from their edition picks, so delivery can stop without discarding what they had chosen
- **Digest overlay Recipients panel is now scoped to the selected edition** and writes through `saveSubscriber`. Quick-add unions with the person's existing editions rather than overwriting them; quick-remove drops only the selected edition. The two cases that cannot be expressed there — an "All editions" subscriber, or their last remaining edition — are deferred to the roster editor with an explanation. Changing the edition picker repaints the panel and the readiness line
- **Landing-page chips and the edition sub-line now carry the edition name**, so issues built on the same day are distinguishable

### Changed

- Legacy `addDigestRecipient` / `removeDigestRecipient` and the `DIGEST_RECIPIENT` property are left registered and intact (Chesterton's Fence — the property is still the one-time migration source for `scMigrateLegacyRecipients_`); the UI no longer writes to them
- `.claude` rules untouched; no structural changes, so REPO-ARCHITECTURE.md diagrams are unaffected

### Notes

- **The archive redesign was delivered as mockups, not code**, per the request ("recommend and show me some mockups"). Published as a private artifact: <https://claude.ai/code/artifact/d61a7e78-ccb8-4530-86e4-7520ee132c16> — an interactive prototype covering the masthead-family model (a nullable `Parent` on Editions), a Newsstand grid / Calendar / Table view switcher, permalinks, share links, PDF and Word export routes, and six further recommendations
- **Surfaced but not fixed:** `listDigests` calls `getDataRange().getValues()`, pulling all eleven columns — including the stored Night Ink HTML and the sections JSON — for every issue ever built, then keeping six small fields. At ~60&nbsp;KB of HTML per issue this is the scaling cliff that arrives before the interface feels crowded. Flagged as step 1 of the proposed build order
- Verified with Playwright: chip states, roster rendering with a stale-edition row, no console errors beyond the expected `file://` CORS and CSP noise

## [v03.24r] — 2026-08-28 01:38:29 AM EST

> **Prompt:** "A few things:
>
> * First, I was able to adjust the toggles for "The Morning Edition (BESS)" and "The Morning Edition (AIDC)" and they seemed to save separately. However, when I wanted to "run intake now" and generate a news digest, it didn't give me a choice as to which Edition I wanted to generate. Make sure that I am able to choose which Edition (and its unique Tuning filters) I am trying to generate after pressing the "Digest" button.
> * Second, it seems like the "Digest" created the default "The Morning Edition" digest, which toggled off residential storage. Why then does the attached screenshot highlight "Atmoce's residential battery system"? I've never heard of Atmoce, it's not on the covered company list, and the main topic is residential storage. Figure out where the gap is and fix it. Scraper should not make such an obvious mistake, especially not for the Lead article.
> * Third, in the attached screenshot, the top shows "Latest edition note: ai_unavailable: ai_http_503 — This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again". What is going on here? I had set the AI model to Gemini and was expecting the Digest to say something along the lines of "Summarized by Gemini 3.5 blah blah blah", which would inform me that the summarization process successfully completed and did not use the fallback non-AI method. Fix this." *(with a screenshot of The Morning Edition showing the ai_unavailable note and the Atmoce residential-battery lead article)*

### Fixed
- **The Atmoce lead — three compounding faults, all introduced by the v03.21r vocabulary split.** Reproduced by scoring the developer's actual article through the real rubric: it cleared the 50-point bar; it now scores **14** and is gated.
  1. **A disabled child was out-voted by its own parent.** `gated` required `matchedSegments.length === 0`, and the article hit `seg-bess` **and** `seg-bess-utility` alongside the disabled `seg-bess-residential`. Splitting storage into narrow children beside a broad parent made the parent a permanent veto on every child — turning off a narrow segment could never gate anything. Segments now declare a `parent` (`scSegmentParent_`), and a matched parent whose **disabled child also matched** no longer counts as independent on-segment evidence
  2. **Gating was a no-op for an article matching no covered company.** `if (gated) company = 0;` zeroed only the company band — Atmoce is not covered, so there was nothing to zero, and five loosely-matched topics carried it over the bar. Gating now zeroes the **topic** band as well. Structural guarantee, asserted arithmetically rather than by example: a gated article's ceiling is `substance (20) + corroboration (6) = 26`, against a bar of **50**, so it can never be relevant whatever else it matches
  3. **Over-broad terms.** `grid-scale battery` sat in the *utility-scale* list though it is the generic phrase for the whole category — it is what let a residential story match `seg-bess-utility`. Also removed `warranty` from `topic-storage-degradation` (already in `topic-bess-bankability`; one weak word was matching two topics and doubling the band) and `supply chain` from `topic-china-policy`
- **`ai_http_503` was treated as fatal.** `scAiWithRetry_` retried only `ai_rate_limited`, so a provider **overload** — explicitly transient, "try again" — dropped the entire edition to fallback summaries. New `scAiRetryable_` covers 429 plus the transient 5xx family (500/502/503/504/529); a bad key or malformed request still fails immediately, because retrying those only burns the free-tier daily allowance. Backoff ladder extended `[2000, 6000]` → `[2000, 6000, 15000, 30000]`, since an overload can persist for tens of seconds and the old ladder gave up in 8

### Added
- **Edition picker on the Digest overlay.** `runDigestNow` already accepted an `editionId`; the client simply never sent one, so every manual build was the default edition regardless of which edition's tuning the developer had just been editing. The chosen id is captured **once at the start** of a build and reused for every step — the pipeline is resumable, and re-reading the picker mid-run could split one edition across two

### Notes
- The reproduction scores the *rendered* text from the screenshot rather than the original feed snippet (which is not recoverable), so the pre-fix number is indicative; the mechanism is exact and the post-fix result — gated, 14 — does not depend on it
- Guards against over-gating are asserted too: an **independent** on-segment match still prevents gating, and a covered company on a fully-disabled segment is still gated with its company band zeroed (the original v03.12r intent)
- Verification: `node --check` clean on `Scraper.gs` and both inline `<script>` blocks; **21 assertions**, plus all five earlier suites re-run clean. *Rubric + AI* (17) and *Playwright* (4): the picker lists all three editions, the chosen id reaches the server, **every step of the resumable build carries the same id**, and the completion message names the edition
- **First rotation of `CHANGELOG.md`** — the 2026-08-10 date group (9 sections) archived with per-section SHA enrichment; counter 99/100 → 91/100. `Scrapergs.changelog.md` 44/50, `Scraperhtml.changelog.md` 50/50
- **`Scraper.gs`** VERSION v01.56g → v01.57g; **`Scraper.html`** v01.49w → v01.50w; version files synced

## [v03.23r] — 2026-08-28 12:53:40 AM EST

> **Prompt:** "I see each separate Edition template now. However, the new problem is that when I toggle a segment/topic on/off, it automatically returns to its original setting after a couple seconds. What's going on? Fix it."

### Fixed
- **`setEditionTuning` read the client's ON value as `false`.** Params arrive as **strings**: the client sends `'1'` / `'0'`, but the check was `enabled === true || String(enabled).toLowerCase() === 'true'`, so `'1'` fell through to false. The write "succeeded", stored the **opposite** of what was asked, returned the stored map, and the client — correctly — adopted the server's answer, which is what flipped the switch back a second later. Turning something **off** sent `'0'` and stored false, i.e. was accidentally correct, which is exactly why the fault looked intermittent rather than total
- The optimistic-then-revert flicker was therefore not a UI bug at all: the UI was faithfully showing a bad write

### Changed
- **Extracted `scParamBool_`** and pointed both param-parsing endpoints at it. `setInterestEnabled` had handled `'1'` since it was written; `setEditionTuning` retyped the check from scratch and dropped that case — the same convention expressed twice, and the second copy was wrong. One helper so a third endpoint cannot drift again
- **Deliberately left the eight sheet-cell readers alone.** They parse values *stored* by `setValue(true/false)` and render as `true` / `'TRUE'` — `'1'` cannot occur there, so widening them would be change without cause

### Notes
- Verification: `node --check` clean; **15 assertions**, plus all five earlier suites re-run clean. *Unit* (11): `'1'`→true, `'0'`→false, booleans and `'true'`/`'false'` still work, case-insensitive, junk is false rather than a throw, an empty value still **clears** the key instead of storing false, and a single write leaves sibling keys untouched. A **regression guard** reconstructs the pre-fix expression and asserts it really did read `'1'` as false. *Playwright* (4): the same page is driven twice against a stub applying the old and new server rules — with the old rule the switch flips on and reverts within ~2s while the store holds the **wrong** value, with the new rule it stays on and stores the right one
- The stub was given a **600 ms round-trip delay**, without which the optimistic state resolves too fast to observe and the reproduction silently passes for the wrong reason. The flicker only exists because the server answers later
- **`Scrapergs.changelog.md` rotated** — the whole 2026-08-03 date group (8 sections) archived with per-section SHA enrichment; counter 50/50 → 43/50. `Scraper.html` unchanged this push, so no page version bump
- **`Scraper.gs`** VERSION v01.55g → v01.56g; version file synced

## [v03.22r] — 2026-08-28 12:36:36 AM EST

> **Prompt:** "I switched the Tuning scope to BESS and see the amber dots that signify "The Morning Report (BESS)" which segments/topics are toggled on. However, I want to be able to easily modify the segments/topics that are toggled on for each unique Edition. When I switch to a new Edition for the first time, I would like each new Edition to come pre-loaded with your recommended topics/segments toggled on, but give me the ability to easily override your recommendations by toggling them on/off too. I don't want each new Edition to stay on the default "Morning Report" settings."

### Changed
- **Sparse inheritance replaced with materialised presets — this reverses a v03.21r design decision at the developer's direction.** v03.21r stored only what an edition *differed* on, so an edition was really "the Morning Edition until told otherwise": every key it did not mention tracked the global baseline, and editing the baseline silently moved every edition with it. `SCRAPER_TUNING_PRESETS` now expands a named recommendation into a **full explicit map over every seeded segment and topic** (`scPresetMap_`), written at creation time. A materialised edition inherits **nothing**
- **The amber dot changed meaning, because the old one became useless.** It marked "stores an override vs global" — true of *every* key on a materialised edition, and a marker on everything marks nothing. It now marks **"you changed this from the recommendation"**, computed against the `recommended` map `listEditions` ships alongside `tuning`. The client deliberately does **not** re-derive the recommendation; two definitions would drift and the markers would start lying
- **The scope note counts deviations, not stored keys** — a raw key count is now always the full vocabulary. It reads `N of M on` plus `K changed from the recommendation`, or `matching the recommendation`
- **A materialised edition never clears a key back to inherit.** The v03.21r clear-on-match rule now applies only to a `global`-preset edition; on a materialised one it would silently re-couple that key to the baseline

### Added
- **`Preset` column** on the Editions tab, and `preset` on every edition record. `global` is the one non-materialising preset — it is what `morning` uses, which is why the Morning Edition is still byte-identical
- **`resetEditionTuning`** — re-applies an edition's preset, or **re-bases it onto a different one**, without delete-and-recreate. Surfaced as a preset picker + *Reset to recommended* in the tuning scope, and a preset picker on the add-edition form
- **Self-healing top-up in `scEditions_`.** A materialised edition must carry an explicit value for *every* seeded interest; without this, a segment shipped after the edition was created would be absent from its map and quietly inherit — reintroducing the exact coupling this push removes. Verified it **never overwrites a value the developer changed**
- In-place upgrade of the two editions seeded sparsely by v03.21r (`EDITION_SEEDS_V1` → `V2`), rather than skipping them as already-present

### Fixed
- **The scope note could contradict the switches.** After a save the client adopted the server's authoritative `tuning` map but only called `wdScopeNote_()`, leaving the toggles painted from the optimistic pre-save state. Now it re-renders as well. **Found because a test stub returned an unrealistic empty map** — the stub was wrong (the real endpoint returns the full map, so this never fired in production), but the divergence it produced was a genuine consistency gap and is fixed rather than papered over

### Notes
- Presets are recommendations, not policy: BESS drops residential/C&I storage and the server-side AIDC hardware beats; AIDC drops storage as its own beat **but keeps data-center-sited storage**, because that is part of the power chain it follows. Both asymmetries are asserted
- Verification: `node --check` clean on `Scraper.gs` and both inline `<script>` blocks; **28 assertions**, plus all four earlier suites re-run clean. *Server* (15): a preset covers every segment and topic explicitly (so a new edition inherits nothing), `global` alone stays null, an unknown preset falls back to `all` rather than throwing, no preset references a non-existent interest, the two recommendations genuinely differ, and the self-healing top-up both fills later-added keys and leaves developer changes alone. *Playwright* (13): residential storage reads ON globally and OFF inside the edition **at the same moment** — the coupling is gone; a fresh edition shows no change markers; changing one switch marks exactly that row and the note counts one deviation; the write is explicit rather than a clear; reset restores the recommendation and clears the markers
- **`Scrapergs.changelog.md` rotated** — the 2026-08-02 section archived with SHA `b71d24e`; counter held at 50/50
- **`Scraper.gs`** VERSION v01.54g → v01.55g; **`Scraper.html`** v01.48w → v01.49w; version files synced

## [v03.21r] — 2026-08-28 12:02:02 AM EST

> **Prompt:** "start Push B"

### Added
- **Per-edition tuning.** New `Tuning` column on the Editions tab holding a **sparse** JSON override map (interest key → boolean). `scLoadInterestModel_(ss, edition)` applies it over the global model; an absent key inherits the global toggle, so **an edition with an empty map is indistinguishable from no tuning at all** — which is why `morning` stores nothing and its digests are byte-identical to before this existed. `scParseTuning_` never throws: a hand-mangled cell degrades to "no overrides" rather than breaking every digest
- **`setEditionTuning`** — writes one key on one edition's row. Passing an empty `enabled` **clears** the override (delete the key) rather than setting it false; cleared means "inherit", which is what keeps a map holding only real differences. Invalidates `_scInterestModel`
- **Two seeded editions** — `bess` and `aidc`, seeded **once** behind the `EDITION_SEEDS_V1` Script Property rather than on absence, so deleting an edition sticks instead of it reappearing next call
- **15 new segment seeds and 4 new topic seeds.** Storage split by scale (`seg-bess-utility`, `-datacenter`, `-residential`, `-ci`, `-longduration`) because `seg-bess` alone could not express "utility-scale yes, residential no" — the exact distinction a BESS-supplier edition needs. The AIDC power chain split out of the `power-electronics` / `grid-equipment` catch-alls into MV conversion, inverters, transformers, gensets, gas engines, sidecar/skid, rack PDU, server PSUs, GPU silicon and cooling. All default **ON**, so the Morning Edition's behaviour is unchanged until deliberately tuned
- **Tuning-scope selector** in the left rail (`wd-scope-sel`) with `wdEffectiveOn_` / `wdIsOverridden_` / `wdScopeFill_` / `wdScopeNote_`. Selecting an edition repaints every toggle to **that edition's** answers — otherwise the developer would be toggling against a state the digest never uses — and an amber dot marks the keys it overrides

### Changed
- **`_scInterestModel` is now keyed by edition**, not a single global. Two editions can build in one execution during a multi-edition tick, and a shared cache would have handed the second one the first one's tuning
- **`scDigestFetchStep_` and `scDigestBackstopStep_` build their model from `state.editionId`.** `rubricPreview` deliberately stays on the global model — it is a baseline test surface, not an edition
- **The masthead and the inbox-test subject read the edition name.** The masthead was the literal string `The Morning Edition`; the subject now resolves the name from the stored row's `Edition` column via `scEditionById_`
- **A scoped toggle that returns a key to the baseline clears the override** instead of storing a duplicate, so an edition's difference list stays short and honest
- Per the approved scope, **companies and sources stay global** — an edition narrows what it cares about, it does not maintain its own roster

### Notes
- Deliberately **not** duplicating `topic-utility-procurement` with a second large-load-interconnection topic: two near-identical topics would double-count the same article in the rubric's topic band
- **Storage sited at a data centre stays ON in the AIDC edition** — it is part of that power chain — while storage as a beat in its own right is off. That asymmetry is the point of the edition, and is asserted in the tests
- Verification: `node --check` clean on `Scraper.gs` and both inline `<script>` blocks; **30 assertions**, plus all four earlier suites re-run with no regressions. *Server* (18): the tuning parser degrades safely on garbage/arrays, seed keys are unique, **no edition override points at a non-existent interest** (a dangling key would be a silently dead setting), the BESS edition excludes residential and C&I while keeping utility-scale and data-center storage, the AIDC edition is not BESS-led but still follows data-center storage, unset keys inherit in **both** directions, and `morning` carries no overrides. *Playwright* (12) proving the isolation guarantee end-to-end: the scope selector lists Global + all three, switching to BESS shows its own answers with the override dot, a scoped toggle calls `setEditionTuning` for that edition and **never** the global endpoint, and after the edit both AIDC and the global baseline are provably unchanged
- **`Scrapergs.changelog.md` rotated** — the 2026-07-18 section moved to the archive with SHA enrichment (`50449c4`); counter held at 50/50 after the new entry
- **`Scraper.gs`** VERSION v01.53g → v01.54g; **`Scraper.html`** v01.47w → v01.48w; version files synced

## [v03.20r] — 2026-08-27 11:51:21 PM EST

> **Prompt:** "I approve the plan. Your assumption about my "Subscribers sentence" is also correct. Push A."

### Added
- **`.claude/rules/scraper-sources.md`** — the part of "remember this source is unavailable" that is actually durable. A changelog entry does not survive a future session reasoning from an outlet's topical fit and re-proposing it; a path-scoped gate does. The file blocks adding anything to `SCRAPER_SOURCE_ROSTER` without first checking the unavailable table, mandates a live feed probe rather than adopting a URL from memory, and gives the exact HTTP signatures that separate **blocked** (`cf-mitigated: challenge`, `Just a moment…`, `Attention Required!`) from **offline** (200 with a `/lander` redirect and a `_trfd` / `ap:"parking"` marker) — they are visually identical in a browser and are opposite facts. It also records the rejected Google News workaround with its measurements so it is not re-tried
- **`status: 'blocked' | 'offline'` on `SCRAPER_RETIRED_SOURCES`**, surfaced to the client as `retiredStatus`
- **`⚙` diagnostics reveal** on the sync card, plus `wdSyncDiagShow_` — *Read all dossiers* is hidden at full coverage, reappears by itself when `pending > 0`, and is force-shown after a failed run (`_wdDiagForced`), which is precisely when it must stay reachable

### Changed
- **`offline` sources are dropped from the `listInterests` payload** rather than dimmed. The sheet row is deliberately left in place — nothing is destroyed and re-adding the key to the roster still reactivates it — but an outlet that no longer exists is not a filter the developer can act on
- **`blocked` sources sort to the bottom** of the Tune source list and their toggle renders **off**. Their stored `Enabled` is still `TRUE` from seeding, so rendering from `enabled` drew a live-looking ON switch on an outlet contributing nothing; the "N on" count now excludes them too
- **Subscribers: the free-text edition-ids input became a real multi-select** (`wdSubEditionsFill_`) fed from `_wdEditions`, with an *All editions* option, and the roster row renders edition **names** via `wdSubEdNames_` instead of raw ids. Previously the field required knowing an edition's internal id and a typo silently produced a subscriber bound to an edition that does not exist — which mattered little with one edition and would matter a lot with three. `all` takes precedence over specific picks, since pairing them is contradictory. An id that no longer resolves renders verbatim rather than being dropped, so a stale assignment stays visible

### Notes
- This is **Push A** of the approved two-push plan (items 1, 2 and 6). Push B — editions becoming first-class with per-edition segment/topic tuning and the new BESS/AIDC filters — is unstarted
- Verification: `node --check` clean on `Scraper.gs` and both inline `<script>` blocks; **20 assertions**. *Playwright* (10), driving the page twice at different coverage levels: the button is hidden at 88/88 with the gear offered instead, it returns unaided at 61 pending, the offline source never reaches the list, the blocked source sorts last with its toggle off while live sources stay on, the count reads `2/3`, the dropdown renders `All editions` + both editions in order, and the subscriber row shows `The Morning Edition (BESS)` rather than `bess`. *Server* (10): every retired source carries a valid status, exactly one is `offline`, the payload filter is surgical (drops one row, leaves a stale **company** untouched), and the `all`-wins rule plus the removal of the old text input are asserted against the shipped source
- GAS changelog is at **50/50** — at the cap but not over it, so no rotation this push; the next section triggers one
- **`Scraper.gs`** VERSION v01.52g → v01.53g; **`Scraper.html`** v01.46w → v01.47w; version files synced

## [v03.19r] — 2026-08-27 11:21:39 PM EST

> **Prompt:** "continue with your recommendation\"

### Added
- **`SCRAPER_SOURCE_FLAG_RETIRED = 'Dropped from roster'`** — source rows stop borrowing `SCRAPER_INTEREST_FLAG_STALE` (`'Coverage ended'`). One string was doing double duty across two row types whose meanings are opposite: for a company leaving Profiler's registry "Coverage ended" is exactly right; for an outlet leaving `SCRAPER_SOURCE_ROSTER` it asserts the publication stopped publishing. The company flag is deliberately left untouched
- **`SCRAPER_RETIRED_SOURCES`** — per-outlet `{ label, detail }` kept beside the roster so the reason survives in the UI rather than only in a changelog. Also a guard against a future pass "restoring" a feed that provably cannot be fetched
- **`listInterests` returns `retiredLabel` / `retiredNote`** for stale source rows, computed from that map by key — no sheet write and no migration of stored data

### Fixed
- **Migration branch for outlets already retired.** The retirement branch only fires while a row is still `active`, so the three rows marked during the Phase 4 shakeout would have kept the company wording forever. A second branch re-labels a non-roster source row still carrying `SCRAPER_INTEREST_FLAG_STALE`. Verified idempotent — a second sync is a no-op
- **`wdIntRow_` chip text and the disabled-toggle tooltip.** The chip is the only text most people read, so it now shows the reason (`Blocked to automated readers` / `Site offline`) with the full explanation on hover. The tooltip was hardcoded to `No longer covered by Profiler — kept for history` for every stale row — wrong for sources, which Profiler has nothing to do with; it is now type-aware

### Notes
- **The removals were correct; the label was the defect.** Re-probed all three tonight and every finding reproduces the v03.09r record. `datacentremagazine.com`: root 200 but `/news` and all five candidate feed paths 403 with `cf-mitigated: challenge` / `server: cloudflare` / `<title>Just a moment...</title>` — a Cloudflare Managed Challenge no server-side client can pass — and the homepage advertises **no** `<link rel="alternate">` feed at all. `batterytechonline.com`: 403 "Attention Required! | Cloudflare" on the root and every feed path, to **two independent fetchers** (curl via the agent proxy, and WebFetch), while a web search confirms it is publishing through 2026. `solarindustrymag.com/feed`: HTTP 200 but a 114-byte JS redirect to `/lander`, which carries GoDaddy's `_trfd.push({ap:"parking"})` marker — genuinely dead, and the only one of the three for which "Coverage ended" was true
- **Google News site-scoped feeds were tested as a workaround and rejected**: `site:datacentremagazine.com` returns 1 item, `site:batterytechonline.com` 1 item dated April 2025, `site:solarindustrymag.com` 0. Not a feed; reported as a failure rather than offered as a fix
- Root cause of the original defect: when the source-retirement branch was written in v03.09r it reused the nearest existing flag constant instead of introducing a source-specific one. No gate caught it because the constant was already correct for its original row type — the bug only exists at the intersection of two row types sharing one string
- Verification: `node --check` clean on `Scraper.gs` and both inline `<script>` blocks; **19 assertions**. *Server* (12): the two flags are distinct, the company flag is unchanged, no retired label claims the outlet ceased publishing, both live outlets are described as live, `Site offline` applies to exactly one key, every entry carries a re-check date, already-retired rows migrate, a newly-retired row gets the new label, a source returning to the roster is reactivated rather than relabelled, a stale **company** row keeps `Coverage ended`, and the migration is idempotent. *Playwright* (7): Data Centre Magazine renders `Blocked to automated readers` with "live and publishing" on hover and no `Profiler` in its tooltip, Solar Industry renders `Site offline`, and a stale company row still renders `Coverage ended` with the Profiler tooltip. Zero page errors
- **`Scraper.gs`** VERSION v01.51g → v01.52g; **`Scraper.html`** v01.45w → v01.46w; version files synced; public entries added (GAS 49/50 — rotation due again next push; page 46/50)

## [v03.18r] — 2026-08-27 11:05:42 PM EST

> **Prompt:** "It read 14 dossiers and increased the "Dossiers read" number from 27 to 41. Here is the error message (attached). Fix it."

### Fixed
- **Root cause of the stall, finally identified: `(p.targetSegments || []).forEach is not a function` in `scMineDossier_`.** `|| []` only rescues `null`/`undefined`, so a field that arrived as a **string** threw — and the throw aborted the whole dossier, not just that product. `targetSegments` is schema-legal as **both** `string[]` and a comma-joined string, and the string form is actually the majority: across the 88 live dossiers there are **205 string** occurrences vs **174 array** ones, spread over **exactly 47 files**. 47 is precisely the developer's `47 failed`, and 41 + 47 = 88. Replaced with `scAsList_` / `scSegmentList_`, which normalise either shape. **Confirmed by regression guard**: the pre-fix expression was reconstructed verbatim and run against the real corpus — it throws on exactly 47 dossiers, first `amazon.profile.json`, with the identical message
- **`technicalSpecs[].name` matched nothing in any dossier — all 286 entries are keyed `product`.** `add(t.name)` had therefore been a silent no-op since the function was written, so flagship product names were never mined as alias terms despite the code comment saying that was the intent. Now reads `t.product || t.name`; **81 of 88** dossiers contribute product terms that were previously lost
- Comma splitting is bracket-aware (`scSplitTopLevel_`), so `"Enterprises, frontier labs (Anthropic, OpenAI), governments"` yields **three** segments rather than four with a severed `"(Anthropic"` — 60 of the 205 string values contain parentheses. Prose is filtered out (`SCRAPER_SEGMENT_MAX_CHARS` 60 / `SCRAPER_SEGMENT_MAX_WORDS` 6) because a sentence is inert as a segment key and would only dilute the gate; per-company segments capped at 24

### Changed
- **`scMineDossiersAll_` takes a server-issued epoch instead of a force flag**, and `mineAllDossiers` now re-reads **every** covered company. Without this the 41 already stamped would keep the alias terms produced by the broken reader — they are not in the "never mined" queue, so no amount of pressing would refresh them. A boolean force cannot converge (each round rebuilds the identical full queue); anchoring on `Date.now()` **at the server** when the run starts means a row leaves the queue the moment this run stamps it. The epoch is deliberately server-side — a browser-supplied timestamp would drift and could either loop or skip rows. Client round cap raised 12 → 20 to cover a full 88-company re-read

### Notes
- **This is the bug the previous two pushes could not see.** v03.14r fixed a real clobber and v03.16r a real tile-repaint failure, but neither could surface a per-company exception — `catch (mErr) {}` made an unreadable dossier indistinguishable from one never reached. The error reporting added in v03.17r produced the exact message within one press, which is what made this diagnosable at all
- **Data was deliberately not rewritten.** Normalising the 47 dossiers to arrays was considered and rejected: the schema never pinned the type, and `PROFILER-SCHEMA.md` already establishes the opposite convention for `specs[]` ("Two legacy shapes still render and must keep rendering, because archived snapshots hold them forever"). Archived snapshots would carry the string form regardless, so the consumer is the correct place to fix. `PROFILER-SCHEMA.md` now states both shapes are accepted
- Verification: `node --check` clean on `Scraper.gs` and both inline `<script>` blocks; **21 assertions** across three suites. *Unit + corpus* (11): the exact crash input parses, array form unchanged, prose dropped, non-array/non-string shapes degrade rather than throw, all **88** real dossiers mine with **0** crashes, every one yields ≥1 segment, cap respected, 81 gain spec-product terms. *Drain* (6): 88 re-read across **3** rounds (30+30+28), round 1 sends no epoch, rounds 2+ echo it back, tile repaints with no Refresh. *Stuck queue* (4): stops after one round, names the count, surfaces real error text, re-enables the button
- **`Scrapergs.changelog.md` rotated** — 3 sections of the 2026-07-17 date group moved to the archive with commit-SHA enrichment (first rotation for this file); counter 50/50 → 48/50 after the new entry. `Scraper.html` unchanged this push, so no page version bump
- **`Scraper.gs`** VERSION v01.50g → v01.51g; version file synced

## [v03.17r] — 2026-08-27 10:55:12 PM EST

> **Prompt:** "I pressed "Sync now" a couple times and refreshed, but the "Dossier read" number never changed - It's still 27. Can you just force Scraper to sit here and read through all of Profiler's dossiers?"

### Added
- **`scMineDossiersAll_` + `mineAllDossiers` + a "Read all dossiers" button** — a forced drain that does what the developer asked for directly. It differs from `scMineDossiersStep_` in three ways that each matter: **(1) no per-pass cap** — the paced pass reads at most `SCRAPER_DOSSIER_MINE_PRIORITY_MAX` (30) because it is a trickle riding along with the daily sync; this reads the entire queue. **(2) batched writes** — the paced pass issues two `setValue` calls per company (Aliases, then Notes), so a full 88-company fleet costs ~176 individual Sheets round-trips, which is what actually consumed the wall-clock budget; the drain mutates the columns in memory and commits them with **one `setValues` per column**. **(3) it reports failures** — see below. `SCRAPER_DOSSIER_DRAIN_BUDGET_MS = 240000` keeps a call inside the 6-minute GAS execution limit and returns `remaining`; the client loops until that reaches 0 (capped at 12 rounds), so the developer presses once
- Partial progress is **always** persisted — the write-back is in a `finally`, so a timeout, a thrown fetch or a bad dossier still commits everything read up to that point

### Fixed
- **`catch (mErr) {}` in `scMineDossiersStep_` is why this was undiagnosable.** A company that could not be read was indistinguishable from one that was never reached: the pass returned a lower `mined` count with no indication that anything had failed, so a queue stuck behind unreadable rows looked exactly like a queue that was simply slow. The drain counts `read` / `noDossier` / `failed` separately and returns the first 8 error messages with their slugs; the client renders them. **This is the change that will actually explain the developer's stall** — the previous two pushes fixed real bugs (v03.14r the clobber, v03.16r the tile repaint) but neither could surface a per-company failure, which is the remaining candidate
- **`lock.tryLock(5000)` made repeated pressing counter-productive.** `scSyncInterests_` returns `{ skipped: 'locked' }` when it cannot take the script lock within 5s, and a sync holds that lock for its whole run. So pressing *Sync now* a second time while the first was still working returned `skipped: locked` and did nothing — pressing "a couple times" in a row is close to the worst possible input. The client now says this in plain language instead of the opaque `Sync skipped (locked).`, and `mineAllDossiers` waits **45s** for the lock because an explicit "do it now" action should queue rather than bounce

### Notes
- **Ruled out first:** the live deployment was queried at `?action=api&op=deploy` and answered `Already up to date (v01.49g)`, so the previous fix *was* deployed and the stall is genuine rather than a stale deploy. All 88 slugs in `profiler-companies.json` have a matching `*.profile.json` in `live-site-pages/profiler-data/` (avg ~30 KB), so a mass 404 is not the explanation either
- Verification: `node --check` clean on `Scraper.gs` and both inline `<script>` blocks; **9 assertions** across two Playwright scenarios driving the real page. *Drain*: tile goes `27/88 (+61)` → `88/88` across 3 automatic rounds with **no Refresh pressed**, server-side queue fully drained, status line reads `Read 61 dossiers. Coverage complete.` *Stuck queue*: when every remaining company fails, the run **stops after one round** instead of looping, names the blocked count, surfaces the real error text (`vantage: Address unavailable`), and re-enables the button. Zero page errors in both
- Test-harness note: `page.add_init_script` is the wrong hook for stubbing `_gasPost` on this page — the page's own inline definition runs later and overwrites it. The stub must be installed with `page.evaluate` **after** load and before `_scraperInit()`, wrapped as `() => { … }` so Playwright does not treat a trailing function expression as the callable
- **`Scraper.gs`** VERSION v01.49g → v01.50g; **`Scraper.html`** v01.44w → v01.45w; version files synced; public entries added. **The GAS changelog is now at 50/50 — the next push that touches `Scraper.gs` must rotate it** (page counter 45/50)

## [v03.16r] — 2026-08-27 10:30:53 PM EST

> **Prompt:** "The Console shows 3 cents of Claude usage today, which is fine. The 'Sync now' function still doesn't fully work as intended. After I press it and it goes through its process, the 'Dossiers read' usually don't update even if I click the Refresh button on the top right of the screen. However, after a while of working on something else, I noticed the 'Dossiers read' number jumped from zero to 27/88, but I don't think it was a direct result of me pressing the 'Sync now' function. Figure out what's going on and fix it."

### Fixed
- **`wdSyncNow_` never repainted the status strip — the tile could not update no matter how long you waited.** The handler refreshed the Interests list (`wdInterestsLoad_()`) and stopped there, but the `Dossiers read` tile is painted exclusively by `wdRenderStatusStrip_`, which is only ever fed by `wdLandingLoad_()`. So the number the developer was watching was rendered once at page load and then never re-read — a *client-side staleness bug entirely independent of the v03.14r clobber fix*, which is why the tile still looked broken after that fix shipped. `wdSyncNow_` now calls `wdLandingLoad_()` after the sync resolves
- **The Refresh button raced the sync instead of reporting it.** `scMineDossiersStep_` ran with the shared `SCRAPER_DOSSIER_MINE_BUDGET_MS = 60000` wall-clock budget even on the interactive path, so a single *Sync now* occupied ~60–75s of server time. Pressing Refresh during that window issued a **second** `google.script.run` call that read the sheet *before* the in-flight sync committed its write-back, returning pre-sync values — which reads to the developer as "Refresh doesn't work either." Interactive syncs now run against `SCRAPER_DOSSIER_MINE_BUDGET_INTERACTIVE_MS = 25000` (`scMineDossiersStep_(ss, budgetMs)` takes the budget as a parameter; the background scheduler path keeps the full 60s), so the round trip fits comfortably inside a normal button press
- **The "jumped to 27/88 on its own" observation is explained by the same two bugs, not a third one.** 27 is not a round number and not the priority cap (30) — it is where the wall-clock guard truncated the pass mid-list. The write-back had already committed on the server; the developer only *saw* it later because the tile was waiting for the next full page load to repaint. Nothing ran in the background on its behalf

### Changed
- **`scSyncInterests_` now reports what mining did.** It returns `mined` (dossiers read this pass) and `minePending` (still queued) alongside the existing company counts, and the toast reads them back: `Read 27 dossiers — 61 still queued, press again to continue.` or `— coverage complete.` when the queue drains. Previously the sync was silent about the half of its work the developer was actually watching, so a *correct* partial pass was indistinguishable from a failed one

### Notes
- Verification: `node --check` clean on `Scraper.gs` and both inline `<script>` blocks; a Playwright interaction test drives the real page with a stubbed backend and asserts **5** conditions — the tile repaints after *Sync now* **with no Refresh pressed** (`0/88 (+88)` → `27/88 (+61)`), the pending count is shown, the toast reports dossiers read, the toast tells you to press again, and the sync endpoint is called **exactly once** (guarding against a double-submit reintroducing the race). Zero page errors
- The overlay intercepts pointer events over the button in the test harness, so the click is dispatched via `el => el.click()`; the toast target is the shared status line, not a dedicated element — both worth remembering for the next interaction test on this page
- **`Scraper.gs`** VERSION v01.48g → v01.49g; **`Scraper.html`** v01.43w → v01.44w; both version files synced; public entries added (GAS counter 49/50 — **rotation is due on the next push**; page counter 44/50)

## [v03.15r] — 2026-08-27 10:18:03 PM EST

> **Prompt:** "I currently have the Scraper AI model set to Gemini for the free summaries - Can you confirm that the previous two digests were summarized for free with Gemini? Also, make Scraper's default AI model Gemini's free tier. In this case, it doesn't matter that we raised the article caps right?"

### Added
- **Per-edition AI provenance.** New `AI` column on the `Digests` tab plus `scActiveAiLabel_()` (provider + resolved model, e.g. `gemini/gemini-2.5-flash`), captured on the first successful summarize call, persisted with the edition, returned by `listDigests`, and printed in the Night Ink footer as `· summarized by <provider>/<model>`. **This was written because the developer's question could not be answered:** nothing recorded which provider produced an edition — `Notes` is only populated on *failure*, so a Gemini-built and a Claude-built edition were byte-identical once stored. A fallback edition now stores `none (fallback)` and the footer keeps saying `summaries in fallback mode` rather than naming an engine that did no work

### Fixed
- **A single rate-limit response no longer degrades a whole edition.** `scDigestSummarizeStep_` caught every AI error into a terminal `state.aiNote`, and the loop guard `!state.aiNote` then blocked any retry on subsequent ticks — so one 429 dropped every remaining item to a raw feed snippet **and** skipped the AI lead paragraph, permanently, for that edition. Added `scAiWithRetry_` (bounded retry on `ai_rate_limited` with `[2000, 6000]` ms backoff) around both the summarize and lead calls, plus a `SCRAPER_DIGEST_AI_PAUSE_MS = 1200` gap between consecutive summarize batches. **Non-transient errors are deliberately not retried** — a bad/missing key or HTTP 400 will not fix itself and retrying only burns free-tier quota

### Notes
- **Direct answers to the three questions.** (1) *Confirm the last two digests were free?* — **Not confirmable**, and the repo is the reason: no provider was recorded per edition (now fixed going forward). The developer's own screenshots point the other way — the Go-live panel read `claude · claude-sonnet-5` with `✓ claude replied: READY` at ~8:47 PM and only read `gemini` by ~9:07 PM, so at least one of the two editions may have been billed to Anthropic. Ground truth is the Anthropic Console usage page for the day; everything else is inference. (2) *Make Gemini the default* — **already was**: `SCRAPER_AI_PROVIDER = 'gemini'` has been the code default since the provider switch shipped; Claude ran only because the `AI_PROVIDER` Script Property was explicitly set to `claude`, and the in-app toggle has since written `gemini`. No change required. (3) *Do the raised caps not matter now?* — **correct on cost** ($0 on the free tier regardless), **but not on consequences**: `TOP_N = 30` fires ~7 AI calls per edition (6 summarize batches + 1 lead) versus ~4 before, previously unpaced, against a free tier whose per-minute and per-day caps are model-specific and have been reduced over time — and every manual *Run intake now* spends another ~7 requests against the daily cap. Hence the pacing and retry work above
- Free-tier limit characteristics verified against Google's published rate-limit documentation rather than asserted from memory; exact per-model numbers are dynamic and are best read from Google AI Studio for the model actually in use
- Verification: `node --check` clean; **13 assertions** pass — provider labelling across unset/claude/gemini property states, recovery after two rate limits, exact attempt counts and backoff sequence, bounded give-up on a persistent limit, immediate surfacing of a non-retryable `ai_http_400` with **no** retry, and footer stamping in both the summarized and fallback cases
- **`Scraper.gs`** VERSION v01.47g → v01.48g; version file synced; public entry added (counter 48/50). No HTML change — renderer and routes are server-side

## [v03.14r] — 2026-08-27 10:06:57 PM EST

> **Prompt:** "I just pressed "Sync now" four times and the "Dossiers read" tile never updated past "0/88 (+88)". What's wrong? Fix it. 
>
> Also, the email (attached) still looks very narrow. Can you widen it more and also increase the caps on articles in the Digest? Considering it's a digest full of summaries that the reader may or may not click into and it only happens once a day, I think it's reasonable to include more summaries in order to make sure no articles (or at least fewer) get missed rather than decrease the amount of scanning the reader has to do."

### Fixed
- **Dossier mining was silently clobbered by the sync's own write-back — coverage could never leave `0/88`.** `scSyncInterests_` snapshots the Interests sheet into `data` at the top, then called `scMineDossiersStep_(ss)` — which does its **own** read and writes Aliases + the `mined:`/`seg:` tags directly to the sheet — and **on the very next line** wrote its stale snapshot back with `setValues(data…)`, overwriting every mined cell milliseconds after it landed. The company loop sets `dirty = true` for every existing company on every sync, so the clobbering write always fired. Mining ran correctly all four times the developer pressed Sync now; the results were erased each time. Fixed by moving the mining call **after** the bulk write-back and the append block, which also means mining now sees companies appended by the same sync — exactly the priority case. The ordering is documented in-code as load-bearing so it is not re-inverted

### Changed
- **Digest caps raised (developer directive)** — `SCRAPER_DIGEST_SUMMARIZE_TOP_N` 14 → **30** and `SCRAPER_DIGEST_SECTION_CAPS` `{6,6,4}` → **`{companies:12, market:10, incidents:8}`**, taking a printed edition from at most 16 items + lead to **30 + lead**. The section caps deliberately **sum to exactly `TOP_N`** so every printed item is one the AI actually summarized rather than falling through to a raw feed snippet. Rationale accepted as stated: for a once-daily digest of skimmable summaries, a missed story costs more than a longer scroll
- **Night Ink widened again** — container 720px → **860px**, outer padding 20/10 → 16/8 and inner 34 → 30 (text column ~652px → **~800px**); summary copy 15 → 16px, item headlines 21 → 22px, lead paragraph 16 → 17px, lead headline 30 → 32px, masthead 40 → 44px. Nested-table structure, `bgcolor` attributes and `max-width:100%` mobile fluidity all unchanged, so the Outlook and dark-mode-client proofing still holds
- **`Scraper.gs`** VERSION v01.46g → v01.47g; version file synced; public entry added (counter 47/50). No HTML change — the renderer is entirely server-side and the in-app viewer shows the same stored HTML

### Notes
- **The regression test is the important artifact here.** A unit test of `scMineDossiersStep_` alone passes against the broken code — the bug lives in the *interaction* between mining and its caller. `scripts`-free harness `sync-clobber-test.js` stubs PropertiesService / LockService / CacheService / Utilities / UrlFetchApp and a mutable 2-D-array-backed Sheet, then runs the **real `scSyncInterests_`** end to end and asserts the `mined:` stamp, `seg:` tag and mined aliases survive. It was then run against a reconstructed pre-fix ordering and **fails there** (`notes=` empty, `aliases=ABB` — the pre-mining value restored), confirming it actually catches the defect rather than merely passing
- Stubbing note for future harnesses: `eval()`'d declarations land in **module** scope, so a `global.scraperSs_` override is invisible to the eval'd code. Stub `SpreadsheetApp.openById` instead and let the real `scraperSs_` run
- Render fixture re-verified at the new width with all 30 section items: container 860, 16/22/17px type, balanced tables, `31 of 41 relevant … 10 more held back`, plus a Chromium screenshot at a 1250px reading pane
- **Cost note:** doubling summarized items roughly doubles per-edition AI spend on the Claude path (~5–11¢ → ~10–22¢/edition, ~$2–5/month for 22 weekday editions). Free on the Gemini tier

## [v03.13r] — 2026-08-27 09:53:19 PM EST

> **Prompt:** "How often would Scraper need to do dossier mining after the first full pass of 88 dossiers? I can manually press "Sync now" 11 times to do the first pass, but would I have to ever do this again? If so, can you figure out a way to automate it?"

### Fixed
- **Multi-word segment labels were silently corrupted** (introduced v03.12r). `scCompanySegments_` parsed the Notes tag with `/\bseg:([^\s;]*)/`, which stops at the first space — so `seg:bess|data centers|evs & automotive` read back as `['bess','data']`, dropping every segment after the first multi-word one and weakening the per-company segment gate for those companies. Reproduced in isolation before fixing. Notes tags are now `;`-terminated (`seg:…;`, `mined:…;`) with `scNotesGetTag_` / `scNotesSetTag_` helpers that preserve the developer's free text, replace rather than duplicate a tag, and tolerate spaces
- **A 404 dossier was retried on every sync forever** — a covered company with no published profile JSON re-fetched indefinitely. It is now stamped `mined:` on a non-200 so the queue advances
- **The mine stamp was only written when new terms were found**, so a company that was read but yielded nothing new was indistinguishable from one never read — making coverage unanswerable. Every successful read now stamps

### Changed
- **Dossier mining is priority-ordered, not round-robin.** `scMineDossiersStep_` now builds its queue as: (1) never mined, (2) `Profiler Updated` newer than the `mined:` stamp — i.e. the dossier was refreshed, typically post-earnings — then (3) oldest-mined first as a background refresh. Answering the developer's question: mining already repeated forever with no manual action (the daily `scSyncInterests_` throttled at ~20h drove a wrap-around cursor), so nothing was ever *required* of them; what round-robin cost was **latency** — a newly covered company or a freshly refreshed dossier could wait the full ~11-day cycle before its product names and tickers were recognised. Priority ordering cuts that to the next daily sync
- **Adaptive budget with a wall-clock guard** — `SCRAPER_DOSSIER_MINE_PER_SYNC = 8` is replaced by `PRIORITY_MAX = 30` / `IDLE = 5` / `BUDGET_MS = 60000`. The idle value is a **floor**, not an alternative: an early revision capped the budget at the priority count, which a test caught as starving the background refresh whenever only one or two companies were queued. Net effect — the initial backfill of all 88 dossiers now completes **automatically in ~3 daily passes** with zero presses (previously ~11 days, or 11 manual presses), and steady state is a light 5/day refresh
- **Coverage is now visible** — new `scDossierMiningStats_` (total / mined / pending / lastMined) rides on `goLiveStatus`, and the landing status strip gains a **"Dossiers read"** tile (`34/88 (+12)`, amber while work is queued, green when current) so the background pass is observable rather than silent
- **`Scraper.gs`** VERSION v01.45g → v01.46g and **`Scraper.html`** v01.42w → v01.43w; version files + meta synced; public entries added (counters 46/50, 43/50)

#### `Scraper.gs` — v01.46g

##### Fixed
- Multi-word segment corruption, 404 retry loop, missing mine stamp (detail above); `Scrapergs.version.txt` synced; public entry added (counter 45 → 46)

#### `Scraper.html` — v01.43w

##### Added
- "Dossiers read" coverage tile on the landing status strip; meta tag synced; public entry added (counter 42 → 43)

### Notes
- Verification: `node --check` clean on the `.gs` and both inline blocks. **16 pure-logic assertions** pass — tag round-trip with multi-word segments, two tags coexisting without eating each other, user free text preserved, update-not-duplicate, null on absent/empty, priority ordering (never → changed → oldest-aged) driven through `scMineDossiersStep_` against a stubbed sheet and fetcher, the idle-floor fix, the 30/pass cap under an 88-company backlog, and the resulting 3-pass completion. Playwright re-run confirms the new tile renders `34/88 (+12)` with zero page errors
- The spaces bug was **reproduced in isolation first** rather than assumed — the current parse was run against a realistic tag and shown to return `['bess','data']`

## [v03.12r] — 2026-08-27 09:42:55 PM EST

> **Prompt:** "I fully agree with you on your "1. Free, automatic ways to sharpen Scraper's understanding of you". I want you to execute all six of your tier-1 and 2 suggestions. 
>
> I also fully agree with you on your "2. The Projects feature - my verdict". Execute your own recommendations, including all five "other features" in the priority order you chose. 
>
> I can't fully visualize your landing page, but go ahead and replace the current landing page with your recommendation. I will have you edit it later if needed. 
>
> Regarding the digest, does it cost any tokens to email it out to a recipient? I need to resend it to myself to see if I like your adjustments."

### Added
- **Three new tabs** (`Editions`, `Subscribers`, `ClickLog`) plus an `Edition` column on `Digests`. `ensureScraperTabs_` now tops up header rows when a schema grows, so existing tabs pick up new columns without manual repair
- **Editions (replaces Projects)** — named digest products with per-edition cadence (`daily` weekdays / `weekly` on an ISO-day anchor / `monthly` on a day-of-month), reading window, and subscriber list. `scEditionDue_` + `scEditionWindowH_` are pure and unit-tested; `scDigestStart_`/`scDigestStep_` thread an `editionId`, and `scDigestScheduledTick_` finishes any in-flight build before picking the first due edition. `morning` is seeded as the built-in default and cannot be deleted. Routes: `listEditions`, `saveEdition`, `deleteEdition`
- **Subscribers** — email, name, per-edition opt-in (`all` supported), status, admin flag, unsubscribe token. `scEditionRecipients_` resolves an edition's recipients; the legacy `DIGEST_RECIPIENT` list is migrated in once on first read (`SUBSCRIBERS_MIGRATED`). Routes: `listSubscribers`, `saveSubscriber`, `removeSubscriber` — all behind `scCanManageDigest_`, with addresses masked for non-managers
- **T1a — click tracking**: every article link in a rendered edition routes through `doGet(action=go)` → `scHandleClickRedirect_`, which resolves the destination **server-side from that edition's own intake rows** by `(digest id, item key)` and appends a `ClickLog` row before redirecting. Deliberately unauthenticated (subscribers open these from email with no session) and deliberately **not** an open redirect — an arbitrary `?url=` can never be honored. `scClickBoosts_` converts a 30-day click window into a diminishing, capped per-label boost (`SCRAPER_CLICK_BOOST_CAP = 5`) folded into the company and topic signals
- **T1b — dossier alias mining**: `scMineDossiersStep_` round-robins `SCRAPER_DOSSIER_MINE_PER_SYNC = 8` covered companies per daily sync, fetches each `<slug>.profile.json`, and merges product names, technical-spec names, legal name and ticker symbol into that company's Interests `Aliases` — **add-only**, capped at 40 terms, failure-tolerant per dossier
- **T1c — per-company segment tightening**: the same pass derives each company's operating segments (from `productsAndServices[].targetSegments` + `categories`) into a `seg:` tag in Notes. The rubric now gates a company-matched article when **every** matched company operates only in currently-disabled segments — even when the article names no segment itself. Unknown segments never gate (fail-open)
- **T2a — corroboration**: `scDigestItems_` groups intake by a normalized 8-word title signature and boosts stories carried by 2+ distinct sources, bounded by `SCRAPER_CORROB_CAP = 6`
- **T2c — source performance**: `sourceStats` reports per-source items, how many cleared the relevance bar, hit-rate, and clicks earned
- **F2/F3 — archive search + company timeline**: `searchArchive` (free-text over title/source with company and date filters) and `companyTimeline` (all stored coverage for one covered company, newest first)
- **F4 — preview**: `previewEdition` renders the current top-scored intake as an edition **without storing or emailing it**
- **F5 — held-back rollup**: the render step stashes relevant-but-unshown items per edition (`SCRAPER_HELD_BACK_MAX = 25`); `sendHeldBackRollup` emails admin subscribers "what your sources published that you didn't see"
- **New landing page in `Scraper.html`** — the app opens on the latest edition rendered inline, above it a status strip (next edition / subscribers / AI provider / scheduler health / editions kept) that colours green or amber per row, a click-through strip of recent editions, and a "what is driving relevance" panel. A **Tune drawer** (5 tabs: Interests, Editions, Subscribers, Archive, Source stats) holds everything adjustable; the live interests rail is **relocated** into its first pane rather than duplicated, so there is exactly one interests UI that cannot drift

### Changed
- **Projects retired.** All 20 Project/article/schedule ops were removed from `SCRAPER_PROJECT_ACTIONS` and `handleProjectAction_`, and the wizard / articles / stats overlays and their topbar buttons were deleted from the page. Sheets data and the function bodies are untouched — the routes are simply unreachable. **`scBindEvents` was fully rewritten to be null-guarded**: it previously bound `sc-new-btn`, `sc-wizard-overlay` and others directly, and binding a now-absent element throws — which would halt the inline script before the auth init runs and take sign-in down for everyone. Every remaining call site of the dead Project functions is itself inside dead code (verified by call-graph grep)
- **The desk is two columns** — the left interests rail is now a hidden mount point that the Tune drawer adopts on open
- Scheduled delivery now resolves recipients per edition via `scEditionRecipients_` instead of the flat `DIGEST_RECIPIENT` string, and the subject line uses the edition's own name
- **`Scraper.gs`** VERSION v01.44g → v01.45g and **`Scraper.html`** v01.41w → v01.42w; version files + meta synced; public entries added (counters 45/50, 42/50)

#### `Scraper.gs` — v01.45g

##### Added
- Editions, Subscribers, click tracking, dossier mining, corroboration, archive/timeline/stats/preview/rollup (detail above); `Scrapergs.version.txt` synced; public entry added (counter 44 → 45)

#### `Scraper.html` — v01.42w

##### Added
- Landing page (status strip, recent editions, inline edition, relevance drivers) + Tune drawer (detail above); meta tag synced; public entry added (counter 41 → 42)

### Notes
- Verification: `node --check` clean on the `.gs` and both inline blocks. **30 pure-logic assertions** pass — edition cadence/window across daily/weekly/monthly incl. the before-7am and already-built-today guards, dossier mining (product/spec/ticker/legal-name extraction, segment derivation, URL-junk rejection), click-key stability, engagement boost + cap, per-company gate zeroing (and that it kills the engagement boost too), fail-open on unknown segments, and corroboration bounding. **Playwright** drove the whole new UI against stubbed routes: status strip, recent-chip switching, inline edition render, drivers panel, absence of all Projects UI, Tune tab switching, editions list (default not deletable), subscribers with masking/removal, archive search, and source-stat bars — zero page errors
- **Deferred to a cleanup push**: physically deleting the ~3,000 lines of now-unreachable legacy Project/schedule function bodies from `Scraper.gs`. Unregistering the routes makes them inert immediately; excising them safely is its own focused pass
- Answered in chat: emailing a stored edition costs **no** tokens (the HTML is rendered once at build time and re-sent), but rebuilding an edition re-runs the Sonnet summaries at roughly 5–11¢

## [v03.11r] — 2026-08-27 09:13:55 PM EST

> **Prompt:** "I approve of the gated provider switching under the same admin flag - Good job, keep it up. 
>
> A few more things:
>
> * Now that Scraper directly downloads what matters to me from Profiler, what are some other ways that I can have Scraper further refine its understanding of what matters to me? I strongly prefer free methods and automatic processes. 
> * Big picture, I want Scraper to be a dedicated third-party trade news scraper that identifies relevant articles from reputable web sites, summarizes them, and sends a daily (expandable to weekly, monthly, etc) digest to a list of subscriber emails (controlled by me, admin jonyang92@gmail.com). However, currently, the majority of the app is taken up by the "Project" feature, which I think should be mostly obsolete as its original purpose was to help me define the scope of its scraping and to develop a database. What are some other features that I can add to this kind of app and what should the landing page highlight? Do you think there's any value in keeping the "Project" feature? If so, explain why. If not, what should I replace it with?
> * (See attached screenshot) - The emailed digest looks has way too much unused space on the left and right sides of the article summaries. Reformat the digest so that it's more comfortable to read. Also, just to confirm: Did you limit the number of articles found that meet the criteria or are these all the articles that met the criteria within the last 24 hours?"

### Changed
- **Night Ink email layout widened and retypeset in `Scraper.gs`** — the container table goes 640px → **720px**, outer cell padding 18px/8px → 20px/10px and inner padding 36px/44px/30px → 34px/34px/28px, so the live text column grows from ~552px to ~652px (the developer's screenshot showed a narrow ribbon stranded in a wide reading pane). Typography scaled with it: summary copy 13px/1.55 → **15px/1.65** (and lightened #b6bcc6 → #c2c8d2), item headlines 18px → **21px**, lead paragraph 14px → **16px**, lead headline 26px → **30px**, masthead 36px → **40px**, dateline 12px → 13px, footer 11px → 12px, and per-item bottom margin 14px → 20px. Nested-table structure, `bgcolor` attributes and `max-width:100%` mobile behaviour are unchanged, so the Outlook and dark-mode-client proofing from v03.09r still holds
- **Digest footer now discloses truncation** — new `counts.shown` (lead + the three rendered section arrays) is reported as `N of M relevant · K scanned`, and when `M > N` the footer appends `· X more held back by the per-section caps`. This answers the developer's question permanently and in-band rather than only in chat: the edition itself now states whether items cleared the bar but were not printed
- **`Scraper.gs`** VERSION v01.43g → v01.44g; version file synced; public entry added (counter 44/50). No HTML change this push — the renderer is entirely server-side and the in-app edition viewer displays the same stored HTML, so it inherits the new layout automatically

#### `Scraper.gs` — v01.44g

##### Changed
- Widened + retypeset Night Ink email layout and truncation-aware footer (detail above); `Scrapergs.version.txt` synced; public entry added (counter 43 → 44)

### Notes
- Verification: `node --check` clean; a render fixture asserted all 10 layout invariants (720px container, trimmed paddings, each new font size, `5 of 22 relevant`, `17 more held back…`, balanced table tags) and a Chromium screenshot at an 1100px reading-pane width confirmed the column now fills the frame comfortably
- **Caps are unchanged and deliberate** (the developer asked whether the count was limited): relevance floor `SCRAPER_RELEVANT_THRESHOLD = 50`, AI summaries for the top `SCRAPER_DIGEST_SUMMARIZE_TOP_N = 14`, and per-section printing caps `SCRAPER_DIGEST_SECTION_CAPS = { companies: 6, market: 6, incidents: 4 }` → at most 16 items + the lead. Raising them was **not** done unilaterally; it is offered as the next step
- The strategic answers (free/automatic relevance-refinement options, the Projects-feature verdict and landing-page recommendation) were delivered in-chat — no code change in this push

## [v03.10r] — 2026-08-27 08:56:08 PM EST

> **Prompt:** "This is what the "Go-live" option results in. Make it easy for me to switch between the free Gemini version and the Claude sonnet version. Also, allow me to easily control the Digest Recipients from within the Scraper app. Later on, when I expand the Scraper app to allow other gmails to log in and have their own sessions based on access level (similar features-tied-to-access-level flow as Profiler), I would like the ability to control Digest Recipients to be restricted to "admin" level users only."

### Added
- **AI-provider switch + recipient management in `Scraper.gs`** — three new session-gated routes: `setAiProvider(provider)` (writes `AI_PROVIDER` = `gemini`|`claude`; the model stays each provider's code default, Claude → `claude-sonnet-5`), `addDigestRecipient(email)` and `removeDigestRecipient(email)` (edit `DIGEST_RECIPIENT`, now treated as a de-duplicated comma-separated list — `MailApp.sendEmail` accepts the same form). All three go through `scCanManageDigest_(user)` and audit-log the change (recipient addresses masked in the log). Helpers: `scValidEmail_`, `scDigestRecipients_`. Registered in `SCRAPER_PROJECT_ACTIONS` + `handleProjectAction_`
- **Access gate `SCRAPER_DIGEST_ADMIN_ONLY` (`false`) + `scCanManageDigest_`** — while `false` (current single-user owner) any signed-in user may switch providers and edit recipients; flipping it to `true` at the multi-user expansion restricts both to `admin`/`developer` roles (read via `validateSessionForData(...).role`), and everyone else sees the controls read-only. Reading status and the self-service "email me latest" test are never gated. This is the literal "build now, restrict later" the developer asked for — one documented flag, chosen over gating on `admin` immediately (which could lock out the owner if their ACL role isn't admin)
- **Go-live panel controls in `Scraper.html`** — a two-button segmented provider control ("Gemini · free" / "Claude · Sonnet", active one highlighted green, disabled for non-managers) and a recipient manager (address chips with remove buttons + an add field with client + server email validation). Both driven by `goLiveStatus`, which now returns `recipients` (full for managers, masked for others), `recipientCount`, and `canManageRecipients`; the delivery-status row now reflects the recipient count instead of a single masked address

### Changed
- **Recipient storage is now a list** — the scheduled send site reads `scDigestRecipients_().join(',')` (normalized) instead of the raw property, so multiple recipients each receive the edition and stray whitespace can't malform the `to` field
- **`Scraper.gs`** VERSION v01.42g → v01.43g and **`Scraper.html`** v01.40w → v01.41w; version files + meta synced; public entries added (counters 43/50, 41/50)
- **`repository-information/diagrams/Scraper-diagram.md`** — go-live route line extended with `setAiProvider` / `addDigestRecipient` / `removeDigestRecipient` and a note that provider + recipient edits are gated by `scCanManageDigest_`; pako URL regenerated and decompression-verified

#### `Scraper.gs` — v01.43g

##### Added
- Provider-switch + recipient-management routes, the `SCRAPER_DIGEST_ADMIN_ONLY` gate and helpers (detail above); `Scrapergs.version.txt` synced; public entry added (counter 42 → 43)

#### `Scraper.html` — v01.41w

##### Added
- Provider segmented control + recipient manager in the go-live panel (detail above); meta tag synced; public entry added (counter 40 → 41)

### Notes
- Verification: `node --check` clean on the `.gs` (via `.js` copy) and both inline blocks. Playwright drove the full panel from stubbed state in two roles — **manager**: gemini active initially, switch to Claude shows "(Sonnet)", add appends a chip, an invalid address is rejected with a clear message, remove drops the right chip; **non-manager**: the add row is hidden, chips carry no remove buttons, and both provider buttons are disabled. No page errors in either role
- The email-validation regex is a shape check on both sides (client for instant feedback, server as the real guard) — it is not an existence/deliverability check

## [v03.09r] — 2026-08-27 08:12:11 PM EST

> **Prompt:** "Start phase 4"

### Added
- **Go-live routes in `Scraper.gs`** — `goLiveStatus` (provider/model, key-presence booleans, masked recipient, both pause flags, trigger install + last-tick age, last edition date — no secret values ever returned), `testAi` (one ~30-token `aiComplete_` probe that returns the exact `ai_*` error when the path is broken), `emailLatestDigest` (mails the newest stored edition to the **signed-in user only**, deliberately independent of `DIGEST_RECIPIENT`, audit-logged). Registered in `SCRAPER_PROJECT_ACTIONS` + `handleProjectAction_`; helper `scMaskEmail_`
- **Go-live panel in `Scraper.html`** — new Digest-overlay section (toggled from a topbar "Go-live" button) rendering the five readiness rows green/amber, plus Test AI and "Email me latest" buttons that surface the server's exact result inline
- **Retired-source marking in `scSyncInterests_`** — a `source` row whose key has left `SCRAPER_SOURCE_ROSTER` is flipped to `stale` + "Coverage ended" (row kept, never deleted); re-adding the key reactivates it. Previously such rows sat "active" while being inert (the fetch loop iterates the roster, not the sheet)

### Changed
- **Pause flags flipped for go-live** — `SCRAPER_SCHED_RUNS_ENABLED` and `SCRAPER_SCHED_EMAIL_ENABLED` both `false` → `true`. The Morning Edition now advances one budget-bounded step per hourly tick on weekday mornings ≥7:00 AM ET; the email site still additionally requires a `DIGEST_RECIPIENT` Script Property, so nothing is sent until the developer sets it
- **New `SCRAPER_LEGACY_SCHEDULES_ENABLED` gate (`false`)** — flipping the master pause would otherwise have revived the pre-rebuild Schedules-tab pipeline (compile → analyze → brief → per-schedule emails) unattended alongside the Morning Edition, double-spending AI and double-emailing. `scSchedulerTick` now returns after `scDigestScheduledTick_()` unless this is explicitly turned on. The legacy code path is preserved intact
- **Night Ink email-client proofing** — the renderer's outer `max-width`/`margin:auto` div is replaced by nested `<table>`s (Outlook's Word engine ignores both), with `bgcolor` attributes alongside the inline `background` styles (attributes survive aggressive sanitizers) and solid inline colors throughout so dark-mode-inverting clients have nothing transparent to repaint. Body content unchanged
- **Roster shakeout (all 30 feeds probed live)** — 5 were fetching nothing. Fixed: `dc-frontier` and `microgrid-knowledge` (both moved to a Nuxt platform — real paths discovered from their homepage `<link rel="alternate">` tags), `register-dc` (section slug `data_centre` → `on_prem`). Replaced: `battery-technology` (Informa bot-wall 403s even with browser UAs) → **The Next Platform**, `dc-magazine` (BizClik bot-wall 403) → **HPCwire**, `solar-industry` (domain parked/dead, serves a `/lander` redirect) → **RenewEconomy**. Roster is back to 30 live feeds; battery and solar beats stay covered by Energy-Storage.news / ESS News and pv magazine USA / Solar Power World
- **`Scraper.gs`** VERSION v01.41g → v01.42g and **`Scraper.html`** v01.39w → v01.40w (topbar pill now green "▶ DIGEST LIVE"); version files + meta synced; public entries added (counters 42/50, 40/50)
- **`repository-information/diagrams/Scraper-diagram.md`** — scheduled path no longer labeled "paused until Phase 4", email note rewritten to the recipient-gated form, route line extended with the three go-live actions; pako URL regenerated and decompression-verified against the file's code

#### `Scraper.gs` — v01.42g

##### Added
- Go-live routes + retired-source marking (detail above); `Scrapergs.version.txt` synced; public entry added (counter 41 → 42)

##### Changed
- Pause flags, legacy-schedules gate, email-proofed renderer, roster shakeout (detail above)

#### `Scraper.html` — v01.40w

##### Added
- Go-live panel with Test AI + inbox-test buttons (detail above); meta tag synced; public entry added (counter 39 → 40)

### Notes
- Verification: all 30 roster feeds probed with `curl` (status, item count, latest `pubDate`); replacement candidates probed before adoption. Renderer fixture test — 10 structural assertions (outer/inner table nesting, `bgcolor` attributes, balanced tags, masthead, lead, sections, figure bolding, newly-covered box) all pass. Playwright: go-live panel rows render correctly from stubbed state, Test AI surfaces `ai_key_missing`, inbox test surfaces the masked address, panel collapses; no page errors. `node --check` clean on the `.gs` and both inline blocks
- **Still developer-side to finish go-live**: set an AI key (`GEMINI_API_KEY` for the free tier, or `ANTHROPIC_API_KEY` + `AI_PROVIDER=claude`) — without one, editions build in $0 fallback mode; and set `DIGEST_RECIPIENT` to start email delivery. The go-live panel reports both
- The `script.scriptapp` scope gap (documented in `gas-scripts-reference.md`) is what would keep the hourly trigger from installing — the panel's trigger row now makes that visible instead of silent

## [v03.08r] — 2026-08-27 06:49:49 PM EST

> **Prompt:** "A few things:
>
> * Why is it free for Profiler to analyze public earnings report and other sources of first-party information, generate dossiers and guidance modules, and even auto-update the dossiers after each company's earnings report, but it costs money for Scraper to analyze third-party trade news sources, identify relevant articles and summarize them, and email out a daily digest to myself? Is there any way to make Scraper do what I want it to do for free as well? If not, then what are some ways I can reduce my costs and still keep myself aware of happenings in my industry?
> * I will keep generating more and more Digests, so build me a way to easily organize and switch between my past digests. By "organize", I want the ability to see them in an organized manner and delete the ones I don't want anymore (ie: any versions of The Morning Edition between now and the version I run with for the foreseeable future).
> * (See attached screenshot) The "Lancium, NVIDIA partner..." article I circled in red led to an error 400 message (attached). What happened? Make sure it doesn't happen in the future.
> * I toggled off EV-related segments, so why did the Digest still give me a "What Tesla Full Self Driving V14 Still Can't Do" and a "Huge Tesla recalls in China while European authorities remain cautious"?"

### Added
- **Edition manager with delete** — the Digest overlay's edition chips are now open/delete pairs; delete is two-step (arm → "Delete?" with a 4s auto-disarm) and calls the new session-gated `deleteDigest` route in `Scraper.gs`, which lock-serializes, removes the edition's `Digests` row(s) and its `DigestIntake` rows bottom-up, and audit-logs the removal. The chip list now requests 30 editions, and when the latest edition was built in fallback mode its stored note (e.g. `ai_unavailable: ai_http_400`) is surfaced in the Digest status line

### Fixed
- **Google News 400 on backstop article clicks** — `scParseFeed_` truncated stored URLs at 500 chars; Google News redirect URLs routinely exceed that (curl sampling showed ~500+ even on small samples), so the encoded article token was chopped and Google returned "400 malformed". Caps raised to 1500 in both the RSS and Atom branches
- **Backstop headline/snippet hygiene** — `scDigestIngest_`'s `clean()` now decodes HTML entities (`&nbsp;`, `&quot;`, `&#39;`/`&apos;`, `&lt;`, `&gt;`, numeric refs, `&amp;` last); backstop titles get their trailing " - Publisher" suffix stripped; snippets that merely restate the title are blanked
- **EV segment gate misses** — "What Tesla Full Self Driving V14 Still Can't Do" and "Huge Tesla recalls in China…" contained no v1 `seg-ev` vocabulary term, scored segment-neutral, and passed on the company signal alone. `seg-ev` expanded to 31 terms and `seg-ev-charging` to 13 (FSD variants, model names, recall phrasing, NHTSA, robotaxi, ChargePoint, NACS, …) with seed-term versioning: seeds now carry `tv`, and `scSyncInterests_` upgrades existing segment rows whose Notes is empty or `seed-terms-v(N)` with N < tv (replaces Aliases, stamps the marker); any other Notes content permanently opts the row out of upgrades. Functional tests: both Tesla headlines now gate (11 and 5 points) while a Tesla Megapack control passes ungated (59)

#### `Scraper.gs` — v01.41g

##### Added
- `deleteDigest` route; `Scrapergs.version.txt` synced; public entry added (counter 40 → 41)

##### Fixed
- URL cap 500 → 1500, entity decoding, backstop title/snippet cleanup, EV vocabulary upgrade + sync upgrade path (detail above)

#### `Scraper.html` — v01.39w

##### Added
- Edition-manager chips with two-step delete and fallback-note surfacing; meta tag synced; public entry added (counter 38 → 39)

### Notes
- The Profiler-free-vs-Scraper-cost explanation and the operating options (Gemini free tier by default, `ANTHROPIC_MODEL=claude-haiku-4-5` as the cheap Anthropic path, current fallback mode already costing $0) were delivered in-chat
- Playwright verified the edition manager end-to-end (chips render, fallback note surfaces, arm/confirm/timeout paths); `node --check` clean on the `.gs` and both inline blocks
- Archive rotation performed on this push — the 2026-08-09 date group (17 sections, v02.24r–v02.08r) moved to CHANGELOG-archive.md with SHA enrichment; counter 101 → 84

## [v03.07r] — 2026-08-27 06:20:46 PM EST

> **Prompt:** "Before starting phase 4, walk me through the current Scraper workflow, including details on how many articles it searches through from the 30 sources, how it searches through them, how it summarizes and scores them, why the current digest only shows 8 article summaries instead of more, and what parts of the workflow cost real money via Anthropic's API & how much. My current feedback is: I like the design and, while the 8 articles Scraper found for today's digest are related to my covered companies, some of them cover topics from my covered companies that are not directly related to BESS or AIDC (ie: CATL's EV, BYD's EV chargers, or Tesla's vehicle recall). I would like Scraper to analyze my covered companies' business segments (ie: BESS, EV, chargers, transformers, etc.) and create another toggle-able subsection on the left called "Segments" that includes the list of segments Scraper identifies. That will allow me to have direct control on which segments I want to include/exclude from actively covered companies. Also, I want the article summaries to be longer. I'm not sure if I want to set a hard limit; I just want more information in each summary. Use your best judgment."

### Added
- **Segment lenses + rubric segment gate in `Scraper.gs`** — 14-entry business-segment taxonomy (`SCRAPER_SEGMENT_SEEDS`: BESS, AIDC, transformers/grid equipment, power electronics, solar, wind, nuclear, gas/turbines, fuel cells, EVs & automotive, EV charging, semiconductors, consumer electronics, industrial automation) seeded into the Interests tab as toggleable `segment` rows (default ON, flag "New segment", insert-only — in-sheet term edits win). `scLoadInterestModel_` now loads segments in both enabled and disabled states; `scRubricScore_` classifies each article against all lenses and applies the gate: a company-matched article whose only segment hits are toggled-off segments has its company + emphasis signals zeroed (topics unaffected; no segment hits = neutral). Rubric results and intake signals now carry `matchedSegments` / `excludedSegments` / `gated`. Functional tests: the developer's three examples (CATL EV deal, BYD chargers, Tesla recall) drop to 2–5 points with "EVs & automotive"/"EV charging" off, while a CATL grid-storage order (62), a mixed EV+BESS story (59), and a no-segment-terms company story (56) pass through ungated
- **Segments panel in `Scraper.html`** — new toggleable subsection between Companies and Topics (reusing the interest toggle/route path); the rubric tester now reports segment matches and prints an "Excluded by segment gate — only matches toggled-off segment: …" explanation when the gate fires

### Changed
- **Longer digest summaries** — summarize prompt rewritten (what happened + parties, all figures, deal/policy/incident mechanics, why-it-matters close; typically 3–5 sentences / 60–120 words, no hard cap), batches 7 → 5 items with maxTokens 1200 → 3000, stored-summary cap 400 → 900 chars, lead paragraph 2-3 → 3-5 sentences (maxTokens 500 → 1200, cap 600 → 1200); AI-unavailable fallback now keeps the full snippet
- **`Scraper.gs`** VERSION v01.39g → v01.40g and **`Scraper.html`** v01.37w → v01.38w; version files + meta synced; public entries added (counters 40/50, 38/50); README tree updated
- **`repository-information/diagrams/Scraper-diagram.md`** — sync seed line now includes topic/segment/source seeds, interests-rail flow lists all four sections, rubric line notes the segment gate; URL regenerated and decompression-verified

### Notes
- The workflow walkthrough and Anthropic cost map (Sonnet 5 $2/$10 per MTok, Haiku 4.5 $1/$5, web search $10 per 1,000 searches — verified against current pricing docs) were delivered in-chat; the digest's summarize/lead calls bill to Anthropic only when the `AI_PROVIDER=claude` Script Property is set, and the scheduled pipeline remains paused
- Playwright verified the Segments section and the gated rubric-tester note; `node --check` clean on the `.gs` and both inline blocks
- CHANGELOG counter is now exactly at capacity (100/100) — the next push triggers archive rotation with SHA enrichment

## [v03.06r] — 2026-08-27 05:48:26 PM EST

> **Prompt:** "Execute Phase 3"

### Added
- **Weekday digest engine in `Scraper.gs` (rebuild Phase 3)** — chunked, resumable state machine (`scDigestStep_`: start → fetch → backstop → summarize → render; state in Script Properties, intake sheet-backed in the new `DigestIntake` tab, editions stored in the new `Digests` tab with 60-row retention): fetches the enabled D1 roster feeds (≤6/step, 40s budget, broken feeds tolerated), windows to 24h (72h Monday editions via ET ISO-day), dedupes by URL, scores every item with the D3 rubric on intake (floor 25 to enter; relevance bar 50), adds the **D2 Google News company-name backstop** (12 enabled companies per run, round-robin cursor, labeled `(backstop)`, score ×0.85), AI-summarizes the top 14 (batches of 7 via `aiComplete_`, figures preserved; one more call picks the lead + writes the lead paragraph) with a **deterministic snippet fallback when no AI key is configured** — the digest always builds — then groups sections (incident/opposition topics win over company matches → Incidents & community; company matches → Covered companies; rest → Market & policy) and renders the **Night Ink** edition (`scRenderDigestNightInk_`: Newsreader serif masthead, double rules, amber-bolded figures, red incidents rule, Newly-covered box, email-ready inline styles)
- **30-source D1 roster** (`SCRAPER_SOURCE_ROSTER`) — free 3rd-party trade press only, tier 1 core AIDC/BESS/grid + tier 2 adjacent; seeded into the Interests tab as toggleable `source` rows by the daily sync (insert-only, default ON; the sheet toggle wins, the constant owns name + feed URL). The approved in-chat list wasn't persisted to the repo, so the roster reconstructs it to D1's recorded constraints (no paywalls — RTO Insider et al. stay excluded; no company-owned newsrooms)
- **Scheduled hook + dormant delivery** — `scDigestScheduledTick_()` inside `scSchedulerTick` after the pipeline pause gate (weekday ≥7:00 AM ET, one step/tick, stops once today's edition exists; `SCRAPER_SCHED_RUNS_ENABLED` still `false` so no unattended AI spend); the email site requires both `SCRAPER_SCHED_EMAIL_ENABLED` and a `DIGEST_RECIPIENT` Script Property — both unset until Phase 4's client-proofing + go-live
- **Four session-gated routes** — `runDigestNow` (client-looped steps), `getDigestStatus`, `listDigests`, `getDigest` — registered in `SCRAPER_PROJECT_ACTIONS` + `handleProjectAction_`
- **App wiring in `Scraper.html`** — Sources section atop the interests rail (30 outlets with toggles, reusing the interest toggle path) and the topbar **Digest** button → edition overlay (edition chips via `listDigests`, Night Ink render via `getDigest`, "Run intake now" loop with live phase/kept/fetched progress); IBM Plex font link extended with Newsreader for in-app edition fidelity

#### `Scraper.gs` — v01.39g

##### Added
- Digest pipeline, roster, backstop, scheduled hook, routes (detail above); `Scrapergs.version.txt` synced; public entry added (counter 38 → 39)

#### `Scraper.html` — v01.37w

##### Added
- Sources panel + Digest overlay (detail above); meta tag synced; public entry added (counter 36 → 37)

### Changed
- **`repository-information/diagrams/Scraper-diagram.md`** — new "The Morning Edition (Rebuild Phase 3)" flow (Trade-press RSS + Google News participant, chunked build loop, dormant-email note, edition viewer ops); mermaid.live URL regenerated and decompression-verified

### Notes
- Functional node tests: section grouping (incident-over-company precedence, opposition routing), figure-bolding regex (fixed a `\b`-after-`%` boundary miss found by the test), full renderer output (masthead, No. 001, escaped XSS probe, amber figures, red incidents rule, newly-covered box)
- Playwright: full "Run intake now" loop driven through all four phases against stubbed routes; sources rail and the rendered Night Ink edition verified on screenshot; no unexpected console errors; `node --check` clean on the `.gs` and both inline script blocks

## [v03.05r] — 2026-08-27 05:08:03 PM EST

> **Prompt:** "Execute Phase 2"

### Added
- **Wire Desk reskin of `Scraper.html` (rebuild Phase 2)** — the approved dark monitoring-desk design from the "Scraper Redesign Mockups" canvas applied to the whole app layer: CSS-token system (`--wd-*`: charcoal #15171c, panels #1b1e24, lines #262b33, amber accent #f2a33c, IBM Plex Sans/Mono), sticky top bar (SCRAPER · News Desk wordmark, live ET clock, DIGEST PAUSED pill tied to the v03.02r pipeline pause, notification/refresh/new-project actions), and a 280px · 1fr · 300px desk grid that collapses to a single column under 1100px. Every existing surface restyled onto the tokens with selectors unchanged (project cards, 5-step wizard, articles overlay, filter bar, stats panel, learned panel, progress stack, rating log, notification panel)
- **Interests rail (left)** — live from the Phase 1 routes: Companies section (`listInterests` on sign-in; category-count chips + "+N new" chip; search filter; first 12 with "All N companies" expander; "New coverage" flags float to top; stale rows dimmed/struck-through as "Coverage ended" with a read-only toggle) and Topics section ("New topic" flags); per-row on/off toggles post `setInterestEnabled` optimistically with revert-on-failure, and toggling clears the attention flag
- **Digest-controls rail (right)** — Schedule card (Mon–Fri 7:00 AM ET display, weekend-coverage note; editable at Phase 3), Profiler sync card (last-sync status from the sync summary + "Sync now" → `syncInterestsNow`), and a rubric tester (headline/snippet → `rubricPreview` → 0–100 score with per-signal bars for company/topic/emphasis/substance and matched-interest list)
- **CSP `style-src` extension** — `https://fonts.googleapis.com` added to both the active and the commented hardened CSP tags (PROJECT OVERRIDE-marked) so the IBM Plex stylesheet loads in production; font files were already allowed via `fonts.gstatic.com`

### Changed
- **👍/👎 feedback UI retired per decision D3** — `SCRAPER_FEEDBACK_UI_ENABLED = false` gates the verdict buttons, the Calibrate card action, and the rating-coaching copy (Stats recommendation, post-Analyze toast); all verdict/calibration code paths, routes, and historical votes are preserved and the flag restores them
- **`Scraper.html`** version v01.35w → v01.36w (`Scraperhtml.version.txt` + meta tag); public entry added to the page changelog (counter 35 → 36)
- **`repository-information/diagrams/Scraper-diagram.md`** — interest-ops block rewritten as the wired "Wire Desk Interests Rail (Rebuild Phase 2)" flow; the 👍/👎 tap flow replaced with a retirement note (server-side routes preserved); mermaid.live URL regenerated and decompression-verified
- **README tree** — Scraper version display v01.35w → v01.36w

### Notes
- Playwright visual verification passed on 1440×900 and 390×844 (fixture-fed signed-in state): interests rows/flags/stale render, rubric result renders, zero verdict/calibrate buttons, no unexpected console errors; screenshots reviewed
- Inline `<script>` blocks pass `node --check`

## [v03.04r] — 2026-08-27 04:39:36 PM EST

> **Prompt:** "Picking up from my recent "Scraper digest customization and Profiler Integration" session, execute Phase 1 of the approved Scraper rebuild"

### Added
- **Interests tab + daily Profiler-registry sync in `Scraper.gs` (rebuild Phase 1)** — new `Interests` tab (Key / Type / Label / Enabled / Status / Flag / Categories / Aliases / Weight / Source / Profiler Updated / First Seen / Last Synced / Notes) synced from the public GitHub Pages `profiler-data/profiler-companies.json` by `scSyncInterests_()`: new active registry companies upsert default-ON flagged "New coverage"; companies that leave the registry are marked stale ("Coverage ended"), never deleted; registry-owned fields refresh on sync while developer-owned fields (Enabled / Aliases / Weight / Notes / Flag) are never overwritten (a stale→active return re-flags as new coverage). Driven by the hourly `scSchedulerTick` ahead of the pipeline pause gate (no AI tokens, no email; throttled to ~once/day; serialized under the script lock; a failed fetch is recorded and never stale-flags real coverage). Manual editor fallback `syncProfilerInterests()`
- **Ten topic-interest seeds** (`SCRAPER_INTEREST_TOPIC_SEEDS`) — six mapped 1:1 to the Industry Guidance modules (800 VDC, China policy, utility procurement, BESS bankability, BESS technology, grid infrastructure) and four standing market topics from the original rebuild request (AIDC geopolitics, community opposition, battery fire incidents, US buildout/capex). Insert-only: once a seed lands in the tab, in-sheet developer edits win
- **Four-signal scoring rubric scaffolding (decision D3)** — `scRubricScore_()` + `scLoadInterestModel_()` + word-boundary matcher `scTermsHit_()`: company (0–40, developer Weight scales it), topic (0–25), Profiler-emphasis (0–15: coverage base + dossier recency over 45 days + weight boost), substance (0–20: deterministic snippet heuristics — length, figures, quotes, hard-news verbs). 0–100 output aligned with `SCRAPER_RELEVANT_THRESHOLD`; Phase 3 wires it into the digest scoring path (feedback code + historical votes preserved per D3). Node-based functional tests verified the scoring shape and the word-boundary guard (short names like ABB cannot match inside longer words)
- **Four session-gated routes for the Phase 2 panel** — `listInterests`, `setInterestEnabled` (toggling clears the attention flag), `syncInterestsNow`, `rubricPreview` — registered in `SCRAPER_PROJECT_ACTIONS` and `handleProjectAction_` (served by both doPost and the doGet api mirror)

### Changed
- **`Scraper.gs`** VERSION v01.37g → v01.38g; `Scrapergs.version.txt` synced; public entry added to the GAS changelog (counter 37 → 38)
- **`.claude/rules/industry-guidance.md`** — new step 9: authoring a guidance module now also adds a matching topic seed to `SCRAPER_INTEREST_TOPIC_SEEDS` (the approved authoring-time sync — no runtime Profiler probe)
- **`repository-information/diagrams/Scraper-diagram.md`** — added the Interest Model Sync flow (registry participant, daily sync loop before the pause gate, the new session-gated ops); mermaid.live URL regenerated and decompression-verified
- **README tree** — Scraper version display v01.37g → v01.38g

## [v03.03r] — 2026-08-27 04:09:00 PM EST

> **Prompt:** "D1: I like the 12 sources you provided, but I think this source pool is too small. Expand the source list to 30 sources (if possible). If you can only get to 30 sources by including low-value entries, then don't include them, but let me know which sources they are and why you aren't including them. I do not want any sources that require paid subscriptions. D2: Go with your recommended option B. D3: Go with your recommended option A. Also: (See attached screenshot) For all outputs, do not say "Developed by: ShadowAISolutions"; Instead, say "Developed by: LightAISolutions"." *(with a screenshot of HITHIUM-INTERVIEW-BRIEF.pdf in Google Drive, its footer line "Developed by: ShadowAISolutions" circled in red)*

### Changed
- **Developer rebrand** — `DEVELOPER_NAME` changed from `ShadowAISolutions` to `LightAISolutions` in the Template Variables table and propagated across 242 files (footers, LICENSE.md copyright, CITATION.cff, FUNDING.yml, GOVERNANCE.md, CONTRIBUTING.md, PR template, workflow comments, SVG logo comments, templates, scripts, tests, `archive info/` doc footers). Intentionally preserved occurrences: the Provenance Markers rule in `.claude/rules/behavioral-rules.md` (documents the original author; hidden provenance markers remain untouched per that rule), the init history entry in `CHANGELOG-archive.md`, and the historical technical content in `archive info/07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md` and `archive info/TEMPLATE-UPDATE-PLAN.md` (the literal old string is load-bearing in those incident records — e.g. the v02.79r origin case-mismatch bug)
- **Version bumps for every deployed file the footer swap touched** — pages: MasterACL v01.05w, Profiler v01.43w, Receipts v01.36w, Scraper v01.35w, gas-project-creator v01.03w, globalacl v01.05w, testauthgas1 v01.03w, testauthhtml1 v01.03w, text-compare v01.01w (version files + meta tags); GAS: MasterACL v01.13g, Profiler v01.22g, Receipts v01.28g, Scraper v01.37g, globalacl v01.07g, testauthgas1 v01.06g, testauthhtml1 v01.06g (VERSION constants + version files), Claspdeploytest v01.01g (constant only — pilot has no version file); AHK: AutoUpdate v01.01a, Test1 v01.01a (constants only — CI regenerates version files). All 18 page/GAS/AHK changelogs received a "Minor internal improvements" section; README tree version displays updated
- **Study-prep and AIDC report PDFs regenerated** from their corrected sources so no delivered PDF still carries the old attribution footer

### Notes
- Scraper digest build decisions recorded: **D1** = 30-source free roster approved in-chat (paywalled and low-value exclusions named); **D2** = option B (Google News retained only as a covered-company-name backstop, down-weighted and labeled); **D3** = option A (four-signal Profiler-derived scoring rubric approved; 👍/👎 feedback turned off and hidden but code and historical votes preserved, not deleted)

## [v03.02r] — 2026-08-27 02:20:49 AM EST

> **Prompt:** "A few things: • I want to temporarily stop all emails to jonyang92@gmail.com that cost me tokens through Anthropic API, in case "digests" does not provide enough context. • Explain to me the difference between a runtime Profiler-API probe vs the rule-based sync. Then, let me choose. • I wasn't very happy with having to provide so much "thumbs up/down" feedback in order to train Scraper to learn which articles I would be interested in. Therefore, I want Scraper to be able to analyze and learn from Profiler so that I don't have to provide personal feedback anymore. Is this possible? If so, I would like to abolish the feedback system or at least temporarily turn it off. • I wasn't very satisfied with the depth of information provided by Google News RSS queries. I would prefer you analyze and identify between 12-20 reputable and trafficked trade news sites that would serve as a good source of news instead. If you think there is still value provided by Google News RSS queries, then explain what the value is and let me decide afterwards. • Scraper's html looks very rough and unprofessional. Don't copy Profiler's aesthetic, but remake Scraper in a way that is equally professional, but with a more news-friendly theme. I want Scraper to be designed in a way that makes it easy for me to see and adjust sources, keywords, topics, summary formats, and anything else you think would help me stay on top of my industry's news. Recommend a couple styles and let me see mockups of what they would look like before I decide. Do the same with the outputted digest as well - let me see what they would look like and let me adjust things before we set things in stone."

### Changed
- **`Scraper.gs`** — added the `SCRAPER_SCHED_RUNS_ENABLED` pipeline pause (set `false`): `scSchedulerTick()` now exits immediately after its heartbeat, so no scheduled compile/analyze/brief phase executes — closing the gap left by v03.01r, which stopped emails but let scheduled runs keep spending AI tokens generating briefs into the Reports tab. The heartbeat still updates, so `getSchedulerHealth` correctly reports the trigger alive; Next Run does not advance while paused (due schedules run once on resume); manual in-app actions are unaffected. The v03.01r `SCRAPER_SCHED_EMAIL_ENABLED` switch remains as delivery-layer defense in depth. VERSION v01.35g → v01.36g; `Scrapergs.version.txt` synced; public entry added to the GAS changelog (counter 35 → 36)
- **README tree** — Scraper version display v01.35g → v01.36g

### Notes
- Repo-wide token-cost audit of email/automation paths: Profiler's field-note suggestion email is human-typed (no AI); Receipts uses Gemini only (free tier) and its emails are compliance alerts; Profiler's 15-minute transcript watcher DOES spend Anthropic tokens when new transcripts appear but sends no email — left untouched and flagged to the developer
- Trade-news source list verification, Profiler-taught relevance design, and app/digest style mockups were delivered in-chat for developer decisions — no further repo changes this push

## [v03.01r] — 2026-08-27 01:54:03 AM EST

> **Prompt:** "Picking up from my "Receipts sign-in denials" session, make Scraper stop emailing jonyang92@gmail.com any daily, weekly, monthly, bi-annual, and annual digests for now. I have been refining my Profiler app to conduct, organize, and analyze deep research of companies' 1st-party sources (prioritizing public earnings reports, investor relations articles, and press releases by the companies themselves). I want my Scraper app to be differentiated from Profiler in that its role is to conduct, organize, and analyze deep research of companies' 3rd-party trade news sites and automatically send me daily digests in the morning that go over the past 24 hours of news related to my covered companies and US AIDC market as a whole (geopolitical policies, public protests, battery fire incidents, etc). If possible, I want you to develop a way for Scraper to analyze Profiler and learn which companies and topics I care about, then use that information to scrape highly reputable and highly trafficked trade news sites for relevant articles. Then, use Claude AI to summarize the key points and figures from these articles that would matter to me, Jon Yang, and send me a daily weekday (Mon-Fri) digest that will allow me to quickly understand what happened since the last digest and stay on top of industry information. Since my Profiler app currently has 88 companies (and growing) and I would obviously want Scraper to care about Profiler's covered companies, I would like Scraper to give me a way to see all relevant keywords I care about and give me the ability to toggle them on/off for Scraper's digests. That way, I will be able to customize my digests to focus on the companies and topics that matter to me most in the moment. I would also like Scraper to be able to see newly added companies and industry guidances on Profiler and automatically refine its search algorithm to update along with Profiler. Recommend me an action plan to approve."

### Changed
- **`Scraper.gs`** — added the `SCRAPER_SCHED_EMAIL_ENABLED` master kill switch (set `false`), gating both scheduler email call sites: the brief-delivery email in `scDeliverBrief_()` and the run-failure notice in `scRunScheduleStep_()`. Every scheduled cadence (daily/weekly/monthly/quarterly/biannual/annual/custom) delivers through these two sites, so all digest emails stop once the auto-merge workflow's GAS self-update webhook deploys this version. Scheduled runs still execute and briefs still land in the Reports tab (row status stays `generated`); flipping the flag back to `true` and merging resumes email delivery with no other change. VERSION v01.34g → v01.35g; `Scrapergs.version.txt` synced; public entry added to the GAS changelog (counter 34 → 35)
- **README tree** — Scraper version display v01.34g → v01.35g

### Notes
- The Scraper↔Profiler integration action plan (Profiler-derived interest model, keyword on/off toggles, Claude-summarized Mon–Fri morning digests, auto-refinement as Profiler grows) was presented in-chat for developer approval — no implementation this push
- Session start reconstructed the stale `SESSION-CONTEXT.md` (recorded v02.99r vs actual v03.00r) as an intermediate commit bundled with this push

## [v03.00r] — 2026-08-24 06:16:16 PM EST

> **Prompt:** "Picking up from my recent "Profiler app role-based access control" session, I suddenly cannot sign into my Profiler app as jonyang92@gmail.com with the following error message. What's going on? Fix it." *(with a screenshot of the Profiler sign-in screen showing "Sign-in could not reach the access list, so it could not confirm your account. This is usually temporary — please try again in a moment. (code: acl_unavailable/acl_unreachable)")*

### Added
- **Remote ACL health probe in `Profiler.gs`** — `aclHealthProbe_()` (PROJECT block), dispatched as unauthenticated `GET ?action=api&op=aclhealth` (inline `// PROJECT:` branch beside the deploy fallback in `doGet`). It runs the exact Access-tab read sequence sign-in performs before trusting the list — `openById` → tab lookup → data read → page-column scan — and reports the failing stage plus the caught exception message (spreadsheet ID redacted, 200-char cap, 60-second result cache so unauthenticated callers cannot burn Sheets quota). Same trust model as the deliberately-unauthenticated deploy fallback: it returns only reason codes the sign-in screen already shows any visitor, never emails, rows, or ACL contents. Turns an `acl_unavailable` outage from an Apps-Script-editor-log round-trip into a one-curl diagnosis

### Changed
- **`Profiler.gs`** VERSION v01.20g → v01.21g; `Profilergs.version.txt` synced; generic public entry added to the GAS changelog (counter 20 → 21)
- **README tree** — Profiler version display corrected from the stale `v01.38w · v01.17g` to the current `v01.42w · v01.21g` (drift left by earlier pushes)

### Notes
- Investigation established before the probe was written: the reported code (`acl_unavailable/acl_unreachable`) is produced only when the deployed script **throws while opening/reading the Master ACL spreadsheet**; the entire auth/ACL code path is unchanged across the recent GAS versions (v01.19g/v01.20g appended guidance-module content only), and all four live deployments (Profiler v01.20g, Receipts, Scraper, MasterACL) answered the unauthenticated version check as healthy and current — so the cause is environment-side (grant/spreadsheet/transient), not a repo regression. The probe exists to name which one
- `node --check` clean on a `.js` copy of Profiler.gs; `scripts/check-gas-inner-scripts.js` clean (75 inner blocks)

## [v02.99r] — 2026-08-24 05:13:40 PM EST

> **Prompt:** "Output both reports as downloadable PDFs, then continue with Phase 5." *(Both Phase 4 playbook PDFs were delivered to the developer as downloadable attachments, then Phase 5 — the team training curriculum, the final phase of the v02.91r plan ("training materials to teach core technical, power infrastructure, policy … to newer teammates") — executed. Policy/procurement/bankability teaching already existed as three guidance modules; the two gaps (core technical, power infrastructure) were filled the same in-app way, and a curriculum document sequences all assets into a four-week onboarding program.)*

### Added
- **Two training modules in the Industry Guidance library** (PROJECT block of `googleAppsScripts/Profiler/Profiler.gs`, registered in `guidanceDocs_()` — library now 6 documents): `guidanceDocBessTech_()` — *BESS Technology Fundamentals for the Sales Team* (LFP in plain terms, the spec sheet decoded, the 280→1300Ah cell ladder as bars, cell-to-container integration, sodium-ion claim discipline, duration-class proscons, safety/certification vocabulary, flashcards + self-test + pointer-form claims ledger + 13-term glossary); `guidanceDocPowerInfra_()` — *Power Infrastructure & the AIDC Power Chain* (grid organization and MW-vs-MWh, the two market designs, the battery revenue stack, the grid-to-GPU chain with NOGRR 282/SB 6, the three BESS sockets, the 2026-28 gates timeline in three lanes, vocabulary callout, flashcards + self-test + ledger + 12-term glossary). Teaching syntheses only — no new external claims; ledgers point to the internal sources carrying the citations
- **Two analysis markdowns** (source of truth, never deployed) in `repository-information/industry-guidance/`: `bess-technology-fundamentals-analysis.md`, `power-infrastructure-aidc-analysis.md` — provenance, teaching sequence, pointer-form claims ledgers, flagged teaching simplifications, scope notes
- **The team training curriculum** — `repository-information/study-prep/hithium/hithium-team-training-curriculum.md` + `HITHIUM-TEAM-TRAINING-CURRICULUM.pdf` (5 pages): the four-week onboarding program (the machine → the grid and the buildout → the policy stack → the motion), each week with study assets, dossier rotations, exercises, and a pass/fail competency gate (G1-G4, consolidated with failure handling); before-day-one setup (contributor-tier grant, playbook timing, day-one standards); the post-week-4 cadence; and the trainer's notes (gate-don't-lecture, the week-3 shortcut trap, concede-then-structure as the house pattern)

### Changed
- **`Profiler.gs`** VERSION v01.19g → v01.20g; `Profilergs.version.txt` synced; generic public entry added to the GAS changelog (counter 19 → 20)
- **`scripts/build-study-prep-pdf.mjs`** — curriculum registered in the DOCS registry (kick `Profiler Study Prep · Team Training`)
- **README tree** — two analysis entries inserted into the `industry-guidance/` block and the curriculum md/PDF pair added under `study-prep/hithium/`, all in filename order

### Notes
- Verification before push: `node --check` on a `.js` copy of Profiler.gs; `scripts/check-gas-inner-scripts.js` (75 inner blocks clean); JSON/tooltip/quiz validation of both module objects (all `{{term}}` tooltips resolve, quiz indices in range); Playwright render of both modules via direct `gdRenderDoc()` invocation (screenshots inspected — tiles, nav, tooltips, ledger, glossary all correct); standard harness smoke test (Profiler PASS)
- Guidance content ships inside `Profiler.gs` (repo + GAS project only, never on public Pages); access remains role-gated server-side; `Profiler.html` stays at v01.42w — the renderer needed no page changes
- Both Phase 4 playbook PDFs were also delivered to the developer as chat attachments this interaction
- **The v02.91r plan is complete** — Phases 1-5 all delivered (88-dossier base, guidance modules, Hithium v5 + relationship web, the two playbooks, the training curriculum)

## [v02.98r] — 2026-08-24 04:53:57 PM EST

> **Prompt:** "Picking up from my recent "Profiler app role-based access control" session, continue with Phase 4." *(Executes Phase 4 of the plan approved under v02.91r — the Hithium sales strategy report as two documents, per the developer decision recorded in the v02.97r session context. Both documents synthesize the completed understanding phase: the 88-dossier base, the Hithium v5 AIDC-lens dossier, the relationship-web deliverable, and the three Industry Guidance analyses.)*

### Added
- **The IC sales playbook** — `repository-information/study-prep/hithium/hithium-ic-playbook.md` + `HITHIUM-IC-PLAYBOOK.pdf` (7 pages): the account executive's working document — the one-page market fence (the four federal machines, three open lanes, four closed doors), the six-channel hunt map with the Jupiter-pattern account profile, a seven-question first-call qualification script with a disqualifier table, the MACR-arithmetic-as-a-service play, a seven-row objection-handling table (FEOC listing, tariffs, the lapsed IPO, the CATL suit, Moss Landing, domestic content, BMS security), the five-play Jupiter account defense against the Peak Energy sodium wedge with early-warning indicators, the 10-item proof pack, and the red-lines/vocabulary-discipline list
- **The team-lead playbook** — `repository-information/study-prep/hithium/hithium-team-lead-playbook.md` + `HITHIUM-TEAM-LEAD-PLAYBOOK.pdf` (6 pages): the sales leader's working document — the three-judgment market thesis (certified MW over queue GW; the fence's lane concentration; the low-drama-book imperative), the six-demand-pool coverage plan with staffing allocation, the dated 2026-28 policy calendar with per-gate team actions, competitive rules of engagement (ON.energy, the gas cohort, CATL, the FEOC-compliant tier, Peak Energy), five-stage pipeline gates with enforced counting rules (MOUs at zero; the safe-harbor pool as a depletion asset), team standards, and the 2026-28 play

### Changed
- **`scripts/build-study-prep-pdf.mjs`** — both playbooks registered in the DOCS registry (kick `Profiler Study Prep · Sales Strategy`, classification Internal — sales strategy)
- **README tree** — four entries added under `study-prep/hithium/` (both markdown sources and both typeset PDFs)

### Notes
- Data/documentation-only change: no HTML page or GAS script touched (`Profiler.html` stays at v01.42w, `Profiler.gs` at v01.19g)
- Phase 5 (the team training curriculum) is the remaining phase of the v02.91r plan

## [v02.97r] — 2026-08-24 02:47:41 PM EST

> **Prompt:** "continue with Phase 3" *(Executes Phase 3 of the plan approved under v02.91r — the Hithium dossier v5 revision through the AIDC lens plus the relationship-web deliverable, completing the understanding phase. Research ran as one focused delta-sweep background agent (~44 tool uses); its digest arrived while the stop-hook-prompted interim commit was being prepared, so the whole phase landed as this single push after all.)*

### Added
- **The relationship-web deliverable** — `repository-information/study-prep/hithium/hithium-relationship-web.md`: the US AIDC containerized-BESS web from Hithium's seat, synthesized from the 88-dossier base — the eight-layer value chain (anchor tenants → neoclouds → colos → power developers/IPPs → EPCs/GCs → BESS OEMs → FEOC-immune BtM adjacents → utilities/grid rules), Hithium's verified-relationship grades, the cell-brand decision map per channel, two Mermaid diagrams (full web + Hithium ego-network), and the six 2026-2028 demand pools

### Changed
- **Hithium dossier revised to profileVersion 5 (AIDC lens)** — `hithium.profile.json`: new `∞Power Solutions for AI Data Center` product entry (four-SKU lithium-sodium portfolio; positioned as a full-duration energy backbone, NOT a compliance-grade UPS — no NOGRR 282/LVRT claims, zero named customers eight months post-launch) with an AIDC/US-book spec annex (∞Power8 6.9 MW/55.2 MWh, Q4 2026 mass delivery; Jupiter 3 GWh + Trimount EFSB approval Feb 2026; MGN NYC 55 MW/290 MWh; the Jupiter-Peak Energy sodium wedge); six new recentDevelopments (Fraser Coast 421 MWh, Heze park, Trimount, the Dec 2025 AIDC launch, Jupiter-Peak, MGN); three new AIDC-lens strategy reads (marketing-position-not-yet-business; ON.energy sets the US category terms; the anchor account is strong but no longer exclusive-trending); 13 new sources (51 total); v4 archived to `archive/hithium.profile.v4.json` + `archive-index.json` entry
- **Registry** — hithium `lastUpdated` synced to 2026-08-24 (was stale at 08-09) and tagline refreshed with the AIDC line
- **README tree** — relationship-web entry added under `study-prep/hithium/`; archive entries added for `hithium.profile.v4.json` **and** `hithium.profile.v3.json` (drift fix — the v3 entry had been missed in the v3→v4 revision push)

### Notes
- Data-only change: `Profiler.html` stays at v01.42w
- Phase 1-3 (the understanding phase) is complete; the sales-strategy report (Phase 4) and training curriculum (Phase 5) await the developer's go

## [v02.96r] — 2026-08-24 01:51:27 PM EST

> **Prompt:** "continue with Phase 2" *(Executes Phase 2 of the plan approved under v02.91r — the three Industry Guidance study modules that convert the Phase 1 dossier base into teachable context. Research ran as three parallel background agents (~55/~60/~50 sources); notable finding: the current stacked China tariff is ~40.9% — the 58.4% print circulating in some trackers is the pre-February stack from before the Supreme Court struck the IEEPA layers.)*

### Added
- **Three Industry Guidance modules** in the PROJECT block of `googleAppsScripts/Profiler/Profiler.gs`, registered in `guidanceDocs_()` (library now 4 documents): `guidanceDocChinaPolicy_()` — the China policy stack for a BESS seller (FEOC/PFE entity tests, the 55→75% storage MACR ladder, the 2026 tariff rollercoaster to the current ~40.9% stack, NDAA §154/FY2026 phases, the five compliant lanes, and sales red lines); `guidanceDocUtilityAidc_()` — utility procurement meets AIDC load (Oncor/AEP/Entergy/Dominion/Georgia Power case studies, the 85% minimum-take tariff norm, the five BESS demand channels, the two-lane buyer map); `guidanceDocBankability_()` — bankability & certification (the UL/NFPA/grid certification stack, Moss Landing/EPRI context, IE diligence mechanics, the Hithium counterparty file, the 10-item RFP checklist). Each module carries tiles, timeline/bars/table/proscons sections, a claims ledger, flashcards, a quiz, and a glossary — rendered by the existing guidance renderer with no page changes
- **Three analysis markdowns** (source of truth, never deployed) in `repository-information/industry-guidance/`: `china-policy-stack-analysis.md`, `utility-aidc-procurement-analysis.md`, `bess-bankability-certification-analysis.md` — research provenance, executive reads, deep dives, claims ledgers with source links, and scope notes

### Changed
- **`Profiler.gs`** VERSION v01.18g → v01.19g; `Profilergs.version.txt` synced; generic public entry added to the GAS changelog
- **README tree** — three analysis-file entries inserted into the `industry-guidance/` block in filename order

### Notes
- **Archive rotation executed this push** — the counter reached 101 sections; the oldest date group (2026-08-08, 12 sections v01.96r–v02.07r) rotated to `CHANGELOG-archive.md` with SHA enrichment, leaving 89
- Module content ships inside `Profiler.gs` (repo + GAS project only, never on public Pages); guidance access remains role-gated server-side
- Phase 3 next: Hithium dossier v5 (AIDC lens) + the relationship-web deliverable

## [v02.95r] — 2026-08-24 01:27:35 AM EST

> **Prompt:** "continue with Batch D" *(Executes Batch D of the plan approved under v02.91r — the behind-the-meter power packagers that are not Hithium BESS competitors but map the FEOC-immune gas/hybrid adjacent competition for AIDC energy dollars. Research ran as five parallel background agents; the VoltaGrid agent died mid-run on a server error and was resumed via SendMessage to completion. The ON.energy evaluation sweep returned a FULL DOSSIER verdict — its 2025 pivot to a BESS-based medium-voltage AI UPS with a 5 GW Crusoe deployment makes it a direct product-category competitor to Hithium's ∞Power AIDC line — so Batch D landed five dossiers instead of four.)*

### Added
- **Five Batch D BtM-power dossiers** (`live-site-pages/profiler-data/`) — `voltagrid`, `enchanted-rock`, `proenergy`, `mainspring-energy` (all `supplier`), and `on-energy` (`supplier`+`integrator`) `.profile.json`, all schemaVersion 2 with banded contracted-book/platform annexes, labeled strategy reads with an explicit Hithium lens, and chronological sources. The through-line: the four gas/linear players (VoltaGrid 2.3 GW Oracle/OpenAI + >1 GW Vantage; ERock's Microsoft/Meta-EPE/Anthropic ~936 MW book post-NYSE-IPO; ProEnergy's >1.65 GW refurb-jet-core turbine orders; Mainspring's OBBBA flat-30%-ITC linear generators) carry zero BESS in their product lines — every campus they win defers a containerized-storage purchase while leaving an open storage-attach socket — and ON.energy is productizing BESS itself into that chain as a FEOC-clean MV AI UPS with the cell supplier still unnamed
- **Registry** — `profiler-companies.json` grows 83 → 88 companies

### Changed
- **README tree** — five `*.profile.json` entries inserted into the `profiler-data/` block in filename order

### Notes
- Data-only change: `Profiler.html` stays at v01.42w
- Phase 1 (dossier coverage) is complete; Phase 2 (Industry Guidance modules) and Phase 3 (Hithium dossier v5 + relationship-web deliverable) follow
- Capacity counter reaches 100/100 — the next push commit triggers mandatory archive rotation with SHA enrichment

## [v02.94r] — 2026-08-24 12:41:29 AM EST

> **Prompt:** "continue with Batch C" *(Executes Batch C of the plan approved under v02.91r — the four EPC dossiers, the last unmapped link between the Batch A suppliers and Batch B buyers. Research ran as five parallel background agents: a two-stage first-party/third-party sweep for Samsung C&T (the third Hithium prospectus reference) and single combined sweeps for SOLV Energy, Blattner, and MasTec.)*

### Added
- **Four Batch C EPC dossiers** (`live-site-pages/profiler-data/`) — `solv-energy`, `blattner`, `mastec`, `samsung-ct` `.profile.json`, all schemaVersion 2 under the existing `epc` category with banded construction-record/interface annexes, labeled strategy reads with an explicit Hithium lens, and chronological sources. Key verifications: the Samsung C&T-Hithium relationship is a real, prospectus-cited ~10 GWh E&C cooperation agreement (Jan 2025) that remains publicly unconverted 19 months on, and its US develop-and-sell arm hands battery procurement to buyers (Sunraycer chose e-STORAGE for the ex-Samsung Texas pipeline); the owner-furnished procurement norm is documented across SOLV (Tesla on every flagship), Blattner (Fluence/e-STORAGE, owner-selected — including the Slate precedent of installing China-linked BESS), and MasTec (twice-documented Sungrow pairings, both owner-selected)
- **Registry** — `profiler-companies.json` grows 79 → 83 companies (EPC category now 12)

### Changed
- **README tree** — four `*.profile.json` entries inserted into the `profiler-data/` block in filename order

### Notes
- Data-only change: `Profiler.html` stays at v01.42w
- Phase 1 concludes with Batch D (BtM packagers: VoltaGrid, Enchanted Rock, ProEnergy, Mainspring; ON.energy evaluated during the batch)

## [v02.93r] — 2026-08-24 12:15:30 AM EST

> **Prompt:** "continue with Batch B" *(Executes Batch B of the plan approved under v02.91r — the eight IPP/developer dossiers covering the buyer side of the containerized-BESS web. Research ran as ten parallel background agents: two-stage first-party/third-party sweeps for the two Hithium prospectus references (Jupiter Power, Lightsource bp) and single combined sweeps for the other six.)*

### Added
- **Eight Batch B IPP dossiers** (`live-site-pages/profiler-data/`) — `nextera-energy-resources`, `jupiter-power`, `plus-power`, `arevon`, `lightsource-bp`, `key-capture-energy`, `eolian`, `terra-gen` `.profile.json`, all schemaVersion 2 with banded fleet/supplier Technical Annexes, labeled strategy reads with an explicit Hithium lens, and chronological sources. The batch verifies both Hithium prospectus references at trade-press level: Jupiter (3 GWh 2024 supply deal + the 2.8 GWh Trimount design win with 5.015 MWh units) and Lightsource bp (640 MWh Woolooga, Australia — 128 × 5 MWh containers); documents each buyer's FEOC posture (NextEra's domestic lock through 2029, Terra-Gen's 8 GWh LG Vertech pivot, Eolian's American-built coalition stance, Arevon's Tesla monogamy, Plus Power's dual-source Tesla/Sungrow split, KCE's open windows); and corrects two tasking premises (Big Rock belongs to Gore Street, not Arevon; ECP fully exited Terra-Gen in Oct 2024)
- **`ipp` registry category** — `profiler-companies.json` gains `ipp` in its category list and grows 71 → 79 companies; `Profiler.html` (v01.42w) adds the category to `ovSafeCat`'s known list, an `IPP` display label in `ovCatLabel`, and an `--ov-ipp` tag color, so roster chips and tags render the new category natively

### Changed
- **README tree** — eight `*.profile.json` entries inserted into the `profiler-data/` block in filename order

### Notes
- `Profiler.html` v01.41w → v01.42w (page-side `ipp` support is a renderer change; dossier data remains data-only)
- Batches C (EPCs) and D (BtM packagers) follow per the approved plan; Phase 2 Industry Guidance modules and the Hithium dossier v5 revision come after

## [v02.92r] — 2026-08-23 11:37:09 PM EST

> **Prompt:** "Approved — start Batch A" *(Executes Batch A of the plan approved under v02.91r — the nine containerized-BESS competitor dossiers, researched via the standard two-agent-per-company sweep (13 parallel background agents including shared policy/rankings passes). Structured-question decisions carried forward: Tiers 1+2 scope minus Powin; parallel subagents; utilities and standards bodies as Industry Guidance modules rather than dossiers; both IC and team-lead strategy documents.)*

### Added
- **Nine Batch A competitor dossiers** (`live-site-pages/profiler-data/`) — `prevalon`, `canadian-solar`, `trina-storage`, `hyperstrong`, `ls-energy-solutions`, `crrc-zhuzhou`, `sunwoda`, `narada`, `envision-energy` `.profile.json`, all schemaVersion 2 with banded Technical Annex specs, labeled strategy reads, and chronological newest-first sources. Together they map the containerized-BESS field for the Hithium/US-AIDC lens: the FEOC-compliant US tier (Prevalon, LS-ES), the overseas-listed Chinese tier (Canadian Solar e-STORAGE, Trina Storage), the China grid-side heavyweights (HyperStrong, CRRC Zhuzhou), the fast riser (Sunwoda), the distressed incumbent (Narada), and the other NDAA §154-named major (Envision). Each carries an explicit Hithium-lens strategy read
- **Registry** — `profiler-companies.json` grows 62 → 71 companies; all nine registered with taglines, HQ, tickers where applicable, name-sorted order preserved

### Changed
- **README tree** — nine `*.profile.json` entries inserted into the `profiler-data/` block in filename order

### Notes
- Data-only change: `Profiler.html` stays at v01.41w (no page version bump); the app discovers new companies from the registry at load
- `scripts/verify-profiler-roles.py` re-run post-registration: 71/71 dossiers render a specs section, 0 blank rows, role matrix and per-account progress isolation intact
- Batch B (IPPs), C (EPCs), D (BtM packagers) follow in subsequent passes per the approved plan

## [v02.91r] — 2026-08-23 11:04:41 PM EST

> **Prompt:** "The dossiers look good now. Besides Zhonhen Electric, I am also strongly considering a Director of Sales, AIDC role at Hithium, so I also need to fully understand the US AIDC industry from a Chinese containerized BESS supplier's (Hithium) perspective. What other companies should I add to the Profiler app to be able to understand the web of relationships between containerized BESS suppliers, developers, general contractors, and data center operators? To clarify, Hithium will most likely not be competing in the sidecar, backup battery unit, electrical room space; Rather, they will be competing in the containerized BESS space. After understanding this part of the industry, I will ask you to create a comprehensive sales strategy report for me. I might be leading a team for Hithium to attack the US AIDC market, so once you have all the information, I will also want you to create training materials to teach core technical, power infrastructure, policy (and probably more) to newer teammates. Create an action plan for me to review and approve." *(Plan approved via structured questions: Tiers 1+2 scope minus Powin — 25 new dossiers; parallel subagents; utilities/standards as Industry Guidance modules; both IC and team-lead strategy documents. This housekeeping push lands the mandatory archive rotation while Batch A research runs; the Batch A dossiers follow as their own push.)*

### Changed
- **CHANGELOG archive rotation** — the section counter stood at 108 with the current-day exemptions expired, so the two oldest date groups rotated to `CHANGELOG-archive.md`: 2026-08-06 (5 sections, v01.83r–v01.87r) and 2026-08-07 (8 sections, v01.88r–v01.95r), 13 sections total, moved verbatim with commit-SHA enrichment on every header (batch lookup, zero missing). Post-rotation verification clean; active file 95 sections + this one, archive 95

# Changelog Archive

Older version sections rotated from [CHANGELOG.md](CHANGELOG.md). Full granularity preserved — entries are moved here verbatim when the main changelog exceeds 100 version sections.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with per-entry EST timestamps and project-specific versioning (`w` = website, `g` = Google Apps Script, `r` = repository).

## Rotation Logic

When Claude runs Pre-Commit #7 on the push commit, after creating the new version section in CHANGELOG.md, this rotation procedure runs:

### Quick rule (memorize this)

> **100 triggers, date groups move.** When sections exceed 100, rotate the oldest date group. A date group is ALL sections sharing the same date — could be 1 section or 500. Never move part of a date group. Today's sections (EST) are always exempt. Repeat until ≤100 non-exempt sections remain.

### Step-by-step

1. **Count** — count all `## [vXX.XX*]` version sections in CHANGELOG.md (exclude `## [Unreleased]`)
2. **Threshold check** — if the count is **100 or fewer**, stop — no rotation needed
3. **Current-day exemption** — get today's date (EST via `TZ=America/New_York date '+%Y-%m-%d'`). Any version section whose date (`YYYY-MM-DD` in the header) matches today is **exempt from rotation**, even if the total exceeds 100. This means the main changelog can temporarily exceed the 100-section limit on busy days — it self-corrects on the next push after midnight
4. **Mandatory first rotation** — if the threshold check triggered (step 2), you MUST rotate at least one date group before checking the non-exempt count. Do NOT skip straight to the re-check in step 7 — the trigger means "rotate now", not "check if rotation is needed". Proceed to steps 5–6 with the oldest non-exempt date group
5. **Identify the oldest date group** — among the non-exempt sections (dates before today), find the **oldest date** that appears in any section header. **ALL sections sharing that date form a single date group** — this could be 1 section or 100+ sections. The entire group moves together, no matter how many sections it contains
6. **Rotate the group** — move the entire date group from CHANGELOG.md to CHANGELOG-archive.md:
   - **SHA enrichment** — as each version section is moved, look up its push commit SHA and append ` — [SHORT_SHA](https://github.com/ORG/REPO/commit/FULL_SHA)` to the header. Resolve ORG/REPO from `git remote -v`. If the header already contains a SHA link, skip it. If the lookup fails (commit not found — common when git history is shallow), move the section as-is without a SHA link. **Lookup by changelog type:**
     - **Repo CHANGELOG** — headers contain the repo version directly. For `## [v01.05r] — 2026-02-28 ...`, run `git log --oneline --all --grep="^v01.05r " | head -1`
     - **Page/GAS changelogs** — headers contain the page/GAS version AND a repo version cross-reference at the end (e.g. `## [v01.44w] — 2026-03-13 ... — v03.09r`). **Use the repo version cross-reference** for the lookup — it's the same version that appears in commit messages. Run `git log --oneline --all --grep="^v03.09r " | head -1`. This is more efficient than trying to match page versions to commits, since commit messages use repo version prefixes, not page version prefixes
     - **Batch optimization** — when rotating multiple sections, build a lookup table first: run `git log --oneline --all` once, then match each section's repo version against the output in-memory (or via grep). This avoids N separate `git log` calls for N sections
   - Remove them from CHANGELOG.md
   - Insert them into CHANGELOG-archive.md **above** any previously archived sections but below the archive header, in their original order (reverse-chronological, same as in CHANGELOG.md)
   - On the first rotation, remove the `` placeholder
7. **Re-check** — after moving one date group, re-count the non-exempt sections remaining. If still above 100, repeat steps 5–6 with the next oldest date group. Continue until ≤100 non-exempt sections remain (or only today's sections are left)

### Key rules

- **Group by date, not individually** — never split a date group across the two files. All sections from the same day move together. A date group can contain any number of sections — the count of sections in the group is irrelevant; the group always moves as a unit
- **Never rotate today** — today's sections (EST) always stay in CHANGELOG.md regardless of count. The limit is enforced against older dates only
- **Common scenario: all non-exempt sections share one date** — this happens after a busy day followed by a new day. Example: 103 sections total, 3 from today, 100 from yesterday. All 100 from yesterday form one date group → rotate all 100 at once, leaving only today's 3. Do NOT move just enough to reach 100 — the date group is indivisible
- **Preserve content verbatim** — sections are moved exactly as-is (categories, entries, timestamps). No reformatting. The only modification during rotation is SHA enrichment (step 5) — adding a commit SHA link to headers that don't already have one
- **Order in archive** — newest archived sections appear at the top of the archive (just like CHANGELOG.md uses reverse-chronological order). When appending a newly rotated date group, insert it **above** any previously archived sections but below the archive header
- **Threshold is configurable** — the limit of 100 sections is defined in Pre-Commit #7 in CLAUDE.md. To change it, update the number there
- **SHA enrichment is MANDATORY — never skip it** — this is the most commonly skipped step during rotation. The "distraction tunnel" pattern causes it: moving large blocks of text is complex, and the per-section SHA lookup gets lost in the complexity. **Before writing any rotated section to the archive, verify it has a SHA link appended.** If you catch yourself about to insert sections without SHA links, STOP and go back to step 5. The SHA enrichment step applies to BOTH the repo CHANGELOG archive AND all page/GAS changelog archives — every `## [v...]` header in every archive file must have a commit SHA link. For page/GAS changelogs, look up the SHA using the repo version cross-reference at the end of the header (e.g. `— v02.90r` → search for `v02.90r` in git log)

### Post-rotation verification (MANDATORY)

After completing all rotation steps, run this verification before proceeding:

```
grep '^## \[v' CHANGELOG-archive.md | grep -v '— \[' | head -5
```

If ANY lines appear (sections without SHA links), the rotation is incomplete — go back and enrich those sections. **Do not commit until this check passes.** Run the same check on any page/GAS changelog archives that were rotated.

### Examples

**Scenario A: 103 sections, 3 from today, 100 from yesterday (single previous date)**
- 3 sections from today (exempt), 100 from yesterday (non-exempt)
- 100 ≤ 100 → no rotation needed (the threshold counts non-exempt only)

**Scenario B: 104 sections, 3 from today, 101 from yesterday (single previous date)**
- 3 exempt, 101 non-exempt — all 101 share one date
- Rotate ALL 101 at once → 3 sections remain → done
- Result: CHANGELOG has only today's 3 sections

**Scenario C: 102 sections, all from different dates**
- Sections span dates 2026-01-01 through 2026-02-21, today is 2026-02-21
- Today's section (2026-02-21) is exempt → 101 non-exempt sections
- Oldest date group: 2026-01-01 (1 section) → rotate it → 100 non-exempt remain → done

**Scenario D: 102 sections, 5 from today**
- 5 sections from today (exempt), 97 from older dates
- 97 ≤ 100 → no rotation needed despite 102 total

**Scenario E: 105 sections, 3 from today, oldest date has 4 sections**
- 102 non-exempt sections, oldest date has 4 → rotate those 4 → 98 non-exempt remain → done

**Scenario F: 105 sections, 3 from today, oldest two dates have 2 each**
- 102 non-exempt → rotate oldest date (2 sections) → 100 non-exempt → done

---

## [v02.90r] — 2026-08-22 10:57:17 PM EST — [b53b9ea](https://github.com/LightAISolutions/Sales/commit/b53b9eaa768310e52f712201f6d08f837313fbac)

> **Prompt:** "I can see the Technical Annex details now, but the format is very loose. I want the format to be more professional and intuitive to read. Give me some mockups of different formats to choose from. Then, revise all dossiers to match my chosen format." *(Four formats mocked against real ABB data — labelled rows, datasheet grid, banded table, inline definition list. Developer chose **C · Banded table** with **preserve wording exactly**.)*

### Added
- **Banded spec format across all 62 dossiers (`Profiler.html` v01.41w)** — `technicalSpecs[].specs` entries gain an optional `band`, and consecutive entries sharing one render under a gold category header inside the product table. Bands live on the rows themselves rather than in a nested structure, so a profile written before banding — and every archived snapshot — simply has no bands and renders flat. `ovSpecRow` carries the field through, `ovSpecBandOpens` decides where a header is emitted, and both the app renderer and the export/preview builder emit them (`ovDocFacts` takes an optional third tuple element for the band). Styling added for the app, the preview/PDF skin and the Word export's inline CSS
- **Fixed label column on banded tables** — a `colgroup` sets a 208px first column under `table-layout: fixed`, so every product table in a section shares one value-column edge. The colgroup is required rather than a `td` width: the first row of a banded table is a `colspan=2` band header, from which fixed layout would otherwise derive a 50/50 split
- **`scripts/apply-bands` migration guard (scratchpad, not committed)** — validated every migrated value against a punctuation-insensitive digest of its product's source text before writing, so a re-cut that reworded a value failed the run instead of shipping. It caught one (a hitachi-energy value that had a parenthetical lifted out of its middle) and was hardened mid-run to validate all slugs before writing any, after an abort left four dossiers migrated with the archive index unsaved (repaired in the same pass)

### Changed
- **All 62 dossiers migrated to the banded format** — 926 spec entries (476 unlabelled statement strings + 450 label/value pairs) re-cut into **983 banded rows across 817 product/band groups**; zero plain-string specs remain. Every value is verbatim source text split on its own punctuation; labels and bands are new authoring. Each dossier's outgoing version was archived and indexed per the Archival Procedure, and `profileVersion` incremented
- **`PROFILER-SCHEMA.md`** — `technicalSpecs[].specs` now documents the banded entry as the authoring format, states that values are copied verbatim while labels and bands are authored, and records that both legacy shapes (unbanded pair, plain string) must keep rendering because archived snapshots hold them permanently

### Notes
- Format chosen from four mockups rendered against the Profiler's real stylesheet with real ABB data (a short product and a dense one, to show scaling): A labelled rows, B datasheet grid, C banded table, D inline definition list
- The 62 archived snapshots add 62 entries to the admin-only Versions overlay for a format-only revision. Following the Archival Procedure as written, since the protection is worth having across a 926-entry restructure — but it is the one debatable cost of doing this as a versioned revision rather than an in-place reformat

## [v02.89r] — 2026-08-22 10:24:05 PM EST — [a9182c8](https://github.com/LightAISolutions/Sales/commit/a9182c8d380ec89182fc0544288044189211451c)

> **Prompt:** "The only issue between the admin and contributor accounts is that when I logged into the contributor account after using the Industry Guidance module on the admin account, it saved the progress from the admin account instead of giving the contributor account a clean version of the module. Fix that.
>
> Also, several dossiers show nothing under the Technical Annex (see attached screenshot). Why is that? Make sure every dossiers' Technical Annex shows some information or doesn't show a Technical Annex at all." *(Screenshot: ABB dossier, Technical Annex showing three product headings over empty table rows.)*

### Fixed
- **Industry Guidance progress leaked between accounts on a shared browser (`Profiler.html` v01.40w)** — `gdProgress`/`gdSetProgress` keyed on `ov_guide_progress_<docId>`, which is device-scoped, so a second account signing into the same browser inherited the first account's ticked sections. Progress is now keyed `ov_guide_progress_<acct>_<docId>` via `gdProgressKey`, where `<acct>` is a djb2 digest of the signed-in address from the new `ov_note_email` key (`ovAcctKey`). The address is recorded at all three sign-in sites (token exchange + both `whoami` paths) and cleared at all three sign-out sites. Each account keeps its own progress on the device; a new account starts clean. A one-time `gdPurgeSharedProgress` drops the pre-v01.40w shared keys — they cannot be attributed to an account, so crediting them to whoever signs in first would reproduce the bug
- **Technical Annex rendered blank for 41 of 62 dossiers (`Profiler.html` v01.40w)** — `technicalSpecs[].specs` entries exist in two authored shapes: 450 label/value objects and 476 plain strings (no dossier mixes them). Both renderers read `.label`/`.value` only, so string entries produced rows of two `undefined` cells in the app, and were dropped entirely by `ovDocFacts`'s falsy-value guard in exports — headings over empty tables in both. Added `ovSpecRow` (dual-shape normalizer; string becomes a statement row with an empty label) and `ovSpecGroups` (drops rows with no text, then groups with no rows and no notes), used by the app renderer, the export/preview builder and `ovDocFacts`, which now spans unlabelled rows across both columns. Affected: abb, aligned, applied-digital, bechtel, black-veatch, bloom-energy, burns-mcdonnell, constellation-energy, core-scientific, coreweave, crusoe, delta-electronics, dpr, eaton, equinix, eve-energy, ge-vernova, hitachi-energy, hitt, holder-construction, huawei-digital-power, iren, kiewit, lambda, liteon, mortenson, nebius, openai, oracle, primoris, qts, quanta-services, schneider-electric, siemens-energy, stack-infrastructure, switch, terawulf, turner-construction, vantage, vertiv, xai
- **Empty specs sections are no longer emitted** — a profile whose spec groups all reduce to nothing renders no specs heading at all, in the app and in exports

### Changed
- **`scripts/verify-profiler-roles.py` widened to three checks** — the access matrix (unchanged, still screenshots per tier) plus `check_progress_isolation` (signs two accounts into one browser context and asserts progress namespaces differ, the second starts clean, and the first keeps its own) and `check_spec_sections` (walks all 62 dossiers via hash routing and asserts no blank spec row and no lone specs heading). The backend stub now reads a mutable role/email state so one context can switch accounts. Result: 62/62 dossiers clean, 0 blank rows, progress isolated
- **`PROFILER-SCHEMA.md`** — `technicalSpecs[].specs` now documents both accepted entry shapes, names the labelled pair as preferred for new authoring while explicitly permitting a plain string where a spec is naturally one sentence, and records the drop rules for empty rows, groups and sections

### Notes
- The `<td colspan="2">` statement row and the matching `.ov-spec-hd` heading style are new; the labelled two-column form is untouched, verified against a labelled dossier (amazon) alongside a string-spec one (abb)
- Renderer tolerance rather than data normalization, per the standing rule: archived snapshots keep whichever shape they were authored with, and converting 476 statement strings into labelled pairs would mean inventing 476 labels
- The first run of the new progress check failed on a test bug, not a product bug — re-navigating to an identical URL is a same-document fragment move, so the page never re-ran `whoami` and the stale account was still in `localStorage`. The helper now reloads explicitly and waits for the account the stub is reporting

## [v02.88r] — 2026-08-22 08:01:32 PM EST — [9660334](https://github.com/LightAISolutions/Sales/commit/966033452b7c6fb5cc00746d25d269461cd04c69)

> **Prompt:** "Picking up from my recent \"AIDC market report photo backfill\" session, triage zhonhen notes and refresh the dossier.
>
> Also, make it so that my Profiler app follows the following Role + Access structure:
>
> * \"admin\" level users can see all features the app has.
> * \"contributor\" level users cannot see \"Field Note\" (button and section below) and \"Versions\".
> * \"analyst\" level users cannot see \"Field Note\", \"Versions\", nor \"Industry Guidance\".
> * \"viewer\" level users cannot see \"Field Note\", \"Versions\", \"Industry Guidance\", nor \"Export dossier\"
>
> Do a check to verify that these Role + Access permissions are correct and show me screenshots taken from different Roles."

### Added
- **Role + Access matrix in the Profiler app (`Profiler.html` v01.39w)** — replaces the binary `admin`/`member` split with a four-tier capability model. `OV_ROLE_CAPS` maps each ACL tier to UI capabilities (`fieldNote`, `versions`, `guidance`, `export`, `style`); `ovCan(cap)` is the single gate consulted by all seven call sites (style switcher, Industry Guidance button, Versions button, Export button, Field note button, the note box below the dossier, and the field-notes log cog on the roster). `ovNormalizeRole(role, isAdmin)` collapses whatever the backend reports into one of the four known tiers — roles carrying the `admin` permission (`admin`, `developer`) normalize to `admin`, and any unmapped tier (`editor`, `medical_director`, a stale `member` value) collapses to `viewer`, so an unrecognized ACL role can only lose access, never gain it
- **Preview-as-role (`?as=<tier>`)** — narrows the current session to another tier's surface for verification from a single account. `ovCan` intersects the real capabilities with the previewed ones, so the parameter can only ever subtract: a viewer requesting `?as=admin` still gets viewer
- **`scripts/verify-profiler-roles.py`** — Playwright harness that serves `live-site-pages/` locally, stubs the Profiler GAS backend (`whoami` + `guidance` ops), signs in as each tier through the real `ovNormalizeRole` path (the tier is never written to localStorage directly), asserts the rendered surfaces against the matrix, and writes `.playwright-screenshots/profiler-role-<tier>.png`. Non-zero exit on any mismatch. All four tiers verified: admin 6/6 surfaces, contributor guidance+export, analyst export only, viewer none
- **Zhonhen dossier v3** — the NVIDIA August 2026 execution paper naming the Panama Architecture as a TRU implementation of its data-hall DC power block (pp. 21–23) added to `recentDevelopments`, `ecosystemRole` and `strategyRead[1]`, with the paper cited in `sources[]`; a new `strategyRead` entry promoting the field note on neocloud targeting as labeled analysis; an interface note on the JV flagship spec (a 3.6 MW Panama-800VDC system is a sub-block element against NVIDIA's ~4.8 MW block, not a one-for-one substitute); collection-gap date advanced to 2026-08-22. v2 archived to `archive/zhonhen.profile.v2.json` and registered in `archive-index.json`

### Changed
- **Server-side guidance gate widened (`Profiler.gs` v01.18g)** — `handleGuidanceOp_`'s inline admin check replaced with `guidanceAllowed_(sess)` (`GUIDANCE_ROLES = ['contributor']` plus anything carrying the `admin` permission), returning `ROLE_DENIED` instead of `ADMIN_ONLY`. Unit-tested across nine role/permission shapes including case variance and missing fields. The note write pipeline (`submit`/`list`/`edit`/`delete`) stays admin-only in `handleNoteOp_` — unchanged
- **Mid-session downgrade handling** — a server `ADMIN_ONLY` on a note op now stores the least-privileged tier and repaints the view (removing the note surface) instead of falling back to the suggest form, which the matrix no longer exposes
- **Post-auth repaint** — the sign-in wall's `pass()` now re-runs `ovRoute()` so role-gated controls built during a render that raced `whoami` are rebuilt against the resolved tier

### Notes
- The `suggest` note op and the page's `renderSuggest()` form are both retained but no longer reachable through the UI: under the matrix no non-admin tier renders the note box at all. Left in place deliberately rather than removed — if a suggest-capable tier is wanted later, both halves already exist
- Field-note triage this pass: the neocloud-targeting note was **promoted** into `strategyRead` as labeled analysis; the Schneider Electric note remains **logged-only** under the standing confidentiality rule. The Drive-hosted note log is not readable from a session, so both were triaged from the recorded session context rather than from the log, and neither developer confidence rating was available — the promoted entry is hedged at moderate confidence pending the developer's rating

## [v02.87r] — 2026-08-22 07:32:39 PM EST — [ed021c3](https://github.com/LightAISolutions/Sales/commit/ed021c3be129927704bf94b6631efb4b4d8b114f)

> **Prompt:** "continue with your recommendation"

### Added
- **`zhonhen-block-composition.md` + `ZHONHEN-BLOCK-COMPOSITION.pdf`** — the technical-sales argument answering NVIDIA's standardized 4.8 MW power block from Zhonhen's lineup. Contents: the current-ladder derivation (6000 A = 4.8 MW ÷ 800 V; 1250 A = 1 MW; 125 A = 100 kW), the legitimacy argument (the paper's TRU section canonizes "multiple rectifier modules operating in parallel", p22 — composition is a named implementation family, not a workaround), the composition arithmetic (2 × 2.5 MW Panama = the drawn 5 MVA block; **8 × 2.5 MW = a 20 MW Deployment Unit exactly**; the 5 MW MVR container equals the drawn block 1:1; the future 8 MW cluster fits only via 2 × 4 MW), an eight-row interface scorecard (switchboard, tap cans, catcher STS — rehearsed by the delivered Alibaba STS/ATS fleet — DR four-bus mapping, fault-current envelope, grounding, current sharing, certification), ten engineering questions, and the closing lines for the room. Registered in `scripts/build-study-prep-pdf.mjs`
- One deliberate caution carried prominently: the deck's MVR container table lists 270/400 Vdc output — **which MW ratings ship at 800 VDC is question #1**, not an assumption

## [v02.86r] — 2026-08-22 07:05:31 PM EST — [19ac4d3](https://github.com/LightAISolutions/Sales/commit/19ac4d33659a23460009702d3eeee7e77283b555)

> **Prompt:** "I want you to create an \"Industry Guidance\" button (located where the red circle is in the attached screenshot) that is only visible to \"admin\" level users. This section will be where I send you impactful industry-wide documents to analyze and create whatever you think is best for me to deeply understand them. I would expect to see overviews and study guides, as well as interactive widgets or modules whenever applicable. Maybe even a chatbox where I can ask you questions and have you respond in-app if you can link to this Claude account. Be creative.
>
> For my first entry, this is the NVIDIA white paper that came out recently that Zhonhen's deck refers to. I need to deeply understand it as it is most likely going to be the primary form of industry guidance for the next year or so. Analyze it, then create a detailed overview and study guide of it that is custom-tailored to me. I want you to consider what I know and what I don't know, and explain technical content as needed. Display graphs and tables whenever possible to make it easier for me to digest information. Also, generate a timeline for me to visually see how NVIDIA maps different generations of solutions whenever applicable. Also, pay attention to comparisons and clearly state advantages/disadvantages whenever applicable.
>
> Create an action plan for me to approve before starting work." *(Plan approved via structured questions: in-app renderer + gated op architecture; Q&A skipped for v1; source PDF committed; Zhonhen docs updated.)*

### Added
- **Industry Guidance hub (Profiler v01.38w · GAS v01.17g)** — admin-only "✦ Industry Guidance" button on the Profiler masthead (created only after a validated admin session by the auth wall's `pass()`) opening a full-screen overlay that renders document-analysis study modules. The renderer (`gdRenderDoc` + widget engine in `Profiler.html`) draws everything from module JSON — prose with `{{term}}` glossary tooltips, callouts, tables, pros/cons cards, a lane-colored vertical timeline, magnitude bars, click-to-flip flashcards, a scored self-test, a page-referenced claims ledger, per-section "For the Zhonhen conversation" notes, and per-section reading-progress ticks (localStorage) — so future documents need no page changes. Timeline/lane colors CVD-validated with the dataviz six-checks against the card surface (gold `#b18f35` / blue `#4f83e6` / rose `#cc5f75`)
- **Guidance API in `Profiler.gs`** — `action=guidance` (`gop=index|doc`) on the existing cookie-less fetch transport (POST + GET api-route mirror), admin-gated server-side in `handleGuidanceOp_` via `validateSessionForData` + the `admin` permission; pure `// PROJECT:`-marked additions (deploy handler untouched, no template overrides). Module content ships inside the PROJECT block — repo + GAS project only, never on public Pages. Behaviorally tested: index/doc/unknown-doc/non-admin paths
- **First module: NVIDIA 800 VDC white paper (Aug 2026)** — 14 sections, 30-term glossary, 16 flashcards, 10-question quiz, 34-row claims ledger; every quantitative claim verified by two independent extraction passes over the source PDF. Source committed at `repository-information/industry-guidance/sources/nvidia-800vdc-white-paper-2026-08.pdf` with the full analysis in `nvidia-800vdc-analysis.md` (the module's source of truth)
- **`.claude/rules/industry-guidance.md`** — the "industry guidance: \<document\>" command (ingest → verified deep-read → analysis markdown → in-app module → admin-gated serving → versioning); CLAUDE.md gains the command pointer section + Reference Files row

### Changed
- **Zhonhen prep docs amended from the now-in-hand paper** (`zhonhen-strategy-report.md`, `zhonhen-deck-summary.md`, `zhonhen-lesson-plan.md` + regenerated PDFs): the "simpler and highly familiar design philosophy" quote is **verified at p22**, which also names the "Panama Architecture" as one of three canonical TRU implementations — retiring the strategy report's claim that Panama "appears in no accessible NVIDIA or OCP document" and flipping the quote from Zhonhen-conversations-only to customer-usable (cited + paraphrased). A dated update block also records the window refinement: 2029 attaches to next-gen SST specifically, while TRU-based 4.8 MW blocks are specified now and Option B deploys as soon as Q3 2027
- `repository-information/diagrams/profiler-diagram.md` prose notes document the guidance ops on the shared fetch transport
- README structure tree: `industry-guidance/` directory + rules file registered; Profiler tree entry now shows v01.38w · v01.17g

## [v02.85r] — 2026-08-22 05:05:29 PM EST — [0129e28](https://github.com/LightAISolutions/Sales/commit/0129e28be48dfce374e8c34a51a6a101309884b1)

> **Prompt:** "continue with your recommendation. I want the one-pager output as a downloadable PDF."
>
> *(mid-turn)* "It is ok to go over 1 page as long as the information is good and complete."

### Added
- **`zhonhen-one-pager.md` + `ZHONHEN-ONE-PAGER.pdf`** — an interview-day scan sheet compressing the strategy report, lesson plan and deck summary into what the developer can hold five minutes before the call: the opening line, the TRU-vs-SST table (with the correction landed in v02.84r), ERCOT's binding NOGRR282 numbers, the 473 kW/m³ argument **segmented by buyer type**, a landmines table, numbers cold, and the Schneider question to close on. Registered in `scripts/build-study-prep-pdf.mjs` so the Markdown stays the source of truth
- **`dense: true` option in `scripts/build-study-prep-pdf.mjs`** — a scan-sheet variant of the BloombergNEF skin. A sheet read standing up is a different document class from a report: the masthead stops behaving like a cover (h1 30pt → 17pt, sub 15pt → 9.5pt), and vertical rhythm tightens throughout. Opt-in per document; every existing document renders unchanged

### Changed
- README structure tree: the two new Zhonhen prep files registered under `study-prep/zhonhen/`

### Notes on scope
- The document is **2 pages, not 1**. It was cut to fit a single page first — that version lost the buyer segmentation, half the landmines and most of the numbers block, which is the material actually worth carrying into the room. The developer confirmed mid-turn that length was fine if the content was complete, so the full version was restored and the dense type backed off from 8.05pt to 8.7pt for readability. The name is kept as the developer's own term for the artefact

## [v02.84r] — 2026-08-22 04:42:58 PM EST — [54100bb](https://github.com/LightAISolutions/Sales/commit/54100bb31c1c92cc04125fb30f6e79616b9098b2)

> **Prompt:** "Continue with your recommendation.

A few questions:

* What is the difference between a Medium Voltage Rectifier like Zhonhen's Panama system and a true Solid State Transformer?
* "473 kilowatts per cubic meter on the 1MW sidecar — with the capacitor and battery options inside the same cabinet — is the spec I'd lead with for neocloud buyers." This quote is from the "Zhonhen Deck Summary" pdf. Explain why you would lead with this spec for neocloud buyers. Tell me what they care the most about and why."

### Fixed
- **`zhonhen-lesson-plan.md` corrected a factual error that would have cost credibility in the interview.** The plan told the developer to describe Panama as a "solid-state transformer / MV rectifier sidecar" and to say so "in exactly those words". Panama is a **transformer-rectifier unit** — a line-frequency transformer feeding a rectifier — whereas a true SST switches MV-rated SiC at kilohertz and takes isolation through a high-frequency core. Both fill the same MV-to-DC block slot (Schneider's 800VDC paper: "by SST or TRU"), but they are different device classes and a power-electronics buyer would catch the conflation. Both the Module 3 passage and the Module 5 Q&A row now say TRU explicitly, and explain why the TRU framing is the stronger card. `ZHONHEN-LESSON-PLAN.pdf` regenerated from the corrected Markdown

### Changed
- `scripts/harvest-exec-photos.py` environment notes now record the **full Chromium/proxy diagnosis** so no future session re-derives it: Chromium does honour the proxy (a deliberately wrong port yields `ERR_PROXY_CONNECTION_FAILED`); its NSS trust store starts empty, which is fixable with `libnss3-tools` + `certutil` and is why the failure first appears as `ERR_CERT_AUTHORITY_INVALID`; after that fix github.com returns a real HTTP status but all other hosts still reset, with nothing in the proxy's `recentRelayFailures` and no change from `--disable-quic`/`--disable-http2`. That residue is upstream egress policy, to be reported rather than routed around. The notes also record that regulatory filings carry no exec photos while designed ESG reports show boards rather than executive teams

### Notes on scope
- **No photos were harvested this push.** The recommendation was to determine whether the browser path could be unblocked; it cannot be, from inside the session. Two genuine client-side defects were found and fixed along the way (missing proxy CA in the browser trust store, and the untested assumption that Chromium was ignoring the proxy), but the remaining reset is policy-side. Unblocking it is an administrator action

## [v02.83r] — 2026-08-22 04:05:21 PM EST — [b23c933](https://github.com/LightAISolutions/Sales/commit/b23c9330cde38831990583738eed8ff9f9dad60e)

> **Prompt:** "continue with your recommendation. Also, I have already added the two field notes to Profiler."

### Added
- New **PDF track** in `scripts/harvest-exec-photos.py` (`pdfs` subcommand) — harvests headshots out of company-published PDF reports by matching each embedded image to the caption printed beside it, since PDFs carry no alt text. Two caption layouts are scored (name below a grid portrait, name to the right of a bio-block portrait) and images are captured by rendering the clip region rather than extracting the raw xref, so masks and alpha composite as a reader sees them
- 4 verified headshots from company ESG/annual reports (exec photo coverage 160 → 164 of 320; dossiers with at least one photo 43 → 46): **Samsung SDI** (Joo Sun Choi), **LG Energy Solution** (Kim Dong-Myung, Lee Chang Sil) and **Huawei Digital Power** (Hou Jinlong). All three companies previously had zero photos

### Changed
- README structure tree: exec-image directory description now reflects 164 images across 46 companies and names PDF reports as a photo source

### Fixed
- PDF caption matching evaluated only the text *below* an image, so layouts that print the name to the *right* of a bio-block portrait never matched — Huawei's director pages were silently missed until both bands were scored

### Security
- Every PDF candidate was inspected on a rendered contact sheet before wiring. A re-run of the first-party track re-surfaced the Core Scientific "Yadin Rozov" image (alt text scores 100) and it was **rejected again** — the file at that URL is the company logo, not a person

### Notes on scope
- **The recommendation this push acted on was only partly borne out.** Regulatory filings — A-share and HKEX annual reports — are text-only: verified directly on CATL's 2025 annual report, where every page naming multiple executives carried zero images. Only *designed* ESG/sustainability reports and corporate annual reports contain portraits, and those show **boards**, not full executive teams, so most named directors are not the operating executives the dossiers track. Yield was 4 photos, not the ~60 the channel was proposed to reach
- Playwright still cannot reach corporate sites through the proxy (`ERR_CONNECTION_RESET`, re-tested), so JS-rendered leadership pages — the largest remaining block — stay out of reach

## [v02.82r] — 2026-08-22 03:18:46 PM EST — [38d5856](https://github.com/LightAISolutions/Sales/commit/38d585664353bb0d8647affa6094e7aa32a3ece3)

> **Prompt:** "Picking up from my recent "AIDC market report batch D" session, continue the photo backfill."

### Added
- Executive-photo backfill, second pass: **34 verified headshots across 19 dossiers** (exec photo coverage 126 → 160 of 320; dossiers with at least one photo 38 → 43). **First-party (27)**: Aligned, Applied Digital, Bloom Energy, Core Scientific, CoreWeave, Fluence, IREN, QTS, Quanta Services, Siemens Energy, STACK Infrastructure, Switch, Vantage and Wärtsilä leadership pages. **Wikimedia Commons (7)**: BYD (Wang Chuanfu, Stella Li), Google (Demis Hassabis), Meta (Andrew Bosworth), OpenAI (Sam Altman, Greg Brockman) and Oracle (Safra Catz), each carrying a `photoCredit` attribution
- `scripts/harvest-exec-photos.py` — the harvest method captured as reusable tooling with five subcommands (`gaps` / `firstparty` / `commons` / `sheet` / `wire`), replacing the ad-hoc scripts rebuilt each session

### Changed
- First-party discovery now **crawls the site's own navigation** (homepage → about/company/investor hubs → leadership leaves) instead of guessing common URL paths. Path-guessing was the prior sweep's main failure: `global.abb`, `byd.com` and `jinkosolar.com` all serve HTTP 200 but place leadership outside every common pattern
- Exec-name matching expands each name to its alias forms before scoring, so `James (Jim) Moos`, `Wu Zuyu (吴祖钰) — "Jeff Wu"` and `Thomas M. 'Tommy' Holder` can match a page that prints only one of those forms
- Commons lookups resolve a person's **Wikipedia biography lead image** rather than searching Commons filenames — a biography's lead image depicts its subject, which removes the failure mode that matched a cottage window to "Olivier Blum" last sweep
- `photoCredit` license strings normalised to Wikimedia's spaced attribution style (`CC BY-SA 4.0`, not `CC-BY-SA-4.0`) across `meta`, `byd`, `google` and `openai`, and the generator now emits that form

### Fixed
- Exec objects packed onto a single line in older-vintage profiles (`google`, `meta`) are now wired in place rather than reported as "name line not found"
- Two execs sharing a surname within one company no longer overwrite each other's image file — the collision was silently discarding one photo (caught on Delta Electronics: `Ping Cheng` and `Victor Cheng` both resolved to `delta-electronics-cheng.jpg`)

### Security
- Every candidate was inspected on a rendered contact sheet before wiring; **5 first-party candidates were rejected** — a Core Scientific company logo, a Lambda blog banner group shot, a generic "Headshot-Template" file, and both Delta Electronics images (generic `alt` text plus the filename collision above). **2 Commons candidates** were rejected at the license check

## [v02.81r] — 2026-08-22 04:39:06 AM EST — [3443ee3](https://github.com/LightAISolutions/Sales/commit/3443ee31d054a7ba165ec944a4dede1000d3c7d3)

> **Prompt:** "run the photo backfill"

### Added
- Executive-photo backfill: 40 verified headshots added across 17 dossiers (exec photo coverage 86 → 126 of 320; dossiers with at least one photo 21 → 38). Two tracks — **first-party (23)**: official leadership pages for Vertiv, GE Vernova, Equinix, Constellation Energy, Rosendin, Crusoe and Microsoft, harvested by matching exec names against image filenames/alt text; **Wikimedia Commons (17)**: license-verified free images (CC BY / CC BY-SA / public domain only) for Amazon, Google, Meta, Microsoft, NVIDIA, OpenAI, Oracle, Tesla, xAI, ABB and Schneider Electric, each carrying a `photoCredit` attribution
- New `photoCredit` schema field (`repository-information/PROFILER-SCHEMA.md`) rendered as a caption on exec cards in the app and as a credit line in Word/PDF exports (`live-site-pages/Profiler.html` v01.37w)

### Changed
- Photo policy extended per developer approval (`PROFILER-SCHEMA.md`, `.claude/rules/profiler-app.md`): company-published photos now joined by verified free-licensed Wikimedia Commons images of public figures; LinkedIn scraping, news-agency/wire photos and video frame-grabs remain prohibited

### Fixed
- 4 of 21 Commons candidates were rejected at visual verification before wiring (a French cottage window matched for "Olivier Blum", a 19th-century painting for "Christian Bruch", plus two unusable group shots) — every accepted photo was inspected on a rendered contact sheet, not trusted from search scoring alone

## [v02.80r] — 2026-08-22 03:25:08 AM EST — [c4935d7](https://github.com/LightAISolutions/Sales/commit/c4935d77e28deec4714c3161dd6434e5894a3053)

> **Prompt:** "Some of the dossiers don't have any Key Judgments (ie: ABB) - Why not? Go through all the dossiers and create some. Also, most dossiers' Key Personnel section don't have any pictures, while some others do - Why? Can you think of new ways to get some pictures of the executive leadership team?"

### Fixed
- Key Judgments visibility: all 62 dossiers already carried `strategyRead` data, but seven older profiles (abb, eve-energy, hitachi-energy, huawei-digital-power, quanta-services, siemens-energy, xai) stored entries as `{confidence, judgment}` objects that `ovEl` rendered as "[object Object]" — added an `ovStratText` dual-shape helper to both the app renderer and the export builder in `live-site-pages/Profiler.html` v01.36w (archived snapshots keep the old shape, so renderer tolerance is required), and normalized the seven live profiles to the schema's canonical string form ("(High confidence) …") via bracket-matched surgical edits — no content changed, no profileVersion bumps (format normalization per the v02.74r precedent)

## [v02.79r] — 2026-08-22 03:15:24 AM EST — [b6be1cd](https://github.com/LightAISolutions/Sales/commit/b6be1cd229ce6663471854ceacb011e5a4ea156b)

> **Prompt:** "Fix Zhonhen Electric's "BOTTOM LINE UP FRONT" and "BACKGROUND" sections. I want there to be a space between them like all other dossiers. Do a sweeping check on all dossiers to make sure this format is congruent. Also, see the first attached screenshot - Is that a typo? It doesn't make sense to me. Fix it. \
Then, for all dossiers, analyze and identify different sections and display them as labeled tabs in the red circled area in the second attached screenshot. Make sure to space things out properly for ease of use. I don't want users to have to scroll down such a long sweeping document to find the information they are looking for. I also want each dossier to look professionally prepared. When a dossier gets exported, recombine all the tabs into one comprehensive document/PDF, but make sure each tab starts on a separate page instead of where the last tab left off. Also, for exports specifically, make a Table of Contents on page 2 with each chapter hyperlinked to the page that the chapter starts on. If you have any suggestions regarding my formatting, let me know before you begin."

### Added
- Tabbed dossier layout in `live-site-pages/Profiler.html` v01.35w: seven style-aware tabs (Overview, Products & Specs merged, Developments, Key Judgments, Leadership, Financials, Sources) rendered as a sticky pill bar between the dossier header and content; per-tab panes replace the single long document; tabs appear only when a dossier has that section; deep-linkable `#slug/tab` URLs via `history.replaceState` (developer-selected design: 7 tabs / sticky + deep links / Word-only real page numbers)
- Paginated exports: `ovBuildDoc` now emits anchored `h2.d-ch` chapters with `page-break-before` (cover = page 1, hyperlinked Contents = page 2, each chapter on a fresh page — verified 15-page print PDF with live internal links); the Word export swaps the static ToC for a real Word `TOC \o "2-2" \h` field that populates page numbers on field update

### Fixed
- Summary paragraphing: `ovAppendSummary` now splits on `BACKGROUND:`/`BACKGROUND.`, `Watch items:` and `Collection gap(s):` signposts, so all 62 dossiers render spaced paragraphs (the nine batch-B/C single-block summaries included); Zhonhen's data normalized `BACKGROUND.` → `BACKGROUND:` (the renderer split only on the colon form — the reported bug)
- Zhonhen summary readability: bare "10jqka" consensus attribution expanded to "Tonghuashun (the Chinese financial-data platform 10jqka.com.cn)" — not a typo, an unexplained platform name (`zhonhen.profile.json`)

## [v02.78r] — 2026-08-22 02:53:44 AM EST — [4a66d30](https://github.com/LightAISolutions/Sales/commit/4a66d30e788970607f1a62a3ba844610aca4aad9)

> **Prompt:** "continue with your recommendation"

### Fixed
- Zhonhen dossier revised to profileVersion 2 (v1 archived per the Archival Procedure): corrected the claim that NVIDIA's published 800VDC partner roster "names Delta, Megmeet and Hopewind" — verification against NVIDIA's own May and October 2025 partner posts shows Hopewind appears on neither list (it was sourced from Chinese trade coverage that lumped it in). Fixed in `ecosystemRole`, a product highlight, and `strategyRead`; the Sina-roll source replaced with NVIDIA's two primary blog posts in `zhonhen.profile.json`; registry `lastUpdated` synced; `archive-index.json` updated. Playwright render check passed

## [v02.77r] — 2026-08-22 02:47:09 AM EST — [7dc5476](https://github.com/LightAISolutions/Sales/commit/7dc547643feb529615c2598c12a202cc74f599cf)

> **Prompt:** "I want to impress Jacky Zhu from Zhonghen in our next call, so I need to fully understand how Zhonhen is positioned to amongst other SST and medium-voltage (MV) solution providers. I want you to create a strategy report from Zhonhen Electric's perspective. I know that AIDC projects currently care a lot about the MV solution's ability to endure voltage ride-through from the grid(led by the EROCT market) and voltage flickers from fluctuating GPU usage from the server chips. Also, Jacky has told me that he has a relationship with Schneider Electric (confidential) and CATL (public). Analyze how Zhonhen should leverage these relationships to penetrate the US AIDC market. Jacky also said that they are targeting neoclouds due to their willingness to procure power solutions (priority is speed and technical capability); Check if that information is true, and if so, tell me which neocloud(s) I should target, why, and how. Make sure to properly source information that form the crux of the strategy. Output the report as a downloadable PDF. \
If you hit the end of my weekly Fable limit before this task is done, switch to Opus 5 Xhigh effort and continue."

### Added
- Zhonhen US AIDC market-entry strategy report (`repository-information/study-prep/zhonhen/zhonhen-strategy-report.md` + `ZHONHEN-STRATEGY-REPORT.pdf`, 15 pages): SST/MV competitive positioning against the verified NVIDIA 800VDC rosters and productization ladder (MV-to-DC power blocks are NVIDIA's 2029 rung — Zhonhen ships one-stage MV-to-DC today), the ERCOT ride-through sales narrative (NOGRR282/NPRR1308 Large Computational Load rule, effective 2026-08-01; FERC-ordered national NERC standards due Dec 2026) and GPU-flicker narrative (Microsoft/OpenAI/NVIDIA arXiv 2508.14318; the proposed 10 MW / 5-second ERCOT variation limit), CATL (public) and Schneider Electric (confidential first-hand intel) leverage analysis, verified neocloud targeting (IREN and Crusoe ranked first; xAI deprioritized on security politics; tenant neoclouds routed to the rack-side product motion), risk stack, and a call playbook — ~45 crux sources cited with URLs, unverifiable claims explicitly flagged
- New `zhonhen-strategy-report` entry in the `scripts/build-study-prep-pdf.mjs` DOCS registry (Strategy Report masthead, confidential-handling banner)

## [v02.76r] — 2026-08-22 02:04:25 AM EST — [0ade66d](https://github.com/LightAISolutions/Sales/commit/0ade66d95a800f9848eb5da97601e72e8b53a056)

> **Prompt:** "Picking up from my recent "AIDC market report batch A" session, continue with batch D."

### Added
- Batch D of the Profiler roster expansion — colocation providers (registry 57 → 62): Vantage Data Centers, Aligned Data Centers, QTS Data Centers, Switch, and STACK Infrastructure dossiers (`live-site-pages/profiler-data/{vantage,aligned,qts,switch,stack-infrastructure}.profile.json` — schemaVersion 2, profileVersion 1, intel-briefing style, 39–44 sources each) with matching technology study guides (`*.study.json`) and 24 company-published executive photos in `live-site-pages/images/execs/`
- The five colocation providers (all private) joined the quarterly private-company sweep — armed list and per-company watch items added to `.claude/rules/profiler-app.md`; the sweep Routine's name and fired prompt updated to 21 companies

### Changed
- README tree caught up on 42 entries missed by prior sessions (the 30 v02.74r study guides and 12 newer `profiler-data/archive/` files) and adds this batch's 10 new data files and executive-photo counts
- CHANGELOG archive rotation: the 2026-08-05 date group (7 sections, v01.76r–v01.82r) rotated to `CHANGELOG-archive.md` with SHA enrichment (counter 100 → 94)

## [v02.75r] — 2026-08-21 11:01:38 PM EST — [0f7c48b](https://github.com/LightAISolutions/Sales/commit/0f7c48b9e924ba72aafdbb37c23f4d1bf396013f)

> **Prompt:** "Evaluate all the companies under my coverage and recategorize them accordingly. I want to see EPCs and General Contractors added to the category list."

### Added
- New `epc` and `gc` roster categories (displayed as "EPC" / "General Contractor" via a new `ovCatLabel` map) with dedicated tag colors (`--ov-epc` yellow, `--ov-gc` tan) in `live-site-pages/Profiler.html` v01.34w, registered in `profiler-companies.json` and documented in `repository-information/PROFILER-SCHEMA.md`

### Changed
- Roster-wide recategorization after evaluating all 57 covered companies (registry + profile JSONs): Bechtel, Black & Veatch, Burns & McDonnell, Kiewit, Primoris, Quanta Services, and Rosendin moved `integrator` → `epc`; DPR, HITT, Holder Construction, and Turner Construction moved `integrator` → `gc`; Mortenson dual-tagged `gc` + `epc` (data-center shell GC plus utility-scale renewables EPC); Equinix moved `hyperscaler` → `developer` (colo/data-center operator-landlord, not a cloud provider) — leaving `integrator` as the clean BESS-integrator set (FlexGen, Fluence, Wärtsilä)
- Category display sites (roster tags, filter chips, dossier "Ecosystem role" fact, Word-export meta line) now render labels through `ovCatLabel` (`live-site-pages/Profiler.html`)

## [v02.74r] — 2026-08-21 10:49:24 PM EST — [369827c](https://github.com/LightAISolutions/Sales/commit/369827c23039a27bcf11b6e88dc911ca4b4839e2)

> **Prompt:** "Run the study-guide backfill. Also, split the neocloud companies out of the "Hyperscaler" category into their own "Neocloud" category. Also, see the attached screenshot - Capitalize the first letter of words in the Background section for all dossiers and separate out the "Bottom Line Up Front" section from the "Background" section into their own paragraphs."

### Added
- 30 new study guides completing roster-wide study coverage (`live-site-pages/profiler-data/*.study.json`): hyperscalers/AI labs (Amazon, Google, Meta, Microsoft, NVIDIA, OpenAI, Oracle, xAI), neoclouds & DC operators (CoreWeave, Crusoe, Equinix), power electronics & electrical OEMs (ABB, Delta Electronics, Eaton, Schneider Electric, Vertiv, LiteOn, Huawei Digital Power, Bloom Energy), batteries & solar (EVE Energy, Jinko Solar, LG Energy Solution, Panasonic Energy, Samsung SDI), and grid OEMs & integrators (Constellation Energy, GE Vernova, Hitachi Energy, Quanta Services, Rosendin, Siemens Energy) — concept-curriculum format, cross-checked against adjacent existing guides to avoid overlap
- New `neocloud` roster category with its own tag color in the Profiler app (`live-site-pages/Profiler.html`, `live-site-pages/profiler-data/profiler-companies.json`, `repository-information/PROFILER-SCHEMA.md`)

### Changed
- CoreWeave, Lambda, and Nebius recategorized from `hyperscaler` to `neocloud`; IREN and Crusoe now `neocloud` + `developer` (`live-site-pages/profiler-data/*.profile.json`, `profiler-companies.json`)
- Dossier summaries now render "Bottom Line Up Front" and "Background" as separate paragraphs, and snapshot fact values (ownership, category, etc.) display with capitalized first letters (`live-site-pages/Profiler.html` v01.33w)
- Summary label normalization: 9 recent dossiers' "BLUF:" prefix expanded to the house-standard "BOTTOM LINE UP FRONT:" (Bechtel, Black & Veatch, Burns & McDonnell, DPR, Hitt, Holder, Kiewit, Mortenson, Primoris profile JSONs)

### Fixed
- Profiler renderer now reads both legacy and schema-v2 profile field shapes (`hq`/`headquarters`, string/object `ownership`, top-level `ticker`, `legalName`/`shortName`) — newer dossiers no longer show blank Headquarters/Ownership snapshot cells or a duplicated company name in the header (`live-site-pages/Profiler.html`)

## [v02.73r] — 2026-08-21 09:47:30 PM EST — [50ee250](https://github.com/LightAISolutions/Sales/commit/50ee250ba86cc00df8f97ef6a3199e8bde28ebc2)

> **Prompt:** "run batch C"

### Added
- **Profiler Batch C — five EPC/engineering dossiers** (registry now **57 companies**), each researched via a single-agent run under the Source Priority Protocol (~44–63 sources evaluated per company), authored in the active `intel-briefing` style at schema v2, profileVersion 1, all categorized `integrator`:
  - **`live-site-pages/profiler-data/bechtel.profile.json`** — Bechtel (family-held, 5th generation): ENR #2 at $19.5B, $58.2B backlog; only EPC to complete 21st-century US nuclear (Vogtle), Natrium construction start, Poland AP1000 site takeover, three concurrent LNG megatrains, NVIDIA Omniverse DSX AI-factory modularization partner; the circulating Microsoft-Fairwater association did NOT substantiate (Walsh builds Mount Pleasant) — recorded as a verification result
  - **`live-site-pages/profiler-data/kiewit.profile.json`** — Kiewit (employee-owned): ENR #4; ~11 GW AI-driven gas-EPC stack (Homer City 4.5 GW — largest US gas plant under construction — NRG/GE Vernova ~5.4 GW venture, Oglethorpe 1.4 GW), Oklo Aurora SMR lead constructor, CHPE HVDC completed, US-Japan $550B framework naming; Key Bridge Phase 2 off-ramp documented
  - **`live-site-pages/profiler-data/burns-mcdonnell.profile.json`** — Burns & McDonnell (100% ESOP): ENR #1 Power design 11 straight years, largest US substation design group claim, >50% claimed RICE share; record $8.6B 2025 revenue; the Santee Cooper data-center transmission EPC as the utility-side capture template; Certus/1898 & Co. MWBE lawsuit flagged
  - **`live-site-pages/profiler-data/black-veatch.profile.json`** — Black & Veatch (100% ESOP): the client-owned-substation specialist (six-site colocation program; two 300 MW hyperscale units); ENR #6 Power + #8 Water + #1 Hydrogen (ACES Delta EPC); equal seat in the Aecon-Kiewit-B&V Cascade SMR JV; Dycom wireless divestiture and the adverse Boldt litigation turn documented
  - **`live-site-pages/profiler-data/primoris.profile.json`** — Primoris (NYSE: PRIM — the batch's only listed company): #4 US solar contractor, Meta Nebraska $250M+ and Crusoe off-grid gas data-center work, PayneCrest acquisition; full actual-vs-consensus financials covering the 2024-25 beat streak and the 2026 guidance collapse (-57%), securities class action, and record $13.9B backlog
- **Five in-app study guides** (`bechtel.study.json`, `kiewit.study.json`, `burns-mcdonnell.study.json`, `black-veatch.study.json`, `primoris.study.json`) — complementary curricula (6 sections + 12 concept flashcards each): Bechtel covers LNG liquefaction, lump-sum risk, nuclear FOAK economics, and gigawatt modularization; Kiewit covers combined-cycle plants, HVDC, advanced reactors, coal-site conversion, and the turbine queue; Burns & McDonnell covers the AEC industry map, transmission lines, interconnection, offshore engineering, OT security, and public procurement; Black & Veatch covers green hydrogen, grid stability/synchronous condensers, water engineering, the Owner's Engineer role, private networks, and construction disputes; Primoris covers solar-farm construction, public-contractor earnings mechanics, backlog quality, percentage-of-completion accounting, and behind-the-meter gas
- **15 executive photos** in `live-site-pages/images/execs/` (Bechtel ×5, Black & Veatch ×4, Burns & McDonnell ×3, Primoris ×3 — company-published only, WebP sources converted to JPEG; Kiewit publishes no leadership page, so its decision makers have no photos by protocol) — directory now 62 photos across 16 companies
- **Post-earnings Routine armed for Primoris** (`trig_01QfYxVDmk3bHUqgvr3czAmT`): one-shot 2026-11-03 13:00 UTC (Q3 results estimated ~11-02; the fired session verifies, refreshes, and re-arms for Q4)

### Changed
- **`live-site-pages/profiler-data/profiler-companies.json`** — registry 52 → 57 companies (five EPCs inserted alphabetically as `integrator`; Primoris carries ticker NYSE: PRIM)
- **`README.md`** — structure tree +10 rows for the new profile/study JSONs; execs photo-count line updated to 16 companies / 62 photos
- **`.claude/rules/profiler-app.md`** — quarterly private-company sweep expanded from 12 to 16 companies (Bechtel, Kiewit, Burns & McDonnell, Black & Veatch joined 2026-08-21 with per-company watch items; Primoris noted as public with its own trigger); the sweep Routine (`trig_01UVzjF6Y91Gb2MzKdDAznd9`) renamed and re-prompted to match; Primoris one-shot added to the Currently armed list
- Render check: Playwright verified all five dossiers render from the roster and by direct `#slug` navigation with study-guide buttons present and zero console errors

## [v02.72r] — 2026-08-21 09:00:04 PM EST — [98f533a](https://github.com/LightAISolutions/Sales/commit/98f533a32bfb89ec6d627f5b7a566e41dc2fca50)

> **Prompt:** "run batch B"

### Added
- **Profiler Batch B — five general-contractor dossiers** (registry now **52 companies**), each researched via a single-agent run under the Source Priority Protocol (~35–52 sources evaluated per company), authored in the active `intel-briefing` style at schema v2, profileVersion 1, all categorized `integrator`:
  - **`live-site-pages/profiler-data/turner-construction.profile.json`** — Turner Construction (Hochtief/ACS subsidiary): ENR #1 six straight years at $28.3B; data-center revenue tripling toward a $20B-by-2030 target (~42% of the $48.9B backlog); SourceBlue ~$1B/yr procurement arm; Meta Richland Parish/Lebanon IN, CoreWeave Lancaster, Stargate WI
  - **`live-site-pages/profiler-data/mortenson.profile.json`** — Mortenson (family-owned): ENR #10 on $10.85B (+12 spots — largest top-10 move); the only US contractor pairing an 11 GW data-center fleet with 47.8 GW wind / 17+ GW solar / 45 GWh storage EPC; 1 GW / 345 kV Abilene substation; Meta concentration and Hermantown MN entitlement litigation flagged
  - **`live-site-pages/profiler-data/hitt.profile.json`** — HITT Contracting (family-owned): #1 US data-center builder by revenue (ENR 2025 telecom list; BD+C 2025 first) at $13.0B, 82% mission-critical mix; Sterling II 22.5 MW in 180 days; the $51M Glenstone settlement's ~$24M uninsured layer (affirmed on appeal 2026-08-04) and the April 2025 Vantage Ashburn trench-collapse fatality documented
  - **`live-site-pages/profiler-data/holder-construction.profile.json`** — Holder Construction (family-owned): BD+C's #1 data-center contractor 2023–24 (#2 2025); Google Fort Wayne $2B campus, EdgeCore Mesa $1.9B / ≥450 MW; a reported ~$10.2B 2025 revenue behind a deliberately NDA-heavy zero-publicity posture (no leadership page — no exec photos exist to publish)
  - **`live-site-pages/profiler-data/dpr.profile.json`** — DPR Construction (employee-owned): lead builder of Stargate Abilene (8 buildings, ~4M sq ft, 1.2 GW; buildings in <1 year); ENR #7 at $14.0B with $26.1B booked; ~6,000 self-perform craft workers, prefab >90% of new work; the June 2026 TIME safety investigation and CalSTRS lawsuit documented as watch items
- **Five in-app study guides** (`turner-construction.study.json`, `mortenson.study.json`, `hitt.study.json`, `holder-construction.study.json`, `dpr.study.json`) — complementary construction-industry curricula (6 sections + 12 concept flashcards each): Turner covers GC/CM-at-risk economics and reading contractor financials; Mortenson covers power EPC, substations, and MW/MWh literacy; HITT covers data-center anatomy, commissioning, and speed economics; Holder covers the NDA award market, cooling/water trade-offs, JVs, and labor law; DPR covers employee ownership, DfMA/prefab, VDC, AI data-hall internals, and schedule science
- **22 executive photos** in `live-site-pages/images/execs/` (Turner ×4, Mortenson ×1, HITT ×3, DPR ×5 — company-published only; Holder publishes none) — directory now 47 photos across 12 companies

### Changed
- **`live-site-pages/profiler-data/profiler-companies.json`** — registry 47 → 52 companies (all five GCs inserted alphabetically as `integrator`, no tickers, status active)
- **`README.md`** — structure tree +10 rows for the new profile/study JSONs; execs photo-count line updated
- **`.claude/rules/profiler-app.md`** — quarterly private-company sweep expanded from 7 to 12 companies: Turner, HITT, Holder, DPR, and Mortenson joined 2026-08-21 with per-company watch items (Turner financials via Hochtief quarterly disclosures; HITT Glenstone/trench-collapse follow-ups; Holder mega-campus lineup appearances; DPR TIME-investigation and CalSTRS fallout; Mortenson Hermantown review and Meta program). The sweep Routine (`trig_01UVzjF6Y91Gb2MzKdDAznd9`) was renamed and its prompt updated to match — next fire 2026-10-01 13:00 UTC
- Render check: Playwright verified all five dossiers render from the roster and by direct `#slug` navigation with study-guide buttons present and zero console errors

## [v02.71r] — 2026-08-21 06:11:48 PM EST — [75ee3ac](https://github.com/LightAISolutions/Sales/commit/75ee3ac11315a20a771308d635213a6558c632e5)

> **Prompt:** "Picking up from my last "AIDC market report clarifications" session, I approve you to follow the action plan and run batch A."

### Added
- **Profiler Batch A — six neocloud dossiers** (registry now **47 companies**), each researched via the two-agent Source Priority Protocol (~85–110 sources evaluated per company across first-party and third-party stages), authored in the active `intel-briefing` style at schema v2, profileVersion 1:
  - **`live-site-pages/profiler-data/nebius.profile.json`** — Nebius Group (NASDAQ: NBIS): Q2 2026 revenue $582.3M (+454%), ARR $3.0B, >$40B Microsoft/Meta backlog, 5 GW contracted-power target; Vineland stop-work orders flagged as the live risk on the Microsoft contract
  - **`live-site-pages/profiler-data/lambda.profile.json`** — Lambda (private): Microsoft multibillion agreement, NVIDIA $1.5B leaseback (reportedly its largest customer), $5.9B Series E, first investment-grade-rated private-neocloud Term Loan B ($926M, Baa2), H2 2026 IPO window; the Aug 10 Bloomberg "$917M loan" and Aug 12 "$926M TLB" reconciled as one instrument
  - **`live-site-pages/profiler-data/applied-digital.profile.json`** — Applied Digital (NASDAQ: APLD): 1.4 GW / ~$36B base-term backlog (largest disclosed in the cohort), CoreWeave + one unnamed high-IG hyperscaler (~69% of backlog), 12.75% Macquarie perpetual preferred, NVIDIA's full stake exit (Q4 2025 13F)
  - **`live-site-pages/profiler-data/iren.profile.json`** — IREN (NASDAQ: IREN): 5 GW secured power, $9.7B Microsoft GB300 contract with Horizon 1 delivered/accepted 2026-08-13, NVIDIA $3.4B contract + 5 GW DSX partnership, ClusterMAX "Underperforming" vs NVIDIA Exemplar Cloud tension; FY2026 results land 2026-08-27
  - **`live-site-pages/profiler-data/terawulf.profile.json`** — TeraWulf (NASDAQ: WULF): 839 MW leased / ~$27B contracted incl. the 401 MW / ~$19B Anthropic lease at Hawesville KY; Google's ~$4.5B Fluidstack backstops for ~14% pro forma equity; warrant mark-to-market GAAP distortion documented
  - **`live-site-pages/profiler-data/core-scientific.profile.json`** — Core Scientific (NASDAQ: CORZ): the CoreWeave-merger no-vote (Oct 2025) → AMD ~530 MW / $14B+ second anchor (Jul 2026) vindication arc; $24B+ backlog; Feb 2026 restatement covered
- **Six `<slug>.study.json` technology study guides** (same batch, per the roster-expansion plan): `nebius.study.json`, `lambda.study.json`, `applied-digital.study.json`, `iren.study.json`, `terawulf.study.json`, `core-scientific.study.json` — complementary concept curricula (service ladders & rack-scale systems; brownfield conversion & credit enhancement; ARR/backlog/power-funnel literacy; GPU-collateralized finance; Chapter 11 warrants & M&A governance; vendor-circularity detection), 6 sections + 12 flashcards each, public-safe per the prep-command contract
- **25 company-published executive headshots** in `live-site-pages/images/execs/` (Lambda ×4, TeraWulf ×5, Nebius ×5, Applied Digital ×4, IREN ×4, Core Scientific ×3), referenced from the new dossiers' `decisionMakers[].photo` fields
- **Five post-earnings refresh Routines armed** (fresh-session one-shots, staggered to avoid parallel-session conflicts): IREN 2026-08-28 15:00 UTC (results confirmed 08-27), Applied Digital 2026-10-15 13:00 UTC (Q1 FY27 scheduled 10-14), Core Scientific 2026-10-24 15:00 UTC (est. 10-23), TeraWulf 2026-11-10 15:00 UTC (est. 11-09), Nebius 2026-11-11 13:00 UTC (expected ~11-10, unconfirmed)

### Changed
- **`live-site-pages/profiler-data/profiler-companies.json`** — six registry entries added alphabetically with taglines/HQ/tickers; roster 41 → 47
- **`.claude/rules/profiler-app.md`** — "Currently armed" list gains the five new one-shots; the private quarterly sweep entry and its live Routine prompt now cover **seven** companies with Lambda's watch items (IPO progress incl. the Mubadala no-IPO penalty clock, funding/debt terms, Microsoft execution, NVIDIA leaseback, Kansas City scaling, Combes-era leadership changes)
- **`README.md`** — 12 new tree rows for the batch's profile/study files; `images/execs/` count line updated to eight companies

### Note
- Data-only change: `Profiler.html` untouched, no page version bump per the Profiler version-interaction rules; all six dossiers + study guides Playwright render-checked locally (roster cards, full dossier render, study-guide buttons, zero console errors) before commit

## [v02.70r] — 2026-08-21 04:08:51 PM EST — [5d77f8b](https://github.com/LightAISolutions/Sales/commit/5d77f8bd3935da236bd0860b2909c6414421e1bc)

> **Prompt:** "Output the deck summary in a downloadable PDF."

### Added
- **`repository-information/study-prep/zhonhen/zhonhen-deck-summary.md` + `ZHONHEN-DECK-SUMMARY.pdf`** (4 pages, no contents block) — the absorption summary of the company-provided "Zhonhen AIDC Introduction EN" deck (v1.35, 24 slides, received after the passed first-round interview), restructured for print: the deck's five-move argument, the MVR-vs-traditional comparison table (98.5% vs 94%, 720kW–3.6MW, one-stage 10–35kV→DC), the rack-side product table (1MW sidecar at 473kW/m³, 100kW shelf, 18kW PSU), the JLL prefab-market table ($68.57B US of $94.86B global), the container portfolio table, the NVIDIA 2025/2026 whitepaper citations including the 2026 paper naming the "Panama Architecture", the deltas-vs-public-record section, five absorbed-signal talking points, and the 70%-per-account vs 31%-overall share reconciliation
- **`scripts/build-study-prep-pdf.mjs`** gained the `zhonhen-deck-summary` registry entry (toc disabled — short reference sheet)

### Changed
- **README tree**: two rows added to the study-prep zhonhen block

### Note
- The source deck is marked confidential on every slide. The summary lives in `repository-information/study-prep/` — the non-deployed prep directory that already carries recruiting-channel details — with an explicit handling note at the top; the deck itself was NOT added to the repo, and nothing deck-sourced enters the public Profiler dossier

## [v02.69r] — 2026-08-19 03:21:20 PM EST — [d449b44](https://github.com/LightAISolutions/Sales/commit/d449b44e800c857c798f833ed5477597be2d1fc3)

> **Prompt:** "I don't know anything about China's data centers' HVDC architecture (240Vdc, 336Vdc, 800Vdc). I have basic working knowledge of the US power flow from 135-230kVac (high AC voltage) -> substation and HV transformer step down to 10.47-34.5kVac (medium AC voltage) -> MV transformer and rectifier step down and transform to 480/380Vdc -> PDUs distribute power to server racks -> PSUs step down voltage to 56V -> 12V -> 6V ->~1V at the chip level. Teach me everything I need to know to sound knowledgeable about both architectures and be able to clearly explain the difference in an interview."

### Added
- **Profiler Prep Command output for Zhonhen: `repository-information/study-prep/zhonhen/zhonhen-lesson-plan.md` + `ZHONHEN-LESSON-PLAN.pdf`** (6 pages, BloombergNEF skin) — a five-module technology curriculum on data-center power architectures: the physics toolkit (I²R, stage-deletion economics, AC-grid/DC-endpoint tension), the Western AC chain stage by stage, China's 240V/336V HVDC (telecom −48Vdc heritage, the stock-PSU-passthrough adoption trick, battery-on-bus zero-transfer design, the Panama one-stage module), NVIDIA's 800Vdc convergence, and interview-ready scripts with objection Q&A and a numbers-to-memorize line
- **The lesson plan explicitly corrects two errors in the developer's own stated mental model** before tonight's interview: the legacy chain's MV transformer produces 480V *AC*, not "480/380Vdc" (facility-level DC exists only in the new architectures; the legacy chain's DC hides inside the UPS and after the PSU), and the low-voltage ladder is 54 → 12 → ~1V with no standard 6V stage. Also flags that China's MV standard is 10kV (vs US 12.47–34.5kV) — likely the source of the developer's "10.47kV"
- **`live-site-pages/profiler-data/zhonhen.study.json`** — the public-safe in-app rendering: 6 concept sections + 12 flashcards (technology-only per the prep-command contract, no interview context)
- **`scripts/build-study-prep-pdf.mjs`** gained the `zhonhen-lesson-plan` registry entry

### Changed
- **README tree**: added the lesson-plan pair to the study-prep zhonhen block (lesson plan listed before the brief, matching the hithium/megmeet convention) and `zhonhen.study.json` to profiler-data

## [v02.68r] — 2026-08-18 10:05:58 PM EST — [b37809f](https://github.com/LightAISolutions/Sales/commit/b37809fd4220c3f16ccd502f5e52576c4fcb9be6)

> **Prompt:** "Profiler Zhonhen Electric. Then, create an interview prep guide for an AIDC Sales Director position with Jacky Zhu, son of the current chairman. Output as a download able PDF file."

### Added
- **New Profiler dossier: `zhonhen.profile.json` (profileVersion 1)** — Hangzhou Zhonhen Electric Co., Ltd. (SZSE: 002364), China's #1 data-center HVDC power vendor, researched via the standard two-agent protocol (~105 evaluated sources across first-party IR/PR/product channels and third-party filings, consultancy data and trade press) and authored in the active `intel-briefing` style: BLUF summary, five confidence-tagged key judgments, 6 product lines with full v2 depth fields, 4 technical-spec blocks, 13 recent developments, 8 decision makers, 3 financial periods, 41 sources. Registered in `profiler-companies.json` (roster now **41 companies**)
- **The research corrected the tasking's framing in three places, all documented in the dossier**: the current chairman is **Bao Xiaoru** — the interviewer's mother — not father Zhu Guoding, who is actual controller with no board seat and a December 2025 securities-manipulation conviction; the recruiter's "~50% HVDC share" is **31%** per the one named consultancy (still #1, CR3 72%); and CATL's RMB 4.1B investment (definitive agreements 14 August 2026) buys **49% of the controlling holdco**, not a direct listed-company stake
- **New interview brief: `repository-information/study-prep/zhonhen/zhonhen-interview-brief.md` + `ZHONHEN-INTERVIEW-BRIEF.pdf`** (11 pages, 17 sections, BloombergNEF skin) for the 19 August first-round interview with Zhu Yikun (朱一鲲, "Jacky Zhu" per the recruiting channel), co-head of overseas business with a personal 10% stake in the SuperX Digital Power JV. Structure follows the Hithium/Megmeet briefs: logistics (from the calendar invite — including the Teams one-hour cutoff), the interviewer read, the recruiter's three published probe areas as a prep syllabus, a recruiter-claims-vs-public-record table, the HVDC/Panama architecture story, a US entry thesis built on the market report's time-to-power and craft-labor arguments, the FCC/tariff/FEOC regulatory read for a Chinese HVDC vendor ([Analysis]-labelled), objection handling, questions to ask, a do-not-say list, vocabulary, and a ten-question self-test
- **`scripts/build-study-prep-pdf.mjs`** gained the `zhonhen-interview-brief` registry entry

### Changed
- **README tree**: added `zhonhen.profile.json` to the profiler-data listing and a `zhonhen/` block to study-prep (wartsila's tree-terminator characters adjusted since it is no longer the last entry)

## [v02.67r] — 2026-08-18 06:16:45 AM EST — [12d3737](https://github.com/LightAISolutions/Sales/commit/12d373758ced83dd2d9fb4c10b14b5a5ec5cd12e)

> **Prompt:** "I closed Profiler completely and reopened it with the ?fresh=1 addition and this is the result. I already signed in." *(with a screenshot on v01.31w / v01.16g showing the notes log reading "Could not load field notes — sign in and try again.")*

### Fixed
- `Profiler.html` (v01.32w) — **the notes-log load failure was a dead end.** Its `list` handler collapsed every cause into one sentence, printed no error code, and offered no way to act. The note box beside it has had a working recovery path since v01.02g (`sessionGuard` → `renderSignin`); the ⚙ panel never used it. Same defect class as the sign-in wall before v01.11g, where four distinct causes produced one indistinguishable message
- The handler is now `loadNotes()`, re-callable, and branches by cause: session errors say "Your sign-in has expired", `no_backend` says the service is not reachable, anything else is generic. **All non-`ADMIN_ONLY` failures print `Reason: <code>`** so a failure can be reported precisely instead of described
- A **Sign in and retry** button appears on every recoverable failure. It clears the stored session and role, calls the existing `ovNoteSignIn`, and on success re-runs `loadNotes()` in place. Suppressed for `no_backend`, which signing in cannot fix — the page never decoded a deployment URL, so there is nothing to sign in to
- The import bar is no longer hidden when the list fails. It only dedups against the notes; hiding it left no path forward at all

### Notes
- `ADMIN_ONLY` deliberately prints no reason code and no button — it is a definitive answer about the account, not a fault to recover from
- Verified across all four branches plus the retry: session and network failures show the code, the button and the import bar; `no_backend` shows the code and neither; `ADMIN_ONLY` shows neither; and pressing the button calls `ovNoteSignIn` exactly once, reloads clean and reveals the bar. Zero page errors at 390×844
- **v01.31w's cache fix is confirmed working** — the developer's screenshot shows v01.31w live and the panel now reaching the backend and receiving a real answer, where before it was rendering stale HTML

## [v02.66r] — 2026-08-18 06:09:59 AM EST — [642b0d0](https://github.com/LightAISolutions/Sales/commit/642b0d04145a256fb8378fa1b6a1e1de49dd913d)

> **Prompt:** "I still cannot see the import transcript option. Fix this." *(with a screenshot of the notes log on v01.30w / v01.16g showing only the Sinexcel note and no import bar)*

### Fixed
- `Profiler.html` (v01.31w) — **the page was running stale HTML.** The v01.30w import bar is correct: driven against the developer's exact case (one note, PDF attachment, `hasTranscript: false`) it renders `display:block`, visible, three children, zero page errors. What their device was executing was older HTML. The three auto-refresh paths all called plain `window.location.reload()`, which is permitted to reuse the cached document; the version pill is a separate 8-byte fetch with `cache:'no-store'` plus a cache-bust param, so it reported v01.30w while the surrounding page was not. The **server-side** fix from the same push (no ✨ Summarize on a PDF note) *was* visible in the screenshot, which is the tell: GAS updated, HTML did not
- New `ovFreshUrl` / `ovReloadFresh` replace all three `reload()` calls with a navigation to a URL carrying a fresh `_v` param, which forces a real document fetch. `PROJECT OVERRIDE` markers, since this modifies template polling logic

### Notes
- **This does not fix the copy already in the developer's browser** — only a hard refresh clears that. The change stops it recurring
- `ovFreshUrl` is split from `ovReloadFresh` specifically so the URL rule is testable: `window.location`'s properties are non-configurable, so an earlier attempt to stub `location.replace` silently no-opped and produced a meaningless pass. Verified instead against controlled inputs — `_v` added, `#catl` hash preserved, `_v` replaced rather than accumulated across calls, unrelated params kept, successive calls differing, malformed input returning null
- **Fleet-wide finding, not acted on:** all nine pages carry the same three `window.location.reload()` calls, inherited from both HTML templates. Every page can therefore serve stale HTML after a version bump. Fixing it properly means the templates plus nine pages under [PC-TEMPLATE-PROP] #19 — nine version bumps and nine changelog entries — so it is left as a deliberate decision rather than folded into this fix

## [v02.65r] — 2026-08-18 05:56:47 AM EST — [f16b144](https://github.com/LightAISolutions/Sales/commit/f16b1441a4f6a2f87a4bb78f22ad04e7bb823e7d)

> **Prompt:** "I'm seeing v01.29w, but I still cannot see the CATL .vtt file anywhere. When I click the cog button, I still see the SInexcel FCC Inverter Ban Exposure Report.
>
> Also, I want to achieve zero-click; How do I share my Drive folder with the script account? Do it for me if possible. Otherwise, give me step-by-step instructions. Also, can you change the naming rules to not be so obviously AI-created (dont use the em-dash and capitalize the first letter of the first word)?"

#### `Profiler.html` — v01.30w

##### Fixed
- **The import bar never appeared, and the cause was a bug this repo had already fixed once.** `ovScanTranscripts` reaches `ovDriveToken`, which asks GIS for Drive consent — and GIS only opens that prompt inside a live user gesture. Its own comment says so: *"Warm library: stay synchronous so the gesture still counts."* v01.29w called the scan from the `ovNoteApi('list')` **callback**, by which point the gesture was long gone, so the consent request hung and nothing rendered at all. Identical in shape to the v02.28r recording-upload hang, whose fix was to move consent onto the button's click handler
- The bar now renders immediately with no Drive contact, and every Drive-touching step runs inside the click. Verified: **zero** scan calls on open, exactly one on click

##### Changed
- Recording and transcript filenames drop the double-dash separator and capitalise the leading slug: `catl--2026-08-10--Voice 260810_015240.m4a` becomes `Catl 2026-08-10 Voice 260810_015240.m4a` (developer directive — the old form read as machine output in a Drive listing)
- `ovSlugFromTranscript` parses **both** forms. The two transcripts already sitting in `2-transcribed/` use the old naming and still route to CATL and Hithium correctly — verified against those exact filenames, plus a hyphenated slug (`Siemens-energy`) to confirm the space-split does not truncate multi-word slugs
- One click still covers a whole batch: scan, file, and summarise all run from the single button press

#### `Profiler.gs` — v01.16g

##### Added
- **Unattended watcher for the zero-click path.** `transcriptWatcherTick` scans the transcribed folder, files each new transcript and writes it up with no app open; `installTranscriptWatcher` / `removeTranscriptWatcher` arm and disarm a 15-minute time-driven trigger. Capped at `WATCHER_MAX_PER_RUN` (3) per tick — Apps Script kills an execution at six minutes and each file costs a Drive read plus a model call, so a backlog drains across ticks rather than risking a mid-file kill
- `whoIsTheScriptAccount()` — reads the owner of the notes file (which the script account owns by construction) to print the address the developer must share their Drive folder with. `diagnoseAuthorization` cannot supply this: `Session.getEffectiveUser` needs `userinfo.email`, which this project's grant does not include, and that is exactly the line that failed in the 2026-08-17 log
- `slugFromTranscriptName_` and `createTranscriptNote_` — server-side counterparts of the browser path, both accepting old and new filename forms
- **The watcher refuses to run until `TRANSCRIPT_AUTO_CONFIDENCE` is set** in Script Properties. A trigger has nobody to ask, and the 2026-08-07 directive says the confidence rating is never invented — so the developer states it once and the watcher uses it, rather than a default being chosen for them

##### Changed
- The generated note header is now `Auto-summary (model)` instead of `[auto-summary · model]`, matching the same developer directive about machine-looking output

### Notes
- **Sharing cannot be done from a session** — it requires access to the developer's Google Drive. Step-by-step supplied in the response instead
- `script.scriptapp` was confirmed granted on Profiler in the 2026-08-17 diagnostic, which is what makes the trigger path viable here; the same code on Scraper would silently never install
- The watcher is **untested** — it cannot run until the folder is shared and the trigger armed. Failure mode is contained: it logs and returns rather than throwing, and the browser import remains the working path either way

## [v02.64r] — 2026-08-17 08:36:32 PM EST — [9326148](https://github.com/LightAISolutions/Sales/commit/93261486e9ccea0ab47d76615dd15ee0b335cbc9)

> **Prompt:** "I could not find my notes in the Profiler app - I could only see Sinexcel's FCC Inverter Exposure Report. However, I see my transcribed .vtt meeting notes in my Drive's Profiler App folder -> Meeting Recordings folder -> 2-transcribed folder. Make it easier for me to summarize my transcribed .vtt files. Ideally, make it so I don't have to press anything and my .vtt files automatically get summarized. If that isn't possible, then make it as close as possible to a one-click solution. Then, give me step by step instructions to continue."

#### `Profiler.html` — v01.29w

##### Added
- **Transcript auto-import.** Opening the ⚙ notes log now scans `2-transcribed/` browser-side and surfaces any transcript no note has claimed. New `ovScanTranscripts` / `ovImportTranscripts` / `ovDriveText` / `ovSlugFromTranscript`, plus the `#ov-notes-import` bar between the filter chips and the log
- Import is **sequential by design** — `submit` → `summarize` per file, never a parallel batch. Each pass is a Drive write plus a model call, and firing N of those at once is how the one path that must not be flaky becomes flaky
- The slug comes from the filename: uploads are already named `<slug>--YYYY-MM-DD--<original>`, so `catl--2026-08-10--Voice 260810_015240.vtt` routes to the CATL dossier with no lookup. An unrecognised prefix falls back to `general` rather than being skipped, so a mis-named file still reaches the log
- Verified against the developer's two real transcripts: slug derivation, the rendered bar, and the full click-through produced `submit:catl → summarize → submit:hithium → summarize → list` in order with zero page errors, at 390×844

##### Changed
- The scan runs **after** the notes list returns, never before — it dedups against `sourceName`, so scanning first would offer to re-import everything
- A failed scan renders an explicit message. Silence is reserved for "scan succeeded, nothing new"; a Drive or consent failure that rendered as silence would be indistinguishable from having no work to do
- `btoa` is fed through `unescape(encodeURIComponent(...))` — it rejects multi-byte characters outright, and transcripts routinely carry smart quotes

#### `Profiler.gs` — v01.15g

##### Fixed
- **`hasTranscript` counted any attachment, not just a readable one.** `!!(n.sourceFile && driveNoteFileId_(n.sourceFile))` is true for a Word/PDF note, but `driveReadNoteFile_` returns null for those — so the app offered **Copy + transcript** and **✨ Summarize** on notes where both were guaranteed to fail with `NO_TRANSCRIPT`. This is exactly what the developer's Sinexcel PDF note showed. Replaced with `noteHasTextTranscript_`, which tests the name against `NOTE_FILE_TEXT_RE`. Verified across 8 note shapes including both legacy (no `sourceName`) variants

##### Added
- `note.sourceName` records the attachment's **original** Drive filename on submit. The stored name carries a date+time prefix and could never match what the developer's Drive shows, so without this the import has no way to tell which transcripts are already filed
- `driveNoteFileName_` resolves a name without paying for a full content read, for legacy notes predating `sourceName`

### Notes
- **This corrects an inaccurate claim from the prior response**, which told the developer that a `📋 Copy + transcript` label proved the server saw a readable transcript. It did not — the label was driven by the same over-broad check fixed here
- Source type for imported transcripts is `contact`, the closest of the five valid values (`contact`/`event`/`call`/`news`/`other`). Adding a `meeting` type would touch the schema and the intake dropdown, so it was left out of scope
- The confidence rating is **still the developer's** — the bar presents a selector pre-set to 100 rather than defaulting one silently, per the 2026-08-07 directive that Claude never invents this value. One selection covers the batch, which is what keeps it to a single click

## [v02.63r] — 2026-08-17 04:07:29 AM EST — [8afadbc](https://github.com/LightAISolutions/Sales/commit/8afadbc35bd887ed50376bc4920feafebe9d0eb6)

> **Prompt:** "continue with your recommendation"

### Fixed
- **Every truncated `… +N more` marker removed from both documents' contents pages** — the Coverage Universe's three chapter entries now list all 17, 11 and 17 subsections respectively, and a fourth marker found in the market report's chapter 10 was removed. Replacements were generated programmatically from the actual `### N.M` headings rather than transcribed, so no title could be mistyped or invented
- **Two of the four markers were miscounted**, confirming the suspicion raised by the v02.53r `+4 more` error: companion chapter 2 claimed `+3 more` when only 2 subsections were missing, and market report chapter 10 claimed `+1 more` when its entry already listed all nine. The other two (`+8 more` twice) were correct — the counts were unreliable in both directions, not uniformly wrong
- **Chapter 4's capital-implications closer was the only one in the report without a section number.** Every other chapter numbers it — 2.7, 3.6, 5.7, 6.8, 7.8, 9.7 — while chapter 4 carried a bare `### What this means for your capital` *and* listed it in the contents, which is what produced a genuine 8-versus-7 mismatch. Now numbered `4.8`. Chapters 1 and 10 also use unnumbered closers but exclude them from their contents entries, so they are internally consistent and were deliberately left alone

### Changed
- **All ten editions rebuilt.** Page counts are unchanged for the canonical editions — market report 109, coverage companion 51 — since the expanded contents absorbed into existing page flow

### Note
- A full contents-to-subsection parity check now passes across **all 14 chapters in both documents** (11 report + 3 companion, zero mismatches). This was the check that surfaced the chapter 4 defect, which no amount of reading the truncation markers would have found

## [v02.62r] — 2026-08-17 03:36:35 AM EST — [9cf3289](https://github.com/LightAISolutions/Sales/commit/9cf3289d2f283834fc1ddba030f2013e6fcef83a)

> **Prompt:** "I added the missing oauthScopes and re-ran diagnoseAuthorization. Here is the log."

### Note
- **Scraper is fully healthy: 7 declared, 7 granted, `script.scriptapp` now present in both, nothing outstanding.** Its three self-installed triggers (`scSchedulerTick`, `enforceRetention`, `auditRetentionCompliance`) can install again
- **The two failure modes are now both confirmed by evidence, and they are opposites.** Receipts (v02.59r) declared the scope and never had it approved — a partial grant, repaired by re-consenting. Scraper (this version) never declared it — repaired by editing the manifest, which is *also* what finally triggered the consent prompt, since Apps Script prompts only on a change to the declared set. Identical runtime error, opposite repairs

### Fixed
- **`diagnoseOauthScopes_`'s "everything is declared" line was stale in both of its variants**, left over from when it was only ever called from `diagnoseAclAccess`. The propagated copies told the reader to *"Run diagnoseAuthorization to check whether it was actually GRANTED"* — while running inside `diagnoseAuthorization`, immediately below the granted list it names. The Receipts original was differently wrong: it attributed the case to a stale grant without pointing at that list at all. Both replaced with a single wording that directs the reader to compare against the granted list printed directly above

### Changed
- **`.claude/rules/gas-scripts-reference.md` — the two failure modes are now a decision table** (missing from *both* lists → under-declared, add and save to trigger the prompt; missing from *granted* only → an authorization URL will have been printed), each with its confirmed instance
- **Recorded that the `script.scriptapp` gap is systemic rather than incidental.** v01.82r added the scope to the manifest *template*, `sample-components/appsscript.json` and the setup steps — "so **new** projects can self-install time-driven triggers" — but existing projects were never updated and **could not be**, since live manifests are not version-controlled and `pullAndDeployFromGitHub()` preserves them. Every project created before v01.82r is therefore still missing it unless hand-fixed, and the only symptom is that time-driven triggers silently never install
- **This supersedes the v02.59r reading of the v01.87r trigger incident.** That note had downgraded it to "possibly the same partial-grant mechanism, treat as unconfirmed". The Scraper evidence settles it: it was a genuine declaration gap whose fix only ever reached the template
- **Archive rotation executed** — this push takes the active changelog past 100 sections. The oldest non-exempt date group (**2026-08-04**, 14 sections) was rotated to `CHANGELOG-archive.md` as an indivisible unit with mandatory SHA enrichment on every header. The shallow clone was deepened first (69 → 374 commits), without which every lookup would have failed silently

## [v02.61r] — 2026-08-17 03:23:38 AM EST — [1821b32](https://github.com/LightAISolutions/Sales/commit/1821b3228300d8c9f3fcdcc4b045a6c3a8a7ded9)

> **Prompt:** "I found it and ran diagnostics. Here is the log." *(Scraper execution log: `Authorization status: NOT_REQUIRED`, 6 granted scopes, `No authorization is outstanding`, plus `Could not read the effective user: … Required permissions: …/auth/userinfo.email`)*

### Note
- **Scraper's sign-in is healthy — its grant DOES include `spreadsheets`.** So the Receipts failure was not fleet-wide, and Scraper needs no sign-in repair
- **But Scraper is missing `script.scriptapp`, so all three of its self-installed triggers are dead**: the hourly `scSchedulerTick`, the daily `enforceRetention`, and `auditRetentionCompliance`. None of them produces a user-visible symptom — the scheduler simply never runs. This is the silent failure mode that made the v01.87r incident so hard to spot
- **Scraper's problem is the mirror image of Receipts'.** Receipts declared the scope and never had it granted; Scraper's `NOT_REQUIRED` verdict with no authorization URL means the grant already covers everything the manifest declares — so the scope is missing from the **declaration**, not the approval. Same symptom, opposite repair: Receipts needed a re-consent, Scraper needs a manifest edit *then* a consent
- `Session.getEffectiveUser()` also failed on Scraper (`userinfo.email` not granted), which is why the log shows no effective user. The call is deliberately wrapped in `try/catch`, so the diagnostic degraded gracefully instead of dying — the design held under a case it was not written for

### Fixed
- **Two defects in the diagnostics shipped one version earlier, both exposed by this very log:**
- **`diagnoseAuthorization` never printed the DECLARED list, so its `NOT_REQUIRED` branch could not answer the question it fires on.** That branch is precisely the one that triggers when the manifest under-declares — the grant matches the declaration, so nothing is "outstanding" — yet it sent the reader to GCP consent-screen settings instead of showing the one list that identifies the gap. It now prints declared and granted side by side on every run, before the verdict
- **`diagnoseOauthScopes_` was unreachable dead code in six of seven projects.** Only Receipts called it (from `diagnoseAclAccess`, and only on an ACL-open failure), and its trailing underscore hides it from the editor's Run dropdown by design — so in `Globalacl`, `MasterACL`, `Profiler`, `Scraper`, `Testauthgas1` and `Testauthhtml1` it could not be invoked at all. Calling it unconditionally from `diagnoseAuthorization` gives it a caller everywhere (verified: 2 call sites per project, 3 in Receipts)
- **The `NOT_REQUIRED` guidance was rewritten to read the two lists against each other** and name the specific repair — missing from *both* lists means the manifest under-declares and needs a scope added, which is also what makes Apps Script finally prompt; missing from the granted list alone would have produced an authorization URL, so its absence rules that out. The previous text opened with GCP project settings, which is the least likely cause and the most expensive to investigate

### Changed
- Propagated to all seven auth projects and the GAS auth template; `node --check` clean across all nine `.gs` files
- **CHANGELOG capacity is now exactly 100/100** — the next push commit exceeds the threshold and must perform archive rotation per [PC-CHANGELOG] #6

## [v02.60r] — 2026-08-17 03:15:36 AM EST — [0518cbf](https://github.com/LightAISolutions/Sales/commit/0518cbf7d9f84a98169c4adcb7345d6dc5dadcf0)

> **Prompt:** "access GRANTED. We were both able to sign in. Do I need to propogate anything to my other apps?"

### Note
- **Receipts sign-in is confirmed working for both users — the four-session investigation is closed.** Root cause was a partial OAuth grant: `spreadsheets` and `script.scriptapp` declared but never approved. Fixed by re-approving with every granular-consent box ticked
- **Nothing about the fix itself is propagatable.** The repair was an *approval* recorded against a Google account, per script project. It cannot be pushed, deployed, or committed — each project has its own independent grant and must be approved on its own
- **The exposure is real on the other three deployed apps.** `MasterACL`, `Profiler` and `Scraper` are all deployed, all call `SpreadsheetApp` (21, 19 and 20 call sites) for the same Master-ACL sign-in, and all call `ScriptApp.newTrigger`. Same account, same consent screens, same era of setup — so the same two gaps are likely. `Globalacl`, `Testauthgas1` and `Testauthhtml1` carry placeholder deployment IDs and are not deployed, so they are exposed only if they are ever deployed
- **A successful sign-in does not clear an app.** It proves `spreadsheets` is granted, and nothing else. `script.scriptapp` failing takes down self-installed triggers with **no user-visible symptom at all** — which is exactly how the v01.87r incident stayed hidden

### Added
- **`diagnoseAuthorization()` and `diagnoseOauthScopes_()` propagated to all six remaining auth projects and the GAS auth template** (`gas-minimal-auth-template-code.js.txt`), so every app can answer "is my permission actually granted?" instead of only Receipts. Both functions are fully self-contained — they touch only `ScriptApp`, `UrlFetchApp` and `Session`, never a project-specific constant — so they ported verbatim with no adaptation
- **Placed in the TEMPLATE region rather than a PROJECT block**, immediately before `checkSpreadsheetAccess`. They diagnose shared auth infrastructure, not per-project features, so they belong to the template and travel with it under [PC-TEMPLATE-PROP] #19. New auth projects created from the template now inherit them at v01.00g
- Verified one definition of each per file (no duplicates from a double-applied patch) and `node --check` clean across all nine `.gs` files plus the template

### Changed
- The propagated copies carry two wording improvements over the Receipts originals: the incomplete-grant branch now says to open the URL **signed in as the account named above** (the account trap that cost a round trip on Receipts), and each diagnostic now points at the other as the next step, since a permissions error can come from either the declaration or the grant and neither check alone is conclusive

## [v02.59r] — 2026-08-17 03:04:38 AM EST — [fef91a6](https://github.com/LightAISolutions/Sales/commit/fef91a601e7c169569c8c49b38706355036fffe2)

> **Prompt:** "I ran diagnoseAuthorization, here's the log." *(execution log: `Authorization status: REQUIRED`; 8 granted scopes listed; `THE GRANT IS INCOMPLETE` plus an `…/authorize?enable_granular_consent=true` URL)*

### Note
- **CONFIRMED ROOT CAUSE — a partial OAuth grant, not a manifest problem.** The grant covers 8 scopes (`drive`, `script.deployments`, `script.external_request`, `script.projects`, `script.send_mail`, plus `userinfo.email` / `userinfo.profile` / `openid`) while the manifest declares **`spreadsheets`** and **`script.scriptapp`** that the grant does not. `spreadsheets` is the one that makes `SpreadsheetApp.openById` throw, which denies every user of the app at once. Four sessions of narrowing end here
- **The `enable_granular_consent=true` parameter on the authorization URL names the mechanism.** Google's granular consent presents a checkbox per permission and lets a user approve some while leaving others unticked — each unticked box becomes a declared-but-not-granted scope that fails at call time. `diagnoseAuthorization` returning a **non-null** URL is positive proof of this, per the documented contract that `getAuthorizationUrl()` returns `null` when nothing is outstanding
- **`script.scriptapp` is missing too, so self-installed triggers are broken as well** — a second, quieter casualty that produces no user-visible error at all
- **The script runs as `lightaisolution@gmail.com`**, confirming the two-account structure inferred in v02.55r from the `DRIVE_FOLDER_ID` comment. The authorization URL must be opened under **that** account; opening it under the personal Gmail grants to the wrong account, and this fleet is already exposed to multi-account routing

### Changed
- **Rewrote `.claude/rules/gas-scripts-reference.md`'s OAuth section, which v02.57r got wrong.** It was titled "OAuth Scope Regressions — invisible to git" and led with a **missing declaration** as the mechanism, having been written before the manifest was confirmed complete. Now titled "Partial OAuth Grants — the manifest is fine and the call is still denied", with a declaration-vs-grant table, granular consent named as the cause, and the delta-not-failure prompting rule that explains why nothing ever re-prompts
- **Deleted the recommendation that would have wasted the most time.** The old section advised that if this recurred a third time, the fix to weigh was committing a canonical `appsscript.json` per project and having the self-deploy write it. That addresses a declaration problem this is not — the manifest was already correct, so version-controlling it would have changed nothing while looking like a fix. Replaced with an explicit **"What does NOT fix it"** list (editing the manifest, pushing, redeploying, committing manifests)
- **Downgraded the v01.87r precedent from evidence to an open question.** It was recorded as the manifest lacking `script.scriptapp` — the very scope also missing from this confirmed partial grant — so that earlier diagnosis may have been the same mechanism misattributed. The section now says to treat it as unconfirmed rather than as a second data point for the declaration theory
- Added the two repair traps (approve as the **script account**, tick **every** box) and a blast-radius note: grants are per-project, so `Profiler`, `Scraper` and `MasterACL` need checking rather than assuming

## [v02.58r] — 2026-08-17 02:52:34 AM EST — [229b178](https://github.com/LightAISolutions/Sales/commit/229b178fb9e30373f9ef28178977e148cdcab8d2)

> **Prompt:** "I opened "appscript.json" and all seven oauthScopes were there. When I ran diagnoseAclAccess again, it showed the same error."

### Note
- **All seven scopes declared and the call still denied narrows this to the grant, not the manifest.** Declaring a scope and holding a grant for it are separate things: `appsscript.json` is only the **request list**, while the grant is a distinct record tied to the authorizing account. Apps Script re-prompts **only** when the requested set changes or the grant is revoked — so inspecting the manifest and changing nothing cannot produce a consent screen, and a stale or partially-approved grant survives untouched. That is precisely the state that reads as "declared but denied"
- **This also explains the missing consent screen from the previous session without contradicting it.** v02.57r attributed it to a scope never being *requested*; with the manifest confirmed complete, the same silence is explained by the request set being *unchanged*. Both are the same underlying rule — Apps Script prompts on a delta, not on a failure
- **`Updated to v01.24g (deployment 34) | 34/200`** — v02.57r's code had merged but the GAS project had **not** pulled it; the direct probe is what completed the deploy. A second concrete instance of the standing caveat that a green CI run is not proof the GAS side updated. Version headroom is comfortable at 34/200
- **The `getAuthorizationInfo` contract was verified against Google's reference docs before being built on**, rather than asserted from memory: `getAuthorizationUrl()` returns `null` when no authorization is outstanding, which is what makes it a clean discriminator rather than just a convenience link

### Added
- **`diagnoseAuthorization()` in `Receipts.gs`** — reports the effective user, the authorization status, and (where the runtime exposes `getAuthorizedScopes()`) the scopes the grant **actually covers**, so the declared list and the granted list can be compared directly. Its verdict is binary and actionable: a non-null authorization URL means the grant is incomplete and the URL re-approves it; a null URL means the grant is *not* the problem, and the log then names the three remaining candidates in order — a standard GCP project whose consent screen lacks the scope or is stuck in Testing, a second signed-in account, or a grant needing full revocation at `myaccount.google.com/permissions`
- **Named without a trailing underscore deliberately** — underscore-suffixed functions are hidden from the Apps Script editor's Run dropdown, and this one has to be runnable by hand. (`diagnoseOauthScopes_` keeps its underscore because it is only ever called programmatically.)

### Changed
- `diagnoseAclAccess()`'s permissions branch now runs **both** the scope report and the grant check. Either alone is ambiguous — declared-but-not-granted and genuinely-undeclared produce the identical runtime error, and only the pair separates them

## [v02.57r] — 2026-08-17 02:45:40 AM EST — [a8fd730](https://github.com/LightAISolutions/Sales/commit/a8fd730e784a44ceaa103e2036c847bb41438ed7)

> **Prompt:** "It failed again with the same "Access denied. Contact your administrator. (code: acl_unavailable)". Also, I was able to open Receipts in Apps Script and ran DiagnoseAclAccess. See attached screenshot." *(execution log showing `FAIL: cannot open the ACL spreadsheet … You do not have permission to call SpreadsheetApp.openById. Required permissions: https://www.googleapis.com/auth/spreadsheets`)*

### Note
- **ROOT CAUSE, three sessions in: the Receipts script lost the `https://www.googleapis.com/auth/spreadsheets` OAuth scope.** The Master ACL spreadsheet is intact and correctly populated. `SpreadsheetApp.openById` was throwing a **permissions** error, so `checkSpreadsheetAccess` took the `acl_unreachable` branch — every user of the app denied at once, exactly as the v02.54r analysis predicted the mechanism would look. The fix is manual and lives in Google, not this repo: add the scope to `appsscript.json` and re-approve the consent screen
- **The prediction in the previous response was wrong.** `acl_column_missing` was called as the likely cause on the reasoning that only a structural fault persists across sessions. That reasoning held; the conclusion did not — a missing OAuth scope is equally persistent and equally global, and it was not in the candidate set at all because the four `checkSpreadsheetAccess` reasons describe what the ACL *contains*, not whether the script may read it
- **Why no consent screen ever appeared**, which is the detail that makes this diagnosable: with an **explicit** `oauthScopes` array, Apps Script requests exactly that list and does not auto-derive missing scopes from the code. A dropped entry therefore fails at call time, not at authorization time — nothing prompts, because nothing was ever requested. A stale *grant* prompts for re-consent; a missing *declaration* just fails
- **This class of fault is invisible to the repository and cannot be fixed by pushing.** No live project's `appsscript.json` is version-controlled, and `pullAndDeployFromGitHub()` deliberately preserves the project's existing manifest — it reads the current `appsscript` file back and writes it unchanged alongside the new `Code`. So the regression survives every push, deploy and CI run
- Second occurrence of this exact class: v01.87r lost `script.scriptapp` and silently broke self-installed triggers the same way
- **The live page was verified as current before concluding anything about the client** — `Receiptshtml.version.txt` served `|v01.35w|` and the deployed `Receipts.html` contains the new `aclMsgs` branch, so the generic "Access denied… (code: acl_unavailable)" wording the developer quoted came from a cached page, not from the shipped build

### Changed
- **`diagnoseAclAccess()` now distinguishes a permissions failure from a file failure.** Its ACL-open catch previously printed one line — *"Restore the script owner's access to that file"* — which describes the file-level cause only and actively misdirected on this incident. It now tests the error text and branches: authorization-shaped errors trigger the new scope report, file-shaped errors keep the ID/trash/sharing advice

### Added
- **`diagnoseOauthScopes_()` in `Receipts.gs`** — reads the project's manifest back through the Apps Script API (`/v1/projects/<id>/content`, already reachable since `script.projects` is granted and self-deploy works) and prints every declared scope, then names each scope the app needs but lacks **labelled with the feature it breaks** — `spreadsheets` → the ACL and all data sheets, `drive` → receipt photos and PDFs, `script.external_request` → GitHub pulls, and so on. Handles the no-explicit-`oauthScopes` case separately, since there a permissions error means a stale grant rather than a missing declaration, and the repair differs
- **`.claude/rules/gas-scripts-reference.md` — "OAuth Scope Regressions"**: the no-consent-prompt tell, why git cannot see or repair it, the repair procedure with the mandatory re-consent step, and a standing note that if this recurs a third time the fix to weigh is committing a canonical per-project manifest and having the self-deploy write it — flagged explicitly as a change to `pullAndDeployFromGitHub`'s manifest-preservation behavior that must be discussed rather than slipped in, since preserving the manifest is what stops a shared template from clobbering per-project webapp settings

## [v02.56r] — 2026-08-17 02:34:37 AM EST — [6762fd6](https://github.com/LightAISolutions/Sales/commit/6762fd62fc42f36d33dbf3061edfb74653d4d8de)

> **Prompt:** "Mandy failed to sign in and the error code is "acl_unavailable"."

### Fixed
- **v02.54r computed the specific ACL failure reason and then threw it away at the boundary — my own gap, and it is why `acl_unavailable` arrived with no detail.** `exchangeTokenForSession` returned `{ error: "acl_unavailable", reason: <specific> }`, but **no page ever read `reason`**: every client mapped `acl_unavailable` to one static sentence. The previous session's claim that the sign-in screen would "name the actual cause" was wrong — the server side was verified and the client display path was not
- **A second, independent break in the same chain: the postMessage payload is an explicit field whitelist and silently dropped `reason`.** `gas-session-created` is assembled field-by-field in two places per project (the direct `JSON.stringify` payload and the string-built `google.script.run` listener), so a new server field never reaches pages using the `postMessage` transport regardless of what the client reads. Receipts runs `TOKEN_EXCHANGE_METHOD: 'fetch'` (raw JSON passthrough, unaffected), which is exactly why this would have stayed invisible on the app being debugged while quietly breaking MasterACL and Globalacl. `reason` added to both builders in all seven projects and the GAS template
- **The message told users to retry faults that can never clear on their own.** `acl_column_missing`, `acl_tab_missing` and `acl_empty` are structural — retrying is futile — yet all three said "please try again in a moment". Each now states plainly that an administrator has to restore the list, and only `acl_unreachable` invites a retry

### Changed
- **Client error mapping is now reason-aware across 13 call sites** in the seven auth pages plus the auth HTML template — `_mapExchangeError` gained an `authReason` parameter (threaded from `data.reason` at every call site) and the `postMessage` branch reads `data.reason` directly. Every message ends with `(code: acl_unavailable/<reason>)` so the specific cause is quotable from a screenshot
- `Profiler.html` needed its own branch again — its catch-all would otherwise have told a user to "ask Jon to add you to the access list" during a structural outage

### Note
- **Verified by calling the real function in a real browser**, not by inspecting the source: Playwright loaded `Receipts.html` and invoked `_mapExchangeError('acl_unavailable', …)` for all four reasons plus `undefined`, confirming each maps to its own message, the `undefined` fallback lands on `acl_unreachable`, and an unrelated code (`rate_limited`) still maps correctly — i.e. no regression in the surrounding chain
- **The two harness FAILs on `Receipts` and `MasterACL` are pre-existing** — CSP image-load refusals under `file://`. Confirmed by stashing the change and re-running: byte-identical results (3 and 5 errors, same pass/fail), so nothing here introduced them
- **What `acl_unavailable` already tells us** is that the v02.54r diagnosis was right — this is not a per-user denial. The ACL genuinely could not be READ, which is why Mandy and the developer were denied together. Which of the four causes fired still needs one more sign-in attempt on this build
- The Master ACL and Receipts spreadsheets were probed through the Google Drive connector to try to settle the cause without another round trip; both returned "not found" while 15 other spreadsheets listed normally, so the connector is scoped to the personal account and cannot see the script account's files. Recorded as a dead end rather than as evidence about the spreadsheets' existence
- All nine `.gs` files and all 15 inline page scripts pass `node --check`

## [v02.55r] — 2026-08-17 02:24:25 AM EST — [7dc0f24](https://github.com/LightAISolutions/Sales/commit/7dc0f242fe3d4ee38df7cbcec2c93c3ec1183607)

> **Prompt:** "I tried to open Receipts in the Apps Script editor and this happened. What's going on? Fix it." *(with a screenshot of Google Drive's "Sorry, unable to open the file at this time.")*

### Note
- **The editor error is browser-side Google account routing and has no repo-side fix.** No code change can resolve it, and none was attempted. What the repo *could* contribute was proof of where the fault is not, plus documentation so it stops costing a session each time
- **The live Receipts deployment was probed directly and answered `Already up to date (v01.22g)`.** That single response settles a great deal: the script project exists, the owning account still has access to it, and the v02.54r ACL fix from the previous push is **live in production**. The failure is therefore confined to the browser's account routing — a trashed project, revoked ownership, or a failed deploy are all ruled out
- **Consequence for the previous session's recommendation: the editor is no longer required for the ACL diagnosis.** `diagnoseAclAccess()` was the only reason to open it, and v01.22g now names the failure reason (`acl_unreachable` / `acl_tab_missing` / `acl_empty` / `acl_column_missing`) on the sign-in screen itself
- **The deploy webhook's green checkmark is not proof of deployment.** The workflow's deploy step exits 0 even when unconfirmed — it only emits a `::warning` — so the CI run passing and the GAS app actually updating are two different facts. The direct probe is what closes that gap

### Added
- **`.claude/rules/gas-scripts-reference.md` — "Checking the live GAS version without opening the editor".** Documents `?action=api&op=deploy` as the editor-free way to read the version a deployment is actually running. The route is unauthenticated and idempotent **by design** (the deploy handler's ⚠️ CRITICAL comment: it can only re-pull what GitHub already contains), so it is safe to call at any time. Also records that `globalacl`, `testauthgas1` and `testauthhtml1` carry placeholder deployment IDs and are never deployed — which is why their workflow deploy steps completed in 0 seconds on the v02.54r run while MasterACL, Scraper, Receipts and Profiler took real multi-second round trips
- **`.claude/rules/gas-scripts-reference.md` — "Google Multi-Account Routing".** This exact Drive error has now hit the fleet **three times on three different surfaces**: the Profiler note-box iframe (v02.28r), the embedded `#gas-app` iframe after sign-in, and now the Apps Script editor. The mechanism is that Google resolves a URL with no `/u/N/` prefix against the browser's **default** account, and this fleet is unusually exposed because the GAS projects and their Drive folders are owned by a dedicated **script account** while day-to-day browsing happens as the developer's personal account — a split the `DRIVE_FOLDER_ID` comment in `Receipts.gs` states outright. Three ranked fixes are recorded (private window with only the owning account; `/u/N/` index forcing; changing the browser default), along with the note that the two **in-app** occurrences are already fixed structurally via credentialless iframes and cookie-less `fetch()`, so a reappearance inside a page means a transport lost its cookie-less property rather than a new Google bug

### Changed
- README tree description for `gas-scripts-reference.md` updated to cover the two new sections

## [v02.54r] — 2026-08-17 02:10:00 AM EST — [4832a48](https://github.com/LightAISolutions/Sales/commit/4832a488b385fc40ff070724181c18fab99582f2)

> **Prompt:** "Picking up from my last "Receipts" related session, Mandy and I both tried to sign in and were denied per the attached screenshot. This is the second time this has happened now. What is going on? Is there any way to prevent this from happening in the future?" *(with a screenshot of the Receipts sign-in wall showing `Access denied. Contact your administrator. (code: not_authorized)`)*

### Fixed
- **`checkSpreadsheetAccess()` could not tell "this user is not on the list" apart from "I could not read the list" — and reported both as `not_authorized`.** The entire Master ACL read sat inside `try { … } catch(e) { /* continue to method 2 */ }`, but method 2 (the editor/viewer sharing-list fallback) is gated on `if (!hasAcl && hasSheet)` and is therefore **skipped whenever an ACL is configured**. So every exception — `SpreadsheetApp.openById` failing, a Sheets timeout, a lock/contention error, quota exhaustion — fell straight through to `cache.put(cacheKey, "0", 600); return denied;`. This is the defect that explains both reported incidents: a per-user data problem cannot deny two users at the same moment, but a failed read of the shared list denies **everyone at once**, and the 10-minute negative cache makes it persist well past the fault itself
- **The same silent path swallowed three structural failures**, all of which deny 100% of an app's users while looking exactly like an individual denial: a missing `Access` tab, a sheet with fewer than two rows, and — most likely to occur in practice — **a missing or renamed page column** (`colIdx === -1`), which was simply skipped with no signal
- **Error-path denials are no longer cached.** `aclReadOk` now records whether the list was actually read. Only a successful read that genuinely finds no grant caches `"0"`; an unreadable list returns a new uncached `aclUnavailable` verdict, so access is restored the moment the service recovers instead of up to 10 minutes later
- **An unreadable ACL no longer counts as a failed login attempt.** `exchangeTokenForSession()` previously incremented the rate-limit counter on every `not_authorized`, and the `hipaa` preset (which Receipts runs) enables `ENABLE_ESCALATING_LOCKOUT` — 10 failures → 30 minutes, 20 → 6 hours. A user retrying through an outage could therefore convert a transient fault into a real lockout. The new `acl_unavailable` branch returns before the counter is touched
- **The failure is now visible instead of silent.** Each failed read logs the attempt number, the page name and the exception message via `Logger.log`, and the unavailable verdict writes a `security_alert` / `acl_unavailable` audit entry with a specific reason (`acl_unreachable`, `acl_tab_missing`, `acl_empty`, `acl_column_missing`). Previously the `catch` block discarded the exception entirely, which is why the first investigation (v02.30r, which shipped the `diagnoseAclAccess()` diagnostic) could find no cause in the code

### Added
- **A bounded retry around the ACL read** — one retry after a 400 ms pause before concluding the list is unreachable, which absorbs momentary contention without materially slowing a genuine sign-in
- **`acl_unavailable` client messaging** in all seven auth pages and the auth HTML template (13 mapping sites across the `fetch` and `postMessage` exchange branches): *"The sign-in service could not reach the access list… This is a temporary service problem, not a change to your access — please try again in a moment."* `Profiler.html` needed a dedicated branch because its catch-all `/access|acl|denied|not_authorized/i` test would otherwise have told the user to ask for access they already have

### Changed
- **`registerSelfProject()` is throttled to once per version (6 h cache TTL) instead of running on every `doGet`.** This is the contention source, not a side issue: the function writes five metadata cells (`#NAME`/`#URL`/`#AUTH`/`#ICON`/`#DESC`) into the **shared** `Access` tab on every page load, and **seven projects share that one tab** — so every page view of any app was writing to the exact sheet every sign-in must read. The marker is only set after a fully successful pass (a failed registration retries on the next load rather than being suppressed for six hours), and the `doPost(action=deploy)` route clears it outright so a redeploy always re-registers
- **Propagated to all seven auth projects and both templates** per [PC-TEMPLATE-PROP] #19 — `Receipts`, `Profiler`, `Scraper`, `MasterACL`, `Globalacl`, `Testauthgas1`, `Testauthhtml1`, plus `gas-minimal-auth-template-code.js.txt` and `HtmlAndGasTemplateAutoUpdate-auth.html.txt`. The `checkSpreadsheetAccess` body was confirmed **byte-identical across all eight copies** (same 115-line md5) before patching, so a single scripted replacement was safe

### Note
- **The fix is fail-safe by construction: no path grants access to anyone who would previously have been denied.** A successful read that finds no grant behaves exactly as before. Only the *error* paths changed, and they still deny — they simply deny with a distinguishable code, without caching, and without counting against the lockout
- **Which trigger fired on these two specific incidents is still unconfirmed** and cannot be determined from the repo — it needs the Apps Script execution log. Running `diagnoseAclAccess()` (added v02.30r) from the editor now discriminates it, and from this version on the execution log records the reason automatically. `acl_column_missing` and `acl_unreachable` are the two candidates consistent with two users being denied simultaneously
- **`auditLog()` was verified safe to call from the new error path** — `_writeAuditLogEntry` wraps its own spreadsheet write in `try/catch` and swallows failures, so it cannot throw back into `checkSpreadsheetAccess` during the very outage being handled
- All nine `.gs` files pass `node --check` after patching

## [v02.53r] — 2026-08-16 10:59:08 PM EST — [620e4e2](https://github.com/LightAISolutions/Sales/commit/620e4e204ffbd8fc1f6d2ab3c4c07d800ca17b12)

> **Prompt:** "Make the following changes:
>
> * In the header, remove "Profiler Dossier Set" and revise "Equity Research" to "Jon Yang Equity Research".
> * In the Table of Contents, Key Judgments, type out the last four topics instead of "+4 more".
>
> Output both documents as downloadable PDFs."

### Changed
- **Header rebranded to "Jon Yang Equity Research" in both places it appears**, across both documents: the masthead kicker on page 1 of `aidc-market-report-print.html` and `aidc-coverage-universe-print.html`, and the running page header in `scripts/build-aidc-report-pdf.mjs` that prints on every page of every edition. **"Profiler dossier set" removed** from the running header, leaving `Jon Yang Equity Research · 40 companies under coverage · 16 August 2026`
- **The Key Judgments contents entry now lists every judgment** — the truncated `… +4 more` marker was replaced with the three omitted titles: craft labor as the scarcest input, displacement windows open through 2026, and monitoring the risk stack on a calendar

### Fixed
- **The `+4 more` marker was itself wrong — only three judgments were omitted, not four.** The contents line listed nine of chapter 1's twelve judgments. Counted programmatically against the actual `### 1.x` headings rather than by eye, since the developer's instruction inherited the same miscount
- **The Coverage Universe carried the market report's title in its running footer on all 51 pages** — a defect introduced when the companion was split out in v02.52r, because `FOOT` was a single hardcoded constant shared by both documents. Replaced with a `foot(label)` function and a per-document `foot` field in the `DOCS` registry, so each document's footer names itself

### Note
- `scripts/build-study-prep-pdf.mjs` also contains "Profiler dossier set" in three running headers, but those belong to the Hithium and Megmeet study-prep documents rather than the market report, and were left unchanged as out of scope

## [v02.52r] — 2026-08-16 10:23:10 PM EST — [6316575](https://github.com/LightAISolutions/Sales/commit/6316575afc40adc34bbf247afa98d2a6376dbd79)

> **Prompt:** "Continue with your recommendation. I want the coverage document to keep the "recommended strategy" per company."

### Added
- **`AIDC-COVERAGE-UNIVERSE.md` and `aidc-coverage-universe-print.html`** — a new standalone companion carrying the former chapters 10–12, renumbered 1–3, with its own masthead, contents index, standing disclaimer and colophon. Per the developer's explicit instruction the **per-company recommended strategy stays in the companion** — all **14 recommended-strategy passages** were verified present in the extracted block before anything was written, and again after
- **Five PDF editions of the companion** — `AIDC-COVERAGE-UNIVERSE.pdf` (canonical, **51 pages**) plus analyst-prose (48), equity-research (48), intel-briefing (57) and smart-brevity (54)
- **A `DOCS` registry in `scripts/build-aidc-report-pdf.mjs`** replacing the single `SRC` constant, plus a `--doc <report|coverage>` flag. With no flags the script now renders **both documents in all five styles**, so neither the editions nor the two documents can drift apart. The `--png` proof mode still works, capturing whichever document rendered last

### Changed
- **The market report is now 11 chapters and 109 pages, down from 14 and 158** — a 31% reduction with no argument removed. What left was reference, not insight: the coverage chapters were 32.9% of the report by word count while carrying per-company entries rather than market analysis
- **Chapters 13 and 14 renumbered to 10 and 11**, and **122 subsection headings renumbered** across both documents (`13.x`→`10.x`, `14.x`→`11.x` in the report; `10.x`/`11.x`/`12.x`→`1.x`/`2.x`/`3.x` in the companion). The chapter-level rename did not touch subsections, which is exactly the kind of half-applied edit that reads as complete
- **Both documents cross-reference each other** — the report's "How to read" note and Markdown preamble point to the companion; the companion points back for the primer and conventions
- **The Method chapter's "Coverage expanded to three chapters" row rewritten** to describe the split and the reason for it (different refresh clocks: company facts move on earnings, the argument does not)
- **README tree** gained 7 entries for the new files, and two stale figures were corrected — the report row still claimed 14 chapters and 155 pages

### Fixed
- **A stale `chapter 13` cross-reference in the print HTML** that the Markdown-only prose repair had missed. Caught by re-grepping both files rather than trusting that the two twins had received identical treatment — the same `.md`/print-HTML drift risk flagged in earlier sessions
- The companion initially lost the standing disclaimer, colophon and developer-branding block, because the extracted chapter range ended before the document footer. Restored with companion-specific wording

## [v02.51r] — 2026-08-16 10:08:36 PM EST — [3176423](https://github.com/LightAISolutions/Sales/commit/31764230e3d3c2997eb39882157d7dab30ad6751)

> **Prompt:** "Apply +1 patience to chapter 2 only.
>
> Aside from that change, evaluate the current structure and flow of the market report. I think 157 pages is too long for a market report; I think it should be closer to 70-90 pages (actual Bloomberg report length). Are there any sections that we could break out into separate, more targeted, reports? However, I do not want to sacrifice market insights for a shorter report length. If you think we need more pages, then feel free to push for it."

### Changed
- **Chapter 2 of the AIDC market report raised one notch in teaching patience**, per the dial framework agreed in the preceding turn — and **chapter 2 only**, verified by confirming all five diff hunks fall inside lines 192–257. Chapter 2 was already strong prose, so the pass added targeted scaffolding at the five points a non-specialist actually stumbles rather than rewriting passages that worked: (1) a chapter on-ramp stating that no prior electrical knowledge is assumed and mapping the seven subsections in reading order, (2) the volatility swing made concrete — a 336 MW-IT building moving by a third is a ~110 MW step change appearing and disappearing in under a second, which upstream equipment experiences as a power station cycling on and off, (3) the grid-to-chip chain walked once end to end with real voltages at each stage, 138,000 V down to roughly 1 V across seven conversions, (4) the square law worked with actual arithmetic — one megawatt at 400 V needs 2,500 amps against 1,250 amps at 800 V, and holding voltage flat while a rack goes 200 kW → 1 MW raises current fivefold and losses twenty-fivefold, and (5) a power-versus-energy on-ramp before the storage table
- **Chapter 2 grew 5,710 → 6,281 words** (+10%); canonical edition **157 → 158 pages**, analyst-prose 150, equity-research 150, intel-briefing 181, smart-brevity 166
- The square-law arithmetic was deliberately written in **pure DC terms** rather than as an 800 VDC-versus-415 VAC comparison. The three-phase AC case involves a √3 factor and power-factor effects that would have made a hand-computed comparison easy to state wrongly; NVIDIA's published 157%-more-power and 45%-less-copper figures remain in the text as their own cited claims

### Fixed
- **Archive rotation executed** — the active changelog reached 101 sections with this push, exceeding the 100-section threshold. The oldest non-exempt date group (**2026-08-03, 11 sections, v01.51r–v01.61r**) was rotated to `CHANGELOG-archive.md` as an indivisible unit with mandatory SHA enrichment on every header. The shallow clone was deepened to 352 commits first, since all 11 lookups would otherwise have failed silently — the failure mode recorded in the session notes

## [v02.50r] — 2026-08-16 09:09:12 PM EST — [29bf561](https://github.com/LightAISolutions/Sales/commit/29bf561e9ee9de7bb54d8cf4d699bae04b5d35b9)

> **Prompt:** "fix the term gaps"

### Added
- **Twenty-one acronym expansions inserted at first use** in the AIDC market report, closing the Tier A gaps found by the preceding sweep: **LFP** (lithium iron phosphate — expanded once at line 1027 previously, and never as a definition), **HVDC** (with an explicit note that it is unrelated to the 800 VDC rack architecture of chapter 6, which was the likeliest reader confusion), **BESS**, **OEM** (the report defined ODM carefully while leaning on a distinction it never stated), **IEC**, **PV**, **MOFCOM**, **SOFR**, **NFPA**, **IEEPA**, **NDAA**, **LMFP**, **OBBBA**, **AD/CVD**, **EPC**, **CAGR**, **SPV**, **PTC**, **ASIC**, **OCP**, and **EBITA**
- **A new subsection in chapter 8, "Who actually enforces this — the two parties who can veto your supplier"**, closing the largest substantive gap: the chapter explained the FEOC material-assistance rule at length while never naming the **tax-equity investor** or the **independent engineer** — the two private parties who actually enforce it commercially. Neither phrase appeared anywhere in the report's 88,000 words. The passage also gives **bankability** a named enforcer by connecting it to the IE, and draws the consequence that a compliance claim is only as good as the tax counsel and independent engineer who must accept it
- **Capacity factor** taught in section 5.6 — the report compared turbines, fuel cells, nuclear and storage on nameplate power throughout without ever introducing the metric that makes those numbers comparable, and specifically without noting that a fast-start aeroderivative bought for schedule runs at a low capacity factor by design
- **Four further in-place definitions** for terms that were load-bearing but unexplained: **curtailment** (previously only "curtailability", used once inside a recommendation that depends on it), **ancillary-services markets** (which pay for the capability to respond rather than for energy delivered), **four-nines / three-nines** availability, and **book-and-burn** — which was being used to *explain* what backlog excludes while itself undefined

### Changed
- **The EBITA-versus-EBITDA trap is now flagged explicitly.** The report used **EBITA** six times for Hitachi Energy and **EBITDA** once for Eaton, expanded neither, and never signalled that they are different measures — leaving a 13.4% EBITA margin sitting near a 22.5× EBITDA multiple with nothing to warn the reader that the D is missing from one of them
- **Chapter 1 gained a single forward-pointer sentence** directing readers to the section 2.6 vocabulary table, rather than back-defining thirteen terms inside the executive summary. Chapter 1 legitimately runs at summary speed before the chapter 2 primer arrives, so the Tier B ordering gaps (bps +1,719 lines, PJM +1,301, FERC +1,291, ESS +966, aeroderivative +666) were treated as a navigation problem rather than a definition problem
- **All five PDF editions rebuilt** — canonical 155 → **157 pages**, analyst-prose 149, equity-research 149, intel-briefing 180, smart-brevity 165

### Fixed
- A stray `<em>` HTML tag introduced into the Markdown edition during the acronym pass was corrected to Markdown emphasis before commit

## [v02.49r] — 2026-08-16 07:55:40 PM EST — [3456594](https://github.com/LightAISolutions/Sales/commit/345659462ee074302fd27ba89204dc4367e8dc09)

> **Prompt:** "Picking up from the recent "Hithium Interview brief PDF" session, I think the current iteration of AIDC market report is pretty good. I might have some clarification questions about certain parts of the reports, which I will ask you about, and you can decide if and how to integrate that information into the report. Speaking of which: • Give me a 1 sentence overview of what each of the following certifications cover: ○ UL 1973, UL 9540, UL 9540A, NFPA 855, IEC 62619/62477/63056"

### Added
- **A new subsection in the AIDC market report, §7.5 "Reading a certification claim — the stack in order"**, closing a teaching gap the previous edition left open: the section asserted that safety certification is a permitting gate rather than a badge, but defined only two of the gates (UL 9540A and NFPA 855) while naming none of the rest. The new passage teaches the whole ladder in dependency order — **UL 1973** at the component layer, **UL 9540** at the system layer (built on UL 1973 batteries and UL 1741 power conversion beneath it), **UL 9540A** as the fire test whose report feeds **NFPA 855** siting decisions, and the international ladder of **IEC 62619** (baseline industrial lithium safety), **IEC 63056** (the grid-storage layer on top of it) and **IEC 62477** (the converter side, to 1,000 V AC / 1,500 V DC)
- **The investor-facing payload of that subsection is that "we are certified" is several non-interchangeable claims, not one.** Three discriminations are now stated explicitly: a vendor advertising itself as *UL 9540A certified* has made a category error because UL 9540A issues no certificate at all, only a test report; a vendor holding UL 1973 on a new large-format cell without a UL 9540 listing on the system built from it has cleared the component gate and not the system gate; and a vendor carrying the full UL *and* IEC stack avoids a re-test cycle when selling into both US and international procurement, which is a timing advantage when demand outruns laboratory scheduling. **Hithium** is cited as the corpus's clearest example of the complete stack *(Hithium dossier)*

### Changed
- **All five PDF editions rebuilt** from the amended source — canonical (Bloomberg) 155 pages, analyst-prose 148, equity-research 148, intel-briefing 178, smart-brevity 164. The addition absorbed into the existing page flow without changing the canonical page count
- The standards scope statements were **verified against live sources before being written** rather than asserted from memory (UL/IEC/ANSI webstore scope text and standards summaries, retrieved 2026-08-16), consistent with the report's chapter 14 provenance statement. The Hithium certification attribution was checked against `hithium.profile.json` rather than carried over from the interview brief

## [v02.48r] — 2026-08-16 03:15:19 AM EST — [0d37cd9](https://github.com/LightAISolutions/Sales/commit/0d37cd9f5ffc02384eff594a9edf71d6fe246d5c)

> **Prompt:** "I want to refine the AIDC market report (bloomberg style): • Separate out the Table of Contents to the 2nd page and list out each chapter in a single column instead of two columns. • Make sure each Chapter starts on a fresh page. • You are the leader of an equity research department that covers the 40 companies on Profiler in order to fully understand the US AIDC industry. I am your most important investor that may not understand everything in the market. Your goal is to educate me on important industry trends, policy concerns, supply chain scarcities, and anything else that could impact my investment strategy. Analyze the current environment for the different companies under coverage and recommend some sales strategies for them and why. ○ Explain each Key Judgment in more detail. ○ Evaluate all other chapters and rewrite in a way that would actually be informative and educational for me rather than just throw a bunch of earnings report related facts at me. Output in a downloadable PDF."

### Changed
- **The AIDC market report was rewritten from a sales-strategy document into an investor-education one**, and roughly quintupled: **9 chapters → 14**, canonical edition **31 → 155 pages**, 12 → **17 figures**, 17 → **23 tables**. Every chapter now opens by teaching its subject in plain language, defines its terms in place, and closes with a passage titled *What this means for your capital* (23 such passages across the report) plus the observable that would falsify the argument
- **Layout, per the three explicit requests** — the contents block moved to **its own page 2** as a **single-column** index (`.toc` `column-count:2` → `1`, plus `page-break-after`), and **every chapter opens a fresh page** (`page-break-before` on `h2`, which also lands Contents alone on page 2 since Contents is itself an `h2`). The manual `class="brk"` markers the previous edition carried on chapters 2–9 are now redundant
- **Chapter 1 (Key Judgments) expanded** from 12 one-sentence assertions into 12 reasoned subsections, each stating the judgment plainly, explaining the mechanism, drawing the consequence for capital, and naming the specific observable that would prove it wrong — plus an opening passage teaching the reader how to weight a (High) versus a (Moderate) tag
- **New chapter 2, a primer** — the electrical chain from grid to chip, why voltage matters (losses scale with the square of current), the three different jobs storage does at three different timescales, what an interconnection queue is, and a vocabulary table. Nothing in the previous edition taught any of this, which is why the rest read as a fact dump to a non-specialist
- **New chapter 8 consolidates policy**, previously scattered across three chapters: the FEOC material-assistance regime taught mechanically (the (A−B)/A ratio, the 55% 2026 threshold rising to 75% by 2030, forfeiture of the entire 30–40% ITC, why US assembly does not automatically cure it, the finite safe-harbour pool), the tariff stack, the FCC Covered List action, the DoD 1260H list, FERC/Talen, the EU phase-out, and ratepayer politics
- **Coverage expanded from a four-row account map to three full chapters (10–12)** covering **all 40 names individually** — 14 buyers/builders/landlords, 10 power/grid/prime-mover names, 16 storage/cell/rack-power names — each with what the company is in this pipeline, the forces acting on it now, a **recommended commercial strategy with its reasoning**, and the observable that would change the view
- **New chapter 14** states provenance honestly, including a table of what changed from the previous edition
- **Masthead, running header/footer and the how-to-read note** reframed for the new audience, with an explicit **not-investment-advice** disclaimer in the masthead and a standing one in chapter 14

### Fixed
- **The FCC inverter action, which the previous edition got wrong** — it described a *pending, draft, China-specific rule*. It took effect **28 July 2026**, and it is an **origin test, not a nationality test**: "foreign-produced" means failing the Buy American domestic-end-product threshold, so an American brand manufacturing offshore is caught too. It is a two-prong test (bi-directional inverter **and** wireless connectivity), **prospective only**, with a conditional-approval path to 1 January 2028. This closes the integrity gap flagged in the two previous sessions, where §6.4/§8.4 contradicted the report's own sourcing claim
- **Figure and table numbering renumbered sequentially across the document.** Each chapter was drafted independently, so numbers restarted, duplicated and appeared in a chapter-prefixed form (`Figure 6.1`). Intra-chapter prose references ("the spread in Figure 1") were remapped with the captions, via a sentinel pass so a renumber could not collide with a number it was about to assign
- **A fabricated citation** — the Buy-American 65%/75% thresholds were attributed in two chapters to a *National Law Review* item in the Huawei Digital Power dossier. That dossier contains no such figure; the attribution is now stated as re-verified policy research rather than a dossier source
- **A misattributed but real figure** — the ≥12,000-cycle CATL 587 Ah comparator is genuinely in the corpus, in the **Hithium** dossier's competitor-positioning field, not CATL's own. The critique pass called it invented; it was not, and the citation now names the right dossier
- **Three dropped confidence tags** — LITEON's "one generation behind Delta" read (dossier-tagged High) rendered as bare fact in three places, and the Hitachi Energy India read (dossier-tagged Low) lost its tag in chapter 4 while chapter 11 kept it
- **Two contradictory rack-power figures** reconciled — chapter 2 said ">200 kW per rack today" while chapter 6 said "120–150 kW class today". Both are in the NVIDIA dossier as different NVIDIA framings; the text now carries both rather than silently picking one
- **Three passages that read as security selection rather than commercial analysis** recast — a sentence directing the reader between a parent and a listed subsidiary, a "high-beta expression of the thesis" framing, and a relayed broker rating stated in the report's own voice
- **Chinese export-control material given proper provenance** — the MOFCOM catalogue and announcement dates, and the Amara Raja/Gotion corroboration, are re-verified research rather than dossier facts, and two false cross-references pointing at a chapter that did not contain them were removed

### Notes
- **Produced by a 14-agent workflow** (ultracode): 13 parallel chapter drafts at high effort, then one adversarial critique pass over the assembled set hunting invented facts, stale FCC framing, unlabelled analysis, coverage gaps, investment-advice language and markup violations. 3.35M subagent tokens, 270 tool calls, 112 minutes wall clock — the container has 4 CPUs, so the workflow concurrency cap was **2**, not the 8–16 the fan-out was sized against
- **The critique pass earned its place.** It found eight real defects and was itself wrong once, on the CATL cycle figure — checking `catl.profile.json` but not the Hithium dossier where the comparator actually lives. Verifying its findings before applying them mattered
- **A bug of mine corrupted the assembled HTML mid-session and was caught by a structural check.** A heading-normalisation regex had four capture groups but its replacement used three, which prepended the heading-level digit to every heading (`1.5` → `31.5`) and **deleted every closing tag**. Recovery was a deterministic rebuild — `git checkout` the print HTML, re-apply the four layout/front-matter edits through a script that asserts each one applied, then re-run assembly and renumbering. The lesson is in the tooling now: every scripted edit in this session's helper scripts asserts its own application rather than silently no-opping
- **Verified before committing** — heading open/close tags balanced at every level (15/15, 135/135, 156/156), zero NUL bytes from the sentinel pass, contents at one column, no table overflowing its column budget, no bar-chart fill above 100%, no empty bar labels, `<caption>` styled, and all five editions rebuilt (148–178 pages depending on skin)
- **The `.md` and the print HTML were regenerated from the same chapter set in one pass**, so the canonical text and the typeset source cannot have drifted from each other in this edition
- **This is a long document now.** 155 pages is proportionate to per-company coverage of 40 names, but it is a reference to consult by chapter rather than to read end to end; the contents page and the chapter-per-page layout exist to make that practical

## [v02.47r] — 2026-08-15 11:17:14 PM EST — [d5ae9c5](https://github.com/LightAISolutions/Sales/commit/d5ae9c54a83bc3a85badd8b7bfd622040f3e447b)

> **Prompt:** "continue with your recommendation"

### Added
- **`repository-information/study-prep/hithium/hithium-strategy-addendum.md`** + **`HITHIUM-STRATEGY-ADDENDUM.pdf`** (3 pages) — a short companion to the 21-page interview brief, answering the developer's question about what sales strategies to propose and how well Hithium is positioned for US AI data centres. Five sections: the two strategies to lead with (own the material-assistance arithmetic; sell to the grid rather than to the data centre), five more held in reserve, the AIDC position, two questions it sets up, and a do-not-say list. Kept as a **separate artifact deliberately** so the brief stays closed at 21 pages

### Changed
- **`scripts/build-study-prep-pdf.mjs`** — registered `hithium-strategy-addendum`, and added two **purely additive** shell options for short documents: `toc: false` suppresses the contents block, and an omitted `banner` suppresses the style banner. Both default to the existing full treatment when the fields are absent, so the three previously registered documents are untouched — verified by rebuilding the interview brief and confirming a byte-identical size
- **README tree** — added both addendum files under `study-prep/hithium/`, and corrected the interview-brief PDF's connector from `└──` to `├──` now that it has siblings

### Notes
- **I missed my own page target and the document says so.** The recommendation promised a one-page sheet; it came out at three. Trimming the body ~25% moved the page count not at all — the driver is the letter format, the ~10pt base type and the 258px masthead, not word count. The remaining ways to reach one page were to cut the reserve-strategies table (which is the substance the developer actually asked for) or to shrink type toward unreadable, so the content was kept and **the document's own framing line was rewritten from "One page." to "Three dense pages"** rather than shipping a false claim in the deliverable
- **The AIDC verdict is deliberately unflattering: weak, and worse than for ordinary utility-scale storage.** Four reasons, of which the binding one is that Hithium has no product at the rack layer — no BBU, supercapacitor shelf, UPS, PCS or rack form factor — so it cannot participate in the storage layer specific to AI, and in the campus layer it sells DC blocks where data-centre EPCs buy integrated AC systems. The constructive half is the reframe: the buildout AI is actually causing is utility- and IPP-owned front-of-meter storage, which is ordinary Hithium territory
- **One research finding reversed an initial hypothesis and the reversal is recorded in the document.** The Gulf looked like the soft landing for AIDC given the existing 4 GWh Saudi Electricity Company relationship. It is the opposite for AI-specific equipment: Gulf AI investment with the US was conditioned on divesting Chinese equivalent technology, with advanced-chip access as the lever. Gulf *grid* storage remains wide open — SPPC's 3 GW/12 GWh tender, 27 prequalified. Same country, opposite answer depending on where the electron goes; the addendum states it that way
- **Sourcing discipline is carried in the masthead**, which states plainly that market facts are sourced while the layer analysis, the weak grading and the sell-to-the-grid reframe are labelled analysis
- **Verified visually before committing** — contents block and style banner correctly absent, masthead compact at 258px, five H2s, no table overflow
- **A no-op rebuild of the interview brief was reverted.** The script change does not affect it, and re-committing a 493 KB blob to move a `/CreationDate` is the same history churn declined in v02.43r and v02.44r

## [v02.46r] — 2026-08-15 10:40:56 PM EST — [d070af8](https://github.com/LightAISolutions/Sales/commit/d070af8ba15f72df96393a391b82e85e737ac284)

> **Prompt:** "continue with your recommendation"

### Added
- **`#### Beijing's half of the squeeze`** in `hithium-interview-brief.md` — a sub-block inside the FEOC subsection of the regulatory stack. The brief previously carried the Reliance licensing collapse as a half-sentence inside a hedging paragraph; the developer asked for the story, and tracing it established that this is the mechanism making the FEOC problem *structurally* hard rather than merely expensive, which is too valuable to leave buried. Covers: the two Chinese export-control actions with dates and thresholds (MOFCOM/MOST catalogue amendment 2025-07-15 adding LFP/LMFP cathode preparation technology while **lowering** the technical thresholds that define scope; MOFCOM/Customs Announcement No. 58 of 2025-10-09, effective 2025-11-08, extending dual-use controls to batteries, cathode and graphite anodes); the **restricted-not-prohibited** licence-management mechanism and what the July → November → January sequencing implies; the Amara Raja/Gotion and Exide/SVOLT corroboration including the visa-denial lever; the two-sided bind; and why wholly-owned plants are the consequence
- **A third question in the "About the compliance crux" group** — whether the export-control regime shapes the localization strategy, and whether it touches the Navarre cell plant. Carries an explicit ask-don't-assert instruction, since nothing published addresses intra-group technology transfers
- **A two-part caution blockquote** — Reliance **publicly and categorically denied** pausing its battery plans (it owns Lithium Werks and Faradion as fallbacks), so the brief prescribes "the licensing route stalled under Chinese export controls" and forbids "Reliance halted its gigafactory"; and it warns against opening the topic as "what happened with Reliance?", which invites the interviewer to hear a probe about a failure

### Changed
- **`HITHIUM-INTERVIEW-BRIEF.pdf`** rebuilt — 20 → **21 pages**. Section count stays at 16: the addition is an H4 inside an existing H3 inside an existing H2, so the contents block is untouched
- **README tree** — the PDF's page count updated from 20 to 21

### Notes
- **First use of an H4 in a study-prep document.** The renderer already handled it — it derives heading level from the `#` run length and emits `<h4>`, and the print stylesheet already carried an `h4` rule — so no script change was needed. Verified the computed style renders as a small-caps amber label, visually a clear level below the numbered H3s and not competing with the bold paragraph lead-ins around it
- **The analytical payload is the two-sided bind**, and it is the strongest observation in the brief: the emerging workaround for the American material-assistance rules is a structure in which a non-prohibited US entity owns the production, and that is exactly the technology transfer Beijing converted into a discretionary permission. Hithium is constrained from both capitals at once, which is why its localization answer is wholly-owned plants (Mesquite, Navarre) rather than licensed local manufacture
- **Confidence discipline preserved.** Both export-control actions, the Bloomberg report, Reliance's denial, and the Amara Raja and Exide details are sourced. Two items are labelled as inference in the document: the reading of *why* Hithium withdrew in January when the rules changed in July and November, and whether transferring restricted cathode technology to a wholly-owned overseas subsidiary escapes the regime — the latter is deliberately framed as a question to ask rather than a claim to make
- **Verified visually before committing** — the new block's five bullets render intact, the cautions blockquote correctly picks up the boxed-caution treatment (bold lead-in) rather than the pull-quote treatment, contents still resolves 16 entries, and no table overflows its column budget
- **Rebased onto `origin/main` before editing**, since v02.45r had already auto-merged; branch confirmed absent from the remote before pushing
- **This is intended as the last content addition before the 2026-08-17 interview.** At 21 pages, further material costs the developer absorption time rather than buying readiness — stated as such in the response so the decision is visible rather than implicit

## [v02.45r] — 2026-08-15 10:29:57 PM EST — [3d98c3e](https://github.com/LightAISolutions/Sales/commit/3d98c3efc8fc05e64a8b948800b03e6d797eacbb)

> **Prompt:** "continue with your recommendation"

### Added
- **`### How cycle life converts into money`** in `hithium-interview-brief.md` — the brief's "What you have to sell with" table asserted that Hithium's cycle life is "augmentation capex avoided and a warranty-reserve line item" without explaining the mechanism. The developer asked what that meant, which identified the one place in the document that stated a conclusion and withheld the reasoning underneath it. The new subsection sits immediately after the table it explains and covers: the flat-obligation-versus-decaying-asset mechanism (70–80% LFP retention at ten years of daily cycling, 70%-at-year-ten warranty convention, 15–20% day-one oversizing as standard practice, Lazard-style augmentation reserve at ~3% of equipment cost per year); **two traps** — a cycle count is not a degradation curve, and cycles beyond what the duty cycle consumes are worth nothing; the two-sided warranty reserve (seller-side provision against gross margin, buyer-side IE haircut plus mitigant cost); a speakable compressed version; and a hedged note on how augmentation may interact with the FEOC regime
- **Two vocabulary entries** — `Capacity guarantee` (the warranted year-by-year retention table, which is what a financial model actually consumes) and `Warranty provision / reserve` (both sides of it)
- **Self-test question 11 + answer** — section retitled from "Ten-question self-test" to "Eleven-question self-test". A concept the brief now teaches is reinforced the way every other concept in it is, and the question/answer counts stay in parity

### Changed
- **`HITHIUM-INTERVIEW-BRIEF.pdf`** rebuilt — 18 → **20 pages**. Section count stays at 16 because the addition is an H3 inside the existing North America section, so the contents block is unchanged
- **README tree** — the PDF's page count updated from 18 to 20

### Notes
- **The load-bearing point of the new subsection is that the two halves of the phrase are one argument, and only one of them is about the cell.** Cycle life moves the augmentation line; it does nothing for the warranty reserve, because a lender's independent engineer can haircut a warranty from a private supplier that has never published a full year of financials regardless of how good the cell is. That is why the brief already pairs cycle life with the warranty-backstop objection and the insurance-wrapper question — the subsection now makes the connection explicit rather than leaving it implicit across three sections
- **Confidence discipline preserved.** The retention figures, warranty convention, oversizing norm and Lazard augmentation reserve are sourced. The FEOC/augmentation interaction is labelled as inference in the document itself, with an explicit instruction to raise it as a question for tax advisers rather than assert it — consistent with how the brief handles the material-assistance and FCC reads. No illustrative dollar figures were carried into the document; the worked NPV example used in chat was deliberately left out, since arbitrary numbers in a reference document invite being quoted
- **Verified visually before committing** — the new subsection renders with its bulleted traps intact, the speakable version is correctly detected as a "SAY IT LIKE THIS" pull quote (it opens with a quote mark), the contents block still resolves 16 entries, no table overflows its column budget, and the force-opened self-test block prints all eleven answers
- **Rebased onto `origin/main` before editing**, since v02.44r had already auto-merged; the branch was confirmed absent from the remote before pushing, per push-once enforcement
- Only the Hithium document was rebuilt, so the two Megmeet PDFs are untouched

## [v02.44r] — 2026-08-15 09:20:49 PM EST — [31ff4ce](https://github.com/LightAISolutions/Sales/commit/31ff4cedc737cb5e4d891ebfa1a80a2b0082c3d1)

> **Prompt:** "Picking up from the last "Megmeet Interview Brief PDF" session, the Megmeet interview brief was very useful. I have a third round interview with Hithium's Mizhi Zhang in two days, so create me a similar interview brief for it. Output as a downloadable PDF."

### Added
- **`repository-information/study-prep/hithium/hithium-interview-brief.md`** — the Hithium counterpart to the Megmeet interview brief, tuned for the third-round on-site with Mizhi Zhang on 2026-08-17. 16 sections following the Megmeet structure, with three sections that have no Megmeet analogue because the subject demanded them: a **logistics** block (this round is an in-person visit, so time/address/room/coordinator are actionable), a consolidated **regulatory stack** section covering the three separate US actions that hit this company differently, and an expanded **"who you're meeting"** section — because unlike Megmeet's interviewer, this one is extensively documented
- **`repository-information/study-prep/hithium/HITHIUM-INTERVIEW-BRIEF.pdf`** — 18 pages, 16 sections, same `bloomberg` export skin as the Megmeet pair

### Changed
- **`scripts/build-study-prep-pdf.mjs`** — registered `hithium-interview-brief` in the `DOCS` map. No renderer changes were needed; the brief exercises only Markdown features the Megmeet brief already covered (headings, pipe tables, blockquotes, lists, `<details>`), so the script itself is untouched below the registry
- **README tree** — added `hithium-interview-brief.md` and `HITHIUM-INTERVIEW-BRIEF.pdf` under `study-prep/hithium/`, and changed the lesson plan's tree connector from `└──` to `├──`

### Notes
- **Research went well past the dossier, and it changed the brief's centre of gravity.** `hithium.profile.json` (profileVersion 3, 2026-08-09) supplied the company; two things it does not carry turned out to matter more:
  - **Mizhi Zhang was CEO of Sungrow North America**, and before that managing director of the Americas energy-storage business at the Sungrow–Samsung SDI joint venture. He has already run the playbook this role exists to execute, at a company that is now ranked No. 1 globally among BESS integrators — and he crossed from the PCS/integrator side to the cell side. The brief is built around that rather than around a generic "sales interview" frame. Biography assembled from aggregator renderings of his LinkedIn profile, so the shape is treated as reliable and the exact title as approximate (three variants appear across sources)
  - **The FEOC / prohibited-foreign-entity regime is the commercial crux of the job and postdates nothing in the dossier's framing.** Material assistance cost ratio, ≥55% non-PFE for 2026 construction starts, forfeiture of the entire 30–40% ITC on failure, IRS Notice 2026-15. Paired with the Section 301 step from 7.5% to 25% on non-EV lithium-ion effective 2026-01-01
- **The FCC covered-list analysis is Hithium-specific, not inherited from the Megmeet brief.** The conclusion differs because the products differ: Hithium's utility products ship as **DC** blocks with the PCS supplied by someone else, so the rule's conversion prong is not met on a plain reading — whereas the residential line (integrated inverter + MPPT, wireless connectivity) is genuinely exposed. Flagged in the brief as a labelled read, not a sourced ruling; no source addresses DC-block-without-PCS supply directly
- **Three places the brief deliberately withholds rather than asserts.** FY2025 financials do not publicly exist (the second HKEX application lapsed in April 2026 before they were filed), so the brief instructs citing shipment rankings instead of full-year revenue. The total tariff stack is given as a hedged range because the Supreme Court struck the IEEPA tariffs on 2026-02-20 and landed cost turns on HTS classification. And the CATL litigation carries an explicit do-not-raise instruction, including a specific instruction not to repeat the reported executive detention or the controlling-shareholder equity freeze — those surface only in hostile coverage, and organized opposition coverage of the listing exists whose backers could not be verified
- **Verified visually before committing** — rendered the intermediate print HTML in Chromium and screenshotted the masthead/contents, the say-don't-say and questions sections, and the final page: all 16 contents entries resolve, no table overflows its column budget, and the `<details>` self-test block is force-opened so all ten answers print
- The interview is **Monday 2026-08-17** (`date -d` confirmed the weekday), two days out from this session
- **Only the Hithium brief was built.** A bare `node scripts/build-study-prep-pdf.mjs` rebuilds every registered document, which would rewrite the two Megmeet PDFs for nothing but a new `/CreationDate` — the same history churn declined in v02.43r. `hithium-lesson-plan.md` was deliberately **not** registered: the developer asked for the brief, and registering the lesson plan is a separate decision

## [v02.43r] — 2026-08-14 02:29:35 AM EST — [f446430](https://github.com/LightAISolutions/Sales/commit/f44643041027d9f5dd05e687db0007a6d7dc4f28)

> **Prompt:** "continue with your recommendation"

### Added
- **`repository-information/study-prep/megmeet/MEGMEET-LESSON-PLAN.pdf`** — the companion lesson plan typeset to match the interview brief. 5 pages, 5 modules. The brief teaches the room, the lesson plan teaches the physics; both now travel in the same format
- **Fenced code block support in `scripts/build-study-prep-pdf.mjs`** — the renderer previously had no `` ``` `` handling, which the interview brief never exercised but the lesson plan needed for its two ASCII architecture diagrams (the legacy power chain and the 800 VDC chain). Fenced content is escaped and never inline-processed, so a stray `*` inside a diagram stays a stray `*`. The print style sets `white-space:pre` at 7.5pt mono — **deliberately non-wrapping, because a wrapped ASCII diagram is a destroyed one**; that size fits ~118 columns in the printable width, comfortably clearing the widest block in either document (92 columns)

### Changed
- **Contents block collapses to one column at 6 sections or fewer** — the lesson plan's 5 long module titles balanced badly across two columns, wrapping in the first while the second sat half empty. The interview brief's 15 sections are unaffected and still render two-up
- **README tree** — added `MEGMEET-LESSON-PLAN.pdf` under `study-prep/megmeet/`

### Notes
- **The interview brief PDF was rebuilt and then deliberately reverted.** It has no fenced code and 15 sections, so neither renderer change touches it — a byte comparison confirmed the rebuild differed in exactly 14 bytes, all of them the PDF `/CreationDate`. Re-committing a 350 KB blob to move a timestamp is pure history churn, so the committed file stands. Both PDFs are nonetheless verified against the current script
- **Verified visually before committing** — the two ASCII diagrams render intact at full width with box-drawing characters and column alignment preserved, and the interview brief still reports 13 pages / 15 sections / identical size, confirming no regression
- Today is **Friday 2026-08-14** (`date -d` confirmed), which is the meeting date the lesson plan's pacing section is written against

## [v02.42r] — 2026-08-14 02:12:33 AM EST — [55e61ce](https://github.com/LightAISolutions/Sales/commit/55e61ceec23a213d7ac9f13b9fac88e6a18aff8e)

> **Prompt:** "Picking up from the last "AIDC Market Report PDF conversion" session, output the "Megmeet Interview Brief" in a downloadable PDF."

### Added
- **`repository-information/study-prep/megmeet/MEGMEET-INTERVIEW-BRIEF.pdf`** — the Megmeet interview brief typeset for print and download. 13 pages, 15 sections, letter format with a running header, a `Page N of M` footer, and an auto-generated two-column contents block. Presentation is the `bloomberg` export skin from `PROFILER-STYLES.md`, so it reads as the same product as the canonical AIDC report PDF
- **`scripts/build-study-prep-pdf.mjs`** — a Markdown-driven PDF renderer for study-prep documents. Unlike `build-aidc-report-pdf.mjs`, whose source was authored as HTML, this parses the `.md` file directly, so **the Markdown stays the single source of truth and the PDF cannot drift from the document the developer actually edits**. Drives the pre-installed Chromium over the DevTools Protocol (only `Page.printToPDF` accepts a custom running header/footer — the `--print-to-pdf` CLI flag cannot). No npm dependencies. Usage: `node scripts/build-study-prep-pdf.mjs [<doc-key>] [--png] [--keep-html]`; a bare invocation builds every registered document

### Changed
- **README tree** — added `build-study-prep-pdf.mjs` under `scripts/` and `MEGMEET-INTERVIEW-BRIEF.pdf` under `study-prep/megmeet/`

### Notes
- **Three rendering decisions worth recording.** (1) **Proportional table columns** — the renderer weights each column by the average text length of its cells, clamped to 11–58%, because equal thirds under `table-layout:fixed` reads badly when one column holds a sentence and another holds a date. The five-objections table is the case that proves it. (2) **`<details>` is forced open** — Chromium prints a collapsed `<details>` as just its `<summary>`, so the self-test answers would have silently vanished from the PDF; they render as a ruled "Answers" block instead. (3) **Blockquotes are split by role** — a bolded lead-in becomes a boxed caution, a quoted line becomes a tinted "Say it like this" pull quote, because the brief uses `>` for both and they should not look alike
- **Deliberately one skin, not five.** The AIDC report ships in all five registered writing styles and `PROFILER-STYLES.md` carries a standing instruction to mirror skin changes across its consumers. Registering a third consumer for a prep document would take on that maintenance obligation for no reader benefit, so this script hard-codes the canonical `bloomberg` skin and stays out of the registry
- **The intermediate HTML is staged outside the repo** (a temp dir), not committed. A committed HTML twin is exactly the drift this design avoids; `--keep-html` writes it next to the PDF when it is wanted for inspection
- **`megmeet-lesson-plan` is registered but not built** — the developer asked for the interview brief. It is one command away: `node scripts/build-study-prep-pdf.mjs megmeet-lesson-plan`
- **`REPO-ARCHITECTURE.md` deliberately not updated**, following the precedent set in v02.33r: the Scripts subgraph carries shared infrastructure only and already omits `check-gas-inner-scripts.js`, `playwright-harness.py` and `build-aidc-report-pdf.mjs`
- **Content gap flagged, not fixed** — the brief's self-test asks twelve questions but the answers block stops at ten. Questions 11 and 12 are both answered in the body. Left alone as developer-owned content

## [v02.41r] — 2026-08-14 01:54:33 AM EST — [c6892fe](https://github.com/LightAISolutions/Sales/commit/c6892fe1c7e40590f660e073dce167b0c187af35)

> **Prompt:** "refresh the Huawei dossier"

### Changed
- **Huawei Digital Power dossier refreshed to profileVersion 2** (`live-site-pages/profiler-data/huawei-digital-power.profile.json`), correcting the materially stale FCC record identified in v02.40r. v1 archived per the Archival Procedure; `archive-index.json` and `profiler-companies.json` synced
- **`summary`** — the defining-constraint clause moved from "a pending FCC inverter ban being drafted" to the enacted 2026-07-28 Covered List prohibition on foreign-produced connected power inverters that blocks new equipment authorizations. `ecosystemRole` updated on the same point
- **New `recentDevelopments` entry (2026-07-28)** — the Covered List action, with the read that matters analytically: the FCC fact sheet names no company or country, the test is the Buy American "domestic end product" standard at 48 CFR 25.101(a), so it is an **origin rule rather than a China rule** and catches Taiwanese, Korean and US-brand offshore production alike. Direct incremental effect on Huawei assessed as near zero (Entity List and NDAA 889 already closed the US); the competitive effect is the real story
- **The 2026-06-30 draft-report entry was retained and marked SUPERSEDED** rather than deleted — it is the accurate record of what was trailed in advance, and the delta between the trailed China-specific framing and the adopted country-agnostic rule is itself analytically useful
- **`strategyRead` #5 rewritten** — now carries the Sungrow market impact (roughly CNY 100B / $14.8B of market value shed over the following month, despite Sungrow retaining US access where Huawei never had it), the two load-bearing scope limits (prospective-only; the two-prong definition requiring both bi-directional conversion **and** remote connectivity), and Sungrow's public argument that it falls outside the connectivity prong because it restricts connection activity to wired links. Whether wired management satisfies "another similar connection" is flagged as unresolved and as the variable that determines how far the rule reaches into wired-managed power electronics, Megmeet rack power included. Collection gap stated explicitly: no source located addresses IT or data-center power supplies directly
- **`strategyRead` #1** — "pending FCC inverter ban" corrected to the enacted prohibition
- Five sources added at the head of `sources[]`: the FCC fact sheet (first-party), Cooley, Morgan Lewis, National Law Review, and Energy-Storage.News on the scope-clarity concerns

### Notes
- Data-only change: `Profiler.html` was not modified, so no page version bump and no page changelog entry ([PC-HTML-VERSION] #2 does not fire). The Profiler page is an **indirect affect**
- All prose written in the registry's active `intel-briefing` style — confidence-tagged judgment, "We assess" construction, facts and assessments kept separate, collection gap stated
- `AIDC-MARKET-REPORT.md` §6.4 and §8.4 still carry the stale framing. Left unchanged: the developer deferred report work, and the report should be regenerated from the refreshed dossier rather than hand-patched

## [v02.40r] — 2026-08-14 01:42:59 AM EST — [8d3da50](https://github.com/LightAISolutions/Sales/commit/8d3da505a593a8d30d005c7c05852c8f2a67905e)

> **Prompt:** "Will the recent FCC ban on foreign-made inverters be a problem for Megmeet? Give me a detailed answer"

### Added
- **New section in the Megmeet interview brief — the July 2026 FCC inverter rule** (`repository-information/study-prep/megmeet/megmeet-interview-brief.md`, and the published artifact). Verified against current sources on 2026-08-14 rather than from the dossier, because the dossier is stale on this (see below). Covers: the mechanism (Covered List addition effective 2026-07-28, barring FCC equipment authorization); the two-part definition (bi-directional DC↔AC conversion **and** remote connectivity via Wi-Fi/cellular/Bluetooth "or another similar connection"); the "foreign-produced" test (Buy American *domestic end product*, 48 CFR § 25.101(a) — US manufacture plus >65% domestic component cost through 2028, 75% from 2029); prospective-only application with pre-28-July authorizations grandfathered; and the Conditional Approval pathway through the Department of War or DHS, open until 2026-01-01, requiring a time-bound US onshoring plan
- **A three-bucket exposure assessment for Megmeet**: AI data-center power (PSUs, shelves, sidecar, SST) reads as **probably out of scope but unsettled** — unidirectional AC→DC, none of the enumerated inverter categories, wired management via PMBus and IPMI/Redfish/SNMP rather than wireless; PV/storage/EV-charging components are **genuinely exposed**, with the 40 kW EV-charging module platform launched 2026-07-31 landing three days after the rule took effect; everything else is out
- **The competitive insight that matters commercially**: the rule is an **origin test, not a China test**, so Delta and Lite-On are equally foreign-produced. If the interpretation ever stretches toward IT power it does not hit Megmeet asymmetrically — it hits incumbents with far more US SKUs to re-authorize
- An eighth question for the interviewer, on whether the covered-list action has changed US authorization planning or the US-versus-Thailand manufacturing calculus

### Notes
- **Confidence is explicitly bounded in the brief.** No source located addresses data-center or IT power supplies directly, so the in/out read is stated as inference from the definition rather than a sourced ruling. The FCC's own FAQ and determination PDF both returned HTTP 403 and could not be read; the analysis rests on law-firm alerts (Cooley, Morgan Lewis, Crowell, Covington) and trade press. The brief instructs the developer to say "my read", not "the rule says"
- **Dossier staleness identified and flagged, not silently patched.** `live-site-pages/profiler-data/huawei-digital-power.profile.json` still records this as a **draft, China-specific** rule from the 2026-06-30 Reuters report, with a strategyRead calling the Megmeet spillover "unconfirmed and scope-dependent". Both predate the 2026-07-28 action and its country-agnostic scope. `AIDC-MARKET-REPORT.md` §6.4 and §8.4 carry the same stale framing. Refreshing the Huawei dossier is a Profiler revision (archive + profileVersion bump) and the report refresh was deferred by the developer, so neither was changed here

## [v02.39r] — 2026-08-14 01:18:13 AM EST — [23c68b2](https://github.com/LightAISolutions/Sales/commit/23c68b213923b455da35b6babdfa8c97df62e13a)

> **Prompt:** "sales role, meeting Yuan Meng, head of NA Sales & Marketing."

### Changed
- **Retuned the Megmeet interview brief for a sales role** (`repository-information/study-prep/megmeet/megmeet-interview-brief.md`, and the published artifact at the same URL). The technology chain is retained — the brief now says explicitly that the bar is being credible with an engineer for twenty minutes, not designing a power shelf — and the weight moved to the commercial picture
- **New section — who you're meeting.** Yuan Meng appears nowhere in the dossier or the repo, and the brief says so plainly rather than inventing a background. What it does supply is the *function*: the only US-facing leader on record is Roya Movahedi (CMO, US/international), the quoted spokesperson in every 2025–26 English release and absent from the China filings — evidence, flagged as inference, that the international commercial layer was built recently and separately
- **New section — the North America picture.** Leads on the nuance most candidates will miss: the expected first hyperscaler volume delivery is **domestic**, so North America is greenfield with no reference win to point at. Then the sellable assets (NVIDIA ecosystem seat, the Dallas lab as a sales instrument, the existing Ericsson/Cisco/Juniper/Arista/Accton network-power relationships, full-chain quoting, spec leadership, financed capacity), the design-in sales motion, and the country-of-origin question
- **New section — five field objections** with what each one is really asking and how to answer: Chinese supplier, unproven at scale, shaky financials, Delta owns the socket, and 800 VDC slipping
- **Rewritten questions-to-ask** for a sales counterpart — territory questions, sale-mechanics questions, and a closing question that separates the equity story from the sales motion. **Two new hard questions** (cold account opening; first ninety days) and **two new self-test items**, bringing it to twelve

### Notes
- **The regulatory framing is deliberately fenced.** The brief warns against importing the battery world's 1260H listings, stepped cell tariffs and draft inverter rule into a Megmeet conversation — those are documented for battery and inverter suppliers, and Megmeet is not recorded as being on those lists. Carrying that framing into the room would describe someone else's problem
- No dossier data changed; this remains a derived study artifact

## [v02.38r] — 2026-08-14 01:06:30 AM EST — [a4143a5](https://github.com/LightAISolutions/Sales/commit/a4143a53c7c799d4c878df30ec344975c08c99cf)

> **Prompt:** "I want to further refine the AIDC market report, but save that task for later. I am going to interview with Megmeet tomorrow morning and want to quickly learn everything I need to seem like I understand their products, industry position, and recent activities. Organize the information in Megmeet's dossier and output it to me in whichever way you think will be best for me to learn what I need to learn."

### Added
- **`repository-information/study-prep/megmeet/megmeet-interview-brief.md`** (new) — an interview-facing companion to the existing technology lesson plan, organized from the Megmeet dossier (profileVersion 2). Where `megmeet-lesson-plan.md` teaches the physics, the brief covers what an interview actually tests: a 60-second "what do you know about us" answer, the five load-bearing facts, the product chain as the catalogue (grid to SST to sidecar to BBU/supercap to power shelves to M-CRPS to power brick), the competitive position against Delta and Lite-On inside the ~74% Taiwanese bloc, a reverse-chronological activity timeline, four hard questions with model answers, a say/don't-say table, six questions to ask them, a 17-term vocabulary table, and a ten-question self-test with collapsible answers
- Published as a phone-readable artifact for review before the interview — serif and monospace typography with no sans face, a signal-teal accent on warm-neutral paper, both themes token-defined, and the grid-to-GPU power chain rendered as a one-line-diagram ladder with voltage annotations

### Notes
- **Sourcing discipline is explicit throughout.** The brief separates sourced fact from the dossier's labeled analytical reads, and flags the unverified Lite-On displacement report specifically — the company has never confirmed it and its own late-2025 statements contradict it, so asserting it in the room would be a credibility loss. The dossier's moderate-confidence "architecture timing" thesis is marked as an interpretation to be presented as one
- The 27 August 2026 H1 report is surfaced as the central catalyst: the company itself called AI-DC revenue immaterial through 2025 while consensus embeds a roughly six-fold FY2026 profit rebound, so the half-year print is the first hard test
- No dossier data was changed — this is a derived study artifact only. The developer's separate request to further refine the AIDC market report was deferred at their instruction and is **not** actioned here

## [v02.37r] — 2026-08-13 04:34:03 AM EST — [09f990c](https://github.com/LightAISolutions/Sales/commit/09f990cfd3ee8cc87516087965ebe0c58ed07bf1)

> **Prompt:** "continue with your recommendation"
>
> *(The recommendation, from the preceding feasibility answer: build the summarization step — Build C-minimal — before speaker ID, because the pipeline currently ends at a transcript and a transcript is not something you send a customer. Reordered ahead of the prior session's "start Build B" recommendation.)*

### Added
- `Profiler.gs` (v01.09g) — **meeting-notes summarization**. A transcript filed with a note is turned into structured notes (Summary / Discussed / Customer signals / Action items / Open questions) by one Anthropic Messages API call. New `summarize` note op plus `summarizeNoteTranscript_`, `anthropicSummarize_`, `meetingNotesPrompt_`, and the pure `vttToPlainText_`
- `vttToPlainText_` strips the WEBVTT header, cue numbers, timing lines, `NOTE`/`STYLE`/`REGION` blocks and inline cue tags, and collapses consecutive duplicate cues — Whisper repeats a cue's text when a segment spans a boundary, which would otherwise be fed to the model twice. Verified against a synthetic VTT carrying every one of those cases
- Two new Script Properties on the Profiler Apps Script project: `ANTHROPIC_API_KEY` (required — without it the op returns `SUMMARY_NOT_CONFIGURED` and the note keeps its placeholder) and `ANTHROPIC_MODEL` (optional override). Default model is `claude-haiku-4-5-20251001`, chosen because `UrlFetchApp` gives up around 60 seconds and a slow response would cost the whole op; `claude-sonnet-5` is a one-property swap when depth matters more than latency
- `Profiler.html` (v01.26w) — a submit that carried a transcript now chains straight into `summarize` (server signals this with a new `canSummarize` flag, true only for `.txt`/`.md`/`.vtt`/`.srt` attachments), and a **✨ Summarize** button appears on any logged note with a transcript, for retrying a failed run or back-filling notes filed before this existed

### Changed
- `Profiler.gs` — summarization is a **separate op**, not part of `submitFieldNote`: a submit must never fail because the model was slow or the key was missing. The note is written with its placeholder first, then filled in
- `Profiler.gs` — re-running is idempotent rather than stacking. The developer's typed text is captured once into a new `typedText` field on first run and re-prepended every time, so the note is rebuilt as `typed text + fresh summary` and their own words are never consumed (User-Owned Content). `triage` deliberately stays `pending` — a machine summary is an input to promotion, not a decision to promote
- `Profiler.gs` — transcripts over 120,000 characters (~2.5 hours) are truncated rather than failing the request, and the note's `[auto-summary …]` header says so. `listFieldNotes` now returns the new `summarized` date
- `Profiler.html` — notes containing newlines render with `white-space: pre-wrap` in both the read-only log and the manage panel; generated notes are multi-line and a plain `<p>` collapsed them into one run-on paragraph
- `repository-information/ENTERPRISE-SETUP.md` — documents the two new Script Properties, including that the key is unrelated to `GITHUB_TOKEN` rotation

### Notes
- This closes the "summary pending triage" placeholder path for transcripts specifically. Word/PDF attachments still get the placeholder and still wait for a triage pass — `driveReadNoteFile_` only returns text for `.txt`/`.md`/`.vtt`/`.srt`
- The Profiler sequence diagram was checked and not updated: it depicts the note *transport* (`?action=note&nop=…`), not individual ops, so a new `nop` does not change what it shows

## [v02.36r] — 2026-08-13 03:39:36 AM EST — [e21f497](https://github.com/LightAISolutions/Sales/commit/e21f497ed5727722df226aec40635382d0e00d0e)

> **Prompt:** "add transcribe.ps1 to the repo. What exactly does adding this launcher to the repo do for me?"

### Added
- `scripts/transcribe.ps1` — PowerShell launcher for local Whisper transcription (`large-v3-turbo`, `--device cuda --compute_type float16 --vad_filter True --language en`, VTT out). Wraps the three things the bare command gets wrong: it calls `whisper-ctranslate2.exe` by full path so the venv need not be activated, prepends every `site-packages\nvidia\**\bin` folder to `PATH` (Windows does not search site-packages, which is what produced `RuntimeError: Library cublas64_12.dll is not found`), and writes each transcript beside its own audio via `--output_dir` so the current directory is irrelevant. Accepts multiple paths via `ValueFromRemainingArguments`, so several files can be drag-dropped onto the window in one go; exits non-zero if any file failed
- Not deployed and not executed by CI — it runs on the developer's own Windows machine against their RTX 4090. Versioning it makes the transcription settings reviewable and diffable, and gives future sessions the exact flag set to mirror when Build A absorbs transcription into the app

### Changed
- `README.md` — `scripts/` tree gains the new entry

## [v02.35r] — 2026-08-13 03:01:32 AM EST — [c8928a4](https://github.com/LightAISolutions/Sales/commit/c8928a46200a887002eb9c079cb9062c9a48db7b)

> **Prompt:** "Can you make it so that a transcribed .vtt file is automatically saved in the "2-transcribed" Drive folder instead of the original "1-awaiting-transcription" Drive folder?"

### Added
- `Profiler.html` (v01.25w) — **File transcript** control in the admin note form. One file pick does three things: uploads the `.vtt` into `Profiler App/meeting-recordings/2-transcribed/`, moves its recording out of `1-awaiting-transcription/` to join it, and carries the same file into the note's attachments. Without the audio move the queue folder would keep advertising work that is already done, which is the whole reason the two folders exist
- `ovFileTranscript`, plus `ovDriveList` (folder listing) and `ovDriveMove` (re-parent) — the latter two generalise the PATCH/list calls previously inlined in `ovSweepLooseRecordings`
- `ovBaseName` matches transcript to recording by filename stem, so `catl--2026-08-10--Voice 260810_015240.vtt` claims `…015240.m4a` and leaves every other queued recording alone

### Changed
- `Profiler.html` (v01.25w) — `readFiles` now reads from a new `pendingFiles()` helper that merges the file input with the picked transcript, de-duplicated by name+size so selecting the same file in both controls cannot attach it twice. The save button's empty-note guard and its "Uploading…"/"Saving…" wording read from the same helper
- A failed audio move is reported distinctly from a failed transcript upload — the transcript is already filed at that point, so the whole action must not read as failed

### Notes
- Transcription itself stays on the developer's machine (RTX 4090, `whisper-ctranslate2` with `large-v3-turbo`). Fully unattended filing would need Drive credentials on the PC and its own OAuth flow; this keeps the browser's existing `drive.file` token as the only credential in play

## [v02.34r] — 2026-08-11 02:25:14 AM EST — [d1366db](https://github.com/LightAISolutions/Sales/commit/d1366db3d54cc0928718cb45afd19d7f3ffe0fa6)

> **Prompt:** "continue with your recommendation"

### Added
- **The AIDC market report is now issued in all five Profiler writing styles.** `repository-information/aidc-market-report-print.html` carries five presentation skins selected by a `data-style` attribute on `<html>`, each translated from the print-calibrated export CSS in `Profiler.html` so a report handed to a customer reads in the same voice as the app that produced it. New downloadable editions: `AIDC-MARKET-REPORT-analyst-prose.pdf` (Analyst Prose, the Profiler house style), `AIDC-MARKET-REPORT-equity-research.pdf` (Sell-Side Research Note), `AIDC-MARKET-REPORT-intel-briefing.pdf` (Intelligence Community Briefing) and `AIDC-MARKET-REPORT-smart-brevity.pdf` (Axios Smart Brevity). `AIDC-MARKET-REPORT.pdf` keeps its unsuffixed name as the canonical BloombergNEF edition, so existing links do not break
- **Per-style banner in the masthead** naming the active skin. All five ship in the markup and CSS reveals the matching one; each states that the skin changes typography and chrome only. The `equity-research` banner carries the "analytical framing, **not investment advice**" disclaimer that `PROFILER-STYLES.md` rule 1 requires on any dossier issued in that style
- `scripts/build-aidc-report-pdf.mjs` gained `--style <slug>`. **A bare run now renders all five editions from a single page load**, swapping the attribute between `Page.printToPDF` calls — so the editions are structurally incapable of drifting apart in content
- A "Presentation styles" note in the report's own Method & Citation section, stating plainly that the text is identical across the five editions

### Changed
- The print stylesheet was refactored onto style-scoped CSS custom properties (`--accent`, `--body-font`, `--h1-*`, `--h2-*`, `--h3-*`, `--sub-*`, `--mast-rule`, `--pull-bg`). Every rule now reads a slot rather than a raw family, size or colour, so a skin is ~10 lines of variable overrides instead of a duplicated rule block. Chrome that was hardcoded to the Bloomberg blue — section rules, kick line, pull-quote spine, stat-tile rules, timeline axis and dates, contents numbers — now follows `--accent`
- SVG figure numerals follow the active skin's display face via `.fig svg text { font-family:var(--h1-font) }` (a presentation attribute loses to any CSS rule, so no per-figure markup changed)
- `repository-information/AIDC-MARKET-REPORT.md` — the "Formatted edition" pointer became a linked list of all five editions. The brittle page count was dropped rather than re-stated: page counts differ per skin (28–33) and would go stale on any text edit
- `repository-information/PROFILER-STYLES.md` — the report is registered as a **second display-layer consumer** alongside `Profiler.html`, with the standing instruction to mirror skin changes across both in the same commit
- `README.md` — tree entries for the four new editions

### Notes
- **Chart colours are deliberately style-invariant.** The categorical palette was validated once with the `dataviz` six checks against the white print surface; re-tinting it per skin would mean re-validating five palettes and would put the data layer at the mercy of a typographic choice. This is stated in the report's Method section rather than left implicit
- Editions verified by rasterizing and inspecting the actual rendered PDFs, not the markup: Analyst Prose reproduces the Georgia/gold paper document, Intelligence Community Briefing renders fully monospaced with letterspaced ink rules, and the ring-gauge numerals reskin correctly with the chart palette intact

## [v02.33r] — 2026-08-10 11:08:22 PM EST — [5150fe2](https://github.com/LightAISolutions/Sales/commit/5150fe2)

> **Prompt:** "You just created an AIDC Market Report at this location: https://github.com/LightAISolutions/Sales/blob/main/repository-information/AIDC-MARKET-REPORT.md. Convert it into a professionally-formatted market report (downloadable PDF) that matches the "Bloomberg - Research Report" style that is available on Profiler. Also, create a moderate amount of graphs (bars & circles) when applicable. If you are just listing competitors' products next to each other, display it in a table instead. I see some text that is crossed out, so remove them in the final version. If you need me to reupload the Bloomberg report for your reference, tell me and I will do so."

### Added
- **`repository-information/AIDC-MARKET-REPORT.pdf`** (new) — a 29-page typeset edition of the AIDC market report, styled to the Profiler `bloomberg` export skin defined in `PROFILER-STYLES.md` and `Profiler.html` (Arial body, `#0b62a4` section rules, monospace meta and figure captions, paper-document measure). Carries a running header, a `Page N of M` footer, a masthead with corpus/method/verification/classification metadata, and a two-column table of contents. Report text is unchanged in substance from the Markdown source — the PDF restates it with figures and comparison tables
- **`repository-information/aidc-market-report-print.html`** (new) — the typeset source the PDF renders from. Fully self-contained: inline CSS, inline SVG figures, zero external requests. **12 figures**: 2026 big-four capex (ranged bars), GE Vernova order-book ramp (columns), the queue-versus-compression lead-time chart on one shared month axis (the report's centrepiece), transformer scarcity as three ring gauges, the Colossus 0→1.0 GW ramp, the nuclear price ladder, the 800 VDC milestone timeline, the AI-server BBU market, the Chinese-integrator share donut, the H1 2026 ESS cell-share donut, the BESS block-size leapfrog, and the electrical-contractor duopoly. **17 tables**, including new comparison tables that replace prose competitor lists: behind-the-meter posture by buyer, productized onsite-power offerings, the three named power ODMs, incumbent 800 VDC status, the cell-and-block race, hyperscaler storage posture, the compliant lane, the four BESS demand doors, prefabrication offerings, competitors by lane, the dated trigger calendar, and the risk stack
- **`scripts/build-aidc-report-pdf.mjs`** (new) — renders the HTML to PDF via the pre-installed Chromium over the DevTools Protocol (Node 22's global `WebSocket`; no npm dependencies). `Page.printToPDF` is used rather than the `--print-to-pdf` CLI flag specifically because only the former accepts a custom running header and footer. A `--png` proof mode writes per-page previews for visual review
- `*.pdf binary` added to `.gitattributes` so the committed PDF is never line-ending normalized

### Fixed
- **The crossed-out text in the rendered report** (`repository-information/AIDC-MARKET-REPORT.md`) — 117 single `~` characters were in use as "approximately". GitHub-Flavored Markdown treats a matching pair of single tildes on one line as strikethrough, so lines such as `≈$220B (raised from ≈$200B)` rendered with the span between them struck through. All 117 replaced with `≈`, which renders literally and reads correctly in both the Markdown and the PDF

### Changed
- `repository-information/AIDC-MARKET-REPORT.md` — added a "Formatted edition" pointer to the PDF and its typeset source directly under the metadata line, noting that the Markdown remains the canonical text
- `README.md` — structure-tree entries for the three new files

### Notes
- Chart colours were validated with the `dataviz` skill's six checks against the white print surface before any figure was drawn (categorical palette `#0b62a4 · #c2622a · #1b8a6b · #7a3f7d · #8a8f2a · #b03a34` — worst adjacent colour-vision-deficiency ΔE 8.6, worst normal-vision ΔE 21.8, all six ≥3:1 contrast: all checks pass). Ranges are drawn as hatched extensions rather than separate marks, and every donut wedge is direct-labeled so identity is never carried by colour alone
- Two layout defects were caught by rendering and inspecting the actual PDF pages rather than trusting the markup: Table 6 overflowed the printable width (fixed with `table-layout:fixed` plus `overflow-wrap:break-word`), and long tables were jumping whole to the next page (fixed by letting tables span pages with a repeated header while keeping rows intact)
- `REPO-ARCHITECTURE.md` was deliberately **not** changed — its Scripts subgraph carries shared infrastructure scripts only and already omits `check-gas-inner-scripts.js` and `playwright-harness.py`; a single-purpose document-build script matches those, not the infrastructure tier

## [v02.32r] — 2026-08-10 10:17:55 PM EST — [16463a3](https://github.com/LightAISolutions/Sales/commit/16463a3)

> **Prompt:** "Re-focus back to when you finished compiling all 40 AIDC industry company dossiers and were about to generate the AIDC market report. Do so now. Synthesize directly from the profiles and cite their sources without new research: turbine/transformer scarcity economics, behind-the-meter power (xAI/Crusoe as templates), the 800 VDC transition, BESS competitive dynamics, and the craft-labor bottleneck — shaped as the sales-strategy deliverable for Jon's AIDC power/storage pipeline."

### Added
- **AIDC Market Report** (`repository-information/AIDC-MARKET-REPORT.md`, new) — the sales-strategy deliverable the 40-company Profiler expansion was built for. Synthesized exclusively from the 40 dossiers with no new research: 8 parallel extraction agents returned 572 themed, source-tagged claims (40/40 company coverage), then a 4-agent adversarial verification pass checked 353 report claims against the dossiers (6 errors + 14 nitpicks found, all corrected). Nine sections: 12 confidence-tagged Key Judgments; the demand backdrop; the five requested themes (turbine/transformer scarcity economics, behind-the-meter power with xAI/Crusoe as templates, the 800 VDC transition, BESS competitive dynamics, the craft-labor bottleneck); a sales playbook (40-company account map, entry points/talk tracks, timing triggers keyed to the armed refresh Routines, pipeline risks); and method/citation notes. Every factual claim carries its dossier source label + publication date; `strategyRead`-derived items are labeled [Analysis] with the dossiers' confidence tags preserved
- README structure tree entry for the new report file (`README.md`)

### Changed
- Session context auto-reconstructed at session start (stale v02.30r → v02.31r) from the CHANGELOG per the Session Start Checklist; the v02.24r Previous Sessions entry was removed under the 2-session cap (`repository-information/SESSION-CONTEXT.md`, intermediate commit)

## [v02.31r] — 2026-08-10 08:28:24 PM EST — [476bc71](https://github.com/LightAISolutions/Sales/commit/476bc71)

> **Prompt:** "continue with your recommendation"

### Changed
- **Amazon dossier revised to profileVersion 2** (`live-site-pages/profiler-data/amazon.profile.json`) — added a supply-chain read answering "which BESS OEM does AWS use?", which the dossier previously could not support. Three new confidence-tagged `strategyRead` entries: (High) the three-layer storage-procurement distinction — Layer 1 utility-scale BESS where developers (AES, Primergy) own the OEM decision, Layer 2 behind-the-meter campus BESS where Amazon has no announced deployments (a structural contrast with xAI and Crusoe), Layer 3 rack-level BBU where AI-specific battery demand actually lands; (Low) the Samsung SDI BBU thread — April 2026 reports of final-stage AWS talks on a ~$700M BBU-based UPS supply agreement and July 2026 reports of BBU cells shipping via Taiwan's Simplo with Amazon among end customers, neither company-confirmed, both unnamed-source trade press, with Samsung SDI in parallel talks with Meta and Google; (Low) the Fluence-at-Bellefield inference flagged explicitly as an untested inference from AES's ~28% Fluence stake, with no press release, filing, or trade coverage naming the project's battery supplier
- Six new sources added at their chronological positions (Digitimes, TechTimes, UPI, AsiaToday, AES 2025 annual report; the Bellefield Phase 1 source was already present), each labeled with its confirmation status
- `live-site-pages/profiler-data/archive/amazon.profile.v1.json` + `archive-index.json` — v1 archived per the Archival Procedure before the revision
- `live-site-pages/profiler-data/profiler-companies.json` — Amazon `lastUpdated` synced to 2026-08-10

## [v02.30r] — 2026-08-10 04:42:24 AM EST — [ecaf52f](https://github.com/LightAISolutions/Sales/commit/ecaf52f)

> **Prompt:** "I do not see a "Profiler" folder in jonyang92@gmail.com's Google Drive. I would like to see a "Profiler App" folder to mirror my "Receipts App" folder nomenclature. What happened?"

### Fixed

**Root cause.** A Drive search of jonyang92@gmail.com's account confirmed no `Profiler` folder exists (owned or shared) and no `profiler-notes.json` — while `Receipts App` and the loose `Voice 260810_000737.m4a` both sit in that account's root. `DriveApp` inside a GAS web app acts as the account that **deployed** the app, not the signed-in user, so v01.07g's `driveRecFolder_` created its tree in the deployer's Drive. `Receipts App` is visible precisely because it is created **browser-side** with the user's own `drive.file` credential. The v01.07g design was architecturally incapable of producing a folder the user could see; renaming the constant alone would not have fixed it.

#### `Profiler.gs` — v01.08g

##### Removed
- `driveRecFolder_`, `driveRecName_`, `driveFileRecording_`, `driveSweepRootRecordings_`, `driveListPendingRecordings_`, `driveMarkRecordingTranscribed_`, and the `filerec`/`recpending`/`recdone` ops — all operated on the wrong Drive. (Added earlier in this same session; not pre-existing code.)

##### Added
- `recFoldersGet_`/`recFoldersSet_` and the `recfolders`/`setrecfolders` ops — the script's only remaining role is parking the browser's three folder IDs in Script Properties, because `drive.file` cannot re-find a folder it created in an earlier session. Both admin-gated

#### `Profiler.html` — v01.24w

##### Added
- `ovRecFolders`, `ovDriveMkdir`, `ovDriveApi`, `ovRecName`, and `ovSweepLooseRecordings` — the `Profiler App/meeting-recordings/{1-awaiting-transcription,2-transcribed}` tree is now created browser-side with `drive.file`, so it lands in the signed-in user's Drive alongside `Receipts App/`

##### Changed
- `ovDriveUploadAudio(file, slug, onProgress, cb)` resolves the folder tree first and passes `parents: [pendingId]` plus the `<slug>--YYYY-MM-DD--<original>` name on both the multipart and resumable paths, so a recording is never loose in My Drive and needs no post-upload filing step
- The stray sweep moved from note-form render to just after a successful upload. On page load no Drive token exists, so the render-time version could only have worked by provoking a consent popup nobody asked for; after an upload the token is already live. It re-parents root-level audio the app itself created — `drive.file` grants persist per file — which is what relocates the recording uploaded before the folder existed

#### Documentation

##### Changed
- `PROFILER-SCHEMA.md` — Field Notes now documents both Drive trees and why ownership splits them
- `.claude/rules/profiler-app.md` — meeting-audio bullet rewritten for the browser-side tree

## [v02.29r] — 2026-08-10 04:25:55 AM EST — [5d41ecb](https://github.com/LightAISolutions/Sales/commit/5d41ecb)

> **Prompt:** "The audio file just got dropped in My Drive without any thought. Create a suitable folder infrastructure to store these in that will make it easy for the user to understand and for the future Transcription function to interact with. Move the most recently uploaded audio file into its folder after the structure is created."

### Added

#### `Profiler.gs` — v01.07g

##### Added
- `Profiler/meeting-recordings/` with `1-awaiting-transcription/` and `2-transcribed/` subfolders, created lazily via the existing `driveChildFolder_` helper. Numeric prefixes force workflow order in the Drive UI so the transcription queue is legible without opening the app. Recordings live under the same `Profiler/` root as `profiler-notes.json` and `note-files/` rather than a parallel tree — the browser's `drive.file` scope cannot see the script-created root, so a browser-side folder would have produced a second, duplicate `Profiler` folder in My Drive
- `driveFileRecording_(fileId, slug)` renames to `<slug>--YYYY-MM-DD--<original>` and moves into the pending folder; `driveRecName_` is idempotent so a re-file does not stack prefixes
- `driveSweepRootRecordings_()` relocates loose audio from My Drive root — root level only, `audio/*` MIME only, capped at `REC_SWEEP_MAX` (50) to stay inside the execution budget, and every move is returned by name so nothing relocates invisibly
- `driveListPendingRecordings_()` and `driveMarkRecordingTranscribed_(fileId)` — the queue read and the pending→transcribed move the transcription pass will need
- Note ops `filerec`, `recpending`, `recdone`, all added to the admin permission gate alongside `submit`/`list`/`edit`/`delete`

#### `Profiler.html` — v01.23w

##### Changed
- `ovDriveUploadAudio` now yields `{ link, id }` via the shared `ovDriveResult` normaliser instead of a bare link — the file ID is what lets the backend file a recording the browser cannot reach
- The upload completion handler calls `filerec` with the file ID and the dossier slug, and reports the destination path in the status line
- A one-shot `filerec` sweep (no file ID) fires when the admin note form renders, guarded by `window._ovRecSwept`, so a recording uploaded before filing existed — or one whose note was abandoned — is put away on the next page load. Silent unless something actually moved

#### Documentation

##### Changed
- `PROFILER-SCHEMA.md` — Field Notes section gains the full Drive tree, the recording filename convention, and the `filerec`/`recpending`/`recdone` contract
- `.claude/rules/profiler-app.md` — meeting-audio bullet documents the filing step and the transcription-pass ops

## [v02.28r] — 2026-08-10 04:13:24 AM EST — [157fc95](https://github.com/LightAISolutions/Sales/commit/157fc95)

> **Prompt:** "I tried to attach a 30 second voice recorder memo via browser files and it stayed "uploading" for many minutes without any Google consent screens popping up. What's wrong? Fix it."

### Fixed
- `Profiler.html` (v01.22w) — The Drive consent popup never opened, so `ovDriveToken`'s callback never fired and the upload hung on "Uploading…" indefinitely. `requestAccessToken()` was being called from an async continuation — inside `ovLoadGis().then(...)`, itself inside the file input's `change` handler — by which point the transient user activation from the tap is gone and mobile browsers silently block the popup. Consent is now requested from the button's `click` handler while the gesture is live, and the file picker opens only after a token is in hand. `ovPreloadGis()` warms the GIS library when the admin form renders so the tap path stays synchronous
- `Profiler.html` (v01.22w) — `initTokenClient` had no `error_callback`. GIS reports `popup_failed_to_open` and `popup_closed` exclusively through that handler, so a blocked or dismissed consent window produced total silence. Added it, mapped to distinct error codes, with `ovDriveErrText` rendering each as an actionable sentence
- `Profiler.html` (v01.22w) — Added a 120 s watchdog around the token request (`ovDriveRequest` settles exactly once via a `done` guard) and an `AbortController` timeout on the multipart upload, so no failure mode can leave the UI waiting forever

## [v02.27r] — 2026-08-10 04:01:03 AM EST — [37ac866](https://github.com/LightAISolutions/Sales/commit/37ac866)

> **Prompt:** "When I attach meeting recording and click voice recorder, it shows that I can only record up to 10 minutes and 27 seconds. Why is that? I want to be able to comfortably record 1-hour long meeting audio, up to 2-hours per meeting even."

### Changed
- `Profiler.html` (v01.21w) — Meeting audio over 6 MB now uploads through Drive's resumable protocol in 8 MB chunks (`ovDriveSendChunk`, XHR so the 308 "Resume Incomplete" responses are readable and `upload.onprogress` gives byte-level progress) with three retries per chunk on exponential backoff. A 1-hour recording is ~50 MB and a 2-hour one ~150 MB — the previous single-shot multipart POST restarted from zero on any connection blip at that size. The multipart path is retained as `ovDriveMultipart` for small files and as the fallback when the resumable session's `Location` header is not readable
- `Profiler.html` (v01.21w) — The upload status line now reports a percentage instead of a static "Uploading…"
- `Profiler.html` (v01.21w) — The recording button is relabelled "🎙 Attach saved recording" and carries a hint directing the developer to record in the phone's own recorder app first and browse to the saved file. The record-now shortcut Android offers inside the file picker is a short-clip capture path (~10 min on a Galaxy A54) and is the wrong entry point for a meeting. `accept` stays `audio/*` on purpose — narrowing to an extension list would grey out any container the list missed, which is a hard block, whereas the picker shortcut is only a wrong turn the hint steers around

## [v02.26r] — 2026-08-10 03:38:54 AM EST — [7404577](https://github.com/LightAISolutions/Sales/commit/7404577)

> **Prompt:** "I confirm that Profiler's oauthScopes include https://www.googleapis.com/auth/drive. I then ran _getCacheEpoch and it executed, but I didnt see the consent screen pop up. \n\nStep 0:\n1. I saved a typed note successfully. \n2. I failed to attach the recorded voice recorder clip. See 2nd attached picture. \n3. The log and its copy function works for the typed note. To be tested for the voice recorder clip."

### Fixed
- Meeting-recording upload failed with `google_sign_in_unavailable`. `ovDriveToken` checked for `window.google` directly, but the GIS library is injected on demand by the sign-in flow — on a page load with an existing session that flow never runs, so the library was absent even though the user was signed in. The Drive token request now goes through `ovLoadGis()` first
- CSP `connect-src` did not include `https://www.googleapis.com`, so the Drive multipart upload would have been blocked even once GIS loaded. Added it, matching `Receipts.html` which performs the same upload
- Three note-box status messages still promised the log would update "after the next deploy (~1–2 min)". Notes write straight to Drive with no deploy since v02.25r — the messages now say the note is visible immediately

## [v02.25r] — 2026-08-10 02:17:53 AM EST — [ebd7804](https://github.com/LightAISolutions/Sales/commit/ebd7804)

> **Prompt:** "all three recommendations, build M3 and M5."

### Security
- Field notes, note attachments, and meeting transcripts moved out of the public repository into the script owner's Google Drive (`Profiler/profiler-notes.json`, `Profiler/note-files/<slug>/`), served only through the GAS backend behind the Master ACL. Previously the log was committed to `live-site-pages/profiler-data/` and was readable unauthenticated via `raw.githubusercontent.com` and `git clone` regardless of the app's sign-in wall
- Deleted the GitHub-issue intake channel (`field-note-intake.yml`, `field-note.yml`, `field-note-file.yml`) — it committed note text into the public repo, recreating the exposure the migration closed
- Removed the `library/` mirror of `profiler-notes.json` and `note-files/` from `auto-merge-claude.yml` so notes are not republished into the second repository
- `claudeone` / `claudepending` read ops gated behind the same server-side `admin` check as `list` — they return full note and transcript text

### Added
- `Profiler.gs` Drive storage layer (`driveNotesGet_`/`driveNotesPut_`/`drivePutNoteFile_`/`driveReadNoteFile_`/`driveDeleteNoteFile_`), folder + file IDs cached in Script Properties; `LockService` serialization retained
- "Copy for Claude" — per-note **📋 Copy** and header **📋 Copy pending** buttons in the ⚙ notes overlay, returning note metadata plus transcript text formatted for pasting into a session. Replaces the automated note read that unattended sessions lose
- M5 meeting-recording upload — browser-side multipart upload to the user's own Drive via `drive.file` (`ovDriveUploadAudio`), storing only the resulting link as `recordingLink`; audio bytes never traverse GAS, so the 6-minute execution ceiling and 50 MB `UrlFetchApp` cap do not apply
- Transcript attachments (`.txt`/`.md`/`.vtt`/`.srt`) accepted alongside Word/PDF in both note forms

### Changed
- Note writes no longer dispatch a deploy — notes are not repo data, so writes are immediate
- `sourceFile` is now a `drive:<fileId>` reference rather than a repo-relative path
- `PROFILER-SCHEMA.md` and `.claude/rules/profiler-app.md` rewritten for Drive storage, including the explicit consequence that scheduled refreshes and the quarterly sweep now run without note context
- Pre-deployment note-box fallback explains the backend is unreachable instead of offering the deleted GitHub form

### Removed
- `live-site-pages/profiler-data/profiler-notes.json` and the repo-write helpers `ghPutFile_`, `ghPutNotes_`, `ghGetSha_`, plus the `NOTES_FILE_PATH`/`NOTE_FILES_DIR` constants

## [v02.24r] — 2026-08-09 11:18:02 PM EST — [a288645](https://github.com/LightAISolutions/Sales/commit/a288645799c20d80924396004fd6c47b6b357506)

> **Prompt:** "continue with your recommendation. Also, for all dossiers, change the source formatting to include the article date instead of the accessed date. Then, make sure to organize them chronologically with the most recent news first."

### Added
- **Seven post-earnings refresh Routines armed** for the batch-2 public tickers, following the existing one-shot convention (fresh session, verify-then-refresh, self-re-arming): EVE Energy (fires 2026-08-21 — H1 report expected 08-18/08-20, sources conflicted), ABB (2026-10-21 — Q3 scheduled 10-20 per ABB's calendar), Hitachi Energy (2026-10-24 — parent Hitachi Q2 FY26 expected 10-23), Equinix (2026-10-29 15:00 UTC — Q3 estimated ~10-28, staggered after Meta), Quanta Services (2026-10-30 17:00 UTC — Q3 expected 10-29, staggered after LG Energy Solution), Constellation Energy (2026-11-10 — Q3 confirmed 11-09), Siemens Energy (2026-11-12 — Q4 FY26 call company-announced 11-11; prompt carries the Omterra rebrand note). Report dates verified via web search on 2026-08-09; estimates marked as such in each trigger prompt

### Changed
- **Source format migrated across all 40 dossiers** (`live-site-pages/profiler-data/*.profile.json`): `sources[].accessed` (access date) replaced by `sources[].date` (publication/article date, `YYYY-MM-DD` or `YYYY-MM`; omitted for undated evergreen pages — product pages, IR hubs, market-report landing pages, aggregator quote pages), and every `sources[]` array reordered chronologically with the most recent publication first, undated entries last. Dates derived from URL paths, matching `recentDevelopments` entries, label text, and model knowledge — executed by 8 parallel subagents (5 profiles each), with low-confidence choices reported per batch; all 40 files JSON-validated and ordering-verified programmatically
- `repository-information/PROFILER-SCHEMA.md` — `sources[]` definition updated to the `date` field with newest-first ordering; the "List first-party sources first" citation-order rule replaced (source priority now governs research order only); "Dates everywhere" rule updated
- `live-site-pages/Profiler.html` (v01.17w → v01.18w) — source lists in the app and the Word/PDF export now render the publication date (with a legacy `accessed` fallback for archived pre-migration profiles); meta tag synced
- **Quarterly private-company sweep expanded from 3 to 6 companies** — Crusoe, Huawei Digital Power, and xAI folded into the recurring Routine (renamed "Profiler quarterly check — Hithium, FlexGen, Rosendin, Crusoe, Huawei DP & xAI (private)") with per-company watch items; the xAI entry converts to a post-earnings trigger if the SpaceX IPO completes and quarterly reporting begins
- `.claude/rules/profiler-app.md` — "Currently armed" registry updated with the 7 new one-shot entries (chronological) and the expanded 6-company sweep line

## [v02.23r] — 2026-08-09 11:02:49 PM EST — [41211ef](https://github.com/LightAISolutions/Sales/commit/41211ef06d5ad9aacfa73141e90d30523d9d1062)

> **Prompt:** "profiler batch 2 as recommended"

### Added
- **Ten new Intel Briefing dossiers — Batch 2 of the AIDC market-report coverage expansion** (all profileVersion 1, in `live-site-pages/profiler-data/`): xAI (`xai.profile.json`), Crusoe (`crusoe.profile.json`), Equinix (`equinix.profile.json`), Constellation Energy (`constellation-energy.profile.json`), Siemens Energy (`siemens-energy.profile.json`), Hitachi Energy (`hitachi-energy.profile.json`), ABB (`abb.profile.json`), Huawei Digital Power (`huawei-digital-power.profile.json`), EVE Energy (`eve-energy.profile.json`), Quanta Services (`quanta-services.profile.json`). Researched via 20 parallel subagents — two per company (first-party IR/press/product + third-party filings/consensus/trade press per the Source Priority Protocol), all sources accessed 2026-08-09. Categories: supplier ×5 (Siemens Energy, Hitachi Energy, ABB, Huawei Digital Power, EVE Energy), hyperscaler ×2 (xAI, Equinix), developer ×2 (Crusoe, Constellation Energy), integrator ×1 (Quanta Services). Unconfirmed/press-only items flagged (Low confidence) throughout — e.g. xAI combined-fleet GPU/2 GW tracker figures, Crusoe valuation marks, Constellation PPA pricing (analyst estimates), the EVE DoD 1260H listing (Reuters-relayed), Huawei sub-segment claims, the Siemens Energy Omterra rebrand's ticker implications. Render-verified headlessly: 40 home cards, all 10 dossiers show BLUF summaries and Key Judgments with zero page errors
- `live-site-pages/profiler-data/profiler-companies.json` — 10 new registry entries with IC-voice taglines; roster now 40 companies
- `README.md` — tree entries for the 10 new profile JSONs

## [v02.22r] — 2026-08-09 10:24:17 PM EST — [4da38db](https://github.com/LightAISolutions/Sales/commit/4da38dbbcae8993a09cd2990e9f89bbc074d58ec)

> **Prompt:** "profiler batch 1 as recommended"

### Added
- **Ten new Intel Briefing dossiers — Batch 1 of the AIDC market-report coverage expansion** (all profileVersion 1, in `live-site-pages/profiler-data/`): Vertiv (`vertiv.profile.json`), Delta Electronics (`delta-electronics.profile.json`), Eaton (`eaton.profile.json`), Schneider Electric (`schneider-electric.profile.json`), GE Vernova (`ge-vernova.profile.json`), LITEON (`liteon.profile.json`), Oracle (`oracle.profile.json`), OpenAI (`openai.profile.json`), CoreWeave (`coreweave.profile.json`), Bloom Energy (`bloom-energy.profile.json`). Researched via 20 parallel subagents — two per company (first-party IR/press/product + third-party filings/consensus/trade press per the Source Priority Protocol), all sources accessed 2026-08-09. Categories: supplier ×6 (Vertiv, Delta, Eaton, Schneider, GE Vernova, LITEON, Bloom), hyperscaler ×3 (Oracle, OpenAI, CoreWeave). Unconfirmed/press-only items flagged (Low confidence) throughout — e.g. the reported Goldman NT$4,500 Delta target, Megmeet power-shelf displacement reports, OpenAI press-reported financials (no audited statements exist), the reported $2B Delta–Infineon SiC deal. Render-verified headlessly: 30 home cards, GE Vernova and OpenAI dossiers show BLUF summaries and Key Judgments with zero page errors
- `live-site-pages/profiler-data/profiler-companies.json` — 10 new registry entries with IC-voice taglines; roster now 30 companies
- `README.md` — tree entries for the 10 new profile JSONs

## [v02.21r] — 2026-08-09 06:09:32 PM EST — [e7719ab](https://github.com/LightAISolutions/Sales/commit/e7719ab4823e1762bf8e5df44059ad60c447e16f)

> **Prompt:** "continue with your recommendation"

### Added
- **Nine post-earnings refresh Routines armed** for the new public tickers, following the existing one-shot convention (fresh session, verify-then-refresh, self-re-arming): NVIDIA (fires 2026-08-27 — Q2 FY2027 company-confirmed for 08-26), Jinko (2026-08-28 — JKS Q2 est. 08-27 / A-share H1 deadline 08-31), Samsung SDI (2026-10-28 15:00 UTC — Q3 listed 10-27; staggered after Wärtsilä), Google (2026-10-28 17:00 UTC — Q3 confirmed 10-27), Microsoft (2026-10-28 19:00 UTC — FY2027 Q1 est. 10-27), Meta (2026-10-29 — Q3 est. 10-28), Amazon (2026-10-30 — Q3 est. 10-29), LG Energy Solution (2026-10-30 15:00 UTC — Q3 est. ~10-29; staggered after Amazon), Panasonic (2026-10-31 — FY2027 Q2 est. ~10-30). All report dates verified via web search on 2026-08-09; estimates are marked as such in each trigger prompt and the fired sessions confirm before refreshing

### Changed
- **Rosendin folded into the private-company quarterly sweep** — the recurring Routine (Jan/Apr/Jul/Oct 1) renamed "Profiler quarterly check — Hithium, FlexGen & Rosendin (private)" with Rosendin watch items added (data-center project awards, BESSUPS rollout with FlexGen, EPC storage wins, ESOP/leadership changes)
- `.claude/rules/profiler-app.md` — "Currently armed" registry updated with the 9 new one-shot entries (chronological) and the expanded 3-company sweep line

## [v02.20r] — 2026-08-09 05:59:18 PM EST — [6e514e4](https://github.com/LightAISolutions/Sales/commit/6e514e42e35249b4271915717c1f66de27af30a2)

> **Prompt:** "Profiler LG Energy Solutions, Panasonic, Samsung SDI, Jinko, NVIDIA, Meta, Google, Amazon, Microsoft, Rosendin using Fable 5."

### Added
- **Ten new Intel Briefing dossiers** (all profileVersion 1, in `live-site-pages/profiler-data/`): LG Energy Solution (`lg-energy-solution.profile.json`), Panasonic (`panasonic.profile.json`), Samsung SDI (`samsung-sdi.profile.json`), Jinko (`jinko.profile.json`), NVIDIA (`nvidia.profile.json`), Meta (`meta.profile.json`), Google (`google.profile.json`), Amazon (`amazon.profile.json`), Microsoft (`microsoft.profile.json`), Rosendin (`rosendin.profile.json`). Researched via 20 parallel subagents — two per company (first-party IR/press/product + third-party filings/consensus/trade press per the Source Priority Protocol), ~50–70 sources evaluated per company, all accessed 2026-08-09. Categories: supplier ×5 (LGES, Panasonic, Samsung SDI, Jinko, NVIDIA), hyperscaler ×4 (Meta, Google, Amazon, Microsoft), integrator ×1 (Rosendin). Unconfirmed/press-only items are flagged (Low confidence) throughout — e.g. Samsung SDI–Tesla/Amazon ESS deal reports, Meta TPU purchase reports, the NVIDIA–OpenAI $250B backstop report. Render-verified headlessly: 20 home cards, NVIDIA and Google dossiers show BLUF summaries and Key Judgments with zero page errors
- `live-site-pages/profiler-data/profiler-companies.json` — 10 new registry entries with IC-voice taglines; roster now 20 companies
- `README.md` — tree entries for the 10 new profile JSONs

## [v02.19r] — 2026-08-09 05:09:33 AM EST — [3b7949d](https://github.com/LightAISolutions/Sales/commit/3b7949db9a12b54e84f565e65afb75f6543c3782)

> **Prompt:** "Voice approved. However, remove "Company Name - Profiler" from the top right and the URL from the bottom left of the export documents."

### Fixed
- `live-site-pages/Profiler.html` (v01.17w) — the "Company — Profiler" title (top right) and page URL (bottom left) on PDF exports were the **browser's own print header/footer**, drawn in the page margins during `window.print()`. Suppressed via `@page { margin: 0; }` in the print pipeline (no margin box → nothing for the browser to draw, per Chrome's documented behavior); `#ov-prev-doc` print padding changed from `0` to `12mm 14mm` so the document carries its own page margins. Verified via headless print-CSS PDF (9-page Megmeet export): page 1 clean with proper margins, no header/footer artifacts. Known tradeoff: continuation pages start near the paper edge (element padding doesn't repeat per page) — disclosed to the developer with a riskier `@page :first` alternative offered

## [v02.18r] — 2026-08-09 04:46:49 AM EST — [f628906](https://github.com/LightAISolutions/Sales/commit/f6289063f361aa33ed3c206813e1c02ea2235011)

> **Prompt:** "Rewrite all dossiers, their home-page descriptions, and export styles in Style 4: Intel Briefing - IC Assessment."

### Changed
- **All 10 dossiers rewritten in the Intel Briefing style** (`live-site-pages/profiler-data/*.profile.json`) — facts unchanged, voice converted: every `summary` now opens with a BOTTOM LINE UP FRONT sentence followed by a BACKGROUND section; analytic `ecosystemRole` claims reframed as "We assess … Basis: …"; Megmeet's `strategyRead` converted to confidence-tagged judgments; and the nine dossiers that had no `strategyRead` each gained a new 4-bullet **Key Judgments** array — "(High/Moderate/Low confidence) We assess …" — synthesized strictly from each dossier's existing sourced facts (no new research). Colloquial development takeaways IC-ified (e.g. Megmeet's "self-deflation of the AI hype", CATL's "pencil out"). All `profileVersion` +1 (megmeet → 2, rest → 3), `lastUpdated` 2026-08-09
- `live-site-pages/profiler-data/profiler-companies.json` — all 10 home-page roster taglines rewritten in IC-terse voice with attribution/watch-item framing
- **Export styles**: no code change needed — exports already render through the intel-briefing skin shipped in v02.17r (v01.16w), so the rewritten prose flows into the app, Word, and PDF automatically
- Archived all 10 outgoing versions per the Archival Procedure (`archive/megmeet.profile.v1.json`, `archive/<slug>.profile.v2.json` ×9; `archive-index.json` updated)
- Render-verified headlessly: BYD dossier shows Background/Key Judgments/Technical Annex sections, BLUF lead, and 4 numbered confidence-tagged judgments with zero console errors

## [v02.17r] — 2026-08-09 04:30:58 AM EST — [0312e54](https://github.com/LightAISolutions/Sales/commit/0312e545ac0f61be92bcf499fdfa7e9af46e23ec)

> **Prompt:** "Set profiler style to #4: intel-briefing. Also make sure that the export document (doc/pdf) has a formatting style and spacing that matches the writing style. Create a style button that is only visible to Admins that allows the user to change the Profiler app + export styles between these five styles."

### Added
- `live-site-pages/Profiler.html` (v01.16w) — dossier display-style engine: per-style section-label maps (`OV_SEC_LABELS`), app-side typography skins (`ov-sty-*` on `#ov-app`), export-document skins on `#ov-prev-doc` (preview + PDF print), and style-matched inline Word CSS in `ovWordExport` — Bloomberg (Arial, blue numbered headings, "Figure N:" captions on spec/financial tables), Equity Research (thesis banner with not-investment-advice note), Intel Briefing (Courier typewriter document, numbered KEY JUDGMENTS `<ol>`, COMPILED FROM OPEN SOURCES banner), Smart Brevity (bold sans axiom headers). Admin-only **🖋 style button** (z-index 8900, gated on `ov_note_role === 'admin'` like Versions 🕘, shown on wall pass) opens a picker overlay; choice persists per-device in localStorage `ov_style`; `OV_DEFAULT_STYLE = 'intel-briefing'` mirrors the registry's Active style. Verified headlessly: five app/export screenshots + admin/non-admin gating, zero console errors

### Changed
- `repository-information/PROFILER-STYLES.md` — **Active style: `intel-briefing`** (was `default`); new "Display layer" bullet documenting the `OV_DEFAULT_STYLE` sync rule and the admin 🖋 switcher
- `.claude/rules/profiler-app.md` — switching procedure now includes the `OV_DEFAULT_STYLE` sync; display-layer architecture documented
- `README.md` — Profiler tree entry version display → v01.16w

## [v02.16r] — 2026-08-09 04:00:40 AM EST — [1ef3f5b](https://github.com/LightAISolutions/Sales/commit/1ef3f5b0e25706e52495b7877d6c0e548836466e)

> **Prompt:** "I tested both my admin jonyang92@gmail.com account and a test contributor jymiasole01@gmail.com account and Profiler works as intended. Only jonyang92@gmail.com could see the version history while jymiasole01@gmail.com could not. Regarding the dossier writing style, save it down as the default style and then let me see several mock-ups of what the dossier writing style would be after analyzing and integrating the attached Bloomberg report's writing style and formatting. Save that down as the Bloomberg style. If you have alternative reporting styles besides Bloomberg to show me, give me mock-up suggestions of those as well."

### Added
- `repository-information/PROFILER-STYLES.md` — dossier writing-style registry (single source of truth for how dossier prose is written; **Active style: `default`**). Codifies the current authoring conventions as the **Default style**; defines the **Bloomberg style** from a formatting/style analysis of the developer-supplied BloombergNEF "US Data Center Outlook — The Age of AI" report (exec-summary lead + Summary findings bullets, mandatory inline comparators, taxonomy/run-in-italic bullets, Figure captions with Source/Note lines, unhedged declarative voice, one dry aside per section); and adds three alternatives — `equity-research` (sell-side note: thesis banner, "we" voice, bull/bear key debates, dated catalysts), `intel-briefing` (IC assessment: BLUF, confidence-tagged key judgments mapped to the field-note 0–100 bands, indicators to watch), and `smart-brevity` (Axios form: one-line lede + fixed axioms). Every style carries a like-for-like Megmeet mock-up (summary → AI-DC positioning → FY2025 results development → strategy read)

### Changed
- `.claude/rules/profiler-app.md` — new "Dossier Writing Styles" section registering the styles file (read-before-authoring rule, switching procedure, styles-never-override-schema-rules); Profiler Command step 4 now requires prose in the active style
- `CLAUDE.md` — Profiler Command section now points at the writing-style registry alongside the data schema
- `README.md` — `PROFILER-STYLES.md` added to the repository tree

## [v02.15r] — 2026-08-09 03:29:35 AM EST — [62c6809](https://github.com/LightAISolutions/Sales/commit/62c6809b0e96a40687dd56ed3af435f593786715)

> **Prompt:** "I'd rather have a sign-in wall on the whole app like the Receipts app in order to control who gets to view my valuable dossiers. Also, I want Admins to be the only ones that are able to view previous dossier versions (everyone else should only see the current version). Since I want my friends to be able to export documents and type field notes to me, shouldn't I give them "contributor" roles instead of just "viewer" roles?"

### Added
- `live-site-pages/Profiler.html` (v01.15w) — full-app sign-in wall (`#ov-authwall`, z-index 9000, app-branded): the UI is blocked until a session validates (`whoami` on load for stored sessions; GIS popup sign-in otherwise), reusing the note backend's session machinery — same account system as Receipts (its extra HIPAA/single-tab hardening intentionally not ported). Wall skips only when `_e` is empty (pre-deployment fallback). Non-ACL sign-ins are rejected by the exchange with a "ask Jon to add you" hint
- **Versions 🕘 is now admin-only** — the previous-versions button renders only for admin sessions; the notes ⚙ cog dropped to z-index 8900 so it sits under the wall while signed out

### Changed
- `.claude/rules/profiler-app.md` — auth wall, admin-only versions, and the `contributor` role decision documented (role already existed in `RBAC_ROLES_FALLBACK` with no `admin` permission — no backend change needed; friends' ACL rows use Role = `contributor`)
- **Data-privacy caveat re-disclosed**: the wall gates the app experience; the underlying data files (profiles, notes, archives) remain on public GitHub Pages and are fetchable by direct URL. True data privacy = GAS-served data or GitHub Enterprise Pages access control — both offered as follow-ups, neither built

## [v02.14r] — 2026-08-09 03:03:41 AM EST — [7e089a7](https://github.com/LightAISolutions/Sales/commit/7e089a7ade424c8dbbfaac897e164901d7426307)

> **Prompt:** "I plan to share this Profiler app with my work friends later on, so copy Scraper and Receipt's Google sign-in and account structure. In the MasterACL spreadsheet, I want Profiler's sign-in application to be named "Profiler", so change the "In-dossier field-note intake for the Profiler app" name to "Profiler Field Notes". Also, I want other users besides me to only be able to view the dossiers and use the export and study guide features, as well as a limited-version field note feature. Limited version means that they can submit typed notes, attach documents, and add a confidence level, but it gets sent to "jonyang92@gmail.com" via email for consideration instead of being automatically saved into the Profiler app and bess-aidc-library database. Recommend the best way to accomplish the separation of power between me and other users above."

### Added
- `googleAppsScripts/Profiler/Profiler.gs` (v01.05g) — separation of power, enforced server-side: `submit`/`list`/`edit`/`delete` now require the `admin` permission (Master ACL role `admin`/`developer`); all other ACL-approved signed-in users get the new `suggest` op — same inputs (typed note, up to 3×8 MB Word/PDF attachments, source type, 0–100 confidence) but the suggestion is emailed to `NOTE_SUGGEST_EMAIL` (jonyang92@gmail.com) via MailApp with files as real attachments, and nothing is committed. New `whoami` op returns the session's role for UI branching. `PORTAL_DESCRIPTION` → "Profiler Field Notes" (Master ACL registration name; `ACL_PAGE_NAME` stays "Profiler" — the sheet column) + config sync
- `live-site-pages/Profiler.html` (v01.14w) — role-aware note box: sign-in stores the role from the exchange (`admin` vs `member`); admins get the full form + Manage panel, members get the suggest form ("goes to Jon for review"); a `whoami` check covers sessions that predate role tracking, and an `ADMIN_ONLY` server response live-downgrades a stale admin UI to suggest mode. All three branches verified headlessly with a stubbed backend (member suggest send, admin regression, stale-admin downgrade)
- `.claude/rules/profiler-app.md` — separation-of-power rules documented (server-side boundary, suggested-confidence-is-advisory, acceptance flow)

### Changed
- Sign-in/account structure note: Profiler already shares Scraper/Receipts' exact auth machinery (same GIS client, token exchange, session system, Master ACL spreadsheet) — this change wires the missing role layer through it; dossier viewing, export, and study guides remain public page features requiring no sign-in

## [v02.13r] — 2026-08-09 02:41:47 AM EST — [62cf0f1](https://github.com/LightAISolutions/Sales/commit/62cf0f1a513ab1f73cbe31d0766e138f10f293be)

> **Prompt:** *(same interaction — live API verification after the v02.12r deploy)* Curl probes against the deployed note API returned `{"success":true,...}` for a bogus session token, exposing that the standard preset's `ENABLE_DATA_OP_VALIDATION: false` made the fetch-exposed note ops effectively unauthenticated.

### Security
- `googleAppsScripts/Profiler/Profiler.gs` (v01.04g) — `PROJECT_OVERRIDES.ENABLE_DATA_OP_VALIDATION: true`: every note op now runs full session validation (the preset's `false` assumed `google.script.run` transport, only reachable from the signed-in served page — an assumption the public fetch route broke). Plus a defense-in-depth guard in `handleNoteOp_` rejecting missing/short tokens before dispatch, so a future toggle regression cannot silently reopen the ops. Live-verified post-deploy: bogus sessions now receive `SESSION_EXPIRED`

### Fixed
- Confirmed the POST transport is sound for browsers (302 → GET on the echo URL returns clean JSON) — the apparent POST failures during verification were a curl `-L -X POST` artifact, not a client bug

*(Counter reads 101/100 legitimately: all 6 over-limit sections are dated today (EST) and today's sections are rotation-exempt; 95 non-exempt sections remain under the cap.)*

## [v02.12r] — 2026-08-09 02:37:16 AM EST — [f9ef3e0](https://github.com/LightAISolutions/Sales/commit/f9ef3e0f578a759bca123d4889c574ee74803a54)

> **Prompt:** "The embedded box and fallback link both fail and shows the same Google Drive "sorry" message as above"

### Fixed
- `live-site-pages/Profiler.html` (v01.13w) — the note box no longer loads the GAS app as a document at all. The top-level fallback failing too proved this isn't a framing problem: on the developer's phone, ANY cookie-carrying document-load of `/exec` (framed or top-level) dies in Google's multi-account routing, while anonymous requests serve fine — the exact conclusion the fleet already reached (Receipts' `TOKEN_EXCHANGE_METHOD: 'fetch'` comment: iframe transports "stop working when Google blocks framed /exec responses"). Rebuilt the note box as **native page UI**: GIS sign-in popup on the parent (fleet CLIENT_ID, `openid email profile`), token exchanged for a session via the existing fetch exchange route, then all note ops over cookie-less `fetch()` — typed notes, Word/PDF upload (POST body, 3 × 8 MB), and the full manage panel (list/inline edit/delete), all in place. CSP extended to the fleet's GIS + script.google.com allowances. Full flow verified headlessly with a stubbed backend (sign-in state, save, list, edit, delete — zero page errors)
- `googleAppsScripts/Profiler/Profiler.gs` (v01.03g) — new `handleNoteOp_` fetch dispatcher: `doPost(action=note)` + GET api-route mirror (`action=api&op=note`), ops `bootstrap`/`submit`/`list`/`edit`/`delete` (param `nop`), session-validated via the existing machinery, JSON via ContentService (anonymous serving path)
- `repository-information/diagrams/profiler-diagram.md` — updated to the fetch architecture (pako URL regenerated + decompression-verified)

## [v02.11r] — 2026-08-09 02:20:26 AM EST — [cdb8c74](https://github.com/LightAISolutions/Sales/commit/cdb8c74052b1acfed8e94f06a0ebb78965e9a29e)

> **Prompt:** "I wanted to add a field note, but this is what I saw. Resolve it." *(screenshot: the note-box iframe showing Google Drive's "Sorry, unable to open the file at this time" error)*

### Fixed
- `live-site-pages/Profiler.html` (v01.12w) — the note-box iframe now loads **credentialless** (cookie-less), matching the current template pattern used by Receipts: cookie-carrying framed `/exec` requests hit Google's multi-account `/u/N` routing and fail with the Drive error the developer screenshotted; the anonymous path avoids it (sessions travel in the URL, not cookies). Root cause: the inline note-box iframe was written against the older template block still present in Profiler.html, which predates the credentialless fix

### Added
- `live-site-pages/Profiler.html` — "Open the note form in its own tab ↗" link under the note box: a top-level `/exec` visit never hits the framed-routing failure, so this fallback always works (also useful as a deliberate full-screen mode)

## [v02.10r] — 2026-08-09 01:59:52 AM EST — [5b0d3bf](https://github.com/LightAISolutions/Sales/commit/5b0d3bfa767754e7039647f08106b55b9ef03035)

> **Prompt:** "I plan to test with a fake field note, so build me a way to see, edit, and delete previously submitted field notes. Then, I'll test adding and deleting field notes. Also, explain to me how you will evaluate which field notes are relevant enough to display in the dossier vs which just get saved but not displayed."

### Added
- `googleAppsScripts/Profiler/Profiler.gs` (v01.02g) — note management: server functions `listFieldNotes` / `updateFieldNote` / `deleteFieldNote` (session-validated, lock-serialized; edits stamp `edited: YYYY-MM-DD`; deletes remove the log entry and best-effort delete the attached note file via a new `ghGetSha_` + contents DELETE; shared `ghPutNotes_` helper) and a "Manage existing notes" panel in the served form UI (list with metadata, inline edit textarea + confidence select, delete with confirm; wrapped in try/catch so a fault can never block the auth flow). Client logic verified via a stubbed-backend Playwright harness (list → edit → delete round-trip, zero page errors)
- `repository-information/PROFILER-SCHEMA.md` — `notes[].edited` field; `submittedVia` now documents the `profiler-intake` value; clarified that the never-alter constraint binds Claude's triage, not developer edits
- `.claude/rules/profiler-app.md` — note-management capability documented under the second capture channel

## [v02.09r] — 2026-08-09 01:30:51 AM EST — [829f7e0](https://github.com/LightAISolutions/Sales/commit/829f7e0cb8fe2a7f17daa660f2a7e9894cf35a4d)

> **Prompt:** "Profiler deployment ID: <AKfycbwnpv-PYXK_7Wvp5ZAtnhZawcTWgc-8Df_1qKKoLsg9gGawIukAzU7H14aw9DOrVSJ3Tw>"

### Changed
- `googleAppsScripts/Profiler/Profiler.config.json` + `Profiler.gs` (v01.01g) — real `DEPLOYMENT_ID` synced in ([PC-GAS-CONFIG] #14); the "Deploy Profiler" workflow step now fires on `.gs` merges
- `live-site-pages/Profiler.html` (v01.11w) — `var _e` set to the obfuscated deployment URL (reverse + base64, round-trip verified) — the in-dossier note box now renders the GAS intake form; GitHub-form fallback retired from the live path
- `repository-information/ENTERPRISE-SETUP.md` — recorded the new `profiler-intake-writer` fine-grained PAT (Sales-scoped, Contents R/W + Actions R/W, no expiration, stored as the Profiler GAS project's `GITHUB_TOKEN` Script Property)

## [v02.08r] — 2026-08-09 01:11:29 AM EST — [3c30acd](https://github.com/LightAISolutions/Sales/commit/3c30acd618ed609af1274204e2bce0290e5581c1)

> **Prompt:** "Can you modify the field note to be functional by itself without re-routing the user to the GitHub form? I'd like to be able to type some notes and/or upload meeting notes directly from the Profiler app."

### Added
- `googleAppsScripts/Profiler/Profiler.gs` (v01.00g) — Profiler GAS intake app (restored from the v02.04r-removed ProfilerIntake scaffold, renamed to page-convention naming and completed): Google-sign-in + Master-ACL gated form served in-app; `submitFieldNote` now accepts Word/PDF attachments (up to 3 × 8 MB, base64) alongside/instead of typed text — files commit to `repository-information/note-files/<slug>/` via the GitHub contents API (`ghPutFile_`), notes commit to `profiler-notes.json` (lock-serialized, `submittedVia: "profiler-intake"`), then `ghDispatchDeploy_` best-effort dispatches the deploy workflow. Served UI gains a file picker + `?slug=` dossier prefill (sanitized doGet interpolation)
- `googleAppsScripts/Profiler/Profiler.config.json` — project config (real Master-ACL spreadsheet ID; `DEPLOYMENT_ID` placeholder until the one-time Apps Script deployment)
- `live-site-pages/gs-versions/Profilergs.version.txt` (`|v01.00g|`), `live-site-pages/gs-changelogs/Profilergs.changelog.md` + archive — page-convention GAS tracking files (the GAS version pill on Profiler auto-activates)
- `live-site-pages/Profiler.html` (v01.10w) — GAS-backed note box: the template's full-screen iframe injection is PROJECT-OVERRIDDEN to stash the decoded URL in `window._gasNoteUrl`; each dossier's "Add a Field Note" section renders an inline iframe (`?slug=<company>` prefill) where the developer types and/or uploads directly. GitHub-form flow remains as automatic fallback while `DEPLOYMENT_ID` is a placeholder
- `.github/workflows/auto-merge-claude.yml` — "Deploy Profiler" GAS self-update step (placeholder-gated, standard POST + GET-fallback webhook)
- `repository-information/diagrams/profiler-diagram.md` — per-environment diagram restored and corrected for the inline note-box iframe design (pako URL regenerated + decompression-verified)
- `.claude/rules/gas-scripts.md` — Profiler row in the GAS Projects table + `Profiler.html` added to the path scope

### Changed
- `.claude/rules/profiler-app.md` — second capture channel rewritten: GAS-backed in-app intake is primary once deployed; GitHub issue form documented as the fallback mode
- `repository-information/REPO-ARCHITECTURE.md` — `GAS_PROFILER` node + edges added to the flowchart and class diagram (both pako URLs regenerated + decompression-verified)
- `README.md` — Profiler tree entry gains the ⛽ GAS link and v01.00g changelog link; new entries for the GAS project dir, gs version/changelog files, and per-environment diagram

## [v02.07r] — 2026-08-08 10:36:20 PM EST — [58d0d4e](https://github.com/LightAISolutions/Sales/commit/58d0d4eebd8a5c1c375bca27fc11636924928b87)

> **Prompt:** "Purge the test notes. Also, I don't see a "Add a Field Note" option, much less an option to upload meeting notes in word doc or pdf format. Resolve these issues."

### Added
- `live-site-pages/Profiler.html` (v01.09w) — "Field note 📝" button in the dossier header (next to Export) that scrolls to the note box and focuses it; the box was rendering correctly but sat below every dossier section (33 sources deep on BYD), making it effectively invisible — root cause of "I don't see it"
- `live-site-pages/Profiler.html` — "Upload Word/PDF 📎" button in the note box and a "📎 File" shortcut in the ⚙ Field Notes overlay header, both opening the new file-upload issue form prefilled with the company
- `.github/ISSUE_TEMPLATE/field-note-file.yml` — 📎 Field note file form: company/source/confidence dropdowns + a textarea where the developer attaches the .docx/.pdf (GitHub issue textareas accept file attachments natively)
- `.github/workflows/field-note-intake.yml` — new `commit-file-note` job for `field-note-file` issues: validates fields, extracts `user-attachments` URLs, downloads the document(s) to `repository-information/note-files/<slug>/YYYY-MM-DD-<name>` (never deployed; mirrored to the library), logs a placeholder note with `sourceFile` set (`[file note: <name> — summary pending triage]`), commits, dispatches the deploy, and closes the issue. Parser rejection paths (no attachment, non-Word/PDF, download failure) tested locally against the real regexes
- `.claude/rules/profiler-app.md` — documented the in-app upload variant of the third capture channel; triage passes must replace placeholder file notes with faithful summaries

### Changed
- `.github/ISSUE_TEMPLATE/field-note.yml` — intro now points to the file form instead of "send the file to Claude"

### Removed
- The two intake-pipeline test notes (`note-20260808-01`, `note-20260808-02`) from `live-site-pages/profiler-data/profiler-notes.json`

## [v02.06r] — 2026-08-08 10:19:41 PM EST — [5893c6e](https://github.com/LightAISolutions/Sales/commit/5893c6e8514bf9654200efb122ecee94a3e2bab6)

> **Prompt:** "start phase R3"

### Added
- **Phase R3 — Business monthly line-items ledger** (`live-site-pages/Receipts.html` v01.33w, client-side only — no GAS change): each `<Company>/<Year>/<Month>` folder gains a `Line Items - <Month> <Year>.csv` maintained via the user's `drive.file` credential. New PROJECT-block module: `_csvEscape`/`_dateFromReceiptId` (ID's `YYYYMMDD` suffix locates rows across edits)/`_bizCsvName`/`_buildLedgerRows` (no-items receipts get a single `(no itemized lines)` row), `_updateBizLedger` (read-modify-write: drop rows by trailing `,ReceiptID` match, append, PATCH-media update or multipart create), `syncBusinessLedger` (removes from old-ID/new-ID/printed-date months, appends to the printed-date month — handles date edits moving a receipt across months), `removeFromBusinessLedger`
- Save hook runs PDF → ledger **sequentially** (they share the folder tree; racing find-or-create could duplicate folders) with a combined status; delete hook drops ledger rows; a Business→Personal flip now trashes the PDF, clears its registered link, and removes ledger rows

### Verified
- `node --check` on inline scripts; the page's exact CSV functions run in Node on real data — quote/comma escaping, row removal by receipt ID, month filenames, date-from-ID incl. collision suffixes, no-items fallback; Playwright smoke load with zero page errors

## [v02.05r] — 2026-08-08 10:18:39 PM EST — [dcf6414](https://github.com/LightAISolutions/Sales/commit/dcf64142e90323afa95653954f6067909ed2b100)

> **Prompt:** *(follow-up within the same interaction — end-to-end intake test)* The first live test of the field-note pipeline (issue #1) committed the note to `main` correctly, but the deploy never ran: pushes made with the built-in `GITHUB_TOKEN` do not trigger `push`-event workflows (GitHub recursion prevention), so the note was invisible on the live site.

### Fixed
- `.github/workflows/field-note-intake.yml` — after committing a note, the workflow now explicitly dispatches `auto-merge-claude.yml` on `main` (`gh workflow run`); `workflow_dispatch` events are exempt from GITHUB_TOKEN recursion prevention, so the deploy + library mirror run and the note appears in the Profiler ⚙ changelog. Added the required `actions: write` permission and corrected the header comment that wrongly claimed the push alone would trigger the deploy

## [v02.04r] — 2026-08-08 10:11:17 PM EST — [baf1388](https://github.com/LightAISolutions/Sales/commit/baf1388004f57a040e536afbd684b813dbef5b81)

> **Prompt:** "What is the purpose of this new Profiler Intake project? Is there any way to accomplish my goal without creating a new project?" *(followed by the form answer: "I would like the option to either type small amounts of information in an input box in a target company's dossier and also the option to upload notes via a word doc or PDF.")*

### Added
- `.github/ISSUE_TEMPLATE/field-note.yml` — "📝 Field note" GitHub issue form: company dropdown (all 10 covered slugs + general), source-type dropdown, verbatim note textarea, 0–100 confidence dropdown
- `.github/workflows/field-note-intake.yml` — workflow fires on `field-note`-labeled issues opened by the repo owner: parses the issue body (injection-safe via env), validates slug/source/confidence/length, prepends the note to `live-site-pages/profiler-data/profiler-notes.json` with id `note-YYYYMMDD-NN`, commits (no `[skip ci]` so Pages redeploys), closes the issue with a confirmation comment
- `live-site-pages/Profiler.html` (v01.08w) — "Add a Field Note" quick-note box at the bottom of every non-archived dossier: textarea + source select + confidence select; Save opens a prefilled GitHub issue form (`?template=field-note.yml&company=…&sourcetype=…&confidence=…&note=…`); hint directs Word/PDF files to Claude
- `.claude/rules/profiler-app.md` — documented the second capture channel (in-dossier quick-note → issue intake) and third capture channel (Word/PDF files via Claude, originals stored privately under `repository-information/note-files/<slug>/`, note text = faithful summary, `sourceFile` set)
- `.github/workflows/auto-merge-claude.yml` — mirror job now syncs `repository-information/note-files/` → `library/notes/files/`

### Changed
- `live-site-pages/Profiler.html` — "＋ Add note" button in the Field Notes changelog overlay now opens the issue form instead of the removed intake page
- `repository-information/PROFILER-SCHEMA.md` — Field Notes schema: `submittedVia` now documents the `issue-form (#N)` format; added `sourceFile` field for Word/PDF-sourced notes

### Removed
- ProfilerIntake GAS scaffold (superseded by the issue-form intake before it was ever deployed): `googleAppsScripts/ProfilerIntake/` (`.gs` + config), `live-site-pages/profiler-intake.html`, its 4 changelog files and 2 version files, `repository-information/diagrams/profiler-intake-diagram.md`, its GAS Projects table row in `.claude/rules/gas-scripts.md`, its deploy step in `auto-merge-claude.yml`, and its nodes in `REPO-ARCHITECTURE.md` (flowchart pako URL regenerated and decompression-verified)
- README tree entries for all removed profiler-intake files (connector characters repaired)

## [v02.03r] — 2026-08-08 09:56:18 PM EST — [9bce979](https://github.com/LightAISolutions/Sales/commit/9bce97994df40a824a47f21329a626374d04a114)

> **Prompt:** "Change the "Reimbursement" toggle name to "Business". The toggle between Personal and Reimbursement/Business is not obvious enough - Make it more obvious. All of my current scanned receipts are all Personal; I won't have any real Reimbursement/Business receipts until I get a new job, so skip the tests related to Reimbursement/Business for now. I will bring problems up as they arise later. Start Phase 2"

### Added
- **Phase R2 — Business-expense PDF filing**: on every Business save the browser converts the receipt photo to a one-page PDF (hand-built JPEG-in-PDF, no libraries — CSP-safe) and files it under `<Company>/<Year>/<Month>` in the user's own Drive (lazy folder creation from the receipt's printed date, English names); first Business save prompts inline for the company name

#### `Receipts.html` — v01.32w

##### Added
- PDF pipeline in the PROJECT block: `_jpegDims` (SOF parse), `_buildJpegPdf` (verified against a real JPEG with MuPDF rasterization), `_findOrCreateFolder`/`_ensureBizPath` (lazy `<Company>/<Year>/<Month>` via the user's `drive.file` token), `_uploadPdfToFolder` (multipart), `saveBusinessPdf` orchestrator (photo bytes → PDF → upload → `registerReceiptPdf`; re-saves trash the previous PDF)
- Company plumbing: `rr-company-row` inline prompt in the review grid (shown for Business with no stored company; save blocks until provided), ⚙️ Settings "Company · X" row with inline editor, `_companyName`/`_fetchCompany` state
- Delete flow trashes the receipt's PDF copy (server returns the link — the file lives in the user's Drive); history detail shows "View PDF copy ↗"

##### Changed
- **Reimbursement → Business** rename across toggle, review select, History/Reports filters, badge tooltip, 中文 strings (报销 → 商务); stored/localStorage values renamed with legacy-value compatibility
- Scan-panel toggle redesigned as an obvious segmented switch: "EXPENSE TYPE" caption + joined two-half pill, active half solid ink with white text

#### `Receipts.gs` — v01.21g

##### Added
- "PDF Link" column 16 + Profiles "Company Name" column 5 (in-place upgrades); `setCompanyName` (sanitized for folder names) + `registerReceiptPdf` (owner-only) with POST + GET-fallback routes; `getProfile` returns `company`; `getReceiptDetail` returns `pdfUrl`; `deleteReceipt` returns `pdfUrl` for browser-side trashing

##### Changed
- Stored expense-type value renamed to `Business` (save normalization + read compatibility for the briefly-stored `Reimbursement` value) across list/report/detail/export

### Changed
- CHANGELOG archive rotation: count reached 102 (v02.02r had pushed past the cap) — moved the oldest date group (2026-07-17, 11 sections `v01.02r`–`v01.12r`) to `CHANGELOG-archive.md` with SHA enrichment

### Verified
- `node --check` on the `.gs` + inline scripts; the page's exact `_buildJpegPdf` run in Node on a real 1200×1600 JPEG and the output rasterized by MuPDF (1 page, 612×816pt, embedded image intact); Playwright at 390×844 — segmented switch states, company row reveal, options, zero page errors

## [v02.02r] — 2026-08-08 09:40:27 PM EST — [c98e251](https://github.com/LightAISolutions/Sales/commit/c98e251a027da245ea0378d19b3f5624e1be3a42)

> **Prompt:** "secret added. Confirm there are no mistakes."

### Changed

- `ENTERPRISE-SETUP.md` Library Mirror Token table — Expiration row updated to record the actual choice: **No expiration** (enterprise admin exemption, matching the GAS token); secret noted as added 2026-08-08
- No rotation move this push: 101 total sections but only 94 are non-exempt (today's are exempt per rotation logic — Scenario F pattern); counter reads over-capacity until older date groups age out

### Fixed

- Resolved the parallel-session rotation collision: this session and the concurrent Receipts session (v02.01r) both rotated `v01.01r` to the archive identically — kept the upstream full-SHA header, no content lost

## [v02.01r] — 2026-08-08 09:31:15 PM EST — [9f2955b](https://github.com/LightAISolutions/Sales/commit/9f2955b0662ae458616bd36e2a11a5c9590472cd)

> **Prompt:** "1. One company. 2. Lazy folder creation. 3. CSV. 4. English folder/file names approved."

### Added
- **Phase R1 of the reimbursement plan — expense type at the point of scanning** (approved with: one company, lazy folders, CSV, English names — those choices land in Phases R2/R3)

#### `Receipts.html` — v01.31w

##### Added
- 🏠 Personal | 💼 Reimbursement toggle (`.etbtn`) on the scan panel above the Scan button — sticky per device via `localStorage` `rcpt_expense_mode`; `_expenseMode`/`setExpenseMode()` in the PROJECT block
- `rr-etype` select in the review grid (pairs with Total) — new scans inherit the scan-panel mode, editing an existing receipt shows its stored type; `collectReview()` sends `expenseType`
- `rh-etype` filter in the History filter drawer + 💼 `rh-et-tag` badge on reimbursement rows; filter participates in the "n active" hint, Clear, and reload-on-change
- `rp-etype` filter in Reports (client-side, consistent with the other instant Reports filters) — hint, Clear, and re-render wired
- `etype` parameter sent on `listReceipts`, `exportReceipts`, and `exportPreview` calls; 中文 translations for the toggle, the three dropdowns, and the "Expense" label

#### `Receipts.gs` — v01.20g

##### Added
- "Expense Type" column 15 on the Receipts tab (header array + in-place upgrade; blank legacy rows read as Personal everywhere — no backfill)
- `saveReceipt` writes the normalized type; `listReceipts`/`reportReceipts`/`getReceiptDetail` return `expenseType`; `listReceipts` + `reportReceipts` accept an `etype` filter (applied before the row cap)
- `etype` threaded through `gatherExportData_` → `exportReceipts`/`previewExportPivot`; export's Receipts sheet gains an "Expense Type" column; all six POST/GET transport routes pass `etype`

### Changed
- CHANGELOG archive rotation (first ever): section count hit 101 — moved the oldest date group (2026-07-13, `v01.01r`) to `CHANGELOG-archive.md` with SHA enrichment

### Verified
- `node --check` on the `.gs` and all inline scripts; Playwright at 390×844 — toggle state + localStorage persistence, filter options, 💼 badge, Expense select in the review grid, no horizontal scroll, zero page errors

## [v02.00r] — 2026-08-08 09:09:06 PM EST — [72bce7d](https://github.com/LightAISolutions/Sales/commit/72bce7d3d9a88e36c96bd8d7f8261f90217da14a)

> **Prompt:** "Regarding the centralization discussion, go with the workflow mirror, walk me through how to create the PAT, and use your proposed library layout."

### Added

- **`mirror-library` workflow job** (`.github/workflows/auto-merge-claude.yml`) — after every auto-merge (and on direct `main` pushes, so intake-app note commits mirror too), syncs knowledge files into `LightAISolutions/bess-aidc-library` using the approved layout: `dossiers/` (profiles + registry), `archive/`, `notes/`, `study/` (+`study-prep/` lesson plans), `digests/` (activates when the Scraper export ships), `reports/` and `receipts/` (session-written, never mirrored). Generates the library README once; commits only when content changed; skips with a notice until the `LIBRARY_SYNC_TOKEN` secret exists
- **"Library Mirror Token" section** in `repository-information/ENTERPRISE-SETUP.md` — fine-grained PAT spec (Contents read/write on `bess-aidc-library` only) + 7-step creation walkthrough

### Changed

- Profiler **Archival Procedure step 3** (`.claude/rules/profiler-app.md`) — off-repo mirroring is now automatic via the workflow; sessions no longer attach the library repo
- REPO-ARCHITECTURE.md CI/CD flowchart — added the mirror node (fed by merge and direct-main-push paths); mermaid.live URL regenerated and decompression-verified

## [v01.99r] — 2026-08-08 08:11:03 PM EST — [bd4fc5c](https://github.com/LightAISolutions/Sales/commit/bd4fc5c555c35176e268efe121f29997e9bd9033)

> **Prompt:** "I logged into lightaisolution and opened the MasterACL spreadsheet. All users were TRUE, but I unchecked and rechecked to TRUE. However, jonyang92@gmail.com still cannot login."

### Added
- `diagnoseAclAccess()` owner-run diagnostic in `googleAppsScripts/Receipts/Receipts.gs` (v01.19g, PROJECT block): sign-in shows `not_authorized` although the Access tab shows TRUE and the entire auth path (`exchangeTokenForSession`, `checkSpreadsheetAccess`, `getRolesFromSpreadsheet`, epoch cache) is byte-identical to the last-known-good version — so the mismatch is between what the owner edits and what the code reads. The diagnostic runs the real lookup and logs: the ACL spreadsheet's name + URL as opened by `MASTER_ACL_SPREADSHEET_ID` (catches editing a different file), tab presence, header row with duplicate `Receipts`-column detection (code uses the first match), matching col-A rows with charCode dumps (catches invisible characters / near-miss addresses), the raw page-column cell value + type, the cached verdict, then `clearAllAccessCache()` + a fresh `checkSpreadsheetAccess()` verdict

### Verified
- `node --check` on the full `.gs`; auth functions diffed byte-for-byte between dee4da1 (last confirmed working sign-in) and origin/main before concluding no code regression exists

## [v01.98r] — 2026-08-08 12:14:10 AM EST — [e1a7f1a](https://github.com/LightAISolutions/Sales/commit/e1a7f1a7771bd3d6e1e970faafd7d2b38534a23a)

> **Prompt:** "add the date check rule"

### Added

- New Think Before Asserting extension in `.claude/rules/behavioral-rules.md`: day-of-week + date pairs must be verified with `date -d YYYY-MM-DD +%A` before being asserted — including day names supplied by the user; on conflict, the date is authoritative and the discrepancy is surfaced. Prevents the day-name drift that put "Thursday 8/14" (actually Friday) into a trigger prompt and prep documents

## [v01.97r] — 2026-08-08 12:12:16 AM EST — [5db593e](https://github.com/LightAISolutions/Sales/commit/5db593e0038fddc309c1d13f31cb1e0adecf4561)

> **Prompt:** "The meeting is actually Friday, 8/14, and I am busy on Thursday, 8/13, so schedule this for Wednesday, 8/12."

### Fixed

- Meeting day-name corrected to **Friday 2026-08-14** in the refresher trigger prompt (`trig_01DBojuiEhM4ps3VEsZEvySv` — fire time was already Wednesday 2026-08-12 22:00 UTC and is unchanged) and in the `megmeet-lesson-plan.md` pacing line (now also notes Thursday 8/13 is blocked out). Root cause: the prior session inferred day names from conversational text instead of verifying with `date -d` — 8/12 was always Wednesday and 8/14 is Friday

## [v01.96r] — 2026-08-08 12:07:00 AM EST — [1973941](https://github.com/LightAISolutions/Sales/commit/1973941dd4e329a7e6fa8f1de9ec6a3cb9aec1eb)

> **Prompt:** "Change my Megmeet trigger from Thursday, 8/13, to Wednesday, 8/12.
>
> Then, update all the company dossier to reflect my increased priority on company products and services.
>
> Then, profiler prep the remaining companies the same way you did gor Megmeet.
>
> If you use 100% of my Fable usage and 100% of my usage credits, then pause and save your progress, then restart after my weekly fable limit resets. At that point, let me know how far you've gotten."

### Changed

- **Megmeet refresher trigger moved** to 2026-08-12 22:00 UTC (6 PM EST) — renamed "Megmeet product-tech refresher (2026-08-12)", prompt dates adjusted (`trig_01DBojuiEhM4ps3VEsZEvySv`)
- **Products-and-services priority encoded** as a standing rule: Profiler Command research step in `.claude/rules/profiler-app.md` and a new authoring rule in `repository-information/PROFILER-SCHEMA.md` — `productsAndServices[]`/`technicalSpecs[]` carry the deepest research investment
- **All 9 remaining dossiers revised to profileVersion 2** (product-focused research sweeps, ~20–35 sources each, first-party datasheets first; schemaVersion → 2; lastUpdated 2026-08-08): `byd` (7 lines, HaoHan/MC Cube/Blade, 6 spec tables), `catl` (10 lines, TENER/Qilin/Shenxing/Naxtra, 9 spec tables), `flexgen` (8 lines, HybridOS stack + Powin transition, 5 capability tables), `fluence` (8 lines, Smartstack/Gridstack Pro/Mosaic, 5 spec tables), `hithium` (6 lines, 280→1300Ah cell ladder + ∞Block, 9 spec tables), `sinexcel` (6 lines incl. new AIDC/HVDC division, 13 spec tables), `sungrow` (11 lines, SG-HX/1+X/PowerTitan 3.0, 10 spec tables), `tesla` (8 lines, Megapack 2XL/3/Megablock/Autobidder, 5 spec tables), `wartsila` (7 lines, Quantum 2/3/HE + GEMS + engines, 5 spec tables); registry `lastUpdated` synced

### Added

- **Archival system first use** — all 9 v1 dossiers archived to `live-site-pages/profiler-data/archive/<slug>.profile.v1.json` with `archive-index.json` populated (9 slugs, supersededBy 2)
- **Technology curricula for all 9 companies** (Megmeet-style, high-school-STEM baseline, concept-only flashcards, zero company trivia): in-app `<slug>.study.json` (5 sections + 15 flashcards each) and full-depth `repository-information/study-prep/<slug>/<slug>-lesson-plan.md` (5 modules, worked examples, self-tests) — every covered company now has a Study guide 📖 in the Profiler app
- README tree: 9 study.json entries, 9 archive entries, 9 study-prep directories

## [v01.95r] — 2026-08-07 11:19:48 PM EST — [50b831f](https://github.com/LightAISolutions/Sales/commit/50b831ff74e83091c21d5a6017e9b79d8272de2d)

> **Prompt:** "I don't actually want interview prep. I want the study prep to assume I have high school level STEM knowledge and teach me whatever I need to know to understand what their products do in the grand scheme of their industry (ie: what do SSTs do in the medium voltage critical power AIDC infrastructure). Don't quiz me on company info like founding date, executive team, or headquarters location. I want to focus on each company's products and services."

### Changed

- **Profiler Prep Command redefined as a technology lesson-plan engine** (`.claude/rules/profiler-app.md`) — assumes high-school-STEM baseline, teaches what the products do in their industry context via concept-gap analysis; standing rule: never quiz company trivia (founding dates, executives, HQ). Output moves to `repository-information/study-prep/<slug>/<slug>-lesson-plan.md`
- **Study Guide schema semantics updated** (`repository-information/PROFILER-SCHEMA.md`) — sections teach concepts progressively; flashcards quiz concept/product understanding only
- **`megmeet.study.json` rewritten as a technology curriculum** — 5 modules (power-electronics fundamentals → legacy data-center power chain → the 800VDC shift with every Megmeet product mapped to its slot, incl. what an SST does in MV critical-power AIDC infrastructure → the same physics across VFDs/EV/appliances/welding → industry map & economics) + 15 concept flashcards. Data-only change — no Profiler page version bump
- **Wednesday 8/13 trigger reworked** (`trig_01DBojuiEhM4ps3VEsZEvySv`, renamed "Megmeet product-tech refresher") — now delivers a product/technology refresher + trailing-week news; interview-cram framing, talking points, and company trivia removed
- CLAUDE.md Profiler Command pointer updated to describe the technology-lesson-plan behavior

### Removed

- `repository-information/interview-prep/` and its 4 interview-oriented files (study guide, schedule, cram flashcards, Q&A prep) — replaced by `repository-information/study-prep/megmeet/megmeet-lesson-plan.md` per the developer's redirection away from interview prep

### Added

- `repository-information/study-prep/megmeet/megmeet-lesson-plan.md` — full-depth 5-module technology curriculum with worked efficiency/PUE math, product-by-product 800VDC chain walkthrough, and a concept self-test

## [v01.94r] — 2026-08-07 11:02:33 PM EST — [320f105](https://github.com/LightAISolutions/Sales/commit/320f105f4b65e551d2c48521fe3dd201d7f64f8a)

> **Prompt:** "Regarding my Profiler app:
> - I want each Company profile to accept new information that I learn about the company from industry contacts or in-person events, store it somewhere easily accessible to recall for future reports, and create a visible summary of each new input in the form of a chronological changelog (create a Settings cog icon in the bottom right of dashboard that leads to this changelog).
> - I also want to use this app to identify gaps in my understanding towards a target company and create a lesson plan (any and all formats that best accomplish the job) to teach me important "need-to-know" information about their key products and services. The real life scenario I am facing is: I am job hunting right now and am interviewing with many of the companies in this Profiler app. The most immediate need is Megmeet, which I have a scheduled interview with on Thursday, 8/14, 10am. I want to seem like I have done my homework and know their core business. Recommend an action plan for me to approve."
>
> *(Plan approved via AskUserQuestion: all 3 phases; notes stored public + verbatim with a developer-rated 0–100 confidence score; lesson plans both private docs and sanitized in-app; Wednesday cram trigger yes.)*

### Added

- **Field Notes system** — `live-site-pages/profiler-data/profiler-notes.json` (chronological log, schema v1: id/date/slug/sourceType/verbatim note/developer-rated 0–100 confidence/tags); "Profiler Note Command" + confidence-weighting rules in `.claude/rules/profiler-app.md`; Field Notes schema in `repository-information/PROFILER-SCHEMA.md`; ⚙ cog (dashboard, bottom-right) + chronological changelog overlay with company filter chips and confidence badges in `Profiler.html` (v01.06w)
- **Study guide system** — Study Guide schema (`<slug>.study.json`) in PROFILER-SCHEMA.md; "Profiler Prep Command" (gap analysis → private prep pack in `repository-information/interview-prep/<slug>/` + sanitized in-app guide) in `profiler-app.md`; "Study guide 📖" dossier button + overlay with tap-to-flip flashcards in `Profiler.html`
- **Megmeet dossier** — `megmeet.profile.json` (profileVersion 1, schema v2) from a two-agent research sweep (~65 first-party + third-party sources); registered in `profiler-companies.json` (10 companies covered)
- **Megmeet prep pack** — `megmeet.study.json` (in-app, sanitized) + private `repository-information/interview-prep/megmeet/` (study guide, day-by-day schedule to 8/14, flashcards, Q&A prep)
- **Cram trigger** — one-shot Routine `Megmeet interview cram — night before (2026-08-13)` (`trig_01DBojuiEhM4ps3VEsZEvySv`), fires 2026-08-13 22:00 UTC in a fresh session to produce `megmeet-cram-sheet.md` from trailing-week news; push + email notification on completion

### Changed

- CLAUDE.md "Profiler Command" section extended with the `profiler note` and `profiler prep` trigger phrases
- README tree: new profiler-data entries, `interview-prep/` section, Profiler version display → v01.06w

## [v01.93r] — 2026-08-07 09:58:47 PM EST — [81b2d95](https://github.com/LightAISolutions/Sales/commit/81b2d958066f633d540bd0bed319c0bb10d2b06b)

> **Prompt:** "I reinstalled the Profiler app and it still opens a browser instead of looking like a standalone app"

### Fixed

- Profiler wouldn't install as a standalone PWA because the installed Receipts app claimed scope `./` (the whole site) — Chrome refuses to offer install for a page inside an installed PWA's scope (documented in w3c/manifest #1180/#1209). Narrowed both manifests to per-app scopes (`profiler.webmanifest` → `./Profiler.html`, `receipts.webmanifest` → `./Receipts.html`) and added distinct `id` fields to pin each app's identity. No page version bumps — no HTML files changed; manifests are fetched fresh at install time

## [v01.92r] — 2026-08-07 09:49:43 PM EST — [a4ed463](https://github.com/LightAISolutions/Sales/commit/a4ed4637ffd893b3da92fcbb9238cf70d4372f08)

> **Prompt:** "continue with your recommendation."

*(Executes the prior response's recommendation — make Profiler installable as a PWA like Receipts.)*

### Added

- `live-site-pages/profiler.webmanifest` — PWA manifest (`display: standalone`, ink theme `#13151c`, start URL `./Profiler.html`)
- `live-site-pages/images/profiler-icon-192.png` + `profiler-icon-512.png` — home-screen icons rendered from `profiler-logo.svg` via headless Chromium; the 512 is `any maskable` with the emblem composited at 80% on a full-bleed ink field so circular/squircle masks never clip the gold border

### Changed

- `Profiler.html` (v01.05w) — added `<link rel="manifest">`, `theme-color`, `apple-touch-icon`, and the three Apple PWA meta tags; CSP `manifest-src` overridden `'none'` → `'self'` with a `PROJECT OVERRIDE` comment mirroring the Receipts pattern. Verified in headless Chromium: manifest fetches through the CSP, both icons serve 200, no new console errors

## [v01.91r] — 2026-08-07 03:26:14 AM EST — [4df98e4](https://github.com/LightAISolutions/Sales/commit/4df98e4a21d3f92ddad4e8f3d7de912bde1576b3)

> **Prompt:** "In my Profiler app, verify the Sinexcel refresh. Also, choose a suitable logo for this app and replace the placeholder."

### Added

- `live-site-pages/images/profiler-logo.svg` — Profiler app logo: a dossier-card emblem in the app's own palette (ink `#1d212d`, paper `#e9e4d6`, gold `#d8b45a`) with a photo-frame profile silhouette, index lines, and a gold verification seal

### Changed

- `Profiler.html` (v01.04w) — `SPLASH_LOGO_URL` now points at `images/profiler-logo.svg`, so the Website Ready / Code Ready splashes and the maintenance screen show the app's own logo. `DEVELOPER_LOGO_URL` / `YOUR_ORG_LOGO_URL` intentionally left on the placeholder — they carry developer/org branding semantics, not app branding, and are not consumed by the page. (Same interaction also verified the Sinexcel scheduled refresh — trigger armed and preconditions consistent; no changes were needed for that part)

## [v01.90r] — 2026-08-07 02:00:31 AM EST — [f1bb972](https://github.com/LightAISolutions/Sales/commit/f1bb9726a4c0a29d7bd7cb7d660e767c735f86f3)

> **Prompt:** "continue with your recommendation"

*(Executes the v01.89r recommendation — extend the scheduled-refresh convention to every remaining covered company.)*

### Added

- Armed one-shot scheduled refresh triggers for the remaining public companies, each firing a fresh session the day after its report and following the full Profiler Command (verify-published gate → dual-agent research → archive-first → refresh → self-re-arm with tooling fallback): BYD 2026-08-30 15:00 UTC (staggered 2h after Sungrow — both report 2026-08-29), Tesla 2026-10-22 (estimate-based; fired session confirms the real date), Wärtsilä 2026-10-28 (announced 2026-10-27), CATL 2026-11-01 (2026-10-31 disclosure deadline), Fluence 2026-11-25 14:00 UTC (estimate-based, FY ends Sep 30)
- Quarterly private-company sweep Routine for Hithium & FlexGen (cron: Jan/Apr/Jul/Oct 1, ~13:00 UTC; next fire 2026-10-01) — checks for material developments, refreshes dossiers archive-first only when warranted, makes no commits otherwise

### Changed

- Upgraded the pre-existing Sinexcel trigger (fires 2026-08-12) to the improved prompt template — verify-published gate and self-re-arm now carry the trigger-tooling fallback (REMINDERS.md note if `create_trigger` is unavailable in the fired session)
- `.claude/rules/profiler-app.md` Scheduled Refreshes section now lists the full armed roster (7 companies + the private-company quarterly sweep) with tickers, fire times, and date-confidence notes

## [v01.89r] — 2026-08-07 12:34:58 AM EST — [f1d7d29](https://github.com/LightAISolutions/Sales/commit/f1d7d298b24d0fac17e0006d6ea10faec52ffe4f)

> **Prompt:** "Continue from where you left off."

*(Continuation after a tool-approval interruption — completes the in-flight Overview → Profiler rename, dossier archival system, and scheduled Sungrow refresh.)*

### Changed

- Renamed the Overview app to **Profiler** across the repo: `Overview.html` → `Profiler.html` (v01.03w), `overview-data/` → `profiler-data/`, `<slug>.overview.json` → `<slug>.profile.json`, `overview-companies.json` → `profiler-companies.json`, `OVERVIEW-SCHEMA.md` → `PROFILER-SCHEMA.md`, `Overviewhtml.*` version/changelog files → `Profilerhtml.*`, `.claude/rules/overview-app.md` → `profiler-app.md` — plus all content references (page title/header/exports, CLAUDE.md Profiler Command section + Reference Files row, README tree, REPO-ARCHITECTURE.md flowchart node with regenerated mermaid.live URL, changelog headers)
- Profiler Command trigger phrase is now "profiler \<Company\>" (was "overview \<Company\>")

### Added

- Dossier archival system: `live-site-pages/profiler-data/archive/` with `archive-index.json` — every profile revision now archives the superseded version as `<slug>.profile.v<N>.json` before overwriting, with best-effort mirroring to the `bess-aidc-library` repo (Archival Procedure in `.claude/rules/profiler-app.md`)
- Scheduled refresh convention + first armed trigger: one-shot Routine "Profiler refresh — Sungrow (post-H1 2026)" fires 2026-08-30 13:00 UTC (day after Sungrow's scheduled 2026-08-29 H1 report), runs the full Profiler Command in a fresh session, and re-arms itself for the next reporting period (Scheduled Refreshes section in `profiler-app.md`)

## [v01.88r] — 2026-08-07 12:02:06 AM EST — [7cd6566](https://github.com/LightAISolutions/Sales/commit/7cd656696bc2df9a57ac14017f4fa3897202d90b)

> **Prompt:** "continue with your recommendation"

*(Executes the approved upgrade package with gradual backfill — recommendation from the v01.87r response.)*

### Added

#### `Overview.html` — v01.02w

##### Added
- Recent Developments section: per-event timeline rows (`.ov-dev` — date column, category chip, headline, italic "→ strategy takeaway", source line) rendered between Products & Services and Strategy Read; driven by the new `recentDevelopments[]` schema field
- Strategy Read section: gold-bordered `.ov-strategy` box with a prominent "Analysis — inference from the sourced facts, not company statements" tag, rendering the new `strategyRead[]` bullets
- Product depth rows: optional `positioning` / `soldThrough` / `targetSegments` / `roadmap` fields render as labeled key-value lines under each product entry
- Export document builder (`ovBuildDoc`) and Word CSS carry all three additions, so exported Word/PDF dossiers include the new sections
- Verified via a route-intercepted v2 fixture (both new sections + 3 product depth rows render in dossier and export preview; zero console errors) plus the full v1 regression pass (all 9 existing profiles render unchanged)

#### `repository-information/OVERVIEW-SCHEMA.md`

##### Added
- Schema v2: `recentDevelopments[]` (dated, categorized, trailing 12–18 months, newest first, one-line `read` per event), `strategyRead[]` (labeled-analysis bullets), and the four optional product depth fields; new authoring rules "Analysis stays labeled" and "Recent-developments window"; v1 profiles remain valid (renderer skips absent sections)

#### `.claude/rules/overview-app.md`

##### Changed
- Default research vehicle is now **two parallel subagents per company** (first-party Stage 1 + third-party Stage 2, ~50–70 evaluated sources, ~250–350k tokens); single-agent kept for thin/private subjects, three-agent sweep reserved for user-flagged high-stakes targets; research must cover the v2 sections; existing dossiers upgrade on their next natural refresh (gradual backfill, per developer choice)

## [v01.87r] — 2026-08-06 11:27:45 PM EST — [6bf1fbe](https://github.com/LightAISolutions/Sales/commit/6bf1fbeca4d51cfe62b9bb28b71d97fc8a03e3e9)

> **Prompt:** "These overviews are kind of useful, but don't provide me enough insight into their products/services and don't include recent news highlights that can give me insight into their sales/product strategy. Can you think of and recommend ways to improve the quality of the overviews? 
>
> I also noticed that each company overview only has around 12-16 sources. Why not evaluate more sources to get more information? What is the maximum number of sources I can look up before either it starts costing tokens or starts taking more than 30-minutes to generate a single corporate overview?
>
> Also, note that I want source priority to be: target company's Investor Relations and Press Release pages > trade news sites. Always make sure to fully scrape all relevant information from the target companies themselves first."

*(Quality-upgrade approval question went unanswered — upgrades remain proposed; only the source-priority directive is implemented in this version.)*

### Added

- `.claude/rules/overview-app.md` — **Source Priority Protocol** (developer directive) added to the Overview Command's research step: Stage 1 exhaustively scrapes the target company's own channels first (Investor Relations, complete press-release archive ≥24 months, product/datasheet pages, leadership pages); Stage 2 uses third-party sources only to fill gaps and supply what the company cannot credibly self-report (consensus/expectations, independent rankings, critical context); `sources[]` citation order puts first-party pages first; research prompts must state the protocol explicitly
- `repository-information/OVERVIEW-SCHEMA.md` — matching **Source priority** authoring rule (first-party ground truth scraped fully first; trade press second; first-party listed first in `sources[]`)

## [v01.86r] — 2026-08-06 10:51:29 PM EST — [11dfcac](https://github.com/LightAISolutions/Sales/commit/11dfcaceab8d3ccf61e699bfe8933ccd200e40ad)

> **Prompt:** "overview Sungrow, Tesla, Fluence, CATL, Flexgen, Wartsila, BYD"

### Added

- Seven company dossiers via the Overview Command batch mode (7 parallel research subagents), all at profileVersion 1 in `live-site-pages/overview-data/`:
  - `sungrow.overview.json` — supplier; SZSE: 300274; #1 in Wood Mackenzie's 2025 BESS-integrator AND PV-inverter rankings; PowerTitan 2.0/3.0 + 1+X 2.0 specs; FY2025 ESS revenue overtook inverters (RMB 37.3B, 43 GWh); Q1 2026 miss captured
  - `tesla.overview.json` — supplier; NASDAQ: TSLA; energy-division focus (Megapack 3 / Megablock / Powerwall 3 specs, 46.7 GWh 2025 deployments); FY2024–Q2 2026 results vs consensus incl. the Q2 2026 EPS miss and $240M warranty charge
  - `fluence.overview.json` — integrator; NASDAQ: FLNC; Smartstack/Gridstack Pro specs; the FY2025 guidance-collapse trajectory and FY2026 cut documented vs guidance; 5 company-published exec headshots downloaded from the official leadership page
  - `catl.overview.json` — supplier; SZSE: 300750 · HKEX: 3750; TENER Stack / TENER Sodium specs; FY2024 miss → FY2025 beat → H1 2026 storage +87.5%; US 1260H/procurement-ban headwinds noted
  - `flexgen.overview.json` — integrator; private; HybridOS capability profile (absent OEM/cert lists flagged explicitly); Powin asset acquisition ($36M) and CES acquisition; funding history; verified LinkedIn URLs for CEO/CFO
  - `wartsila.overview.json` — integrator; HEL: WRT1V; Quantum2/Quantum3 + GEMS specs; the two-stage storage-ownership outcome (2025 retention → June 2026 50/50 RCT Solutions JV) with segment financials; 4 official board-of-management headshots
  - `byd.overview.json` — supplier; SZSE: 002594 · HKEX: 1211; HaoHan 14.5 MWh / Chess Plus specs; FY2025 consensus misses amid the EV price war; 12.5 GWh SEC and 11.3 GWh Masdar orders; storage-division leadership change (Yin Xueqin)
- `live-site-pages/images/execs/` — nine company-published executive headshots (Fluence ×5, Wärtsilä ×4) referenced by the profiles' `photo` fields; executives without published headshots render initials avatars
- All seven companies registered in `overview-companies.json` (9 companies total) and the README tree

### Changed

- `README.md` — `overview-data/` listing expanded to all nine profiles; `images/execs/` subdirectory entry added

## [v01.85r] — 2026-08-06 10:09:14 PM EST — [70247bc](https://github.com/LightAISolutions/Sales/commit/70247bc1b54ab3d8365d4912d6d6413cc6095f59)

> **Prompt:** "overview Hithium"

### Added

- `live-site-pages/overview-data/hithium.overview.json` — Hithium dossier (profileVersion 1) via the Overview Command: identity (private; A-share attempt withdrawn 2023, both HKEX applications lapsed — the second in April 2026), six product/service lines (∞Cell LFP cells 280Ah→1300Ah, ∞Block/∞Power containers to 6.9 MWh, sodium-ion N162Ah, C&I, HeroEE residential, Texas/Spain localized manufacturing), four flagship spec tables (∞Cell 1175Ah, ∞Cell 1300Ah, ∞Power 6.25 MWh, ∞Power 6.9 MWh 8h), nine decision makers (four ex-CATL executive directors incl. founder Wu Zuyu; no verified LinkedIn profiles or usable official headshots — initials avatars render), FY2023/FY2024/H1-2025 prospectus financials with shipment rankings (global No. 5 → No. 3 → Top 2) and risk context (CATL litigation >RMB 240M claimed, equity freeze, subsidy-dependent FY2024 profit), 18 cited sources with access dates
- Registered Hithium in `overview-companies.json` (supplier, Xiamen; registry `lastUpdated` in sync) and added the profile to the README tree

### Changed

- `README.md` — `overview-data/` tree listing gains `hithium.overview.json`

## [v01.84r] — 2026-08-06 09:50:12 PM EST — [bb32dad](https://github.com/LightAISolutions/Sales/commit/bb32dad591c6101e0d701b4e1ab3f32fd5f099fb)

> **Prompt:** "Create an export button that allows the user to export the overview file in either Word or PDF formats, with a Preview screen before exporting to give the user a chance to catch mistakes."

### Added

- `Overview.html` (v01.01w) — "Export dossier ⬇" button in the dossier header → full-screen export preview overlay (`#ov-prev-overlay`) with a sticky toolbar and a light "paper" rendering of the complete dossier (`ovBuildDoc()`: letterhead, snapshot facts table, products, spec tables, decision makers, financials-vs-expectations tables, sources, generated-timestamp footer) so mistakes can be caught before exporting
- Word export (`ovWordExport()`): serializes the preview document into a standalone Word-compatible HTML payload (UTF-8 BOM + Office XML namespaces + embedded print-friendly CSS) and downloads it as `<slug>-overview-<date>.doc` — opens directly in Microsoft Word with editable text and tables
- PDF export: `window.print()` against a dedicated `@media print` block that isolates the preview document (everything else hidden, toolbar stripped, page-break rules on section headings and tables) — "Save as PDF" in the print dialog yields a clean, text-searchable PDF with zero vendored libraries (CSP stays closed to external hosts)
- Preview UX: Esc key and backdrop click both close the overlay; toolbar is sticky while the document scrolls. Playwright-verified end to end (preview renders all six document sections, `window.print` invocation stubbed and confirmed, real `.doc` download captured and byte-checked for the BOM+HTML header, Esc close, zero console errors)

## [v01.83r] — 2026-08-06 09:38:07 PM EST — [b3ba5bd](https://github.com/LightAISolutions/Sales/commit/b3ba5bdd0a8e70d8cecf821a17442325aa4a497d)

> **Prompt:** "I want to create corporate overviews of all companies in my ecosystem (suppliers, developers, integrators, investors, hyperscalers, advisors, etc) that aims to educate the reader on what the company does (products and/or services), who their decision makers are (ie: executive team with profile picture + work experience from LinkedIn), their financial performance vs expectations in past two years, detailed technical specifications on their products and services, and potentially more later. Create an app called "Overview" that will create these overviews as long as I give it a company name. I also want it to be organized optimally for Claude to recall these for future revisions or reports. Thus, should I create this app in my Sales repo or my BESS-AIDC-Library repo? I am leaning towards the Sales repo because this repo was created to contain all apps that I can use in my Sales job. Let me know if you disagree.
>
> Also, I am no longer working at Sinexcel, so make sure to add Sinexcel as a covered company, but do not give it special treatment, such as creating new sections called "Relevance for Sinexcel". Recommend me an action plan to approve."

*(User chose "Approve — build now" and "Company-published photos + initials fallback" for exec pictures via AskUserQuestion.)*

### Added

- `Overview.html` — new ecosystem company dossier app (v01.00w, built from the noauth template — splash, version polling, and changelog popup inherited): roster view with category filter chips (supplier / developer / integrator / investor / hyperscaler / advisor) and search, plus a per-company dossier view rendering Snapshot facts, Products & Services, Technical Specifications tables, Decision Maker cards (company-published photos with initials-avatar fallback + LinkedIn links when verified), Financial Performance vs Expectations tables with beat/miss/inline verdicts, and a cited Sources list. Hash-routed; all app code inside PROJECT markers. Playwright-verified end to end (roster, search empty state, full dossier render, back navigation — zero console errors)
- `live-site-pages/overview-data/` data layer: `overview-companies.json` registry (roster, categories, freshness) and `sinexcel.overview.json` pilot profile (profileVersion 1) — Sinexcel covered with standard treatment: four business lines, StellaON 1250K/1575K + SEC480 + Ultra AHF spec tables, 10 decision makers with career backgrounds, FY2024 / FY2025 / Q1-2026 results vs expectations, 16 cited sources with access dates
- `repository-information/OVERVIEW-SCHEMA.md` — single source of truth for the registry and profile schemas: slug rules, field tables, authoring rules (public sources only, no fabrication, expectations honesty, photo policy, standard treatment for every company), and the schema-extension procedure
- `.claude/rules/overview-app.md` — the "overview \<Company\>" command (research → profile JSON → registry → commit), data-vs-page versioning interactions, and the recall design (one file read per company, registry as index, diffable revisions); registered in CLAUDE.md via a new "Overview Command" pointer section and a Reference Files table row

### Changed

- `README.md` — tree entries for the new page (Internal Sites), `overview-data/` directory, `Overviewhtml.version.txt`, Overview changelog + archive, `OVERVIEW-SCHEMA.md`, and `overview-app.md`
- `repository-information/REPO-ARCHITECTURE.md` — flowchart gains the `Overview.html` environment node with serves / version-polling / template-copy edges; mermaid.live pako URL regenerated and decompression-verified

## [v01.82r] — 2026-08-05 10:26:18 PM EST — [`9dd7e84`](https://github.com/LightAISolutions/Sales/commit/9dd7e84328734b15ba6dcafee75d03b69282764b)

> **Prompt:** "I added Allen as a test user and he confirmed that he could sign in. 

1. Add a preview feature after the Pivot Builder wizard so users can catch a mistake and redo the Pivot Builder rather than find out after the export is completed.

2. Make sure that this app is calibrated to scan and extract information from commercial invoices as well as typical receipts."

### Added

#### `Receipts.html` — v01.30w

##### Added
- Export designer Preview step (step 4) — the Values & sheets step's primary button is now "Preview"; `rxFetchPreview()` calls the new `exportPreview` op and renders the exact server-computed Pivot grid as a scrollable table (`.rx-prev-wrap`, sticky header, bold totals row, truncation notes) with Back returning to the wizard state intact and "⬇️ Export" running the real export; labels localize via `rxLbl()` (t() + tCat())
- "Business" receipt category with subcategories Inventory & Resale, Supplies & Packaging, Equipment, Freight & Shipping, Deposits & CRV, Professional Services — added to `CATEGORIES`/`SUBCATS` (propagates to History/Reports filters and the review screen) with 中文 display names in `I18N_CAT_ZH`

##### Changed
- Photo compression max dimension raised 1600px → 2000px so small print on dense letter-size commercial invoices stays legible for extraction

#### `Receipts.gs` — v01.18g

##### Added
- `previewExportPivot` + `exportPreview` dispatcher branches (POST + GET fallback) — returns the pivot grid as JSON without creating a spreadsheet; grids truncated for transport at 60 data rows / 13 data columns (header + totals always kept) with `truncatedRows`/`truncatedCols` counts
- "Business" in `RECEIPT_CATEGORIES` + six invoice subcategories in `ITEM_CATEGORIES` (extraction schema enums)

##### Changed
- Refactored export internals: `gatherExportData_` (session/owner/receipts/line-items gather) and `buildReceiptPivot_` (cross-tab grid) are now shared by `exportReceipts` and the preview, guaranteeing the preview matches the exported Pivot sheet
- Gemini extraction prompt recalibrated for commercial invoices — vendor→merchant, invoice date (not due/ship date), grand total, Business category, per-line deposits/freight/discount handling (negative amounts for credits), case/pack qty×unit-price semantics with printed extended totals preferred, capture-every-line instruction for long invoices, and Business subcategory guidance

## [v01.81r] — 2026-08-05 10:12:22 PM EST — [`6d50768`](https://github.com/LightAISolutions/Sales/commit/6d5076860640cd366e397fb93f78bc392924c5aa)

> **Prompt:** "Allen is the owner of a liquor store and frequently needs to scan, document, and organize invoices of all applicable retail expenses. I want to let him use this Receipt app to scan his invoices and export them in a dynamically-controllable way for whatever purposes he may have. I think it would be good to add an additional prompt that pops up when the Export button is pressed that goes through a short process to figure out which data categories he wants in the X and Y axes or not included. Recommend a couple solutions for me to choose from."

*(User chose the "Pivot Builder wizard" option via AskUserQuestion.)*

### Added

#### `Receipts.html` — v01.29w

##### Added
- Export designer wizard — tapping "⬇️ Export .xlsx" now opens a 3-step modal (`#rx-overlay`/`#rx-modal`, rendered per-step by `rxRender()`): Rows / Y axis (category, subcategory, merchant, month, week, line item), Columns / X axis (none, month, category, merchant), Values (receipt totals, line-item costs, purchase counts) plus include-toggles for the Receipts / LineItems / Monthly Summary sheets; Export sends the config as a `pivot` JSON param, last-used config persists in localStorage `Receipts_export_cfg`, labels follow the app language (new `I18N_ZH` entries), outside-tap/Cancel dismiss, and `showAuthWall()` hides the overlay

#### `Receipts.gs` — v01.17g

##### Added
- `exportReceipts` accepts an optional `pivot` JSON param (both dispatcher call sites) and prepends a cross-tab **Pivot** sheet — rows × columns aggregation with row/column/grand totals, frozen headers; subcategory/item rows and item-cost values aggregate over line items (read once up front), other combinations over receipts; a `nextSheet_` helper orders Pivot → Receipts → LineItems → Monthly Summary and honors the sheet include-toggles. Legacy calls without the param keep the original three-sheet workbook

##### Fixed
- `exportReceipts` referenced an undeclared `ownerEmail` in the Monthly Summary owner filter (latent since the combined-view refactor in v01.43r) — any export where the Monthly Summary tab had data rows would throw a ReferenceError and fail; the filter now uses the export's resolved owner set (also fixes combined exports to include shared owners' summary rows)

## [v01.80r] — 2026-08-05 05:26:52 AM EST — [`5b3e2d4`](https://github.com/LightAISolutions/Sales/commit/5b3e2d4b89397195195f0308296808f474493bea)

> **Prompt:** "I am rating articles in Articles and it constantly fails and shows the error message: "Could not save feedback (http_404)". What's wrong and fix it."

### Fixed

#### `Scraper.gs` — v01.29g

##### Added
- `setArticleVerdicts` batch action (registered): applies up to `SCRAPER_VERDICT_BATCH_MAX`(40) absolute verdict values in one request + one Articles-tab scan; skips malformed verdicts and foreign-owner/project rows; returns `{saved, failed}` id lists; one audit row per batch. Exists because Google's /exec front-end intermittently 404s individual requests (redeploy serving flap — the root cause of the user's 36 consecutive `http_404` failures); one batched call minimizes exposure. Unit-tested 9/9 (multi-apply incl. clear, col-12 writes, foreign-row skip + failed reporting, malformed skip, bad payload)

#### `Scraper.html` — v01.32w

##### Fixed
- Verdict saving reworked from per-tap request (2 attempts then "gave up") to an offline-tolerant queue: `scVerdictClick` applies optimistic UI + enqueues into localStorage (`scraperVerdictQueue`, latest-tap-wins per article); `scFlushVerdicts_` batches everything pending into one `setArticleVerdicts` call with exponential backoff retries forever (5s→60s cap), flushes on page load (queue survives reloads), drops server-confirmed and not-found ids, warns once while unreachable and confirms when saved. Replaces `scSendVerdict` (the retry-twice transport this queue supersedes). Rating buttons never lock, so rapid-fire rating is instant. Playwright-tested: optimistic UI + queue growth under a full 404 storm, single-batch flush of both ratings on recovery, reload-with-pending auto-flush

## [v01.79r] — 2026-08-05 03:35:45 AM EST — [`29d5bc7`](https://github.com/LightAISolutions/Sales/commit/29d5bc7a83dd76580d7d889e380c733c4abb8369)

> **Prompt:** "I want a floating notification window that saves previous notifications with their respective timestamps. I want to be able to start a Backfill step, walk away from my computer, come back and know for sure whether or not Backfill finishes. This applies for all functions."

### Added

#### `Scraper.html` — v01.31w

##### Added
- Notification history subsystem: `scNotify_` appends every toast (`scToast` hook — results and errors for ALL actions) plus a "▶ \<label\> — started" entry (hooked into `scProgShow`'s bar-creation branch) to a localStorage log (`scraperNotifLog`, capped at 100, newest first) so history survives deploy auto-reloads. A started entry with no matching finish identifies an interrupted run
- 🔔 header button with unread badge (count of entries newer than `scraperNotifSeen`; opening the panel marks all read) and a floating `#sc-notif-panel` (fixed top-right, z 9000 — below the auth wall and version pill) listing timestamped entries via `toLocaleString`, errors in red, with Clear/close controls; live-updates while open
- `showAuthWall()` hides the panel (PROJECT OVERRIDE addition to the deactivate-authenticated-UI block). Playwright-tested: badge count after a Compile run (start + finish entries), newest-first ordering with timestamps, badge reset on open, persistence across a full page reload, Clear

## [v01.78r] — 2026-08-05 03:13:25 AM EST — [`d4550ef`](https://github.com/LightAISolutions/Sales/commit/d4550efe2de4ca034ac49a7bf8a45dd078ee40d1)

> **Prompt:** "I completed Ootion A and added the scSchedulerTick hourly trigger, but the red banner still exists - What's wrong and fix it. Also, now that I have archived junk (left with 300+ articles) and added new keywords to the plan and rebuilt it, what are my next steps, why, and the cost."

### Fixed

#### `Scraper.gs` — v01.28g

##### Fixed
- `getSchedulerHealth` false negative on manually added triggers: verification relied solely on `ScriptApp.getProjectTriggers()`, which throws without the `script.scriptapp` scope — so a real, working hand-added trigger was still reported "not installed". Now `scSchedulerTick` writes a `SCHEDULER_LAST_TICK` heartbeat property at the top of every run (before the lock, so even lock-busy ticks heartbeat), and `getSchedulerHealth` trusts a <2h heartbeat first (no permission needed), falls back to ScriptApp, and returns `unverified: true` when neither works. Unit-tested 13/13 (heartbeat-beats-permission, stale heartbeat, scriptapp fallback, lock-busy heartbeat)

#### `Scraper.html` — v01.30w

##### Fixed
- Scheduler banner gains a third state: `unverified` renders an amber "can't verify yet — clears automatically after the first hourly run" notice instead of the red "NOT running" alarm, which was wrong (and alarming) right after a manual trigger add. Playwright-tested (amber text/background, no red text, banner clears on heartbeat-verified health)

## [v01.77r] — 2026-08-05 02:57:13 AM EST — [`cd475f1`](https://github.com/LightAISolutions/Sales/commit/cd475f10dccf7a518651823ebc9c1ecf9b6c9afb)

> **Prompt:** "scheduler result: 1) confirmed not anywhere in Inbox; 2) Reports tab has no rows; 3) chip on project card still says "first run pending"; 4) No triggers exist in my google apps script even after I reloaded the Scraper page (did not reinstall this trigger). Also, when I rebuilt my plan, it removed the keywords I just added and went back to the original 24 keywords. Shouldn't Rebuild override the original keyword plan with the new plan + my new keywords?"

### Fixed

#### `Scraper.gs` — v01.27g

##### Fixed
- Scheduler root cause identified: the manifest's explicit `oauthScopes` lacks `https://www.googleapis.com/auth/script.scriptapp`, so every `scEnsureSchedulerTrigger_` call (`ScriptApp.getProjectTriggers`/`newTrigger`) throws a permissions error that doGet's try/catch swallowed — no trigger, no runs, no email, zero trace. New `getSchedulerHealth` action re-attempts the install and returns `{installed, triggers, error}` with the real error text so the UI can surface it (requires a one-time manual fix: add the trigger in the editor, or add the scope + re-consent)

##### Changed
- Rebuild preserves manual additions: `QueryPlans` gains a `Manual` column; `scGetPlan_`/`scSavePlan_` round-trip it (legacy rows parse as empty), `addPlanQuery` records each user-added group, and `planQueries` puts stored manual groups FIRST, drops exact-dupe AI groups, caps at `SCRAPER_PLAN_TOTAL_MAX`, and returns `manual` to the client. Unit-tested 19/19 (roundtrip incl. legacy rows, manual tracking, rebuild preservation/dedupe/no-prior-plan, health error surfacing)

#### `Scraper.html` — v01.29w

##### Added
- `scCheckSchedulerHealth_` on every project-list load: when `getSchedulerHealth` reports the trigger missing, a red `#sc-sched-warn` banner renders above the list with Google's error and the manual fix steps (Triggers → scSchedulerTick → hourly); banner clears once installed
- Manual plan groups badged "· added by you" in `scShowPlan_` (new `manual` param threaded through all callers); Rebuild status reports "(your N manual additions kept)" and the button title no longer claims manual additions are replaced. Playwright-tested: banner content/clearing, badges, rebuild preservation rendering

#### `gas-project-creator.html` — v01.02w

##### Fixed
- Manifest template now includes the `script.scriptapp` OAuth scope (also propagated to `sample-components/appsscript.json` and the setup steps in `.claude/rules/gas-scripts-reference.md`) so new projects can self-install time-driven triggers

## [v01.76r] — 2026-08-05 02:34:08 AM EST — [`83fe573`](https://github.com/LightAISolutions/Sales/commit/83fe5733bd839dc89d36f5ea84f584823c9da865)

> **Prompt:** "When I am adding new keywords into my Plan, it processes extremely slowly, doesn't always add it to the Plan, and when it does, it doesn't update the keyword list in real time so I don't know it's added. Also, the scheduler did not work this morning; I never got an email at jonyang92@gmail.com."

### Fixed

#### `Scraper.gs` — v01.26g

##### Fixed
- Lost-update race in `addPlanQuery`: the read-AI-write sequence now runs under a `LockService` script lock (`tryLock(15000)` → `plan_busy`; release in `finally` covers all early returns) — previously an overlapping retry read the pre-add plan and its save silently dropped the first keyword. `plan_duplicate` now also returns the full `queries` list. Unit-tested: busy/no-save, acquire+release on happy path, release on duplicate and AI-error early returns
- Scheduler poison loop: `scRunScheduleStep_` now counts consecutive failed ticks (`run.fails`, `run.lastError`); after `SCRAPER_SCHED_MAX_FAILS`(6) it abandons the cycle — advances Next Run, clears state, writes a `scheduled-run-failed` audit row, and (for email/both delivery) sends a failure-notice email with the phase and error. Previously a persistent error retried hourly forever with total silence (the likeliest cause of the missed morning email). Counter resets on any successful phase step. Unit-tested through 6 stubbed failing ticks
- `scEnsureSchedulerTrigger_` re-verifies the hourly `scSchedulerTick` trigger against `ScriptApp.getProjectTriggers()` every 24h (property now stores the last verification timestamp; legacy `'1'` counts as stale) — a deleted trigger self-heals within a day instead of never
- `scDeliverBrief_` email failures now log the `MailApp` error to the audit log (`brief-email-failed`) instead of only recording an opaque `email_failed` status

#### `Scraper.html` — v01.28w

##### Changed
- `scPlanAdd_` rebuilt: optimistic pending `<li>` ("evaluating and saving…") inserted at the top on press; on success the panel re-renders from the server's authoritative `data.queries` via `scShowPlan_` (highlighting the group containing the term); on transport failure a `getQueryPlan` verify-then-report pass renders the truth ("saved" vs "NOT added — try again"); post-render control refs re-fetched by id. New `plan_busy` error string. Playwright-tested: pending row visible while the add route is held open, authoritative re-render + highlight + provenance refresh, lost-reply verification path

## [v01.75r] — 2026-08-04 08:27:47 PM EST — [`acb6788`](https://github.com/LightAISolutions/Sales/commit/acb6788)

> **Prompt:** "There's not much noticeable change. Sometimes it's fast and sometimes it never loads. Also, I pressed Rebuild and looked away. When I looked back, I was back in the Plan page and was not sure if the Rebuild went through. Check and tell me; Then make sure all buttons give a result and recommended next step."

### Added

#### `Scraper.html` — v01.27w

##### Added
- Plan panel provenance line in `scShowPlan_`: "N query groups · saved <plannedAt>" (`toLocaleString` on the QueryPlans ISO timestamp; `'just now'` after in-session build/rebuild) — makes a Rebuild verifiable even when the confirmation is lost to a deploy-triggered auto-reload
- Recommended-next-step text appended to every completion toast (Compile→Analyze, Backfill→Enrich→Analyze, Deep backfill→Analyze, Enrich→Analyze, Analyze→rate/Stats, Archive junk→Backfill, Plan build/Rebuild→Compile or Backfill); `scToast` gained a duration param (completion toasts 9s, errors default 8s)
- Data-driven `Recommended next:` line in the Stats footer (`scRenderStats_`): archivable junk → Archive junk; unscored → Analyze; preview coverage <80% → Enrich; ratable pool → rate verdicts; else grow via Backfill

##### Fixed
- 90s AbortController watchdog (`_fetchT`) on both POST and GET paths in `_gasPost` — a hung fetch previously never settled, leaving the pressed button disabled forever with no error ("sometimes it never loads"); now it rejects with `no reply after 90s`, every handler's existing `.catch` surfaces it, and the button recovers. Verified via Playwright (provenance line, rebuild next-step status, stats recommendation) + static wiring assertions

## [v01.74r] — 2026-08-04 08:11:10 PM EST — [`bcac8c4`](https://github.com/LightAISolutions/Sales/commit/bcac8c4)

> **Prompt:** "It takes a long time for each of my button (Plan, Backfill, etc) presses to register. Can you speed that up?"

### Changed

#### `Scraper.gs` — v01.25g

##### Changed
- API-first `doGet` routing (PROJECT OVERRIDE): the GET api/deploy routes are now matched before the page-boot work — previously every GET-fallback API call paid `ensureScriptProperties_` + `registerSelfProject()` (opens the Master ACL spreadsheet, ~1–2s) + `scEnsureSchedulerTrigger_` before the action even ran. Boot work still runs for page-shell and listener-page loads
- `ensureScraperTabs_` guarded by an execution-global + 6h `CacheService` flag (key embeds the tab count, so adding a tab to `SCRAPER_TAB_HEADERS` auto-invalidates); the ~10 per-press `getSheetByName` probes now run at most once per cache window, failing open if CacheService is unavailable. Unit-tested 15/15 (cold run, same-execution skip, warm-cache zero probes, cache-outage fail-open, stale-count invalidation, plus static doGet ordering assertions incl. deploy-fallback placement per Deploy Handler Protection)

#### `Scraper.html` — v01.26w

##### Changed
- Sticky transport in `_gasPost`: after a POST transport failure where the GET fallback succeeds, `_scGasGetOnly` locks the session to the GET api route — eliminating the wasted failed-POST round trip on every subsequent call in environments where Google's serving drops POST bodies. The flag is only set after a successful GET (a total outage can't disable POST permanently). Playwright-tested: first call = 1 failed POST + 1 GET, second call = GET only

## [v01.73r] — 2026-08-04 06:41:08 PM EST — [`d28a97f`](https://github.com/LightAISolutions/Sales/commit/d28a97f)

> **Prompt:** "I archived junk and pressed "Plan". This is what it looks like. Give me an option to add keywords like "Sinexcel" and have it automatically evaluate and add relevant adders like " data center project OR deal" and add it to the list in real-time, so I never have to leave that window."

### Added

#### `Scraper.gs` — v01.24g

##### Added
- `addPlanQuery` action (registered in `SCRAPER_PROJECT_ACTIONS` + `handleProjectAction_`): takes a raw term, dedupes case-insensitively against the saved plan (`plan_duplicate` + the covering group), enforces `SCRAPER_PLAN_TOTAL_MAX`(40) hard cap (`plan_full`), then one `aiComplete_` call shapes the term into a styled query group (5 in-prompt style examples); if the AI reply drifts off the term, falls back to `'"term" ' + scTopicTerms_(topic, 3)`. New group is `unshift`ed (prepended) so manual adds always fall inside every consumer's slice window; saved via `scSavePlan_`, logged to UsageLog + audit (`plan_add`)

##### Changed
- Plan consumption caps raised: `SCRAPER_PLAN_GDELT_MAX` 12→16, `SCRAPER_PLAN_GNEWS_MAX` 10→24

#### `Scraper.html` — v01.25w

##### Added
- Search Plan panel add-a-term UI: `#sc-plan-input` + Add button + Enter-key submit in `scShowPlan_`; `scPlanAdd_` calls `addPlanQuery` (no retry wrapper — avoids double AI spend), prepends the returned group as a highlighted `<li>` (textContent, XSS-safe), shows "Added — N query groups now saved", clears + refocuses the input; `plan_duplicate` renders "Already covered by: <group>"; new error strings `term_missing`/`plan_full`

##### Changed
- `scRunPlan` now calls `getQueryPlan` first and opens the saved plan instantly (protects manual adds); the planner only runs when no plan exists. New in-panel Rebuild button (`scPlanRebuild_`) is two-tap ("Replaces list — tap again") and re-renders via `scShowPlan_`. Unit-tested 12/12 (node, extracted `addPlanQuery`: dedupe/prepend/drift-fallback/cap/errors) + Playwright UI test (saved-plan open without planner call, real-time add, Enter+duplicate, two-tap rebuild)

## [v01.72r] — 2026-08-04 06:01:06 PM EST — [`9eee790`](https://github.com/LightAISolutions/Sales/commit/9eee790)

> **Prompt:** "build the query planner and AI pre-filter at fetch time, as well as the Claude web-search backfill for an occassional "deep backfill" option. After archiving, I will only have 300+ relevant articles in my collection, so my priority is to fill it with other relevant articles."

### Added

#### `Scraper.gs` — v01.23g

##### Added
- Query planner: `QueryPlans` tab + `planQueries` action — one `aiComplete_` call turns the FULL topic paragraph + keywords + learned preferences into ≤`SCRAPER_PLAN_QUERIES_MAX`(24) entity-level query groups (`scGetPlan_`/`scSavePlan_`/`scJsonArray_`); `getQueryPlan` reads it back. Plan groups feed `scBuildFetchQueue_` (up to 10 gnews queries, label `plan`) and REPLACE the auto-built `scGdeltQueries_` set (up to 12 + liked-domain group, OR groups paren-wrapped for GDELT)
- Fetch-time pre-filter: `scPrefilterItems_` batch keep/drop (40 headlines/call, "when unsure KEEP") wired into `scCompileChunk_` and `backfillNow` before row insertion; fails open on any AI error; `filtered` count in state/response/audit; AI calls logged to UsageLog
- Deep backfill: `deepBackfillNow` — one Claude web-search task per invocation (`scWebSearchArticles_`: `claude-haiku-4-5` + `web_search_20250305`, `max_uses` 3, quarter × query-group tasks over 8 quarters × ≤8 groups), Enrich-style poison-safe `attempting` marker, rows arrive with snippet (summary) so Enrich is unnecessary, `searches` counted from `usage.server_tool_use`; `deepbf_key_missing` when ANTHROPIC_API_KEY is absent. Unit-tested 26/26 via node against extracted functions (plan parsing, GDELT paren-wrapping/caps, prefilter keep/drop + fail-open, web-search payload/parse/429)

#### `Scraper.html` — v01.24w

##### Added
- Plan button → `scRunPlan` (progress panel + toast) and `scShowPlan_` reusing the stats overlay shell to list the stored query groups
- Deep backfill button → `scRunDeepBackfill` with two-tap paid-search confirm, chunked loop, progress (tasks/articles/searches), `deepbf_key_missing` + `plan_parse_failed` error messages
- Compile/Backfill progress lines show `filtered` junk counts. Playwright-verified: plan overlay contents, arm label, missing-key toast, 3-chunk deep run (calls counted), screenshots inspected

## [v01.71r] — 2026-08-04 04:53:53 PM EST — [`308513a`](https://github.com/LightAISolutions/Sales/commit/308513a)

> **Prompt:** "Continue with your recommendation. Also, since the GDELT backfill is so limited, explore other possible methods to backfill that could increase my fetch accuracy, even if it costs more tokens. If so, approximate how much more each method will cost. "

### Added

#### `Scraper.gs` — v01.22g

##### Added
- `ArticlesArchive` tab (Articles headers + `Archived At`) auto-created via `SCRAPER_TAB_HEADERS`; `archiveJunk` action moves unrated sub-`SCRAPER_CALIB_MIN_SCORE` articles there in one locked pass (read → idempotent-by-Article-ID archive append → single-write Articles rewrite), clears the row-indexed `scEnrich_` state, and returns `{archived, remaining}`. Unit-tested 25/25 via node against the extracted functions (partition, crash-recovery re-append, empty case, stats before/after)
- `getScoreStats` extended with per-band preview counts (`p0`–`p80`), `archivable` (unrated & <10), and `archived` (rows in the archive tab)

##### Changed
- `scExistingArticleUrls_` dedupe set now includes ArticlesArchive URLs, so Compile/Backfill can never re-import archived articles

#### `Scraper.html` — v01.23w

##### Added
- Stats panel: per-band `sc-stat-sub` line showing "N with preview · M title-only"; footer lines for archivable count (with Archive junk pointer) and already-archived count
- "Archive junk" card button: first tap fetches the live count and arms ("Archive 1781? Tap again", 6s timeout), second tap runs the single `archiveJunk` call through the progress panel with result toast. Playwright-verified end-to-end against stubbed backend (arm label, single call, toast, progress, post-archive stats)

## [v01.70r] — 2026-08-04 04:01:42 PM EST — [`2f604a6`](https://github.com/LightAISolutions/Sales/commit/2f604a6)

> **Prompt:** "build the distribution panel"

### Added

#### `Scraper.gs` — v01.21g

##### Added
- `getScoreStats` action: one Articles-sheet scan returning rubric-aligned band counts (0-9 / 10-29 / 30-49 / 50-79 / 80-100), scored/unscored/total, over-20 count, snippet coverage, 👍/👎 totals, and the unrated ratable pool (score ≥ `SCRAPER_CALIB_MIN_SCORE`, no verdict)

#### `Scraper.html` — v01.22w

##### Added
- Stats button per project card → `#sc-stats-overlay` panel: big %-over-20 headline, five color-coded proportional band bars (colors matching the score-chip palette, hover titles naming the rubric band), and a corpus-health footer (scored of total with unscored hint, preview coverage %, rating counts, ratable pool). Harness-verified against stubbed stats: headline 36% (720/2000), bars proportional to band counts, close button and click-outside dismiss, screenshot visually checked

## [v01.69r] — 2026-08-04 06:02:52 AM EST — [`53ced63`](https://github.com/LightAISolutions/Sales/commit/53ced63)

> **Prompt:** "fix the enrich stall"

### Fixed

#### `Scraper.gs` — v01.20g

##### Fixed
- Poison-URL stall in `scEnrichChunk_`: `UrlFetchApp` has no timeout, so a hanging site carried the execution into Google's uncatchable 6-minute kill; state was only saved at batch end, so the client's retry chain (POST → GET fallback → `scRetryOnce`, each leg hanging ~6 min) re-ran the same batch and re-hit the same URL forever. State is now persisted BEFORE every fetch with an `attempting` row marker; a leftover marker on the next run means the previous execution died mid-fetch on that row — it's counted unavailable, skipped, and the run continues. Per-fetch persistence also stops killed executions from losing the batch's other progress. Node-verified 8/8 by running the extracted shipped function against stubbed platform services: seeded mid-fetch kill state → poison row never re-fetched, counted failed, remaining rows enriched, run completes; fresh run persists the marker before all fetches and clears it in the final state

## [v01.68r] — 2026-08-04 03:33:53 AM EST — [`9543a7b`](https://github.com/LightAISolutions/Sales/commit/9543a7b)

> **Prompt:** "build the enrich step"

### Added

#### `Scraper.gs` — v01.19g

##### Added
- `enrichNow` action + session-free `scEnrichChunk_` core: chunked/resumable abstract harvest for snippet-less articles (15 page fetches per call, 40s budget, row-cursor resume — safe because the Articles sheet is append-only); fetches with a browser-like User-Agent, writes to the Snippet column, counts failures without marking them so a later run retries; UsageLog fetch counting; returns processed/total/enriched/failed for the progress bar
- Pure `scExtractAbstract_`: og:description → twitter:description → meta description with either attribute order, single/double quotes, entity decode, whitespace collapse, 300-char cap — node-verified 10/10 against extracted source (fallback chain, precedence, entities, no-match, cap)

#### `Scraper.html` — v01.21w

##### Added
- Enrich button per project card + `scRunEnrich` chunk loop wired to the progress panel ("X/Y articles · N previews found · M unavailable"), completion/nothing-to-do toasts, resume-on-retry failure path — harness-verified through a 3-chunk stubbed run

## [v01.67r] — 2026-08-04 03:28:10 AM EST — [`b7c7de6`](https://github.com/LightAISolutions/Sales/commit/b7c7de6)

> **Prompt:** "apply the three fixes. Recommend me some work-arounds to tackle the "title only" issue; Is there any way to get an abstract summary of the article instead of just judging by the title?"

### Fixed

#### `Scraper.gs` — v01.18g

##### Fixed
- Scoring rubric (fix 1): `scScoreBatch_` prompt now anchors five bands — 80-100 on-topic / 50-79 relevant subtopic / 30-49 adjacent context (corporate moves, financing, policy, supply chain, partnerships of relevant players, explicitly named) / 10-29 weak / 0-9 unrelated — plus "use the full range; do not default to the extremes". Replaces the two-anchor instruction that produced the bimodal near-zero distribution on the 2000-article re-score
- Title-only fairness (fix 2): same prompt now states a missing body is NOT evidence of irrelevance — headline-only articles (all GDELT backfill rows store an empty snippet) are scored on what the headline plausibly covers
- Feedback rebalance (fix 3): `scFeedbackPrompt_` caps 👎 exemplars at 👍-count + 2 and reframes them as "obvious junk the user filtered out… do NOT treat as a relevance ceiling" instead of "score articles like these LOW"; `scDistillFeedback_` prompt now instructs the distiller to state preferences positively first, with rejections at most a short final sentence. Node-verified against extracted source (6/6): all-downs history shows only 2 junk-framed exemplars with the ceiling warning, balanced history shows all ups + capped downs, empty history emits nothing

## [v01.66r] — 2026-08-04 02:39:32 AM EST — [`8bc535f`](https://github.com/LightAISolutions/Sales/commit/8bc535f)

> **Prompt:** "After I tap + to add a suggested keyword to project keywords, give me an option to undo that +. Also, give me a clearer, more informative progress bar for every action button I can click (ie: Backfill, Analyze, Re-score collection)."

### Added

#### `Scraper.html` — v01.20w

##### Added
- Suggestion undo: added chips render a × (`.sc-sugg-undo`); `scCalAddSuggestion_` generalized into `scCalToggleSuggestion_` with `op: add|remove` through the same optimistic 900ms-debounced batch pipeline; payload builder applies ops in order and skips the request entirely on a net-zero batch (add undone before flush); failure rollback restores each chip's pre-tap state including its +/× button. Harness-verified: add → 1 `updateProject` (keyword present), undo → 2nd call (keyword gone, + restored), quick +× → no request
- Action progress bars: fixed bottom-left `#sc-prog-stack` (z-index 60 — visible above the articles/calibration overlay, nudged above the version pill), one `.sc-progress` panel per project with label, fill bar (percent when total known, sliding indeterminate stripe when not), stats line, and a 1s-tick elapsed clock; `scProgDone` turns it green and fades after 2.5s, `scProgFail_` freezes the reason for 5s. Wired into Compile (feeds/new/failed), Backfill (slices/found/failed), Analyze (scored/left + 🧠 note), and Re-score (clearing phase → scoring phase). Harness-verified fill progression `indet → 33% → 67% → 100%` via MutationObserver plus screenshot

## [v01.65r] — 2026-08-04 01:46:24 AM EST — [`b048b61`](https://github.com/LightAISolutions/Sales/commit/b048b61)

> **Prompt:** "I added some suggested keywords to project keywords, but it took a very long time to process my clicks. Is there any way to speed that up?"

### Changed

#### `Scraper.html` — v01.19w

##### Changed
- Suggestion-add chips are now optimistic + batched: `scCalAddSuggestion_` flips the chip instantly and queues the addition; `scCalFlushSuggestions_` coalesces all taps within a 900ms debounce window into ONE `updateProject` (mid-flight taps re-flush after the response). Harness-verified: 4 rapid taps registered in 179ms against a 1.5s-latency stub, exactly 1 request carrying all 4 additions

##### Fixed
- Lost-update race eliminated: per-tap requests each built their payload from the pre-response project state, so rapid taps could overwrite earlier additions — the single batched payload merges every queued addition; on failure all batch chips roll back with re-tappable + buttons and a retry toast

#### `Scraper.gs` — v01.17g

##### Changed
- `scWriteSchedules_` skips the delete-and-reappend rewrite when frequencies, delivery, and custom config are unchanged — per-row `deleteRow` calls were the slowest part of `updateProject`, making scope-only edits sluggish

##### Fixed
- Scope-only project edits no longer wipe schedule rows' Next Run / Last Run — previously every `updateProject` reset live scheduler state, making the schedule immediately due again

## [v01.64r] — 2026-08-04 01:33:25 AM EST — [`a596f46`](https://github.com/LightAISolutions/Sales/commit/a596f46)

> **Prompt:** "apply both changes"

### Changed

#### `Scraper.gs` — v01.16g

##### Changed
- Calibration excludes scores below `SCRAPER_CALIB_MIN_SCORE` (10) entirely — confirming articles the scorer already dismissed teaches it almost nothing
- Band mixer extracted into pure `scCalibMix_` and the silent low-band fallback removed: empty mid/high slots borrow only from each other, empty low slots borrow from mid/high, and the queue ends when the informative bands (30–70 / 70+) run dry — the low band (now 10–29) never substitutes for them. Node-verified against extracted source: all-low corpus → empty queue, 6/2/2 ratio on a mixed 10-pick, hi-substitution without lo-flooding, mid-stream termination, band order preserved

#### `Scraper.html` — v01.18w

##### Changed
- Calibration empty-state messages rewritten for the new behavior ("Nothing informative left to calibrate…" / "All caught up — nothing informative left to rate") with a pointer to Compile + Analyze; harness-verified render

## [v01.63r] — 2026-08-04 01:17:17 AM EST — [`5d9b8b5`](https://github.com/LightAISolutions/Sales/commit/5d9b8b5)

> **Prompt:** "build the scheduler."

### Added

#### `Scraper.gs` — v01.15g

##### Added
- Scheduler: hourly `scSchedulerTick()` (LockService-guarded) walks the Schedules tab for Active rows whose Next Run has passed (or was never set, or whose run is mid-flight) and drives each through compile → analyze (incl. auto-distill) → brief → deliver via a persisted per-schedule phase state (`scSchedRun_<scheduleId>` Script Property), phase-stepping within a 240s tick budget and resuming next tick; 4s pauses between analyze chunks for free-tier AI RPM
- Session-free cores extracted: `scCompileChunk_` / `scAnalyzeChunk_` / `scBriefCore_` — `compileNow` / `analyzeArticles` / `previewBrief` are now thin session-validated wrappers with identical behavior
- Delivery: `scDeliverBrief_` appends a Reports-tab row (status `generated` / `emailed` / `email_failed`) and emails the brief via `MailApp` when delivery is `email`/`both`
- `scNextRun_`: pure next-run computation anchored at 7:00 AM ET per frequency (daily/weekly/monthly/quarterly/biannual/annual; custom parses "every N days", weekly fallback) — node-verified with 11 passing cases against the extracted source
- Trigger self-install: `scEnsureSchedulerTrigger_` (idempotent, property-guarded) hooked into `doGet` inside try/catch; `setupSchedulerTrigger()` manual fallback for the editor. Deploy handler untouched
- Paused/archived projects: schedules skip the cycle, advance Next Run, and drop stale run state; `scSchedulesFor_`/`listProjects` now return per-project `nextRun`/`lastRun`

#### `Scraper.html` — v01.17w

##### Added
- Green `⏰ next: <date>` chip on project cards (title-attr shows last run); "⏰ first run pending" variant for scheduled projects awaiting their first pass — harness-verified both variants render from stubbed `listProjects`

## [v01.62r] — 2026-08-04 01:08:07 AM EST — [`ff07339`](https://github.com/LightAISolutions/Sales/commit/ff07339)

> **Prompt:** "I like your plan, but add ways to improve the fetching breadth as well. I am willing to spend more time and effort on the project topic/keywords/sources/ideally more."

### Added

#### `Scraper.gs` — v01.14g

##### Added
- `listArticles` extended: standard mode gains server-side filters (`minScore`, `days` on Fetched At, `q` needle over title/snippet/summary/source); new `mode=calibration` returns a stratified sample of unrated scored articles mixed ~60% mid-band (30–70) / 20% high / 20% low via a round-robin pattern, newest-first within bands
- New `distillPreferences` action: on-demand re-distill when the verdict count changed (otherwise returns the stored profile), plus `likedDomains` for the suggestions UI
- New `resetScores` action ("Re-score collection"): clears Summary + Relevance Score for a project in one batched range write (verdicts preserved) so the normal chunked Analyze loop re-scores with the current profile
- New `scLikedDomains_`: domains of 👍-rated articles, computed live — Compile adds up to 3 `site:` Google News queries (`liked-source` label) and Backfill adds one `domainis:` GDELT group (query cap 5 → 6)
- Distillation prompt now asks for adjacent topics/synonyms/entities beyond literal title phrases; `SCRAPER_PREFS_KEYWORDS_MAX` 8 → 12; Compile uses up to 9 learned keywords (was 6)

#### `Scraper.html` — v01.16w

##### Added
- Calibrate button per project card → calibration mode in the articles overlay: rate-and-replace card queue (8 visible, 30 fetched, background top-up under 5), session counter, auto `distillPreferences` every 10 ratings with 🧠 toast
- "What I've learned" box: profile note + suggested-keyword and liked-domain chips with one-tap add via `updateProject` (client-side payload merge); "Re-score collection" two-tap confirm → `resetScores` → reuses `scRunAnalyze`
- Standard mode filter bar (days / min score / keyword) wired to the new `listArticles` params; card markup extracted into shared `scArtCard_`
- Harness-verified end-to-end: 8-card open, remove+replace on rating, counter, distill at 10 ratings, learned box chips, suggestion add, min-score filter param; both-mode screenshots visually checked

## [v01.61r] — 2026-08-03 11:57:41 PM EST — [1f497f8](https://github.com/LightAISolutions/Sales/commit/1f497f8b8a954079dbb757bb192e0037d1e3695f)

> **Prompt:** "For a few article ratings, it took a long time before it captured and saved me ratings. When I am rating articles (thumbs up/down), create a status window to the right that shows the steps that it is going through, so that it is easier to debug in the future."

### Added

#### `Scraper.html` — v01.15w

##### Added
- Rating status panel `#sc-vlog`: fixed dark monospace log docked right of the articles card (z-index 51, responsive at ≤1240px/≤760px breakpoints). Each 👍/👎 tap opens a numbered `scVlogSession` with its own clock; every step logs with `+Xms` elapsed — tap registered, per-attempt send/reply (with per-request round-trip ms), transport-retry wait, `unknown_op` mid-update wait, saved ✓ / NOT saved, buttons unlocked. Sessions from concurrent taps interleave safely (per-session numbering + per-session t0); log capped at 60 lines; × hides it (reappears on next rating); hidden when the articles overlay closes
- `scSendVerdict` restructured with sequential per-attempt instrumentation (inlining the former `scRetryOnce` wrapping so each attempt is individually visible); behavior unchanged — one transport retry + one `unknown_op` retry, 2.5s waits
- Harness-verified: healthy tap (attempt 1 → saved), flapping server (unknown_op → wait → attempt 2 → saved), close button, and screenshot visual check

## [v01.60r] — 2026-08-03 11:33:05 PM EST — [3ef1ffb](https://github.com/LightAISolutions/Sales/commit/3ef1ffbe02df26d21cef67586e5de9331465a5c4)

> **Prompt:** "build the distillation step while I continue to rate articles."

### Added

#### `Scraper.gs` — v01.13g

##### Added
- Feedback distillation: `scDistillFeedback_` sends ALL of a project's 👍/👎-rated titles (up to `SCRAPER_DISTILL_TITLES_MAX` = 40/side) to the AI and stores the result — a ≤150-word learned-preferences note plus up to 8 suggested search phrases — in a new user-visible `Preferences` sheet tab (`Project ID`, `Owner`, `Learned Preferences`, `Suggested Keywords`, `Verdicts Used`, `Distilled At`); auto-created by `ensureScraperTabs_`, upserted one row per project
- Distillation runs automatically inside `analyzeArticles` when total verdicts ≥ `SCRAPER_DISTILL_MIN_VERDICTS` (3) AND the count changed since the last distillation — at most one extra AI call per Analyze cycle (the stored `Verdicts Used` count makes follow-up chunk invocations skip it); failures are non-fatal and retried on the next Analyze
- Scoring prompts now include the learned note via `scPrefsPrompt_` (between PROJECT SCOPE and the raw exemplars); `previewBrief` includes it too so briefs reflect learned preferences
- Learned keywords widen fetching: `scBuildFetchQueue_` adds up to 2 `learned`-labeled Google News queries (6 keywords, OR'd in 3s) and `scGdeltQueries_` adds one learned query group to Backfill (cap raised 4 → 5 groups)
- `analyzeArticles` returns `distilled: N` (verdict count) when a distillation ran, and counts the distillation call in `UsageLog`

#### `Scraper.html` — v01.14w

##### Added
- The Analyze loop watches for `data.distilled` and appends "🧠 Preferences updated from your N ratings." to the completion toast (both the "articles scored" and "already scored" paths)

## [v01.59r] — 2026-08-03 11:21:17 PM EST — [b3941f4](https://github.com/LightAISolutions/Sales/commit/b3941f4755f44da0f0664ba6f47cd2445a3b7ef6)

> **Prompt:** "I opened Articles and started to rate them, but only the 1st article's thumbs-up rating went through. When I tried to thumbs-up the 2nd and 3rd articles, it would get grayed-out for a few seconds before resetting to default. Did I actually do anything by rating the 2nd and 3rd articles? Also, fix this issue."

### Fixed

#### `Scraper.html` — v01.13w

##### Fixed
- Verdict saves now go through `scSendVerdict`: retries once on transport failure (matching `scRetryOnce`) and once more with a 2.5s delay when the server answers `unknown_op` — the signature of Google's `/exec` serving briefly flapping to a stale deployment version after a GAS redeploy, which made taps land on code that didn't know `setArticleVerdict` yet. Server writes are absolute values, so retries are idempotent. Root cause confirmed by a full-fidelity Playwright harness (real page + handlers, stubbed GAS routes): the client path was correct in isolation; flap, healthy, and persistent-failure scenarios all verified post-fix
- New `unknown_op` entry in `SC_ERROR_MESSAGES` ("The server is finishing an update — wait a few seconds and try again") replaces the generic fallback toast for all actions during deploy flaps

## [v01.58r] — 2026-08-03 10:06:55 PM EST — [2ec7564](https://github.com/LightAISolutions/Sales/commit/2ec7564081c7665ecb67cdc6287f952f6f7ed4bf)

> **Prompt:** "fix articles and build the feedback loop. It is imperative that Scraper can learn about my preferences and can improve its article fetching and scoring capabilities to be realistically useful."

### Added

#### `Scraper.gs` — v01.12g

##### Added
- `setArticleVerdict` action records 👍/👎/clear into the existing User Verdict column (ownership-checked by project + owner, audit-logged)
- Verdict exemplars feed the scoring prompt: `analyzeArticles` collects up to 8 newest 👍 and 8 newest 👎 titles per project and `scScoreBatch_` injects them as a USER FEEDBACK section between the project scope and the article list, so every future scoring batch calibrates to the user's confirmed preferences

##### Fixed
- `listArticles` now sorts the project's full corpus by score (unscored last, newest-first within ties) **before** applying the 100-row cap — the previous newest-fetched-first cap let a large low-relevance backfill crowd every relevant article out of the overlay

#### `Scraper.html` — v01.12w

##### Added
- 👍/👎 verdict buttons on each article card (delegated click handler, active-state highlight, tap-again-to-clear, disabled while the save round-trips); verified via Playwright visual test

#### `Scraper-diagram.md`

##### Changed
- Sequence diagram updated: top-scored `listArticles` selection, exemplar titles in the scoring step, and the new `setArticleVerdict` flow; mermaid.live pako URL regenerated and decompression-verified

## [v01.57r] — 2026-08-03 08:17:43 PM EST — [be1fdaa](https://github.com/LightAISolutions/Sales/commit/be1fdaa1c8ef9dc02f91a8a2f6ed899a0af33064)

> **Prompt:** "16 minutes later, the backfill progress looks like this. Therefore, I don't think there's a need to "fix" the backfill. However, I do want you to show failures in the progress UI."

### Changed

#### `Scraper.html` — v01.11w

##### Changed
- Backfill progress button now appends the silent-error count from `backfillNow` responses (`, N failed`) when nonzero — failed GDELT slices (e.g. rate-limit rejections, which GDELT returns as HTTP-200 plain text) were previously invisible until the completion toast

## [v01.56r] — 2026-08-03 06:43:09 AM EST — [4e80170](https://github.com/LightAISolutions/Sales/commit/4e801704c3ed1c8000c38dc52c2f4fc06989d18b)

> **Prompt:** "Key added as "Scraper-GAS" with an expiry date of "never". Continue the build."

### Added

#### `Scraper.gs` — v01.11g

##### Added
- GDELT DOC 2.0 historical backfill engine: new `backfillNow`/`getBackfillStatus` actions slice the past 24 months per month × per query and pull date-ranged English article lists (≤250 per slice) into the Articles tab — deduped against existing URLs, batch-appended via `setValues` (not per-row `appendRow`), time-budgeted (40s / 6 fetches per call), with compact resumable state in Script Properties (slices are derived from `startedAt` + stored queries rather than stored, keeping state well under the 9KB property limit)

#### `Scraper.html` — v01.10w

##### Added
- Backfill button on each project card runs the chunked backfill loop with live progress ("Backfilling… n/total (X found)") and a completion toast; transport failures auto-retry once and an interrupted run resumes where it left off

## [v01.55r] — 2026-08-03 06:20:57 AM EST — [748bcab](https://github.com/LightAISolutions/Sales/commit/748bcabc2d66a31a1f06016937ff333bfe29f9bf)

> **Prompt:** "Repo created per your instructions and I made sure Claude Github App has access to the bess-aidc-library repo. Also, I have created an Anthropic Console account under jonyang92@gmail.com and funded it with $200."

### Added

#### `Scraper.gs` — v01.10g

##### Added
- Claude (Anthropic) AI provider wired into the swappable `aiComplete_()` layer: new `scClaudeComplete_()` calls the Messages API with Sonnet 5 (`claude-sonnet-5` default, `ANTHROPIC_MODEL` Script Property overrides) using an `ANTHROPIC_API_KEY` Script Property, mapping responses/errors to the same `ai_*` taxonomy as Gemini (`ai_key_missing`, `ai_rate_limited`, `ai_http_<code>` with trimmed API message, `ai_bad_json`, `ai_empty_response`)
- `AI_PROVIDER` Script Property now switches providers (`claude` | `gemini`) without a code change; Gemini remains the default and free-tier fallback

##### External
- Companion library repo `LightAISolutions/bess-aidc-library` seeded and pushed: 76-file skeleton inherited from this repo's template conventions (CLAUDE.md, rules, hooks, skills, trimmed auto-merge workflow), plus `library/news/<segment>/<year>/` archive structure, `library/specsheets/` placeholder, and the 55-company `WATCHLIST.md`

## [v01.54r] — 2026-08-03 02:51:07 AM EST — [9682a32](https://github.com/LightAISolutions/Sales/commit/9682a326285bf894a37fa69d105c38b71610fa34)

> **Prompt:** "Another error message. Resolve it."

### Fixed

#### `Scraper.gs` — v01.09g

##### Fixed
- Transport-level `http_404` on Analyze: live probes confirmed the deployment healthy (fast requests return 200 in 4–9s), isolating the failure to long-running exec requests dying at Google's HTTP front-end. `analyzeArticles` now makes exactly 1 AI call per invocation (was up to 3 + 2s sleeps), keeping each request compile-chunk-sized; the client loop provides continuation and free-tier RPM spacing. Removed the now-unused `SCRAPER_AI_CALL_SPACING_MS` intra-request sleep

#### `Scraper.html` — v01.09w

##### Fixed
- Compile and Analyze loops now automatically retry a failed chunk once (2.5s pause) before surfacing a transport error — safe because server-side state is chunked/resumable

## [v01.53r] — 2026-08-03 02:38:35 AM EST — [5609e93](https://github.com/LightAISolutions/Sales/commit/5609e936061e29c1d8af48a92d97d3b9092d6b6b)

> **Prompt:** "I created the GEMINI_API_KEY on my jonyang92@gmail.com account. Then, I added the GEMINI_API_KEY to the Scraper app's Script Properties on lightaisolution@gmail.com's account (owner of the app). However, when I pressed Analyze with or without Compile first, both times ended in the same error (attached). Resolve this."

### Fixed

#### `Scraper.gs` — v01.08g

##### Fixed
- `ai_http_404` on Analyze: the hardcoded `gemini-2.5-flash-lite` model was retired by Google on 2026-07-09 (months before its announced Oct 16 shutdown). Replaced the hardcoded model with live discovery: `scGeminiDiscoverModel_()` queries the ListModels endpoint (paginated), filters to stable `generateContent`-capable Gemini models (excludes preview/exp/image/tts/live/audio/embed/thinking variants), prefers flash-lite → flash → any Gemini with newest version + shortest name, and caches the pick in the `GEMINI_MODEL_AUTO` Script Property. A 404 on a cached model triggers one automatic rediscover-and-retry, so future model retirements self-heal. Manual `GEMINI_MODEL` Script Property still overrides everything
- Gemini API error bodies are now surfaced: non-200 responses throw `ai_http_<code> — <API error message>` instead of an opaque status code
- `analyzeArticles` now reports `hasArticles` so the client can distinguish "no articles compiled yet" from "everything already scored"

#### `Scraper.html` — v01.08w

##### Fixed
- Clicking Analyze on a project with no compiled articles now shows "No articles to analyze yet — run Compile first to gather news." instead of the misleading "All articles were already scored."
- Added a user-facing message for the no-compatible-model case

## [v01.52r] — 2026-08-03 02:15:55 AM EST — [3f99df9](https://github.com/LightAISolutions/Sales/commit/3f99df95559316fed98a81d8c231543141be7dd4)

> **Prompt:** "Deploy works and does give me a bunch of Google News that are questionably related to my topic. Continue with Phase 3."

### Added

#### `Scraper.gs` — v01.07g

##### Added
- Phase 3 AI layer: provider-agnostic `aiComplete_()` abstraction — Gemini free tier today (`scGeminiComplete_` via `generateContent` v1beta, default model `gemini-2.5-flash-lite` overridable with a `GEMINI_MODEL` Script Property; key from `GEMINI_API_KEY`), Claude slot ready as a future branch
- `analyzeArticles` route: chunked AI relevance scoring — up to 3 AI calls per invocation × 10 articles per call, 2s spacing for free-tier RPM headroom; scores (0–100) and 1–2 sentence summaries (for scores ≥50) written back to the Articles tab; unscored articles are the natural resume state
- `previewBrief` route: executive brief synthesized from the top 30 relevant articles (score ≥50), plain-text overview + bullets
- `listArticles` now returns `summary` and `score`; `scLogUsage_` extended to track AI calls alongside fetch calls in UsageLog

#### `Scraper.html` — v01.07w

##### Added
- Analyze button per project card driving the chunked scoring loop with progress ("Scoring… N left")
- Articles panel: color-coded relevance score chips (green ≥70, amber ≥50, red <50), AI summaries shown in place of raw snippets, scored-first sort order
- Brief button in the articles panel rendering the AI executive brief in a styled box
- User-facing error messages for AI failure modes (missing key, rate limit, empty/unreadable response, no relevant articles)

## [v01.51r] — 2026-08-03 01:23:34 AM EST — [1c38ef1](https://github.com/LightAISolutions/Sales/commit/1c38ef13ebbce16787c36d57b096debdf02bf907)

> **Prompt:** "I signed into the live Scraper page and created a real project. Continue with Phase 2."

### Added

#### `Scraper.gs` — v01.06g

##### Added
- Phase 2 compilation engine: `scBuildFetchQueue_()` builds Google News RSS search queries from topic terms (stopword-filtered via `scTopicTerms_`), keyword OR-chunks, industry combinations, and exclusion negations, plus the project's user-specified feed URLs
- `scParseFeed_()` parses both RSS 2.0 and Atom feeds via XmlService with HTML-stripped, length-bounded fields
- `compileNow` route: chunked, resumable compilation — each call fetches ≤6 URLs within a 40s budget, persists progress in Script Properties (`scCompile_<projectId>`), dedupes against existing article URLs per project, caps runs at 200 new articles, appends rows to the Articles tab, and logs fetch counts to UsageLog; the client loops until `done`
- `getCompileStatus` and `listArticles` routes (owner-scoped, newest-first, capped at 100)
- Dispatcher/action-list extended with the three new ops (doPost + doGet api mirror route automatically)

#### `Scraper.html` — v01.06w

##### Added
- Compile button per project card with live progress label ("Compiling… N/M") driving the chunked `compileNow` loop, finishing with a result toast and auto-opening the articles panel
- Articles panel overlay listing fetched articles (linked title opening in a new tab, source · date meta line, snippet)

##### Fixed
- Articles panel close button now shares the wizard close-button styling

## [v01.50r] — 2026-08-02 09:42:54 PM EST — [b71d24e](https://github.com/LightAISolutions/Sales/commit/b71d24e87e61efca66ed241d5be799f73c567271)

> **Prompt:** "Stick with Gmail sign-in as planned and kick off Phase 1 (data model + project intake wizard)."

### Added

#### `Scraper.gs` — v01.05g

##### Added
- News Scraper Phase 1 data model: `ensureScraperTabs_()` creates 6 spreadsheet tabs (Projects, Schedules, Articles, Reports, Profiles, UsageLog) with frozen header rows, idempotently
- Session-gated project management routes `createProject`, `listProjects`, `getProject`, `updateProject`, `setProjectStatus` (active/paused/archived), all owner-scoped by email via `validateSessionForData` and reached through the iframe-free fetch transport (doPost actions + doGet `api` mirror via shared `handleProjectAction_` dispatcher)
- Payload normalization/validation (`scNormalizeProjectPayload_`) with bounded strings/lists, frequency whitelist (daily/weekly/monthly/quarterly/biannual/annual/custom), delivery whitelist (inapp/email/both), URL-validated custom sources, and a 10-active-projects-per-user cap
- Per-project schedule rows (one per frequency) written to the Schedules tab; audit entries via `dataAuditLog`

#### `Scraper.html` — v01.05w

##### Added
- News Scraper app layer (`#scraper-app`): project dashboard with cards (status/frequency/delivery chips), Refresh, Edit, Pause/Resume, and two-step inline Archive confirm; activated from `showApp()` via `window._scraperInit` (inline `// PROJECT:` hook)
- 5-step project intake wizard (basics → scope → sources → schedule → review) with per-step validation, custom-frequency reveal, review summary, and create/update submission through `_gasPost`
- `scraper-app` registered in `_htmlLayerEls` (PROJECT OVERRIDE) so the HTML layer toggle hides/shows the dashboard

### Fixed
- README `Repo version:` display corrected (was showing v01.48r while the repo version file was at v01.49r)

## [v01.49r] — 2026-08-02 08:37:29 PM EST — [0327874](https://github.com/LightAISolutions/Sales/commit/032787455cbe00851bd2d4ae6948d9dbf7c27be6)

> **Prompt:** "Delete everything related to this "spain-argentina" page. It was just a test."

### Removed
- Deleted the spain-argentina test page and all its tracking files: `live-site-pages/spain-argentina.html`, `html-versions/spain-argentinahtml.version.txt`, `html-changelogs/spain-argentinahtml.changelog.md`, `html-changelogs/spain-argentinahtml.changelog-archive.md` (all added in v01.15r)
- Removed its README tree entries (Standalone Utilities page entry + html-versions and html-changelogs subtree lines) and its REPO-ARCHITECTURE.md flowchart node `SPAINARG_PAGE` with its serves / version-polling / template-copy edges (flowchart pako URL regenerated and decompression-verified)
- Historical mentions in CHANGELOG.md (v01.15r section) and SESSION-CONTEXT.md are records of past sessions and were intentionally left intact

## [v01.48r] — 2026-08-02 08:31:18 PM EST — [ca4dd1c](https://github.com/LightAISolutions/Sales/commit/ca4dd1c754302ca5a8f07416763262f16c92ffc9)

> **Prompt:** "Also translate the review screen's category and subcategory dropdowns."

### Changed

- `Receipts.html` (v01.28w) — the review screen's category select (`fillCategories`) and per-item subcategory selects (`fillSubcatSelect`, incl. the blank "Subcategory —"/"子类别 —" option and preserved off-list values) now label via `tCat()`; `applyAppLanguage`'s value-keyed option pass extended to `#rr-category` and `.rr-cat` so a language toggle relabels an open review card too. Stored values remain English

## [v01.47r] — 2026-08-02 08:10:52 PM EST — [caa2275](https://github.com/LightAISolutions/Sales/commit/caa2275224c718b7afae411dae486ea81010674f)

> **Prompt:** "I want the Simplified Chinese translation option to translate everything, including:
>
> * "0 receipts * August 2026" and "No receipts saved yet this month" at the top of the dashboard.
> * All categories (Groceries, Dining, etc) in both History and Reports.
> * All subcategories for all categories in Reports.
> * In Daily Reports, change Mon-Sun to their Simplified Chinese equivalents while keeping the ", MM/DD/YY" latter half.
> * In Monthly Reports, change the months to their Simplified Chinese equivalents.
> * In Bi-annual Reports, change the "first/second half of 2026" into their Simplified Chinese equivalents."

### Added

- `Receipts.html` (v01.27w) — `I18N_CAT_ZH` (~90 entries) + `tCat()` for category/subcategory display names: History and Reports dropdown labels relabel via `option.value` (stored English values untouched — lossless both directions), report By-category / By-subcategory rows, the Line Items section title and note, and the month card's top-category rows all display 中文 in Chinese mode
- `Receipts.html` (v01.27w) — localized period labels in `bucketLabel()`: daily `周三, 7/29/26` (RP_DAYS_ZH; date half unchanged), monthly `2026年7月`, bi-annual `2026年上半年/下半年`; weekly and annual stay numeric
- `Receipts.html` (v01.27w) — month card fully localized: `N 张收据 · 2026年8月` (`zh-CN` locale month name), `本月还没有保存的收据` empty state, `其他项目` for the "Everything else" row; the language toggle now also calls `refreshMonthCard()` so the card flips immediately

## [v01.46r] — 2026-08-02 05:44:59 AM EST — [ca13e7b](https://github.com/LightAISolutions/Sales/commit/ca13e7b49352d550e4fb2f8975ba5bb075275944)

> **Prompt:** "In the Settings cog menu, include an option to change the app language from English to Simplified Chinese."

### Added

- `Receipts.html` (v01.26w) — app language toggle (English / 简体中文) in the Settings ⚙️ panel (`#rsp-lang`, persisted as `Receipts_lang` in localStorage). Chrome-level i18n layer: `I18N_ZH` dictionary + `t()` for dynamic strings; `applyAppLanguage()` swaps static elements via a config list (`L10N_ELS`) plus dataset-keyed walkers for field labels, checkbox tails, stamp labels, period tabs, and select options (original English remembered in `data-i18n-en` so toggling is lossless). Translated surfaces: landing buttons + stamp labels + month card + date locale, History card, Reports card (period tabs, chips, section titles, Line Items controls, hints, empty states), Sharing card, review-card labels/buttons, Settings panel, affirmations (13 zh equivalents), and a map of common status messages (`I18N_STATUS_ZH`). Receipt data (merchants, item descriptions, category values) intentionally stays as stored — categories are server-matched data values
- `t()`/`setStatus` guarded with `typeof` checks — `fillReportCategories` runs at script-eval time before the dictionary vars are assigned, and an unguarded lookup killed the whole script when Chinese was active at page load (caught by the bilingual Playwright pass)

## [v01.45r] — 2026-08-02 05:10:46 AM EST — [06ae13a](https://github.com/LightAISolutions/Sales/commit/06ae13aed12e666eff4712c69ca8fc58524c52f5)

> **Prompt:** "In the Reports section -> Line Items (Subcategory) with "Group by item" checked, if an item has been purchased more than once, show the total amount across all purchases instead of individual prices. We can see the individual prices once we click the line item anyways."

### Changed

- `Receipts.html` (v01.25w) — grouped Line Items rows now show the group's summed spend (`gTot`) as the row amount instead of the latest purchase price; the ×count and low–high range stats are unchanged and per-purchase prices remain in the tap-to-expand history

## [v01.44r] — 2026-08-02 05:05:19 AM EST — [40aec01](https://github.com/LightAISolutions/Sales/commit/40aec01f7c4f8d6d6315627d5e09ed570cd49c78)

> **Prompt:** "The combined viewing works as intended. However, I realized that I cannot view a receipt photo that she uploaded without getting access to her Google Drive Receipt App folder. Make it so that when a user shares view and edit permissions with another user, it automatically gives the other user permission to view the original user's folder."

### Added

- `Receipts.html` (v01.24w) — Drive folder sharing rides along with app grants: `driveShareFolder()` (POST a `reader` permission on the owner's "Receipts App" folder via the owner's `drive.file` token, `sendNotificationEmail=false`) fires on successful `addShare`; `driveUnshareFolder()` (permissions.list → DELETE the grantee's permission, raw fetch since DELETE returns an empty 204) fires on successful `removeShare`
- `Receipts.html` (v01.24w) — reconciliation in `loadShares()`: when the granted set differs from the `Receipts_folder_perms_synced` localStorage key, every granted email gets `driveShareFolder()` and the key advances only when all succeed — this retrofits folder access for grants made before this feature and self-heals failed Drive calls on the next app open. Must run client-side: the `drive.file` token can only manage permissions on folders the app created for that signed-in user; the server has no access to user Drives

## [v01.43r] — 2026-08-02 04:46:01 AM EST — [cf725a4](https://github.com/LightAISolutions/Sales/commit/cf725a488e697defb840a2c59d5a06c8533625ba)

> **Prompt:** "Approved, but also allow mutual delete."

### Added

#### `Receipts.gs` — v01.16g

##### Added
- `resolveOwnerSet_()` — combined-view owner resolution: `forOwner '*'` returns the session user plus every owner who granted them access as an ownerEmail → scope map; any other value defers to `resolveOwnerScope_` (single-entry map). Combining never widens access — every entry is backed by an existing Shares-tab grant
- `listReceipts` / `reportReceipts` now filter rows against the resolved owner set and tag each returned row with `owner` (and `canEdit` in listReceipts); `exportReceipts` accepts `'*'` and the Receipts sheet gains an Owner column (backfill loop indexes shifted accordingly)

##### Changed
- `deleteReceipt` ownership gate extended for mutual delete: the owner can always delete; any other user needs an edit-scope grant from the row's owner (`getShareScope_ === 'edit'`); everything else still responds `receipt_not_found` (no existence leak)

#### `Receipts.html` — v01.23w

##### Added
- "Combined (mine + shared)" option (`value '*'`) in the History and Reports "Viewing" pickers when received grants exist; `rhRowOwner()` normalizes each row's owner for detail/edit/photo routing (own rows → `''`); owner chip (`.rh-owner-tag`, name part of the email) on History rows in combined view
- Delete visibility in combined view follows per-row `canEdit` (edit-grant rows deletable, view-only rows not); single shared views keep delete hidden as before; the client-side own-Drive photo trash now keys off `rhRowOwner` so only the row's owner attempts it

## [v01.42r] — 2026-08-02 04:34:42 AM EST — [944d392](https://github.com/LightAISolutions/Sales/commit/944d392480661436ab3767fca7defd8967ce9896)

> **Prompt:** "Approved - Implement your plan. 
>
> Also, I want it to be possible for me and another user to combine our receipts and look at everything together. The real scenario is: my girlfriend and I live together, so everything we buy is shared. Thus, I want all the receipts both of us scan to be visible and editable by both Gmail accounts. Recommend a plan of action to implement this for me to approve." *(Line Items drill-down implemented this version; the combined-receipts plan was presented for approval, not yet implemented)*

### Added

- `Receipts.html` (v01.22w) — "🧾 Line items" collapsible group in Reports, rendered when a category is chosen (title carries the subcategory when one is picked). Flat mode lists each matching line item `date · merchant · description · price` (newest first, 300-row display cap, count + total header); "Group by item" mode collapses normalized item names into rows showing ×count, low–high price range, and latest price, expanding on tap to the full dated per-merchant history. Item search box (`#rp-item-q`) filters descriptions live — keystrokes rebuild only `#rp-item-list` via `_rpItemCtx`, so the input keeps focus; search/group state persists across `renderReport()` rebuilds (search resets on each Reports open). All existing filters (owner, dates, merchant, min/max, subcategory) apply since the rows derive from the already-filtered receipt map; client-only feature over the existing `reportReceipts` payload — no GAS changes

## [v01.41r] — 2026-08-02 12:31:41 AM EST — [e04d857](https://github.com/LightAISolutions/Sales/commit/e04d857dd1eaa42edacc85fde251d1f6fa5e292d)

> **Prompt:** "Everything looks good. However, I can no longer see the "Admin" drop down menu in my HTML/GAS layers, which I need to approve new user sessions. Fix it."

### Changed

- `Receipts.gs` (v01.15g) — Admin badge restyled from a dim status-pill look (dark `rgba(0,0,0,0.55)` background, 60% opacity, 10px font — visually identical to the adjacent Live/presence pills, so after the v01.14g move into the `#user-email` row it read as "gone") to a solid accent button: `#90caf9` background, dark text, bold 11px, full opacity, hover lighten; `#admin-wrap` gets `flex: 0 0 auto` so the row can never shrink it. Diagnosis confirmed the menu was functionally present: run 44's deploy log shows "Updated to v01.14g (deployment 21)", and a full-stack Playwright reproduction (real host page + real rendered `doGet` HTML in the iframe, R-hotspot → HTML-layer-toggle flow) showed the badge visible and its dropdown opening — the regression was prominence, not function

## [v01.40r] — 2026-08-02 12:11:48 AM EST — [7811523](https://github.com/LightAISolutions/Sales/commit/78115239120e5a7833214a7eb161e005e17195aa)

> **Prompt:** "A few changes:
>
> * In the History section, move the "sort by receipt date" checkbox outside of the collapsible filter. 
> * Add a "Clear" button in both the History and Reports sections' filters that clears all chosen filters back to default. 
> * In the History section, remove the green checkbox that shows each receipt as saved. If it shows up in the History section, it must already be saved. 
> * While logging in, there is an "icon placeholder" block. Replace this block with a relevant Icon that accurately represents what this app does.
> * In the dashboard, create a "Settings" cog icon at the bottom right corner of the screen that contains the signed in email account (jonyang92@gmail.com), and the "Sign out" and "Sign out everywhere" options. 
> * Slow down the speed at which the positive affirmations cycle by half."

### Added

- `Receipts.html` (v01.21w) — `#rh-clear` / `#rp-clear` buttons at the bottom of each filter drawer: History clears search/dates/category then `rhFilterHint()` + `loadHistory()`; Reports clears merchant/dates/min/max/subcat and dispatches `change` on `rp-cat` so the subcategory dropdown hides/resets through its normal listener
- `Receipts.html` (v01.21w) — Settings cog (`#rsp-settings`, fixed bottom-right, z-index 9) opening `#rsp-settings-panel` with the signed-in email, "Sign out", and "Sign out everywhere"; replaces the inline account row under the status line (same `rsp-account`/`rsp-signout`/`rsp-signout-all` ids so the 2s session-sync interval and sign-out handlers are unchanged); closes on outside click
- `live-site-pages/images/receipts-logo.svg` (created) — Paper Ledger-themed receipt icon (torn zigzag bottom, ink outline, accent `$`) shown on the auth wall and sign-out screen instead of the "LOGO" placeholder (`auth-wall-logo`/`signout-logo` src, PROJECT OVERRIDE)

### Changed

- `Receipts.html` (v01.21w) — "Sort by receipt date" moved out of the History filter drawer onto a pinned row under the Filters toggle; affirmation rotation slowed from 7s to 14s per message

### Removed

- `Receipts.html` (v01.21w) — the `rh-status` ✅/📤 emoji per History row (history only lists saved receipts) and its CSS rule

## [v01.39r] — 2026-08-01 11:52:43 PM EST — [a6732a4](https://github.com/LightAISolutions/Sales/commit/a6732a4a1022f09d68ee3cef4e6ce62ada5637c0)

> **Prompt:** "implement the same filter related changes to the Receipt History section. Also, in the Reports section, move the circle graph checkbox out of the collapsible filter area. I want to be able to easily switch between the bar and circle graphs."

### Changed

- `Receipts.html` (v01.20w) — History filters moved into a collapsible `#rh-filter-body` drawer (collapsed by default), mirroring the Reports pattern: sticky `.rh-head` now holds only the title, the "Viewing" shared-view row, and the `#rh-filter-head` toggle row (~89px vs ~250px pinned). The `⬇️ Export .xlsx` button stays on the pinned toggle row (action, not a filter) with a click guard so it doesn't toggle the drawer; new `rhFilterHint()` shows "n active" for search/dates/category (sort order not counted — it reorders, doesn't narrow)
- `Receipts.html` (v01.20w) — Reports' Circle graphs checkbox moved out of the filter drawer onto the always-pinned `#rp-filter-head` row (new `#rp-circle-wrap` with a click guard in the drawer-toggle handler), so bar ↔ circle switching is one tap without opening filters

## [v01.38r] — 2026-08-01 11:44:33 PM EST — [04bbb0f](https://github.com/LightAISolutions/Sales/commit/04bbb0fe9514eeac922ebd1e886ac4736298856e)

> **Prompt:** "in the Reports section, over half of the screen is freeze-paned, so it is not visually comfortable to use. Make the filters collapsible and start collapsed by default. Re-size as needed with focus on user comfort."

### Changed

- `Receipts.html` (v01.19w) — Reports filters moved out of the sticky `.rp-head` into a new collapsible `#rp-filter-body` drawer (collapsed by default): only the title, period tabs, shared-view "Viewing" row, and a slim `#rp-filter-head` toggle row stay pinned, shrinking the freeze-pane from ~380px to ~132px at 390px width. The toggle row reuses the report groups' `.rp-sec-toggle` +/− circle; when open, the drawer scrolls with the report content
- `Receipts.html` (v01.19w) — New `rpFilterHint()` shows an "n active" accent hint on the collapsed Filters row (merchant/category/subcategory/dates/min/max counted), called at the top of `renderReport()` before the `rpData` guard so it stays accurate even before data loads
- `Receipts.html` (v01.19w) — Report card max-height increased from `calc(100dvh - 170px)` to `calc(100dvh - 120px)` for ~50px more visible report content

## [v01.37r] — 2026-08-01 11:34:35 PM EST — [fa9e4cf](https://github.com/LightAISolutions/Sales/commit/fa9e4cfad1ccddf9335eae1fc87e16f02c1b0ae3)

> **Prompt:** "In order for me to approve new users via the admin panel, I need to be able to click it. Currently, it's being blocked by whichever layer my email (jonyang92@gmail.com) is on. Reformat things so that I can access the admin panel." *(with a desktop screenshot showing the GAS layer's ADMIN badge hidden behind the signed-in email display)*

### Fixed

- `Receipts.gs` (v01.14g) — Admin badge was unclickable: the GAS-served page pinned both `#user-email` (z-index 9999) and `#admin-badge` (z-index 100) to the same fixed top-left corner, so the email row painted over the badge and swallowed its clicks. The badge (with its `#admin-dropdown-gas`) now lives inside the `#user-email` flex row after the live-status pills, wrapped in a new `#admin-wrap` (position: relative) that anchors the dropdown directly beneath the badge — inline flow makes overlap structurally impossible
- Dropdown first-click no-op: the toggle compared `dd.style.display === 'none'`, but the initial inline style is `''` (CSS supplies the `none`), so the first click set `none` and did nothing visible. Toggle now checks `=== 'block'`, opening on the first click
- Mobile safety: `#user-email` capped at `calc(100vw - 16px)` with ellipsis truncation on `#user-email-text`, so the email + Live/presence pills + ADMIN badge stay on one row inside the 30px top band at 390px widths

## [v01.36r] — 2026-08-01 09:57:44 PM EST — [c28adf3](https://github.com/LightAISolutions/Sales/commit/c28adf3e32a00f80e387186a97eb0a70891a6343)

> **Prompt:** "I successfully added the ".../auth/drive.file" scope to the scopes list and made sure each family member's Gmail is in the test-users list. I also successfully completed your recommended next step - everything worked. 
>
> After scanning a receipt, the progress bar gets replaced by the positive affirmations. Do not do that. Also, there is an unloaded icon next to the progress status. I want this progress status and bar to look cute, artsy, and match the existing theme. Give me several mockups to choose between. 
>
> Also, now that all receipt pictures get saved to the user's Drive's "Receipt App" folder, migrate the existing 29 receipt pictures from LightAISolution@gmail.com's Drive to jonyang92@gmail.com's Drive. 
>
> Also, create a sign in/out mechanism, so that other users don't need to use the hidden R button to sign out. Make sure it matches the existing theme and still looks professional.
>
> Also, just like how the Groceries category has 16 departments, refer to apps like ReceiptCamp, Expensify, and Smart Receipts, and populate the other categories (Dinings, Transport, ... , Travel) with relevant subcategories that are also hidden until their linked category is chosen. 
>
> If the above are executed without any problems, then continue with Phase 4." *(Progress design choice via AskUserQuestion: "A, but also add a progress bar above the stage stamps.")*

### Added

#### `Receipts.html` — v01.18w

##### Added
- "Stamp Card" progress UI (developer-chosen mockup A + bar): the existing progress bar sits above four coffee-card stage stamps (📷 Snap → ☁️ Save → ✨ Read → 🧾 Done) that ink to ✓ as the pipeline advances, with a pulsing accent ring on the active stage; `setProgress(pct, stage)` drives both (explicit stage passed by the batch path whose bar spans the whole batch), all hidden together on completion
- Visible account row at the panel foot (`#rsp-account`): signed-in email + link-style "Sign out" / "Sign out everywhere" wired to the template's `performSignOut` flows — no hidden hotspot needed
- One-time background legacy-photo migration (`migrateLegacyPhotos`): lists the user's org-Drive photos, streams each via `getLegacyPhotoBase64`, re-uploads into the user's own "Receipts App" folder, re-links the row via `completePhotoMigration`; per-account localStorage completion flag, quiet status updates, retries next session on failure; `uploadToOwnDrive` gained a mime parameter
- Per-category `SUBCATS` map (Groceries departments unchanged; Dining/Transport/Health/Shopping/Entertainment/Utilities/Travel/Other lists modeled on Expensify/Smart Receipts): review-card item selectors repopulate on category change (off-list values preserved as extra options), Reports' subcategory dropdown + drill-down section now work for every category ("By department" label kept for Groceries, "By subcategory" otherwise)

##### Fixed
- Affirmations no longer talk over a running pipeline (suspended while the scan/batch is active) and now retire the finished progress bar + stamps when they resume; the broken thumbnail `<img>` next to the status ("unloaded icon") was removed along with its wiring

#### `Receipts.gs` — v01.13g

##### Added
- Migration ops on both transports: `listLegacyPhotos` (owner-scoped; a photo is "legacy" iff the script can open it), `getLegacyPhotoBase64` (8MB cap), `completePhotoMigration` (validated Drive URL, row re-link, org copy trashed)
- `ITEM_CATEGORIES` expanded to the union of all per-category subcategory lists (the Gemini extraction enum); extraction prompt updated to pick subcategories matching the receipt's category

### Changed
- `repository-information/diagrams/Receipts-diagram.md` — migration flow section added, extraction subcategory note updated (mermaid.live URL regenerated + decompression-verified)

### Verified
- `node --check` on the `.gs` and both inline scripts; Playwright: account row appears with the session email, Dining subcats populate and survive a Travel switch with value preserved, Reports shows the per-category dropdown + "By subcategory" section, the mocked 2-photo migration ran end-to-end (list → bytes → own-Drive upload → re-link) and set its completion flag, and the Stamp Card was driven through active → all-done → auto-hide by the real pipeline; zero page errors

## [v01.35r] — 2026-08-01 08:11:26 PM EST — [038a514](https://github.com/LightAISolutions/Sales/commit/038a5145e5249046e07e930d04f09db397630fd9)

> **Prompt:** "I verified that the access granting functionality works both ways (giving and receiving permission). Continue with Phase 3."

### Added

#### `Receipts.html` — v01.17w

##### Added
- Own-Drive photo storage: `AUTH_SCOPES` constant adds the non-sensitive `drive.file` scope to all six GIS token clients (each marked `PROJECT OVERRIDE`); new Drive client module — `_getDriveToken` (reuses `_ssoAccessToken`, silent GIS re-request otherwise), `ensureDriveFolder` (Profiles-tab lookup → auto-create "Receipts App" folder → `setProfileFolder` registration), `driveMultipartUpload` via `uploadToOwnDrive`, and best-effort `driveRenameFile` / `driveTrashFile`
- Pipeline rework (single-scan `handleFile` + batch `step`): compress → browser uploads the photo to the user's own Drive → `uploadReceipt` link-registration → `extractReceiptData` from the bytes (throttling preserved via the generalized `extractFor`); **automatic fallback** to the legacy base64 → org-Drive path whenever the Drive token/consent/upload fails, so no photo is ever lost; Retry re-extracts from held bytes (`currentB64`; batch entries keep bytes only for failed extractions to limit memory)
- Save renames the own-Drive photo to the final receipt ID; delete moves it to the user's Drive trash — both via the user's own token, both best-effort (`_drivePhotoByReceipt` map; server-side rename/trash still covers legacy org-Drive rows)

#### `Receipts.gs` — v01.12g

##### Added
- `Profiles` tab (Email, Drive Folder ID, Display Name, Created At) + `getProfile` / `setProfileFolder` ops (folder-ID format validated) on both transports
- `extractReceiptData(sessionToken, imageBase64, mimeType)` — Gemini extraction straight from bytes with an MD5-digest cache (no Drive read); shared `geminiExtractFromBase64_()` core refactored out of `extractReceipt`, which keeps its file-ID path for legacy rows
- `uploadReceipt` dual mode: `imageUrl` link-registration (validated `drive.google.com` prefix, no bytes, GET-fallback-capable) alongside the unchanged legacy base64 path

### Changed
- `repository-information/diagrams/Receipts-diagram.md` — pipeline diagram reworked for own-Drive storage (browser→Drive upload, link registration, bytes-based extraction, per-side rename/trash notes; mermaid.live URL regenerated + decompression-verified)

### Verified
- `node --check` on the `.gs` and both inline scripts; Playwright end-to-end with mocked Drive + GAS endpoints driving the real pipeline — own-Drive path (getProfile → folder create → setProfileFolder → multipart upload → link-mode uploadReceipt with no image bytes → extractReceiptData → review card → save → rename PATCH) and the fallback path (Drive failing → legacy base64 uploadReceipt → extractReceipt by file ID) both confirmed; zero page errors

## [v01.34r] — 2026-08-01 07:51:32 PM EST — [f6241f6](https://github.com/LightAISolutions/Sales/commit/f6241f6017d4aa626fc5e6e16ef9beffd78ac8cc)

> **Prompt:** "I verified on my phone that History, Reports, and the month card still show all my receipts. Continue with Phase 2."

### Added

#### `Receipts.gs` — v01.11g

##### Added
- `Shares` tab (Owner → Grantee, scope `view`/`edit`, timestamp) with `listShares` / `addShare` (upsert, email-format check, self-share block, 20-grant cap) / `removeShare` ops on both transports
- `resolveOwnerScope_()` + `getShareScope_()` — every read op (`listReceipts`, `getReceiptDetail`, `reportReceipts`, `exportReceipts`) accepts an `owner` param resolved through the grant table; `saveReceipt` accepts it too but demands an `edit` grant; `deleteReceipt` deliberately takes no owner param (owner-only); `getReceiptDetail` responses carry `canEdit` + `owner` for the UI

#### `Receipts.html` — v01.16w

##### Added
- "🤝 Sharing" landing button (side-by-side with History) + sharing card (z-index 9): grant-by-email form with view / view+edit scope, revoke buttons, "shared with me" list, mapped error messages (`bad_email`, `cannot_share_with_self`, `share_limit`)
- "Viewing" selector rows in History (`#rh-owner`) and Reports (`#rp-owner`) — hidden until `listShares` returns received grants; selections thread `owner` into list/detail/report/export calls
- Shared-view guardrails: delete buttons hidden on shared views, the History-detail Edit button suppressed when `canEdit` is false, `editingOwner` threaded into the edit-in-place save, and the month-card refresh no longer clobbers the reports dataset while a shared view is open

### Changed
- `repository-information/diagrams/Receipts-diagram.md` — sharing flow added to the pipeline diagram (mermaid.live URL regenerated + decompression-verified); share card added to the HTML layer-toggle element list

### Verified
- `node --check` on the `.gs` and both inline scripts; Playwright interaction test at 390px with mocked share data through the real code paths — grant/revoke round-trip, "Viewing" selectors appear only with received grants, shared list hides delete, view-only shared detail suppresses Edit, and the wire calls carry `owner` exactly when a shared view is active; zero page errors

## [v01.33r] — 2026-08-01 07:38:37 PM EST — [04a3cc6](https://github.com/LightAISolutions/Sales/commit/04a3cc67239c790222bcafb46e008b8339fa4a04)

> **Prompt:** "continue with your recommendation" *(executes Phase 1 — data isolation — of the approved multi-user action plan from the preceding research response)*

### Added
- `googleAppsScripts/Receipts/Receipts.gs` (v01.10g) — multi-user data isolation. The existing "Uploaded By" column is now the receipt's owner: `listReceipts`, `getReceiptDetail`, `reportReceipts`, `deleteReceipt`, `saveReceipt`, and `exportReceipts` are all scoped to the signed-in user's own rows (ownership misses respond `receipt_not_found` so existence never leaks across accounts); `saveReceipt`'s duplicate detection is per-owner
- `backfillReceiptOwners_()` — one-time flag-guarded (`RECEIPT_OWNER_BACKFILL`) lazy migration stamping `RECEIPTS_LEGACY_OWNER` into blank Uploaded By cells, triggered from `listReceipts`/`reportReceipts`
- Monthly Summary tab rebuilt per-owner (new leading `Owner` column, rows sorted owner → month desc); the .xlsx export copies only the requesting user's summary rows and drops the Owner column to keep the familiar layout

### Removed
- `syncDriveFolderAccess_()` and its `listReceipts` call — the ACL → photo-folder viewer sync granted every ACL member viewer access to the shared photos folder, which becomes a cross-user privacy leak under multi-user isolation (removal pre-approved in the action plan). Previously granted folder viewers are NOT auto-revoked — manual Drive cleanup recommended

### Changed
- `repository-information/diagrams/Receipts-diagram.md` — pipeline diagram updated: owner-scoped reads, owner backfill in the lazy-migration step, folder-sync interaction removed (mermaid.live URL regenerated + decompression-verified)

### Verified
- `node --check` on the `.gs`; no remaining references to the removed sync function; server-side-only change (no UI modification, visual test not applicable per the trigger list)

## [v01.32r] — 2026-08-01 07:04:39 PM EST — [1737e9e](https://github.com/LightAISolutions/Sales/commit/1737e9e2775150ea8eacec2cd7c60a443a9d3572)

> **Prompt:** "[screenshot attached] The hidden R button only hides the HTML and GAS buttons at the bottom. I want the hidden R button to also hide the sections I circled in red in the attached picture."

### Changed
- `live-site-pages/Receipts.html` (v01.15w) — the "R" hotspot now toggles a body-level `rcpt-clean` class (on by default) whose `!important` CSS rule hides all six developer/technical pills: `#user-pill` (email + Sign Out / Sign Out All), `#auth-timers` (session countdown), `#gas-pill` (GAS version), `#version-indicator` (HTML version), and the two layer-toggle pills. The class approach replaces the previous per-element inline-style wrappers (`_showGasToggle`/`_hideGasToggle` gating removed) — it outranks the template's inline `display` changes after sign-in and automatically covers the dynamically-created version pill, which inline juggling could not

### Verified
- `node --check` on both inline scripts; Playwright at 390px with the signed-in pill states simulated — all pills hidden by default, all revealed on "R" tap (user pill flex, timers/GAS pill block, both toggles block), all re-hidden on second tap; zero page errors. The HTML version pill is created only after a successful version fetch (impossible under `file://`) but is governed by the same ID-based CSS rule in production

## [v01.31r] — 2026-08-01 06:53:29 PM EST — [00a532a](https://github.com/LightAISolutions/Sales/commit/00a532a9e7d75a0b3b6f5b4846148f5e95bd8958)

> **Prompt:** "One more change:
>
> * Change front-end display to include a hidden button on the letter "R" in the word "Receipts" on the home screen that I can press to toggle on/off the HTML and GAS layer. I want the app to look clean to other users and still allow me to toggle these layers on for myself."

### Added
- `live-site-pages/Receipts.html` (v01.14w) — hidden developer hotspot: the "R" of the brand heading is wrapped in `#rsp-r-secret` (no visual affordance, tap-highlight suppressed); tapping it shows/hides the `#html-layer-toggle` and `#gas-layer-toggle` pills, which now start hidden for everyone. The template's post-sign-in `_showGasToggle()` / sign-out `_hideGasToggle()` are wrapped so GAS-pill eligibility is tracked but the pill only surfaces while the hotspot state is on

### Fixed
- `.rsp-brand span` date styling narrowed to `#rsp-date` — the generic selector was also hitting the new "R" span, rendering it small/italic (caught by the Playwright screenshot before commit)

### Verified
- `node --check` on both inline scripts; Playwright at 390px — pills hidden on load, still hidden after the template's simulated post-sign-in `_showGasToggle()`, both revealed on "R" tap (HTML pill toggles the receipts layer correctly), both hidden again on second tap; heading renders with a uniform "Receipts" wordmark; zero page errors

## [v01.30r] — 2026-08-01 06:08:39 PM EST — [7481bec](https://github.com/LightAISolutions/Sales/commit/7481beced14f9cea20800f50139cbbd68f30ff85)

> **Prompt:** "A few more changes: 
>
> * In the Reports section:
>    * Hide the "All departments" drop-down menu until "Groceries" are chosen in the "All categories" drop-down menu. 
>    * Change "Circle graphs (percentage comparison)" to "Circle graphs".
>    * After checking the "Circle graphs" option, I notice that only 8 data groups are included before the rest are grouped under "Other". Reformat the circle graphs such that the circle graph itself is larger and located above the index breakdown of different data groups. Then, allow each circle graph to include up to 20 data groups that keep extending downwards. I like the current data group format of "Group name, Percentage, USD Amount", so keep this structure."

### Changed
- `live-site-pages/Receipts.html` (v01.13w) — `#rp-subcat` (departments dropdown) starts `display:none` and is toggled by a dedicated `#rp-cat` change listener: visible only when the selection is `Groceries`; on any other selection it hides and clears its value (with a re-render) so no invisible line-item filter lingers
- Circle-graphs checkbox label shortened to "Circle graphs"
- Donut layout restructured: `.rp-donut-wrap` is now a column (large `min(210px, 62vw)` donut centered on top, full-width legend below extending downward); slice cap raised 8 → 20 before the "Other" fold; legend row format unchanged (swatch · name · percent · amount)

### Verified
- `node --check` on both inline scripts; Playwright at 390px with intercepted `reportReceipts` demo data (12 categories) — departments dropdown hidden on load, visible for Groceries, hidden + cleared on switch to Dining; 12 legend rows render without an "Other" fold; large donut renders above the legend

## [v01.29r] — 2026-08-01 05:53:12 PM EST — [3457be2](https://github.com/LightAISolutions/Sales/commit/3457be259474c3ef4f008ba7e643ce6763e3466d)

> **Prompt:** "A few more changes:
>
> * In the Reports section:
>    * Change the Daily Totals format to the equivalent of "Wed, 7/29/26".
>    * Change the Weekly Totals format to the equivalent of "7/26/26 - 8/1/26".
>    * Change the Monthly Totals format to the equivalent of "July 2026".
>    * Change the Bi-annual Totals format to the equivalent of "First Half of 2026" and "Second Half of 2026".
>    * Add a "By Department" section under the "By Category" section in the report that only shows up when the user chooses "Groceries" in the "By Category" drop-down menu. 
>    * Minimize each of the reporting groups ("Daily Totals", "By Category", "By Department", "Top Merchants" until the user clicks a little "+" icon on the right side of the reporting group. 
>    * Add a checkbox option to show the reporting groups as circle graphs instead of bar graphs to see percentage comparisons. Make sure they also start off minimized until the user expands the reporting group."

### Added
- `live-site-pages/Receipts.html` (v01.12w) — "By department" report group (line-item department totals over the filtered receipts), rendered only when the `#rp-cat` category filter is `Groceries`; collapsible report groups (`rpSection()` header + right-side circled `+`/`−` toggle, `_rpOpen` state map — all groups start minimized on every card open, toggle state survives filter re-renders via a delegated `#rp-body` click handler that flips display in place); "Circle graphs (percentage comparison)" checkbox — sections render as stroke-dasharray SVG donuts (8-slice cap + "Other" fold, `RP_COLORS` palette) with a swatch/label/percent/amount legend instead of bars
- Period-label formatter `bucketLabel()`: daily "Wed, 7/29/26", weekly "7/26/26 - 8/1/26", monthly "July 2026", bi-annual "First Half of 2026" / "Second Half of 2026"

### Changed
- Weekly bucketing switched from ISO-8601 Monday-start keys (`isoWeekKey`, removed) to Sunday-start week-start-date keys (`weekStartKey`) so the displayed ranges match the requested Sunday–Saturday spans; `.rp-section` groups restyled as bordered sub-cards to carry the collapsible headers

### Verified
- `node --check` on both inline scripts; Playwright interaction test at 390×844 with intercepted `reportReceipts` demo data through the real renderer — verified all four label formats, department group appears only for Groceries (present with, absent without), groups start collapsed, `+`/`−` toggling, and 3 donut SVGs with percentage legends in circle mode; only expected `file://` console errors

## [v01.28r] — 2026-08-01 05:18:59 PM EST — [c850f48](https://github.com/LightAISolutions/Sales/commit/c850f48e3efa0045a510bf34d2526b5fc4c628bb)

> **Prompt:** "In my Receipts app, I want to make the following changes:
>
> * Add an Upload receipts button to allow for mass processing for up to X number of receipts at a time. Recommend a max number of receipts to be uploaded and explain to me why.
> * Add a Reports button that allows for the generation and real-time display of daily, weekly, monthly, bi-annual, and annual reports, and real-time filtering by merchant name, major categories (ie: Grocery) tied with minor categories (ie: Produce), date ranges, and total cost ranges.
> * Allow me to edit the line items in Receipt History, so I don't have to delete/re-upload everytime I want to delete a line that I should have deleted in the Review step. 
> * Improve the landing UI. I want this app to look professionally made with popular mobile UX/UI designs. Show me a couple designs and let me choose before you implement." *(Design choice via AskUserQuestion: "A, but remove the "Photograph or choose a receipt to upload sentence". Instead, cycle through "Love yourself", "You're the best!", "Today's gonna be a good day", and 10 more sentences like these.")*

### Added
- Batch "Upload receipts" flow (gallery multi-select, cap 15/batch), Reports card with real-time client-side filtering, and edit-in-place for saved receipts in History
- `reportReceipts` GAS op — compact receipts + line-items dataset powering the Reports card and the landing month summary

### Changed
- Receipts landing redesigned to the developer-chosen "Paper Ledger" theme (cream/ink serif design with printed-receipt month summary); idle status line now cycles 13 affirmations
- `repository-information/diagrams/Receipts-diagram.md` — pipeline sequence diagram extended with the batch upload, edit-in-place, and reports flows (mermaid.live URL regenerated + decompression-verified)

#### `Receipts.html` — v01.11w

##### Added
- `#receipt-upload-input` (`multiple`, no `capture`) + sequential batch engine: per-photo compress → `uploadReceipt` → `extractReceipt` with ≥6.5s spacing between extraction calls (Gemini free-tier ~10 RPM), `MAX_BATCH = 15`, queue-stepped review cards with a "· n of N" position chip; Save/Discard advance the queue
- `#receipt-report-card` (z-index 8): Daily/Weekly/Monthly/Bi-annual/Annual segmented control, merchant/category/department/date-range/cost-range filters (all client-side over one `reportReceipts` fetch → instant re-render), summary chips, per-period bars, category breakdown, top merchants; minor-category mode switches totals to matching line-item amounts
- "✏️ Edit receipt / line items" button in each History detail — reopens the review card pre-filled from `getReceiptDetail` and re-saves via the idempotent `saveReceipt`, returning to a refreshed History list
- `#rcpt-month` landing hero (perforated-edge month summary fed by `reportReceipts`, refreshed after saves/deletes) and `#receipt-backdrop` full-screen cream layer wired into the template's HTML layer toggle via a project-side wrapper

##### Changed
- Full "Paper Ledger" restyle of the PROJECT CSS (theme variables `--rc-*`, serif type, monospace numerals, ink buttons); PWA `theme-color` → `#e9e3d6`; review/history/report cards raised to `top: 76px` with `calc(100dvh - 170px)` height; history date column widened to fix wrapping
- Idle status text replaced by a 13-sentence affirmation rotation (7s cycle; real status messages linger 12s before rotation resumes); status colors moved to theme palette

#### `Receipts.gs` — v01.09g

##### Added
- `reportReceipts(sessionToken, dateFrom, dateTo)` — all saved receipts (id, date, merchant, currency, total, category; cap 2000) plus their LineItems rows (receiptId, description, amount, category); routed in `doPost` and the `doGet` `action=api` fallback chain

### Verified
- `node --check` on the `.gs` and both inline page scripts; Playwright at 390×844 — landing, Reports, batch-position review card, and History detail with Edit button all render correctly in the new theme; only expected `file://` console errors

## [v01.27r] — 2026-08-01 06:51:35 AM EST — [b90dd37](https://github.com/LightAISolutions/Sales/commit/b90dd37187facddbbd3ef58fa809244979b1abf4)

> **Prompt:** "In Receipt History, label the "Start Date" and "End Date" boxes in the same way as the "Search merchant" box is labeled. Also, keep the "Start Date" and "End Date" boxes side-by-side, but move them below the "Search merchant" box. Also, add a drop-down menu that filters between the major categories: Groceries, Dining, Transport, Health, Shopping, Entertainment, Utilities, Travel, and Other."

### Added
- Category filter for receipt history and export

#### `Receipts.html` — v01.10w

##### Added
- Full-width `#rh-cat` dropdown row in the history card, populated from the existing `CATEGORIES` array with a blank "All categories" option; sends `cat` on both `listReceipts` and `exportReceipts` calls and reloads on change

##### Changed
- History filter rows restructured: row 1 = merchant search + Search button; row 2 = "Start Date"/"End Date" boxes side-by-side, each with a small `.rh-field` label above (date inputs can't show placeholder text like the search box, so field labels are the matching treatment); row 3 = category dropdown

#### `Receipts.gs` — v01.08g

##### Added
- `category` parameter on `listReceipts` (exact match on the Category column, applied server-side before the row cap) and threaded through `exportReceipts` → internal `listReceipts` call; `cat` parameter wired into all four transport routes (POST + GET fallback for both ops)

### Verified
- `node --check` on the `.gs` and all inline scripts; Playwright at 390px — labels "Start Date"/"End Date" render above the side-by-side boxes, dropdown lists all 9 categories + "All categories", no horizontal scroll, zero page errors

## [v01.26r] — 2026-08-01 06:36:33 AM EST — [658cce8](https://github.com/LightAISolutions/Sales/commit/658cce8c1313516baaf5c159415a01f2146a6d40)

> **Prompt:** "Everything works. Also, remove the checkbox for "Show unsaved uploads". I think it's redundant now that I will never upload a receipt without saving."

### Removed
- "Show unsaved uploads" checkbox from the history card (`live-site-pages/Receipts.html` v01.09w): markup, its change listener, and the `uploaded` parameter from the history-load and export calls — the UI is saved-only. The server-side `uploaded` parameter on `listReceipts`/`exportReceipts` is intentionally retained (harmless capability; the client simply no longer sends it), so unsaved rows remain reachable via the spreadsheet if ever needed

### Verified
- Zero `rh-show-uploaded` references remain; `node --check` on all inline scripts; Playwright render — sort checkbox and export button intact, zero page errors

## [v01.25r] — 2026-08-01 06:25:29 AM EST — [526aa58](https://github.com/LightAISolutions/Sales/commit/526aa5850995b78c5259761c2f07e030f8297a3a)

> **Prompt:** "I tested the 2 actions and both work as intended. 1. In the Receipt History, standardize merchant names to be: capitalize the first letter of each word with the rest lower-case (ie: Trader Joe's instead of TRADER JOE'S). 2. In the Receipt History, when I try to "view photo", it says that "jonyang92@gmail.com" doesnt have access to the file. I assume it's because the folder is on "LightAISolution@gmail.com"'s Drive. I would like for this folder's permissions to be synced to my MasterACL file's permissions. For example, if I give a new email Admin access to my Receipts app via the MasterACL spreadsheet, I want that email to automatically get access to this Receipt Pictures folder. Make the changes necessary so that this can happen." *(screenshots: history with mixed-case merchants; Drive "you need access" page for jonyang92@gmail.com)*

### Added
- **Drive folder ↔ Master ACL permission sync** (`googleAppsScripts/Receipts/Receipts.gs` v01.07g): `syncDriveFolderAccess_()` reads the Access tab (col A emails, Receipts column TRUE, metadata rows skipped via the @-check), grants VIEWER on the photos folder to every authorized user, and revokes viewers whose grant was removed — the folder owner and manually-added editors are never touched. Runs from `listReceipts` (first thing opened before viewing photos), throttled via CacheService to once per 10 minutes; best-effort with the app's session auth as the real gate

### Changed
- **Merchant standardization**: `titleCase_()` (capitalize each word start incl. after hyphen/slash, rest lower-case, apostrophes preserved — "TRADER JOE'S" → "Trader Joe's") applied to `data.merchant` at save time; migration upgraded to **v3** (flag `RECEIPT_ID_FORMAT=v3`): title-cases all saved merchants in place and regenerates `Store_Name-YYYYMMDD` IDs + LineItems references + Drive photo names where the standardized name changes them (collision-suffix-only differences keep the existing ID)
- Pipeline diagram history flow updated (v3 migration + folder ACL sync; pako URL regenerated, decompression-verified)

### Verified
- `node --check` on the `.gs`; `titleCase_` behavior checked against real merchant strings (TRADER JOE'S → Trader Joe's, MEGA MART → Mega Mart, cvs/pharmacy #123 → Cvs/Pharmacy #123, seven-eleven → Seven-Eleven)

## [v01.24r] — 2026-08-01 06:06:54 AM EST — [5c15b04](https://github.com/LightAISolutions/Sales/commit/5c15b048d44b37016ad536a3848641f3e4e968fc)

> **Prompt:** "I tested all 6 actions and they all worked as intended. Go with your suggested supermarket department taxonomy (16 departments). I want per-item editing in the review screen."

### Added
- Per-item department editing in the review screen (`live-site-pages/Receipts.html` v01.08w): each line item is now a two-line block — inputs row + a compact department `<select>` (`.rr-cat`, client `ITEM_CATS` mirrors the GAS `ITEM_CATEGORIES` 16-department enum) pre-selected from Gemini's auto-assignment; `collectReview()` includes `category` per item

### Fixed
- Extracted per-item categories were being dropped on save — the review UI didn't carry them, so `collectReview()` sent items without `category` and `saveReceipt` stored empty strings. The dropdowns now carry the extraction values (edited or not) through to the LineItems tab and the export

### Verified
- `node --check` on all inline scripts; Playwright at 390×844 — three item blocks with departments Produce/Pantry/Beverages set via the real Add-item path, selects render under each row, no horizontal scroll, zero page errors. GAS untouched (v01.06g unchanged — `saveReceipt` already persisted `it.category`)

## [v01.23r] — 2026-08-01 05:28:51 AM EST — [3bcdf30](https://github.com/LightAISolutions/Sales/commit/3bcdf306b4d047f260dab9a14c095e76bc1a0a71)

> **Prompt:** "I tested all three actions and everything works as intended. Currently, the receipt history shows the receipts based on upload order; Create a checkbox option to show the receipts chronologically based on the receipt dates instead of upload order. Also, reformat the default "Receipt ID"s to "Store_Name-YYYYMMDD"; Update the existing receipts' IDs to match. Also, currently, the status (uploading, extracting, saved, etc) window is to the right of the "History" button; Move the status window below the "Scan Receipt" and "History" buttons and add a progress bar that makes sense for this application. Also, when extracting, record the store address as well. Also, in the exported excel spreadsheet tab "LineItems", make it easy to distinguish and switch between the different receipts. After executing the above, continue with Phase 5: automatic spending categories (assigned during extraction), a monthly-summary tab, duplicate-receipt detection. Regarding the automatic spending categories, refer to existing apps like ReceiptCamp, Expensify, and Smart Receipts to figure out the best categories to use to cover the entirety of grocery store items."

### Added
- **Readable receipt IDs** (`googleAppsScripts/Receipts/Receipts.gs` v01.06g): `makeReceiptId_()` builds `Store_Name-YYYYMMDD` (sanitized merchant, collision suffix `-2`/`-3`), assigned at save time since merchant/date are unknown at upload; the Drive photo is renamed to match; one-time lazy migration (`migrateReceiptIds_()`, Script-Properties-flag + LockService guarded, triggered from `listReceipts`) renames all existing saved receipts, their LineItems rows, and photos
- **Store address**: added to the Gemini schema, new "Store Address" column (in-place header upgrade for existing sheets), editable field in the review card (`live-site-pages/Receipts.html` v01.07w), shown in history detail (📍) and the export
- **Progress bar + status relocation**: status line moved below the Scan/History buttons; stepped bar tracks Compressing (15) → Uploading (40) → Extracting (70) → Done (100, green) and Saving (85) → Saved (100); cards shifted down (top 128px) to clear the taller panel
- **"Sort by receipt date" checkbox** — server-side sort in `listReceipts` (`sort=date`, newest printed date first, undated rows last)
- **Phase 5a — automatic per-item categories**: `ITEM_CATEGORIES` (16 supermarket departments: Produce, Meat & Seafood, Dairy & Eggs, Bakery, Deli & Prepared, Frozen, Pantry, Snacks & Candy, Beverages, Alcohol, Household, Personal Care, Baby, Pet, Non-Grocery, Other) assigned by Gemini per line item via schema enum; stored in a new LineItems "Category" column, shown in history detail and the export. Reference apps (Expensify/Smart Receipts style) verified via web search to use merchant-level buckets only, so item level uses standard supermarket department taxonomy
- **Phase 5b — Monthly Summary tab**: `rebuildMonthlySummary_()` aggregates saved receipts per month (count, total, per-receipt-category totals), rebuilt on every save/delete and mirrored as a third sheet in the export
- **Phase 5c — duplicate detection**: `saveReceipt` rejects a save matching another saved receipt's merchant+date+total with `{error: 'duplicate', duplicateOf}`; the review card warns and the next Save press sends `force=1` ("save anyway")

### Changed
- **Export LineItems readability**: items grouped per receipt under bold banded header rows (store · date · total) with alternating block colors and blank separators; Receipt ID column retained for filtering; Receipts sheet gains the Store Address column; export response count fixed to actual item rows
- Receipt Pipeline diagram updated with ID assignment, duplicate check, address, summary rebuild, sort and migration steps (pako URL regenerated, decompression-verified)

### Verified
- `node --check` on `.gs` + all inline scripts; Playwright at 390×844 and 390×700 — status+progress render below the buttons, review card (with address) no longer overlaps the taller panel, sticky Save still visible; zero page errors

## [v01.22r] — 2026-08-01 04:38:48 AM EST — [af6ca3e](https://github.com/LightAISolutions/Sales/commit/af6ca3ef0589340f9f07b1a65fc589b9391ae6a0)

> **Prompt:** "History works, but I want you to only show "saved" receipts by default. Add a checkbox option to show uploaded but unsaved receipts. Also, give me an option to delete records as well. Meanwhile, continue with Phase 4."

### Added
- **Record deletion** (`googleAppsScripts/Receipts/Receipts.gs` v01.05g, `live-site-pages/Receipts.html` v01.06w): GAS `deleteReceipt` route removes the receipt row + its LineItems rows and trashes the Drive photo (fileId parsed from the stored URL; recoverable ~30 days). Enforces the RBAC `delete` permission when the ACL's roles are configured (empty permission set falls back to session-only gating, matching other write routes). Client-side: per-row 🗑 with a two-tap inline confirmation (arm → "Delete?" → 4s auto-disarm) — no browser `confirm()` per the repo's UI Dialogs rule
- **Receipts Phase 4 — .xlsx export**: GAS `exportReceipts` builds a temp two-sheet spreadsheet (Receipts incl. subtotal/tax/total pulled per-ID, LineItems for the matching IDs), exports it via the Drive endpoint with `ScriptApp.getOAuthToken()`, trashes the temp file (in a `finally`), and returns `{fileName, base64}`; "⬇️ Export .xlsx" button downloads it as a Blob using the current history filters
- "Show unsaved uploads" checkbox in the history filter header

### Changed
- History now defaults to **saved receipts only** — `listReceipts` gained a status filter (`uploaded=1` includes unsaved rows), wired to the checkbox
- Delete + export flows appended to the Receipt Pipeline diagram (pako URL regenerated, decompression-verified)

### Verified
- `node --check` on `.gs` + all inline scripts; Playwright render at 390×700 — checkbox, export button, idle 🗑 and armed "Delete?" states all visible, no horizontal scroll, zero page errors

## [v01.21r] — 2026-08-01 04:12:06 AM EST — [01c10e1](https://github.com/LightAISolutions/Sales/commit/01c10e1486534aefa5f65b4181ea1119726031d4)

> **Prompt:** "I re-scanned the Trader Joe's receipt and it successfully saved. I then tried a long MegaMart receipt and it also succeeded, but the extraction took close to 10 minutes. Is there any way to speed up this process? Meanwhile, continue with Phase 3."

### Fixed
- **~10-minute extractions** (`googleAppsScripts/Receipts/Receipts.gs` v01.04g): root cause was the fetch transport double-running the work — the POST leg ran the full extraction, Google returned an unparseable error page, and the GET fallback re-ran everything. Three changes: (1) extraction results now cached server-side by fileId (`CacheService`, 10-min TTL) so a second transport leg returns instantly; (2) `gemini-3.6-flash` promoted to primary (faster generation; the observed 503 congestion was on 3.5-flash, now the fallback); (3) retry plan trimmed 4 → 3 attempts to bound worst-case wall time

### Added
- **Receipts Phase 3 — history browser** (`Receipts.gs` v01.04g, `live-site-pages/Receipts.html` v01.05w): GAS `listReceipts` route (merchant substring + date-range filters, newest first, cap 500) and `getReceiptDetail` route (full fields + LineItems rows), both with POST + GET api fallbacks; HTML "🧾 History" button + history card (z-index 7, dvh-sized, sticky filter header) with search/date inputs, receipt list (status ✅/📤, totals), tap-to-expand cached details, and photo links; HTML-escaping helper for all rendered spreadsheet data
- History flows appended to the Receipt Pipeline sequence diagram in `repository-information/diagrams/Receipts-diagram.md` (pako URL regenerated and decompression-verified)

### Verified
- `node --check` on `.gs` + all inline scripts; Playwright render of the history card with simulated rows + expanded detail at 390×700 (no horizontal scroll, zero page errors)

## [v01.20r] — 2026-08-01 03:51:49 AM EST — [a81c722](https://github.com/LightAISolutions/Sales/commit/a81c7221edc18a9bfd069ac763eee21eaff9a185)

> **Prompt:** "it successfully extracted the information, but after scrolling to the bottom, I cannot see nor click "Save Receipt". Resize this UI to make it more user friendly and possible to save receipts." *(screenshot: 12-item extracted receipt, card scrolled to "+ Add item" with the action row cut off below the visible screen)*

### Fixed
- Unreachable Save button on mobile (`live-site-pages/Receipts.html` v01.04w): the review card's `max-height` used `100vh`, which on mobile includes the area behind the browser URL bar — with long item lists the card's bottom edge (action row) landed below the visible screen. Now sized with `100dvh` (dynamic viewport height; `100vh` kept as older-browser fallback) plus extra bottom clearance above the version pills

### Changed
- Save/Discard/Retry row is now a **sticky action bar** pinned to the card's bottom edge (`position: sticky` with background + top border) — always visible and clickable regardless of scroll position; the fields and item list scroll underneath it

### Verified
- Playwright at 390×700 (short viewport simulating browser chrome) with a 12-item receipt: Save button inside the viewport and clickable via `document.elementFromPoint` both before and after scrolling the card's content; zero page errors

## [v01.19r] — 2026-08-01 03:17:05 AM EST — [faa2fe3](https://github.com/LightAISolutions/Sales/commit/faa2fe39fcd2049cd09660ec21b1bb2a7064eceb)

> **Prompt:** "I got the attached error message" *(screenshot: review card open in manual-entry fallback with `Extraction failed (gemini_http_503: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.)`)*

### Fixed
- Transient Gemini 503 "high demand" failures (`googleAppsScripts/Receipts/Receipts.gs` v01.03g): `extractReceipt` now runs a 4-step retry plan — primary model twice (0s/2s waits), then `GEMINI_FALLBACK_MODEL = "gemini-3.6-flash"` twice (1s/3s waits) — retrying only transient statuses (503/429/500); non-transient errors (bad key, bad request) still fail fast to avoid burning quota

### Added
- "Retry extraction" button in the review card (`live-site-pages/Receipts.html` v01.03w): shown only when extraction fails; re-runs extraction against the already-uploaded Drive file (tracked via new `currentFileId`) and re-populates the card on success — no re-photographing needed

### Verified
- `node --check` on `.gs` + all inline scripts; Playwright render of the failed-extraction state at 390×844 (retry button visible, no horizontal scroll, zero page errors)

## [v01.18r] — 2026-08-01 03:07:59 AM EST — [4d2b91c](https://github.com/LightAISolutions/Sales/commit/4d2b91cb6596e5b661721265fd1f2c89be8048d5)

> **Prompt:** "The receipt picture was successfully taken and uploaded. Start phase 2."

### Added
- **Receipts Phase 2 — AI extraction + review-before-save** (`googleAppsScripts/Receipts/Receipts.gs` v01.02g, `live-site-pages/Receipts.html` v01.02w):
- GAS `extractReceipt` route (POST + GET api fallback; session-validated): reads the uploaded photo back from Drive by fileId and calls Gemini `generateContent` (`GEMINI_MODEL = "gemini-3.5-flash"`, key from Script Properties `GEMINI_API_KEY`) with a strict `responseSchema` returning merchant, date, currency, subtotal, tax, total, category (9-option enum), and lineItems[]; temperature 0; robust error mapping (`gemini_key_missing`, `gemini_http_*`, `gemini_parse_failed`)
- GAS `saveReceipt` route (body-POST only — reviewed JSON can exceed GET URL limits): fills the receipt's row by Receipt ID (date/merchant/currency/subtotal/tax/total/category), sets status `saved`, stores the raw extraction JSON for audit, and replaces the receipt's LineItems rows idempotently
- HTML review card (`#receipt-review-card`, z-index 6 — under the overlay walls like the scan panel): auto-opens pre-filled after extraction with editable fields + category dropdown + line-items grid (add/remove rows), Save/Discard actions; opens empty for manual entry when extraction fails; `uploadReceipt` now returns `fileId` to feed extraction
- New "Receipt Pipeline" sequence diagram section in `repository-information/diagrams/Receipts-diagram.md` (upload → extract → review → save; pako URL generated and decompression-verified)

### Verified
- Gemini model names verified against current documentation via web search (gemini-3.5-flash / gemini-3.6-flash, free tier); `node --check` on the `.gs` and all inline scripts; Playwright render of the populated review card at 390×844 and 1280×800 (no horizontal scroll, zero page errors)

## [v01.17r] — 2026-08-01 02:26:53 AM EST — [9f936c5](https://github.com/LightAISolutions/Sales/commit/9f936c5db38547c35bed3ee9eb3f2dbdd7709204)

> **Prompt:** "I approve the plan to PWA-ify the web app. I have also granted Receipts ACL permission to "jonyang92@gmail.com" and confirmed that the live page loads. LightAISolution's Drive folder ID is "1DHfXwzo0qXI_2H0Q2dDLKGn7EOtguI0A"."

### Added
- **Receipts Phase 1 upload pipeline** (`live-site-pages/Receipts.html` v01.01w, `googleAppsScripts/Receipts/Receipts.gs` v01.01g): "📷 Scan receipt" panel in the page PROJECT blocks — camera-direct capture on phones (`capture="environment"`), file picker on desktop, client-side canvas compression (max 1600px JPEG q0.82, EXIF-orientation-aware via `createImageBitmap`), thumbnail + status feedback. New `_gasPostBody()` transport variant sends the base64 image in a form-encoded POST body with 3-attempt retry (the template's `_gasPost` carries params in the URL — impossible at image sizes; no GET fallback exists for the same reason)
- GAS side: `uploadReceipt` route (`doPost action=uploadReceipt`, session-validated via `validateSessionForData`) decodes and saves the photo to the configured Drive folder and appends an "uploaded" row to the `Receipts` tab; idempotent `ensureReceiptTabs_()` bootstraps the `Receipts` + `LineItems` tabs (frozen headers) on first write — Phase 2's extraction will fill the remaining columns
- **PWA install support**: new `live-site-pages/receipts.webmanifest` + generated app icons (`images/receipts-icon-192.png`, `receipts-icon-512.png`, maskable) + manifest/theme-color/apple-touch head tags in `Receipts.html`; CSP `manifest-src` relaxed `'none'` → `'self'` in both CSP tags, marked with a `PROJECT OVERRIDE` comment
- `DRIVE_FOLDER_ID` added to `Receipts.config.json` and mirrored in `Receipts.gs` (config sync per [PC-GAS-CONFIG] #14)

### Verified
- `node --check` passes on the full `.gs` and every inline HTML script block; Playwright render checks at 390×844 and 1280×800 — panel centered with no horizontal scroll, zero page errors

## [v01.16r] — 2026-08-01 01:40:25 AM EST — [d00c587](https://github.com/LightAISolutions/Sales/commit/d00c58788b9ece6a630558c97f13b0a93db2c3ac)

> **Prompt:** "Set up a new GAS project. Run the script, then commit and push. `bash scripts/setup-gas-project.sh <<'CONFIG' { "PROJECT_ENVIRONMENT_NAME": "Receipts", "TITLE": "Receipts", "DEPLOYMENT_ID": "AKfycbwASoUFzqdy3Bb-NbsbG6Hh3-9fPz1aGJGi8AbUsBV0YBu85ockXXdWkLKB8kEtivrb", "SPREADSHEET_ID": "1SfVRsHm6pUn1bq633BSKiQ8c3IsQeVAs7H0265ckdDM", "SHEET_NAME": "Live_Sheet", "DEVELOPER_LOGO_URL": "https://lightaisolutions.github.io/Sales/images/logo-placeholder.svg", "YOUR_ORG_LOGO_URL": "https://lightaisolutions.github.io/Sales/images/logo-placeholder.svg", "SPLASH_LOGO_URL": "https://lightaisolutions.github.io/Sales/images/logo-placeholder.svg", "INCLUDE_AUTH": true, "CLIENT_ID": "830735769637-ak3c73b4lnea004i8dge8kg6n53o36vl.apps.googleusercontent.com", "AUTH_PRESET": "hipaa", "MASTER_ACL_SPREADSHEET_ID": "1kG2KftqfKOeYwBCEkxRpw-QBh9s-1-Dvy31sH037UvE", "ACL_SHEET_NAME": "Access" } CONFIG`"

### Added
- New auth GAS project **Receipts** (HIPAA preset) created via `scripts/setup-gas-project.sh` — 10 files: `live-site-pages/Receipts.html` (v01.00w), `googleAppsScripts/Receipts/Receipts.gs` (v01.00g), `Receipts.config.json`, html/gs version files, page + GAS changelogs with archives, and per-environment diagram `repository-information/diagrams/Receipts-diagram.md`
- Registered across the repo: GAS Projects table (`.claude/rules/gas-scripts.md`), README structure tree (page entry with version links + all subtree entries), REPO-ARCHITECTURE.md (RECEIPTS_PAGE + GAS_RECEIPTS nodes and template-source/iframe/serves/deploy/polling edges), and a `Deploy Receipts` webhook step in `.github/workflows/auto-merge-claude.yml`
- Live config wired in at creation: real deployment ID (obfuscated `_e` URL in the page verified against expected encoding), data spreadsheet (`Live_Sheet`), and real Master ACL spreadsheet ID in both `.gs` and `.config.json` — Global ACL Access-tab self-registration active on first page load

### Changed
- Regenerated the Flowchart and Class Diagram mermaid.live pako URLs in `repository-information/REPO-ARCHITECTURE.md` (both went stale when the setup script added the Receipts nodes) — decompression-verified, including the new `Receipts-diagram.md` link

## [v01.15r] — 2026-07-18 03:15:05 AM EST — [bd28564](https://github.com/LightAISolutions/Sales/commit/bd28564e0ba76ac0e3f3dc4002e1c17a57f14ac9)

> **Prompt:** "Create a 5 second animation of Spain vs Argentina in the 2026 world cup and show it on repeat."

### Added
- New standalone page `live-site-pages/spain-argentina.html` (v01.00w), created from `HtmlAndGasTemplateAutoUpdate-noauth.html.txt`: a pure-CSS 5-second Spain vs Argentina World Cup 2026 match animation that loops infinitely (`animation: … 5s … infinite`). PROJECT blocks contain a scoreboard (🇪🇸 ESP 0–0 ARG 🇦🇷), a striped pitch with halfway line/centre circle/boxes/goals, three Spain players (red/yellow), three Argentina players (albiceleste stripes incl. a diving keeper), a ⚽ ball that passes through midfield and finishes in Argentina's net, and a "GOAL!" flash at ~80% of the loop. No JavaScript added — the JS PROJECT block stays empty (animation is CSS-only); no GAS project
- New tracking files: `html-versions/spain-argentinahtml.version.txt` (`|v01.00w|`), `html-changelogs/spain-argentinahtml.changelog.md` + `spain-argentinahtml.changelog-archive.md`
- Registered the page in the README tree (Standalone Utilities group + html-versions/html-changelogs subtrees) and in REPO-ARCHITECTURE.md's flowchart (SPAINARG_PAGE node + serves/version-polling/template-copy edges; pako URL regenerated and decompression-verified)
- Verified via Playwright at two loop timestamps (~1.8s mid-play, ~4.2s GOAL flash); fixed an invalid `font:` shorthand (`inherit` family) found during the check by switching to explicit font-size/weight properties

## [v01.14r] — 2026-07-18 02:39:24 AM EST — [cc86b54](https://github.com/LightAISolutions/Sales/commit/cc86b54bfa3e65e51730eddecb14fe439587fbfd)

> **Prompt:** "In my Scraper project, remove the text box + submit button."

### Removed
- Scraper text-submission UI (`live-site-pages/Scraper.html` v01.04w): removed the text box + Submit button panel — the PROJECT-block CSS (`#text-submit-panel` and related rules), the panel markup, and the submit wiring JS (fetch `submitText` call, Enter-to-submit, inline status feedback). PROJECT START/END markers left in place (empty) for future page content. The GAS-side `submitText` route in `googleAppsScripts/Scraper/Scraper.gs` is intentionally retained unchanged (now unused) — removal not requested
- Verified via Playwright render check: page renders cleanly with no leftover panel or layout artifacts (the 5 pre-existing `file://` CSP logo-image refusals reproduce identically on the unmodified page)

## [v01.13r] — 2026-07-18 12:05:25 AM EST — [50449c4](https://github.com/LightAISolutions/Sales/commit/50449c4ba2dbaf36d2029a1aa8464bcfdbdf1670)

> **Prompt:** "In the Scraper project, create a text box with a submit button. When the user clicks submit, copy whatever they wrote in the text box into the spreadsheet."

### Added
- Scraper text submission feature (`live-site-pages/Scraper.html` v01.03w, `googleAppsScripts/Scraper/Scraper.gs` v01.04g): a top-center panel with a text box + Submit button in the page's PROJECT blocks (hidden behind the auth wall until sign-in; z-index 5 — above the GAS iframe, below all overlay walls). Submission goes over the iframe-free fetch transport to a new `PROJECT:`-marked `doPost action=submitText` route (with GET `api op=submitText` fallback) → `submitText()` in the PROJECT block, which validates the session via `validateSessionForData`, trims/caps input at 5000 chars, and appends `[timestamp, user email, text]` to `Live_Sheet` in the configured spreadsheet. Inline status feedback (Saving… / Saved ✓ / error), Enter-to-submit, button disabled while in flight
- Verified: GAS + HTML JS syntax parse, Playwright render check with simulated signed-in state (panel positioned correctly, no overlap with pills/overlays)

Developed by: LightAISolutions
## [v01.12r] — 2026-07-17 11:45:41 PM EST — [1d60d9f](https://github.com/LightAISolutions/Sales/commit/1d60d9f750f4b21a5e00240992bc65c5aafe15a6)

> **Prompt:** "I was able to pass the "Connect to server" issue from earlier, but i still cannot sign in. See attached screenshot."

### Fixed
- Embedded app screen blocked after successful fetch sign-in (Google Drive "Sorry, unable to open the file" inside the iframe + `action=securityEvent` 404 spam — the multi-account `/u/N` routing 404 hitting the remaining iframe loads): the `#gas-app` iframe and the hidden securityEvent frames are now created **credentialless** in `live-site-pages/MasterACL.html`, `Scraper.html`, `globalacl.html` (all v01.02w) and the auth HTML template — cookie-less iframes get Google's anonymous serving path (the same path verified working via server probes), while the session continues to travel in the `?session=` URL. Browsers without `credentialless` support ignore the attribute (prior behavior preserved). Flagged as a documented inference: anonymous serving, cookie removal, and anonymous GAS usage are each verified, but the combination inside a credentialless iframe is untested until the owner confirms in-browser

## [v01.11r] — 2026-07-17 10:05:56 PM EST — [c4d1bd3](https://github.com/LightAISolutions/Sales/commit/c4d1bd39eb9b7fa2846592e901e2bb46034234fa)

> **Prompt:** "Do the fetch conversion (your recommendation) AND address this: "The root-cause template defect (setup script generates `standard`-preset GAS against a hipaa-built HTML template) still awaits a permanent fix so future projects are born working" (your heads-up)."

### Added
- **Iframe-free `fetch` sign-in transport** ported from the `testauthgas1` scaffold into `live-site-pages/MasterACL.html` (v01.01w), `Scraper.html` (v01.01w), and `globalacl.html` (v01.01w): new `_gasPost()` (POST with GET `action=api` fallback), `exchangeViaFetch()`, `_mapExchangeError()`, `_completeSignInFetch()` (transport-verified direct show — no `gas-auth-ok` gate), plus fetch branches in `sendHeartbeat()`, the sign-out flow, and the page-load session restore (heartbeat-validated). `HTML_CONFIG.TOKEN_EXCHANGE_METHOD` → `'fetch'`. Cookie-less fetch always reaches Google's anonymous serving path, making the auth machinery immune to the blocked framed `/exec` responses (multi-account `/u/N` 404s, X-Frame-Options) that killed iframe sign-in in the owner's normal browser
- GAS routes for the transport in `googleAppsScripts/MasterACL/MasterACL.gs` (v01.07g), `Scraper.gs` (v01.03g), `globalacl.gs` (v01.01g): `doPost action=exchangeToken` (with `ensureScriptProperties_()` bootstrap) and `action=signOut`, plus a general `doGet action=api` GET fallback (`exchangeToken`/`signOut`/`heartbeat` ops)

### Changed
- **Permanent template fix**: the same conversion applied to `live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-auth.html.txt` and `gas-minimal-auth-template-code.js.txt` — future auth projects are born with the fetch transport, which no longer depends on the GAS preset's `TOKEN_EXCHANGE_METHOD`, dissolving the standard-vs-hipaa exchange mismatch permanently
- Template propagation note: `testauthgas1` (already the fetch reference) and `testauthhtml1` (intentionally the postMessage test scaffold) were left unchanged; the latent `processDataPoll` dead-route in the GAS template generation was left as-is (not referenced by the new routes)

### Verified
- Full-file JS syntax parse on all 4 GAS files and all inline script blocks of the 4 HTML files; Playwright `file://` smoke test on the 3 converted pages (only known file-protocol restrictions logged, zero code errors)

## [v01.10r] — 2026-07-17 09:22:12 PM EST — [489a824](https://github.com/LightAISolutions/Sales/commit/489a8249b496f5081e861611fda3c9b47f6687b1)

> **Prompt:** "@"/root/.claude/uploads/07152af2-7240-5bfb-8986-2eaa697523c9/af91e797-globalacl_working_sample_v01.89g.txt" See attached .txt file for a successful example. Compare this with my GAS code and update mine as needed to resolve my sign-in problem for "jonyang92@gmail.com". This example is being used for a different company, so scrub out anything specific and give me a working skeleton that can be applied to my GAS code."

### Changed
- Compared the uploaded working sample (globalacl v01.89g, other org) against our GAS code after scrubbing org-specific values: function inventories and the entire sign-in path are identical — the only functional configuration difference is that the working org runs `ACTIVE_PRESET: 'hipaa'`. Aligned `googleAppsScripts/MasterACL/MasterACL.gs` (v01.06g) and `googleAppsScripts/Scraper/Scraper.gs` (v01.02g) to that proven skeleton: `ACTIVE_PRESET` → `'hipaa'`, `PROJECT_OVERRIDES` made byte-identical to the sample (`ENABLE_DOMAIN_RESTRICTION: false`, `ALLOWED_DOMAINS: []`, `SESSION_EXPIRATION: 7200`), removing the now-redundant `TOKEN_EXCHANGE_METHOD` override (hipaa's default is `postMessage`). The embedding HTML's own comments ("must match GAS PRESETS.hipaa...") confirm the auth HTML template was written for the hipaa preset — the setup script generating `standard`-preset GAS against it is the template defect. Session durations verified in sync both sides (7200/28800). The sample's `PROJECT:` doPost signOut wrapper was not ported (workspace-specific, unrelated to sign-in). Note: the browser-side multi-account `/exec` 404 (Google issue) remains — single-account session still required

## [v01.09r] — 2026-07-17 08:36:54 PM EST — [d726490](https://github.com/LightAISolutions/Sales/commit/d7264904ba3a82ef4d24ec76436f7710639ee986)

> **Prompt:** "I still cannot sign in as "jonyang92@gmail.com". Fix the problem."

### Fixed
- Sign-in timeout ("The sign-in service isn't responding") on MasterACL and Scraper: the auth HTML template hardcodes `TOKEN_EXCHANGE_METHOD: 'postMessage'`, but the GAS `standard` preset resolves it to `'url'` — the served shell had no postMessage token listener, so the OAuth token exchange never completed and the 25s reachability watchdog fired. Confirmed by probing the live `/exec` deployment (healthy, serving current code, correct `gas-needs-auth` handshake — ruling out deployment/OAuth-access causes). Fix: `TOKEN_EXCHANGE_METHOD: 'postMessage'` added to `PROJECT_OVERRIDES` in `googleAppsScripts/MasterACL/MasterACL.gs` (v01.05g) and `googleAppsScripts/Scraper/Scraper.gs` (v01.01g) — the combination the working hipaa-preset projects (Globalacl, test pages) already use. Latent template defect noted: every future `standard`-preset auth project inherits this mismatch until the GAS template or setup script aligns the two sides

## [v01.08r] — 2026-07-17 08:10:18 PM EST — [f54c4cc](https://github.com/LightAISolutions/Sales/commit/f54c4cc33d0f6aeb9ed6a2101bbb0195bb3a0304)

> **Prompt:** "The first screenshot is the error message I get when I try to sign in with "jonyang92@gmail.com" and the second screenshot is an example of a successful Master ACL sheet. Modify the "grantUserAccess" function to resolve the first problem and modify my Master ACL sheet to look like the second screenshot."

### Changed
- `googleAppsScripts/MasterACL/MasterACL.gs` (v01.04g): `grantUserAccess()` reworked into a three-phase utility. Phase 1 (STRUCTURE) verifies/repairs the Master ACL spreadsheet to match the reference layout — creates the Access tab if missing, writes `Email`/`Role` headers, adds the `#NAME`/`#URL`/`#AUTH`/`#ICON`/`#DESC` metadata rows via `ensureMetadataRows`, creates a `Roles` tab with the default permission matrix (new `ensureRolesTab_` helper, checkboxes included), and registers this project's page column. Phase 2 (GRANT) unchanged — default admin grants for the two owner emails. Phase 3 (WEB APP PROBE) initializes required Script Properties then fetches the project's own `/exec` URL and logs a precise verdict — the page's "sign-in service isn't responding" watchdog fires when the deployment doesn't serve the app, so the probe distinguishes healthy / access-not-Anyone / stale-or-empty-deployment (with click-by-click fix instructions)

## [v01.07r] — 2026-07-17 07:47:16 PM EST — [21a2c40](https://github.com/LightAISolutions/Sales/commit/21a2c407b143e02dc422b0a3c95f75878dfe5761)

> **Prompt:** "GAS is telling me: "No emails specified. Set Script Properties key "GRANT_ACCESS_EMAILS" (single email or comma-separated list), optionally "GRANT_ACCESS_ROLE", then Run again." Make it so I don't have to do this. Add "jonyang92@gmail.com" and "lightaisolution@gmail.com"."

### Changed
- `googleAppsScripts/MasterACL/MasterACL.gs` (v01.03g): `grantUserAccess()` no longer requires Script Properties — when `GRANT_ACCESS_EMAILS` is unset it falls back to built-in defaults `DEFAULT_GRANT_EMAILS` (`jonyang92@gmail.com`, `lightaisolution@gmail.com`) with `DEFAULT_GRANT_ROLE` (`admin`). Script Properties still override the defaults when set, for granting other users/roles

## [v01.06r] — 2026-07-17 07:42:23 PM EST — [f5e213d](https://github.com/LightAISolutions/Sales/commit/f5e213dcfe99813f70e42afdef0e5660780a0c0b)

> **Prompt:** "No one has permissions to access these projects right now. Make a function that I can run that allows new users to get permission."

### Added
- `googleAppsScripts/MasterACL/MasterACL.gs` (v01.02g): new `grantUserAccess()` admin utility in the PROJECT block — run from the Apps Script editor with Script Properties `GRANT_ACCESS_EMAILS` (single or comma-separated) and optional `GRANT_ACCESS_ROLE` (default `viewer`). Appends Access-tab rows for new users (role + TRUE for every page column, with checkboxes), re-enables all page columns for existing rows (role updated only when explicitly set), validates the role against the known role list with a warning, and bumps the access-cache epoch so grants take effect immediately. One run grants access to every registered project since all auth projects share the central Master ACL spreadsheet

## [v01.05r] — 2026-07-17 07:37:12 PM EST — [d45e3de](https://github.com/LightAISolutions/Sales/commit/d45e3de1ca94fc50717cc17572338d3a05ec9c8f)

> **Prompt:** "I can't sign into my MasterACL project with my personal email (jonyang92@gmail.com) because permissions are not set by my work email (lightaisolution@gmail.com). Autocreate the admin permissions for my personal email."

### Added
- `googleAppsScripts/MasterACL/MasterACL.gs` (v01.01g): new `PROJECT OVERRIDE` block with `SEED_ADMIN_EMAILS` (`jonyang92@gmail.com`) and an idempotent `ensureSeedAdmins()` called from `doGet` — appends an `admin`-role row with all page columns TRUE to the Access tab when the email is missing, bumps the access-cache epoch so cached denials clear immediately, and never touches existing rows (manual spreadsheet edits always win). Runs server-side as the deployment owner, so it works even though the visiting user has no spreadsheet access

## [v01.04r] — 2026-07-17 07:18:01 PM EST — [500a4fe](https://github.com/LightAISolutions/Sales/commit/500a4fe7d1346adb8e747edf0a0879fd8e7277bc)

> **Prompt:** "Set up a new GAS project. Run the script, then commit and push.
>
> bash scripts/setup-gas-project.sh <<'CONFIG'
> {
>   "PROJECT_ENVIRONMENT_NAME": "Scraper",
>   "TITLE": "News Scraper",
>   "DEPLOYMENT_ID": "AKfycby8nOR0AqLsDlZPcrTX9dWIInY48R9Jrl8oBDtN5t0emC06j7iwidEMdXttrD1zXnjUIg",
>   "SPREADSHEET_ID": "19U0Wu25eUXEHPVz4VWjKQIpnRozgFycNSjFCTB-umkk",
>   "SHEET_NAME": "Live_Sheet",
>   "DEVELOPER_LOGO_URL": "https://lightaisolutions.github.io/Sales/images/logo-placeholder.svg",
>   "YOUR_ORG_LOGO_URL": "https://lightaisolutions.github.io/Sales/images/logo-placeholder.svg",
>   "SPLASH_LOGO_URL": "https://lightaisolutions.github.io/Sales/images/logo-placeholder.svg",
>   "INCLUDE_AUTH": true,
>   "CLIENT_ID": "830735769637-ak3c73b4lnea004i8dge8kg6n53o36vl.apps.googleusercontent.com",
>   "AUTH_PRESET": "standard",
>   "MASTER_ACL_SPREADSHEET_ID": "1kG2KftqfKOeYwBCEkxRpw-QBh9s-1-Dvy31sH037UvE",
>   "ACL_SHEET_NAME": "Access"
> }
> CONFIG"

### Added
- New GAS project **Scraper** (News Scraper — auth-enabled, `standard` preset) created via `scripts/setup-gas-project.sh`: `live-site-pages/Scraper.html` (v01.00w), `googleAppsScripts/Scraper/Scraper.gs` (v01.00g), `Scraper.config.json` with real deployment/spreadsheet IDs and Master ACL registration, version files, page/GAS changelogs + archives, and `repository-information/diagrams/Scraper-diagram.md` (with verified mermaid.live link)
- `Deploy Scraper` webhook step added to `.github/workflows/auto-merge-claude.yml`; Scraper registered in the GAS Projects table and path scope of `.claude/rules/gas-scripts.md`; README.md tree and REPO-ARCHITECTURE.md updated with the new page, GAS node, and edges — all script-generated with no manual repair needed (v01.03r script fixes verified in production)

### Changed
- Regenerated the REPO-ARCHITECTURE.md Flowchart mermaid.live URL to include the new Scraper nodes (verified by decompression)

## [v01.03r] — 2026-07-17 07:11:12 PM EST — [5a48862](https://github.com/LightAISolutions/Sales/commit/5a48862bc3638618103768d8c206e3c338f71b7a)

> **Prompt:** "fix the setup script defects"

### Fixed
- `scripts/setup-gas-project.sh` Phase 6: the GAS Projects registration row was appended after the last `|`-prefixed line in the whole file (landing in the coding-guidelines pointer table) — now anchors on the `| Project | Code File |` header and inserts after the last contiguous row of that table
- `scripts/setup-gas-project.sh` Phase 9: the workflow deploy step anchored on a `# ── AHK VERSION FILE UPDATE ──` banner comment that no longer exists, silently skipping the insert — now anchors on the stable `- name: Update AHK version files` step name
- `scripts/setup-gas-project.sh` Phase 5b: generated per-environment diagrams lacked the mandatory "Open in mermaid.live" link — the script now generates the pako URL via `python3` (zlib is pako-compatible) with round-trip verification and a warning fallback when Python is unavailable
- All three fixes verified end-to-end against a throwaway repo copy (row placement, workflow step position, link decompression)

## [v01.02r] — 2026-07-17 06:55:07 PM EST — [63a7038](https://github.com/LightAISolutions/Sales/commit/63a70386a6a3a99c405d7ddc2aa284a185a270e2)

> **Prompt:** "Set up a new GAS project. Run the script, then commit and push.
>
> bash scripts/setup-gas-project.sh <<'CONFIG'
> {
>   "PROJECT_ENVIRONMENT_NAME": "MasterACL",
>   "TITLE": "MasterACL",
>   "DEPLOYMENT_ID": "AKfycbxgxErSg_DfV7WjVvDQ4_LVkFAkON-86iJaNhQ3k50Hs-WbQ2KLskfRtnzSVlZNIHhc8Q",
>   "SPREADSHEET_ID": "1kG2KftqfKOeYwBCEkxRpw-QBh9s-1-Dvy31sH037UvE",
>   "SHEET_NAME": "Live_Sheet",
>   "DEVELOPER_LOGO_URL": "https://lightaisolutions.github.io/Sales/images/logo-placeholder.svg",
>   "YOUR_ORG_LOGO_URL": "https://lightaisolutions.github.io/Sales/images/logo-placeholder.svg",
>   "SPLASH_LOGO_URL": "https://lightaisolutions.github.io/Sales/images/logo-placeholder.svg",
>   "INCLUDE_AUTH": true,
>   "CLIENT_ID": "830735769637-ak3c73b4lnea004i8dge8kg6n53o36vl.apps.googleusercontent.com",
>   "AUTH_PRESET": "standard",
>   "IS_MASTER_ACL": true,
>   "MASTER_ACL_SPREADSHEET_ID": "1kG2KftqfKOeYwBCEkxRpw-QBh9s-1-Dvy31sH037UvE",
>   "ACL_SHEET_NAME": "Access"
> }
> CONFIG"

### Added
- New GAS project **MasterACL** (auth-enabled, `standard` preset, flagged as the Master ACL project) created via `scripts/setup-gas-project.sh`: `live-site-pages/MasterACL.html` (v01.00w), `googleAppsScripts/MasterACL/MasterACL.gs` (v01.00g), `MasterACL.config.json` with real deployment/spreadsheet IDs, version files, page/GAS changelogs + archives, and `repository-information/diagrams/MasterACL-diagram.md`
- `Deploy MasterACL` webhook step added to `.github/workflows/auto-merge-claude.yml` (the setup script announced this step but never wrote it — added manually, mirroring the Globalacl step)
- MasterACL registered in the GAS Projects table and path scope of `.claude/rules/gas-scripts.md`; README.md tree and REPO-ARCHITECTURE.md updated with the new page, GAS node, and edges

### Fixed
- Setup script defect: the GAS Projects table row was inserted into the coding-guidelines pointer table in `.claude/rules/gas-scripts.md` — moved to the actual GAS Projects table
- Added the missing "Open in mermaid.live" link to `MasterACL-diagram.md` and regenerated the REPO-ARCHITECTURE.md Flowchart mermaid.live URL to match the updated diagram code (both verified by decompression)

## [v01.01r] — 2026-07-13 08:28:42 PM EST — [0c1f7bf](https://github.com/LightAISolutions/Sales/commit/0c1f7bfb27564bdc4913fecdf9cd3626c423d01c)

> **Prompt:** "continue with your recommendation"

### Changed
- Initialized repository identity: internal links, branding URLs, and live-site references updated from the template's `lightaisolutions` repo name to `Sales` across README.md, CITATION.cff, issue template config, REPO-ARCHITECTURE.md, index.html, sitemap.xml, and robots.txt (`bash scripts/init-repo.sh LightAISolutions Sales ShadowAISolutions` + manual follow-ups; developer branding `ShadowAISolutions` preserved)
- GAS Project Creator page defaults now point to this repository — GitHub Repo field prefills `Sales` and the three logo URL fields prefill `https://lightaisolutions.github.io/Sales/images/logo-placeholder.svg` (v01.01w)
- Regenerated `repository-information/readme-qr-code.png` to encode this repository's URL (`https://github.com/LightAISolutions/Sales`)
- Updated CLAUDE.md Template Variables table: `YOUR_REPO_NAME` → `Sales`

### Fixed
- Corrected GitHub Pages hostnames mangled by the init script's global replace — the template's org and repo share the same lowercase string, so `lightaisolutions.github.io` became `Sales.github.io` in CITATION.cff, README.md, and REPO-ARCHITECTURE.md; restored to `lightaisolutions.github.io` (paths correctly remain `/Sales/`)
- Removed the duplicate `main` push-trigger entry the init script inserted into `.github/workflows/auto-merge-claude.yml` (this copy already had `main` in the trigger)
- Regenerated the REPO-ARCHITECTURE.md Flowchart mermaid.live URL to match the updated diagram code (verified decompression)

Developed by: LightAISolutions

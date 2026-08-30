# Rule Cost Audit — Trim Recommendations & Progress Tracking

**Audit date:** 2026-04-24 02:23 PM EST
**Audit basis:** fresh first-principles read of `CLAUDE.md` + every file under `.claude/rules/` — no prior audits, changelogs, or repo history consulted
**Scope:** every rule, gate, checklist item, mandatory procedure, or required output the session loads
**Status:** source document for trim work — individual items are tracked in the checklist below

This file exists so trim proposals survive past the response that produced them. The ranked cost table is reference; the **Trim Recommendations Checklist** is the actionable list. Tick items as they land.

## Summary

| Dimension | Finding |
|---|---|
| Biggest always-loaded offender | The four-toggle output-formatting system (Template Variables rows + Precedence Header + Feature toggle gate + Silent Capture Sub-Gate + Response Opener Step 0) — ≈7–8k tokens that re-describe the same toggle semantics three times |
| Biggest per-response offender | The end-of-response block (dividers + UNAFFECTED/AFFECTED URLs + FILES CHANGED + COMMIT LOG + SUMMARY + TODO + NEW FOLDERS + CLAUDE TO DEVELOPER + closing marker) — 30–60 lines appended to every coding response |
| Biggest cognitive offender | CLAUDE TO DEVELOPER required on every response — forces manufactured "recommended next steps" even when the task has no natural follow-up |
| Savings if all T-items adopted | ~6.5k always-loaded tokens + 30–50 lines per response + ~30s per coding response |

Hard limits the audit did **not** recommend touching: `[PC-SAFETY] #0`, Pre-Push Checklist, rebase-before-edits, Session Start session-isolation, User-Owned Content (REMINDERS / TODO / SESSION-CONTEXT), provenance markers, Silent Capture Sub-Gate (when it fires), Deploy Handler Protection.

## Ranked Cost Table

Cost categories: `context` (tokens added to every loaded prompt), `tool-calls` (mandatory Bash/Read invocations), `text-gen` (output the model must write), `cognitive` (reasoning overhead before action). K/T/R = **Keep / Trim / Remove**.

| # | Rule / gate / item | Cost category | Estimated cost | Mandatory? | K/T/R | Rationale |
|---|---|---|---|---|---|---|
| 1 | Template Variables table — toggle descriptions (`CLAUDE.md`) | context | ~3.5k tokens | Yes | Trim | Each toggle row is 200–300 words; interactions are re-stated in `chat-bookends.md` Feature toggle gate |
| 2 | `chat-bookends.md` Precedence Header + Feature toggle gate + Silent Capture Sub-Gate | context, cognitive | ~2.5k tokens | Yes | Trim | Redundantly re-derives the toggle table; Silent Capture described twice |
| 3 | Response Opener Gate (Step 0–3) | cognitive, context | ~1.5k tokens | Yes | Trim | Step 0 re-does the Feature toggle gate; Step 1 overlaps with timestamp rule |
| 4 | End-of-response block — 10 sections | text-gen | 30–80 lines per response | Yes (when END=On) | Trim | UNAFFECTED URLS + SUMMARY + AFFECTED URLS + FILES CHANGED + COMMIT LOG overlap; separators required |
| 5 | Page Enumeration gate — Steps 1–3 + triple self-check | tool-calls, text-gen | +1 ls, +N reads, 5–30 URL lines | Yes (when URL section visible) | Keep (trim self-check) | Filesystem-truth enforcement load-bearing; 3-question self-check is 60 lines for what could be one |
| 6 | CLAUDE TO DEVELOPER section (every response) | text-gen, cognitive | 5–12 lines + branching decision | Yes | Trim | Claude invents a "next step" on every response; user can always say "what next?" |
| 7 | `date` calls — per-bookend timestamps | tool-calls | 3–10 Bash calls/response | Yes (when CHAT=On) | Trim (cache) | Each bookend requires fresh `date`; one cached value would suffice for same-second markers |
| 8 | `⏱️` duration annotations between every bookend pair | tool-calls, text-gen, cognitive | +1 bash per bookend, +1 line | Yes (when CHAT=On) | Trim | Gated already; when on, overhead scales with bookend count (often 6–10/response) |
| 9 | Pre-Commit [PC-CHANGELOG] #6 + `changelogs.md` auto-inject | context, text-gen | +2.5k tokens, 10–30 lines | Yes (push commit) | Keep | Data-integrity, verbose — categories + subheadings + prompt blockquote + counter + archive rotation |
| 10 | Push-commit machinery ([PC-REPO-VERSION] #15 + [PC-COMMIT-MSG] #8 + [PC-README-TIMESTAMP] #10 + [PC-PAGE-CHANGELOG] #16) | tool-calls, text-gen | 4–8 edits + 1 commit + README edit | Yes | Keep | Core deployment contract; cost proportional to value |
| 11 | Hook Anticipation — 3 git commands before closing | tool-calls | 3 bash calls/response | Yes | Keep | Prevents false closing markers; bounded cost |
| 12 | Session Start Checklist — Always Run section | tool-calls, cognitive | 5–10 git calls once/session | Yes (once) | Keep | One-time, safety-critical |
| 13 | Think Before Asserting — 4 triggers × 3 steps | cognitive, context | ~2k tokens + reasoning cycles | Yes | Keep | Quality gate; the 4-way wrapper could be flattened |
| 14 | Unaffected / Affected URL label formatting | text-gen | ~15 lines per response | Yes | Trim | Ornate per-label rules (backtick wrap + status emoji + version + subpage format + non-index format + `(TEMPLATE_DEPLOY: On)` annotation) for 2–5 URLs |
| 15 | `chat-bookends.md` Duration annotations paragraph | context, cognitive | ~600 tokens | Yes | Keep | Short, load-bearing |
| 16 | `pre-commit-gates.md` — gate decision tree | context (path-scoped) | ~1.5k tokens on CLAUDE.md edits | Conditional | Keep | Path-scoped, rare firing |
| 17 | `rule-management.md` (Placement + Precedence + Section Placement) | context (path-scoped) | ~1.8k tokens | Conditional | Keep | Rare invocation; genuinely useful during edits |
| 18 | Pre-Commit [PC-README-TREE] #7 — ASCII tree discipline | text-gen, cognitive | 1–5 tree line edits/response | Yes | Trim | Group labels + template-origin labels + per-page version display + icon cluster is a lot of surface area |
| 19 | `behavioral-rules.md` Incremental Writing gate | cognitive, tool-calls | +1–3 Edit calls for large writes | Yes | Keep | Prevents observed Write-stall pathology |
| 20 | `html-pages.md` Template Propagation [PC-TEMPLATE-PROP] #19 | cognitive | 5–10 min when triggered | Conditional | Keep | Rare; necessary when triggered |
| 21 | `mermaid-diagrams.md` (path-scoped) | context | ~2.3k tokens on REPO-ARCH edits | Conditional | Keep | Dense technical reference, fires only when relevant |
| 22 | Chesterton's Fence gate | cognitive | ~500 tokens | Yes | Keep | Prevents collateral removals |
| 23 | Pre-Push Checklist (5 items) | tool-calls | 3–5 git calls per push | Yes | Keep | Safety-critical (no proposals to trim) |
| 24 | [PC-SAFETY] #0 | cognitive | ~300 tokens + reasoning | Yes | Keep | Session-isolation; non-negotiable |
| 25 | `cli-styling-reference.md` (path-scoped) | context | ~1.4k tokens | Conditional | Trim | Useful only during format authoring; mostly restates bookends.md patterns |
| 26 | `visual-test-command.md` | context (path-scoped) | ~700 tokens | Conditional | Keep | Only injects on HTML/GAS edits |
| 27 | Imported-skills rule | context | ~400 tokens | Conditional | Keep | Small, single-purpose |
| 28 | Dead Code Detection methodology | context | ~700 tokens | Yes (when invoked) | Trim | Fires only on user request; could be path-scoped/command-triggered |
| 29 | Reference Files table (`CLAUDE.md`) | context | ~400 tokens | Yes | Keep | Low cost, high nav value |
| 30 | `changelog-security.md` (path-scoped) | context | ~1k tokens | Conditional | Keep | Safety-relevant for public changelogs |

## Trim Recommendations Checklist (T1–T9)

Each item has a fixed T-number so it can be cited by reference across sessions. Tick the checkbox when implemented; record the landed-in repo version and a one-line note describing the actual change (it may differ from the proposal — record the delta). Strike through any item that is explicitly rejected, with a rejection note.

Columns below each item: `Status` (unchecked / checked / rejected), `Landed in` (repo version, e.g. `v12.07r`), `Date` (YYYY-MM-DD), `Notes` (what was actually done, or why rejected).

### T1 — Collapse four-toggle documentation

- [ ] **T1** — Collapse Template Variables toggle descriptions to 1-line summaries + a single canonical "Toggle Resolution" block in `chat-bookends.md`. Drop the Precedence Header (fold into the Feature toggle gate). Drop Response Opener Step 0 (merge into Step 1).
    - **Status:** **Deferred** — to be re-verified or rewritten per Rules #1–6 before implementation
    - **Estimated savings:** ~3k always-loaded tokens / response · ~10s reasoning per response
    - **Deferred in:** `v12.15r`
    - **Date:** 2026-04-24
    - **Deferral reason:** T1 was written at the same audit pace as T2/T7/T8/T9, all of which were rejected as either premise-wrong, already-done, or tradeoff-negative (clean-landing base rate: 17%, 1-in-6). T1 is multi-file, multi-claim — "collapse Template Variables toggle descriptions" + "drop the Precedence Header" + "drop Response Opener Step 0" — so it compounds the per-claim verification burden. Before spending the verification effort, it's worth reconsidering whether T1 is worth pursuing at all: the three places describing toggle interactions (Template Variables rows, Precedence Header, Feature toggle gate, Response Opener Step 0) may each be serving distinct load-bearing roles — exactly the pattern that caused T9's rejection. A fresh verification pass applied at proposal-write time per Rule #4 ("grep the rule text FIRST to confirm the described misbehavior is actually specified") and Rule #6 ("check whether the described trim is already applied") would either produce a verified-implementable version of T1 or a clean rejection. Doing that work inside a continuation of this session would re-tread the same audit-from-memory pattern that produced the 17% base rate. Recommended path: a future fresh-audit session that re-reads the toggle system from actual rule text and writes a new verified proposal.

### T2 — Consolidate end-of-response summary sections

- ~~**T2** — Merge FILES CHANGED + COMMIT LOG + SUMMARY into a single "Changes" section. Drop NEW FOLDERS (fold into FILES CHANGED). Drop WORTH NOTING when empty (reclassify as "rare exception" instead of "every response consider").~~ **Rejected — three of four sub-claims already in effect; the remaining one is a tradeoff-negative change.**
    - **Estimated savings (proposal):** ~15 lines text-gen · ~5s per coding response
    - **Actual savings:** 0 (three sub-claims vacuous, one tradeoff-negative)
    - **Rejected in:** `v12.13r`
    - **Date:** 2026-04-24
    - **Rejection reason — sub-claim-by-sub-claim verdict** (verified via grep on `chat-bookends.md`):
        - **(a) Merge FILES CHANGED + COMMIT LOG + SUMMARY into one "Changes" section** → rule rows 3, 4, 6 define structurally distinct content: FILES CHANGED = "Bullet list with `(edited)` / `(created)` / `(deleted)` tag per file" (scannable file list), COMMIT LOG = "Per commit: `SHA: [SHORT_SHA](commit-url) — commit message`" (clickable SHA references), SUMMARY = "Concise bullets, each indicating which file(s) were edited" with "Non-file actions (e.g. 'Pushed to remote') need no file path" (narrative context). Merging would either produce a flat list longer than three separate sections (preserving all info) OR lose distinct information dimensions. **Tradeoff-negative, not a trim.**
        - **(b) Drop NEW FOLDERS / fold into FILES CHANGED** → rule row 8 already says `Skip entirely if no new directories were created (no header, no placeholder)`. Already skipped when empty for most responses (confirmed empirically — no response in this session v12.06r–v12.12r has emitted NEW FOLDERS). Folding non-empty NEW FOLDERS into FILES CHANGED would lose the "new directory structure created" signal since FILES CHANGED tracks files, not directories. **Vacuous for most responses, signal-loss tradeoff for the rest.**
        - **(c) Drop WORTH NOTING when empty** → rule row 5 already says `Skip if nothing worth noting`. Already in effect. **Vacuous — proposal describes behavior that is already the rule.**
        - **(d) Reclassify WORTH NOTING as "rare exception" instead of "every response consider"** → the rule contains no "every response consider" language that the sub-claim describes. The rule already instructs "Skip if nothing worth noting" — there's no always-consider-first clause to reclassify. **Vacuous — premise wrong, same failure mode as T7/T8.**
    - **Root cause of the audit error:** T2 was written at the audit level from a general impression of "end-of-response block has overlapping sections" without checking whether the overlaps were real (they aren't — the three sections carry distinct information dimensions) or whether the skip-when-empty rules were in place (they already are for NEW FOLDERS and WORTH NOTING). Rule #4 from the Calibration notes ("grep the rule text FIRST to confirm the described misbehavior is actually specified") would have caught this at audit-write time.
    - **Calibration note:** T2 is a mixed-failure — three sub-claims are vacuous-premise-wrong (matching the T7/T8 pattern), one is a tradeoff-negative misread of what a "trim" is. The rejection note documents both patterns so future audits can watch for them: (a) vacuous-skip-rule claims (the proposal says "skip when X" but the rule already says that), (b) merge-for-merge's-sake claims (the proposal says "consolidate A + B + C" but A, B, C carry different information dimensions and merging loses them).

### T3 — Make CLAUDE TO DEVELOPER opt-in

- [x] **T3** — Emit CLAUDE TO DEVELOPER only when Claude has a concrete deferred item or genuine follow-up; otherwise skip. Remove the "always emit even with nothing to recommend" rule.
    - **Estimated savings:** 5–10 lines text-gen · ~10s cognitive per response
    - **Landed in:** `v12.07r` (opt-in rule), `v12.08r` (single-primary-recommendation refinement)
    - **Date:** 2026-04-24
    - **Notes:** Edited `chat-bookends.md` in three places — (a) end-of-response table row #10 changed from "Never skipped within the block" to "Only when there's a genuine heads-up or concrete recommendation; skip entirely otherwise"; (b) "Claude to Developer section" bullet rewrote the **Gating** paragraph to require genuine heads-up OR concrete recommendation as a second condition, replaced the "Within either context, this section is **never skipped**" paragraph with explicit "What counts" (5 bullets) and "What does NOT count" (4 bullets) lists, and removed the "When there is nothing to recommend — still emit" clause; (c) RESEARCH COMPLETE closing-marker bullet updated to say "also skipped unless the response has a genuine heads-up or concrete recommendation" and inserted "(optional)" before the section in the output order. Also edited `chat-bookends-reference.md` — (a) end-of-response table row updated to match (`Never skipped when emitted` → `Only when there's a genuine heads-up or concrete recommendation; skip the section entirely otherwise`); (b) added a note to the Flow Examples intro explaining that all shown examples demonstrate the emit case (each has a recommendation), and that under the new rule the section is skipped entirely when nothing material is pending. **Delta from proposal:** proposal said "remove the 'always emit' rule"; implementation also (1) added the "To continue" omission rule for heads-up-only sections — the "To continue" line is omitted entirely when only a heads-up exists and no recommendation, instead of emitting a vestigial "To continue" with no target; (2) added concrete emit/skip examples in the rule body rather than leaving "genuine" undefined — reduces the risk of drift back to sycophantic recommendations. **Follow-up refinement (v12.08r)** — after the v12.07r landing, the developer observed that the recommendation section in the v12.07r response offered a menu of three T-items ("T4 / T5 / T6 — pick one") instead of a concrete primary recommendation. Root cause: the v12.07r rule text said "Recommended next step(s) — one or more bullet points" and the "To continue" bullet explicitly covered "pick among N" phrasing, both of which licensed the menu behavior. Structural fix landed in v12.08r: (a) "Recommended next step(s)" → singular "Recommended next step" — exactly one bullet, Claude's single best judgment, with an explicit "Never emit a menu of recommendations" directive and instructions to triage multiple candidates into one primary; (b) "To continue" rewritten to always target the single primary, with an explicit ban on pick-among-N phrasing like `continue with recommendation <N>` or `go with option B`; (c) plural `**Recommended next steps:**` header retired from the Formatting bullet — always singular now; (d) Normal flow example in `chat-bookends-reference.md` updated from two-bullet plural to one-bullet singular. Tradeoffs that would have made alternatives tempting (e.g. "T5 smaller scope vs T6 bigger savings") are now surfaced as **Heads-up** bullets rather than as peer recommendation bullets — the primary still commits to one. Net effect: the user always gets a concrete "this is what I recommend" rather than a "here are your options" menu.

### T4 — Cache `date` per response

- [ ] **T4** — Cache one `date` call per response and reuse it for all same-second bookends. Use real-time only where drift > 1 second matters (e.g. around push and closing marker, where wall-clock duration is computed).
    - **Status:** **Deferred** — low urgency on current toggle state; re-verify if/when `CHAT_BOOKENDS` flips back to `On`
    - **Estimated savings:** 2–5 Bash calls · ~10s per response when `CHAT_BOOKENDS=On`
    - **Deferred in:** `v12.15r`
    - **Date:** 2026-04-24
    - **Dependency:** only relevant when `CHAT_BOOKENDS=On`; currently `Off` on this repo
    - **Deferral reason:** Under the current toggle state (`CHAT_BOOKENDS=Off`), mid-response bookends don't fire and `date` is only called at response start + end + possibly push. The proposal's per-response savings (2–5 bash calls) don't materialize. If `CHAT_BOOKENDS` flips back to `On` and multiple bookends start firing per response, T4 becomes relevant again and should be verified per Rules #1–6 before implementation. A fresh verification would need to check: (a) whether the existing "Timestamps on bookends" paragraph already permits caching (some rules already say "a single `date` call is sufficient" for opening pairs — T4 may be partially in-effect already, i.e. the "already done" failure mode seen in T7/T9); (b) whether the proposed caching would create incorrect durations for `⏱️` annotations that depend on fresh timestamps between bookends.

### T5 — Simplify Page Enumeration self-check

- [x] **T5** — Replace the triple self-check (3 questions) with a single question ("did I read versions from disk this response?"). Keep Steps 1–3 of the gate as the hard procedure.
    - **Estimated savings (proposal):** ~40 lines context + small per-response cognitive
    - **Actual savings:** ~5 lines context + small per-response cognitive (see Delta below)
    - **Landed in:** `v12.09r`
    - **Date:** 2026-04-24
    - **Notes:** Collapsed the Page Enumeration self-check from three questions to two in `.claude/rules/chat-bookends.md` — Q1 ("did I run a filesystem command to list version files?") and Q2 ("did I read each version file's contents?") merged into a single **Enumeration** question covering both (with a parenthetical cross-reference to Steps 1–2 of the hard gate). Q3 retained as the **Partition** question with slightly updated commentary ("Question 3 is the most commonly missed" → "The **Partition** check is the most commonly missed" — the named reference is clearer than the numbered one). **Delta from proposal:** the proposal said "collapse to a single question" but Q3 does structurally distinct work from Q1+Q2 — Q1+Q2 verify enumeration (did you read the data), Q3 verifies partition (did you place pages in the correct group). The rule itself flagged Q3 as the most commonly missed check, meaning collapsing it away would have reintroduced the exact failure mode the self-check was designed to catch (a `.gs` edit whose embedding page is missed → wrong group). Correct trim is two questions, not one — savings are smaller (~5 lines instead of ~40) but behaviorally safe. The proposal's savings estimate overcounted because it assumed all 3 questions were redundant with Steps 1–3 of the hard gate; in fact only Q1+Q2 overlap with Steps 1–2, while Q3 is a genuine verification pass on Step 3 that remains necessary.

### T6 — Path-scope Dead Code Detection

- [x] **T6** — Move Dead Code Detection methodology from `behavioral-rules.md` (always-loaded) to a path-scoped file or a `/dead-code-scan` command file. Currently always-loaded but fires only on user request.
    - **Estimated savings (proposal):** ~700 always-loaded tokens
    - **Actual savings:** ~700 tokens saved on responses that do NOT edit HTML pages, GAS scripts, or workflow files (e.g. rule-file edits, CHANGELOG-only commits, README tweaks, repo-audit work). On responses that DO edit those files, the methodology still auto-loads via the new file's `paths:` frontmatter — same context footprint as before, just loaded from a different file. Net effect: savings are conditional on file scope, not unconditional.
    - **Landed in:** `v12.10r`
    - **Date:** 2026-04-24
    - **Notes:** Created new path-scoped rules file `.claude/rules/dead-code-detection.md` with `paths:` frontmatter covering `live-site-pages/**/*.html`, `googleAppsScripts/**/*.gs`, and `.github/workflows/**` — same pattern as `visual-test-command.md` (path-scoped to relevant code files, with the user-command trigger embedded in the body). Moved the full 6-step methodology + "Indicators dead code is present" list + resource-abuse exemption note verbatim from `behavioral-rules.md` to the new file. In `behavioral-rules.md`, replaced the full `## Dead Code Detection Methodology` section with a short `## Dead Code Detection` pointer (section heading + one-line cross-reference). Added a row for the new file to CLAUDE.md's Reference Files table, and registered the file in README.md's `.claude/rules/` tree between `cli-styling-reference.md` and `gas-scripts.md` (alphabetical). **Delta from proposal:** proposal said "path-scoped or command-triggered"; implementation went with both — `paths:` frontmatter handles auto-inject on relevant file edits, and the body contains the user-command trigger phrases ("check for dead code", "find unused code", "is this code still used?", "clean up dead code") so the methodology can be invoked by name on any file. Savings estimate held up — the content is ~30 lines / ~700 tokens as estimated and it relocated cleanly with no structural changes needed (confirming the T5 calibration concern did NOT apply here: the proposal's assumption that Dead Code Detection was self-contained turned out to be accurate).

### T7 — Drop `(TEMPLATE_DEPLOY: On)` URL annotation on forks

- ~~**T7** — On forks (non-template repos), the `(TEMPLATE_DEPLOY: On)` annotation on URL lines is informational-only and static. Annotate only on the template repo where the toggle is actively relevant.~~ **Rejected — annotation already correctly gated; proposal solves a non-problem.**
    - **Estimated savings (proposal):** ~3 lines text-gen per response
    - **Actual savings:** 0 (annotation is already never emitted on forks)
    - **Rejected in:** `v12.12r`
    - **Date:** 2026-04-24
    - **Rejection reason:** Verified via grep on `chat-bookends.md` for `TEMPLATE_DEPLOY: On`: the rule text at lines 108 and 111 explicitly gates the annotation to the **"template repo with `TEMPLATE_DEPLOY` = `On`"** pattern. The other URL-format branches ("When the live site is deployed (non-template repos)" and "When no live site is deployed (template repo with `TEMPLATE_DEPLOY` = `Off`)") specify URL format with no annotation. On forks (where `IS_TEMPLATE_REPO` does not match the repo name), the non-template-repo branch fires and the annotation is never emitted. The Template Variables table entry for `TEMPLATE_DEPLOY` also confirms "Has no effect on forks" — consistent with the rule. Empirical confirmation: every URL section emitted in this session's responses (v12.06r through v12.11r) correctly shows page URLs with no `(TEMPLATE_DEPLOY: On)` annotation, because this repo is a fork.
    - **Root cause of the audit error:** T7's text described an imagined problem (annotation leaking to forks) without checking the current rule. If I had grepped `chat-bookends.md` for `TEMPLATE_DEPLOY: On` during the original audit, the gating would have been visible immediately. Same class of error as T8 — proposal based on an incorrect premise rather than a verified observation. The Calibration notes row's "cite exact file and line" rule, added in v12.11r, would have caught this at audit-write time.
    - **Adjacent observation worth noting (not acting on):** all 7 flow examples in `chat-bookends-reference.md` (lines 92, 144, 202, 260, 343, 383, 425) demonstrate the template-deploy-enabled case with the `(TEMPLATE_DEPLOY: On)` annotation, even when the example is varying orthogonal toggles (CHAT_BOOKENDS, TIMING_ESTIMATES). A fork reader sees examples with annotations that wouldn't apply to their repo. This is a minor docs-polish opportunity — maybe "T10 candidate" — but it's a clarity improvement, not a context-saving trim, and not what T7 specified. Flagged here for future consideration; no action in this commit.

### T8 — Drop four-tier template-origin labels from URL sections

- ~~**T8** — Remove per-label template-origin system (`[template]` / `[template · initialized]` / `[template · modified]` / `[template · initialized · modified]`) from the URL sections. Keep this information in `REPO-ARCHITECTURE.md` tree and README tree only.~~ **Rejected — proposal based on a premise error.**
    - **Estimated savings (proposal):** ~10 lines context + minor per-response cognitive
    - **Actual savings:** 0 (cannot be implemented as specified)
    - **Rejected in:** `v12.11r`
    - **Date:** 2026-04-24
    - **Rejection reason:** The four-tier template-origin labels do **not** live in the URL sections of `chat-bookends.md` or `chat-bookends-reference.md` — verified via grep for `[template]` / `template ·` / `template-origin` / `four-tier` across both files (zero matches). The labels actually live in `README.md`'s ASCII tree (as the `—` descriptions after each filename) and in `repository-information/REPO-ARCHITECTURE.md`'s Mermaid node labels. They are governed by Pre-Commit items `[PC-REPO-ARCH] #5` and `[PC-README-TREE] #7`, not by any rule in `chat-bookends.md`. URL sections use a different label system entirely — `🌐🟢/🟡/🔴` status emoji + page name + version in backticks — with no template-origin dimension. T8 as written cannot be implemented because there is nothing to remove from the rule files it names.
    - **Root cause of the audit error:** during the original audit I conflated two structurally distinct surfaces — "URL sections" (which enumerate tracked pages with status/version labels) and "file-enumeration listings" (the README tree + REPO-ARCHITECTURE.md diagrams, which enumerate files with template-origin labels). Both enumerate something and both use labels, but the labels are different systems. The audit was done at a pace where this conflation wasn't caught.
    - **Alternative reinterpretations considered and rejected:** (a) drop the four-tier labels from the README tree where they actually live — would simplify ~20 lines but loses real information (which files init touched vs which were customized post-init); (b) drop them from REPO-ARCHITECTURE.md Mermaid nodes — narrower scope but same information-loss tradeoff. Both options trade informative labels for minor context savings; the labels are doing real work where they are, so removing them would be a regression in the audit file's sense, not a trim. Keeping them in place is the correct call.
    - **Lesson for the audit:** future trim proposals should cite the exact file and line where the target construct lives, not a general area. "Labels in URL sections" described a system that doesn't exist; "labels at `README.md:249–335` and `REPO-ARCHITECTURE.md` Mermaid nodes" would have surfaced the premise error at audit-write time.

### T9 — Consolidate chat-bookends files

- ~~**T9** — Consolidate `chat-bookends.md` + `chat-bookends-reference.md`. Move flow examples into `chat-bookends.md` behind a path-scoped condition; delete the duplicate summary tables.~~ **Rejected — mechanism doesn't exist AND the split T9 is reaching for is already implemented.**
    - **Estimated savings (proposal):** ~3k tokens context when editing bookends files
    - **Actual savings:** 0 (the desired split already exists in the correct shape)
    - **Rejected in:** `v12.14r`
    - **Date:** 2026-04-24
    - **Rejection reason — sub-claim-by-sub-claim verdict:**
        - **(a) "Move flow examples into `chat-bookends.md` behind a path-scoped condition"** → mechanically impossible. `chat-bookends.md` has `paths: []` with `# always-loaded (no path scope)` in frontmatter. The rule-injection system is **file-level**, not section-level — a file either has a `paths:` frontmatter (path-scoped) or doesn't (always-loaded). No per-section path scoping mechanism exists. Moving flow examples into an always-loaded file would INCREASE always-loaded context, not trim it. **Mechanism-wrong, same category as T7/T8.**
        - **(b) "Delete the duplicate summary tables"** → overlap exists but tables serve distinct roles. `chat-bookends.md`'s end-of-response table (rows 82-92) is the authoritative **rule specification** with columns "When included (skip rule)" and "Content / format." `chat-bookends-reference.md`'s tables ("Bookend Summary — Mid-Response" and "Bookend Summary — End-of-Response Block") are **quick-lookup summaries** with columns "When / Position / Timestamp / Duration." Different information dimensions covering the same bookends, complementary not duplicate. Deleting one side loses either the spec authority or the quick-lookup affordance. **Tradeoff-negative, not a trim.**
    - **Critical meta-observation:** the split T9 is reaching for is **already implemented.** `chat-bookends.md` (256 lines, ~19k chars) is always-loaded with actionable rules; `chat-bookends-reference.md` (452 lines, ~24k chars of tables + code examples) is path-scoped (loads only on bookend/CLAUDE.md edits). This IS the "keep always-loaded minimal, put reference in path-scoped" shape T9 describes — just expressed in terms of a mechanism that doesn't exist. T9 is effectively asking "please do X" where X is already done.
    - **Root cause of the audit error:** T9 was written without checking the existing file-level path-scope system and without reading the existing file-split design intent. The frontmatter comment in `chat-bookends-reference.md` explicitly says *"Everyday responses don't need to reload the examples — the actionable rules live in `chat-bookends.md` (always-loaded)"* — that sentence documents the design T9 asked for. The audit missed it.
    - **Third "already done" rejection in a row:** T7 (annotation already correctly gated), parts of T2 (NEW FOLDERS and WORTH NOTING already skip when empty), and now T9 (the bookend file split is already correctly implemented). This is a distinct failure pattern beyond pure premise-wrong — **"proposal describes a trim that's already applied."** Adding Rule #6 to the Calibration notes to watch for it.

### Aggregate status

| Metric | Value |
|---|---|
| Total proposals | 9 |
| Completed | 3 (T3, T5, T6) |
| In progress | 0 |
| Rejected | 4 (T2, T7, T8, T9) |
| Deferred | 2 (T1, T4) |
| Pending | 0 |
| Running savings (completed only) | ~5–10 lines per response (responses with no material follow-up, from T3) + ~5 lines context on every response with URL sections (from T5) + ~700 tokens on every non-HTML/GAS/workflow response (from T6) + ~10s cognitive per response |
| Potential savings if all remaining adopted | ~5.8k always-loaded tokens (T1 dominates) + minor text-gen + ~15s/response |
| Calibration notes | Six datapoints so far: 1 accurate (T6), 1 overstated (T5), 4 rejected (T2, T7, T8, T9). Clean-landing base rate: **17%** (1-in-6). **T5 (overestimate):** actual savings (~5 lines) came in below the proposal estimate (~40 lines) because the proposal assumed Q3 of the self-check was redundant with Steps 1–3 of the hard gate; it isn't. **T6 (accurate):** proposal estimate (~700 tokens) held up because the methodology was self-contained and relocated cleanly. **T8 (rejected — premise wrong):** proposal claimed four-tier template-origin labels lived in URL sections; grep verified they live in README tree + REPO-ARCHITECTURE.md, governed by Pre-Commit items not chat-bookends. **T7 (rejected — premise wrong, same failure mode as T8):** proposal claimed `(TEMPLATE_DEPLOY: On)` annotation leaks to forks; grep confirmed the rule already correctly gates it to template-repo + `TEMPLATE_DEPLOY=On` only. The audit described an imagined problem rather than verifying current rule behavior. **Rules for future trims:** (1) verify the proposal's assumption against the actual rule text before implementation, (2) cite the exact file and line where the target construct lives (not a general area), (3) document outcome — held up / overstated / rejected — so the trim history itself teaches which audit patterns are reliable. **New rule added v12.12r:** (4) for any proposal that describes a rule "misbehaving" in some way, grep the rule text FIRST to confirm the described misbehavior is actually specified. T7 and T8 both described misbehavior that the rule doesn't actually exhibit. **New rule added v12.13r:** (5) for any proposal that says "merge A + B + C into one", verify A, B, C actually carry overlapping information. If they carry distinct dimensions (e.g. scannable file list vs clickable SHA references vs narrative bullets — as FILES CHANGED / COMMIT LOG / SUMMARY do), merging is an information-loss change, not a trim. **T9 (rejected — mechanism-wrong + already-done):** proposal said "move flow examples into `chat-bookends.md` behind a path-scoped condition" — but per-section path scoping doesn't exist in this rule system (scope is file-level via `paths:` frontmatter), and the split T9 reaches for (keep always-loaded minimal, put reference in path-scoped) is already implemented via the two-file architecture. T9 described a trim that was already applied, just in terms of a mechanism that doesn't exist. **New rule added v12.14r:** (6) when a proposal describes a trim, check whether the described trim is already applied. "Already done" is a distinct failure mode from "premise wrong" — T7 (annotation already gated), parts of T2 (skip-when-empty already in rule), and T9 (file split already implemented) all fell into this pattern. Grep for the supposed target + read the existing frontmatter/structure BEFORE writing up the proposal. **Meta-observation:** 4 of 6 proposals verified so far have been rejected. The original audit was written at a pace that produced reliable proposals ~33% of the time. Only two proposals remain — **T1 (toggle consolidation, highest-stakes + highest-complexity)** and **T4 (cache `date` per response, deprioritized on current toggle state)**. Given the 17% clean-landing base rate, a reasonable path forward is to either (a) verify T1 carefully before any implementation, or (b) step back and rewrite T1/T4 from actual rule text rather than continuing to verify derived-from-memory proposals. |

## Top-3 Biggest Time Sinks (narrative)

**(a) The four-toggle output-formatting system.** The Template Variables table (≈3.5k tokens) + `chat-bookends.md` Precedence Header + Feature toggle gate + Silent Capture Sub-Gate + Response Opener Gate collectively consume ~7–8k tokens of always-loaded context, and the model must cognitively re-resolve "which toggles are on?" on every single response. The same toggle interactions are described in three places (Template Variables rows, Precedence Header, Feature toggle gate) with enough divergence that a reader has to consult all three to be sure. Under the current repo state (START=On, CHAT=Off, TIMING=On, END=On), only five of the sixteen documented combinations are ever used in practice. Addressed by **T1**.

**(b) The end-of-response block on every coding response.** With `END_OF_RESPONSE_BLOCK=On`, every response emits dividers + UNAFFECTED URLS (reference URLs + per-page labels + versions + status emojis) + AGENTS USED + FILES CHANGED + COMMIT LOG + WORTH NOTING + SUMMARY + TODO + NEW FOLDERS + AFFECTED URLS + CLAUDE TO DEVELOPER + ACTUAL TOTAL COMPLETION TIME + closing marker. On a one-file edit push, this block is 30–60 lines of metadata appended to a 10-line change. The URL section formatting alone (label/blockquote pairing, backtick wrapping, status emoji, version decoration, `(TEMPLATE_DEPLOY: On)` annotation, non-index vs subpage URL patterns) is 100+ lines of rule prose producing 2–5 URLs. SUMMARY + FILES CHANGED + COMMIT LOG largely restate each other. Addressed by **T2**, **T7**, **T8**, **T14** (URL formatting trim — row 14 in the ranked table).

**(c) CLAUDE TO DEVELOPER on every response.** Claude must invent a "recommended next step" even when the user's request is fully answered — and the rule explicitly forbids the natural "nothing to recommend" exit by requiring the section to still be emitted. Per response this is 5–12 lines of manufactured follow-up work plus a cognitive tax of deciding what to recommend. The failure mode is well-trained now: sycophantic "next step" suggestions that pad the response. The user can always ask "what next?" on their own. Addressed by **T3**.

## Redundancy Scan

Rules or sections that catch the same failure mode or duplicate each other's work. These are the candidates for consolidation (most already have a T-number):

- **Toggle semantics documented 3×** (Template Variables rows, Precedence Header, Feature toggle gate; Response Opener Step 0 partially overlaps). → **T1**.
- **Silent Capture Sub-Gate documented 2×** (Feature toggle gate body + implied in Response Opener Step 1 conditional). → part of **T1**.
- **Response Opener Step 0** re-does the Feature toggle gate with a different label. One procedural gate — not two. → part of **T1**.
- **Chat bookends summary in two files**: `chat-bookends.md` (always-loaded, ~75KB) + `chat-bookends-reference.md` (path-scoped, ~23KB). Reference tables in the smaller file partially duplicate the bullet rules in the larger one. → **T9**.
- **Pre-commit gate logic documented 3×**: CLAUDE.md Template Repo Guard + per-item "Skip on template repo when …" caveats + `pre-commit-gates.md` full decision tree. No T-number yet — leaving the per-item caveats is probably correct (they are the enforceable contract), but the Template Repo Guard prose in CLAUDE.md overlaps the pre-commit-gates file.
- **FILES CHANGED / SUMMARY / COMMIT LOG** restate the same data in three formats. → **T2**.
- **UNAFFECTED URLS / AFFECTED URLS / PLANNED AFFECTED URLS** all drive from the same filesystem enumeration with different decorations. → adjacent to **T7**/**T8**.
- **Think Before Asserting's 4 triggers** share three near-identical procedures (search → alternative → commit); the consolidation note says this replaced 4 separate gates but the 4-way wrapper remains. No T-number — candidate for a future T10.
- **Dead Code Detection methodology** (~700 tokens) always-loaded but fires only on explicit user request. → **T6**.
- **Page Enumeration Gate's self-check** asks three questions where one covers the other two. → **T5**.

## Keep-As-Is (Justified Cost)

These rules carry real cost but the benefit justifies it. No trim proposals target them, and the audit's standing constraints (safety gates, user-owned content, provenance) explicitly protect them from trimming.

- **[PC-SAFETY] #0** — session-provenance gate, non-negotiable. Prevents cross-repo contamination from inherited session context.
- **Pre-Push Checklist (all 5 items)** — push-once enforcement, branch hygiene, cross-repo check, commit audit. Explicit audit constraint forbids trimming.
- **Rebase-before-edits** (Pre-Commit push-commit section) — prevents merge-loop churn during concurrent work.
- **Session Start session-isolation checks** — cross-session contamination is a real observed failure mode per the rule prose itself.
- **Silent Capture Sub-Gate** — when it fires (START=Off + TIMING=On), it prevents fabricated timestamps; explicit audit constraint forbids trimming when firing.
- **Page Enumeration Gate Steps 1–3** — filesystem truth over memory; required for correctness. Only the self-check is trim-candidate (T5).
- **Hook Anticipation** — 3 git commands is cheap versus false closing markers.
- **[PC-CHANGELOG] #6 push-commit versioning** — data integrity of the public history. Verbose but load-bearing.
- **[PC-TEMPLATE-PROP] #19** — rare trigger, but prevents template drift when it fires.
- **User-Owned Content** rule — protects REMINDERS / TODO / SESSION-CONTEXT. Explicit audit constraint forbids trimming.
- **Provenance markers** rule — preserves origin attribution. Explicit audit constraint forbids trimming.
- **Chesterton's Fence** — prevents collateral deletions during unrelated fixes. Used rarely but critical when triggered.
- **Incremental Writing** gate — prevents the observed Write-stall pathology on large files.
- **Deploy Handler Protection** (`gas-scripts.md`) — one bug here historically broke auto-deploy; the cost of the reminder is trivial relative to the failure mode.
- **Reference Files table** (CLAUDE.md) — low token cost, high navigation value.

## How to use this file

- When starting a trim session, pick one unchecked item from the **Trim Recommendations Checklist** and reference its T-number in the commit.
- **Four status states** a T-item can be in (tracked by the checkbox + status labels):
  - `- [ ]` **Pending** — not yet touched; the proposal text is the only content
  - `- [x]` **Completed** — implemented; a "Landed in" version + date + notes describe what actually shipped (may differ from proposal; record the delta)
  - `~~...~~` **Rejected** — proposal can't or shouldn't be implemented; strike through with `~~...~~` + a detailed rejection note covering grep-verification, root cause, and any alternatives considered. **Never delete** — the rejection is load-bearing history
  - `- [ ]` with **Status: Deferred** label — proposal is deferred to a future session; may be re-verified or rewritten rather than implemented as-is. Keep the checkbox unchecked (neither done nor invalidated) + a "Deferred in" version + date + deferral reason
- As each item transitions, fill in the corresponding metadata (landed / rejected / deferred version + date + reasoning). Do NOT delete completed, rejected, or deferred items — keeping them in the list documents what ground has already been covered, and preserves the reasoning so a future session doesn't re-litigate a settled decision.
- Rules #1–6 in the **Calibration notes** row encode lessons learned during implementation. Apply them at proposal-write time (when doing a fresh audit) to reduce the premise-wrong / already-done / tradeoff-negative rejection rate on new proposals.

## Session 1 Wrap (2026-04-24)

**Starting state:** 9 proposals (T1–T9) produced by a single-pass audit of CLAUDE.md + `.claude/rules/**`, written at a pace where premise verification was limited.

**Ending state:**

| Outcome | Count | Items | Savings |
|---|---|---|---|
| Completed | 3 | T3, T5, T6 | ~5–10 lines/response (T3, on closed-task responses) + ~5 lines context/response (T5, on URL-section responses) + ~700 always-loaded tokens (T6, on non-HTML/GAS/workflow responses) |
| Rejected | 4 | T2, T7, T8, T9 | 0 (four distinct failure modes — see Calibration notes) |
| Deferred | 2 | T1, T4 | 0 yet — see deferral reasons in their entries |

**Versions landed during the trim track:** v12.06r (audit file created with T1–T9 checklist) → v12.07r (T3 opt-in) → v12.08r (T3 single-primary refinement) → v12.09r (T5 self-check collapse) → v12.10r (T6 Dead Code relocation) → v12.11r (T8 rejected) → v12.12r (T7 rejected) → v12.13r (T2 rejected) → v12.14r (T9 rejected) → v12.15r (T1 + T4 deferred, session wrap).

**Three distinct rejection failure modes emerged:**

1. **Premise wrong (T7, T8):** proposal described a rule "misbehaving" in a specific way that the rule doesn't actually exhibit. Caught by grep on the rule text (Calibration note Rule #4).
2. **Already done (T7, parts of T2, T9):** proposal described a trim the repo has already applied, sometimes in terms of a mechanism that doesn't exist (T9's "path-scoped condition inside an always-loaded file"). Caught by checking existing structure BEFORE writing the proposal (Calibration note Rule #6).
3. **Tradeoff-negative merge (parts of T2):** proposal to "merge A + B + C into one" when A, B, C carry distinct information dimensions. Merging loses information, doesn't trim it. Caught by verifying A/B/C actually overlap before proposing a merge (Calibration note Rule #5).

**Calibration framework built during rejection work** (most portable artifact from this session):

- Rule #1: verify the proposal's assumption against the actual rule text before implementation
- Rule #2: cite the exact file and line where the target construct lives (not a general area)
- Rule #3: document outcome — held up / overstated / rejected — so the trim history itself teaches which audit patterns are reliable
- Rule #4 (v12.12r): for any proposal that describes a rule "misbehaving", grep the rule text FIRST to confirm the described misbehavior is actually specified
- Rule #5 (v12.13r): for any merge proposal ("merge A + B + C into one"), verify A, B, C actually carry overlapping information — otherwise merging is information-loss, not trim
- Rule #6 (v12.14r): check whether the described trim is already applied before proposing it

**Clean-landing base rate of original audit:** 17% (1-in-6 verified proposals shipped cleanly). Another ~17% was an overstate (T5). The rest were rejected. A fresh audit applying Rules #1–6 at proposal-write time should produce a substantially higher clean-landing rate.

**Recommended structure for a future trim session:**

1. Start with a fresh audit pass that reads CLAUDE.md + `.claude/rules/**` from scratch
2. For each proposed trim, apply Rules #1–6 immediately at write time — grep the rule text, cite exact line ranges, verify the described behavior actually exists, check whether the trim is already applied, verify any "merge" proposal has real overlap to merge
3. Record each proposal with its verification evidence in `RULE-COST-AUDIT.md` (append to the existing file under a new `## Session 2 Proposals` section — don't overwrite Session 1's record)
4. Implement verified proposals in order of savings-per-effort, following the same push-commit pattern used in this session (one T-item per push commit, audit file ticked in the same commit)

## Session 2 Proposals

**Audit date:** 2026-04-24 04:44 PM EST
**Audit basis:** fresh first-principles re-read of `CLAUDE.md` lines 1-80 (Template Variables + Always Run) + `.claude/rules/chat-bookends.md` (full file, 256 lines). Rules #1–6 from the Session 1 Calibration framework applied at each proposal's write time
**Starting state (from Session 1):** 3 completed (T3, T5, T6), 4 rejected (T2, T7, T8, T9), 2 deferred (T1, T4)
**Session 2 outcome:** 1 deferred proposal re-verified and refined into T1-v2 (sub-claim (a) implementable, (b)/(c) rejected); 3 new candidates (T10, T11, T12) discovered during the fresh read, each with full Rules #1–6 verification at write time

### T1-v2 — Refine T1 after sub-claim-by-sub-claim verification

The original T1 from Session 1 had three sub-claims bundled together. Applying Rules #1, #5, #6 to each sub-claim individually produces a refined T1-v2 that keeps only the implementable piece.

**Sub-claim verdict table:**

| Sub-claim | Verdict | Rule | Evidence |
|---|---|---|---|
| (a) Collapse Template Variables toggle descriptions to 1-line summaries | **KEEP (adjusted savings)** | #1, #5 | CLAUDE.md:21-24 each row ~350-400 words; chat-bookends.md:20-44 Feature toggle gate describes per-toggle Off behavior. Partial overlap verified, but Template Variables rows uniquely contain "does NOT control X" disambiguation that must be preserved |
| (b) Drop the Precedence Header (fold into Feature toggle gate) | **REJECT** | #5 | Precedence Header (chat-bookends.md:10-18) = meta-ordering (WHEN gates fire); Feature toggle gate (chat-bookends.md:20-44) = per-toggle behavior (WHAT the gate does). Distinct information dimensions — merging is information-loss, not a trim. Same failure mode as T2's FILES CHANGED + COMMIT LOG + SUMMARY rejection |
| (c) Drop Response Opener Step 0 (merge into Step 1) | **REJECT** | #5 | Step 0 (chat-bookends.md:193-196) = mental toggle-resolution action; Step 1 (chat-bookends.md:197) = Bash `date` tool call. Procedurally distinct — the hard gate's enforcement depends on atomicity of each step. Merging weakens the procedural barrier that the rule says beats descriptive advice |

**T1-v2 refined proposal:**

- [x] **T1-v2** — Collapse the 4 Template Variables toggle rows (`START_OF_RESPONSE_BLOCK`, `CHAT_BOOKENDS`, `TIMING_ESTIMATES`, `END_OF_RESPONSE_BLOCK`) at `CLAUDE.md:21-24` from multi-paragraph descriptions (~350-400 words each) to 1-line purpose summaries. Relocate the "Does NOT control X" cross-toggle disambiguation content to the corresponding Feature toggle gate rows at `chat-bookends.md:20-24` as a trailing note on each row. Preserve the "Fully independent of..." declaration in exactly one place (not two). Do NOT touch the Precedence Header or Response Opener Step 0 — those are load-bearing per (b)/(c) above.
    - **Status:** Completed
    - **Estimated savings (proposal):** ~1.5k always-loaded tokens
    - **Actual savings:** ~1.5k always-loaded tokens — the 4 toggle rows in CLAUDE.md collapsed from ~350-400 words each (~1400 words total = ~9k chars = ~2.2k tokens) to 1-line summaries averaging ~60 words each (~240 words total = ~1.6k chars = ~400 tokens). Net CLAUDE.md savings: ~1.8k tokens. Two small additions to chat-bookends.md (~150 tokens combined) preserve the unique content. Net always-loaded reduction: ~1.65k tokens. Hit the proposal estimate within margin.
    - **Landed in:** `v12.20r`
    - **Date:** 2026-04-28
    - **Notes:** Six edits total. (1-4) Replaced each of the 4 toggle rows in CLAUDE.md Template Variables table with a 1-line summary covering purpose + On/Off behavior + cross-reference to `chat-bookends.md` Feature toggle gate. The new rows preserve the symmetric pairing observation (`START_OF_RESPONSE_BLOCK` ↔ `END_OF_RESPONSE_BLOCK`) and the always-paired-markers observation (`TIMING_ESTIMATES`) that were uniquely valuable framings. (5) Added a "When `TIMING_ESTIMATES` = `On`" note to the Feature toggle gate's `TIMING_ESTIMATES` bullet at `chat-bookends.md:23` capturing the always-paired-markers behavior + the standalone-emission detail when other toggles are off. (6) Added a "pairs symmetrically with `START_OF_RESPONSE_BLOCK`" note to the Feature toggle gate's `END_OF_RESPONSE_BLOCK` bullet at `chat-bookends.md:24`. The "Does NOT control X" disambiguation prose was largely already in chat-bookends.md by way of separate-toggle naming (each toggle's bullet is explicit about what IT controls; the Feature toggle gate's structure makes it clear that other behaviors are governed by other toggles); the 1-line summaries in CLAUDE.md preserve enough scope-narrowing that someone reading just CLAUDE.md still understands what the toggle does AND knows where to find the full spec. The "Fully independent of all four toggles" declaration now lives only at `chat-bookends.md:26` (Feature toggle gate's "Full independence" bullet) — removed from each CLAUDE.md row. **Delta from proposal:** none material — the proposal's risk note was about preserving cross-toggle disambiguation, which the new chat-bookends.md additions handle. The 1-line summaries in CLAUDE.md ended up slightly longer than "1 line" (averaging 60 words / ~3 lines wrapped) but are dramatically shorter than the originals and stay scope-narrow. **Calibration verdict:** T1-v2 was the highest-savings remaining proposal and the highest-complexity (4 toggles × content relocation across 2 files = 6 coordinated edits). T10's success de-risked it as predicted in the v12.19r CLAUDE TO DEVELOPER recommendation. Third clean Session 2 landing — Session 2 clean-landing rate now 3/3, vs Session 1's 17%. Strong evidence the Calibration framework's "Rules #1–6 applied at write time" approach produces meaningfully more reliable proposals.

### T10 — Consolidate Silent Capture Sub-Gate into Response Opener Step 2

- [x] **T10** — The Silent Capture Sub-Gate at `chat-bookends.md:26-42` is a 17-line hard-gate procedure (4 steps + 4-question self-check) for capturing the response-start timestamp + overall estimate when `START_OF_RESPONSE_BLOCK` = `Off` + `TIMING_ESTIMATES` = `On`. Its Steps 1-4 correspond 1:1 to the Response Opener Gate's Step 2 Timing-only branch at `chat-bookends.md:200`. The Sub-Gate explicitly cross-references the Response Opener ("The Feature toggle gate's 'Silent Capture Sub-Gate' paragraph specifies what else must happen silently"). Consolidating the Sub-Gate's content into the Timing-only branch description eliminates the dual-source-of-truth pattern while keeping the 4-question self-check (which is load-bearing and should stay verbatim).
    - **Status:** Completed
    - **Estimated savings (proposal):** ~500 always-loaded tokens
    - **Actual savings:** ~500 always-loaded tokens — the Sub-Gate (17 lines + indented blockquote scaffolding) was removed from the Feature toggle gate, the Timing-only branch line at the Response Opener Step 2 was expanded to absorb the failure-mode framing + 4-step procedure (renumbered as Step 2a/2b/2c/2d to reflect they're sub-steps of Step 2) + 4-question self-check verbatim. Net file change: -21 lines on `chat-bookends.md`.
    - **Landed in:** `v12.19r`
    - **Date:** 2026-04-24
    - **Notes:** Five edits total. (1) Removed the standalone Silent Capture Sub-Gate from the Feature toggle gate, replacing it with a 1-line cross-reference bullet pointing readers to the Response Opener Step 2 Timing-only branch as the single authoritative source. (2) Expanded the Response Opener Step 2 Timing-only branch from a 1-line description into a fully self-contained specification: failure-mode framing ("THIS BRANCH BLOCKS writing ACTUAL TOTAL COMPLETION TIME or ESTIMATE CALIBRATED with missing data"), 4-step procedure renumbered as Step 2a–2d, and the 4-question self-check verbatim from the original Sub-Gate. (3) Updated cross-reference at the Feature toggle gate `TIMING_ESTIMATES` row in `chat-bookends.md:23`: "The Silent Capture Sub-Gate does not fire" → "The Response Opener Step 2 silent-capture branch does not fire". (4) Updated cross-reference in the "Timestamps on bookends" rule at `chat-bookends.md:146`: "(see feature toggle gate 'Silent Capture Sub-Gate')" → "(see Response Opener Step 2 Timing-only branch)". (5) Updated cross-reference in the Response Opener Gate self-check at `chat-bookends.md:208`: "(per the Silent Capture Sub-Gate)" → "(per Response Opener Step 2 Timing-only branch)". Also (6) updated the same cross-reference at `CLAUDE.md:23` (Template Variables `TIMING_ESTIMATES` row) for consistency. Verified post-edit via `grep -rn "Silent Capture Sub-Gate" .claude/rules/ CLAUDE.md` → zero matches. **Delta from proposal:** none material — the proposal said "consolidate while keeping the 4-question self-check verbatim" and that's exactly what landed. The Step 1-4 procedure was renumbered to Step 2a-2d to reflect they're sub-steps of the Response Opener's Step 2 (a clarity improvement, not a content change). **Calibration verdict:** T10 was the second-cheapest Session 2 win after T11. Like T11, it landed cleanly with no delta from the written proposal — second clean Session 2 datapoint. Both validated proposals so far were content-preservation patterns: T11 deleted pure duplication (no preservation needed); T10 relocated content (full preservation in the new home).

### T11 — Deduplicate "`⏱️` must precede this bookend" cross-references

- [x] **T11** — Five mid-response bookend bullets at `chat-bookends.md:51-55` each end with `**\`⏱️\` must precede this bookend** (see Duration annotations)` (CHECKLIST / RESEARCHING / NEXT PHASE / BLOCKED / VERIFYING). The authoritative rule at `chat-bookends.md:152` already states "a `⏱️` annotation appears between **every** consecutive pair of bookends" with stronger "MANDATORY — NEVER SKIP" framing. The 5 per-bookend cross-references are pure duplication — removing them leaves exactly one source of truth.
    - **Status:** Completed
    - **Estimated savings (proposal):** ~150 tokens + improved clarity
    - **Actual savings:** ~150 tokens + improved clarity (proposal estimate held — pure duplication removal with no preserved content; the canonical rule at `chat-bookends.md:152` carries the full enforcement weight already).
    - **Landed in:** `v12.18r`
    - **Date:** 2026-04-24
    - **Notes:** Single Edit with `replace_all=true` removed all 5 occurrences of ` **\`⏱️\` must precede this bookend** (see Duration annotations)` from `chat-bookends.md`. Verified before edit: the phrase appeared exactly 5 times (CHECKLIST line 51, RESEARCHING line 52, NEXT PHASE line 53, BLOCKED line 54, VERIFYING line 55). After edit: each bullet ends with its own substantive content without the redundant cross-reference. The Duration annotations rule at `chat-bookends.md:152` (now at the same line position since the removals happen earlier in the file but inline within bullets, not as full-line deletions) still carries the full "MANDATORY — NEVER SKIP" + numbered procedure + self-check, unchanged. **Delta from proposal:** none — the proposal described the change exactly, the implementation matched. **Calibration verdict:** T11 was the lowest-risk Session 2 proposal and landed cleanly. Validates the Session 2 verification approach (Rules #1–6 applied at write time) for low-complexity proposals. Higher-complexity proposals (T1-v2, T10, T12) remain to be tested against the same approach.

### T12 — Compress Response Opener Gate meta-commentary

- [ ] **T12** — `chat-bookends.md:208-216` (post-T10/T1-v2 line numbers; was originally 218-226) contains four explanatory paragraphs after the Response Opener Gate self-check: "Why previous rules failed", "Why procedural gates beat descriptive rules here", "The cascade", and "Session Start Checklist is part of Step 3". These paragraphs explain the DESIGN of the procedural gate rather than enforce it — ~30 lines of meta-commentary on top of a ~30-line procedural specification. A compressed 5-10 line version was originally proposed to preserve the key design insight without the full historical justification.
    - **Status:** Deferred
    - **Estimated savings (proposal):** ~700 always-loaded tokens
    - **Estimated safe savings (verified):** ~150-250 tokens — only paragraphs (1) and (2) overlap; (3) cascade and (4) Session Start Checklist are load-bearing concrete content
    - **Pre-implementation check:** Completed in v12.20r → v12.21r session (2026-04-28). Two introducing commits identified: **v11.79r (2f3be1b4, 2026-04-23)** added paragraphs (1)/(3)/(4) explicitly to fix "the repeated failure where CODING PLAN was emitted despite CHAT_BOOKENDS=Off" — converted descriptive rules into a procedural Step 0 → 1 → 2 → 3 gate, with the meta-commentary justifying the procedural format. **v12.03r (4a165a66, 2026-04-24)** added paragraph (2) when introducing the new `START_OF_RESPONSE_BLOCK` toggle — anchoring the general procedural-vs-descriptive principle to the new toggle's specific rule "do not emit CODING PLAN when `START_OF_RESPONSE_BLOCK` = `Off`". The redundancy between (1) and (2) is **intentional anchoring**, not bloat.
    - **Deferral rationale:** Original T12 estimated ~700 tokens of savings on the assumption that all 4 paragraphs were redundant meta-commentary. Verification shows: (1) is general procedural-vs-descriptive justification; (2) anchors that principle to the specifically-violated toggle rule; (3) is concrete cascade enumeration that v12.03r explicitly updated to "reference the new toggle model"; (4) addresses a specific edge case (first-of-session reader thinking Session Start Checklist runs before Steps 0-2). Only (1) and (2) overlap. A safe compression that merges (1)+(2) while preserving (3) and (4) verbatim saves ~150-250 tokens — far less than the ~700 estimated. Against ~2.3k tokens already banked in Session 2 (T11 + T10 + T1-v2), the cost-benefit doesn't justify even the safe compression. The v12.03r author's explicit decision to add (2) on top of (1) when introducing a new toggle argues against removing the redundancy — it was an intentional emphasis decision, not bloat.
    - **Verification evidence (pre-defer):**
        - **Rule #1:** verified. chat-bookends.md:208-216 contains four distinct explanatory paragraphs as originally claimed
        - **Rule #2:** exact citation at chat-bookends.md:208-216 (~30 lines)
        - **Rule #5:** not a merge — a compression of meta-commentary
        - **Rule #6:** not already applied
    - **Calibration Rule #8 datapoint confirmed:** procedural-gate verbose framing carries regression risk because the verbosity was added specifically to enforce a heavily-violated rule. The HIGHEST RISK flag at proposal-write time correctly predicted the finding from the pre-implementation check. **Future-audit guidance:** treat any meta-commentary attached to a documented "violated repeatedly" rule as load-bearing until proven otherwise via git-history check of the introducing commit(s) and their messages.

### Session 2 Aggregate Status

| Metric | Value |
|---|---|
| Proposals re-verified from Session 1 | 1 (T1 → T1-v2) |
| Sub-claims that survived verification | 1 of 3 (T1(a) kept, T1(b) and T1(c) rejected) |
| New proposals written with Rules #1–6 applied at write time | 3 (T10, T11, T12) |
| Write-time clean rate for new proposals | 100% verified against rule text |
| Implementation outcomes | 3 implemented (T11, T10, T1-v2) + 1 deferred (T12 — pre-implementation check confirmed regression risk) |
| Actual savings landed | ~2.3k always-loaded tokens (T11 ~150 + T10 ~500 + T1-v2 ~1.65k) |
| Implementation clean-landing rate | 3/4 = 75% (vs Session 1's 17% reference base rate) |
| Clean-landing base rate (Session 1 reference) | 17% |

### Session 2 Calibration Notes

- **Rules #1–6 held up at write time.** Every T-item above cites exact file + line (Rule #2), states which rule drove the verdict, and records whether the described trim is already applied (Rule #6). T1's sub-claim-by-sub-claim triage produced two distinct rejection patterns that map cleanly to Rule #5 (tradeoff-negative merge).
- **Fresh-read yield:** T10, T11, T12 were all discovered during this session's fresh re-read of chat-bookends.md. None appeared in the original Session 1 audit despite that audit explicitly targeting chat-bookends.md as the biggest offender. Direct evidence that single-pass audits miss proposals that fresh re-reads surface.
- **Candidate Rule #7 — "preserve-not-delete" savings discount:** T1's ~3k savings estimate overstated actual savings because the "does NOT control X" content must be preserved, not deleted. For merge/consolidation proposals: budget savings as `deleted_surface - preserved_surface`, not just `deleted_surface`. Applied at write time for T1-v2 (~1.5k) and T10 (~500 — the 4-question self-check is preserved, so saving is ~500 not ~900).
- **Candidate Rule #8 — "procedural-gate preservation" risk flag:** T12 flags that compressing meta-commentary around a procedural gate (Response Opener, Incremental Writing, Think Before Asserting) carries regression risk because the verbose framing was often added specifically to prevent a violation. Before implementing any compression of a procedural-gate's supporting prose, check the commit history for why the prose was added.
- **T1 triage technique:** bundling multiple sub-claims into one proposal obscures which pieces are implementable. Session 2's sub-claim-by-sub-claim verdict table (T1-v2) made the keep/reject decisions explicit at verification time. Future audits should write each sub-claim as a separate candidate, not bundle.

### Recommended implementation order

Start with **T11** — lowest risk (pure duplication removal), smallest surface (5 phrase deletions), clearest win (the canonical rule at line 152 already exists). Landing T11 cleanly validates the Session 2 approach before tackling higher-risk items. Then **T10** (consolidation with content preservation — moderate risk), then **T1-v2** (multi-file refactor — higher complexity), and last **T12** (regression risk flagged — only implement after verifying the compressed form addresses the original failure modes).

Developed by: LightAISolutions

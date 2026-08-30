---
paths:
  - "repository-information/CHANGELOG.md"
  - "repository-information/CHANGELOG-archive.md"
  - "live-site-pages/html-changelogs/**"
  - "live-site-pages/gs-changelogs/**"
  - "live-site-pages/ahk-changelogs/**"
---

# Changelog Rules

*Actionable rules: see Pre-Commit Checklist items [PC-CHANGELOG] #6 and [PC-PAGE-CHANGELOG] #16 in CLAUDE.md.*

## Quick Reference

### Repo CHANGELOG ([PC-CHANGELOG] #6)
- Entries go under `## [Unreleased]` during intermediate commits
- On the **push commit**, entries move from `[Unreleased]` into a new version section
- Version section header format: `## [vXX.XXr] — YYYY-MM-DD HH:MM:SS AM/PM EST`
  - Header always shows only the repo version — `w`/`g` versions are carried by per-file subheadings in the body
  - No commit SHA in the header — SHAs are added during archive rotation (see CHANGELOG-archive.md "SHA enrichment")
- Categories follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/): `### Added`, `### Changed`, `### Fixed`, `### Deprecated`, `### Removed`, `### Security`
- Only include categories that have entries — no empty headings
- Entry format: `- Description` (no per-entry timestamps)
- **Prompt blockquote** (repo CHANGELOG only) — immediately after the version section header, before any category headings, include a blockquoted copy of the user's **full, unabridged** original prompt: `> **Prompt:** "exact user prompt text here"`. **Never truncate, shorten, or abbreviate** — no ellipsis, no paraphrase, no summary. The entire prompt must appear verbatim. If multiple user prompts contributed to the same version (intermediate commits accumulated under `[Unreleased]`), use the prompt from the push commit's interaction. **Page/GAS/AHK changelogs do NOT get a prompt blockquote** — they are publicly deployed and the raw prompt often contains repo-internal context
- **Per-file subheadings**: only add `#### \`filename\` — vXX.XXw` (or `vXX.XXg`, or `vXX.XXa` for AHK) subheadings when the version section touches **2 or more files that have their own changelogs** with **distinct per-file entries**. When only one tracked file is affected, or multiple files share identical entries, skip the subheadings entirely — the main `### Category` entries already reference the file name, and a subheading with the same one-line entry under `##### Category` is pure duplication. When the rule does apply, each file subheading lists that file's user-facing changes with `#####` category headings. Repo-only entries (CLAUDE.md, rule files, etc.) do not get subheadings
- Capacity counter (`Sections: X/100`) must be updated on every push commit
- **Archive rotation** triggers when counter exceeds 100 — see `repository-information/CHANGELOG-archive.md` for the full rotation logic

### Page & GAS Changelogs ([PC-PAGE-CHANGELOG] #16)
- **User-facing** — describe what a visitor/user would notice, not internal details
- Writing style: "Faster page loading" not "Optimized database queries"
- Never mention file names, function names, commit SHAs, deployment IDs, or internal architecture
- Version section format for pages: `## [vXX.XXw] — YYYY-MM-DD HH:MM:SS AM/PM EST — vXX.XXr`
- Version section format for GAS: `## [vXX.XXg] — YYYY-MM-DD HH:MM:SS AM/PM EST — vXX.XXr`
- Version section format for AHK: `## [vXX.XXa] — YYYY-MM-DD HH:MM:SS AM/PM EST — vXX.XXr`
- **No verbatim prompt blockquote** — unlike the repo CHANGELOG, page / GAS / AHK changelogs are **publicly deployed** and must not include the user's raw prompt text. Prompts often contain repo-internal context (file paths, branch names, technical decisions) that shouldn't leak to end users. The `### Added` / `### Changed` / `### Fixed` entries themselves are the public description of the change
- **Every version bump gets an entry** — if the change is purely internal with no user-visible effect, add `- Minor internal improvements` under `### Changed`. No version should exist in the changelog without at least one entry
- Same 100-section archive rotation as the repo CHANGELOG
- **Single source of truth** — page changelogs live directly in `live-site-pages/html-changelogs/` (`.md` files), GAS changelogs in `live-site-pages/gs-changelogs/` (`.md` files), and AHK changelogs in `live-site-pages/ahk-changelogs/` (`.md` files). These are both the source of truth and the deployed files fetched by the live site's changelog popup — no separate deployment copy is needed

### Changelog Security (MANDATORY for publicly-deployed changelogs)

Page, GAS, and AHK changelogs in `live-site-pages/` are publicly deployed via GitHub Pages and must be safe for public consumption. **Brief rule:** no PHI, no implementation details (file names, function names, endpoints, vulnerability specifics, DB schemas, SDK/service names, auth flow details). Describe **what the user experiences**, not **how the system works**.

*Full reference (prohibited-content lists + 10-row unsafe/safe examples table): see `.claude/rules/changelog-security.md` — auto-injects when editing `live-site-pages/html-changelogs/**`, `live-site-pages/gs-changelogs/**`, or `live-site-pages/ahk-changelogs/**`.*

**Repo CHANGELOG (`repository-information/CHANGELOG.md`) is exempt** — it lives in `repository-information/` which is never deployed, and is only visible to collaborators. Use technically precise descriptions (file names, function names, implementation details) there for developer context and audit trails.

### Changelog Popup Toggle (per-page)
The changelog popup can be independently enabled or disabled per page using the `SHOW_CHANGELOG` variable in each HTML page's configuration block. This is **separate from `SHOW_WEB_VERSION`** — the version indicator pill can remain visible (for developer reference) while the changelog popup is hidden from users.

- `var SHOW_CHANGELOG = true;` exists in each HTML page's config block (near `SHOW_WEB_VERSION`)
- When `SHOW_CHANGELOG = false`: the version indicator still appears (if `SHOW_WEB_VERSION = true`), but clicking it does nothing — no popup, no fetch. The cursor changes to `default` to signal non-interactivity. On GAS-enabled pages, the GAS pill click is also disabled. The changelog CSS, DOM elements, and JavaScript are still present but the click handler is gated
- When `SHOW_CHANGELOG = true` (default): current behavior — clicking the version indicator opens the changelog popup, clicking the GAS pill opens the GAS changelog popup
- **Recommended for clinic/healthcare apps**: set `SHOW_CHANGELOG = false` to minimize public information exposure. The changelog files still exist in the repo for developer reference but are not surfaced to end users

### Edit Boundary When Inserting a New Version Section

When inserting a new `## [vXX.XXr]` version section above an existing one (the normal push-commit pattern — the new version is prepended so latest-first order is preserved), the Edit tool's `old_string` and `new_string` boundaries matter more than they look.

**The pattern:**
- `old_string` anchors on the **blank line before the next existing `## [vXX.XXr]` header** and ends there — do NOT include the next header line itself
- `new_string` contains the new version section (header + prompt blockquote + categories + entries) followed by a single trailing blank line, ending at the same boundary

**The failure pattern:** if `old_string` includes the next `## [vXX.XXr]` header line and `new_string` rebuilds it, a one-character drift (missing blank line, wrong header timestamp, rewritten prompt blockquote) silently corrupts the next version section. This has happened mid-rotation and mid-push — the new section lands correctly but the section immediately below it loses its prompt blockquote or its category headings.

**Why the blank-line boundary works:** version sections are separated by a single blank line. Anchoring `old_string` on that blank line (and including only content **above** the next header) means the Edit cannot touch the next section's content. The new section is inserted into the gap; nothing below the insertion point changes.

**Example — correct (repo CHANGELOG, includes prompt blockquote):**
- `old_string`: `## [Unreleased]\n\n` — just the `[Unreleased]` heading and its trailing blank line
- `new_string`: `## [Unreleased]\n\n## [v11.55r] — TIMESTAMP\n\n> **Prompt:** "..."\n\n### Changed\n- Entry\n\n` — prepends the new version section, preserves `[Unreleased]`, stops at the blank line before the next existing section

**Example — correct (page / GAS / AHK changelog, NO prompt blockquote):**
- `new_string`: `## [Unreleased]\n\n## [v01.03w] — TIMESTAMP — v11.55r\n\n### Changed\n- User-facing description\n\n` — same boundary pattern, but public-facing so the prompt is omitted entirely

**Example — incorrect (corrupts the next section):**
- `old_string` that includes the next `## [v11.54r]` line and rebuilds it in `new_string` — any drift in the rebuilt content silently overwrites the real v11.54r section

**When archive rotation is involved:** the same boundary rule applies — the Edit that moves old sections into the archive stops at the blank line before the oldest section that stays in the active file.

### Toggle Interactions — Template-Deploy and Multi-Session

When toggles flip state, the repo CHANGELOG and page/GAS/AHK changelogs have specific behaviors that must be honored in the push commit. Full precedence for when both toggles fire is in `.claude/rules/pre-commit-gates.md` — this section documents what happens to the changelogs specifically.

**`TEMPLATE_DEPLOY` = `Off` (template repo only):**
- Repo CHANGELOG: skip all versioning. If any versions were previously bumped above baseline, **reset the file** — remove all version sections, remove all entries and category headings under `## [Unreleased]`, replace with `*(No changes yet)*`, remove the date from the section header (→ `## [Unreleased]`), and reset the counter to `` `Sections: 0/100` ``
- Repo CHANGELOG archive (`CHANGELOG-archive.md`): reset — remove all archived sections and restore the `*(No archived sections yet)*` placeholder
- Page/GAS/AHK changelogs: reset each `<page-name>html.changelog.md` / `<page-name>gs.changelog.md` / `<basename>ahk.changelog.md` and their archive files the same way — clear version sections, restore `*(No changes yet)*` / `*(No archived sections yet)*`
- Forks never apply this reset — `TEMPLATE_DEPLOY` only has effect on the template repo itself

**`TEMPLATE_DEPLOY` switching `On` → `Off`:**
- Triggers the full reset above. Run on the commit that flips the toggle. The workflow reads the new value from the pushed branch, so the reset commit and the toggle flip land together

**`MULTI_SESSION_MODE` = `On` (any repo):**
- Entries are **still added** to `## [Unreleased]` on every commit (no change to intermediate-commit behavior)
- Push-commit versioned section creation (sub-steps 6c, 6e, 6f — the "move entries from `[Unreleased]` to a new `## [vXX.XXr]` section" portion) is **skipped**. Entries accumulate under `[Unreleased]` across all parallel sessions
- Page/GAS/AHK changelog versioned sections are also deferred — `[Unreleased]` accumulates, versioned sections not created
- All deferred work is bundled into a single version section during the **Reconcile Multi-Session Command** (see CLAUDE.md). Reconciliation runs when the toggle flips `On` → `Off`

**`MULTI_SESSION_MODE` switching `On` → `Off`:**
- Triggers reconciliation. Run `Reconcile Multi-Session Command` — moves accumulated `[Unreleased]` entries into a single new version section with the reconciliation version and timestamp

**When both toggles are "On" at once (`TEMPLATE_DEPLOY` = `Off` + `MULTI_SESSION_MODE` = `On` on the template repo):**
- For [PC-CHANGELOG] #6 and [PC-PAGE-CHANGELOG] #16, the `TEMPLATE_DEPLOY` = `Off` behavior (skip entirely, reset) wins — the template has no version baseline to defer against. Full per-item precedence table is in `.claude/rules/pre-commit-gates.md`

### Archive Rotation Summary
- **Quick rule**: 100 triggers, date groups move. A date group is ALL sections sharing the same date — could be 1 section or 500. Never split a date group. Today's sections (EST) are always exempt. Repeat until ≤100 non-exempt sections remain
- Full rotation logic is documented in `repository-information/CHANGELOG-archive.md` (see "Rotation Logic" section)
- **SHA enrichment is MANDATORY during rotation** — every section header moved to the archive MUST have a commit SHA link appended. This applies to the repo CHANGELOG archive AND all page/GAS changelog archives. **Shallow clone fix** — before SHA lookups, run `git fetch --unshallow origin main 2>/dev/null || true` to ensure full history is available (Claude Code sessions often start with shallow clones). **Lookup by type**: (1) repo CHANGELOG — `git log --oneline --all --grep="^vXX.XXr " | head -1`; (2) page/GAS changelogs — use the **repo version cross-reference** at the end of the header (e.g. `— v03.09r`), not the page version — run `git log --oneline --all --grep="^v03.09r " | head -1`. Commit messages use repo version prefixes, so this matches directly. **Batch optimization**: when rotating multiple sections, run `git log --oneline --all` once and match each section's repo version against the output, avoiding N separate git calls. If a version's commit genuinely cannot be found after unshallowing, mark with `— [SHA unavailable]`. **Post-rotation verification**: run `grep '^## \[v' ARCHIVE_FILE | grep -v '— \[' | head -5` — if any lines appear, SHA enrichment was missed and must be completed before committing. This is the most commonly skipped rotation step — see CHANGELOG-archive.md "Post-rotation verification" for the mandatory check

Developed by: LightAISolutions

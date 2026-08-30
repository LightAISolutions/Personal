---
paths:
  - "CLAUDE.md"
  - ".claude/rules/pre-commit-gates.md"
# Path-scoped: the full gate logic (~20 lines of conditional skip rules) only
# auto-injects when CLAUDE.md or this file itself is being edited. On everyday
# commit responses, the resolved "Active Gate State" summary at the top of the
# Pre-Commit Checklist tells Claude what applies on this repo — the per-item
# caveats ("Skip on template repo when TEMPLATE_DEPLOY = Off" etc.) are the
# enforceable contract, and this file gives the overall decision-tree for when
# a toggle flips.
---

# Pre-Commit Checklist — Gate Prologues (Deep Reference)

*Companion to CLAUDE.md's Pre-Commit Checklist. The compact "Active Gate State" summary in CLAUDE.md shows the resolved behavior for this repo's current toggle values. This file holds the full gate decision-tree for when a toggle flips or a new repo inherits the template.*

## TEMPLATE REPO GATE

Before running any numbered item, check: does the actual repo name (from `git remote -v`) match `IS_TEMPLATE_REPO` in the Template Variables table? If **yes**, check `TEMPLATE_DEPLOY`:

- `TEMPLATE_DEPLOY` = `On`: only [PC-QR-CODE] #13 is skipped. Items [PC-GS-VERSION] #1, [PC-HTML-VERSION] #2, [PC-HTML-SOURCE] #3, [PC-REPO-ARCH] #5, [PC-CHANGELOG] #6, [PC-COMMIT-MSG] #8, [PC-REPO-VERSION] #15, and [PC-PAGE-CHANGELOG] #16 run normally — version bumps are needed so deployed pages auto-refresh, and changelogs track version history.
- `TEMPLATE_DEPLOY` = `Off`: items [PC-GS-VERSION] #1, [PC-HTML-VERSION] #2, [PC-HTML-SOURCE] #3, [PC-CHANGELOG] #6, [PC-COMMIT-MSG] #8, [PC-QR-CODE] #13, [PC-REPO-VERSION] #15, and [PC-PAGE-CHANGELOG] #16 are **all skipped** — do NOT bump versions, update version-tracking files, add CHANGELOG entries, use version prefixes in commit messages, or generate QR codes. Additionally, reset the CHANGELOG to clean state (see Template Repo Guard). Proceed directly to the items that still apply: [PC-SAFETY] #0, [PC-TEMPLATE-FREEZE] #4, [PC-REPO-ARCH] #5, [PC-README-TREE] #7, [PC-DEV-BRANDING] #9, [PC-README-TIMESTAMP] #10, [PC-LINKS] #11, [PC-README-TIPS] #12, [PC-GAS-CONFIG] #14, [PC-UNIQUE-FILES] #17, [PC-PRIVATE-REPO] #18, [PC-TEMPLATE-PROP] #19, [PC-SESSION-SYNC] #20.

This gate also applies during `initialize` — initialization never bumps versions on any repo.

## MULTI-SESSION GATE

If `MULTI_SESSION_MODE` = `On` in the Template Variables table, the following items are modified to prevent merge conflicts on shared state files when multiple Claude Code sessions push to the same repo simultaneously:

- **[PC-REPO-VERSION] #15** (repo version bump): **skipped entirely** — `repository.version.txt` is not touched
- **[PC-README-TIMESTAMP] #10** (README `Last updated:` line): **skipped entirely** — the timestamp/version line is not updated
- **[PC-CHANGELOG] #6** (CHANGELOG.md): entries are still added to `## [Unreleased]` on every commit, but the **push-commit versioned section creation (6c/6e/6f) is skipped** — entries accumulate under `[Unreleased]` across all sessions and are versioned during reconciliation
- **[PC-PAGE-CHANGELOG] #16** (page & GAS changelogs): same as #6 — entries added to `[Unreleased]`, versioned sections deferred
- **[PC-COMMIT-MSG] #8** (commit message format): **no repo version prefix** — commit messages use plain descriptive text or `g`/`w` prefixes only (since per-page/GAS versions still bump)

Items that **still run normally**: [PC-SAFETY] #0, [PC-GS-VERSION] #1, [PC-HTML-VERSION] #2, [PC-HTML-SOURCE] #3, [PC-TEMPLATE-FREEZE] #4, [PC-REPO-ARCH] #5, [PC-README-TREE] #7, [PC-DEV-BRANDING] #9, [PC-LINKS] #11, [PC-README-TIPS] #12, [PC-QR-CODE] #13, [PC-GAS-CONFIG] #14, [PC-UNIQUE-FILES] #17, [PC-PRIVATE-REPO] #18, [PC-TEMPLATE-PROP] #19, [PC-SESSION-SYNC] #20. Per-page ([PC-HTML-VERSION] #2) and per-GAS ([PC-GS-VERSION] #1) version bumps are safe because they're scoped to the specific file being edited — different sessions working on different pages won't conflict.

**This gate is independent of the TEMPLATE REPO GATE** — both are evaluated. Precedence when both apply is resolved per item:

| Toggle combination | [PC-CHANGELOG] #6 | [PC-PAGE-CHANGELOG] #16 | [PC-COMMIT-MSG] #8 | [PC-REPO-VERSION] #15 | [PC-README-TIMESTAMP] #10 |
|--------------------|-------------------|-------------------------|--------------------|-----------------------|---------------------------|
| TEMPLATE_DEPLOY=Off **alone** | Skip entirely (reset to blank) | Skip entirely (reset to blank) | No repo version prefix (reset v01.00r) | Skip (reset v01.00r) | Always applies (display resets to v01.00r) |
| MULTI_SESSION_MODE=On **alone** | Entries to [Unreleased], defer versioned section | Entries to [Unreleased], defer versioned section | No repo version prefix | Skip | Skip |
| **Both On at once** (TEMPLATE_DEPLOY=Off + MULTI_SESSION_MODE=On) | **TEMPLATE wins — skip entirely (reset to blank).** Multi-Session's "defer" is moot because the template has no version baseline to defer against. | **TEMPLATE wins — skip entirely (reset to blank).** Same reasoning as #6. | Both gates skip the prefix — result is the same (no prefix). | Both gates skip — result is the same (skip, reset to v01.00r). | **MULTI_SESSION wins — skip entirely.** The template gate says "always applies with display reset"; the multi-session gate says "skip entirely." Multi-session is more restrictive here because the README is a globally-shared state file and any edit would conflict across parallel sessions. On reconciliation, the template gate's display reset runs then. |

**Precedence rule in words:** when an item has a "skip entirely" behavior in one gate and a "defer" behavior in the other, the **"skip entirely" behavior wins** — a skipped item cannot be deferred because deferral presupposes a future commit that will execute it, and the skip gate says no such commit should ever execute. When both gates say "skip," the result is identical regardless of which formally wins. When one gate says "always applies with a modification" (e.g. TEMPLATE's reset) and the other says "skip entirely" (e.g. MULTI_SESSION's README skip), the **"skip entirely" wins during multi-session operation** because the shared-state concern is the whole reason the multi-session gate exists; the template's modification runs at reconciliation time instead.

If the TEMPLATE REPO GATE already skips an item (e.g. `TEMPLATE_DEPLOY` = `Off`), the multi-session gate is a no-op for that item — the table above makes this concrete per-item.

**Caution**: sessions must work on **different pages/features**. If two sessions edit the same HTML page or `.gs` file, content merge conflicts will still occur — this gate only prevents conflicts on globally shared state files.

## Why these gates live in a path-scoped file

The gate logic above describes what happens when toggles are flipped. On the vast majority of commits, none of the toggles are being changed — the resolved active state is stable. Every commit response that re-reads the full gate prologues pays ~15-20 lines of context cost for information that isn't needed for that commit.

By moving the prologues to a path-scoped file that only injects when `CLAUDE.md` is being edited (the only way to change the toggles), everyday commit responses get the short "Active Gate State" summary instead. The per-item caveats in the checklist (e.g. "Skip on template repo when `TEMPLATE_DEPLOY` = `Off`") remain as the enforceable contract — they're short tags at the end of each affected item and preserve the precise skip behavior. This file is the full decision-tree, consulted only when the toggle state might change.

Developed by: LightAISolutions

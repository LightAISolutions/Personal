---
name: reconcile
description: Reconcile multi-session mode — bundle accumulated changelog entries into versioned sections, bump repo version, and switch MULTI_SESSION_MODE to Off. Run this after parallel Claude Code sessions are complete.
user-invocable: true
disable-model-invocation: true
---

# Reconcile Multi-Session Mode

Bundle accumulated `[Unreleased]` changelog entries from parallel sessions into a single versioned section and restore normal single-session behavior.

## When to Use

Run this after all parallel Claude Code sessions have finished pushing their changes. This catches up on all the deferred work (version sections, repo version bump, README timestamp).

## Steps

1. **Review what happened** — run `git log origin/main --oneline -30` to show all commits that landed while multi-session mode was active. Output a summary: number of commits, which files/pages were touched, which sessions contributed

2. **Read accumulated entries** — read `## [Unreleased]` from `repository-information/CHANGELOG.md` and all page/GAS changelogs in `live-site-pages/html-changelogs/` and `live-site-pages/gs-changelogs/` that have `[Unreleased]` entries. List them for user review before proceeding

3. **Set `MULTI_SESSION_MODE` to `Off`** in the CLAUDE.md Template Variables table

4. **Bump repo version** — increment `repository-information/repository.version.txt` by 0.01 (single bump — all multi-session work bundled into one version)

5. **Create versioned sections** — move all `[Unreleased]` entries in CHANGELOG.md into a new version section with the reconciliation version and current timestamp. Do the same for each page/GAS changelog that has entries. Follow all standard formatting rules (category groupings, timestamps, capacity counters, archive rotation if needed)

6. **Update README.md** — update the `Last updated:` timestamp and `Repo version:` value

7. **Commit** with message `vXX.XXr Reconcile multi-session mode`

9. **Push** to the `claude/*` branch (Pre-Push Checklist applies)

## Important Notes

- **No double-bumping** — per-page and per-GAS versions were already bumped by their respective sessions. Only the repo version bumps here
- **Empty reconciliation** — if `[Unreleased]` has no entries, still bump the repo version and update README/STATUS. If no commits landed at all, just flip the toggle without a version bump
- The reconciliation commit is a normal push commit — all standard Pre-Commit items apply

Developed by: LightAISolutions

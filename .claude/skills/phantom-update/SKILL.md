---
name: phantom-update
description: Touch every file in the repo with a no-op change so all files share the same commit timestamp on GitHub. Resets changelogs and normalizes line endings.
user-invocable: true
disable-model-invocation: true
---

# Phantom Update (Timestamp Alignment)

Touch every file in the repo with a no-op change so all files share the same commit timestamp on GitHub.

## Steps

1. **Skip all version bumps** — do NOT increment versions in `html.version.txt` files, `gs.version.txt` files, or `VERSION` in `.gs` files
2. **Text files** — add a trailing newline. Also normalize any CRLF (`\r\n`) line endings to LF (`\n`) — run `sed -i 's/\r$//' <file>` on each text file before the no-op touch
3. **Binary files** (e.g. `.mp3`) — append a null byte
4. **Reset `repository-information/CHANGELOG.md`** — remove all versioned release sections and all entries/category headings under `[Unreleased]`, leaving a fresh template (header, version suffix note, and an empty `## [Unreleased]` section with `*(No changes yet)*`). Also reset `repository-information/CHANGELOG-archive.md` — remove all archived sections and restore the `*(No archived sections yet)*` placeholder
5. **Reset all page and GAS changelogs** — reset every `<page-name>html.changelog.md` in `live-site-pages/html-changelogs/` and `<page-name>gs.changelog.md` in `live-site-pages/gs-changelogs/` and their corresponding archive files the same way. Also reset GAS `<page-name>gs.version.txt` files in `live-site-pages/gs-versions/` to `v01.00g`
6. **Update `Last updated:` in `README.md`** — set the timestamp to the real current time (run `TZ=America/New_York date '+%Y-%m-%d %I:%M:%S %p EST'`)
7. **Commit message**: `Auto Update HTML & GAS Template Created` (no version prefix)
8. **Push** to the `claude/*` branch (Pre-Push Checklist applies)

## Important Notes

- This is a repo-wide command — it affects ALL files
- Line ending safety has been verified for all file types in this repo (see `.claude/rules/init-scripts.md` — "Line Ending Safety")
- The `.gitattributes` file enforces `* text=auto eol=lf` repo-wide

Developed by: LightAISolutions

---
paths:
  - "scripts/**"
---

# Initialization Scripts Rules

*Actionable rules: see Session Start Checklist — Template Drift Checks in CLAUDE.md.*

## Init Script (`scripts/init-repo.sh`)

The init script automates all fork/clone initialization. It is run by the Template Drift Checks during the Session Start Checklist.

### What it does
- Auto-detects org and repo name from `git remote -v`
- Deletes inherited `claude/*` branches (local and remote)
- Replaces `LightAISolutions` → new org name across 23 target files
- Replaces `lightaisolutions` → new repo name across the same files
- Updates CLAUDE.md Template Variables table (`IS_TEMPLATE_REPO` → `No`)

- Restructures README.md (title, placeholder block, removes setup sections)
- Generates QR code for the fork's GitHub repo URL
- Runs verification grep to catch any remaining old values

### Custom developer name
If `DEVELOPER_NAME` differs from the org name, pass it as a third argument:
```bash
bash scripts/init-repo.sh ORG REPO DEVELOPER_NAME
```

### Relative links
`SECURITY.md`, `SUPPORT.md`, and `README.md` links using `../../` paths are NOT modified — they resolve correctly on any fork via GitHub's blob-view URL structure.

## Phantom Edit (Timestamp Alignment)

*This is a user command — triggered when the user asks for a "phantom edit" or "phantom update".*

- Touch every file in the repo with a no-op change so all files share the same commit timestamp on GitHub
- **Skip all version bumps** — do NOT increment versions in `html.version.txt` files, `gs.version.txt` files, or `VERSION` in `.gs` files
- For text files: add a trailing newline. Also normalize any CRLF (`\r\n`) line endings to LF (`\n`) — run `sed -i 's/\r$//' <file>` on each text file before the no-op touch
- For binary files (e.g. `.mp3`): append a null byte
- **Reset `repository-information/CHANGELOG.md`** — remove all versioned release sections and all entries/category headings under `[Unreleased]`, leaving a fresh template (header, version suffix note, and an empty `## [Unreleased]` section with `*(No changes yet)*`). Also reset `repository-information/CHANGELOG-archive.md` — remove all archived sections and restore the `*(No archived sections yet)*` placeholder. **Also reset all page and GAS changelogs** — reset every `<page-name>html.changelog.md` in `live-site-pages/html-changelogs/` and `<page-name>gs.changelog.md` in `live-site-pages/gs-changelogs/` and their corresponding archive files the same way. Also reset GAS `<page-name>gs.version.txt` files in `live-site-pages/gs-versions/` to `|v01.00g|`. This gives the repo a clean history starting point
- **Update `Last updated:` in `README.md`** — set the timestamp to the real current time (run `TZ=America/New_York date '+%Y-%m-%d %I:%M:%S %p EST'`). This is the only substantive edit besides the no-op touches
- Commit message: `Auto Update HTML & GAS Template Created` (no version prefix)

## Line Ending Safety

`.gitattributes` enforces `* text=auto eol=lf` repo-wide. This normalizes CRLF (`\r\n`) to LF (`\n`) for all text files on commit. The following audit confirms this is safe for every file type in the repo — **do not re-audit on future phantom updates or `.gitattributes` changes** unless a new file type is introduced.

### What was verified
| File type | Finding | Safe? |
|-----------|---------|-------|
| **`.md` files** | Pure line-ending CRLF only. Provenance markers are zero-width Unicode (`U+200B`, `U+200C`, etc.) — multi-byte UTF-8 sequences unrelated to `\r`. Line ending normalization does not touch them | Yes |
| **`.html` files** | Pure line-ending CRLF (e.g. 240 lines, all `\r\n`, no lone `\r`). Non-ASCII content is box-drawing chars (`─`) in comments — standard UTF-8, unaffected by CRLF stripping | Yes |
| **`.yml`, `.cff`, `.sh` files** | Already LF. No `\r` present | Yes |
| **`.png`, `.mp3` files** | Explicitly marked `binary` in `.gitattributes`. Additionally, `text=auto` auto-detects binary (null bytes) — belt and suspenders | Yes |
| **Provenance markers** | Zero-width Unicode chars (`U+200B`–`U+200F`, `U+FEFF`, `U+2060`). These are multi-byte UTF-8 (e.g. `\xe2\x80\x8b`) — completely unrelated to `\r` (`\x0d`). CRLF normalization cannot affect them | Yes |

### When to re-audit
Only if a **new file type** is added to the repo that might use `\r` intentionally (e.g. Windows batch files `.bat`, or binary formats with `.txt` extension). Standard web files (HTML, CSS, JS, YAML, Markdown) are always safe to normalize.

Developed by: LightAISolutions

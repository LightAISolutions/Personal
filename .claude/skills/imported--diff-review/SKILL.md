---
name: diff-review
description: Security-focused differential review of code changes using git history analysis. Use before pushing changes to review what's about to be deployed, catch regressions, verify no sensitive data is included, and ensure code quality. Inspired by Trail of Bits differential-review skill.
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob
argument-hint: [base-ref]
---

# Differential Review

*Inspired by [Trail of Bits differential-review skill](https://github.com/trailofbits/skills) — adapted for pre-push code review.*

Security-focused review of all changes between a base reference and HEAD.

## Usage

```
/diff-review              # Review changes since origin/main
/diff-review HEAD~3       # Review last 3 commits
/diff-review v02.05r      # Review changes since a specific version
```

## Review Process

### 1. Gather the Diff

```bash
# Default: changes since origin/main
git diff origin/main..HEAD

# File list with stats
git diff origin/main..HEAD --stat

# Commit log
git log origin/main..HEAD --oneline
```

### 2. Security Review

For each changed file, check:

- **Secrets & credentials** — new API keys, tokens, passwords, `.env` values accidentally committed
- **Injection vectors** — new `innerHTML`, `eval()`, `document.write()`, unsanitized template literals
- **Authentication/authorization** — changes to access control logic, permission checks
- **Data exposure** — sensitive data logged, returned in error messages, or stored client-side
- **Dependency changes** — new external scripts, CDN resources, or package additions

### 3. Quality Review

- **Regression risk** — does the change break existing functionality?
- **Error handling** — are new error paths handled gracefully?
- **Edge cases** — are boundary conditions covered?
- **Consistency** — does the change follow existing patterns in the codebase?

### 4. Repo-Specific Checks

For this repo specifically:

- **Version files** — if HTML pages were changed, were `html.version.txt` files bumped? (Pre-Commit #2)
- **GAS sync** — if `.config.json` was changed, were synced files updated? (Pre-Commit #15)
- **CHANGELOG** — do all user-facing changes have entries? (Pre-Commit #7)
- **Private repo compat** — no `raw.githubusercontent.com` or `api.github.com` in client-side code? (Pre-Commit #19)
- **Developer branding** — do new files have `Developed by:` footer? (Pre-Commit #10)
- **Structure tree** — if files were added/removed, were REPO-ARCHITECTURE.md and README.md tree updated? (Pre-Commit #6, #8)

## Output Format

```
## Differential Review: <base-ref>..HEAD

### Stats
- N files changed, N insertions, N deletions
- N commits

### Security Findings
[SEVERITY] Finding description (file:line)

### Quality Findings
[NOTE] Finding description (file:line)

### Repo Checklist
✅ Version files bumped
✅ CHANGELOG updated
⚠️ Missing developer branding in new-file.js
❌ Private repo compatibility violation in page.html:42

### Verdict
PASS / PASS WITH NOTES / FAIL (with reasons)
```

Developed by: LightAISolutions

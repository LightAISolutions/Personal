# Claude Code Skills Reference

Complete inventory of all Claude Code skills available in this repo — both visible (in-repo) and invisible (bundled/plugin).

## Skill Types

| Type | Location | Visible in Repo? | Updated By |
|------|----------|-------------------|------------|
| **Custom** | `.claude/skills/<name>/SKILL.md` | Yes | Developer |
| **Imported** | `.claude/skills/imported--<name>/SKILL.md` | Yes | Developer (adapted from external source) |
| **Bundled/Plugin** | Ships with Claude Code or installed globally | No — not in repo files | Anthropic (auto-updates with Claude Code) |

## Custom Skills (in-repo)

Skills created specifically for this repo's workflows.

| Skill | Slash Command | Description |
|-------|---------------|-------------|
| `initialize` | `/initialize` | First deployment setup — resolves placeholders, deploys to GitHub Pages |
| `maintenance-mode` | `/maintenance-mode` | Toggle maintenance overlay on/off for specific pages |
| `new-page` | `/new-page` | Create a new HTML page with full boilerplate (version polling, splash, auto-refresh) |
| `phantom-update` | `/phantom-update` | Timestamp alignment — bump versions without content changes to trigger auto-refresh |
| `reconcile` | `/reconcile` | End multi-session mode — bundle accumulated changes into versioned sections |
| `remember-session` | `/remember-session` | Save session context for continuity across sessions |

## Imported Skills (in-repo, adapted from external sources)

Skills adapted from Anthropic's official repo and Trail of Bits, customized with repo-specific context.

| Skill | Slash Command | Source | Auto-triggers? | Description |
|-------|---------------|--------|----------------|-------------|
| `imported--webapp-testing` | `/webapp-testing` | [Anthropic](https://github.com/anthropics/skills) | Yes | Playwright-based testing for live pages and UI verification |
| `imported--frontend-design` | `/frontend-design` | [Anthropic](https://github.com/anthropics/skills) | Yes | Distinctive, production-grade UI creation guidelines |
| `imported--skill-creator` | `/skill-creator` | [Anthropic](https://github.com/anthropics/skills) | No | Meta-skill for building and refining new skills |
| `imported--security-review` | `/security-review` | [Trail of Bits](https://github.com/trailofbits/skills) | Yes | OWASP Top 10, XSS, insecure defaults audit for HTML/GAS code |
| `imported--git-cleanup` | `/git-cleanup` | [Trail of Bits](https://github.com/trailofbits/skills) | No | Clean up stale branches, worktrees, and claude/* artifacts |
| `imported--diff-review` | `/diff-review` | [Trail of Bits](https://github.com/trailofbits/skills) | No | Security-focused differential review of changes before pushing |

## Bundled/Plugin Skills (NOT in repo — invisible)

These skills are provided by Claude Code itself or installed as global plugins. They are **not visible in the repo files** but are active and available in every session. They update automatically when Claude Code updates — do NOT add local copies (risks name collision, staleness, and double-loading).

| Skill | Slash Command | Description | Why Not Local? |
|-------|---------------|-------------|----------------|
| `simplify` | `/simplify` | Reviews changed code for reuse, quality, and efficiency, then fixes issues found | Already optimized by Anthropic; local copy would go stale and conflict |
| `session-start-hook` | `/session-start-hook` | Sets up SessionStart hooks for Claude Code on the web — creates hooks to run tests and linters during web sessions | Already maintained upstream; repo-specific hooks belong in `.claude/hooks/` not a competing skill |

> **Note:** The bundled/plugin list above reflects what was available as of 2026-03-02. New bundled skills may appear in future Claude Code versions. Check the system reminder at the start of any session for the current list — skills listed there but not in this document are new additions.

## How to Check Current Active Skills

The system reminder at the top of each Claude Code session lists all currently available skills (both in-repo and bundled). Compare that list against this document to spot:
- **New bundled skills** — added by a Claude Code update (document them here)
- **Missing skills** — a local skill was deleted or its SKILL.md has a syntax error

## Adding New Skills

- **Custom skills**: create `.claude/skills/<name>/SKILL.md` — plain name, no prefix
- **Imported skills**: create `.claude/skills/imported--<name>/SKILL.md` — `imported--` prefix distinguishes from custom
- **Never duplicate bundled skills locally** — add repo-specific guidance as a `.claude/rules/` file instead
- **Imported skills are frozen** — never modify an imported skill's content (only location pointers may be updated). This preserves the ability to trace which skill produces which behavior. If changes are needed, create a custom skill or add a `.claude/rules/` file instead. *Rule: see `.claude/rules/behavioral-rules.md` — "Imported Skills — Do Not Modify"*

Developed by: LightAISolutions

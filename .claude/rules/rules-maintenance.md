---
paths:
  - "CLAUDE.md"
  - ".claude/rules/**/*.md"
---

# Rules Maintenance Commands — Diff Rules + Repo Audit

*Path-scoped: auto-injects when editing `CLAUDE.md` or any rules file. User-triggered by the "diff rules" or "repo audit" keywords — Claude Code auto-loads this file when the paths match, and the command bodies below are always available for on-demand invocation. Cross-referenced from `CLAUDE.md`.*

Two user-invokable commands for maintaining the rules system:

- **`/diff rules`** (or: "compare rules to template", "what rules changed", "rule drift", "backport check") — research-only command that compares this fork's rules against the template repo's rules and produces a structured diff report
- **`/repo audit`** (or: "audit the repo", "run repo audit", "consistency check") — research-only command that performs a comprehensive cross-system consistency audit using parallel subagents

## Diff Rules Command

If the user says **"diff rules"** (or similar: "compare rules to template", "what rules changed", "rule drift", "backport check"):

Compare this fork's rules (CLAUDE.md and `.claude/rules/*.md`) against the template repo's versions to identify what was added, modified, or removed. **This is a research-only command** — it produces a report with findings. No changes are made until the user approves specific items.

### Diff procedure

1. **Determine template source** — check if a `template` remote exists (`git remote -v | grep template`). If not, add it: `git remote add template https://github.com/LightAISolutions/lightaisolutions.git`. Fetch the latest: `git fetch template main`
2. **Diff rules files** — for each rules file, run `git diff` between `template/main` and `HEAD`:
   - `CLAUDE.md`
   - All files in `.claude/rules/*.md`
   - `.claude/settings.json` (if it exists)
3. **Categorize changes** — for each file, classify diff hunks into:
   - `➕ Fork-added` — new content not in the template (new rules, new checklist items, new sections)
   - `✏️ Fork-modified` — template content that was changed on the fork (tweaked heuristics, adjusted rules, reworded instructions)
   - `➖ Fork-removed` — template content that was deleted on the fork
   - `🔄 Template-only` — content in the template that the fork doesn't have (template evolved after the fork was created)
4. **Produce report** — structured output:

```
══════════════════════════════
  RULES DIFF REPORT
  Date: YYYY-MM-DD HH:MM:SS AM/PM EST
  Fork: ORG/REPO (vXX.XXr)
  Template: LightAISolutions/lightaisolutions
══════════════════════════════

## CLAUDE.md
➕ Fork-added: [N items]
  - Pre-Commit #20 [PC-EXAMPLE-NEW]: "New rule description" (lines XX-XX)
  - Behavioral rule: "New rule name" (lines XX-XX)
✏️ Fork-modified: [N items]
  - Pre-Commit #6 [PC-CHANGELOG]: Changed CHANGELOG heuristic from ~10s to ~15s
➖ Fork-removed: [N items]
  - (none)

## .claude/rules/behavioral-rules.md
➕ Fork-added: [N items]
  - New section: "Custom Rule Name"
✏️ Fork-modified: [N items]
  - (none)

## .claude/rules/chat-bookends.md
  🟢 No changes from template

... (repeat for each rules file) ...

══════════════════════════════
  SUMMARY
  ➕ Fork-added: N total across M files
  ✏️ Fork-modified: N total across M files
  ➖ Fork-removed: N total across M files
  🔄 Template-only: N total across M files
  🟢 Unchanged: N files
══════════════════════════════

BACKPORT CANDIDATES (fork → template):
- [fork-added/modified items that look like general improvements]

UPSTREAM CANDIDATES (template → fork):
- [template-only items the fork is missing]
```

5. **Present the report** — the user reviews the findings. The command ends with `🔬🔬RESEARCH COMPLETE🔬🔬`

**Template repo behavior** — when `IS_TEMPLATE_REPO` matches the actual repo name, the command still works but the report header says "This is the template repo" and the diff is against the repo's own history (useful for seeing what changed since a tagged point). The backport/upstream labels are omitted since there's no fork/template distinction

### Backporting rules

**To backport fork rules → template** (push improvements from your fork back to the template):

> **Prompt:** "backport rules to template" (or: "push rule changes to template", "update template with my rules")
>
> This runs the Diff Rules report first, then presents each `➕ Fork-added` and `✏️ Fork-modified` item. The user selects which items to backport. For approved items:
> 1. The user copies the selected items from the report
> 2. Opens a session on the template repo
> 3. Prompts: "Add these rules from my fork [ORG/REPO]:" followed by the copied items
> 4. Claude applies the changes on the template repo following its own Pre-Commit/Pre-Push rules
>
> **Why manual copy?** The fork and template are separate repos — Claude Code sessions operate on one repo at a time. Cross-repo commits would require push access to both remotes in one session, which risks accidental cross-contamination. The manual copy approach is safer and gives the user full control over what lands on the template

**To pull template updates → fork** (adopt new template rules on your fork):

> **Prompt:** "pull template rules" (or: "sync rules from template", "update my rules from template")
>
> This runs the Diff Rules report first, then presents each `🔄 Template-only` item. The user selects which items to adopt. For approved items, Claude applies them to the fork's rules files and commits normally. This is safe to do in a single session since the changes are applied to the current repo

## Repo Audit Command

If the user says **"repo audit"** (or similar: "audit the repo", "run repo audit", "consistency check"):

Perform a comprehensive cross-system consistency audit of the entire repository. The audit checks whether all systems, rules, references, and structures are working harmoniously without contradictions. **This is a research-only command** — it produces a report with findings and recommendations. No changes are made until the user approves specific items.

### Audit procedure

Use **parallel subagents** (Explore agents) to audit multiple categories simultaneously. Each category produces a list of findings rated as: `🔴 Issue` (definite inconsistency — should be fixed), `🟡 Suggestion` (improvement opportunity — user decides), or `🟢 OK` (no problems found). Group the audit into these categories:

1. **CLAUDE.md internal consistency** — verify that all Pre-Commit checklist item numbers referenced elsewhere in CLAUDE.md (Template Repo Guard skip lists, MULTI-SESSION GATE, TEMPLATE REPO GATE, Reference Files table) match the actual numbered items. Check that section separators exist between all `##` sections. Verify the Template Variables table values are consistent with their documented "Where it appears" columns
2. **Cross-file reference integrity** — verify that every file referenced in CLAUDE.md, REPO-ARCHITECTURE.md, and README.md actually exists at the stated path. Check that `.claude/rules/` files referenced in the Reference Files table exist. Verify internal markdown links (`[text](path)`) across all `.md` files resolve to existing targets
3. **Version consistency** — compare versions across all tracking files: `repository.version.txt`, `html.version.txt` files vs HTML `<meta>` tags, `gs.version.txt` files vs `.gs` `VERSION` variables. Flag any mismatches
4. **REPO-ARCHITECTURE.md accuracy** — compare the Mermaid diagram against the actual file/directory structure (use `find` or `ls -R`). Flag files/directories that exist but aren't in the diagram, or diagram entries that don't exist on disk. Verify no version numbers appear in diagram nodes (they shouldn't)
5. **Changelog consistency** — verify capacity counters (`Sections: X/100`) match the actual count of `## [v` sections in each changelog. Check that archive files exist for all changelogs. Verify the repo CHANGELOG's latest version section matches the current repo version. Check page/GAS changelogs have entries corresponding to their current versions
6. **Template/page propagation** — compare the template files (`live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-noauth.html.txt` and `HtmlAndGasTemplateAutoUpdate-auth.html.txt`) against all pages in `live-site-pages/` for structural drift. Flag significant divergences that aren't marked with `PROJECT OVERRIDE` markers (informational only — some drift is expected)
7. **GAS config sync** — for each `.config.json` in `googleAppsScripts/`, verify its values match the corresponding `.gs` file's `var` declarations and the embedding HTML page's `<title>` and `var _e` value
8. **README.md structure** — verify the ASCII tree matches the actual file structure. Check that all `##` sections with links have the "Tip" blockquote. Verify the `Last updated:` timestamp and repo version are current
9. **Rules files audit** — verify all `.claude/rules/*.md` files are accounted for in the Reference Files table or in the Behavioral Rules / Output Formatting / Chat Bookends references. Check for rules that contradict CLAUDE.md checklist items

### Output format

After all subagents complete, compile the results into a single report:

```
══════════════════════════════
  REPO AUDIT REPORT
  Date: YYYY-MM-DD HH:MM:SS AM/PM EST
  Repo version: vXX.XXr
══════════════════════════════

## Category Name
🔴 Issue: description — file(s) affected
🟡 Suggestion: description — file(s) affected
🟢 OK — brief confirmation of what was checked

... (repeat for each category) ...

══════════════════════════════
  SUMMARY
  🔴 Issues: N
  🟡 Suggestions: N
  🟢 OK: N
══════════════════════════════
```

### After the report

- Present the report to the user and wait for their decision on which items (if any) to implement
- **Do not make any changes automatically** — the audit is informational. The user reviews the findings and says which ones to fix
- If the user approves fixes, implement them in a single commit following normal Pre-Commit/Pre-Push rules
- The audit itself is a **research-only response** — it ends with `🔬🔬RESEARCH COMPLETE🔬🔬`, not `✅✅CODING COMPLETE✅✅`. Only the follow-up fix response (if any) ends with `✅✅CODING COMPLETE✅✅`

Developed by: LightAISolutions

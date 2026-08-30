---
paths: []
# always-loaded (no path scope)
---

# Output Formatting & Styling

*Always-loaded rules (no path scope). Covers CLI styling, agent attribution, and reminder system format.*

## CLI Accent Styling — Quick Rule
> **"Make it red" = backtick-wrap it.** Whenever you need text to render as red/accent in the Claude Code CLI, wrap it in backticks (`` `text` ``). This is the only reliable method — bare Unicode, HTML tags, and alert syntax do not work.

*Full reference (what triggers colored styling, what doesn't, recommended patterns, known limitations): see `.claude/rules/cli-styling-reference.md` — auto-injects when editing chat bookends, output formatting, or CLAUDE.md.*

## Agent Attribution
When subagents (Explore, Plan, Bash, etc.) are spawned via the Task tool, their contributions must be visibly attributed in the chat output so the user can see which agent produced what.

### Naming convention
- **Agent 0** — the main orchestrator (Claude itself, the one the user is talking to). Always present
- **Agent 1, Agent 2, ...** — subagents, numbered in the order they are first spawned within the session. The number persists if the same agent is resumed (e.g. Agent 1 remains Agent 1 even if resumed later)
- Format: `Agent N (type)` — e.g. `Agent 1 (Explore)`, `Agent 2 (Plan)`, `Agent 3 (Bash)`

### Inline prefix tagging
- **Agent 0 (Main) is never prefixed** — it's the default. All untagged output is understood to come from Agent 0
- **Subagent output gets prefixed** with `[Agent N (Type)]` at the start of any line that comes from or summarizes a subagent's contribution. Examples: `[Agent 1 (Explore)] Found auth middleware in src/middleware/...` or `[Agent 2 (Plan)] Recommends adding a validation layer before...`
- This applies to inline commentary during work, SUMMARY bullets, and any other output where a subagent's contribution is being relayed
- Do not change the prompts sent to subagents — this is purely an output/display convention
- Do not prefix routine tool calls (Read, Edit, Grep, Glob) — only Task-spawned subagents get prefixed
- If a subagent found nothing useful, no need to mention it

### Token Budget Reference
*See `repository-information/TOKEN-BUDGETS.md` — section "Agent Attribution"*

## Reminders for Developer
*Rule: see Session Start Checklist — "Reminders for Developer" in the Always Run section. File location and format below.*

The developer's own notes and reminders, surfaced at the start of every session. **These are the developer's property** — Claude surfaces them but does not modify, complete, or remove them without explicit developer approval (see "User-Owned Content" rule in behavioral-rules.md).

### File location
`repository-information/REMINDERS.md`

### How it works
- **Adding reminders**: when the user says "remind me next time" (or similar — "next session remember", "don't let me forget", "bring this up next time"), add an entry to `## Active Reminders` with a timestamp and description
- **Surfacing reminders**: during the Session Start Checklist, read the file and output any active reminders before proceeding to the user's request. Format: `📌 Reminders For Developer:` followed by bullet points. Session context from SESSION-CONTEXT.md is surfaced immediately after (see CLAUDE.md Session Start Checklist)
- **Completing reminders**: only when the developer **explicitly** says a reminder is done or dismisses it, move it from `## Active Reminders` to `## Completed Reminders` with a completion timestamp. Never complete a reminder autonomously based on task similarity
- **Trigger phrases**: the user does not need to use exact phrasing — any intent to be reminded in a future session should be captured. Examples: "remind me next time", "next session bring up", "don't forget to mention", "remember to tell me"

### Entry format
```
- `YYYY-MM-DD HH:MM:SS AM/PM EST` — **Brief title** — longer description if needed
```

### Completed entry format
```
- ~~`YYYY-MM-DD HH:MM:SS AM/PM EST` — **Brief title** — description~~ — completed `YYYY-MM-DD HH:MM:SS AM/PM EST`
```

Developed by: LightAISolutions

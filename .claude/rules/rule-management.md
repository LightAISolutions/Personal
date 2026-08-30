---
paths:
  - "CLAUDE.md"
  - ".claude/rules/**/*.md"
---

# Rule Management — Placement, Precedence, and Section Positioning

*Path-scoped: auto-injects when editing `CLAUDE.md` or any file under `.claude/rules/`. Full meta-rules for where new rules should live, how to resolve conflicts between rules, and how to position `##` sections in CLAUDE.md. Cross-referenced from `.claude/rules/behavioral-rules.md` and `CLAUDE.md`.*

These rules only apply when the user is **adding or modifying rules / editing CLAUDE.md structure**. They are not needed on every response — that's why this file is path-scoped rather than always-loaded.

## Rule Placement Autonomy
- When the user asks to make something a rule, **autonomously determine the best location** — choose between CLAUDE.md and the `.claude/rules/` files based on the content's nature:
  - **CLAUDE.md** — mandatory per-session checklists, safety gates, and behavioral rules that must always be loaded (primacy/recency zone content per the Section Placement Guide)
  - **Existing `.claude/rules/` file** — if the rule fits an existing file's scope (check `paths:` frontmatter and existing content). Always-loaded files (no `paths:`) for universal behavioral rules; path-scoped files for domain-specific rules
  - **New `.claude/rules/` file** — only if the rule doesn't fit any existing file's scope and represents a distinct domain area that will likely accumulate more rules over time. A single rule does not justify a new file — add it to the closest existing file instead
- **Always scan for contradictions** before adding a new rule — check CLAUDE.md and all `.claude/rules/` files for existing text that conflicts with the new rule. Resolve conflicts in the same commit (per the Think Before Asserting gate's "Conflict cleanup" extension). **For how to resolve a genuine conflict, see "Rule Precedence" below.**
- **Direction of responsibility** — when a rule describes how system A must accommodate system B, place the rule with the **accommodating system** (the one that must adapt), not the accommodated one. The system that must defer is the one that needs to be reminded. Example: "GAS UI must respect the host HTML page's layout" belongs in `gas-scripts.md` (the guest), not `html-pages.md` (the host) — the GAS code is what needs to check for conflicts, not the HTML page
- State the chosen location and brief reasoning when adding the rule, so the user can redirect if they disagree with the placement

### Rule Precedence — Resolving Genuine Conflicts

The Think Before Asserting "Conflict cleanup" extension and the "Always scan for contradictions" bullet above both require contradiction-scanning before adding a rule. Neither defines what to do when two rules **genuinely** contradict and both are currently active. This sub-section is the **single source of truth** for that resolution; both of the above cross-reference this section rather than duplicating the logic.

**Resolution order — apply in sequence, first match wins:**

1. **Explicit precedence marker wins.** If one of the conflicting rules has a clear precedence declaration — e.g. "this rule is never skipped," "fires first," "THIS IS THE SINGLE MOST IMPORTANT RULE IN THIS FILE," "wins over X," or a Precedence Header at the top of the file — that rule wins. Examples: `.claude/rules/chat-bookends.md`'s Feature toggle gate has a Precedence Header declaring it fires first; the Response Opener gate body is subordinate even though it uses stronger "EVERY response" language. `[PC-SAFETY] #0` in CLAUDE.md says "This item is never skipped" — it beats any toggle-skip caveat on other items.
2. **More targeted rule wins.** If neither rule has an explicit precedence marker, the rule whose scope is narrower wins when both would apply. "Narrower" means: a rule about a specific file type, specific checklist item, or specific command beats a rule with repo-wide scope. Example: a rule in `gas-scripts.md` about `.gs` VERSION handling wins over a generic "version bump by 0.01" rule in `.claude/rules/changelogs.md` when both apply to a `.gs` file, because the `gas-scripts.md` rule is scoped specifically to GAS.
3. **Newer rule wins (default).** If neither rule has an explicit precedence marker and scope is equal, the newer rule wins. "Newer" means: the rule added or most recently modified in git history. Rationale: the developer's most recent guidance represents their current intent; older guidance that wasn't explicitly preserved is superseded.

**Conflict-resolution commit requirements:**
- **Resolve in the same commit that introduces the new rule** — do not land a contradiction and plan to fix it later. Either (a) update the older rule in the same commit to remove the contradiction, (b) add a precedence marker to one of the rules making the resolution explicit, or (c) reword the new rule to avoid the conflict
- **If resolution 1 or 2 applies, no rule change is needed** — the precedence is already implicit in the markers or scopes. But add a cross-reference note to both rules ("subject to X's precedence" / "superseded by Y when ...") so a future reader can trace the resolution without re-deriving it
- **Never silently drop a rule.** If the resolution is to delete or supersede older text, the commit message must explicitly call it out ("Supersedes the older 'X' rule which was removed").

**Why this resolution order:** explicit markers are the strongest signal of intentional precedence. Targeted scope is the next strongest signal because the developer wrote the narrower rule with a specific context in mind, and that context should control in that context. Newness is the weakest tiebreaker — it catches the case where two rules drifted apart over time with no explicit reconciliation. Asking "which was written first" without markers or scope distinctions is arbitrary; recency at least reflects current intent.

## Section Placement Guide (CLAUDE.md Structure)
When adding, moving, or reorganizing `##` sections in CLAUDE.md, follow the attention zone model below. LLMs process long documents with uneven attention — instructions near the top (**primacy zone**) and bottom (**recency zone**) are recalled most reliably, while the middle (**body zone**) receives progressively less attention as the file grows.

### Attention zones

| Zone | Position | What belongs here | Recall reliability |
|------|----------|-------------------|--------------------|
| **Primacy zone** | Sections 1–6 | Mandatory checklists, safety gates, and instructions that must execute every session without exception (Template Variables, Session Start Checklist, Template Repo Guard, Pre-Commit Checklist, Pre-Push Checklist, Initialize Command) | Highest — first ~15% of content is almost never missed |
| **Upper body** | Sections 7–10 | Behavioral rules and meta-rules that shape how work is done — execution style, pushback policy, user-perspective reasoning, and this placement guide | High — still in the first third of the file |
| **Lower body** | Sections 11–N-3 | Reference material, detailed specifications, and context needed only when working on specific features (version bumping, build version, commit naming, architecture nodes, documentation sync, link reference, merge prevention, etc.) | Moderate to low — the "dead zone" where instructions are most likely to be missed on long files |
| **Recency zone** | Sections N-2 to N | High-volume formatting rules that are needed on every response and benefit from recency bias (Chat Bookends, Developer Branding) | High — last ~15% of content gets a recall boost |

### Placement rules for new content
1. **Mandatory per-session actions** (checklists, gates, safety checks) → primacy zone. These must execute reliably every session regardless of context length
2. **Behavioral constraints** (how to reason, when to push back, execution approach) → upper body. These shape decision-making and must be internalized early in processing
3. **Meta-rules about CLAUDE.md itself** (this section, "Maintaining these checklists") → upper body. Structural rules must be loaded before any content modification begins
4. **Feature-specific reference material** (version formats, directory layouts, link patterns, architectural details) → lower body. These are consulted on-demand when the relevant feature is being worked on — they don't need high baseline recall
5. **High-frequency per-response formatting** (bookend markers, timestamps, end-of-response blocks) → recency zone. Chat Bookends is ~220 lines and applies to every single response — placing it last leverages recency bias to ensure formatting compliance
6. **Developer Branding always stays last** — this is a fixed constraint (the section itself says so)

### When to re-evaluate positioning
- If CLAUDE.md grows past ~900 lines, the dead zone expands — consider extracting lower-body sections to `.claude/rules/` files
- If a lower-body section starts being missed in practice (instructions skipped or forgotten), move it toward the primacy or recency zone — observed misses override theoretical positioning
- After any major reorganization, verify the section order still follows this zone model by running `grep -n '^## ' CLAUDE.md` and checking the sequence

### What this does NOT control
- **Within-section ordering** (e.g. the order of items inside Pre-Commit Checklist) is governed by the section's own logic, not by attention zones
- **Content extraction to reference files** is governed by the "Content placement" rule in "Maintaining these checklists" — this section only governs where `##` sections appear in CLAUDE.md itself

Developed by: LightAISolutions

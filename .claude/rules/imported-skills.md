---
paths:
  - ".claude/skills/imported--*/**"
---

# Imported Skills — Do Not Modify

*Path-scoped: auto-injects when editing imported skills. Cross-referenced from `.claude/rules/behavioral-rules.md`.*

- **Imported skills** (`.claude/skills/imported--*/SKILL.md`) must **never** have their logic, instructions, or prompts edited — their content is frozen as-imported so the developer can always distinguish which skill is producing which behavior
- **Permitted changes** — two categories of mechanical updates may be applied without flagging or asking: (1) updating a **location pointer** (e.g. a file path or URL reference that changed due to a repo restructure), and (2) updating a **reference name** (e.g. a template filename that was renamed, a variable name that changed, or any identifier that the skill references by name and that no longer exists under the old name). These are not behavioral modifications — they keep the skill functional after repo-level renames. Apply them in the same commit as the rename that triggered them
- **Custom skills** (`.claude/skills/*/SKILL.md` without the `imported--` prefix) can be freely created, edited, and deleted as needed
- If an imported skill needs behavioral changes, create a **custom skill** with the desired behavior instead — or add a `.claude/rules/` file that layers repo-specific guidance on top of the imported skill's base behavior
- This rule applies regardless of who requests the change — even if the user asks to "fix" or "improve" an imported skill, flag that it's imported and recommend the alternatives above. Only proceed with direct behavioral modification if the user explicitly overrides after understanding the tradeoff

Developed by: LightAISolutions

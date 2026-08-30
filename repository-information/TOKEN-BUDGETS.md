# Token Budget Reference

This file consolidates all token budget estimates from CLAUDE.md into a single reference document. Consult this when troubleshooting token usage or optimizing response costs.

CLAUDE.md sections reference this file with: *See `repository-information/TOKEN-BUDGETS.md` — section "X"*

---

## Chat Bookends

The bookend system adds overhead to every response. Use this reference if you're troubleshooting token usage.

**Per-response bookend overhead (output tokens):**

| Component | ~Tokens | Notes |
|-----------|---------|-------|
| CODING PLAN line + bullets | 40–60 | 3–5 bullets typical |
| CODING START line | ~15 | Shared `date` call with CODING PLAN |
| ESTIMATED TIME lines (overall + per-phase) | 15–30 | Overall always present; per-phase only when >2 min; no `date` call needed |
| REVISED ESTIMATED TIME line | 10–20 | Only when estimate changes ≥1m after research; no `date` call needed |
| ACTUAL TOTAL COMPLETION TIME line | ~10 | Always present before CODING COMPLETE; no extra `date` call needed |
| Mid-response markers (RESEARCHING, VERIFYING, etc.) | 30–45 | Avg 2–3 per response |
| `⏱️` duration lines | 20–30 | Avg 3–4 per response |
| `date` command tool calls + results | 120–180 | ~25–35 tokens per round-trip × 4–6 calls |
| End-of-response block (divider → SUMMARY) | 80–150 | Scales with number of files/commits |
| CODING COMPLETE line | ~15 | — |
| **Total bookend overhead** | **~320–480** | **~5–15% of a typical response** |

**Context (input tokens):**
- The CLAUDE.md instructions themselves are ~10K+ input tokens loaded into every prompt — this is the larger fixed cost
- Bookend output overhead is small relative to the instruction payload

**Where to cut if hitting limits:**
1. `date` calls are the biggest per-token cost — the shared CODING PLAN/CODING START call already saves one per response
2. Mid-response markers (RESEARCHING, NEXT PHASE, etc.) can be skipped on very short responses where the phase is obvious
3. End-of-response sections (WORTH NOTING, FILES CHANGED) are already skip-if-empty — they cost nothing when unused

---

## Template Drift Checks

~300–800 output tokens, ~8–15 tool calls. Runs once (first session on a fresh fork). Steps 1–4 (org/repo detect + absolute URL propagation) dominate — each of ~8 files requires a read + edit. The final `grep -r` verification pass adds ~30–50 tokens. After first run, the short-circuit skips all of this.

---

## Session Start Checklist

The Session Start Checklist runs once per session but is the heaviest single-response cost.

| Scenario | ~Output tokens | ~Tool calls | Notes |
|----------|---------------|-------------|-------|
| Template repo (short-circuit) | 100–200 | 3–5 | Branch hygiene + skip message |
| Initialized fork (short-circuit) | 150–300 | 4–6 | Branch hygiene + README check + skip message |
| Fresh fork (full drift checks) | 500–1,000+ | 10–20 | Steps 0–10: grep, find-replace across ~8 files, verification grep |

**Where the cost lives:** on fresh forks, steps 1–4 (org/repo detect + absolute URL propagation) dominate — each file requires a read, edit, and verification. The final `grep -r` verification pass (step 4) adds another ~30–50 tokens of tool overhead.

---

## Pre-Commit Checklist

The Pre-Commit Checklist runs before every commit — costs multiply with multi-commit responses.

| Scenario | ~Output tokens | ~Tool calls | Notes |
|----------|---------------|-------------|-------|
| Template repo (most items skipped) | 100–200 | 2–4 | Items #0, #4, #8, #10, #11, #12, #13 only |
| Fork — no version bumps needed | 150–300 | 3–6 | README timestamp + checklist verification |
| Fork — version bumps triggered | 300–600 | 6–12 | Version bump + REPO-ARCHITECTURE.md + CHANGELOG.md + version.txt |

**Where the cost lives:** CHANGELOG.md entry (item #7) requires a `date` call + file read + edit. REPO-ARCHITECTURE.md Mermaid updates (item #6) require reading the diagram and updating multiple nodes. These two items together account for ~40% of the full-checklist cost.

---

## Pre-Push Checklist

The Pre-Push Checklist runs before every `git push`.

| Component | ~Output tokens | ~Tool calls |
|-----------|---------------|-------------|
| Branch name + remote URL checks (#1, #2) | 40–80 | 2 |
| Commit audit — `git log` (#3) | 30–60 | 1 |
| Cross-repo content scan — `git diff` (#4) | 40–80 | 1 |
| Push-once enforcement (#5) | 10–20 | 0 (mental check) |
| **Total** | **~100–250** | **~4–5** |

**Cost is stable:** unlike Pre-Commit, this checklist doesn't scale with the number of changes — it's the same ~4–5 tool calls regardless of commit size.

---

## Agent Attribution

Agent attribution overhead scales with the number of subagents spawned.

| Scenario | ~Output tokens | Notes |
|----------|---------------|-------|
| No subagents (Agent 0 only) | 20–30 | Single AGENTS USED line |
| 1–2 subagents | 50–80 | AGENTS USED lines + inline `[Agent N]` prefixes on relayed findings |
| 3+ subagents | 100–150+ | More prefixed lines + longer AGENTS USED list |

**Hidden cost:** each Task tool call to spawn a subagent consumes ~50–100 tokens of tool overhead (prompt + result), separate from the attribution output. The subagent's own context window is independent but its summarized result flows back into the main context.

Developed by: LightAISolutions

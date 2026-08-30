---
paths:
  - ".github/workflows/**"
  - ".github/last-processed-commit.sha"
---

# Workflow Rules

*Actionable rules: see Deployment Flow in Session Start Checklist and Pre-Push Checklist in CLAUDE.md.*

## Merge Conflict Prevention (Auto-Merge Workflow)

The auto-merge workflow merges `claude/*` branches into `main` using `git merge --ff-only` with a `-X theirs` fallback. The `-X theirs` strategy auto-resolves content conflicts by preferring the incoming branch.

**Why this matters:** Every `claude/*` push triggers the workflow. If a prior workflow already merged a different claude branch into `main` (advancing `main` beyond this branch's fork point), a fast-forward is no longer possible. The fallback merge can hit content conflicts — especially in `CHANGELOG.md`, which is modified on every commit by the Pre-Commit Checklist. Without `-X theirs`, the merge fails with exit code 1, the auto-merge job fails, and the deploy job is skipped (its condition requires auto-merge success).

**Why `-X theirs` is safe:** The claude branch is always branched from `main` and contains strictly newer changes. When both sides modify the same lines (e.g. `CHANGELOG.md`'s `[Unreleased]` header timestamp), the claude branch's version is always the one we want. The `-X theirs` strategy resolves exactly this class of conflict — same-line edits where the incoming branch has the latest content.

**What this does NOT cover:** If the conflict is structural (e.g. a file was deleted on `main` but modified on the branch), `-X theirs` may not produce the desired result. These cases are rare in the `claude/*` workflow and would need manual intervention.

## Commit SHA Tracking (Inherited Branch Guard)

The file `.github/last-processed-commit.sha` stores the SHA of the last commit that was successfully merged into `main` by the auto-merge workflow. This provides a deterministic guard against inherited branches on forks and imports.

**How it works:**
1. When a `claude/*` branch is pushed, the workflow reads `.github/last-processed-commit.sha` from **two sources**: the checked-out branch AND `origin/main` (after fetching)
2. If the incoming commit SHA (`github.sha`) matches the stored SHA from **either source**, the branch is inherited — it carries the exact same commit from the template repo. The workflow deletes the branch and skips
3. After a successful merge, the workflow updates the file with the new `HEAD` SHA on `main` **in the same push as the merge** — this is critical to eliminate the race window

**Why atomic merge+SHA update?** Previously, the merge and SHA update were two separate pushes. If a fork/import copied the repo between push 1 (merge) and push 2 (SHA update), the copy got the branch but the `.sha` file was stale — the guards couldn't detect it. Now the merge and SHA update land in a single `git push`, so there's no window for an inconsistent copy.

**Why two sources in the check?** The branch's copy of `.sha` has the value from when the branch was created. `origin/main`'s copy has the latest post-merge value. On a fork/copy, which copy the inherited branch carries depends on timing — checking both catches either scenario.

**Why this is bulletproof:**
- Git SHAs are deterministic — a fork/import inherits the exact same SHAs from the source repo
- A new legitimate commit always produces a different SHA (different author, timestamp, parent, etc.)
- The file travels with the repo on copy, carrying the "already processed" marker with it
- The atomic merge+SHA update eliminates the timing race between updates and copies
- The dual-source check (branch + origin/main) eliminates timing races between the SHA file value and the branch copy
- No API calls needed — the check is a file read and string compare, making it the fastest guard in the chain

**Relationship to other guards:** This is **Check 0a** in the guard chain. The branch-source check runs before the origin/main fetch (fast path — catches exact matches immediately). The origin/main-source check runs after the fetch (catches cases where the branch's copy is stale but main's copy is current). Both run before the already-merged check, the timestamp check, and the IS_TEMPLATE_REPO mismatch check.

**File management:** The `.sha` file is managed exclusively by the workflow — Claude Code does not modify it. The only exception is during initial repository creation, where the file is seeded with the current HEAD SHA.

## Job-Level Permissions — Include `contents: read` Explicitly

**Rule:** Any workflow job that declares its own `permissions:` block AND calls `actions/checkout` (or otherwise reads repo files) must include `contents: read`. Do NOT rely on workflow-level `permissions:` to carry through — they don't.

**Why:** Job-level `permissions:` blocks **replace** workflow-level permissions, not augment them. Every permission not listed in the job block defaults to "none" for that job, regardless of what the workflow-level block says. `actions/checkout` uses the `GITHUB_TOKEN` scoped to the job's permissions — without `contents: read`, the token cannot clone the repo.

**Why it looks fine on public repos but breaks on private ones:** Public repo metadata is world-readable, so `actions/checkout` can clone anonymously even when the token has no `contents` scope. On **private** repos, authentication is mandatory, and the request fails.

**Misleading error message:** GitHub's API returns `404 "Repository not found"` (not `403 "Forbidden"`) when a private repo is requested without read access — an intentional anti-enumeration measure that makes the error look like a typo or a deleted repo instead of a permissions issue. If a workflow checkout step fails on a private repo with "Repository not found" and the token is obviously for the right repo, **check the job's `permissions:` block first** before suspecting bad tokens or wrong URLs.

**Correct deploy-job shape:**
```yaml
deploy:
  permissions:
    contents: read       # ← required for actions/checkout on private repos
    pages: write
    id-token: write
```

**Full case study:** `repository-information/KNOWN-CONSTRAINTS-AND-FIXES.md` — "Fix 4 — Pages deploy job failing with 'Repository not found' on private forks"

## WORKFLOW_PAT Safety Net

**Rule:** The `auto-merge` job's checkout step uses an opt-in `WORKFLOW_PAT` fallback, gated on the repo variable `USE_WORKFLOW_PAT`. Do NOT remove this fallback as "cleanup" during an unrelated fix — it is a deliberate safety net. Modifications to the token selection require user approval (see Chesterton's Fence gate in `.claude/rules/behavioral-rules.md`).

**Why `WORKFLOW_PAT` is retained:** GitHub historically blocked `GITHUB_TOKEN` from pushing commits that modify `.github/workflows/*` files — such pushes required the `workflow` scope, which only Personal Access Tokens carry. Current empirical evidence (as of v11.60r) shows `GITHUB_TOKEN` successfully pushes yml-modifying merge commits to `main` in this workflow, but this behavior is not guaranteed to persist — GitHub's policy could tighten, or a future workflow step could attempt to self-modify its own yml (which is a known use case for merge automation). The PAT fallback preserves the escape hatch for both scenarios.

**The hardened opt-in gate:** The token expression is:
```yaml
token: ${{ (vars.USE_WORKFLOW_PAT == 'true' && secrets.WORKFLOW_PAT) || secrets.GITHUB_TOKEN }}
```
The prior `secrets.WORKFLOW_PAT || secrets.GITHUB_TOKEN` pattern was unsafe because GitHub's `||` operator picks the first **truthy** value — a stale or revoked PAT string is still truthy, so checkout would use the broken token and fail with a misleading "Repository not found" error. The opt-in gate requires BOTH conditions — an explicit `vars.USE_WORKFLOW_PAT == 'true'` AND a non-empty `secrets.WORKFLOW_PAT` — so a fork that accidentally inherits a stale PAT silently falls through to `GITHUB_TOKEN` unless the fork operator explicitly opts in.

**How to enable `WORKFLOW_PAT`:**
1. Create a Personal Access Token with the `workflow` and `repo` scopes
2. Add it as a repo secret named `WORKFLOW_PAT`
3. Add a repo **variable** (not secret) named `USE_WORKFLOW_PAT` with value `true`
4. Both must be present — missing either one causes the gate to fall through to `GITHUB_TOKEN`

**How to disable:** set `USE_WORKFLOW_PAT` to anything other than `'true'` (or delete the variable). The secret can stay — it will not be used.

**Why a variable, not just a secret presence check:** a variable is explicit opt-in configuration. A secret presence check would silently activate `WORKFLOW_PAT` the moment someone added the secret, reintroducing the stale-PAT failure mode. The variable forces a conscious decision to use the PAT path.

Developed by: LightAISolutions

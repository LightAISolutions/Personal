---
name: git-cleanup
description: Safely clean up git worktrees, stale local branches, and merged remote branches with gated confirmation. Use when the repo has accumulated stale claude/* branches, orphaned worktrees, or needs general git housekeeping. Inspired by Trail of Bits git-cleanup skill.
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash, Read
---

# Git Cleanup

*Inspired by [Trail of Bits git-cleanup skill](https://github.com/trailofbits/skills) — adapted for the claude/* branch workflow.*

Safely clean up stale branches, worktrees, and other git artifacts with user confirmation before any destructive action.

## What This Cleans

### 1. Stale Local Branches

Branches that have been merged into `main` or no longer exist on the remote:

```bash
# List local branches merged into main
git branch --merged main | grep -v '^\*\|main$'

# List local branches with no remote tracking
git branch -vv | grep ': gone]'
```

### 2. Stale Remote Branches

Remote-tracking references for branches that no longer exist:

```bash
# Prune stale remote references
git remote prune origin --dry-run
```

### 3. Orphaned Worktrees

Git worktrees that were not properly cleaned up:

```bash
# List all worktrees
git worktree list

# Remove stale worktree entries
git worktree prune --dry-run
```

### 4. Claude Branch Artifacts

This repo uses `claude/*` branches that are auto-merged and deleted by the workflow. Sometimes artifacts remain:

```bash
# List any local claude/* branches
git branch | grep 'claude/'

# List remote claude/* branches
git ls-remote --heads origin 'claude/*'
```

## Workflow

1. **Audit** — run all discovery commands above in dry-run mode
2. **Report** — present findings to the user in a clear summary:
   - N stale local branches (list them)
   - N stale remote references (list them)
   - N orphaned worktrees (list paths)
   - N leftover claude/* branches (list them)
3. **Confirm** — ask the user which categories to clean up (or "all")
4. **Execute** — perform the cleanup only after confirmation:
   - `git branch -d <branch>` for merged local branches
   - `git remote prune origin` for stale remote references
   - `git worktree prune` for orphaned worktrees
   - `git branch -D <branch>` for unmerged claude/* branches (with explicit warning)
5. **Verify** — run `git branch -a` and `git worktree list` to confirm clean state

## Safety Rules

- **Never delete `main`** — always exclude from any deletion operation
- **Never force-delete without asking** — `git branch -D` (force) requires explicit user approval
- **Dry-run first** — always show what will be deleted before doing it
- **No remote pushes** — this skill only cleans local state. Remote branch deletion requires separate approval

Developed by: LightAISolutions

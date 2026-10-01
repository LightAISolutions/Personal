#!/usr/bin/env bash
# Merge routine memory branches into main. Called by .github/workflows/merge-routine-memory.yml.
#   scripts/merge-routine-memory.sh [claude/<branch>]   # no argument = sweep every origin/claude/* branch
# A branch is merged ONLY when everything it changes (vs. its merge-base with main) is a routine memory path:
# log/, quarantine/ and the pack's memory directories ({{MEMORY_DIRS}}) — the paths CLAUDE.md ROUTINE MODE lets a
# routine write. Memory paths are markdown files one level below those directories, nothing nested. Development-session
# branches touch other paths and are skipped untouched. Merged branches are deleted; conflicts are aborted, left for
# the owner and fail the run.
set -euo pipefail
ALLOW='^(log|quarantine|{{MEMORY_DIRS_REGEX}})/[^/]+\.md$'

git fetch -q origin '+refs/heads/main:refs/remotes/origin/main' '+refs/heads/claude/*:refs/remotes/origin/claude/*'
git checkout -q -B main origin/main

if [ $# -gt 0 ] && [ -n "$1" ]; then branches="origin/$1"
else branches=$(git for-each-ref --sort=committerdate --format='%(refname:short)' 'refs/remotes/origin/claude/'); fi

merged=0; conflicts=0
for b in $branches; do
  git rev-parse -q --verify "$b" >/dev/null || { echo "skip $b: not on origin"; continue; }
  [ "$(git rev-list --count "main..$b")" -gt 0 ] || { echo "skip $b: nothing new"; continue; }
  files=$(git diff --name-only "$(git merge-base main "$b")" "$b")
  [ -n "$files" ] || { echo "skip $b: no file changes"; continue; }
  if printf '%s\n' "$files" | grep -Evq "$ALLOW"; then echo "skip $b: touches non-memory paths"; continue; fi
  if git merge -q --no-ff --no-edit -m "Merge routine memory from ${b#origin/}" "$b"; then
    git push -q origin HEAD:main
    git push -q origin --delete "${b#origin/}" || echo "note: could not delete ${b#origin/}"
    echo "merged $b"; merged=$((merged + 1))
  else
    git merge --abort; echo "::warning::conflict merging $b into main — left for the owner"; conflicts=$((conflicts + 1))
  fi
done
echo "routine memory: merged=$merged conflicts=$conflicts"
[ "$conflicts" -eq 0 ]

# Developed by: LightAISolutions

---
name: remember-session
description: Save the current development session's context to repository-information/SESSION-CONTEXT.md so the next development session can pick up where this one left off. Use before ending a development session; never run by a routine.
user-invocable: true
disable-model-invocation: true
---

# Remember Session

Save this development session's context so a future development session can continue where it left off. This is the one skill in `skills/` that is not a routine skill: it writes no envelope, touches no memory directory and is never named in a routine prompt. This repo has no version bump, changelog, README timestamp or response markers — the skill does only the four steps below.

## Steps

1. **Write session context** to `repository-information/SESSION-CONTEXT.md`:
   - Move the existing `## Latest Session` content, if any, to the top of `## Previous Sessions`
   - **2-session cap** — after moving, if `## Previous Sessions` has more than one entry, delete everything beyond the first. The file holds Latest Session + 1 Previous Session, nothing more; older history is in the git log
   - Write a new `## Latest Session` with:
     - **Timestamp**: the real current date and time (run `date` first; never guess)
     - **What we worked on**: brief list of tasks completed or in progress
     - **Where we left off**: current state — what was just done, what is next, any open threads
     - **Key decisions made**: design choices, rule changes, preferences the owner expressed
     - **Active context**: branch name, framework pin (`git log -1 --oneline -- vendor/helpers`), relevant file states
     - **Recommendation for next session**: exactly one concrete next action (no menu of alternatives), then a line `**To continue:** type <phrase>` giving the exact words to type; or a single line saying nothing is pending
   - Describe work on the repository only. No trip, place, person, account or anything else from the owner's data: this file is the first thing a new session reads, and it must never be the file that leaks

2. **Commit** with message `Remember session context`

3. **Push** to the session's own `claude/*` branch — never `main`. The memory workflow leaves this branch alone (it touches a non-memory path); the owner merges it

4. **Tell the owner** in one line that the context is saved and that a new session is recommended, then repeat the recommendation as a blockquote: `> **Recommendation for next session:** …` and `> **To continue:** type …` (omit the second line when nothing is pending)

## How it works

- Every development session reads `SESSION-CONTEXT.md` at its start (`repository-information/DEV-SESSION.md`)
- A session that ends without this skill leaves the file stale; the next session reconstructs what it can from `git log` and says so at the top of its new entry
- Routines never read or write this file; their memory is `log/`, `quarantine/` and the pack's memory directories

Developed by: LightAISolutions

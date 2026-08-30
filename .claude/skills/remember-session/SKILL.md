---
name: remember-session
description: Save the current session context to SESSION-CONTEXT.md so the next Claude Code session can pick up where this one left off. Use before ending a session.
user-invocable: true
disable-model-invocation: true
---

# Remember Session

Save the current session's context so a future Claude Code session can continue where this one left off.

## Steps

1. **Write session context** to `repository-information/SESSION-CONTEXT.md`:
   - Move any existing `## Latest Session` content to `## Previous Sessions` (prepend, most recent first)
   - **2-session cap** — after moving, if `## Previous Sessions` has more than 1 entry, delete everything beyond the first. The file holds Latest Session + 1 Previous Session max
   - Write a new `## Latest Session` with:
     - **Timestamp**: current date/time
     - **What we worked on**: brief list of tasks completed or in progress
     - **Where we left off**: current state — what was just done, what's next, any open threads
     - **Key decisions made**: design choices, rule changes, user preferences expressed
     - **Active context**: branch name, repo version, relevant file states

2. **Commit** with message `Remember session context` (no version bump — housekeeping)

3. **Push** to the `claude/*` branch (Pre-Push Checklist applies)

4. **Session-ending action** — after pushing, close with CODING COMPLETE as normal, then output `SESSION SAVED` post-closing marker with the message: *"Session context saved. It's recommended to start a new session now so you don't lose the context we just created. Your next session will automatically pick up where we left off."*

## How It Works

- Every new session reads `SESSION-CONTEXT.md` during the Session Start Checklist
- If a session ends without "remember session", the next session auto-reconstructs from CHANGELOG.md
- The 2-session cap keeps the file compact — older history is in CHANGELOG.md

Developed by: LightAISolutions

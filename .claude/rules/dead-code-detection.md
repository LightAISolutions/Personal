---
paths:
  - "live-site-pages/**/*.html"
  - "googleAppsScripts/**/*.gs"
  - ".github/workflows/**"
---

# Dead Code Detection Methodology

*Path-scoped: auto-injects when editing HTML pages, GAS scripts, or workflow files. User-triggered by phrases like "check for dead code", "find unused code", "is this code still used?", "clean up dead code" — the methodology below is always available for on-demand invocation regardless of which file is open. Cross-referenced from `.claude/rules/behavioral-rules.md`.*

When the user asks to identify dead code or clean up unused code paths, apply this analysis (applies to HTML, JavaScript, GAS, server-side scripts, workflows):

1. **Trace all consumers** — grep/search for every read, call, or reference of the construct. Don't rely on memory
2. **Map execution paths** — for each consumer, determine whether it uses the value or cancels/overrides it before use. A consumer that immediately overwrites the value is cleanup code, not a real consumer. For GAS, check `doGet()`/`doPost()` entry points and any triggers
3. **Check for race conditions** — if async timing is involved (setTimeout, srcdoc, event handlers, GAS triggers, Promises), determine whether the "useful" path can ever win the race against the cancellation. Key questions: same synchronous context? (later wins) — yield point between creation and cancellation? (async could fire first) — guard that makes the async path a no-op even if it wins?
4. **"What if it ran" scenario** — even if the dead code executed, would it cause harm (fires external request, leaks data, consumes quotas → priority removal) or be a no-op (guard prevents action → lower priority cleanliness)?
5. **External resource consumption** — enumerate all paths that could hit external services: `UrlFetchApp.fetch()`, `SpreadsheetApp` writes, `GmailApp`/`MailApp` sends, `fetch()`, `XMLHttpRequest`, `iframe.src`, `navigator.sendBeacon`, `new Image()`. For each, check for an auth/session guard (`if (!session) return`). Unguarded resource paths are abuse vectors
6. **Cleanup burden** — dead code often requires active cancellation elsewhere. Count how many places fight against it; removal simplifies both sides

**Indicators dead code is present:**
- All branches that could consume a value instead delete/override/neutralize it before use
- 2+ code locations contain "cancel the X" / "prevent X from running" comments
- A guard makes the code a no-op (`if (!value) return` paired with every path deleting the value)
- The code's own comments explain why it must be cancelled ("would trigger gas-needs-auth", "would wipe the valid session")
- Unreachable parameters (never passed by any caller) or vestigial error handlers (catching errors from a removed API call)

**Exempt from the resource-abuse check:** static-file fetches (CDN version polling, changelogs, sounds — no app quota) and same-origin-only channels (BroadcastChannel is XSS-prerequisite and local-only).

Developed by: LightAISolutions

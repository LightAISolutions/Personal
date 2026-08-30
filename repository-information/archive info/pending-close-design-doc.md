# Server-Side Session Invalidation on Tab Close — Design Document

**Status:** Deferred — not implemented yet
**Date:** 2026-03-29
**Context:** HIPAA-compliant auth pages (testauthgas1, globalacl)

## Problem

When a user closes a browser tab without clicking "Sign Out," the server-side session (stored in GAS CacheService) remains active until it naturally expires. With `SESSION_EXPIRATION: 3600` (1 hour in production), an orphaned session stays valid server-side for up to an hour.

## Current Protections (Already in Place)

### Single-Session Enforcement
`MAX_SESSIONS_PER_USER: 1` in GAS config (`AUTH_CONFIG`). When a user signs in again, `exchangeTokenForSession()` calls `invalidateAllSessions(email)` which **deletes all existing sessions** for that user before creating a new one. This means orphaned sessions are automatically cleaned up when the user signs in again.

### Cache TTL Expiry
Sessions are stored with `cache.put("session_" + token, data, SESSION_EXPIRATION)`. When heartbeats stop (tab closed), the cache entry expires after `SESSION_EXPIRATION` seconds. Current values:
- **Test:** 180 seconds (3 minutes)
- **Production:** 3600 seconds (1 hour)

### sessionStorage (Client-Side)
With `STORAGE_TYPE: 'sessionStorage'` (HIPAA mode), closing the tab automatically clears the session token from the browser. The user can't accidentally reuse an old token from a closed tab.

### Auth State Machine (`_authState`)
Added in v07.61r. Tracks the authentication lifecycle: `signed-out`, `signing-in`, `authenticated`, `signing-out`, `reconnecting`. Prevents stale sign-out messages from interrupting fresh sign-in flows.

## Proposed Enhancement: `sendBeacon` Pending Close

### Approach
On `pagehide` event (fires when a tab closes, browser closes, or user navigates away), use `navigator.sendBeacon()` to POST to the GAS server, shortening the server-side session's cache TTL to 60 seconds. If the page reloads (refresh), the normal reconnect/heartbeat flow restores the full TTL before the 60 seconds expires. If the tab is actually closed, no reconnect arrives and the session expires after 60 seconds.

### Implementation Details

**GAS Layer — Add `action=pendingClose` to `doPost()`:**
```javascript
if (action === "pendingClose") {
  var token = (e && e.parameter && e.parameter.token) || "";
  if (token) {
    var cache = getEpochCache();
    var raw = cache.get("session_" + token);
    if (raw) {
      // Re-store with a short TTL (60 seconds) instead of full SESSION_EXPIRATION.
      // If a heartbeat/reconnect arrives within 60s, it overwrites with full TTL.
      cache.put("session_" + token, raw, 60);
    }
  }
  return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
}
```

**HTML Layer — Add `pagehide` listener:**
```javascript
window.addEventListener('pagehide', function() {
  if (_authState !== 'authenticated') return;
  var session = loadSession();
  if (!session.token) return;
  var gasApp = document.getElementById('gas-app');
  var baseUrl = (gasApp && gasApp.dataset.baseUrl) || '';
  if (!baseUrl) return;
  navigator.sendBeacon(baseUrl + '?action=pendingClose&token=' + encodeURIComponent(session.token));
});
```

### Files to Modify (when implementing)

**GAS files (add `pendingClose` to `doPost`):**
- `googleAppsScripts/Testauthgas1/testauthgas1.gs`
- `googleAppsScripts/Globalacl/globalacl.gs`
- GAS auth template (if applicable)

**HTML files (add `pagehide` listener):**
- `live-site-pages/testauthgas1.html`
- `live-site-pages/globalacl.html`
- `live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-auth.html.txt`

### GAS deployment required
Adding `pendingClose` to `doPost()` requires re-deploying each GAS project with a new version.

## Pros & Cons

| | **Implement Pending Close** | **Keep Current Behavior** |
|---|---|---|
| **Security** | Orphaned sessions die in 60s after tab close | Orphaned sessions live up to 1 hour (or until next sign-in) |
| **HIPAA posture** | Proactive session cleanup — demonstrates due diligence | Relies on re-sign-in cleanup + TTL expiry — reactive |
| **Audit trail** | GAS `doPost` logs show the `pendingClose` event — auditable proof sessions are being cleaned up | No record of when/whether abandoned sessions were cleaned up |
| **Refresh UX** | No change — reconnect restores TTL within seconds | No change |
| **Sign-in UX** | No change | No change |
| **Code complexity** | +~15 lines across GAS + HTML (small) | No new code |
| **New failure modes** | If `sendBeacon` fails (crash/no network), falls back to current behavior — never worse | None |
| **GAS quota impact** | +1 `cache.put()` per tab close — negligible | None |
| **Mobile app-switching** | No impact — `pagehide` doesn't fire on app switch | N/A |
| **Multiple tabs** | Each tab manages its own — closing one tab shortens its session TTL, other tabs' heartbeats keep theirs alive independently | Same |
| **Edge case: user never returns** | Session dies in 60s (improvement) | Session dies after full TTL (up to 1 hour) |
| **Edge case: user returns via re-sign-in** | Already handled by `invalidateAllSessions()` on sign-in — same as today | Same |

## `pagehide` Trigger Scenarios

| Action | `pagehide` fires? | `sendBeacon` fires? | Impact |
|--------|-------------------|---------------------|--------|
| Close the tab (click X) | Yes | Yes | Session TTL shortened — desired |
| Close the browser window | Yes | Yes | Session TTL shortened — desired |
| Type a different URL in the address bar | Yes | Yes | Session TTL shortened — OK (leaving the page) |
| Click a link to another site | Yes | Yes | Session TTL shortened — OK (leaving the page) |
| Open a new tab (original stays open) | No | No | No impact |
| Switch to another tab | No | No | No impact |
| Switch to another app (mobile) | No | No | No impact |
| Page refresh (F5 / Ctrl+R) | Yes | Yes | TTL shortened, but reconnect restores it within seconds |
| Browser crash | No | No | Falls back to normal TTL expiry |

## Open Concerns

### Multi-Tab / Multi-Page with Shared GAS Backend
If multiple HTML pages share the same GAS deployment (same CacheService, same session), closing one page's tab fires `sendBeacon` and shortens the shared session's TTL. The other page's heartbeat would need to restore the TTL within 60 seconds.

**Risk:** If the other page's heartbeat interval is longer than 60 seconds, the session could expire before the heartbeat fires. With `HEARTBEAT_INTERVAL: 300000` (5 min in production), this is a real risk.

**Mitigation options:**
1. **Increase the pending close TTL** to 120-300 seconds (must exceed `HEARTBEAT_INTERVAL`)
2. **Reference counting** — track how many tabs are connected to a session. Only shorten TTL when the count drops to zero. Significantly more complex.
3. **Only fire `sendBeacon` if no other same-project tabs are open** — use BroadcastChannel to check for other tabs before firing. Moderate complexity.

**Current recommendation:** Defer implementation until multi-page projects are in use. Single-page projects (current state) don't have this issue.

### `sendBeacon` Reliability
`sendBeacon` is not guaranteed in all scenarios:
- **Browser crash** — process killed by OS, no events fire
- **Device power loss** — battery dies, power cut
- **Network completely unavailable** at the exact moment of tab close

These are the same scenarios where ANY client-side mechanism would fail. `sendBeacon` is the most reliable option available — it was specifically designed for page-unload scenarios and browsers prioritize its delivery.

### Absolute Timer Impact
The pending close shortens the **cache TTL** (how long CacheService keeps the entry), NOT the session's internal timestamps. All session fields (`createdAt`, `absoluteStart`, timer values) remain unchanged. When a heartbeat restores the full TTL, the absolute timer calculation is unaffected.

## Decision History

- **2026-03-29:** Analyzed the problem, discussed approaches. Decided to defer implementation due to the multi-tab/multi-page concern. Single-session enforcement + TTL expiry provides adequate HIPAA coverage for the current architecture.
- **Key finding:** `exchangeTokenForSession()` already calls `invalidateAllSessions(email)` on sign-in, so orphaned sessions are cleaned up whenever the user signs in again.

## Testing Plan (for future implementation)

1. Sign in on testauthgas1 → open admin sessions panel → note 1 active session
2. Close the tab → wait 60+ seconds
3. Sign in again → open admin sessions panel → should see only 1 session (old one expired)
4. Verify GAS execution log shows `pendingClose` event
5. Sign in → refresh the page → should reconnect seamlessly (session still alive, heartbeat restored TTL)
6. Sign in on two tabs → close one → other tab should remain authenticated
7. On sign-in page → close tab → nothing should fire (`_authState` guard blocks it)

Developed by: LightAISolutions

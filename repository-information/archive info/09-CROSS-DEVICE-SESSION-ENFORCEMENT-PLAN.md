# Cross-Device Single-Session Enforcement Plan

**Created:** 2026-03-15
**Status:** Ready for implementation
**Scope:** `testauthgas1.html`, `testauthgas1.gs`
**Base version:** v01.81w (HTML), v01.27g (GAS), v03.64r (repo)
**References:**
- [07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md](07-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md) — Security hardening Plan I (implemented)
- [08-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md](08-SECURITY-UPDATE-PLAN-TESTAUTHGAS1.md) — Security hardening Plan II (implemented)
- [06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md](06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md) — Auth preset system

---

## Why This Document Exists

As of v03.64r, testauthgas1 has **same-browser single-tab enforcement** via BroadcastChannel (`SINGLE_TAB_ENFORCEMENT: true`). When a user opens a second tab in the same browser, the old tab shows a "Session Active Elsewhere" overlay and the new tab claims the session.

**What's missing:** if the same user signs in on a **different device** (or a different browser on the same machine), both sessions run independently. The server already invalidates old sessions on new sign-in (`invalidateAllSessions()` in `exchangeTokenForSession()`), but the old device doesn't discover this until its next heartbeat — which runs every 30 seconds (test) or 5 minutes (production). During that window, the old device continues to display the app with a session that no longer exists server-side.

**Why this matters for EMR:** in a healthcare context, concurrent sessions across devices create patient safety risks:
- **Stale data writes** — a clinician on device A writes a note, but device A's session was already invalidated. The write either silently fails or succeeds against a zombie session
- **Wrong-patient context** — device A shows Patient X's chart, device B shows Patient Y. If the clinician looks at the wrong screen, actions could be performed on the wrong patient record
- **Audit trail ambiguity** — two devices with the same user email producing actions makes it unclear which device generated which audit event
- **Session timer confusion** — device A shows "session expiring" while device B just signed in fresh. The clinician sees conflicting session state across screens

**The solution:** add a lightweight **session validity poll** that checks with the server every few seconds. When the server reports the session is gone, the old device immediately shows the existing "Session Active Elsewhere" overlay — the same UX as same-browser tab eviction, but triggered by server state instead of BroadcastChannel.

---

## Hard Constraints

These constraints are inherited from the existing auth architecture and must be preserved.

### Constraint A: No new external dependencies
The solution must work entirely within the existing GAS + Sheets + client-side HTML architecture. No Firebase, no WebSockets, no third-party services. The template is designed to be self-contained and deployable by anyone with a Google account.

### Constraint B: GAS quota safety
Google Apps Script has undocumented per-second rate limits on `doGet` calls. The session check must not trigger "Service invoked too many times" errors. The existing heartbeat already runs at 30s (test) / 5min (production) intervals. Adding a second, faster polling loop increases the load but must stay within safe bounds.

**Known GAS limits (from [official docs](https://developers.google.com/apps-script/guides/services/quotas) and [empirical testing](https://justin.poehnelt.com/posts/exploring-apps-script-cacheservice-limits/)):**
- CacheService: max 1,000 items, 100KB per item, max 6-hour TTL. No documented daily call limit for cache reads
- `doGet` cold start: 4-15 seconds (unpredictable). Warm calls: 400-1500ms per `google.script.run` call
- No officially documented requests-per-second limit for web app endpoints, but Google throttles with "Service invoked too many times" errors at undisclosed thresholds
- CacheService reads are significantly faster than writes

### Constraint C: Background tab throttling tolerance
Modern browsers throttle `setInterval` in background tabs:
- **Chrome:** timers throttled to 1 second minimum after tab goes to background; after 5 minutes of inactivity, throttled to **once per minute** ([Chrome dev blog](https://developer.chrome.com/blog/timer-throttling-in-chrome-88))
- **Firefox:** similar minimum interval enforcement
- **Safari:** may purge background tabs entirely

**Implication:** a 5-second polling interval will degrade to ~60-second intervals in a background tab after 5 minutes. This is acceptable — the primary concern is the *foreground* device (where the user is actively working) detecting that another device signed in. The *background* tab on an abandoned device can take longer to discover eviction without harm.

### Constraint D: Reuse existing UI
The "Session Active Elsewhere" overlay (`#tab-takeover-wall`) already exists and handles the same user flow. Cross-device eviction must use the same overlay with the same visual design. The only difference: the "Use Here" button must trigger re-authentication (since the server session is gone), not just a local reclaim.

### Constraint E: HMAC message signing must be maintained
All postMessage communication between GAS and the parent HTML page uses HMAC-based message signing. The new session check response must participate in the same signing scheme — the `_sig` field must be present and verified by the parent.

### Constraint F: Toggleable and independent
The feature must be independently toggleable via `HTML_CONFIG` and `AUTH_CONFIG`, separate from `SINGLE_TAB_ENFORCEMENT`. A deployment might want cross-device enforcement without same-browser tab enforcement, or vice versa.

### Constraint G: No spreadsheet access in the hot path
The session check must only use `CacheService` (in-memory), never `SpreadsheetApp` (slow, quota-heavy). The existing heartbeat already follows this pattern — session data lives in the script cache, not in the spreadsheet.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Cross-Device Session Enforcement             │
│                                                                  │
│  ┌─────────────────┐          ┌─────────────────┐               │
│  │   Device A       │          │   Device B       │               │
│  │   (old session)  │          │   (new sign-in)  │               │
│  │                  │          │                  │               │
│  │  Session check   │          │  exchangeToken   │               │
│  │  polling every   │          │  ForSession()    │               │
│  │  N seconds       │          │  → invalidates   │               │
│  │       │          │          │    all prior      │               │
│  │       ▼          │          │    sessions       │               │
│  │  ┌──────────┐   │          │       │          │               │
│  │  │  Hidden   │   │          │       ▼          │               │
│  │  │  iframe   │───┼──────────┼─► GAS doGet     │               │
│  │  │  ?check=  │   │          │   ?check=token   │               │
│  │  │   token   │   │          │       │          │               │
│  │  └──────────┘   │          │       ▼          │               │
│  │       │          │          │  CacheService    │               │
│  │       ▼          │          │  .get("session_  │               │
│  │  postMessage:    │          │   " + token)     │               │
│  │  gas-session-    │          │       │          │               │
│  │  evicted         │          │       ▼          │               │
│  │       │          │          │  Returns null    │               │
│  │       ▼          │          │  (invalidated    │               │
│  │  Show "Session   │          │   by Device B's  │               │
│  │  Active          │          │   sign-in)       │               │
│  │  Elsewhere"      │          │                  │               │
│  │  overlay         │          │                  │               │
│  └─────────────────┘          └─────────────────┘               │
│                                                                  │
│  Same-browser tab enforcement (BroadcastChannel) continues to    │
│  handle instant eviction within a single browser instance.       │
│  Cross-device polling catches the gap BroadcastChannel can't     │
│  reach.                                                          │
└──────────────────────────────────────────────────────────────────┘
```

### How the pieces fit together

| Layer | Mechanism | Eviction speed | Scope |
|-------|-----------|---------------|-------|
| Same-browser tabs | BroadcastChannel `tab-claim` | Instant (<100ms) | Same browser, same device |
| Cross-device/browser | GAS session check polling | 5-10 seconds (foreground), up to 60s (background tab after 5min) | Any device, any browser |
| Server-side | `invalidateAllSessions()` on new sign-in | Immediate (server state) | Already exists — old sessions are deleted from CacheService |

The server already does the invalidation. The cross-device polling simply makes the client *discover* it sooner.

---

## Implementation Phases

### Phase 1: GAS — Add `checkSession` Action to `doGet`

**Risk:** Low
**Files:** `testauthgas1.gs`
**What:** Add a new query parameter handler in `doGet` for `?check=SESSION_TOKEN` that performs a read-only session validity check.

**Why a separate action (not piggybacking on heartbeat):**
- Heartbeat is expensive — it **writes** to the cache (resets `createdAt`, re-signs HMAC, extends TTL). The session check only **reads**
- Heartbeat has rate limiting (20 per 5-minute window). Session checks need their own, higher limit since they fire more frequently
- Heartbeat is activity-gated (only fires when the user has been active). Session checks must fire unconditionally — the point is to detect eviction even on an idle device
- Separating concerns makes each path testable and tunable independently

**Current `doGet` parameter routing (line ~742-745):**
```javascript
var sessionToken = (e && e.parameter && e.parameter.session) || "";
var signOutToken = (e && e.parameter && e.parameter.signOut) || "";
var heartbeatToken = (e && e.parameter && e.parameter.heartbeat) || "";
```

**New parameter to add:**
```javascript
var checkToken = (e && e.parameter && e.parameter.check) || "";
```

**New handler block (insert after heartbeat handler, before sign-out handler):**

```javascript
// Session check flow: lightweight read-only validity poll (cross-device enforcement)
if (checkToken) {
  var cache = CacheService.getScriptCache();

  // Rate limit: max 60 checks per session per 5-minute window
  // (supports ~12/min sustained, covering 5s polling with margin)
  var scRlKey = 'sc_ratelimit_' + checkToken.substring(0, 16);
  var scAttempts = cache.get(scRlKey);
  var scCount = scAttempts ? parseInt(scAttempts, 10) : 0;
  if (scCount >= 60) {
    var scRlHtml = '<!DOCTYPE html><html><body><script>'
      + 'window.top.postMessage({type:"gas-session-check-error"}, '
      + JSON.stringify(PARENT_ORIGIN) + ');'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(scRlHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  cache.put(scRlKey, String(scCount + 1), 300);

  // Read-only check — does the session still exist in cache?
  var scRaw = cache.get("session_" + checkToken);

  if (!scRaw) {
    // Session was invalidated (by another device's sign-in, timeout, or sign-out)
    var scEvictedHtml = '<!DOCTYPE html><html><body><script>'
      + 'window.top.postMessage({type:"gas-session-evicted"}, '
      + JSON.stringify(PARENT_ORIGIN) + ');'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(scEvictedHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Session exists — read the message key for signing
  var scMsgKey = '';
  try { scMsgKey = JSON.parse(scRaw).messageKey || ''; } catch(e) {}

  var scValidHtml = '<!DOCTYPE html><html><body><script>'
    + 'var k=' + JSON.stringify(scMsgKey) + ';'
    + 'function s(m){if(!k)return m;var p=JSON.stringify(m)+"|"+k;var h=0;'
    + 'for(var i=0;i<p.length;i++){h=((h<<5)-h)+p.charCodeAt(i);h|=0;}'
    + 'm._sig=h.toString(36);return m;}'
    + 'window.top.postMessage(s({type:"gas-session-valid"}), '
    + JSON.stringify(PARENT_ORIGIN) + ');'
    + '</' + 'script></body></html>';
  return HtmlService.createHtmlOutput(scValidHtml)
    .setTitle(TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

**Design decisions:**

1. **Unsigned eviction message** — when the session is gone, the `messageKey` is also gone (it was stored in the session data). The eviction message is therefore unsigned. This is acceptable because:
   - An attacker who can inject `gas-session-evicted` postMessages can only cause the user to see the "Session Active Elsewhere" overlay — a denial-of-service, not a privilege escalation
   - The legitimate eviction case (session invalidated by another sign-in) inherently cannot produce a signed message because the signing key was deleted with the session
   - The client-side handler should verify the message origin (`e.origin` check) to prevent cross-origin injection

2. **Signed validity message** — when the session is valid, the response IS signed with the session's message key. This prevents spoofing a "you're still valid" response that could mask an actual eviction

3. **Rate limiting at 60/5min** — supports a 5-second polling interval with ~50% headroom (12 checks/min × 5 min = 60). The heartbeat uses 20/5min, so the combined load is 80 cache operations per 5 minutes per user — well within GAS limits

4. **No session extension** — unlike heartbeat, the check does NOT reset `createdAt` or update `lastActivity`. It's pure observation — "does my session still exist?" This means:
   - Session check requests do not extend the session (only heartbeats do)
   - Session check requests do not count as user activity
   - If a user's session expires naturally (idle timeout), the session check correctly reports eviction

**Security considerations:**

- **Session enumeration risk:** the endpoint takes a session token and returns valid/evicted. An attacker would need a valid 48-character session token to probe — brute-force is infeasible (48 hex chars = 192 bits of entropy). The rate limiter adds further protection
- **Timing attack risk:** the response time differs slightly between "token found in cache" and "token not found" due to the JSON parse + message key extraction. This timing difference leaks at most 1 bit (exists/doesn't exist), which the response already explicitly reveals — no additional information is exposed
- **Origin restriction:** all postMessages target `PARENT_ORIGIN`, preventing cross-origin interception

### Phase 2: GAS — Add `ENABLE_SESSION_CHECK` to Auth Config

**Risk:** Low
**Files:** `testauthgas1.gs`
**What:** Add the toggle to both presets so the feature can be controlled server-side.

**Add to both `standard` and `hipaa` presets:**
```javascript
ENABLE_SESSION_CHECK: true,
SESSION_CHECK_INTERVAL: 5,    // seconds — how often clients poll for session validity
// SESSION_CHECK_INTERVAL: 10, // ⚡ PRODUCTION VALUE — uncomment and delete test value above
```

**Why in `AUTH_CONFIG`:**
- The interval should be configurable per-preset (HIPAA might want faster detection)
- The toggle allows disabling the feature without removing code
- The interval is needed both client-side (for the polling loop) and could be used server-side (for rate limit calculation)

**Pass to client in `gas-session-created` response:**
The `exchangeTokenForSession` result already returns `absoluteTimeout`. Add `sessionCheckInterval` to the response payload:

```javascript
return {
  success: true,
  sessionToken: sessionToken,
  email: userInfo.email,
  displayName: userInfo.displayName,
  absoluteTimeout: AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT || 0,
  messageKey: messageKey,
  sessionCheckInterval: AUTH_CONFIG.ENABLE_SESSION_CHECK ? AUTH_CONFIG.SESSION_CHECK_INTERVAL : 0
};
```

The client uses `sessionCheckInterval > 0` to determine whether to start polling. A value of `0` means disabled.

### Phase 3: Client — Add Session Check Polling

**Risk:** Medium (new polling loop — must handle lifecycle correctly)
**Files:** `testauthgas1.html`
**What:** Add a new `startSessionCheck()` / `stopSessionCheck()` pair and wire it into the auth lifecycle.

#### 3a. New HTML_CONFIG toggle

```javascript
// Cross-device session enforcement via GAS polling.
// When enabled, the client periodically checks with the server whether its
// session is still valid. If another device signs in with the same account,
// the old session is invalidated server-side and this check detects it.
CROSS_DEVICE_SESSION_CHECK: true,
SESSION_CHECK_INTERVAL: 5  // seconds (test value — production: 10-15)
```

**Why a separate toggle from `SINGLE_TAB_ENFORCEMENT`:**
- `SINGLE_TAB_ENFORCEMENT` = same-browser, BroadcastChannel, instant, no server calls
- `CROSS_DEVICE_SESSION_CHECK` = cross-device, GAS polling, 5-10 second latency, requires server calls
- A deployment might want one without the other (e.g., cross-device enforcement on but same-browser tabs allowed for side-by-side workflow)

#### 3b. Allowed message types

Add to the `ALLOWED_GAS_MESSAGES` object:
```javascript
'gas-session-valid': true,
'gas-session-evicted': true,
'gas-session-check-error': true,
```

#### 3c. Session check state variables

```javascript
var _sessionCheckInterval = null;
var _sessionCheckInFlight = false;
```

#### 3d. `startSessionCheck()` function

```javascript
function startSessionCheck() {
  if (!HTML_CONFIG.CROSS_DEVICE_SESSION_CHECK) return;
  if (_sessionCheckInterval) return;  // already running

  var interval = (HTML_CONFIG.SESSION_CHECK_INTERVAL || 5) * 1000;

  _sessionCheckInterval = setInterval(function() {
    if (_sessionCheckInFlight) return;  // don't stack requests
    if (_tabSurrendered) return;        // already evicted by BroadcastChannel

    var session = loadSession();
    if (!session.token) return;         // not signed in

    var gasApp = document.getElementById('gas-app');
    var baseUrl = window._r || (gasApp && gasApp.dataset.baseUrl) || '';
    if (!baseUrl) return;

    _sessionCheckInFlight = true;

    var checkFrame = document.getElementById('gas-session-check');
    if (!checkFrame) {
      checkFrame = document.createElement('iframe');
      checkFrame.id = 'gas-session-check';
      checkFrame.style.cssText = 'display:none;width:0;height:0;border:0';
      document.body.appendChild(checkFrame);
    }
    checkFrame.src = baseUrl + '?check=' + encodeURIComponent(session.token)
      + '&msgKey=' + encodeURIComponent(_messageKey || '');
  }, interval);
}
```

**Design notes:**
- Uses a **separate hidden iframe** (`gas-session-check`) from the heartbeat iframe (`gas-heartbeat`) and the main GAS app iframe (`gas-app`). This prevents the session check from interfering with either
- `_tabSurrendered` check prevents polling after BroadcastChannel already evicted this tab — no point checking server if we already know
- The iframe is created once and reused (src is overwritten each poll). This avoids DOM bloat from creating new iframes every 5 seconds
- `_sessionCheckInFlight` prevents request stacking if GAS is slow to respond (cold start could take 4-15 seconds)

#### 3e. `stopSessionCheck()` function

```javascript
function stopSessionCheck() {
  if (_sessionCheckInterval) {
    clearInterval(_sessionCheckInterval);
    _sessionCheckInterval = null;
  }
  _sessionCheckInFlight = false;
  var checkFrame = document.getElementById('gas-session-check');
  if (checkFrame) checkFrame.remove();
}
```

#### 3f. Message handlers for session check responses

Add to the existing `window.addEventListener('message', ...)` handler:

```javascript
// Cross-device session check — session still valid
if (data.type === 'gas-session-valid') {
  _sessionCheckInFlight = false;
  // No action needed — session is still valid on the server
}

// Cross-device session check — session was evicted (another device signed in)
if (data.type === 'gas-session-evicted') {
  _sessionCheckInFlight = false;
  stopSessionCheck();
  stopCountdownTimers();
  stopHeartbeat();
  hideAllWarningBanners();

  // Mark as surrendered so BroadcastChannel doesn't also fire
  _tabSurrendered = true;

  // Show the same overlay as same-browser tab eviction
  document.getElementById('tab-takeover-wall').style.display = 'flex';
}

// Cross-device session check — rate limited (too many checks)
if (data.type === 'gas-session-check-error') {
  _sessionCheckInFlight = false;
  // Back off — stop the check and let heartbeat handle normal expiry
  stopSessionCheck();
}
```

**Critical design decision — unsigned eviction message handling:**

The `gas-session-evicted` message is unsigned (the signing key was deleted with the session). This creates a potential spoofing vector where a malicious page in another tab could postMessage `{type: 'gas-session-evicted'}` to trigger the overlay.

**Mitigation:** the existing `message` event handler already checks `e.origin` against the expected GAS origins. The eviction message comes from the GAS iframe (either `script.google.com` or `*.googleusercontent.com`), which an attacker cannot spoof the origin of. The origin check is sufficient protection.

**Additional consideration:** verify that the eviction message actually came from the `gas-session-check` iframe, not injected from elsewhere. This can be done by checking `e.source`:
```javascript
if (data.type === 'gas-session-evicted') {
  // Verify source is our session check iframe (not a spoofed message)
  var checkFrame = document.getElementById('gas-session-check');
  if (!checkFrame || e.source !== checkFrame.contentWindow) return;
  // ... rest of handler
}
```

### Phase 4: Client — Lifecycle Wiring

**Risk:** Low
**Files:** `testauthgas1.html`
**What:** Call `startSessionCheck()` and `stopSessionCheck()` at the right lifecycle points.

#### 4a. Start session check after successful sign-in

In the `gas-session-created` handler (where `startHeartbeat()` and `broadcastTabClaim()` are already called):

```javascript
// After: startHeartbeat();
// After: broadcastTabClaim();
startSessionCheck();
```

#### 4b. Stop session check on sign-out

In `performSignOut()` (where `stopHeartbeat()` is already called):

```javascript
// After: stopHeartbeat();
stopSessionCheck();
```

#### 4c. Stop session check when tab is surrendered (BroadcastChannel)

In the `tab-claim` handler (where `stopHeartbeat()` is already called):

```javascript
// After: stopHeartbeat();
stopSessionCheck();
```

#### 4d. Restart session check on "Use Here" button

In the `tab-use-here-btn` click handler, the behavior must differ depending on **why** the tab was surrendered:

- **BroadcastChannel eviction (same browser):** the server session is still valid — reclaim locally (existing behavior)
- **Cross-device eviction (server-side invalidation):** the server session is gone — must re-authenticate

**How to distinguish:** add a flag `_evictedByServer` that is set to `true` when `gas-session-evicted` fires and `false` when `tab-claim` fires:

```javascript
var _evictedByServer = false;

// In gas-session-evicted handler:
_evictedByServer = true;

// In tab-claim BroadcastChannel handler:
_evictedByServer = false;
```

**Modified "Use Here" button handler:**

```javascript
document.getElementById('tab-use-here-btn').addEventListener('click', function() {
  _tabSurrendered = false;
  document.getElementById('tab-takeover-wall').style.display = 'none';

  if (_evictedByServer) {
    // Cross-device eviction — server session is gone, must re-auth
    _evictedByServer = false;
    _messageKey = null;  // Clear old signing key
    clearSession();      // Clear local session data
    attemptReauth();     // Trigger OAuth flow
    return;
  }

  // Same-browser eviction — session still valid, reclaim locally
  if (!HTML_CONFIG.SINGLE_TAB_ENFORCEMENT) return;
  var session = loadSession();
  if (session.token) {
    showApp(session.email);
    startCountdownTimers();
    startHeartbeat();
    startSessionCheck();
    var gasApp = document.getElementById('gas-app');
    var baseUrl = window._r || (gasApp && gasApp.dataset.baseUrl) || '';
    if (gasApp && baseUrl) {
      _expectingSession = true;
      gasApp.src = baseUrl + '?session=' + encodeURIComponent(session.token);
    }
  } else {
    showAuthWall();
  }
  broadcastTabClaim();
});
```

#### 4e. Restart session check on page show (bfcache)

In the existing `pageshow` handler:

```javascript
window.addEventListener('pageshow', function(e) {
  if (e.persisted && HTML_CONFIG.SINGLE_TAB_ENFORCEMENT && !_tabSurrendered) {
    broadcastTabClaim();
  }
  // Restart session check if it was stopped (e.g., by background tab cleanup)
  if (e.persisted && HTML_CONFIG.CROSS_DEVICE_SESSION_CHECK && !_tabSurrendered) {
    startSessionCheck();
  }
});
```

#### 4f. Start session check on page load (existing session)

In the initialization flow where the page loads with an existing session (the block that calls `startHeartbeat()` and `broadcastTabClaim()` at page load):

```javascript
// After: startHeartbeat();
// After: broadcastTabClaim();
startSessionCheck();
```

### Phase 5: Overlay Text Update

**Risk:** Low
**Files:** `testauthgas1.html`
**What:** Update the overlay text to be accurate for cross-device eviction.

The current overlay says "This session is active in another tab." For cross-device eviction, it should say "This session is active on another device." The text should be dynamic based on the eviction source.

**Approach:** update the overlay text when showing it:

```javascript
// In gas-session-evicted handler:
document.getElementById('tab-takeover-wall').querySelector('p').textContent =
  'This session was started on another device or browser. Only one session can be active at a time.';
document.getElementById('tab-use-here-btn').textContent = 'Sign In Here';

// In tab-claim BroadcastChannel handler:
document.getElementById('tab-takeover-wall').querySelector('p').textContent =
  'This session is active in another tab. Only one tab can be active at a time.';
document.getElementById('tab-use-here-btn').textContent = 'Use Here';
```

**Why different button text:** "Use Here" makes sense for same-browser (instant local reclaim). "Sign In Here" makes sense for cross-device (re-authentication required).

### Phase 6: Security Test Addition

**Risk:** Low
**Files:** `testauthgas1.html`
**What:** Add a security test to verify the cross-device session check infrastructure exists.

Add a test similar to the existing single-tab enforcement test (Test 35). The test should verify:
- `HTML_CONFIG.CROSS_DEVICE_SESSION_CHECK` toggle exists (boolean)
- `HTML_CONFIG.SESSION_CHECK_INTERVAL` exists (number > 0)
- `startSessionCheck` function exists
- `stopSessionCheck` function exists
- `gas-session-valid` and `gas-session-evicted` are in `ALLOWED_GAS_MESSAGES`

---

## Browser Background Tab Throttling Analysis

**The concern:** if the old device's tab is in the background, Chrome throttles `setInterval` to once per minute after 5 minutes of inactivity.

**Why this is acceptable:**

1. **The primary use case is the foreground device.** The new device (where the user just signed in) is the one they're actively using. The old device is typically either:
   - Abandoned (left at a previous workstation) — the user doesn't care about instant eviction there
   - In the background — eviction within 60 seconds is still far better than waiting for the 5-minute production heartbeat

2. **When the user returns to the old tab, throttling lifts.** If they switch back to the old device's tab, Chrome immediately restores normal timer intervals. The next session check fires within 5 seconds and shows the overlay.

3. **Audio workaround (not recommended):** playing silent audio prevents Chrome from applying heavy throttling. This is the technique used by some real-time apps. However, it's invasive and not appropriate for an EMR tool. We should not implement this.

4. **Web Worker alternative (future consideration):** a Web Worker's `setInterval` is **not throttled** by background tab rules. If sub-minute background eviction is ever required, the session check timer could be moved to a Web Worker that communicates with the main thread via `postMessage`. This is a future enhancement, not needed for initial implementation.

**Summary:** background tab throttling degrades the session check from ~5s to ~60s detection time. This is an acceptable tradeoff. No workaround is needed for the initial implementation.

---

## GAS Performance and Quota Analysis

### Cold Start Impact

GAS web app `doGet` cold starts take 4-15 seconds. This affects the session check in two ways:

1. **First check after sign-in may be slow.** If the GAS runtime hasn't been invoked recently, the first session check could take 4-15 seconds. This is fine — the `_sessionCheckInFlight` flag prevents stacking, and the next check fires after the interval.

2. **After the heartbeat warms the runtime, checks are fast.** The heartbeat fires every 30 seconds (test), keeping the GAS runtime warm. Session check calls piggyback on this warm state. A single `CacheService.get()` call takes <100ms in a warm runtime.

### Quota Math

**Per-user load (test timers — 5s session check, 30s heartbeat):**
- Session checks: 12/minute
- Heartbeats: 2/minute (activity-dependent)
- Total: ~14 GAS invocations/minute/user

**Per-user load (production timers — 10s session check, 5min heartbeat):**
- Session checks: 6/minute
- Heartbeats: 0.2/minute
- Total: ~6.2 GAS invocations/minute/user

**Scaling estimate (production, 10 concurrent users):**
- Total: ~62 GAS invocations/minute = ~3,720/hour = ~89,280/day
- Google Workspace daily execution limit: ~20,000 (consumer) / no documented limit (paid Workspace)
- **Consumer accounts would hit limits at ~5 concurrent users with 10s polling**
- **Workspace accounts are safe up to much higher concurrency**

**Mitigation for consumer accounts:**
- Increase `SESSION_CHECK_INTERVAL` to 15-30 seconds (reduces to ~2-4 invocations/min/user)
- Document the quota implications in the toggle description
- Consider making the session check piggyback on the heartbeat response instead of a separate call (see "Alternatives Considered" below)

---

## Alternatives Considered

### Alternative A: Piggyback on heartbeat response

**What:** instead of a separate session check, add a `currentSessionId` field to the heartbeat response. The client compares it against its own session token.

**Why rejected:**
- Heartbeat is activity-gated — it only fires when the user has been active. An idle device wouldn't discover eviction until it resumes activity
- Heartbeat runs at 30s (test) / 5min (production) — too slow for near-instant cross-device eviction
- Heartbeat extends the session (writes to cache) — the check should be read-only

**However:** this is a valid **complementary** approach for production deployments concerned about GAS quotas. A future enhancement could have the heartbeat response also carry a session validity flag as a backup, reducing the need for frequent dedicated checks. Both approaches are compatible and could coexist.

### Alternative B: Firebase Realtime Database

**What:** use Firebase RTDB as a real-time session registry. Instant eviction via `onValue` listener.

**Why rejected:** violates Constraint A (no external dependencies). The template must be self-contained. Firebase would require:
- A Firebase project
- Firebase SDK in the HTML page
- Firebase security rules
- A Firebase API key in the client-side code

This is the technically superior solution for real-time eviction, but the deployment complexity makes it unsuitable for the template.

### Alternative C: Long polling via `google.script.run`

**What:** use `google.script.run` from within the GAS app iframe to call a server function that blocks until the session is invalidated (or times out after N seconds).

**Why rejected:**
- GAS has a 6-minute execution time limit — long polling would consume execution quota
- `google.script.run` runs in the GAS iframe context, not the parent page — the result would need to be relayed via postMessage, adding complexity
- If the GAS iframe is reloaded (heartbeat, page load), the long-polling connection is lost

### Alternative D: localStorage/sessionStorage cross-tab polling

**What:** use `storage` event listeners instead of BroadcastChannel for same-browser enforcement.

**Why not applicable:** `storage` events are same-origin, same-browser only — they don't solve the cross-device problem. BroadcastChannel already handles same-browser. This alternative is irrelevant to the cross-device goal.

---

## Implementation Order

**Recommended sequence:** Phases 1 → 2 → 3 → 4 → 5 → 6

All phases can be implemented in a single commit. There are no rollback boundaries needed — the feature is entirely toggleable. Setting `CROSS_DEVICE_SESSION_CHECK: false` disables all polling without removing code.

**Dependencies:**
- Phase 3 depends on Phase 1 (client expects GAS to handle `?check=` parameter)
- Phase 4 depends on Phase 3 (lifecycle wiring calls functions defined in Phase 3)
- Phase 5 depends on Phase 4 (overlay text updates are in the same handlers)
- Phase 6 depends on Phase 3 (tests verify functions from Phase 3)

---

## Testing Checklist

### Manual Testing

- [ ] **Basic eviction:** Sign in on Device A. Sign in on Device B (same account). Device A should show "Session Active Elsewhere" overlay within ~5 seconds
- [ ] **"Sign In Here" button:** Click "Sign In Here" on Device A after cross-device eviction. Should trigger OAuth flow and re-authenticate
- [ ] **Same-browser tab claim still works:** Open two tabs. Second tab should claim session instantly via BroadcastChannel (not waiting for polling)
- [ ] **"Use Here" button (same browser):** After same-browser eviction, "Use Here" should reclaim locally without re-auth
- [ ] **Overlay text correctness:** Cross-device eviction shows "another device or browser" text. Same-browser eviction shows "another tab" text
- [ ] **Session expiry vs eviction:** Let session expire naturally (idle). Should show normal "Session expired" auth wall, NOT the "Session Active Elsewhere" overlay
- [ ] **Sign out stops polling:** Sign out. Verify no more `?check=` iframe requests in Network tab
- [ ] **Rate limit recovery:** Rapidly reload the page to trigger rate limiting. Verify `gas-session-check-error` is handled gracefully (polling stops, no error visible to user)
- [ ] **Toggle off:** Set `CROSS_DEVICE_SESSION_CHECK: false`. Verify no `?check=` requests are made
- [ ] **Background tab behavior:** Move Device A's tab to background. Wait 5+ minutes. Sign in on Device B. Return to Device A's tab. Overlay should appear within seconds of returning

### Security Tests

- [ ] **Run the security test suite.** New test for cross-device session check should pass
- [ ] **Verify unsigned eviction can't be spoofed:** Open DevTools console on the parent page. Try `window.postMessage({type: 'gas-session-evicted'}, '*')`. Should be rejected (origin check / source check)
- [ ] **Verify signed validity can't be spoofed:** Try posting `{type: 'gas-session-valid'}` without a valid `_sig`. Should be rejected by HMAC verification

---

## What This Plan Does NOT Address

1. **Real-time eviction (<1 second)** — the polling approach has a minimum latency of `SESSION_CHECK_INTERVAL` seconds. True real-time would require Firebase RTDB or WebSockets, which violate the self-contained constraint
2. **Multiple concurrent sessions (intentional)** — some workflows may want the user to have 2 sessions (e.g., one for charting, one for orders). This plan enforces single-session only. A future `MAX_CONCURRENT_SESSIONS` setting would be a separate feature
3. **Cross-tab session transfer** — the plan doesn't support "move this session to the other tab without re-auth." Each eviction requires either local reclaim (same browser) or re-auth (cross-device)
4. **Graceful session handoff notification on the new device** — the new device doesn't know it kicked out an old session. A future enhancement could show a brief "Signed out of 1 other device" toast on the new device
5. **GAS quota monitoring** — no built-in monitoring for approaching quota limits. A future enhancement could track invocation counts in CacheService and warn when approaching limits

---

## Template Propagation Notes

When propagating this feature to the auth template (`HtmlAndGasTemplateAutoUpdate-auth.html.txt`) and other pages:

1. **HTML_CONFIG toggles** (`CROSS_DEVICE_SESSION_CHECK`, `SESSION_CHECK_INTERVAL`) should be added to the template with sensible defaults (`true`, `10` for production)
2. **GAS template** should include the `checkSession` action in `doGet` and the `ENABLE_SESSION_CHECK` / `SESSION_CHECK_INTERVAL` in both presets
3. **The overlay already exists** in the template (via single-tab enforcement propagation). The cross-device handlers are additive — they wire into the same overlay
4. **Check for PROJECT OVERRIDE markers** in the existing overlay code before propagating

---

Developed by: LightAISolutions

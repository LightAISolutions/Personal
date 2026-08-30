# Security Update Plan — testauthgas1 Environment

**Created:** 2026-03-13
**Status:** Implemented (v02.90r–v02.91r)
**Scope:** `testauthgas1.gs` + `testauthgas1.html` (if successful, propagate to templates)
**Base version:** v02.74r state (v01.14g GAS / v01.26w HTML)
**Reference:** `06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md`

---

## Why This Document Exists

This is the **third attempt** at security hardening for testauthgas1. The previous two attempts (v02.75r–v02.84r) were fully reverted because they broke critical functionality:

1. **v02.79r broke the GAS auto-deploy pipeline** — a `DEPLOY_SECRET` check was added to `doPost(action=deploy)`, which silently blocked all automatic code updates from GitHub. This caused the live GAS to be **permanently stuck at v01.15g** — every subsequent GAS-side fix (v02.80r, v02.82r) never reached the live environment
2. **v02.75r–v02.84r broke Google Sign-In** — origin validation, CSP, and a PARENT_ORIGIN case mismatch caused the sign-in flow to get stuck on the "Sign In Required" page with no errors. The case mismatch (`ShadowAISolutions` vs browser-normalized `shadowaisolutions`) silently dropped all GAS→parent postMessages from v02.79r onward, and the fix (`.toLowerCase()`) never deployed because auto-deploy was already broken

**Key insight from post-mortem:** Several "lessons" from v02.80r–v02.84r were drawn from a state where the HTML and GAS were **desynchronized** — HTML changes deployed via GitHub Pages, but GAS remained frozen at v01.15g. This plan corrects those false conclusions (see "Corrected root cause analysis" below).

This plan is designed from the ground up with those failure modes as hard constraints.

---

## Hard Constraints (MUST NOT violate)

### Constraint A: Never Touch the Deploy Handler

The `doPost(action=deploy)` handler in the `.gs` file **must remain completely unauthenticated**. Do not add:
- Secret/token checks
- Origin validation
- IP allowlisting
- Any conditional logic before `pullAndDeployFromGitHub()`

The GitHub Actions workflow calls this endpoint via webhook. Adding any guard silently breaks auto-updates — the workflow gets "Unauthorized" and the GAS script never pulls new code. There is a protective `⚠️ CRITICAL` comment block already in the code — leave it untouched.

**The deploy action only calls `pullAndDeployFromGitHub()` which overwrites the script with whatever is on GitHub (the source of truth), so there is no abuse vector to protect against.**

### Constraint B: Never Break Google Sign-In Flow

The sign-in flow must work end-to-end without getting stuck. The complete flow is:

```
User clicks "Sign In with Google"
  → google.accounts.oauth2.initTokenClient() with prompt: 'select_account'
  → User selects Google account in popup
  → handleTokenResponse() receives access_token
  → exchangeToken(access_token) called
  → [URL mode] iframe.src = baseUrl + '?exchangeToken=' + token
  → GAS doGet() receives token, calls exchangeTokenForSession()
  → GAS returns HTML with postMessage({type:"gas-session-created", sessionToken:...})
  → Parent window receives message
  → saveSession() stores token in localStorage
  → iframe.src = baseUrl + '?session=' + sessionToken
  → GAS validates session, returns app HTML with postMessage({type:"gas-auth-ok"})
  → Auth wall hidden, app visible
```

**Every change must preserve this entire chain.** If any link breaks, the user gets stuck on "Sign In Required" with no indication of what went wrong.

---

## Lessons from Previous Failures (v02.75r–v02.84r)

### Critical context: GAS was stuck at v01.15g

The GAS auto-deploy mechanism (`pullAndDeployFromGitHub()`) compares the fetched VERSION against the running VERSION — if they match, it returns "Already up to date" and does **not** update. This is crucial for understanding which "fixes" were actually tested live.

**Deploy timeline:**

| Version | GAS VERSION | Actually deployed? | Why |
|---------|------------|-------------------|-----|
| v02.74r (base) | v01.13g | — | Starting state |
| v02.75r | v01.14g | **YES** | Old v01.13g code had no deploy guard — webhook succeeded |
| v02.76r | v01.14g (no GAS changes) | N/A | HTML-only fix |
| v02.77r | v01.14g (no GAS changes) | N/A | HTML-only fix |
| v02.79r | v01.15g | **YES** | Old v01.14g code had no deploy guard — but v01.15g itself added `DEPLOY_SECRET` which **bricked all future deploys** |
| v02.80r | v01.15g (VERSION NOT BUMPED despite code change) | **NO** | Version not bumped (so even without the broken handler, `pullAndDeployFromGitHub` would have said "Already up to date") AND deploy handler already broken |
| v02.81r | v01.15g (no GAS changes) | N/A | HTML-only fix |
| v02.82r | v01.16g | **NO** | Deploy handler still broken at v01.15g — webhook returns "Unauthorized" |
| v02.83r | v01.16g (no GAS changes) | N/A | HTML-only fix |
| v02.84r | v01.16g (no GAS changes) | N/A | HTML-only fix |

**Consequence:** From v02.79r onward, the live GAS was **permanently stuck at v01.15g**. Every subsequent GAS-side "fix" (v02.80r's `.toLowerCase()` for PARENT_ORIGIN, v02.82r's TOKEN_EXCHANGE_METHOD revert to 'url') **never reached the live environment**. Only HTML-side changes (deployed via GitHub Pages) were actually tested live after v02.79r.

This means several "lessons" from the previous attempts were drawn from a state where the HTML and GAS were **out of sync** — the HTML was being updated but the GAS was frozen at v01.15g.

### What was tried and what broke

| Version | What was done | What broke | Root cause | Actually deployed? |
|---------|--------------|------------|------------|-------------------|
| v02.75r | Added `if (event.origin !== GAS_ORIGIN) return;` where `GAS_ORIGIN = 'https://script.google.com'` (HTML-side) | All postMessages silently dropped — sign-in never completed | GAS HtmlService does NOT serve from `script.google.com`. It serves from a **sandbox subdomain** like `n-{hash}.script.googleusercontent.com`. The origin is NOT `script.google.com` | HTML: yes (GitHub Pages). GAS v01.14g: yes (deployed) |
| v02.76r | Switched to `event.source !== gasApp.contentWindow` (HTML-side) | Still broken — messages still dropped | GAS double-wraps iframes. The `contentWindow` of the visible iframe is Google's wrapper, not the actual HTML content. `event.source` doesn't match `gasApp.contentWindow` because there's an inner sandbox iframe | HTML: yes. GAS: no changes |
| v02.77r | Switched to message-type allowlist — no origin/source check (HTML-side) | Worked for auth but was incomplete security | Allowlist approach only prevents processing unknown message types — any origin can still send known message types. Partial fix only | HTML: yes. GAS: no changes |
| v02.79r | Added `DEPLOY_SECRET` check to `doPost(action=deploy)` (GAS-side) | GAS auto-deploy silently stopped working | `!expectedSecret` is true when no secret is configured → returns "Unauthorized" for all deploy calls | GAS v01.15g: yes (this is the version that got stuck) |
| v02.79r | Changed `TOKEN_EXCHANGE_METHOD` to `'postMessage'` + added `PARENT_ORIGIN` without `.toLowerCase()` (GAS-side) | Sign-in broken — all GAS→parent postMessages silently dropped | `PARENT_ORIGIN` resolved to `https://ShadowAISolutions.github.io` (mixed case from EMBED_PAGE_URL) but browsers normalize origins to lowercase `https://shadowaisolutions.github.io`. The browser rejects `postMessage(data, targetOrigin)` when `targetOrigin` doesn't match the actual origin — messages were silently discarded | GAS v01.15g: yes — **and this case mismatch was never fixed on the live GAS** |
| v02.80r | Fixed PARENT_ORIGIN case mismatch with `.toLowerCase()` (GAS-side); relaxed CSP (HTML-side) | **GAS fix never deployed** — GAS remained stuck at v01.15g with wrong-case PARENT_ORIGIN. HTML CSP relaxation deployed but GAS→parent messages still dropped | GAS deploy was already broken. The `.toLowerCase()` fix never reached the live environment | HTML: yes. **GAS: NO** — version not even bumped |
| v02.82r | Reverted `TOKEN_EXCHANGE_METHOD` to `'url'` in GAS code | **GAS revert never deployed** — live GAS still had `TOKEN_EXCHANGE_METHOD = 'postMessage'`. HTML expected URL exchange but GAS was still serving postMessage exchange | GAS deploy was broken. The HTML and GAS were now **desynchronized** — HTML sending token via URL, GAS expecting postMessage | HTML: yes. **GAS: NO** |
| v02.83r | Removed CSP meta tag entirely (HTML-side) | CSP was blocking Google Sign-In scripts | The CSP didn't include all the origins Google Sign-In needs (multiple Google domains, dynamic script loading, popup window communication) | HTML: yes. GAS: no changes |
| v02.84r | Fixed origin validation regex for multi-level subdomains (HTML-side) | Sign-in still stuck — even with correct HTML-side validation, GAS was still sending all postMessages to wrong-case PARENT_ORIGIN, so nothing was received | The GAS was frozen at v01.15g. No HTML-side fix could compensate for the GAS-side case mismatch | HTML: yes. GAS: no changes |

### Corrected root cause analysis

The persistent sign-in failure from v02.79r onward had **two independent causes**, and the second was never resolved live:

1. **HTML-side origin/source validation** (v02.75r–v02.77r) — adding `event.origin` or `event.source` checks on the receiving side. These were correctly identified and resolved (switched to message-type allowlist in v02.77r). **Lesson is valid.**

2. **GAS-side PARENT_ORIGIN case mismatch** (v02.79r onward) — `PARENT_ORIGIN` was derived from `EMBED_PAGE_URL` without `.toLowerCase()`, producing `https://ShadowAISolutions.github.io` instead of `https://shadowaisolutions.github.io`. The browser's `postMessage(data, targetOrigin)` API silently drops messages when `targetOrigin` doesn't match the recipient's actual origin (case-sensitive). **This was the real reason sign-in remained broken after v02.79r.** The fix (`.toLowerCase()`) was written in v02.80r but never deployed because the auto-deploy pipeline was already broken.

### What the "stuck GAS" means for this plan

- **PARENT_ORIGIN is a valid and good approach** — it just needs `.toLowerCase()`. The v02.79r implementation of PARENT_ORIGIN was conceptually correct (restrict who receives messages) but had a case-sensitivity bug that was never fixed live
- **TOKEN_EXCHANGE_METHOD = 'postMessage' was never properly tested** — it was deployed alongside the broken PARENT_ORIGIN, so all its postMessages were silently dropped. We cannot conclude that postMessage exchange "doesn't work." However, URL exchange works reliably and is simpler, so this plan keeps it as 'url' for pragmatic reasons (not because postMessage was proven to fail)
- **escapeHtml/escapeJs helpers worked correctly** — they deployed in v02.79r and did not contribute to any breakage. Safe to re-implement
- **Error message sanitization worked correctly** — deployed in v02.79r, no issues. Safe to re-implement
- **ABSOLUTE_SESSION_TIMEOUT reduction to 21600** — this deployed in v02.79r and did not cause issues by itself. However, the 57600 value is safe because heartbeats re-put session data (resetting the CacheService TTL), so the 6-hour CacheService limit is never actually reached

### Key architectural insight

**GAS iframe origin is NOT predictable or stable.** GAS HtmlService wraps your HTML in a sandbox iframe served from a URL like:

```
https://n-{long-hash}.script.googleusercontent.com/userCodeAppPanel
```

The exact subdomain format:
- Is determined by Google at runtime
- Has changed format in the past (was `script.googleusercontent.com`, then added the `n-` prefix hash)
- Could change again without notice
- Varies between deployments

**This means `event.origin` validation against a hardcoded origin string or even a regex is fundamentally fragile.** The v02.84r regex (`/^https:\/\/[a-z0-9.-]+\.google(usercontent|apis)?\.com$/`) was the best attempt but is still a game of whack-a-mole against Google's internal infrastructure decisions.

---

## Implementation Strategy: Defense-in-Depth Without Fragile Origin Checks

Instead of relying on origin validation (which broke twice), this plan uses a **multi-layer defense strategy** where each layer is independently robust:

### Layer 1: Message-Type Allowlist (HTML side)
Only process known GAS message types. Rejects arbitrary messages regardless of origin.

### Layer 2: Cryptographic Message Authentication (NEW — GAS side)
GAS signs its outgoing postMessages with a per-session HMAC. The parent validates the signature before processing. This replaces origin validation with something that actually works across the GAS sandbox boundary.

### Layer 3: XSS Prevention (GAS side)
Escape all user-controlled values in GAS-generated HTML to prevent injection.

### Layer 4: Session Hardening (GAS side)
Expand HMAC coverage, remove stored OAuth tokens, fix OAuth revocation.

### Layer 5: Debug Cleanup (both sides)
Remove all debug console.log statements from production code.

### Layer 6: Error Message Sanitization (GAS side)
Return generic error codes to the client, log details server-side only.

**Deliberately NOT included:**
- ~~CSP meta tag~~ — broke Google Sign-In in v02.83r. GAS iframe architecture requires whitelisting so many Google domains that the CSP provides negligible value. Security is enforced at the message level instead
- ~~Origin validation via `event.origin`~~ — broke sign-in in v02.75r. GAS sandbox URLs are unpredictable
- ~~`event.source` validation~~ — broke in v02.76r. GAS double-wraps iframes
- ~~Deploy handler authentication~~ — broke auto-deploy in v02.79r. No security benefit
- ~~Switching standard preset to postMessage exchange~~ — tried in v02.79r but never properly tested (PARENT_ORIGIN case mismatch broke all messages; the v02.82r revert never deployed). URL exchange works reliably and is simpler. The token is a short-lived Google OAuth token that GAS validates server-side immediately

---

## Phase 1: Message-Type Allowlist + Cryptographic Message Authentication

**Files:** `testauthgas1.gs`, `testauthgas1.html`
**Risk:** LOW — does not change the message flow, only adds validation

### 1A. Message-Type Allowlist (HTML side — `testauthgas1.html`)

**What:** Replace the bare `window.addEventListener('message', ...)` with a guarded listener that only processes known GAS message types.

**Where:** `testauthgas1.html` line 997

**Current code:**
```javascript
window.addEventListener('message', function(event) {
  var data = event.data;
  if (!data || typeof data !== 'object') return;
  console.log('[AUTH DEBUG] postMessage received:', data.type, JSON.stringify(data).substring(0, 200));

  // ... processes all message types from any origin
```

**New code:**
```javascript
// Security: only process known GAS message types (allowlist)
var _KNOWN_GAS_MESSAGES = {
  'gas-ready-for-token': true,
  'gas-session-created': true,
  'gas-needs-auth': true,
  'gas-auth-ok': true,
  'gas-heartbeat-ok': true,
  'gas-heartbeat-expired': true,
  'gas-signed-out': true,
  'gas-version': true
};

window.addEventListener('message', function(event) {
  var data = event.data;
  if (!data || typeof data !== 'object') return;
  if (!_KNOWN_GAS_MESSAGES[data.type]) return;  // Reject unknown message types

  // ... rest of handler unchanged
```

**Why this is safe:**
- Does not check `event.origin` (which broke before)
- Does not check `event.source` (which broke before)
- Simply ignores any message whose `type` is not in the allowlist
- An attacker would need to know the exact message type AND format to spoof a message — addressed by Layer 2

**Testing:** After implementing, verify:
- [ ] Sign-in flow completes end-to-end
- [ ] Session resume on page reload works
- [ ] Heartbeat extends session
- [ ] Sign-out works
- [ ] Session expiration shows auth wall

### 1B. Cryptographic Message Authentication (GAS side → HTML side)

**What:** GAS generates a per-session HMAC key and includes a signature in every postMessage. The HTML parent validates the signature before processing security-sensitive messages.

**Why this replaces origin validation:** Origin validation answers "who sent this?" — but the answer is unreliable because GAS sandbox URLs are unpredictable. Message authentication answers "was this produced by our GAS code?" — which is verifiable regardless of what origin Google's sandbox uses.

**How it works:**

1. When a session is created in `exchangeTokenForSession()`, generate a random message signing key and include it in the session response:
   ```javascript
   // In exchangeTokenForSession() — GAS side
   var messageKey = Utilities.getUuid().replace(/-/g, '');
   // Store in session data (server-side only)
   sessionData.messageKey = messageKey;
   // Send to parent in the session-created response
   return {
     success: true,
     sessionToken: sessionToken,
     email: userInfo.email,
     displayName: userInfo.displayName,
     absoluteTimeout: AUTH_CONFIG.ABSOLUTE_SESSION_TIMEOUT || 0,
     messageKey: messageKey  // Client stores this for signature verification
   };
   ```

2. GAS signs every outgoing postMessage with this key using a simple HMAC:
   ```javascript
   // In every GAS-generated HTML response that uses postMessage
   // The messageKey is embedded in the GAS HTML at render time
   var msgKey = '${sessionData.messageKey || ""}';
   function signMessage(msg) {
     // Simple hash: HMAC-like construction using the shared key
     // We can't use Web Crypto in GAS-generated inline scripts easily,
     // so we use a simpler but still effective approach:
     var payload = JSON.stringify(msg) + '|' + msgKey;
     var hash = 0;
     for (var i = 0; i < payload.length; i++) {
       var chr = payload.charCodeAt(i);
       hash = ((hash << 5) - hash) + chr;
       hash |= 0; // Convert to 32bit integer
     }
     msg._sig = hash.toString(36);
     return msg;
   }
   window.top.postMessage(signMessage({type: 'gas-auth-ok', ...}), '*');
   ```

3. HTML parent stores the `messageKey` from the session-created message and verifies subsequent messages:
   ```javascript
   // In the message listener — HTML side
   var _messageKey = null;

   window.addEventListener('message', function(event) {
     var data = event.data;
     if (!data || typeof data !== 'object') return;
     if (!_KNOWN_GAS_MESSAGES[data.type]) return;

     // The gas-session-created message delivers the key — trust it on first receipt
     // (the session token it contains is validated server-side on the next iframe load)
     if (data.type === 'gas-session-created' && data.success && data.messageKey) {
       _messageKey = data.messageKey;
     }

     // For all subsequent messages, verify the signature
     if (_messageKey && data.type !== 'gas-session-created') {
       if (!verifyMessageSignature(data, _messageKey)) return;  // Silently drop
     }

     // ... rest of handler
   });
   ```

**IMPORTANT DESIGN DECISION — Signature verification is OPTIONAL, not blocking:**

The `gas-session-created` message is the bootstrap moment — it delivers both the session token and the message key. We cannot verify this message's signature because we don't have the key yet. Instead, we trust it based on the allowlist (Layer 1) and the fact that the session token it contains is validated server-side when the iframe reloads with `?session=TOKEN`.

For all messages AFTER receiving the key:
- If `_messageKey` is set, verify the signature — drop messages that fail
- If `_messageKey` is not set (e.g., page just loaded, session resuming from localStorage), messages pass through with allowlist-only protection

This means the cryptographic layer is an **additional** defense, not the sole defense. The baseline is the message-type allowlist.

**Why NOT use Web Crypto API / SubtleCrypto:**

The GAS-generated HTML runs inside Google's sandbox iframe. While modern browsers support `crypto.subtle`, the GAS sandbox environment may restrict certain APIs. A simple hash function is more reliable across the GAS sandbox boundary. The threat model here is a third-party page sending crafted postMessages — even a simple keyed hash defeats this because the attacker doesn't have the per-session key.

**Messages that get signed (all GAS→parent postMessages):**
- `gas-session-created` — carries the key itself (signature not verified for this one)
- `gas-auth-ok` — signed
- `gas-needs-auth` — signed
- `gas-heartbeat-ok` — signed with the key embedded in the heartbeat iframe's HTML
- `gas-heartbeat-expired` — signed
- `gas-signed-out` — signed
- `gas-version` — this comes from `google.script.run` inside the app HTML, signed

**Heartbeat-specific consideration:**
The heartbeat uses a separate hidden iframe (`gas-heartbeat`). The main iframe's `messageKey` needs to be passed to the heartbeat iframe or the heartbeat messages won't have signatures. Two options:

- **Option A (simpler):** Include the `messageKey` in the heartbeat iframe URL as a parameter (e.g., `?heartbeat=TOKEN&msgKey=KEY`). The heartbeat response HTML will embed this key for signing its postMessage. Since the heartbeat URL is constructed by JavaScript (not visible to the user), and the key is per-session (changes on every login), URL parameter exposure is minimal risk.
- **Option B (no URL exposure):** Store the `messageKey` in a variable on the parent window and have the heartbeat iframe read it via `parent._messageKey`. This works because the heartbeat iframe and parent are same-origin in the browser's view (both served from Google's sandbox). **Wait — no, they're NOT same-origin.** The heartbeat iframe loads from `script.google.com` (GAS web app URL) and the parent is on `github.io`. Cross-origin access to `parent._messageKey` would be blocked.

**Decision: Use Option A** (pass messageKey as URL parameter to heartbeat iframe). The key is ephemeral (per-session), the URL is constructed by JS (not user-visible), and it avoids cross-origin issues.

**Heartbeat iframe URL construction change in `testauthgas1.html`:**
```javascript
// Current (around line 1417):
hbFrame.src = baseUrl + '?heartbeat=' + encodeURIComponent(session.token);

// New:
hbFrame.src = baseUrl + '?heartbeat=' + encodeURIComponent(session.token)
  + '&msgKey=' + encodeURIComponent(_messageKey || '');
```

**GAS heartbeat handler change in `testauthgas1.gs`:**
```javascript
// In doGet(), heartbeat section — read msgKey from URL params
var msgKey = (e && e.parameter && e.parameter.msgKey) || '';
// Include in the postMessage responses:
var hbOkHtml = '<!DOCTYPE html><html><body><script>'
  + 'var k=' + JSON.stringify(msgKey) + ';'
  + 'function s(m){var p=JSON.stringify(m)+"|"+k;var h=0;for(var i=0;i<p.length;i++){h=((h<<5)-h)+p.charCodeAt(i);h|=0;}m._sig=h.toString(36);return m;}'
  + 'window.top.postMessage(s({type:"gas-heartbeat-ok",expiresIn:' + AUTH_CONFIG.SESSION_EXPIRATION + '}), "*");'
  + '</script></body></html>';
```

**Testing for Phase 1:**
- [ ] Fresh sign-in: user clicks "Sign In with Google" → completes → app loads
- [ ] Page reload with existing session: app loads without re-authentication
- [ ] Heartbeat: session extends while user is active (check timer pill)
- [ ] Session expiry: after SESSION_EXPIRATION seconds of inactivity → auth wall appears
- [ ] Sign-out: clicking "Sign Out" → auth wall appears, session cleared
- [ ] Cross-tab: opening the same page in a new tab resumes session
- [ ] **Spoofed message test**: open browser console on a different tab, try `window.postMessage({type:'gas-auth-ok'}, '*')` → should be ignored (no `_sig` or wrong `_sig`)

---

## Phase 2: XSS Prevention (GAS side)

**Files:** `testauthgas1.gs`
**Risk:** LOW — only changes how values are interpolated into HTML strings, not the message flow

### 2A. Add Escape Helper Functions

**Where:** `testauthgas1.gs`, after the `AUTH START` comment block (around line 248)

**Add these functions:**
```javascript
// =============================================
// AUTH — HTML/JS Output Escaping (XSS Prevention)
// Prevents injection via user-controlled values in generated HTML/JS strings.
// =============================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJs(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/</g, '\\x3c')
    .replace(/>/g, '\\x3e')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}
```

**These are identical to what was added in v02.79r** — they were correct and did not contribute to any breakage.

### 2B. Apply Escaping to All User-Controlled Interpolation Points

**Point 1 — `gas-needs-auth` response (line ~810):**
```javascript
// Current:
var authHtml = '<!DOCTYPE html><html><body><script>'
  + 'window.top.postMessage({type:"gas-needs-auth",authStatus:"' + session.status + '",email:"' + (session.email || '') + '",version:"' + VERSION + '"}, "*");'
  + '</' + 'script></body></html>';

// New:
var authHtml = '<!DOCTYPE html><html><body><script>'
  + 'window.top.postMessage({type:"gas-needs-auth",authStatus:"' + escapeJs(session.status) + '",email:"' + escapeJs(session.email || '') + '",version:"' + escapeJs(VERSION) + '"}, "*");'
  + '</' + 'script></body></html>';
```

**Point 2 — Authorized app HTML template (line ~818-856):**
```javascript
// Current (template literal):
var html = `
  ...
  <div id="user-email">${session.email}</div>
  ...
  <h2 id="version">${VERSION}</h2>
  ...
  window.top.postMessage({type: 'gas-auth-ok', version: '${VERSION}', needsReauth: ${session.needsReauth || false}}, '*');
`;

// New:
var html = `
  ...
  <div id="user-email">${escapeHtml(session.email)}</div>
  ...
  <h2 id="version">${escapeHtml(VERSION)}</h2>
  ...
  window.top.postMessage({type: 'gas-auth-ok', version: '${escapeJs(VERSION)}', needsReauth: ${session.needsReauth || false}}, '*');
`;
```

**Note on `needsReauth`:** This is a boolean (`true`/`false`) computed server-side from `checkGoogleTokenExpiry()`. It is not user-controlled, so it doesn't need escaping.

**Point 3 — URL token exchange response (line ~760-763):**
The `payload` variable is constructed via `JSON.stringify()` which handles escaping. However, the `console.log` line includes a substring of the payload — this line should be removed entirely (see Phase 5).

**Testing for Phase 2:**
- [ ] Sign in with a normal email address → email displays correctly in the app
- [ ] Verify no HTML entities appear visually (e.g., `&amp;` showing instead of `&`)
- [ ] VERSION string displays correctly in the version indicator

---

## Phase 3: Session Hardening

**Files:** `testauthgas1.gs`, `testauthgas1.html`
**Risk:** MEDIUM — changes session data structure, affects HMAC validation

### 3A. Remove OAuth Access Token from Session Cache

**Where:** `testauthgas1.gs`, `exchangeTokenForSession()` function (line ~354-362)

**Current:**
```javascript
var sessionData = {
  email: userInfo.email,
  displayName: userInfo.displayName,
  accessToken: accessToken,      // ← Google OAuth token stored in cache
  createdAt: Date.now(),
  absoluteCreatedAt: Date.now(),
  lastActivity: Date.now(),
  tokenObtainedAt: Date.now()
};
```

**New:**
```javascript
var sessionData = {
  email: userInfo.email,
  displayName: userInfo.displayName,
  // accessToken intentionally NOT stored — only needed for the initial
  // validateGoogleToken() call above, then discarded (least privilege)
  createdAt: Date.now(),
  absoluteCreatedAt: Date.now(),
  lastActivity: Date.now(),
  tokenObtainedAt: Date.now()
};
```

**Impact on other code:**
- `checkGoogleTokenExpiry()` — currently only reads `sessionData.tokenObtainedAt`, NOT `sessionData.accessToken`. **No change needed.**
- `validateSession()` — does not use `accessToken`. **No change needed.**
- No other function reads `sessionData.accessToken`. **Removal is safe.**

### 3B. Expand HMAC Payload to Cover All Security-Relevant Fields

**Where:** `testauthgas1.gs`, `generateSessionHmac()` function (line ~289)

**Current:**
```javascript
var payload = sessionData.email + '|' + sessionData.createdAt + '|' + sessionData.lastActivity;
```

**New:**
```javascript
var payload = sessionData.email
  + '|' + sessionData.createdAt
  + '|' + sessionData.lastActivity
  + '|' + (sessionData.absoluteCreatedAt || '')
  + '|' + (sessionData.displayName || '')
  + '|' + (sessionData.tokenObtainedAt || '');
```

**Impact:** This changes the HMAC output for any session created after the update. Existing sessions (created before the update) will have HMACs computed with the old payload format, so their HMACs will fail verification → those sessions will be invalidated → users will need to re-sign in. This is **acceptable** — it's a one-time event on deployment, and sessions are short-lived anyway (180 seconds rolling with heartbeat).

**Note:** This only matters when `ENABLE_HMAC_INTEGRITY = true` (currently `false` for the standard preset). If HMAC is enabled later, the expanded payload will be in place.

### 3C. Fix OAuth Token Revocation

**Where:** `testauthgas1.html`, `performSignOut()` function (line ~1458-1463)

**Current (broken):**
```javascript
// Revoke Google OAuth token
try {
  if (google && google.accounts && google.accounts.oauth2) {
    google.accounts.oauth2.revoke(session.token, function() {});
  }
} catch(e) {}
```

**Problem:** `session.token` is the server-side session token (a UUID), NOT the Google OAuth access token. The `revoke()` API expects an OAuth access token.

**Fix:** Since we're no longer storing the OAuth access token in the session (Phase 3A), and the HTML side doesn't have access to it after the initial exchange, we should **remove the revocation call entirely**. The Google OAuth token has a 1-hour lifetime and will expire naturally. The `google.accounts.oauth2.revoke()` API is designed for revoking refresh tokens in long-lived applications — for our short-lived access token flow, natural expiry is sufficient.

**New:**
```javascript
// Google OAuth access token is not stored client-side (only used during initial exchange)
// and expires naturally (1 hour). Server-side session invalidation is sufficient.
```

**Alternative considered and rejected:** We could store the access token in a separate client-side variable (not localStorage) during the exchange flow and pass it to `revoke()` on sign-out. However, this would mean keeping the OAuth token in JavaScript memory for the entire session duration, which is worse from a security perspective than letting it expire naturally.

**Testing for Phase 3:**
- [ ] Sign in → verify session is created (auth wall hides)
- [ ] Check that `accessToken` is NOT in the session cache (server-side verification): add a temporary `Logger.log(JSON.stringify(sessionData))` in `exchangeTokenForSession` to confirm, then remove it
- [ ] Sign out → verify server session is invalidated (sign back in requires fresh auth)
- [ ] If HMAC is enabled: verify that session validation still works after the payload change

---

## Phase 4: Error Message Sanitization

**Files:** `testauthgas1.gs`
**Risk:** LOW — only changes error text sent to client

### 4A. Sanitize Token Exchange Error Response

**Where:** `testauthgas1.gs`, `doGet()` — URL token exchange path (line ~748-749)

**Current:**
```javascript
} catch (err) {
  result = { success: false, error: "server_error: " + (err.message || String(err)) };
}
```

**New:**
```javascript
} catch (err) {
  Logger.log("Token exchange error: " + (err.message || String(err)));
  result = { success: false, error: "server_error" };
}
```

**Why:** The raw error message could contain stack traces, internal function names, or file paths. Log it server-side for debugging, send only a generic code to the client.

**Testing:**
- [ ] Trigger a token exchange error (e.g., use an expired Google token) → verify the client sees "server_error" with no additional details

---

## Phase 5: Debug Log Cleanup

**Files:** `testauthgas1.html`, `testauthgas1.gs`
**Risk:** VERY LOW — only removes `console.log` statements

### Lines to remove in `testauthgas1.html`:

| Line | Content | Action |
|------|---------|--------|
| 942 | `console.log('[AUTH DEBUG] handleTokenResponse called', ...)` | Remove |
| 948 | `console.log('[AUTH DEBUG] Calling exchangeToken with access_token length:', ...)` | Remove |
| 969 | `console.log('[AUTH DEBUG] exchangeViaUrl: gas-app element not found!');` | Replace with plain `return;` |
| 971 | `console.log('[AUTH DEBUG] exchangeViaUrl: baseUrl is empty!');` | Replace with plain `return;` |
| 973 | `console.log('[AUTH DEBUG] exchangeViaUrl: setting iframe src to', ...)` | Remove |
| 1000 | `console.log('[AUTH DEBUG] postMessage received:', ...)` | Remove |
| 1047 | `console.log('[AUTH DEBUG] Ignoring stale gas-needs-auth ...')` | Remove (keep the comment) |
| 1080 | `console.log('[AUTH DEBUG] Heartbeat OK — session extended ...')` | Remove |
| 1093 | `console.log('[AUTH DEBUG] Heartbeat failed — session expired ...')` | Remove |

### Lines to remove in `testauthgas1.gs`:

| Line | Content | Action |
|------|---------|--------|
| 761 | `console.log("[GAS DEBUG] exchange response loaded, sending:", ...)` | Remove the entire `console.log` line from the generated HTML string |

**Important:** When removing the `console.log` from line 761 in the GAS file, the line is part of a string that builds the exchange response HTML. The string concatenation around it needs to be adjusted so the remaining JavaScript is still valid.

**Current (line 760-762):**
```javascript
var exchangeHtml = '<!DOCTYPE html><html><body><script>'
  + 'console.log("[GAS DEBUG] exchange response loaded, sending:", ' + JSON.stringify(payload.substring(0, 100)) + ');'
  + 'try { window.top.postMessage(' + payload + ', "*"); } catch(e) { console.log("[GAS DEBUG] postMessage error:", e.message); }'
  + '</' + 'script></body></html>';
```

**New:**
```javascript
var exchangeHtml = '<!DOCTYPE html><html><body><script>'
  + 'try { window.top.postMessage(' + payload + ', "*"); } catch(e) {}'
  + '</' + 'script></body></html>';
```

**Testing:**
- [ ] Open browser DevTools console before signing in
- [ ] Complete sign-in flow → verify NO `[AUTH DEBUG]` or `[GAS DEBUG]` messages appear
- [ ] Verify sign-in still works (removing logs doesn't break flow)

---

## Phase 6: postMessage Target Origin on GAS Side

**Files:** `testauthgas1.gs`
**Risk:** MEDIUM — changes the target origin of all outgoing postMessages

### 6A. Use EMBED_PAGE_URL to Derive Target Origin

**Where:** `testauthgas1.gs`, top of file (after line 8)

**Add:**
```javascript
// Derive the parent page's origin from EMBED_PAGE_URL for postMessage targeting.
// postMessage calls from the GAS iframe to the parent page use this as the targetOrigin
// to restrict who can receive the messages. This is safer than "*" because it ensures
// only the intended embedding page can intercept session tokens and auth state.
// CRITICAL: .toLowerCase() is MANDATORY — browsers normalize origins to lowercase,
// but EMBED_PAGE_URL may contain mixed-case (e.g. "ShadowAISolutions"). Without
// toLowerCase(), the browser silently drops ALL postMessages because the targetOrigin
// doesn't match the actual lowercase origin. This exact bug (missing toLowerCase)
// broke sign-in in v02.79r and was never fixed live (the v02.80r fix never deployed
// because the auto-deploy pipeline was already broken).
var PARENT_ORIGIN = EMBED_PAGE_URL.replace(/^(https?:\/\/[^\/]+).*$/, '$1').toLowerCase();
// Result: "https://shadowaisolutions.github.io" (lowercase — matches browser origin)
```

### 6B. Replace `"*"` with `PARENT_ORIGIN` in All postMessage Calls

**This is the same change that was made in v02.79r.** The key difference is: **this time, we are NOT adding origin validation on the HTML receiving side** (which is what broke sign-in before). The GAS side's `PARENT_ORIGIN` is a stable, known value (`https://ShadowAISolutions.github.io`) that does not depend on Google's sandbox URL format.

**All postMessage calls in doGet() need to change:**

Replace every instance of:
```javascript
window.top.postMessage({...}, "*");
```

With:
```javascript
window.top.postMessage({...}, ' + JSON.stringify(PARENT_ORIGIN) + ');
```

Or for template literals:
```javascript
window.top.postMessage({...}, '${PARENT_ORIGIN}');
```

**Affected locations in `testauthgas1.gs`:**
1. Heartbeat expired responses (lines ~659, 669, 679, 693, 706)
2. Heartbeat OK response (line ~723)
3. Sign-out confirmation (line ~733)
4. URL token exchange response (line ~762)
5. postMessage token exchange — ready signal (line ~798)
6. postMessage token exchange — success/failure handlers (lines ~779-793)
7. Unauthorized response (line ~810)
8. Authorized app — gas-auth-ok (line ~839)
9. Authorized app — gas-version response (line ~845)

**Special case — postMessage exchange listener (HIPAA path, line ~798):**
```javascript
// Current:
+ 'window.top.postMessage({ type: "gas-ready-for-token" }, "*");'

// New:
+ 'window.top.postMessage({ type: "gas-ready-for-token" }, ' + JSON.stringify(PARENT_ORIGIN) + ');'
```

**Special case — postMessage exchange incoming messages (HIPAA path, line ~773):**
The GAS listener that receives the `exchange-token` message from the parent does NOT need origin validation. The security model is: the GAS code calls `exchangeTokenForSession(token)` which validates the Google OAuth token server-side via Google's userinfo API. Even if a malicious page sends a fake token, the server-side validation will reject it. Adding origin validation here would add complexity without meaningful security benefit (and could break if the GitHub Pages URL changes).

**Why this is safe now (when it wasn't before):**

In v02.75r-v02.84r, there were two separate problems:
1. **Receiving side** (v02.75r-v02.77r) — HTML page rejecting messages because `event.origin` didn't match GAS sandbox URLs. This plan does NOT add receiving-side origin validation
2. **Sending side** (v02.79r) — GAS using `PARENT_ORIGIN` without `.toLowerCase()`, causing case mismatch. This plan fixes that with `.toLowerCase()`

The corrected `PARENT_ORIGIN` value is:
- Derived from `EMBED_PAGE_URL` which is hardcoded in the `.gs` file
- Lowercased to match browser origin normalization (`https://shadowaisolutions.github.io`)
- Stable — it only changes if the GitHub org name or Pages domain changes
- NOT dependent on Google's sandbox URL format

If `PARENT_ORIGIN` were wrong (e.g., the embedding page URL changed or `.toLowerCase()` were removed), the symptom would be that postMessages are silently dropped — this is exactly what happened in v02.79r. To protect against this:

1. **Fallback behavior:** If the first sign-in attempt times out (no `gas-session-created` received within 10 seconds), fall back to warning the user rather than failing silently. This is an enhancement for a future phase.

2. **Testing checkpoint:** After implementing this phase, immediately test sign-in. If it fails, the `PARENT_ORIGIN` derivation is wrong — revert only this phase.

**Testing for Phase 6:**
- [ ] Sign in with Google → verify authentication completes
- [ ] Check that postMessages are delivered (they won't arrive if PARENT_ORIGIN is wrong)
- [ ] Heartbeat works (separate iframe, same PARENT_ORIGIN)
- [ ] Sign-out confirmation is received (auth wall appears after sign-out)
- [ ] Open page from a different origin (e.g., localhost) → verify postMessages are NOT received (intentional behavior — the GAS app only talks to its designated embedding page)

---

## Implementation Order and Rollback Strategy

### Recommended implementation order:

```
Phase 5 (Debug Cleanup)      — LOWEST risk, zero functional impact
   ↓
Phase 4 (Error Sanitization) — LOW risk, changes error text only
   ↓
Phase 2 (XSS Prevention)     — LOW risk, changes HTML escaping only
   ↓
Phase 1A (Message Allowlist)  — LOW risk, adds filtering without changing flow
   ↓
Phase 3 (Session Hardening)   — MEDIUM risk, changes session data structure
   ↓
Phase 6 (postMessage Target)  — MEDIUM risk, changes who receives messages
   ↓
Phase 1B (Crypto Auth)        — MEDIUM risk, adds new verification layer
```

### Rollback strategy:

Each phase is independent. If a phase breaks sign-in:

1. **Identify which phase broke it** — the phases are ordered by risk, so start checking from the last applied phase
2. **Revert only that phase** — don't revert the entire security update
3. **Keep the working phases** — unlike v02.75r-v02.84r where everything was interleaved and had to be reverted as a whole

### Single-commit vs. multi-commit:

**Recommendation: Implement all phases in a single commit** (matching the repo's single-commit-per-interaction rule), but **test after each phase before moving to the next**. If Phase 6 breaks sign-in during testing, remove Phase 6 from the commit and ship the rest.

The phases are designed so that Phases 1A, 2, 4, and 5 cannot break sign-in (they don't change message flow). Phases 3, 6, and 1B modify behavior and should be tested individually.

---

## GAS-Side postMessage Target Origin — Complete Change Map

Every location in `testauthgas1.gs` where `postMessage` appears and the specific change needed:

### Heartbeat flow (doGet, heartbeat section):

**Pattern repeated 5 times** (expired, parse error, HMAC fail, absolute timeout, session timeout):
```javascript
// Current pattern (appears at lines ~659, 669, 679, 693, 706):
+ 'window.top.postMessage({type:"gas-heartbeat-expired"}, "*");'

// New pattern:
+ 'window.top.postMessage({type:"gas-heartbeat-expired"}, ' + JSON.stringify(PARENT_ORIGIN) + ');'
```

**Heartbeat OK (line ~723):**
```javascript
// Current:
+ 'window.top.postMessage({type:"gas-heartbeat-ok",expiresIn:' + ... + '}, "*");'

// New:
+ 'window.top.postMessage({type:"gas-heartbeat-ok",expiresIn:' + ... + '}, ' + JSON.stringify(PARENT_ORIGIN) + ');'
```

### Sign-out flow:

**Line ~733:**
```javascript
// Current:
+ 'window.top.postMessage({type:"gas-signed-out",success:true}, "*");'

// New:
+ 'window.top.postMessage({type:"gas-signed-out",success:true}, ' + JSON.stringify(PARENT_ORIGIN) + ');'
```

### URL token exchange response:

**Line ~762:**
```javascript
// Current:
+ 'try { window.top.postMessage(' + payload + ', "*"); } catch(e) {}'

// New:
+ 'try { window.top.postMessage(' + payload + ', ' + JSON.stringify(PARENT_ORIGIN) + '); } catch(e) {}'
```

### postMessage token exchange (HIPAA path):

**Ready signal (line ~798):**
```javascript
// Current:
+ 'window.top.postMessage({ type: "gas-ready-for-token" }, "*");'

// New:
+ 'window.top.postMessage({ type: "gas-ready-for-token" }, ' + JSON.stringify(PARENT_ORIGIN) + ');'
```

**Success handler (line ~779-785):**
```javascript
// Current:
+ '      }, "*");'

// New:
+ '      }, ' + JSON.stringify(PARENT_ORIGIN) + ');'
```

**Failure handler (line ~790-793):**
```javascript
// Current:
+ '      }, "*");'

// New:
+ '      }, ' + JSON.stringify(PARENT_ORIGIN) + ');'
```

### Unauthorized response:

**Line ~810:**
```javascript
// Current:
+ '...}, "*");'

// New:
+ '...}, ' + JSON.stringify(PARENT_ORIGIN) + ');'
```

### Authorized app template:

**Line ~839:**
```javascript
// Current:
window.top.postMessage({type: 'gas-auth-ok', version: '${VERSION}', needsReauth: ${session.needsReauth || false}}, '*');

// New:
window.top.postMessage({type: 'gas-auth-ok', version: '${escapeJs(VERSION)}', needsReauth: ${session.needsReauth || false}}, '${PARENT_ORIGIN}');
```

**Line ~845:**
```javascript
// Current:
top.postMessage({type: 'gas-version', version: data.version}, '*');

// New:
top.postMessage({type: 'gas-version', version: data.version}, '${PARENT_ORIGIN}');
```

---

## HTML-Side Message Listener — Complete New Code

The full replacement for the `window.addEventListener('message', ...)` block in `testauthgas1.html`:

```javascript
// =============================================
// AUTH — postMessage Listener
// Handles all auth-related messages from the GAS iframe.
// Security: message-type allowlist + optional cryptographic verification
// =============================================

var _KNOWN_GAS_MESSAGES = {
  'gas-ready-for-token': true,
  'gas-session-created': true,
  'gas-needs-auth': true,
  'gas-auth-ok': true,
  'gas-heartbeat-ok': true,
  'gas-heartbeat-expired': true,
  'gas-signed-out': true,
  'gas-version': true
};

window.addEventListener('message', function(event) {
  var data = event.data;
  if (!data || typeof data !== 'object') return;
  // Layer 1: Only process known GAS message types (allowlist)
  if (!_KNOWN_GAS_MESSAGES[data.type]) return;

  // GAS iframe signals ready for token (postMessage exchange path)
  if (data.type === 'gas-ready-for-token' && _pendingToken) {
    var gasApp = document.getElementById('gas-app');
    if (gasApp && gasApp.contentWindow) {
      gasApp.contentWindow.postMessage({
        type: 'exchange-token',
        accessToken: _pendingToken
      }, '*');
      _pendingToken = null;
    }
  }

  // GAS iframe created a session (both url and postMessage paths)
  if (data.type === 'gas-session-created') {
    // ... existing handler code unchanged ...
  }

  // ... rest of message types unchanged ...
});
```

**Note:** The `gasApp.contentWindow.postMessage({...}, '*')` for sending the access token to the GAS iframe still uses `'*'` as the target origin. This is intentional — we cannot predict the GAS sandbox iframe's origin (it's a `*.googleusercontent.com` subdomain that changes). The security model for this direction is: the GAS server validates the Google token server-side, so even if a malicious iframe intercepts this message, they get a short-lived Google OAuth token that's about to be consumed by the GAS server anyway.

---

## What is NOT Changed (Explicit Decisions)

| Item | Why NOT changed |
|------|----------------|
| `TOKEN_EXCHANGE_METHOD` stays `'url'` for standard preset | Switching to `postMessage` was tried in v02.79r but was never properly tested — the PARENT_ORIGIN case mismatch (deployed in the same commit) silently dropped all GAS→parent messages, and the v02.82r revert never deployed because auto-deploy was broken. We cannot conclude postMessage exchange "doesn't work" — it was tested in a broken state. However, URL exchange works reliably and is simpler, so this plan keeps it as `'url'` for pragmatic reasons. The OAuth token in the URL is short-lived and consumed immediately by the GAS server |
| `STORAGE_TYPE` stays `'localStorage'` for standard preset | `sessionStorage` would clear on tab close. For the standard preset, persistence across tabs is a feature. HIPAA preset should use `sessionStorage` |
| `ABSOLUTE_SESSION_TIMEOUT` stays at 57600 (16 hours) | v02.79r reduced this to 21600 to match CacheService max TTL, and that change actually deployed to the live GAS (v01.15g). It did not cause issues by itself. However, the reduction is unnecessary — CacheService auto-extends on put(), and the heartbeat re-puts the session data, so the 6-hour CacheService limit is never actually hit. The 16-hour value is correct |
| No CSP meta tag added | Broke Google Sign-In in v02.83r. GAS iframe architecture needs so many Google domains whitelisted that CSP provides negligible value |
| No `event.origin` validation on HTML side | Broke sign-in in v02.75r. GAS sandbox origin is unpredictable |
| No `event.source` validation on HTML side | Broke in v02.76r. GAS double-wraps iframes |
| `doPost(action=deploy)` completely untouched | Constraint A — any guard breaks auto-deploy |
| `XFrameOptionsMode.ALLOWALL` stays on all GAS responses | Required for the cross-origin iframe architecture. Security is at the message level, not the frame level |
| `ENABLE_HMAC_INTEGRITY` stays `false` for standard preset | HMAC requires manual setup (secret in Script Properties). The expanded payload (Phase 3B) will be in place for when it's enabled |

---

## Template Propagation Plan

If testauthgas1 implementation is successful:

1. **Update auth HTML template** (`live-site-pages/templates/HtmlAndGasTemplateAutoUpdate-auth.html.txt`):
   - Add message-type allowlist
   - Remove debug console.log statements
   - Remove broken OAuth revocation code
   - Do NOT add Phase 1B (crypto auth) to template — it requires per-project key management

2. **Update auth GAS templates**:
   - `gas-minimal-auth-template-code.js.txt`: Add `escapeHtml`/`escapeJs`, `PARENT_ORIGIN`, replace `"*"` with `PARENT_ORIGIN`, sanitize error messages, remove access token from session
   - `gas-test-auth-template-code.js.txt`: Same changes

3. **Update `06-UNIFIED-TOGGLEABLE-AUTH-PATTERN.md`**:
   - Correct the origin validation guidance — document that `event.origin !== 'https://script.google.com'` does NOT work
   - Add the message-type allowlist pattern as the recommended approach
   - Document the `PARENT_ORIGIN` derivation pattern for GAS→parent postMessage
   - Add "Known Pitfalls" section with the v02.75r-v02.84r failure history

4. **Update `.claude/rules/gas-scripts.md`**:
   - Add security checklist item for postMessage target origins
   - Add escapeHtml/escapeJs requirement for user-controlled values in generated HTML

---

## Pre-Implementation Checklist

Before starting implementation, verify:

- [ ] `testauthgas1.html` is at v01.26w (the reverted version)
- [ ] `testauthgas1.gs` is at v01.14g (the reverted version with deploy protection comments)
- [ ] Sign-in flow works end-to-end on the current code (baseline test)
- [ ] Auto-deploy works (push a no-op change and verify GAS pulls it)
- [ ] `EMBED_PAGE_URL` in `testauthgas1.gs` (line 8) matches the actual GitHub Pages URL

## Post-Implementation Verification

After all phases are implemented and pushed:

- [ ] Sign-in flow: fresh sign-in with Google completes (not stuck on auth wall)
- [ ] Session resume: page reload resumes session without re-auth
- [ ] Heartbeat: session timer shows "extended ✓" after heartbeat interval
- [ ] Session expiry: session expires correctly after inactivity
- [ ] Sign-out: clicking "Sign Out" returns to auth wall
- [ ] Auto-deploy: push a version bump → verify GAS auto-pulls the new version
- [ ] Console clean: no `[AUTH DEBUG]` or `[GAS DEBUG]` messages in browser console
- [ ] Spoofed message: `postMessage({type:'gas-auth-ok'}, '*')` from console → ignored

Developed by: LightAISolutions

# HIPAA-Compliant SSO Implementation Plan

**Created:** 2026-03-21
**Status:** Ready for implementation
**Scope:** Phase 1 (Portal HIPAA conversion) + Phase 2 (BroadcastChannel SSO between Portal & Testauthgas1)
**Backup location:** `repository-information/backups/` (portal.html.pre-sso.bak, testauthgas1.html.pre-sso.bak, SSO-REVERT-INSTRUCTIONS.md)

---

## Table of Contents

1. [Goal & Architecture](#1-goal--architecture)
2. [Research Findings](#2-research-findings)
3. [Current State — Portal vs Testauthgas1 HIPAA Gap Analysis](#3-current-state--portal-vs-testauthgas1-hipaa-gap-analysis)
4. [Phase 1 — Portal HIPAA Conversion](#4-phase-1--portal-hipaa-conversion)
5. [Phase 2 — BroadcastChannel SSO](#5-phase-2--broadcastchannel-sso)
6. [Testing Checklist](#6-testing-checklist)
7. [Revert Procedure](#7-revert-procedure)
8. [Future Phases](#8-future-phases)

---

## 1. Goal & Architecture

### Goal

User signs in once at the portal → opens any other auth page (testauthgas1, globalacl, etc.) → that page auto-authenticates without a sign-in prompt. All credential handling must meet HIPAA Security Rule requirements (§164.312).

### Architecture Decision: BroadcastChannel-Only SSO

**Chosen approach:** Real-time, ephemeral credential passing via `BroadcastChannel` — no persistent shared storage.

**Why not localStorage?** testauthgas1 uses `sessionStorage` specifically for HIPAA compliance (credentials vanish on tab close). Storing an SSO token in `localStorage` would weaken the HIPAA posture by introducing a persistent credential on disk that survives browser restarts.

**How it works:**

```
Portal (signed in, tab open)          Testauthgas1 (just opened)
─────────────────────────────          ────────────────────────
Holds Google access token              Page loads
  in memory (_pendingToken)        →   Broadcasts 'sso-token-request'
                                       on BroadcastChannel('sais-sso-auth')
Receives request                   ←
Responds with access token         →   Receives token
  via BroadcastChannel                 Exchanges with own GAS backend
                                       GAS validates → session created
                                       App loads (no sign-in prompt!)
```

**Trade-off:** The portal tab must remain open for SSO to work. If the user closes the portal before opening testauthgas1, testauthgas1 falls back to its own sign-in (which uses the same shared CLIENT_ID, so it's one Google prompt either way). This is HIPAA-aligned — credentials should not outlive their source session.

### Two-Phase Approach

| Phase | What | Why |
|-------|------|-----|
| **Phase 1** | Convert portal from standard mode to HIPAA mode | SSO is only as secure as its weakest participant. Portal currently uses localStorage + URL token exchange + DJB2 hashing — all non-HIPAA. Must match testauthgas1's security level first. |
| **Phase 2** | Add BroadcastChannel SSO between portal and testauthgas1 | Once both pages are HIPAA-compliant, add the ephemeral token-sharing layer. |

### What Does NOT Change

- **GAS scripts** (portal.gs, testauthgas1.gs) — no modifications needed. Each GAS script still validates Google tokens independently and creates its own server-side session.
- **GAS-side session management** — CacheService sessions, ACL checks, audit logging all remain per-project.
- **Google OAuth token behavior** — Google access tokens are bearer tokens (not tied to CLIENT_ID at API call time), so a token from portal's sign-in flow works when testauthgas1 exchanges it with testauthgas1.gs.

---

## 2. Research Findings

### 2.1 HIPAA Security Rule Requirements for SSO

**§164.312(a)(1) — Access Control:** Each user must have a unique identifier. SSO must not create shared/anonymous sessions. ✅ Met — each page creates its own per-user session via Google OAuth email.

**§164.312(a)(2)(iii) — Automatic Logoff:** Sessions must terminate after a period of inactivity. ✅ Met — testauthgas1 has session timer enforcer with configurable timeout. Portal must add this in Phase 1.

**§164.312(b) — Audit Controls:** Authentication events must be logged. ✅ Met — both pages have `_reportSecurityEvent()`. testauthgas1 has richer event types.

**§164.312(c)(1) — Integrity Controls:** Mechanisms to protect data from improper alteration. ✅ Met by testauthgas1 via HMAC-SHA256 message signing. Portal uses weak DJB2 hash — must upgrade in Phase 1.

**§164.312(e)(1) — Transmission Security:** Credentials must be protected in transit. The BroadcastChannel approach satisfies this because:
- BroadcastChannel is **same-origin only** — messages never leave the browser process
- No network transmission occurs — tokens pass through browser memory only
- Same-origin policy prevents any cross-origin page from listening

### 2.2 BroadcastChannel Security Analysis

**Same-origin enforcement:** Confirmed — BroadcastChannel is strictly same-origin. Only pages on the exact same protocol + host + port can communicate. This is enforced by the browser at the platform level, not by application code.

**Browser extension risk:** Content scripts injected by browser extensions CAN access the page's DOM and could theoretically listen on BroadcastChannel. However:
- This is true for ALL client-side storage (localStorage, sessionStorage, cookies) — BroadcastChannel does not expand the attack surface
- Extensions with DOM access already have access to everything on the page
- Mitigated by: short token lifetime (Google tokens expire ~1hr), token consumed immediately after exchange, HIPAA-required security monitoring

**Conclusion:** BroadcastChannel is as secure as any same-origin browser API. The ephemeral nature (tokens never persisted to disk) makes it strictly more secure than localStorage-based SSO.

### 2.3 Google OAuth Access Token Sharing

**Key finding:** Google OAuth access tokens are **bearer tokens** — they are NOT validated against the originating CLIENT_ID at API call time.

| Token Type | Tied to CLIENT_ID? | Any client can use it? |
|---|---|---|
| **Access Token** (bearer) | Issued to one client, but **not enforced** at API call time | ✅ Yes |
| **Refresh Token** | ✅ Requires matching client credentials | ❌ No |
| **ID Token** | Has `aud` claim — backend must validate | Depends on validation |

**Implication for SSO:** A Google access token obtained via portal's CLIENT_ID can be used by testauthgas1's GAS backend to validate the user. The GAS `validateGoogleToken()` function calls Google's tokeninfo endpoint, which returns the user's email — it doesn't reject based on which CLIENT_ID initiated the flow.

**However, we are unifying to a single CLIENT_ID anyway** (per user's earlier decision). This eliminates any theoretical concern about cross-CLIENT_ID token usage.

### 2.4 sessionStorage vs localStorage for HIPAA

| Aspect | sessionStorage | localStorage |
|--------|---------------|-------------|
| **Persistence** | Cleared on tab close | Persists indefinitely |
| **Cross-tab access** | ❌ Per-tab isolation | ✅ Shared across tabs |
| **HIPAA alignment** | ✅ Minimizes credential exposure | ❌ Credentials survive browser restart |
| **SSO compatibility** | ❌ Cannot share between tabs | ✅ Can share between tabs |

**Resolution:** Use `sessionStorage` for per-page sessions (HIPAA), use `BroadcastChannel` for cross-tab SSO token passing (no persistent storage needed).

---

## 3. Current State — Portal vs Testauthgas1 HIPAA Gap Analysis

### 3.1 HTML_CONFIG Comparison

| Config Key | portal.html | testauthgas1.html (HIPAA) | Match? |
|-----------|---|---|---|
| `STORAGE_TYPE` | `'localStorage'` | `'sessionStorage'` | ❌ |
| `TOKEN_EXCHANGE_METHOD` | `'url'` | `'postMessage'` | ❌ |
| `ENABLE_HEARTBEAT` | `true` | `true` | ✅ |
| `HEARTBEAT_INTERVAL` | *(missing)* | `30000` (30s test value) | ❌ |
| `SINGLE_TAB_ENFORCEMENT` | *(missing)* | `true` | ❌ |
| `CROSS_DEVICE_ENFORCEMENT` | *(missing)* | `true` | ❌ |
| `ENABLE_DOM_CLEARING_ON_EXPIRY` | *(missing)* | `true` | ❌ |
| `ENABLE_IP_LOGGING` | *(missing)* | `false` (ipify lacks BAA) | ❌ |

**Portal has 3 config values. Testauthgas1 has 8. Portal is missing 5 HIPAA toggles.**

### 3.2 Security Feature Comparison

| Feature | portal.html | testauthgas1.html | Severity |
|---------|---|---|---|
| **Storage type** | localStorage (persists) | sessionStorage (tab-close) | ⛔ BLOCKER |
| **Token exchange** | URL param (`?exchangeToken=`) | postMessage (token never in URL) | ⛔ BLOCKER |
| **Message signing** | DJB2 hash (weak, non-crypto) | HMAC-SHA256 via Web Crypto API | ⛔ BLOCKER |
| **Crypto nonce for postMessage** | ❌ Missing | ✅ `crypto.getRandomValues(16 bytes)` | ⛔ BLOCKER |
| **Session timer enforcer** | ❌ Missing | ✅ Closure-scoped, tamper-resistant | ⛔ BLOCKER |
| **DOM clearing on expiry** | ❌ Missing (auth wall overlays only) | ✅ `gasFrame.src = 'about:blank'` | ⛔ BLOCKER |
| **Single-tab enforcement** | ❌ Missing | ✅ `_tabId` + BroadcastChannel roll call | ⛔ BLOCKER |
| **CSRF nonce for Google Sign-In** | ❌ Missing | ✅ `_authNonce` (consumed after use) | ⛔ BLOCKER |
| **Nonce-based iframe loading** | ❌ Missing | ✅ `loadIframeViaNonce()` | ⛔ BLOCKER |
| **`gas-session-invalid` handler** | ❌ Missing | ✅ Clears session + shows auth wall | ⛔ BLOCKER |
| **Cross-device enforcement** | ❌ Missing | ✅ Heartbeat-based detection | 🟡 ENHANCEMENT |
| **Signing-in UI state** | ❌ Missing | ✅ `showSigningIn()` interim feedback | 🟡 ENHANCEMENT |
| **Warning banners** | ❌ Missing | ✅ `hideAllWarningBanners()` | 🟡 ENHANCEMENT |
| **Heartbeat interval config** | ❌ Not configurable | ✅ `HEARTBEAT_INTERVAL` in config | 🟡 ENHANCEMENT |
| **IP logging toggle** | ❌ Missing | ✅ Disabled (lacks BAA) | 🟡 ENHANCEMENT |
| **Rich security events** | Basic (3 types) | Comprehensive (10+ types) | 🟡 ENHANCEMENT |

### 3.3 Code Size Gap

- **portal.html**: 1,272 lines
- **testauthgas1.html**: 4,070 lines
- **Gap**: ~2,800 lines of HIPAA security code

### 3.4 Session Function Differences

**portal.html** stores 2 items:
```javascript
saveSession(sessionToken, email)
// Keys: portal_gas_session_token, portal_gas_user_email
```

**testauthgas1.html** stores 4 items:
```javascript
saveSession(sessionToken, email, role, permissions)
// Keys: testauthgas1_gas_session_token, testauthgas1_gas_user_email,
//        testauthgas1_gas_user_role, testauthgas1_gas_user_permissions
```

### 3.5 Message Verification Comparison

**portal.html** — DJB2 hash (non-cryptographic):
```javascript
// Simple hash: ((hash << 5) - hash) + charCode — trivially forgeable
function _verifyMessageSignature(data, key) {
  var hash = 0;
  for (var i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(i);
    hash |= 0;
  }
  return sig === hash.toString(36);
}
```

**testauthgas1.html** — HMAC-SHA256 via Web Crypto API:
```javascript
// Cryptographically secure: imported CryptoKey + async verification
async function _verifyHmacSha256(data, hexSig) {
  var keys = Object.keys(data).sort(); // Deterministic ordering
  return crypto.subtle.verify('HMAC', _hmacKey, sigBytes, payloadBytes);
}
```

---

## 4. Phase 1 — Portal HIPAA Conversion

### Overview

Convert portal.html from standard mode to HIPAA-compliant mode by porting testauthgas1's security features. This is primarily a code-porting exercise — testauthgas1 is the reference implementation, and portal must match it.

**No GAS changes needed.** portal.gs already has HMAC support, session validation, and audit logging — these are GAS-side features controlled by `AUTH_CONFIG`. The HTML-side changes are independent.

### Step 1: Update HTML_CONFIG

**File:** `portal.html` (line ~313)

Change from:
```javascript
var HTML_CONFIG = {
  STORAGE_TYPE: 'localStorage',
  TOKEN_EXCHANGE_METHOD: 'url',
  ENABLE_HEARTBEAT: true,
};
```

Change to:
```javascript
var HTML_CONFIG = {
  STORAGE_TYPE: 'sessionStorage',
  TOKEN_EXCHANGE_METHOD: 'postMessage',
  ENABLE_HEARTBEAT: true,
  HEARTBEAT_INTERVAL: 30000,  // 30s test value — change to 300000 (5min) for production
  SINGLE_TAB_ENFORCEMENT: true,
  CROSS_DEVICE_ENFORCEMENT: true,
  ENABLE_DOM_CLEARING_ON_EXPIRY: true,
  ENABLE_IP_LOGGING: false  // ipify.org lacks BAA — violates HIPAA
};
```

### Step 2: Replace DJB2 with HMAC-SHA256

**Remove** the `_verifyMessageSignature()` function (DJB2 hash, ~20 lines).

**Add** from testauthgas1:
- `_hmacKey` and `_hmacKeySet` variables
- `_importHmacKey(hexString)` — imports the GAS-provided key as a Web Crypto CryptoKey
- `_verifyHmacSha256(data, hexSig)` — async HMAC-SHA256 signature verification
- Update all message handlers to use async HMAC verification instead of sync DJB2

**Key locations in testauthgas1 to port from:**
- `_hmacKey` / `_hmacKeySet` declarations
- `_importHmacKey()` function (~30 lines)
- `_verifyHmacSha256()` function (~20 lines)
- Message handler signature verification logic (the `_SIG_EXEMPT` allowlist and async verification flow)

### Step 3: Add Cryptographic Nonce for postMessage Token Exchange

**Add** from testauthgas1:
- `_pendingNonce` variable
- Nonce generation in `exchangeViaPostMessage()`: `crypto.getRandomValues(new Uint8Array(16))` → hex string
- Nonce verification in `gas-session-created` handler: reject if `data.nonce !== _pendingNonce`, then consume (`_pendingNonce = null`)
- Security event reporting on nonce mismatch

### Step 4: Add CSRF Nonce for Google Sign-In

**Add** from testauthgas1:
- `_authNonce` variable (null initially)
- Set `_authNonce` in `initGoogleSignIn()` before `requestAccessToken()`
- Check and consume `_authNonce` in `handleTokenResponse()` — reject if null (stale callback)

### Step 5: Add Session Timer Enforcer

**Add** from testauthgas1 (~50 lines):
- `_sessionTimerEnforcer` IIFE closure with `.lock()`, `.getServerDuration()`, `.getAbsoluteDuration()`, `.isLocked()`, `.reset()` methods
- `Object.defineProperty` protection against DevTools tampering
- Integration with `gas-session-created` handler to lock timer values
- Integration with `clearSession()` to reset

### Step 6: Add DOM Clearing on Session Expiry

**Add** from testauthgas1:
- In session expiry handlers (`gas-needs-auth`, `gas-session-invalid`, `gas-signed-out`): when `HTML_CONFIG.ENABLE_DOM_CLEARING_ON_EXPIRY === true`, set `gasFrame.src = 'about:blank'` to clear PHI from the iframe DOM
- In `showApp()`: check if iframe needs reloading after DOM clearing (via `loadIframeViaNonce()`)

### Step 7: Add Single-Tab Enforcement

**Add** from testauthgas1:
- `_tabId` variable (random + timestamp)
- `_tabSurrendered` and `_evictedByRemote` flags
- BroadcastChannel for tab roll call (`tab-roll-call`, `tab-present` messages)
- Tab takeover overlay UI (HTML + CSS for session-active-elsewhere message)
- `_rollCallResponses` tracking and `updateTakeoverTabCount()`

### Step 8: Add Cross-Device Enforcement

**Add** from testauthgas1:
- Heartbeat error handling that detects `reason: 'new_sign_in'` from GAS
- `_evictedByRemote` flag set on cross-device detection
- Session termination + auth wall display with cross-device message

### Step 9: Add Nonce-Based Iframe Loading

**Add** from testauthgas1:
- `loadIframeViaNonce(sessionToken, options)` function
- `_pendingNonceToken` and `_nonceCallback` variables
- `_expectingSession` guard against stale `gas-needs-auth` messages
- Message handlers for `gas-nonce-ready` → send token → `gas-nonce-result` → load iframe with page nonce

### Step 10: Add Missing Message Handlers

**Add** from testauthgas1:
- `gas-session-invalid` handler — clear session, show auth wall
- Enhanced `gas-needs-auth` handler with stale message filtering
- Absolute timer expiry handling
- Richer `_reportSecurityEvent()` with pre-auth guard and additional event types

### Step 11: Add UI Enhancements

**Add** from testauthgas1:
- `showSigningIn()` function + HTML elements (`auth-wall-signing-in`, `auth-wall-reconnecting`)
- `hideAllWarningBanners()` function + warning banner HTML (`session-warning-banner`, `absolute-warning-banner`)
- Call `showSigningIn()` from `exchangeToken()`
- Call `hideAllWarningBanners()` from `showApp()`

### Step 12: Update `showApp()` and `saveSession()`

**Update `showApp()`** to match testauthgas1's signature:
```javascript
// Before:
function showApp(email, displayName)
// After:
function showApp(email, displayName, role)
```

**Update `saveSession()`** to store role and permissions:
```javascript
// Before:
function saveSession(sessionToken, email)
// After:
function saveSession(sessionToken, email, role, permissions)
```

Add `ROLE_KEY` and `PERMISSIONS_KEY` storage keys. Update `loadSession()` and `clearSession()` to match.

### Step 13: Update CLIENT_ID (Shared)

**No change needed for portal** — portal keeps its own CLIENT_ID. In Phase 2, testauthgas1 will adopt portal's CLIENT_ID.

### Implementation Strategy

The safest approach: **port code section by section from testauthgas1**, using testauthgas1 as the reference implementation. Do NOT rewrite from scratch — copy the exact patterns that are already proven in testauthgas1.

**Order of operations:** Steps 1 → 2 → 3 → 4 → 5 (these must be done together as they're interdependent). Steps 6–12 can be done incrementally after the core security changes are in place.

**Estimated portal.html size after Phase 1:** ~3,500–4,000 lines (comparable to testauthgas1's 4,070 lines). The ~300-line difference is portal's Projects panel UI (which testauthgas1 doesn't have) offset by testauthgas1's self-test infrastructure (which portal doesn't need).

---

## 5. Phase 2 — BroadcastChannel SSO

### Overview

After Phase 1 (portal is HIPAA-compliant), add ephemeral cross-page authentication via BroadcastChannel. No persistent shared storage — tokens pass through browser memory only.

### 5.1 Shared BroadcastChannel Protocol

**Channel name:** `'sais-sso-auth'`

**Message types:**

| Message | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `sso-token-request` | Testauthgas1 → Portal | `{ type, tabId, pageName }` | "I need an access token" |
| `sso-token-response` | Portal → Testauthgas1 | `{ type, accessToken, email, sourceTabId, sourcePage }` | "Here's the token" |
| `sso-sign-out` | Any → All | `{ type, source, tabId }` | "I signed out — everyone should too" |
| `sso-token-unavailable` | Portal → Testauthgas1 | `{ type, reason }` | "I don't have a token" (optional, for debugging) |

### 5.2 Portal Changes (Token Provider)

**Step 1: Hold Google access token in memory**

Currently, `_pendingToken` is set in `exchangeViaPostMessage()` and consumed after the iframe handshake. For SSO, we need to retain it longer.

Add a new variable:
```javascript
var _ssoAccessToken = null;  // Google access token held for SSO sharing
var _ssoUserEmail = null;    // Confirmed email after GAS validation
```

**Set in `handleTokenResponse()`:**
```javascript
function handleTokenResponse(response) {
  if (response.access_token) {
    _ssoAccessToken = response.access_token;
    exchangeToken(response.access_token);
  }
}
```

**Update email in `showApp()`:**
```javascript
function showApp(email, displayName, role) {
  _ssoUserEmail = email;
  // ... existing code ...
}
```

**Clear on sign-out in `clearSession()`:**
```javascript
_ssoAccessToken = null;
_ssoUserEmail = null;
```

**Step 2: Listen for SSO token requests**

Add a persistent BroadcastChannel listener (always active after auth):
```javascript
var _ssoChannel = null;
if (typeof BroadcastChannel !== 'undefined') {
  try {
    _ssoChannel = new BroadcastChannel('sais-sso-auth');
    _ssoChannel.onmessage = function(e) {
      if (!e.data) return;

      if (e.data.type === 'sso-token-request') {
        // Only respond if we have a valid token and confirmed email
        if (_ssoAccessToken && _ssoUserEmail) {
          _ssoChannel.postMessage({
            type: 'sso-token-response',
            accessToken: _ssoAccessToken,
            email: _ssoUserEmail,
            sourceTabId: _tabId,
            sourcePage: _pageName
          });
        }
      }

      if (e.data.type === 'sso-sign-out' && e.data.tabId !== _tabId) {
        clearSession();
        stopCountdownTimers();
        stopHeartbeat();
        showAuthWall('Signed out from ' + (e.data.source || 'another page') + '.');
      }
    };
  } catch(e) {}
}
```

**Step 3: Broadcast sign-out**

In the sign-out flow, after `clearSession()`:
```javascript
if (_ssoChannel) {
  try {
    _ssoChannel.postMessage({
      type: 'sso-sign-out',
      source: _pageName,
      tabId: _tabId
    });
  } catch(e) {}
}
```

### 5.3 Testauthgas1 Changes (Token Consumer)

**Step 1: Change CLIENT_ID to portal's**

```javascript
// Before:
var CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
// After:
var CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
```

**Step 2: Add SSO auto-detect on page load**

Add before `initGoogleSignIn()` is called:

```javascript
function attemptSSOAuth() {
  if (typeof BroadcastChannel === 'undefined') return false;

  try {
    var ssoChannel = new BroadcastChannel('sais-sso-auth');
    var _ssoTimeout = null;

    ssoChannel.onmessage = function(e) {
      if (!e.data) return;

      if (e.data.type === 'sso-token-response' && e.data.accessToken) {
        clearTimeout(_ssoTimeout);
        // Exchange the received token with our GAS backend
        exchangeToken(e.data.accessToken);
        // Don't close the channel — keep listening for sign-out
      }

      if (e.data.type === 'sso-sign-out' && e.data.tabId !== _tabId) {
        clearSession();
        stopCountdownTimers();
        stopHeartbeat();
        showAuthWall('Signed out from ' + (e.data.source || 'another page') + '.');
      }
    };

    // Request token from any authenticated page
    ssoChannel.postMessage({
      type: 'sso-token-request',
      tabId: _tabId,
      pageName: _pageName
    });

    // Wait 2 seconds for a response — if none, fall back to own sign-in
    _ssoTimeout = setTimeout(function() {
      // No SSO response received — fall back
      initGoogleSignIn();
    }, 2000);

    return true; // SSO attempt in progress
  } catch(e) {
    return false;
  }
}
```

**Step 3: Replace initialization**

```javascript
// Before:
initGoogleSignIn();

// After:
if (!attemptSSOAuth()) {
  initGoogleSignIn();  // BroadcastChannel not available — direct sign-in
}
```

**Step 4: Bidirectional — testauthgas1 also provides tokens**

If user signed in at testauthgas1 first (bypassing portal), testauthgas1 should also respond to `sso-token-request` from other pages. Add the same listener pattern as portal:

```javascript
// Hold token for SSO sharing (same pattern as portal)
var _ssoAccessToken = null;
var _ssoUserEmail = null;

// In handleTokenResponse:
_ssoAccessToken = response.access_token;

// In showApp:
_ssoUserEmail = email;

// SSO channel listener responds to requests
if (e.data.type === 'sso-token-request' && _ssoAccessToken && _ssoUserEmail) {
  ssoChannel.postMessage({
    type: 'sso-token-response',
    accessToken: _ssoAccessToken,
    email: _ssoUserEmail,
    sourceTabId: _tabId,
    sourcePage: _pageName
  });
}
```

### 5.4 SSO Flow Diagram

```
SCENARIO A: Portal first (primary flow)
─────────────────────────────────────────

1. User opens portal.html
2. Google Sign-In prompt → user authenticates
3. Google access token → held in _ssoAccessToken (memory only)
4. Token exchanged with portal.gs → session created
5. Portal shows app, _ssoUserEmail set

6. User clicks "Open All Projects" → testauthgas1 opens in new tab
7. testauthgas1 loads → attemptSSOAuth() fires
8. Broadcasts 'sso-token-request' on 'sais-sso-auth' channel
9. Portal receives request → responds with _ssoAccessToken
10. testauthgas1 receives token → exchangeToken() → testauthgas1.gs validates
11. testauthgas1.gs creates its own session → testauthgas1 shows app
12. ✅ No sign-in prompt on testauthgas1!


SCENARIO B: Testauthgas1 first (fallback)
────────────────────────────────────────

1. User opens testauthgas1.html directly
2. attemptSSOAuth() fires → broadcasts 'sso-token-request'
3. No response within 2 seconds (portal not open)
4. Falls back to initGoogleSignIn()
5. Google Sign-In prompt → user authenticates
6. Token held in _ssoAccessToken + exchanged with testauthgas1.gs
7. testauthgas1 shows app

8. Later, user opens portal.html
9. Portal's attemptSSOAuth() fires → broadcasts request
10. testauthgas1 responds with _ssoAccessToken
11. Portal auto-authenticates
12. ✅ No sign-in prompt on portal!


SCENARIO C: Sign-out propagation
─────────────────────────────────

1. User has portal + testauthgas1 open (both authenticated)
2. User clicks Sign Out on portal
3. Portal: clearSession() + clears _ssoAccessToken
4. Portal: broadcasts 'sso-sign-out' on 'sais-sso-auth'
5. testauthgas1 receives broadcast → clearSession() → shows auth wall
6. ✅ Both pages signed out!
```

### 5.5 Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Token intercepted by malicious page on same origin | Same-origin only — attacker would need to deploy code on your GitHub Pages domain, which means they already have repo write access |
| Token intercepted by browser extension | Extensions with DOM access can already read all page state — BroadcastChannel doesn't expand the surface. Mitigated by token expiry (~1hr) |
| Replay attack with old token | Google tokens expire after ~1 hour. GAS backend validates with Google on every exchange — expired tokens are rejected |
| Man-in-the-middle on BroadcastChannel | Not possible — BroadcastChannel never leaves the browser process. No network transmission |
| Token lingers after tab close | `_ssoAccessToken` is a JavaScript variable — garbage collected when the tab closes. No persistence |
| User walks away without signing out | Each page has its own session timeout (HIPAA automatic logoff). Sessions expire independently via GAS-side TTL |
| 2-second SSO timeout too long/short | 2 seconds is generous for same-process IPC. If portal is open and authenticated, response is typically <50ms. The timeout only fires when no authenticated page exists |

---

## 6. Testing Checklist

### Phase 1 Testing (Portal HIPAA Conversion)

**After each step, test before proceeding:**

- [ ] **Config change**: Portal loads without errors. Auth wall appears. Storage inspector shows `sessionStorage` (not `localStorage`).
- [ ] **Token exchange**: Sign in via Google → token exchanged via postMessage (check Network tab — no `?exchangeToken=` in iframe URL). GAS iframe loads and displays dashboard.
- [ ] **HMAC verification**: Open DevTools Console — no HMAC errors. Messages from GAS are accepted. Tamper with a message in the console → rejected with security event.
- [ ] **Session timer**: After sign-in, session timer enforcer is locked (check: `_sessionTimerEnforcer.isLocked()` in console → `true`). Cannot be overridden via DevTools.
- [ ] **DOM clearing**: Wait for session to expire (or manually expire via GAS) → iframe shows `about:blank` (not the old dashboard content). Re-sign-in → dashboard loads fresh.
- [ ] **Single-tab**: Open portal in a second tab → first tab shows "session active elsewhere" overlay. Only one tab is active at a time.
- [ ] **Sign-out**: Click Sign Out → session cleared, auth wall shown, BroadcastChannel sign-out broadcast sent. Open a second tab → no session present.
- [ ] **Projects panel**: The "Projects" floating button still works after all HIPAA changes. Panel opens, links work, "Open All" opens tabs.

### Phase 2 Testing (SSO)

- [ ] **Portal → testauthgas1 SSO**: Sign in at portal → open testauthgas1 in new tab → testauthgas1 auto-authenticates (no sign-in prompt). Check: `sessionStorage` has testauthgas1's session token.
- [ ] **testauthgas1 → portal SSO**: Clear all storage. Sign in at testauthgas1 → open portal in new tab → portal auto-authenticates.
- [ ] **SSO timeout fallback**: Close all tabs. Open testauthgas1 only → `sso-token-request` sent, no response within 2s → normal sign-in flow appears.
- [ ] **Cross-page sign-out**: Both pages open and authenticated. Sign out from portal → testauthgas1 shows auth wall. Sign out from testauthgas1 → portal shows auth wall.
- [ ] **Tab close behavior**: Portal authenticated. Close portal tab. Open testauthgas1 → SSO fails (portal not open) → fallback sign-in. This is expected HIPAA behavior.
- [ ] **Session independence**: Portal and testauthgas1 both authenticated via SSO. Wait for testauthgas1's GAS session to expire → testauthgas1 shows auth wall. Portal is unaffected (its own GAS session is still valid).
- [ ] **Private/incognito mode**: Open portal in incognito → BroadcastChannel may or may not be available depending on browser. SSO should fail gracefully → normal sign-in works.
- [ ] **DevTools verification**: Application tab → sessionStorage → verify only page-scoped keys exist (no `sais_sso_*` localStorage keys). The SSO token only exists in JavaScript memory.

---

## 7. Revert Procedure

### Full Revert (back to pre-SSO state)

Backups are in `repository-information/backups/`:

```bash
# From repo root:
cp repository-information/backups/portal.html.pre-sso.bak live-site-pages/portal.html
cp repository-information/backups/testauthgas1.html.pre-sso.bak live-site-pages/testauthgas1.html
```

This restores:
- Portal: localStorage, URL token exchange, DJB2 signing, standard mode
- Testauthgas1: original CLIENT_ID, no SSO auto-detect, independent auth

### Partial Revert (keep Phase 1, revert Phase 2 only)

If Phase 1 (HIPAA conversion) works but Phase 2 (SSO) has issues:
- Remove the `_ssoAccessToken`, `_ssoUserEmail` variables from both pages
- Remove the `BroadcastChannel('sais-sso-auth')` listener from both pages
- Remove `attemptSSOAuth()` function from testauthgas1
- Restore `initGoogleSignIn()` as the direct initialization call in testauthgas1
- Keep testauthgas1's CLIENT_ID as portal's (shared CLIENT_ID is still desirable)

### Backup Versions

| File | Backup Version | Current Version |
|------|---------------|----------------|
| portal.html | v01.18w | (will increment during implementation) |
| testauthgas1.html | v02.61w | (will increment during implementation) |

See `repository-information/backups/SSO-REVERT-INSTRUCTIONS.md` for detailed instructions.

---

## 8. Future Phases

### Phase 3: Extend SSO to globalacl.html

Same pattern as testauthgas1:
- Change CLIENT_ID to portal's
- Add `attemptSSOAuth()` with BroadcastChannel listener
- Add bidirectional token sharing
- globalacl already uses the auth template — confirm it has HIPAA features or convert first

### Phase 4: Extract SSO into Auth Template

Once SSO is proven on portal + testauthgas1:
- Add SSO logic to `HtmlAndGasTemplateAutoUpdate-auth.html.txt`
- New `HTML_CONFIG` toggle: `ENABLE_SSO: true/false`
- When enabled, `attemptSSOAuth()` runs automatically before `initGoogleSignIn()`
- BroadcastChannel listener activates automatically
- All future auth pages inherit SSO by default

### Phase 5: Portal Dashboard Enhancement

- Portal dashboard shows which pages the user has access to (read from Master ACL spreadsheet)
- Each page in the "Projects" panel shows auth status (authenticated / not authenticated / access denied)
- "Open All" button only opens pages the user has access to (pre-filtered by ACL)

### Phase 6: Token Refresh Coordination

- When one page's Google token is about to expire, it broadcasts a refresh event
- Other pages can request a fresh token via BroadcastChannel
- Prevents multiple pages from independently prompting Google for token refresh

Developed by: LightAISolutions

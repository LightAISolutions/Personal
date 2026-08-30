# Researched & Improved Google OAuth Authentication Pattern

Implementation-ready reference for Google OAuth authentication in GAS web apps embedded via iframe. This pattern builds on [03-IMPROVED-GOOGLE-OAUTH-PATTERN.md](03-IMPROVED-GOOGLE-OAUTH-PATTERN.md) and incorporates security research findings — specifically fixing the origin validation vulnerability, adding interactive re-auth fallback for `prompt: ''` failures, documenting CacheService behavioral caveats, and hardening the postMessage exchange flow.

> **Relationship to other patterns**:
> - [02-GOOGLE-OAUTH-AUTH-PATTERN.md](02-GOOGLE-OAUTH-AUTH-PATTERN.md) — basic pattern (raw token in localStorage, no server sessions)
> - [03-IMPROVED-GOOGLE-OAUTH-PATTERN.md](03-IMPROVED-GOOGLE-OAUTH-PATTERN.md) — first improvement (server sessions, opaque tokens, silent re-auth)
> - **This document** — research-validated version with all known issues fixed, ready for direct implementation

> **What changed from the Improved pattern**: see [Section 12: Delta from Improved Pattern](#12-delta-from-improved-pattern) for the exact list of changes with rationale.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Why This Pattern (Research-Backed)](#2-why-this-pattern-research-backed)
3. [GAS vs HTML Responsibility Split](#3-gas-vs-html-responsibility-split)
4. [Authentication Flow](#4-authentication-flow)
5. [Implementation Guide — GAS Backend](#5-implementation-guide--gas-backend)
6. [Implementation Guide — HTML Shell](#6-implementation-guide--html-shell)
7. [postMessage Protocol](#7-postmessage-protocol)
8. [CacheService Behavioral Caveats](#8-cacheservice-behavioral-caveats)
9. [Security Checklist](#9-security-checklist)
10. [Migration Guide](#10-migration-guide)
11. [Four-Pattern Comparison](#11-four-pattern-comparison)
12. [Delta from Improved Pattern](#12-delta-from-improved-pattern)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Architecture Overview

> **Where the logic lives**: the GAS server owns all security — token validation, session creation, authorization checks, and token refresh signaling. The HTML wrapper is a thin shell that triggers the browser sign-in popup and relays messages. No Google API calls happen in the browser.

```
┌─────────────────────────────────────────────────────────────────┐
│  HTML Wrapper (GitHub Pages / Custom Domain)                    │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │  Auth Wall        │    │  GAS iframe (full-screen)         │   │
│  │  (Sign In /       │    │  ┌────────────────────────────┐  │   │
│  │   Access Denied)  │    │  │  GAS Web App               │  │   │
│  │                   │    │  │  - Validates session token  │  │   │
│  │  [Sign In with    │    │  │  - Returns data/UI         │  │   │
│  │   Google]         │    │  │  - Sends postMessage for    │  │   │
│  └──────────────────┘    │  │    auth status updates      │  │   │
│                           │  └────────────────────────────┘  │   │
│  ┌──────────────────┐    └──────────────────────────────────┘   │
│  │  localStorage     │                                          │
│  │  (session token   │    postMessage (strict origin-validated)  │
│  │   only — NOT the  │    ◄──────────────────────────────►      │
│  │   OAuth token)    │                                          │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    │ 1. GIS popup              │ 2. Exchange token
                    ▼                           ▼
        ┌──────────────────┐        ┌──────────────────────┐
        │  Google OAuth     │        │  GAS Server           │
        │  (accounts.google │        │  (CacheService)       │
        │   .com/gsi)       │        │                       │
        │                   │        │  Session store:       │
        │  Returns:         │        │  {sessionToken} →     │
        │  access_token     │        │    {email,            │
        │                   │        │     accessToken,      │
        └──────────────────┘        │     createdAt,        │
                                     │     lastActivity}     │
                                     └──────────────────────┘
                                              │
                                     3. Validate token
                                              ▼
                                     ┌──────────────────┐
                                     │  Google userinfo   │
                                     │  API (server-side  │
                                     │  only)             │
                                     └──────────────────┘
```

---

## 2. Why This Pattern (Research-Backed)

### Issues Found in the Improved Pattern (via research)

The Improved pattern fixed the major problems with the Basic pattern (raw token exposure, no sessions, no TTL). However, research identified these remaining issues:

#### 1. Origin validation is bypassable (SECURITY)

The Improved pattern uses:
```javascript
if (e.origin && !e.origin.includes('googleusercontent.com')) {
  return; // Reject
}
```

**Problem**: `String.includes()` is a substring match. An attacker who controls `evil-googleusercontent.com` or `googleusercontent.com.evil.com` passes this check. Additionally, the `e.origin &&` guard means messages with an empty/undefined origin (which can happen in certain browser contexts) are silently accepted.

**Fix in this pattern**: strict suffix match on the origin hostname:
```javascript
var hostname = '';
try { hostname = new URL(e.origin).hostname; } catch (_) { return; }
if (!hostname.endsWith('.googleusercontent.com') &&
    hostname !== 'googleusercontent.com') {
  return;
}
```

#### 2. Silent re-auth (`prompt: ''`) fails without fallback (UX)

The Improved pattern uses `prompt: ''` (empty string) for silent re-auth:
```javascript
var client = google.accounts.oauth2.initTokenClient({
  prompt: '',  // Empty prompt = try silent auth
  callback: function(resp) {
    if (resp && resp.access_token) {
      exchangeForSession(resp.access_token);
    }
    // If silent auth fails, the user's current session continues
  }
});
```

**Problem**: `prompt: ''` in GIS is documented to skip the consent screen *if the user has already granted consent*. But it can fail in several scenarios:
- User revoked the app's access in Google Account settings
- Browser cleared cookies/third-party storage
- Google's auth state expired or the user signed out of Google
- Cross-origin iframe restrictions block silent auth

When it fails, the callback receives an error response (not an access_token), and the code silently does nothing. The user's session eventually expires with no recovery path — they see an abrupt auth wall with no explanation.

**Fix in this pattern**: try `prompt: ''` first, and if it fails, show a non-disruptive "Session expiring — click to continue" banner that triggers an interactive re-auth on click. The user is never silently dead-ended.

#### 3. CacheService TTL behavior is undocumented (RELIABILITY)

The Improved pattern uses `cache.put(key, value, SESSION_EXPIRATION)` and treats the TTL as a hard expiry. Research revealed:
- CacheService is documented as *best-effort* — entries *may* be evicted before the TTL expires under memory pressure
- CacheService has a **maximum TTL of 21600 seconds (6 hours)** — values above this are silently clamped
- There is no `cache.getTimeToLive()` method — you cannot inspect remaining TTL

**Fix in this pattern**: document these caveats explicitly, use `createdAt` timestamps as the authoritative expiry check (not CacheService TTL alone), and add a dedicated section on CacheService behavioral caveats.

#### 4. Token exchange via URL parameter exposes access_token in server logs (SECURITY)

The Improved pattern sends the Google access_token as a URL parameter:
```javascript
iframe.src = _gasBaseUrl + '&exchangeToken=' + encodeURIComponent(accessToken);
```

**Problem**: URL parameters appear in server access logs, browser history, and the Referer header. While GAS doesn't expose access logs to the developer, Google's infrastructure logs the full URL — the access_token is persisted server-side in a location the developer cannot control or audit.

**Mitigation in this pattern**: document this as a known limitation of the GAS iframe architecture (there is no cleaner alternative for passing data to a GAS `doGet()` on first load). The token is short-lived (~1 hour) and exchanged immediately for a session token, limiting the exposure window. For maximum security, consider using `google.script.run` from within a GAS-served page instead (but this requires the initial page to be served by GAS, changing the architecture).

---

## 3. GAS vs HTML Responsibility Split

Unchanged from the Improved pattern — the split remains ~80% GAS / ~20% HTML. See [03-IMPROVED-GOOGLE-OAUTH-PATTERN.md § 3](03-IMPROVED-GOOGLE-OAUTH-PATTERN.md#3-gas-vs-html-responsibility-split) for the full table.

The only change is in the HTML wrapper's postMessage listener (origin validation is stricter) and silent re-auth (adds interactive fallback).

---

## 4. Authentication Flow

### Initial Sign-In

Same as the Improved pattern — see [03-IMPROVED-GOOGLE-OAUTH-PATTERN.md § 4](03-IMPROVED-GOOGLE-OAUTH-PATTERN.md#4-authentication-flow).

### Token Refresh (with Interactive Fallback)

This is the key flow change from the Improved pattern:

```
GAS receives request with session token
         │
         ▼
Look up session in CacheService
         │
         ▼
Check: is accessToken expiring soon?
(tokenObtainedAt + 45 min > now?)
    ┌─────┴─────┐
    No          Yes
    │            │
    ▼            ▼
Use existing  Set needsReauth flag
token         in sessionData
              Send gas-auth-ok with
              needsReauth: true
                   │
                   ▼
         ┌─────────────────────┐
         │ HTML wrapper:        │
         │ Try prompt: '' first │
         └───────┬─────────────┘
            ┌────┴────┐
         Success    Failure/Error
            │           │
            ▼           ▼
      Exchange      Show "Session expiring"
      new token     banner with "Continue"
      for session   button
                        │
                        ▼ (user clicks)
                    Interactive
                    GIS sign-in
                    (consent popup)
                        │
                        ▼
                    Exchange new
                    token for session
```

---

## 5. Implementation Guide — GAS Backend

> **All security logic lives here (~80% of auth system).** The code below is implementation-ready — copy it directly into your `.gs` file.

### Constants

```javascript
// =============================================
// AUTH CONSTANTS
// =============================================

var SESSION_EXPIRATION = 1800;     // 30 minutes in seconds
var SESSION_REFRESH_WINDOW = 300;  // Refresh token if <5 min remaining
var OAUTH_TOKEN_LIFETIME = 3600;   // Google access tokens last ~1 hour
var OAUTH_REFRESH_BUFFER = 900;    // Refresh Google token if <15 min remaining
var MAX_SESSIONS_PER_USER = 1;     // Set to 0 for unlimited

// CacheService limits (informational — do not change)
// Max TTL: 21600 seconds (6 hours) — values above are silently clamped
// Max value size: 100 KB
// Eviction: best-effort — entries MAY be evicted before TTL under memory pressure
```

### Session Management Functions

```javascript
// =============================================
// AUTH — Session Management (Server-Side)
// =============================================

/**
 * Exchange a Google access token for a server-side session token.
 * Called once during sign-in — the access token is validated,
 * a UUID session is created, and only the session token is
 * returned to the client.
 *
 * @param {string} accessToken - Google OAuth2 access token from GIS
 * @returns {Object} {success, sessionToken, email, displayName} or {success: false, error}
 */
function exchangeTokenForSession(accessToken) {
  if (!accessToken) {
    return { success: false, error: "no_token" };
  }

  // 1. Validate the access token with Google (server-side only)
  var userInfo = validateGoogleToken(accessToken);
  if (!userInfo || userInfo.status === "not_signed_in") {
    return { success: false, error: "invalid_token" };
  }

  // 2. Check authorization (spreadsheet access)
  if (!checkSpreadsheetAccess(userInfo.email)) {
    return { success: false, error: "not_authorized", email: userInfo.email };
  }

  // 3. Enforce single-session (optional)
  if (MAX_SESSIONS_PER_USER > 0) {
    invalidateAllSessions(userInfo.email);
  }

  // 4. Create session token (cryptographically random UUID)
  var sessionToken = Utilities.getUuid() + Utilities.getUuid();
  sessionToken = sessionToken.replace(/-/g, "").substring(0, 48);

  // 5. Store session data in CacheService
  //    NOTE: CacheService is best-effort — entries MAY be evicted before TTL.
  //    We use createdAt as the authoritative expiry check (belt-and-suspenders).
  var sessionData = {
    email: userInfo.email,
    displayName: userInfo.displayName,
    accessToken: accessToken,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    tokenObtainedAt: Date.now()
  };

  var cache = CacheService.getScriptCache();
  cache.put(
    "session_" + sessionToken,
    JSON.stringify(sessionData),
    SESSION_EXPIRATION
  );

  // 6. Track active sessions for this user (for single-session enforcement)
  trackUserSession(userInfo.email, sessionToken);

  return {
    success: true,
    sessionToken: sessionToken,
    email: userInfo.email,
    displayName: userInfo.displayName
  };
}

/**
 * Validate a session token and return the associated user info.
 * Called on every request that requires authentication.
 *
 * Uses createdAt as the authoritative expiry check — CacheService TTL
 * is a secondary failsafe (it may evict early under memory pressure).
 *
 * @param {string} sessionToken - The opaque session token from the client
 * @returns {Object} {status, email, displayName, needsReauth} or {status: "not_signed_in"}
 */
function validateSession(sessionToken) {
  if (!sessionToken || sessionToken.length < 32) {
    return { status: "not_signed_in" };
  }

  var cache = CacheService.getScriptCache();
  var raw = cache.get("session_" + sessionToken);
  if (!raw) {
    // CacheService evicted the entry (or TTL expired)
    return { status: "not_signed_in" };
  }

  var sessionData;
  try {
    sessionData = JSON.parse(raw);
  } catch (e) {
    return { status: "not_signed_in" };
  }

  // Authoritative expiry check using createdAt timestamp
  // This catches cases where CacheService hasn't evicted yet but the session
  // should logically be expired (e.g., if cache.put TTL was silently clamped)
  var elapsed = (Date.now() - sessionData.createdAt) / 1000;
  if (elapsed > SESSION_EXPIRATION) {
    cache.remove("session_" + sessionToken);
    return { status: "not_signed_in" };
  }

  // Check if Google token needs refresh (server-side, transparent to client)
  var needsReauth = checkGoogleTokenExpiry(sessionData);

  // Update last activity (extends the CacheService TTL)
  sessionData.lastActivity = Date.now();
  cache.put(
    "session_" + sessionToken,
    JSON.stringify(sessionData),
    SESSION_EXPIRATION  // Resets the TTL on every request
  );

  return {
    status: "authorized",
    email: sessionData.email,
    displayName: sessionData.displayName,
    needsReauth: needsReauth
  };
}

/**
 * Invalidate a specific session (sign-out).
 *
 * @param {string} sessionToken - The session token to invalidate
 */
function invalidateSession(sessionToken) {
  if (!sessionToken) return;
  var cache = CacheService.getScriptCache();

  // Read session data to get email for session tracking cleanup
  var raw = cache.get("session_" + sessionToken);
  if (raw) {
    try {
      var sessionData = JSON.parse(raw);
      removeUserSession(sessionData.email, sessionToken);
    } catch (e) {}
  }

  cache.remove("session_" + sessionToken);
}

/**
 * Invalidate all sessions for a user (single-session enforcement).
 *
 * @param {string} email - The user's email address
 */
function invalidateAllSessions(email) {
  if (!email) return;
  var cache = CacheService.getScriptCache();
  var trackKey = "sessions_" + email.toLowerCase();
  var raw = cache.get(trackKey);
  if (!raw) return;

  try {
    var tokens = JSON.parse(raw);
    for (var i = 0; i < tokens.length; i++) {
      cache.remove("session_" + tokens[i]);
    }
  } catch (e) {}

  cache.remove(trackKey);
}
```

### Google Token Validation & Expiry Check

```javascript
// =============================================
// AUTH — Google Token Operations (Server-Side Only)
// =============================================

/**
 * Validate a Google access token by calling the userinfo API.
 * This is the ONLY place where the Google token is used —
 * it never leaves the GAS server.
 *
 * @param {string} accessToken - Google OAuth2 access token
 * @returns {Object} {status, email, displayName} or {status: "not_signed_in"}
 */
function validateGoogleToken(accessToken) {
  try {
    var resp = UrlFetchApp.fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { "Authorization": "Bearer " + accessToken },
        muteHttpExceptions: true
      }
    );

    if (resp.getResponseCode() !== 200) {
      return { status: "not_signed_in" };
    }

    var info = JSON.parse(resp.getContentText());
    if (!info.email) {
      return { status: "not_signed_in" };
    }

    var prefix = info.email.split("@")[0];
    var displayName = prefix.split(/[._-]/).map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(" ");

    return {
      status: "authorized",
      email: info.email,
      displayName: displayName
    };
  } catch (e) {
    return { status: "not_signed_in" };
  }
}

/**
 * Check if a Google access token is expiring soon.
 * Returns true if re-auth is needed — the caller includes this
 * flag in the response so the HTML wrapper can trigger re-auth.
 *
 * NOTE: Unlike the Improved pattern, this function does NOT modify
 * sessionData — it only checks and returns a boolean. The mutation
 * was removed because setting a needsReauth flag on sessionData
 * would require an extra cache.put() and the flag is only consumed
 * by the postMessage response anyway (not by subsequent GAS calls).
 *
 * @param {Object} sessionData - The session data from CacheService
 * @returns {boolean} True if re-auth is needed
 */
function checkGoogleTokenExpiry(sessionData) {
  var tokenAge = (Date.now() - sessionData.tokenObtainedAt) / 1000;
  return tokenAge >= (OAUTH_TOKEN_LIFETIME - OAUTH_REFRESH_BUFFER);
}
```

### Session Tracking Helpers

```javascript
// =============================================
// AUTH — Session Tracking (for single-session enforcement)
// =============================================

/**
 * Track a session token for a user (for single-session enforcement).
 */
function trackUserSession(email, sessionToken) {
  var cache = CacheService.getScriptCache();
  var trackKey = "sessions_" + email.toLowerCase();
  var raw = cache.get(trackKey);
  var tokens = [];
  if (raw) {
    try { tokens = JSON.parse(raw); } catch (e) {}
  }
  tokens.push(sessionToken);
  cache.put(trackKey, JSON.stringify(tokens), SESSION_EXPIRATION);
}

/**
 * Remove a session token from a user's tracked sessions.
 */
function removeUserSession(email, sessionToken) {
  if (!email) return;
  var cache = CacheService.getScriptCache();
  var trackKey = "sessions_" + email.toLowerCase();
  var raw = cache.get(trackKey);
  if (!raw) return;
  try {
    var tokens = JSON.parse(raw);
    tokens = tokens.filter(function(t) { return t !== sessionToken; });
    if (tokens.length > 0) {
      cache.put(trackKey, JSON.stringify(tokens), SESSION_EXPIRATION);
    } else {
      cache.remove(trackKey);
    }
  } catch (e) {}
}
```

### Authorization Check

```javascript
// =============================================
// AUTH — Authorization (Spreadsheet Access)
// =============================================

/**
 * Check if an email has access to the project spreadsheet.
 * Uses editors + viewers list as the authorization source.
 * Results cached for 10 minutes.
 *
 * @param {string} email - The user's email
 * @param {Object} opt_ss - Optional SpreadsheetApp reference
 * @returns {boolean} True if user has access
 */
function checkSpreadsheetAccess(email, opt_ss) {
  if (!email) return false;
  var lowerEmail = email.toLowerCase();

  var cache = CacheService.getScriptCache();
  var cacheKey = "access_" + lowerEmail;
  var cached = cache.get(cacheKey);
  if (cached !== null) return cached === "1";

  var ss = opt_ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  var editors = ss.getEditors();
  for (var i = 0; i < editors.length; i++) {
    if (editors[i].getEmail().toLowerCase() === lowerEmail) {
      cache.put(cacheKey, "1", 600);
      return true;
    }
  }
  var viewers = ss.getViewers();
  for (var i = 0; i < viewers.length; i++) {
    if (viewers[i].getEmail().toLowerCase() === lowerEmail) {
      cache.put(cacheKey, "1", 600);
      return true;
    }
  }

  cache.put(cacheKey, "0", 600);
  return false;
}
```

### Web App Entry Point

```javascript
// =============================================
// WEB APP ENTRY POINT
// =============================================

function doGet(e) {
  var sessionToken = (e && e.parameter && e.parameter.session) || "";
  var exchangeToken = (e && e.parameter && e.parameter.exchangeToken) || "";
  var signOutToken = (e && e.parameter && e.parameter.signOut) || "";

  // Sign-out flow: invalidate session and return confirmation page
  if (signOutToken) {
    invalidateSession(signOutToken);
    var html = '<!DOCTYPE html><html><body><script>'
      + 'window.parent.postMessage('
      + JSON.stringify({ type: "gas-signed-out", success: true })
      + ', "*");'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(html)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Token exchange flow: client sends Google access token, gets session token back
  if (exchangeToken) {
    var result = exchangeTokenForSession(exchangeToken);
    var html = '<!DOCTYPE html><html><body><script>'
      + 'window.parent.postMessage('
      + JSON.stringify({
          type: "gas-session-created",
          success: result.success,
          sessionToken: result.sessionToken || "",
          email: result.email || "",
          displayName: result.displayName || "",
          error: result.error || ""
        })
      + ', "*");'
      + '</' + 'script></body></html>';
    return HtmlService.createHtmlOutput(html)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Normal flow: validate session token
  var html = buildFormHtml(sessionToken);
  return HtmlService.createHtmlOutput(html)
    .setTitle(TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

### Auth Gate Pattern (for Data Functions)

```javascript
// =============================================
// AUTH GATE — Use in every server function that returns data
// =============================================

/**
 * Example: getFormData — validates session before returning data.
 * The needsReauth flag is included in the response so the
 * client-side postMessage handler can trigger re-auth.
 */
function getFormData(opt_sessionToken) {
  // 1. Validate session
  var session = validateSession(opt_sessionToken);

  // 2. Auth gate
  if (session.status !== "authorized") {
    return {
      authorized: false,
      authStatus: session.status,
      email: session.email || "",
      version: VERSION
    };
  }

  // 3. Double-check spreadsheet access (re-validates periodically via cache)
  if (!checkSpreadsheetAccess(session.email)) {
    return {
      authorized: false,
      authStatus: "no_spreadsheet_access",
      email: session.email,
      version: VERSION
    };
  }

  // 4. Proceed with data retrieval
  // ... your data logic here ...
  return {
    authorized: true,
    email: session.email,
    displayName: session.displayName,
    needsReauth: session.needsReauth || false,
    version: VERSION,
    data: {} // your data
  };
}

/**
 * Server-side sign-out: invalidate session and return confirmation.
 */
function serverSignOut(sessionToken) {
  invalidateSession(sessionToken);
  return { success: true };
}
```

---

## 6. Implementation Guide — HTML Shell

> **This section contains the ~20% of auth logic that must live in the browser.** Key differences from the Improved pattern: strict origin validation, interactive re-auth fallback, and re-auth banner UI.

### GIS Sign-In (Browser-Only — Cannot Move to GAS)

```javascript
// =============================================
// SIGN-IN — Exchange access token for session token
// =============================================

var _gasBaseUrl = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
var _sessionToken = localStorage.getItem('session-token') || '';
var _clientId = 'YOUR_CLIENT_ID.apps.googleusercontent.com';

function triggerGisSignIn() {
  loadGis(function() {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: _clientId,
      scope: 'email profile',
      callback: function(resp) {
        if (resp && resp.access_token) {
          // DO NOT store the access token in localStorage.
          // Instead, send it to GAS for exchange.
          exchangeForSession(resp.access_token);
        }
      }
    });
    client.requestAccessToken();
  });
}

/**
 * Send the Google access token to GAS to exchange for a session token.
 * The access token is sent as a URL parameter to the GAS iframe —
 * GAS validates it server-side and returns a session token via postMessage.
 *
 * NOTE: URL parameters appear in server logs. The access_token is short-lived
 * (~1 hour) and exchanged immediately, limiting the exposure window.
 * There is no cleaner alternative for passing data to a GAS doGet() on first load.
 */
function exchangeForSession(accessToken) {
  var iframe = document.getElementById('gas-app');
  iframe.src = _gasBaseUrl + (_gasBaseUrl.indexOf('?') > -1 ? '&' : '?')
    + 'exchangeToken=' + encodeURIComponent(accessToken);
}
```

### postMessage Handler — Strict Origin Validation (CHANGED)

```javascript
// =============================================
// postMessage — STRICT origin-validated message handling
// =============================================
// RESEARCH FIX: Uses hostname suffix match instead of String.includes()
// to prevent bypass via domains like evil-googleusercontent.com
// or googleusercontent.com.evil.com

window.addEventListener('message', function(e) {
  if (!e.data || !e.origin) return;  // Reject messages with no origin

  // STRICT ORIGIN VALIDATION
  // GAS iframes serve content from *.googleusercontent.com subdomains
  // (e.g., script.googleusercontent.com or hash-based subdomains)
  var hostname = '';
  try {
    hostname = new URL(e.origin).hostname;
  } catch (_) {
    return; // Malformed origin — reject
  }

  if (!hostname.endsWith('.googleusercontent.com') &&
      hostname !== 'googleusercontent.com') {
    return; // Not a Google Apps Script origin — reject
  }

  switch (e.data.type) {
    case 'gas-session-created':
      handleSessionCreated(e.data);
      break;

    case 'gas-needs-auth':
      showAuthWall(e.data.authStatus, e.data.email, e.data.version);
      break;

    case 'gas-auth-ok':
      handleAuthOk(e.data);
      break;

    case 'gas-needs-reauth':
      // Server says Google token is expiring — attempt re-auth
      attemptReauth();
      break;

    case 'gas-signed-out':
      // Server confirmed sign-out — auth wall is already shown
      break;

    case 'gas-reload':
      handleReload();
      break;

    case 'manual-reload':
      window.location.reload();
      break;
  }
});

function handleSessionCreated(data) {
  if (data.success && data.sessionToken) {
    // Store ONLY the opaque session token (not the Google token)
    localStorage.setItem('session-token', data.sessionToken);
    _sessionToken = data.sessionToken;

    if (data.email) localStorage.setItem('session-email', data.email);

    // Dismiss re-auth banner if showing
    dismissReauthBanner();

    // Hide auth wall and reload iframe with session token
    document.getElementById('auth-wall').classList.remove('show');
    document.getElementById('sign-out-btn').style.display = '';
    reloadIframe();
  } else {
    // Exchange failed — show appropriate auth wall
    showAuthWall(data.error, data.email);
  }
}

function handleAuthOk(data) {
  if (data.version) {
    _gasVersion = data.version;
    localStorage.setItem('gas-version', data.version);
  }
  document.getElementById('sign-out-btn').style.display = '';

  // Check if server flagged re-auth needed
  if (data.needsReauth) {
    attemptReauth();
  }
}
```

### Re-Authentication with Interactive Fallback (CHANGED)

```javascript
// =============================================
// RE-AUTH — Silent first, interactive fallback
// =============================================
// RESEARCH FIX: prompt: '' (silent re-auth) can fail in several scenarios:
// - User revoked app access in Google Account settings
// - Browser cleared cookies/third-party storage
// - Google auth state expired
// - Cross-origin iframe restrictions
//
// The Improved pattern silently swallowed these failures.
// This pattern tries silent first, then shows a non-disruptive banner
// with a "Continue" button for interactive re-auth.

var _reauthInProgress = false;

/**
 * Attempt re-authentication: silent first, interactive fallback.
 */
function attemptReauth() {
  if (_reauthInProgress) return;
  _reauthInProgress = true;

  loadGis(function() {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: _clientId,
      scope: 'email profile',
      prompt: '',  // Empty prompt = try silent auth (no consent popup)
      callback: function(resp) {
        _reauthInProgress = false;

        if (resp && resp.access_token) {
          // Silent re-auth succeeded — exchange for new session
          exchangeForSession(resp.access_token);
          dismissReauthBanner();
        } else {
          // Silent re-auth failed — show non-disruptive banner
          // The user's current session continues until TTL expires
          showReauthBanner();
        }
      },
      error_callback: function(err) {
        // GIS error (e.g., popup_failed_to_open, popup_closed)
        _reauthInProgress = false;
        showReauthBanner();
      }
    });

    client.requestAccessToken();
  });
}

/**
 * Interactive re-auth — triggered when user clicks the banner button.
 * Uses the normal consent flow (no prompt override).
 */
function interactiveReauth() {
  dismissReauthBanner();

  loadGis(function() {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: _clientId,
      scope: 'email profile',
      // No prompt parameter = default behavior (shows consent if needed)
      callback: function(resp) {
        if (resp && resp.access_token) {
          exchangeForSession(resp.access_token);
        }
        // If user closes the popup, they keep their current session
        // until it expires — no further action needed
      }
    });
    client.requestAccessToken();
  });
}

/**
 * Show a non-disruptive re-auth banner at the top of the page.
 * Does NOT block the app — the user can continue working.
 * The banner has a "Continue" button that opens the interactive flow.
 */
function showReauthBanner() {
  var existing = document.getElementById('reauth-banner');
  if (existing) { existing.style.display = 'flex'; return; }

  var banner = document.createElement('div');
  banner.id = 'reauth-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100000;'
    + 'background:#FFF3CD;color:#856404;padding:10px 16px;display:flex;'
    + 'align-items:center;justify-content:space-between;font-family:sans-serif;'
    + 'font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.1);';
  banner.innerHTML = '<span>Your session is expiring soon. '
    + 'Click <strong>Continue</strong> to stay signed in.</span>'
    + '<button onclick="interactiveReauth()" style="background:#856404;color:#fff;'
    + 'border:none;padding:6px 16px;border-radius:4px;cursor:pointer;'
    + 'font-size:14px;margin-left:12px;">Continue</button>'
    + '<button onclick="dismissReauthBanner()" style="background:none;border:none;'
    + 'cursor:pointer;font-size:18px;color:#856404;margin-left:8px;">&times;</button>';
  document.body.appendChild(banner);
}

function dismissReauthBanner() {
  var banner = document.getElementById('reauth-banner');
  if (banner) banner.style.display = 'none';
}
```

### Iframe Loading (Browser-Only)

```javascript
// =============================================
// IFRAME — Load GAS app with session token
// =============================================

function reloadIframe() {
  var iframe = document.getElementById('gas-app');
  if (!_gasBaseUrl || _gasBaseUrl === '') return;

  var url = _gasBaseUrl;
  if (_sessionToken) {
    url += (url.indexOf('?') > -1 ? '&' : '?') + 'session=' + encodeURIComponent(_sessionToken);
  }
  iframe.src = url;
}
```

### Sign-Out (Triggers Server-Side Invalidation)

```javascript
// =============================================
// SIGN-OUT — Server-side session invalidation
// =============================================

function signOut() {
  var confirmed = confirm('Sign out of this application?');
  if (!confirmed) return;

  // 1. Invalidate session on the server via iframe reload
  var iframe = document.getElementById('gas-app');
  iframe.src = _gasBaseUrl + (_gasBaseUrl.indexOf('?') > -1 ? '&' : '?')
    + 'signOut=' + encodeURIComponent(_sessionToken);

  // 2. Clear client-side state
  localStorage.removeItem('session-token');
  localStorage.removeItem('session-email');
  _sessionToken = '';

  // 3. Dismiss any re-auth banner
  dismissReauthBanner();

  // 4. Show auth wall
  showAuthWall('not_signed_in', '');
}
```

### Optional: Inactivity Timeout

Same as the Improved pattern — see [03-IMPROVED-GOOGLE-OAUTH-PATTERN.md § 6](03-IMPROVED-GOOGLE-OAUTH-PATTERN.md#6-implementation-guide--minimal-html-shell) for the inactivity timeout code.

---

## 7. postMessage Protocol

### Messages FROM GAS iframe TO HTML wrapper

| Message Type | When Sent | Data Fields | Wrapper Action |
|-------------|-----------|-------------|----------------|
| `gas-session-created` | After token exchange | `{success, sessionToken, email, displayName, error}` | Store session token, reload iframe |
| `gas-needs-auth` | Session invalid or expired | `{authStatus, email, version}` | Show auth wall |
| `gas-auth-ok` | Session valid, app loaded | `{version, needsReauth}` | Show sign-out button, trigger re-auth if needed |
| `gas-needs-reauth` | Google token expiring soon | `{}` | Run `attemptReauth()` (silent → interactive fallback) |
| `gas-signed-out` | Session invalidated on server | `{success}` | Confirmation (auth wall already shown) |
| `gas-reload` | GAS self-update detected | `{}` | Reload page (with debounce) |
| `manual-reload` | User triggered reload from GAS | `{}` | Reload page |

### Messages FROM HTML wrapper TO GAS iframe

Communication from wrapper to GAS happens via URL parameters on iframe reload (no direct postMessage to GAS):
- `?session=UUID` — pass session token for validation
- `?exchangeToken=ACCESS_TOKEN` — one-time token exchange (sign-in)
- `?signOut=UUID` — invalidate session (sign-out)

### Origin Validation (CHANGED from Improved Pattern)

```javascript
// STRICT — suffix match on hostname (not substring match)
var hostname = '';
try { hostname = new URL(e.origin).hostname; } catch (_) { return; }
if (!hostname.endsWith('.googleusercontent.com') &&
    hostname !== 'googleusercontent.com') {
  return;
}
```

**Why this is better than `e.origin.includes('googleusercontent.com')`:**

| Attack Vector | `includes()` (Improved) | `endsWith()` (This) |
|---------------|------------------------|---------------------|
| `evil-googleusercontent.com` | PASSES (substring match) | FAILS (not a suffix) |
| `googleusercontent.com.evil.com` | PASSES (substring match) | FAILS (not a suffix) |
| `evil.com?googleusercontent.com` | PASSES (substring match) | FAILS (parsed hostname) |
| `script.googleusercontent.com` | PASSES | PASSES |
| `abc123-hash.googleusercontent.com` | PASSES | PASSES |
| Empty/missing origin | PASSES (`e.origin &&` guard) | FAILS (`!e.origin` check) |

---

## 8. CacheService Behavioral Caveats

These caveats are based on Google's documentation and observed behavior. They affect session reliability and should be understood when implementing this pattern.

### TTL Is Best-Effort

CacheService documentation states entries are cached for "at least" the specified number of seconds but may be evicted earlier under memory pressure. In practice, eviction before TTL is rare but possible — especially on high-traffic scripts.

**Mitigation**: use `createdAt` timestamps as the authoritative expiry check. If `cache.get()` returns `null` but the session should logically still be valid, the session is treated as expired (fail-safe behavior — better to re-authenticate than to serve stale data).

### Maximum TTL Is 21600 Seconds (6 Hours)

`cache.put(key, value, expirationInSeconds)` accepts values up to 21600 (6 hours). Values above this are silently clamped to 21600 — no error is thrown.

**Implication**: `SESSION_EXPIRATION` must be ≤21600. For auth sessions, 1800 (30 minutes) is the recommended default. Setting it above 21600 would silently create sessions that expire at 6 hours regardless of the configured value.

### Maximum Value Size Is 100 KB

`cache.put()` accepts values up to 100 KB (100,000 characters). Session data is typically well under this limit (~200-500 bytes JSON). This is only relevant if you add large data to the session object.

### No `getTimeToLive()` Method

There is no way to inspect the remaining TTL of a cached entry. You cannot determine how close a session is to CacheService eviction. This is why `createdAt` and `lastActivity` timestamps are stored in the session data — they provide the TTL-equivalent information that CacheService does not expose.

### Quota Limits

- `CacheService.getScriptCache()` — shared across all users of the script (not per-user)
- Read/write operations count against the Apps Script daily quotas
- For high-traffic apps, consider that every authenticated request reads and writes to the cache (session validation + activity update)

### CacheService vs PropertiesService

| Feature | CacheService | PropertiesService |
|---------|-------------|-------------------|
| **TTL/Eviction** | Auto-expires (configurable TTL, max 6h) | Permanent (until explicitly deleted) |
| **Speed** | Fast (in-memory cache layer) | Slower (persistent storage) |
| **Best for** | Session tokens (ephemeral, auto-expiring) | Config values, user preferences |
| **Max value size** | 100 KB | 9 KB |
| **Reliability** | Best-effort (may evict early) | Guaranteed persistence |

**Recommendation**: use CacheService for session data (auto-expiry is a feature, not a limitation — it ensures abandoned sessions are cleaned up automatically). Use PropertiesService for data that must survive across script restarts (e.g., configuration, user preferences).

---

## 9. Security Checklist

Before deploying a project using this pattern, verify:

### Server-Side (GAS)
- [ ] `exchangeTokenForSession()` validates the Google token with Google's API before creating a session
- [ ] Session tokens are generated using `Utilities.getUuid()` (cryptographically random)
- [ ] `SESSION_EXPIRATION` is set to ≤21600 (CacheService max; recommend ≤1800 for sensitive apps)
- [ ] `createdAt` is used as the authoritative expiry check (not just CacheService TTL)
- [ ] Every data function uses the auth gate pattern (validates session before returning data)
- [ ] `checkSpreadsheetAccess()` is called on every auth check (not just initial sign-in)
- [ ] `invalidateSession()` removes the session from CacheService (not just localStorage)
- [ ] `MAX_SESSIONS_PER_USER` is set to 1 for sensitive apps (single-session enforcement)
- [ ] `needsReauth` flag is included in `gas-auth-ok` responses when token is expiring

### Client-Side (HTML Shell)
- [ ] `access_token` from GIS is NEVER stored in localStorage — only the opaque session token
- [ ] `access_token` is passed to GAS via URL parameter (one-time exchange), then discarded
- [ ] postMessage handler validates `e.origin` using **hostname suffix match** (not `includes()`)
- [ ] postMessage handler rejects messages with empty/missing `e.origin`
- [ ] Silent re-auth (`prompt: ''`) has an interactive fallback (re-auth banner)
- [ ] Sign-out calls server-side invalidation (not just `localStorage.removeItem()`)
- [ ] Inactivity timeout (if used) is shorter than the server-side session TTL
- [ ] No client-side calls to `googleapis.com` — all Google API calls happen in GAS
- [ ] No token validation logic in the HTML — the wrapper never inspects or validates tokens
- [ ] No authorization logic in the HTML — the wrapper never checks who has access

### OAuth Configuration
- [ ] Google Cloud Console OAuth consent screen is configured for the correct scopes
- [ ] Authorized JavaScript origins include the wrapper's domain (GitHub Pages or custom)
- [ ] `client_id` is correct for the deployment environment
- [ ] Only `email` and `profile` scopes are requested (minimum necessary)

---

## 10. Migration Guide

### Migrating from the Basic Google OAuth Pattern

Follow the same steps as [03-IMPROVED-GOOGLE-OAUTH-PATTERN.md § 9](03-IMPROVED-GOOGLE-OAUTH-PATTERN.md#9-migration-guide), plus these additional changes:

#### Additional: Update Origin Validation

Replace:
```javascript
if (e.origin && !e.origin.includes('googleusercontent.com')) {
  return;
}
```

With:
```javascript
if (!e.origin) return;
var hostname = '';
try { hostname = new URL(e.origin).hostname; } catch (_) { return; }
if (!hostname.endsWith('.googleusercontent.com') &&
    hostname !== 'googleusercontent.com') {
  return;
}
```

#### Additional: Add Re-Auth Fallback

Replace `silentReauth()` with `attemptReauth()` and add the `interactiveReauth()`, `showReauthBanner()`, and `dismissReauthBanner()` functions from Section 6.

### Migrating from the Improved Pattern

If you already implemented the Improved pattern and want to upgrade to this version:

1. **Origin validation** — replace the `includes()` check with the `endsWith()` check (see above)
2. **Re-auth** — replace `silentReauth()` with `attemptReauth()` and add the banner functions
3. **GAS `refreshGoogleTokenIfNeeded()`** — replace with `checkGoogleTokenExpiry()` (simpler — returns boolean instead of mutating sessionData)
4. **GAS `validateSession()`** — update to include `needsReauth` in the return object
5. **GAS `doGet()`** — add the `signOut` parameter handler
6. **CacheService comments** — add the caveat comments to `exchangeTokenForSession()` and `validateSession()`

---

## 11. Four-Pattern Comparison

| Feature | Custom Auth | Basic Google OAuth | Improved Google OAuth | **Researched Improved** |
|---------|-------------|--------------------|-----------------------|--------------------------|
| **Identity source** | Username/password in Sheets | Google account (GIS) | Google account (GIS) | Google account (GIS) |
| **Token in localStorage** | Custom UUID | Raw access_token | Opaque UUID | Opaque UUID |
| **Server-side sessions** | Yes (CacheService) | No | Yes (CacheService) | Yes (CacheService) |
| **Token validation** | Server-side only | Client + Server | Server-side only | Server-side only |
| **Session TTL** | 15 min | Unlimited | 30 min | 30 min |
| **Token refresh** | N/A | None (silent failure) | Silent only | **Silent + interactive fallback** |
| **Single-session enforcement** | Yes | No | Optional | Optional |
| **Origin validation** | Partial | None | `includes()` (bypassable) | **`endsWith()` (strict)** |
| **Origin empty check** | No | No | No (`e.origin &&` passes) | **Yes (rejects empty)** |
| **Server-side sign-out** | Yes | No | Yes | Yes |
| **XSS token exposure** | Low (opaque UUID) | High (real Google token) | Low (opaque UUID) | Low (opaque UUID) |
| **CacheService caveats documented** | No | N/A | No | **Yes** |
| **Re-auth failure handling** | N/A | None | Silent swallow | **Banner with fallback** |
| **Auth logic in GAS** | ~90% | ~40% | ~80% | ~80% |
| **Auth logic in HTML** | ~10% | ~60% | ~20% | ~20% |
| **Best for** | Custom credentials | Simple internal tools | Production internal tools | **Production (security-hardened)** |

---

## 12. Delta from Improved Pattern

Exact list of changes from `03-IMPROVED-GOOGLE-OAUTH-PATTERN.md` and the rationale for each:

### Security Fixes

| Change | Location | Rationale |
|--------|----------|-----------|
| Origin validation: `includes()` → `endsWith()` on parsed hostname | HTML postMessage handler | `includes()` is a substring match — an attacker domain like `evil-googleusercontent.com` passes it. `endsWith()` on the parsed hostname ensures only actual subdomains of `googleusercontent.com` are accepted |
| Reject empty `e.origin` | HTML postMessage handler | The Improved pattern's `e.origin &&` guard silently accepts messages with undefined/empty origin. This pattern requires `e.origin` to be present and parseable |
| Document URL parameter token exposure | Section 2, exchangeForSession comments | The access_token appears in server logs when sent as a URL parameter. This is a known limitation of the GAS iframe architecture — documented so implementers understand the tradeoff |

### UX Improvements

| Change | Location | Rationale |
|--------|----------|-----------|
| Interactive re-auth fallback | HTML `attemptReauth()`, `interactiveReauth()`, banner functions | `prompt: ''` (silent re-auth) can fail in several scenarios (revoked access, cleared cookies, expired Google session). The Improved pattern silently swallows these failures — the user's session expires with no recovery path. This pattern shows a non-disruptive banner with a "Continue" button |
| `error_callback` handler on GIS client | HTML `attemptReauth()` | GIS can fire error_callback instead of callback in some failure modes (e.g., popup blocked). The Improved pattern doesn't handle this |
| `gas-signed-out` message type | GAS doGet, HTML postMessage handler | Sign-out confirmation from server to client. The Improved pattern fires the iframe reload but doesn't confirm completion |

### Architecture Improvements

| Change | Location | Rationale |
|--------|----------|-----------|
| `refreshGoogleTokenIfNeeded()` → `checkGoogleTokenExpiry()` | GAS backend | The Improved pattern's function mutates `sessionData` and does a `cache.put()` just to set a `needsReauth` flag that's only consumed by the postMessage response. This pattern simplifies it to a pure boolean function — no side effects, no extra cache write |
| `needsReauth` returned from `validateSession()` | GAS backend | Moved from being a flag on `sessionData` (requiring a separate cache write) to being part of the `validateSession()` return object. Cleaner data flow — the calling function decides what to do with the flag |
| CacheService caveats section | Section 8 | New section documenting best-effort eviction, max TTL (21600s), max value size (100KB), and no `getTimeToLive()`. These behaviors affect session reliability and are not obvious from the API surface |
| `_clientId` variable | HTML shell | Extracted `client_id` to a single variable (`_clientId`) at the top, referenced by both `triggerGisSignIn()` and `attemptReauth()`. The Improved pattern hardcodes the client_id string in two places |
| URL parameter separator handling | HTML `exchangeForSession()`, `signOut()` | Added proper `?`/`&` separator detection (checks if URL already contains `?`). The Improved pattern assumes `&` which fails if the GAS URL has no existing query parameters |

### Documentation Additions

| Change | Location | Rationale |
|--------|----------|-----------|
| CacheService Behavioral Caveats (Section 8) | New section | Consolidates all CacheService gotchas in one place |
| Four-Pattern Comparison (Section 11) | Extended table | Adds this pattern as a fourth column to the comparison |
| Delta from Improved Pattern (this section) | New section | Makes it easy to understand exactly what changed and why |
| Comments on CacheService best-effort behavior | GAS `exchangeTokenForSession()`, `validateSession()` | Inline documentation of the cache reliability caveats |

---

## 13. Troubleshooting

### Common Issues

**"Session expired" immediately after sign-in**
- Check that `SESSION_EXPIRATION` is ≤21600 (CacheService max — values above are silently clamped)
- Verify the session token is being stored correctly in localStorage
- Check that the iframe URL includes `?session=` (not `?token=`)
- If this happens sporadically, CacheService may be evicting under memory pressure — this is expected behavior

**Silent re-auth fails and banner appears**
- This is the expected fallback behavior — the user clicks "Continue" and completes an interactive re-auth
- If this happens on every request (not just occasionally), check:
  - User may have revoked the app's access in Google Account settings → they need to re-grant access
  - Browser may be blocking third-party cookies → silent GIS auth requires cookies
  - `client_id` must match between `triggerGisSignIn()` and `attemptReauth()` — use the `_clientId` variable

**Origin validation rejects legitimate GAS messages**
- GAS iframe origins vary by deployment — check the actual origin in browser DevTools (Network tab → select the iframe request → check the `Origin` header)
- Common legitimate origins: `script.googleusercontent.com`, `HASH.googleusercontent.com`
- If you find a legitimate Google origin that doesn't match `*.googleusercontent.com`, the validation needs updating — report it as a pattern issue

**Session not persisting across page reloads**
- Verify `localStorage.setItem('session-token', ...)` is called after successful exchange
- Check that `reloadIframe()` appends `?session=` to the URL
- Ensure the GAS `doGet()` reads `e.parameter.session` (not `e.parameter.token`)

**CacheService evicts sessions before TTL**
- This is documented behavior (best-effort TTL) — usually happens under high memory pressure
- The user simply sees "Session expired" and re-authenticates
- If this happens frequently, consider reducing the session data size (remove unnecessary fields)
- Do NOT switch to PropertiesService for sessions — you'd lose auto-expiry and have to manually clean up stale sessions

**Google token expires but no re-auth happens**
- Verify `checkGoogleTokenExpiry()` is called during `validateSession()`
- Check that the `needsReauth` flag is included in `gas-auth-ok` messages from the GAS inline HTML
- Verify the wrapper's `attemptReauth()` function is wired to both the `gas-needs-reauth` message and the `gas-auth-ok` `needsReauth` flag

Developed by: LightAISolutions

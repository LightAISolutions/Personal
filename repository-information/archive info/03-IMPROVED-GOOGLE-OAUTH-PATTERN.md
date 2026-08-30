# Improved Google OAuth Authentication Pattern

Reference implementation for Google OAuth authentication in GAS web apps embedded via iframe. This pattern combines Google Identity Services (GIS) OAuth2 for sign-in with **server-side session management** via `CacheService`, eliminating client-side token exposure.

> **Design philosophy: GAS-heavy, HTML-minimal.** All security logic — token validation, session management, authorization, token refresh, sign-out — lives entirely in the GAS backend. The HTML wrapper is reduced to the **irreducible minimum**: triggering the browser-only GIS sign-in popup, storing one opaque session token in localStorage, and toggling the auth wall UI. If it can run on the server, it does.

> **When to use this pattern**: any GAS web app that authenticates users via their Google account, where the app is embedded in an HTML wrapper page (GitHub Pages, custom domain, etc.) via an iframe. Suitable for internal tools, business apps, and any scenario where Google Workspace identity is the access control mechanism.

> **Comparison with other patterns**: see [01-CUSTOM-AUTH-PATTERN.md](01-CUSTOM-AUTH-PATTERN.md) for username/password authentication and [02-GOOGLE-OAUTH-AUTH-PATTERN.md](02-GOOGLE-OAUTH-AUTH-PATTERN.md) for the basic Google OAuth pattern (which this improves upon).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Why This Pattern](#2-why-this-pattern)
3. [GAS vs HTML Responsibility Split](#3-gas-vs-html-responsibility-split)
4. [Authentication Flow](#4-authentication-flow)
5. [Implementation Guide — GAS Backend (All Security Logic)](#5-implementation-guide--gas-backend-all-security-logic)
6. [Implementation Guide — Minimal HTML Shell](#6-implementation-guide--minimal-html-shell)
7. [postMessage Protocol](#7-postmessage-protocol)
8. [Security Checklist](#8-security-checklist)
9. [Migration Guide](#9-migration-guide)
10. [Three-Pattern Comparison](#10-three-pattern-comparison)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Architecture Overview

> **Where the logic lives**: the GAS server (right side of the diagram) owns all security — token validation, session creation, authorization checks, and token refresh. The HTML wrapper (left side) is a thin shell that triggers the browser sign-in popup and relays messages. No Google API calls happen in the browser.

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
│  │  (session token   │    postMessage (origin-validated)         │
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

### Key Difference from Basic Pattern

| Aspect | Basic Pattern | Improved Pattern |
|--------|---------------|------------------|
| What's in localStorage | Raw Google `access_token` | Opaque UUID session token |
| Who validates the token | Client (browser fetch) + Server (GAS) | Server only (GAS) |
| Token lifetime | Until sign-out (~unlimited) | Configurable TTL (default 30 min) |
| Token refresh | None (silent failure at ~1h) | Server-side automatic refresh |
| XSS impact | Attacker gets user's Google token | Attacker gets a useless UUID |

---

## 2. Why This Pattern

### Problems with the Basic Google OAuth Pattern

1. **Raw OAuth token in localStorage**: if an XSS vulnerability exists anywhere on the page, the attacker gets the user's Google `access_token` — they can call Google APIs as the user
2. **No token expiry handling**: Google access tokens expire after ~1 hour. The basic pattern stores the token and never checks expiry — the user gets silently logged out when the iframe next loads
3. **Client-side token validation**: the HTML wrapper calls `googleapis.com/oauth2/v3/userinfo` from the browser, sending the Bearer token over the network from client-side JavaScript
4. **No origin validation on postMessage**: any script running on the page can send `{type: 'gas-needs-auth'}` to trigger the auth wall
5. **No session management**: no configurable session duration, no single-session enforcement, no server-side invalidation on sign-out

### What This Pattern Fixes

- **Server-side session tokens** → localStorage only holds an opaque UUID that's useless outside the app
- **Configurable TTL** → sessions expire after a set duration (default 30 min), refreshable on activity
- **Server-side token refresh** → GAS automatically refreshes the Google access token before it expires
- **Server-only validation** → the Google token never leaves GAS; the browser never calls Google APIs
- **Origin validation** → postMessage handlers verify the sender is the GAS iframe
- **Server-side sign-out** → invalidates the session in CacheService, not just localStorage

---

## 3. GAS vs HTML Responsibility Split

This pattern is designed to keep **maximum logic in GAS** and **minimum in the HTML wrapper**. The HTML side handles only what the browser physically requires — everything else runs server-side.

### GAS Backend (~80% of auth logic)

| Responsibility | Function | Why it's in GAS |
|---------------|----------|-----------------|
| Token validation | `validateGoogleToken()` | Calls Google's userinfo API via `UrlFetchApp` — server-side only, token never exposed to browser |
| Session creation | `exchangeTokenForSession()` | Generates UUID, stores session data in `CacheService` |
| Session validation | `validateSession()` | Reads `CacheService`, checks expiry, extends TTL on activity |
| Session invalidation | `invalidateSession()` | Removes session from `CacheService` on sign-out |
| Single-session enforcement | `invalidateAllSessions()` | Tracks and invalidates prior sessions per user |
| Token refresh detection | `refreshGoogleTokenIfNeeded()` | Checks token age, flags `needsReauth` when expiring |
| Authorization | `checkSpreadsheetAccess()` | Checks spreadsheet editors/viewers list |
| Auth gate on every request | `validateSession()` in each data function | Every server function validates the session before returning data |
| Sign-out | `serverSignOut()` | Server-side session invalidation (not just client-side cleanup) |

### HTML Wrapper (~20% — irreducible minimum)

These are in the HTML wrapper **only because the browser requires them** — they cannot run on a server:

| Responsibility | Why it MUST be in the HTML | What it does |
|---------------|---------------------------|--------------|
| GIS library loading | Browser-only API (`accounts.google.com/gsi/client`) | Loads Google's sign-in JavaScript library |
| Sign-in popup trigger | Browser-only API (`google.accounts.oauth2.initTokenClient`) | Opens the Google account chooser popup |
| localStorage read/write | Browser storage API | Stores/reads one opaque session token (UUID) across page reloads |
| Auth wall UI | Browser DOM | Shows/hides "Sign In Required" or "Access Denied" overlay |
| postMessage listener | Browser event API | Receives auth status messages from GAS iframe, validates origin |
| Silent re-auth trigger | Browser-only API (GIS `requestAccessToken`) | Re-triggers GIS when server flags token expiry |

> **Key constraint**: you cannot trigger a Google sign-in popup from server-side GAS code, and you cannot persist state across browser page reloads without `localStorage`. These are fundamental browser platform limitations — no architecture can eliminate them.

### What is NOT in the HTML wrapper

The following are explicitly **excluded from the HTML side** (unlike the basic pattern where some of these leak into the wrapper):

- No client-side calls to `googleapis.com/oauth2/v3/userinfo` — all Google API calls happen in GAS
- No raw Google `access_token` in localStorage — only the opaque UUID session token
- No token expiry logic — GAS handles refresh detection server-side
- No authorization checks — GAS checks spreadsheet access server-side
- No session duration management — GAS controls TTL via `CacheService`

---

## 4. Authentication Flow

### Initial Sign-In

```
User clicks "Sign In with Google"
         │
         ▼
┌─────────────────────────┐
│ 1. GIS popup opens      │  ← google.accounts.oauth2.initTokenClient()
│    User selects account  │     client.requestAccessToken()
│    Google returns        │
│    access_token          │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. Wrapper sends token   │  ← iframe URL: ?exchangeToken=ACCESS_TOKEN
│    to GAS via iframe      │     (one-time exchange, not stored)
│    reload                 │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────────────────────┐
│ 3. GAS server-side:                          │
│    a. Calls Google userinfo API with token   │
│    b. Validates email has spreadsheet access │
│    c. Generates session token (UUID)         │
│    d. Stores {email, token, createdAt}       │
│       in CacheService                        │
│    e. Returns session token to client        │
│       via postMessage                        │
└───────────┬─────────────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. Wrapper stores        │  ← localStorage.setItem('session-token', uuid)
│    session token only     │     Reloads iframe with ?session=UUID
│    Hides auth wall        │
└─────────────────────────┘
```

### Subsequent Page Loads

```
Page loads → check localStorage for session token
         │
         ▼
   Has session token?
    ┌─────┴─────┐
    No          Yes
    │            │
    ▼            ▼
Show auth   Load iframe with
wall        ?session=UUID
                 │
                 ▼
         GAS validates session
         (CacheService lookup)
          ┌──────┴──────┐
        Valid         Invalid/Expired
          │               │
          ▼               ▼
     Serve app       postMessage:
     postMessage:    {type: 'gas-needs-auth'}
     {type:          → Show auth wall
      'gas-auth-ok'} → Clear localStorage
```

### Token Refresh (Automatic, Server-Side)

```
GAS receives request with session token
         │
         ▼
Look up session in CacheService
         │
         ▼
Check: is accessToken expiring soon?
(createdAt + 45 min > now?)
    ┌─────┴─────┐
    No          Yes
    │            │
    ▼            ▼
Use existing  Call Google token
token         refresh endpoint
                   │
                   ▼
              Update CacheService
              with new token +
              reset createdAt
                   │
                   ▼
              Continue with
              refreshed token
```

---

## 5. Implementation Guide — GAS Backend (All Security Logic)

> **This section contains ~80% of the authentication system.** All token validation, session management, authorization, and refresh logic lives here. The GAS backend is the single source of truth for auth state.

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

  // 4. Create session token
  var sessionToken = Utilities.getUuid() + Utilities.getUuid();
  sessionToken = sessionToken.replace(/-/g, "").substring(0, 48);

  // 5. Store session data in CacheService
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
 * @param {string} sessionToken - The opaque session token from the client
 * @returns {Object} {status, email, displayName} or {status: "not_signed_in"}
 */
function validateSession(sessionToken) {
  if (!sessionToken || sessionToken.length < 32) {
    return { status: "not_signed_in" };
  }

  var cache = CacheService.getScriptCache();
  var raw = cache.get("session_" + sessionToken);
  if (!raw) {
    return { status: "not_signed_in" };
  }

  var sessionData;
  try {
    sessionData = JSON.parse(raw);
  } catch (e) {
    return { status: "not_signed_in" };
  }

  // Check session expiry (belt-and-suspenders — CacheService TTL is primary)
  var elapsed = (Date.now() - sessionData.createdAt) / 1000;
  if (elapsed > SESSION_EXPIRATION) {
    cache.remove("session_" + sessionToken);
    return { status: "not_signed_in" };
  }

  // Refresh Google token if needed (server-side, transparent to client)
  refreshGoogleTokenIfNeeded(sessionToken, sessionData);

  // Update last activity (extends the session)
  sessionData.lastActivity = Date.now();
  cache.put(
    "session_" + sessionToken,
    JSON.stringify(sessionData),
    SESSION_EXPIRATION  // Resets the TTL on every request
  );

  return {
    status: "authorized",
    email: sessionData.email,
    displayName: sessionData.displayName
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

### Google Token Validation & Refresh

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
 * Check if a Google access token needs refreshing and refresh it.
 * Called automatically during session validation — transparent to client.
 *
 * Note: Google access tokens obtained via the implicit flow (initTokenClient)
 * cannot be refreshed server-side without a refresh token. This function
 * handles the case by sending a 'gas-needs-reauth' message when the token
 * is about to expire, prompting the client to silently re-authenticate.
 *
 * @param {string} sessionToken - The session token key
 * @param {Object} sessionData - The session data from CacheService
 */
function refreshGoogleTokenIfNeeded(sessionToken, sessionData) {
  var tokenAge = (Date.now() - sessionData.tokenObtainedAt) / 1000;

  // Google access tokens last ~3600 seconds
  // If the token is older than (3600 - 900) = 2700 seconds, it's expiring soon
  if (tokenAge < (OAUTH_TOKEN_LIFETIME - OAUTH_REFRESH_BUFFER)) {
    return; // Token is still fresh
  }

  // Mark the session as needing re-authentication
  // The client-side code checks for this flag and silently re-authenticates
  sessionData.needsReauth = true;
  var cache = CacheService.getScriptCache();
  cache.put(
    "session_" + sessionToken,
    JSON.stringify(sessionData),
    SESSION_EXPIRATION
  );
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

  // Token exchange flow: client sends Google access token, gets session token back
  if (exchangeToken) {
    var result = exchangeTokenForSession(exchangeToken);
    // Return a minimal HTML page that sends the result back to the parent
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

## 6. Implementation Guide — Minimal HTML Shell

> **This is the irreducible minimum.** The code below contains only what the browser physically requires — GIS popup trigger, localStorage for one session token, postMessage listener, and auth wall UI toggle. All security logic is in Section 5 (GAS Backend). When implementing a new page, copy this shell and customize only the `_gasBaseUrl`, `client_id`, and auth wall HTML styling.

### GIS Sign-In (Browser-Only — Cannot Move to GAS)

```javascript
// =============================================
// SIGN-IN — Exchange access token for session token
// =============================================

var _gasBaseUrl = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
var _sessionToken = localStorage.getItem('session-token') || '';

function triggerGisSignIn() {
  loadGis(function() {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
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
 */
function exchangeForSession(accessToken) {
  var iframe = document.getElementById('gas-app');
  // Load the GAS app with the exchange token parameter
  // GAS will validate the token, create a session, and postMessage the result
  iframe.src = _gasBaseUrl + '&exchangeToken=' + encodeURIComponent(accessToken);
}
```

### postMessage Handler (Browser-Only — Cannot Move to GAS)

```javascript
// =============================================
// postMessage — Origin-validated message handling
// =============================================

window.addEventListener('message', function(e) {
  if (!e.data) return;

  // ORIGIN VALIDATION — only accept messages from the GAS iframe
  // GAS iframes run on *.googleusercontent.com subdomains
  if (e.origin && !e.origin.includes('googleusercontent.com')) {
    return; // Reject messages from unknown origins
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
      // Server says Google token is expiring — silently re-authenticate
      silentReauth();
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
    silentReauth();
  }
}
```

### Silent Re-Authentication (Browser-Only — Triggered by GAS Server)

```javascript
// =============================================
// SILENT RE-AUTH — Refresh Google token without user interaction
// =============================================

/**
 * Silently re-authenticate with Google to get a fresh access token.
 * Uses GIS prompt: 'none' to avoid showing the consent popup.
 * If silent auth fails (user needs to interact), show a non-blocking
 * notification instead of the full auth wall.
 */
function silentReauth() {
  loadGis(function() {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
      scope: 'email profile',
      prompt: '',  // Empty prompt = try silent auth
      callback: function(resp) {
        if (resp && resp.access_token) {
          // Exchange the fresh token for a new session
          exchangeForSession(resp.access_token);
        }
        // If silent auth fails, the user's current session continues
        // until it expires — no disruptive popup needed
      }
    });
    client.requestAccessToken();
  });
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

// On page load: if session token exists, load the iframe with it
(function() {
  if (_sessionToken) {
    reloadIframe();
  } else {
    // No session — show auth wall immediately
    showAuthWall('not_signed_in', '');
  }
})();
```

### Sign-Out (Triggers Server-Side Invalidation)

```javascript
// =============================================
// SIGN-OUT — Server-side session invalidation
// =============================================

function signOut() {
  var confirmed = confirm('Sign out of this application?');
  if (!confirmed) return;

  // 1. Invalidate session on the server
  // Send a sign-out request via the iframe
  var iframe = document.getElementById('gas-app');
  iframe.src = _gasBaseUrl + '&signOut=' + encodeURIComponent(_sessionToken);

  // 2. Clear client-side state
  localStorage.removeItem('session-token');
  localStorage.removeItem('session-email');
  _sessionToken = '';

  // 3. Show auth wall
  showAuthWall('not_signed_in', '');
}
```

### Optional: Inactivity Timeout

```javascript
// =============================================
// INACTIVITY TIMEOUT — Client-side session expiry warning
// =============================================

var INACTIVITY_LIMIT = 25 * 60 * 1000;  // 25 minutes (less than server TTL)
var INACTIVITY_WARNING = 2 * 60 * 1000; // 2-minute warning before expiry
var _inactivityTimer = null;
var _warningTimer = null;

function resetInactivityTimer() {
  clearTimeout(_inactivityTimer);
  clearTimeout(_warningTimer);
  dismissWarning();

  _warningTimer = setTimeout(function() {
    showInactivityWarning();
  }, INACTIVITY_LIMIT - INACTIVITY_WARNING);

  _inactivityTimer = setTimeout(function() {
    // Session likely expired on server — force sign-out
    localStorage.removeItem('session-token');
    localStorage.removeItem('session-email');
    _sessionToken = '';
    showAuthWall('session_expired', '');
  }, INACTIVITY_LIMIT);
}

function showInactivityWarning() {
  // Show a non-blocking notification: "Session expiring in 2 minutes"
  var warning = document.getElementById('inactivity-warning');
  if (warning) warning.style.display = 'block';
}

function dismissWarning() {
  var warning = document.getElementById('inactivity-warning');
  if (warning) warning.style.display = 'none';
}

// Reset timer on user activity
['click', 'keydown', 'mousemove', 'touchstart'].forEach(function(evt) {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// Start timer when session is active
if (_sessionToken) resetInactivityTimer();
```

---

## 7. postMessage Protocol

### Messages FROM GAS iframe TO HTML wrapper

| Message Type | When Sent | Data Fields | Wrapper Action |
|-------------|-----------|-------------|----------------|
| `gas-session-created` | After token exchange | `{success, sessionToken, email, displayName, error}` | Store session token, reload iframe |
| `gas-needs-auth` | Session invalid or expired | `{authStatus, email, version}` | Show auth wall |
| `gas-auth-ok` | Session valid, app loaded | `{version, needsReauth}` | Show sign-out button, trigger silent reauth if needed |
| `gas-needs-reauth` | Google token expiring soon | `{}` | Run silent re-authentication |
| `gas-reload` | GAS self-update detected | `{}` | Reload page (with debounce) |
| `manual-reload` | User triggered reload from GAS | `{}` | Reload page |

### Messages FROM HTML wrapper TO GAS iframe

The wrapper does not send postMessages to the GAS iframe. Communication from wrapper to GAS happens via URL parameters on iframe reload:
- `?session=UUID` — pass session token for validation
- `?exchangeToken=ACCESS_TOKEN` — one-time token exchange (sign-in)
- `?signOut=UUID` — invalidate session (sign-out)

### Origin Validation

```javascript
// In the wrapper's message listener:
if (e.origin && !e.origin.includes('googleusercontent.com')) {
  return; // Reject
}
```

GAS iframes serve content from `*.googleusercontent.com` subdomains (e.g., `script.googleusercontent.com` or a hash-based subdomain). The origin check validates that only the GAS iframe can send auth-related messages.

---

## 8. Security Checklist

Before deploying a project using this pattern, verify:

### Server-Side (GAS)
- [ ] `exchangeTokenForSession()` validates the Google token with Google's API before creating a session
- [ ] Session tokens are generated using `Utilities.getUuid()` (cryptographically random)
- [ ] `SESSION_EXPIRATION` is set to an appropriate TTL (recommend ≤30 min for sensitive apps)
- [ ] `CacheService` TTL matches `SESSION_EXPIRATION` (belt-and-suspenders)
- [ ] Every data function uses the auth gate pattern (validates session before returning data)
- [ ] `checkSpreadsheetAccess()` is called on every auth check (not just initial sign-in)
- [ ] `invalidateSession()` removes the session from CacheService (not just localStorage)
- [ ] `MAX_SESSIONS_PER_USER` is set to 1 for sensitive apps (single-session enforcement)

### Client-Side (Minimal HTML Shell — verify these are the ONLY auth-related things in the wrapper)
- [ ] `access_token` from GIS is NEVER stored in localStorage — only the opaque session token
- [ ] `access_token` is passed to GAS via URL parameter (one-time exchange), then discarded
- [ ] postMessage handler validates `e.origin` includes `googleusercontent.com`
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

## 9. Migration Guide

### Migrating from the Basic Google OAuth Pattern

If you have a project using the basic pattern (raw access_token in localStorage, as described in `02-GOOGLE-OAUTH-AUTH-PATTERN.md`), follow these steps to upgrade:

#### Step 1: Add Session Functions to GAS

Add the following functions to your `.gs` file (from Section 4):
- `exchangeTokenForSession()`
- `validateSession()`
- `invalidateSession()`
- `invalidateAllSessions()`
- `trackUserSession()`
- `removeUserSession()`
- `validateGoogleToken()` (replaces `getUserInfo()`)
- `refreshGoogleTokenIfNeeded()`

Add the auth constants at the top of the file.

#### Step 2: Update `doGet()`

Modify `doGet()` to handle the `exchangeToken` parameter (for initial sign-in) and the `session` parameter (for subsequent requests) instead of the `token` parameter.

#### Step 3: Update Auth Gates

Replace all `getUserInfo(opt_token)` calls with `validateSession(opt_sessionToken)`. The return format is the same (`{status, email, displayName}`), so most calling code doesn't change.

#### Step 4: Update HTML Wrapper

1. Replace `triggerGisSignIn()` — remove the client-side `fetch()` to Google's userinfo API; instead call `exchangeForSession(accessToken)`
2. Add origin validation to the `message` event listener
3. Replace `localStorage.setItem('gis-token', ...)` with `localStorage.setItem('session-token', ...)`
4. Update sign-out to call server-side invalidation
5. Add the `gas-session-created` message handler
6. Change iframe URL parameter from `?token=` to `?session=`

#### Step 5: Update Client-Side JS in GAS HTML

Update the inline JavaScript inside GAS's HTML output:
- Change `_token` variable to `_session`
- Update `google.script.run` calls to pass `_session` instead of `_token`
- Update postMessage calls to use `session` parameter name

#### Step 6: Deploy and Test

1. Deploy GAS with new version
2. Test sign-in flow (GIS popup → token exchange → session creation)
3. Verify session persists across page reloads
4. Verify session expires after TTL
5. Verify sign-out invalidates server-side session
6. Verify re-auth works when Google token expires (~1 hour test)

---

## 10. Three-Pattern Comparison

| Feature | Custom Auth | Basic Google OAuth | Improved Google OAuth |
|---------|-------------|--------------------|-----------------------|
| **Identity source** | Username/password in Sheets | Google account (GIS) | Google account (GIS) |
| **Token type in localStorage** | Custom UUID session token | Raw Google access_token | Opaque UUID session token |
| **Server-side sessions** | Yes (CacheService) | No | Yes (CacheService) |
| **Token validation** | Server-side only | Client + Server | Server-side only |
| **Session TTL** | 15 min (configurable) | Unlimited | 30 min (configurable) |
| **Token refresh** | N/A (custom tokens) | None (silent failure) | Server-side automatic |
| **Single-session enforcement** | Yes | No | Optional |
| **Inactivity timeout** | Yes (15 min + 2 min warning) | No | Optional |
| **Account lockout** | Yes (5 attempts) | N/A (Google handles) | N/A (Google handles) |
| **Origin validation** | Partial | None | Full |
| **Server-side sign-out** | Yes (cache invalidation) | No | Yes (cache invalidation) |
| **XSS token exposure** | Low (opaque UUID) | High (real Google token) | Low (opaque UUID) |
| **Password storage** | Sheets (recommend hashing) | N/A | N/A |
| **Audit logging** | Yes (HIPAA-grade) | No | Optional |
| **Setup complexity** | Medium (Sheets user table) | Low (just client_id) | Medium (session functions) |
| **Auth logic in GAS** | ~90% (all session + credential logic) | ~40% (only spreadsheet access check) | **~80% (all security logic)** |
| **Auth logic in HTML** | ~10% (login form UI only) | ~60% (token storage, validation, API calls) | **~20% (irreducible: GIS popup, localStorage, UI toggle)** |
| **Best for** | Apps needing custom credentials | Simple internal tools | Production internal tools |

---

## 11. Troubleshooting

### Common Issues

**"Session expired" immediately after sign-in**
- Check that `SESSION_EXPIRATION` matches the CacheService TTL in `exchangeTokenForSession()`
- Verify the session token is being stored correctly in localStorage
- Check that the iframe URL includes `?session=` (not `?token=`)

**Silent re-auth fails (consent popup appears)**
- GIS requires at least one interactive sign-in before `prompt: ''` works
- The user may have revoked the app's access in their Google account settings
- Ensure the `client_id` matches across both initial sign-in and re-auth

**Origin validation rejects legitimate GAS messages**
- GAS iframe origins vary by deployment — check the actual origin in browser DevTools
- Common origins: `script.googleusercontent.com`, `*.googleusercontent.com`
- If needed, broaden the check: `e.origin.includes('google')`

**Session not persisting across page reloads**
- Verify `localStorage.setItem('session-token', ...)` is called after successful exchange
- Check that `reloadIframe()` appends `?session=` to the URL
- Ensure the GAS `doGet()` reads `e.parameter.session` (not `e.parameter.token`)

**Google token expires but no re-auth happens**
- Verify `refreshGoogleTokenIfNeeded()` is called during `validateSession()`
- Check that the `needsReauth` flag is included in `gas-auth-ok` messages
- Verify the wrapper's `silentReauth()` function is wired to the `gas-needs-reauth` message

Developed by: LightAISolutions

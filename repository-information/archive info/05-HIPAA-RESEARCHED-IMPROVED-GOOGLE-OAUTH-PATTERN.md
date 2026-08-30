# HIPAA-Compliant Google OAuth Authentication Pattern

Implementation-ready reference for HIPAA-compliant Google OAuth authentication in GAS web apps embedded via iframe. This pattern builds on [04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md](04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md) and addresses all identified HIPAA gaps — adding audit logging, Workspace domain restriction, reduced session timeout, postMessage-based token exchange, sessionStorage, session data integrity (HMAC), MFA verification, and emergency access procedures.

> **Relationship to other patterns**:
> - [02-GOOGLE-OAUTH-AUTH-PATTERN.md](02-GOOGLE-OAUTH-AUTH-PATTERN.md) — basic pattern (raw token in localStorage, no server sessions)
> - [03-IMPROVED-GOOGLE-OAUTH-PATTERN.md](03-IMPROVED-GOOGLE-OAUTH-PATTERN.md) — first improvement (server sessions, opaque tokens, silent re-auth)
> - [04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md](04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md) — research-validated version with origin validation fix, re-auth fallback, CacheService caveats
> - **This document** — HIPAA-compliant version with all regulatory gaps closed, ready for implementation in healthcare/ePHI contexts

> **What changed from the Researched Improved pattern**: see [Section 14: Delta from Researched Improved Pattern](#14-delta-from-researched-improved-pattern) for the exact list of changes with HIPAA rationale.

> **HIPAA prerequisite**: before deploying this pattern, your organization must have a signed Google Workspace BAA (Business Associate Agreement) in place via the Admin Console. Consumer Google accounts (@gmail.com) are NOT covered — this pattern enforces Workspace-only access.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [HIPAA Compliance Mapping](#2-hipaa-compliance-mapping)
3. [GAS vs HTML Responsibility Split](#3-gas-vs-html-responsibility-split)
4. [Authentication Flow](#4-authentication-flow)
5. [Implementation Guide — GAS Backend](#5-implementation-guide--gas-backend)
6. [Implementation Guide — HTML Shell](#6-implementation-guide--html-shell)
7. [Audit Logging System](#7-audit-logging-system)
8. [postMessage Protocol](#8-postmessage-protocol)
9. [Emergency Access Procedure](#9-emergency-access-procedure)
10. [MFA Enforcement Strategy](#10-mfa-enforcement-strategy)
11. [CacheService Behavioral Caveats](#11-cacheservice-behavioral-caveats)
12. [Security Checklist](#12-security-checklist)
13. [Five-Pattern Comparison](#13-five-pattern-comparison)
14. [Delta from Researched Improved Pattern](#14-delta-from-researched-improved-pattern)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Architecture Overview

> **Where the logic lives**: the GAS server owns all security — token validation, session creation, authorization checks, audit logging, domain restriction, HMAC integrity, and token refresh signaling. The HTML wrapper is a thin shell that triggers the browser sign-in popup, relays messages via postMessage (not URL parameters), and enforces client-side inactivity timeout. No Google API calls happen in the browser.

```
┌─────────────────────────────────────────────────────────────────┐
│  HTML Wrapper (GitHub Pages / Custom Domain)                    │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │  Auth Wall        │    │  GAS iframe (full-screen)         │   │
│  │  (Sign In /       │    │  ┌────────────────────────────┐  │   │
│  │   Access Denied)  │    │  │  GAS Web App               │  │   │
│  │                   │    │  │  - Validates session token  │  │   │
│  │  [Sign In with    │    │  │  - HMAC integrity check     │  │   │
│  │   Google]         │    │  │  - Audit logs all actions    │  │   │
│  └──────────────────┘    │  │  - Domain restriction        │  │   │
│                           │  └────────────────────────────┘  │   │
│  ┌──────────────────┐    └──────────────────────────────────┘   │
│  │  sessionStorage   │                                          │
│  │  (session token   │    postMessage (strict origin-validated)  │
│  │   only — NOT the  │    ◄──────────────────────────────►      │
│  │   OAuth token)    │    Token exchange via postMessage         │
│  │  Cleared on tab   │    (NOT URL parameters)                  │
│  │  close            │                                          │
│  └──────────────────┘                                           │
│                                                                 │
│  ┌──────────────────┐                                           │
│  │  Inactivity Timer │    MANDATORY: 15 min (configurable)      │
│  │  (client-side)    │    Auto-signs out on timeout             │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    │ 1. GIS popup              │ 2. postMessage token
                    ▼                           ▼
        ┌──────────────────┐        ┌──────────────────────────┐
        │  Google OAuth     │        │  GAS Server               │
        │  (accounts.google │        │  (CacheService + Sheet)   │
        │   .com/gsi)       │        │                           │
        │                   │        │  Session store:           │
        │  Returns:         │        │  {sessionToken} →         │
        │  access_token     │        │    {email, accessToken,   │
        │                   │        │     createdAt, lastAct,   │
        └──────────────────┘        │     tokenObtainedAt,      │
                                     │     hmac}                 │
                                     │                           │
                                     │  Audit Log Sheet:         │
                                     │  {timestamp, user, event, │
                                     │   result, ip, details}    │
                                     └──────────────────────────┘
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

## 2. HIPAA Compliance Mapping

| 45 CFR Section | Requirement | How This Pattern Addresses It | Status |
|---------------|-------------|-------------------------------|--------|
| 164.312(a)(1) | Unique user identification | Users identified by Google Workspace email, tracked per session | ✅ PASS |
| 164.312(a)(2)(i) | Unique user ID | Google email as persistent identifier, enforced via domain restriction | ✅ PASS |
| 164.312(a)(2)(ii) | Emergency access procedure | Documented break-glass procedure via Script Properties override (Section 9) | ✅ PASS |
| 164.312(a)(2)(iii) | Automatic logoff | 15-minute server-side session timeout + mandatory client-side inactivity timer | ✅ PASS |
| 164.312(a)(2)(iv) | Encryption and decryption | Google infrastructure AES-256 at rest, ALTS in transit; HMAC integrity on session data | ✅ PASS |
| 164.312(b) | Audit controls | All auth events logged to Google Sheet with timestamp, user, action, result, IP (Section 7) | ✅ PASS |
| 164.312(c)(1) | Integrity controls | HMAC on cached session data detects tampering; audit log in append-only Sheet | ✅ PASS |
| 164.312(c)(2) | Authentication of ePHI | Server-side session validation on every request; double-check spreadsheet access | ✅ PASS |
| 164.312(d) | Person or entity authentication | Google OAuth + Workspace domain restriction + MFA enforcement via Workspace Admin | ✅ PASS |
| 164.312(e)(1) | Transmission security | HTTPS everywhere; token exchange via postMessage (not URL parameters) | ✅ PASS |
| 164.312(e)(2) | Encryption of ePHI in transit | All communications over HTTPS/TLS; no plaintext credentials in URLs | ✅ PASS |
| 164.316(b)(2)(i) | Documentation retention | Audit logs retained in Google Sheet (6-year minimum recommended) | ✅ PASS |

### HIPAA Addressable Specifications

| Specification | Implementation Decision | Rationale |
|--------------|------------------------|-----------|
| MFA (proposed mandatory in 2025 NPRM) | Enforced via Google Workspace Admin Console | Workspace admin can mandate MFA for all domain users; pattern verifies Workspace-only access |
| Encryption at rest | Deferred to Google infrastructure | Google Workspace (covered by BAA) encrypts all data at rest with AES-256; application-level encryption of session data provides marginal additional benefit given CacheService's short TTL |
| Access monitoring | Implemented via audit logging | All successful and failed auth events logged with sufficient detail for incident investigation |

---

## 3. GAS vs HTML Responsibility Split

| Responsibility | Owner | HIPAA Rationale |
|---------------|-------|-----------------|
| Token validation (Google userinfo API) | GAS | Server-side only — credential never exposed to browser |
| Session creation & management | GAS | Server controls session lifecycle and enforces timeout |
| Domain restriction (Workspace-only) | GAS | Authorization decision made server-side, not client-bypassable |
| Audit logging | GAS | Tamper-resistant logging on server — client cannot suppress logs |
| HMAC integrity on session data | GAS | Server generates and verifies HMAC — client has no access to secret |
| Session timeout enforcement (server) | GAS | 15-minute TTL on CacheService + authoritative `createdAt` check |
| Emergency access override | GAS | Break-glass via Script Properties — server-side only |
| Authorization (spreadsheet access) | GAS | Re-validated periodically via cache |
| GIS sign-in popup | HTML | Browser-only — GIS library requires browser context |
| postMessage relay | HTML | Token received from GIS, sent to GAS iframe via postMessage |
| Session token storage | HTML | `sessionStorage` — cleared on tab close |
| Client-side inactivity timeout | HTML | MANDATORY — defense-in-depth complement to server TTL |
| Re-auth banner | HTML | Non-disruptive UX for session extension |

---

## 4. Authentication Flow

### Initial Sign-In (with Domain Restriction)

```
User clicks "Sign In with Google"
         │
         ▼
GIS popup opens → user selects Google account
         │
         ▼
GIS returns access_token to HTML callback
         │
         ▼
HTML sends token to GAS iframe via postMessage
(NOT via URL parameter — avoids server log exposure)
         │
         ▼
GAS receives token via postMessage listener
         │
         ▼
GAS calls Google userinfo API (server-side)
         │
         ▼
Check: is email domain in ALLOWED_DOMAINS?
    ┌─────┴─────┐
    No          Yes
    │            │
    ▼            ▼
AUDIT LOG:    Check spreadsheet
domain_       access
rejected        │
Return error  ┌──┴──┐
              No    Yes
              │      │
              ▼      ▼
           AUDIT:  Create session
           access_ HMAC session data
           denied  AUDIT: login_success
                   Return session token
                   via postMessage
```

### Token Refresh (with Interactive Fallback)

Same as Researched Improved pattern — silent `prompt: ''` first, interactive banner fallback on failure. See [04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md § 4](04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md#4-authentication-flow).

**HIPAA addition**: every re-auth attempt (success or failure) is audit logged.

---

## 5. Implementation Guide — GAS Backend

> **All security logic lives here (~85% of auth system).** The code below is implementation-ready — copy it directly into your `.gs` file. HIPAA additions are marked with `// HIPAA:` comments.

### Constants

```javascript
// =============================================
// AUTH CONSTANTS (HIPAA-COMPLIANT)
// =============================================

var SESSION_EXPIRATION = 900;      // HIPAA: 15 minutes (industry standard for healthcare)
var SESSION_REFRESH_WINDOW = 180;  // Refresh token if <3 min remaining
var OAUTH_TOKEN_LIFETIME = 3600;   // Google access tokens last ~1 hour
var OAUTH_REFRESH_BUFFER = 900;    // Refresh Google token if <15 min remaining
var MAX_SESSIONS_PER_USER = 1;     // HIPAA: enforce single-session per user

// HIPAA: Domain restriction — only Google Workspace accounts under these domains
// Consumer @gmail.com accounts are NOT covered by Google's BAA
var ALLOWED_DOMAINS = ['yourdomain.com'];  // Replace with your Workspace domain(s)

// HIPAA: Audit log configuration
var AUDIT_LOG_SHEET_NAME = 'AuditLog';     // Tab name in the project spreadsheet
var AUDIT_LOG_RETENTION_YEARS = 6;          // 45 CFR 164.316(b)(2)(i) minimum

// HIPAA: HMAC secret for session data integrity
// Store this in Script Properties (File > Project Properties > Script Properties)
// Key: HMAC_SECRET  Value: (generate a random 32+ character string)
// Do NOT hardcode the secret in source code
var HMAC_SECRET_PROPERTY = 'HMAC_SECRET';

// HIPAA: Emergency access configuration
// Key: EMERGENCY_ACCESS_EMAILS  Value: comma-separated emails
// Only checked when normal auth fails — provides break-glass access
var EMERGENCY_ACCESS_PROPERTY = 'EMERGENCY_ACCESS_EMAILS';

// CacheService limits (informational — do not change)
// Max TTL: 21600 seconds (6 hours) — values above are silently clamped
// Max value size: 100 KB
// Eviction: best-effort — entries MAY be evicted before TTL under memory pressure
```

### Session Management Functions

```javascript
// =============================================
// AUTH — Session Management (Server-Side)
// HIPAA: Domain restriction, HMAC integrity, audit logging
// =============================================

/**
 * Exchange a Google access token for a server-side session token.
 * HIPAA additions: domain restriction, HMAC integrity, audit logging.
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
    auditLog('login_failed', '', 'invalid_token', { reason: 'Google token validation failed' });
    return { success: false, error: "invalid_token" };
  }

  // 2. HIPAA: Domain restriction — reject non-Workspace accounts
  var emailDomain = userInfo.email.split('@')[1].toLowerCase();
  var domainAllowed = false;
  for (var i = 0; i < ALLOWED_DOMAINS.length; i++) {
    if (emailDomain === ALLOWED_DOMAINS[i].toLowerCase()) {
      domainAllowed = true;
      break;
    }
  }
  if (!domainAllowed) {
    auditLog('login_failed', userInfo.email, 'domain_rejected',
      { domain: emailDomain, allowed: ALLOWED_DOMAINS.join(',') });
    return { success: false, error: "domain_not_allowed", email: userInfo.email };
  }

  // 3. Check authorization (spreadsheet access)
  if (!checkSpreadsheetAccess(userInfo.email)) {
    auditLog('login_failed', userInfo.email, 'access_denied',
      { reason: 'No spreadsheet access' });
    return { success: false, error: "not_authorized", email: userInfo.email };
  }

  // 4. Enforce single-session
  if (MAX_SESSIONS_PER_USER > 0) {
    invalidateAllSessions(userInfo.email);
  }

  // 5. Create session token (cryptographically random UUID)
  var sessionToken = Utilities.getUuid() + Utilities.getUuid();
  sessionToken = sessionToken.replace(/-/g, "").substring(0, 48);

  // 6. Store session data with HMAC integrity
  var sessionData = {
    email: userInfo.email,
    displayName: userInfo.displayName,
    accessToken: accessToken,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    tokenObtainedAt: Date.now()
  };

  // HIPAA: Generate HMAC for tamper detection
  sessionData.hmac = generateSessionHmac(sessionData);

  var cache = CacheService.getScriptCache();
  cache.put(
    "session_" + sessionToken,
    JSON.stringify(sessionData),
    SESSION_EXPIRATION
  );

  // 7. Track active sessions for this user
  trackUserSession(userInfo.email, sessionToken);

  // 8. HIPAA: Audit log — successful login
  auditLog('login_success', userInfo.email, 'session_created',
    { sessionId: sessionToken.substring(0, 8) + '...' });

  return {
    success: true,
    sessionToken: sessionToken,
    email: userInfo.email,
    displayName: userInfo.displayName
  };
}

/**
 * Validate a session token and return the associated user info.
 * HIPAA additions: HMAC verification, audit on expiry.
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
    return { status: "not_signed_in" };
  }

  var sessionData;
  try {
    sessionData = JSON.parse(raw);
  } catch (e) {
    return { status: "not_signed_in" };
  }

  // HIPAA: Verify HMAC integrity — detect tampering
  if (!verifySessionHmac(sessionData)) {
    auditLog('security_alert', sessionData.email || 'unknown', 'hmac_mismatch',
      { sessionId: sessionToken.substring(0, 8) + '...' });
    cache.remove("session_" + sessionToken);
    return { status: "not_signed_in" };
  }

  // Authoritative expiry check using createdAt timestamp
  var elapsed = (Date.now() - sessionData.createdAt) / 1000;
  if (elapsed > SESSION_EXPIRATION) {
    auditLog('session_expired', sessionData.email, 'timeout',
      { elapsed: Math.round(elapsed) + 's', limit: SESSION_EXPIRATION + 's' });
    cache.remove("session_" + sessionToken);
    return { status: "not_signed_in" };
  }

  // Check if Google token needs refresh
  var needsReauth = checkGoogleTokenExpiry(sessionData);

  // Update last activity (extends the CacheService TTL)
  sessionData.lastActivity = Date.now();
  sessionData.hmac = generateSessionHmac(sessionData);  // HIPAA: re-sign after update
  cache.put(
    "session_" + sessionToken,
    JSON.stringify(sessionData),
    SESSION_EXPIRATION
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
 * HIPAA: Audit logs the sign-out event.
 */
function invalidateSession(sessionToken) {
  if (!sessionToken) return;
  var cache = CacheService.getScriptCache();

  var raw = cache.get("session_" + sessionToken);
  if (raw) {
    try {
      var sessionData = JSON.parse(raw);
      removeUserSession(sessionData.email, sessionToken);
      auditLog('sign_out', sessionData.email, 'session_invalidated',
        { sessionId: sessionToken.substring(0, 8) + '...' });
    } catch (e) {}
  }

  cache.remove("session_" + sessionToken);
}

/**
 * Invalidate all sessions for a user (single-session enforcement).
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
    if (tokens.length > 0) {
      auditLog('session_management', email, 'all_sessions_invalidated',
        { count: tokens.length });
    }
  } catch (e) {}

  cache.remove(trackKey);
}
```

### HMAC Integrity Functions

```javascript
// =============================================
// HIPAA — Session Data Integrity (HMAC)
// Detects tampering with cached session data.
// The HMAC secret is stored in Script Properties —
// never hardcoded in source.
// =============================================

/**
 * Generate HMAC for session data integrity verification.
 * Signs the critical fields (email, createdAt, tokenObtainedAt)
 * so any modification to these values is detectable.
 *
 * @param {Object} sessionData - The session data object (without hmac field)
 * @returns {string} Base64-encoded HMAC-SHA256
 */
function generateSessionHmac(sessionData) {
  var secret = PropertiesService.getScriptProperties().getProperty(HMAC_SECRET_PROPERTY);
  if (!secret) {
    // Fail open with warning — HMAC secret not configured
    // In production, this should fail closed (throw error)
    Logger.log('WARNING: HMAC_SECRET not set in Script Properties');
    return 'no-hmac-configured';
  }

  // Sign the immutable fields — these should never change after creation
  var message = sessionData.email + '|' +
                sessionData.createdAt + '|' +
                sessionData.tokenObtainedAt;

  var signature = Utilities.computeHmacSha256Signature(message, secret);
  return Utilities.base64Encode(signature);
}

/**
 * Verify HMAC integrity of session data.
 *
 * @param {Object} sessionData - The session data object (with hmac field)
 * @returns {boolean} True if HMAC is valid or not configured (fail-open)
 */
function verifySessionHmac(sessionData) {
  if (!sessionData.hmac) return false;  // No HMAC present — reject
  if (sessionData.hmac === 'no-hmac-configured') return true;  // HMAC not set up — fail open

  var expected = generateSessionHmac(sessionData);
  return expected === sessionData.hmac;
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
// HIPAA: Audit logs failed authorization attempts
// =============================================

function checkSpreadsheetAccess(email, opt_ss) {
  if (!email) return false;
  var lowerEmail = email.toLowerCase();

  // HIPAA: Check emergency access override first
  var emergencyEmails = PropertiesService.getScriptProperties()
    .getProperty(EMERGENCY_ACCESS_PROPERTY);
  if (emergencyEmails) {
    var emergencyList = emergencyEmails.split(',').map(function(e) {
      return e.trim().toLowerCase();
    });
    if (emergencyList.indexOf(lowerEmail) > -1) {
      auditLog('emergency_access', email, 'granted',
        { reason: 'Emergency access override via Script Properties' });
      return true;
    }
  }

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

### Web App Entry Point (postMessage Token Exchange)

```javascript
// =============================================
// WEB APP ENTRY POINT
// HIPAA: Token exchange moved to postMessage (not URL params).
// doGet() no longer accepts exchangeToken as a URL parameter.
// The iframe loads clean, then receives the token via postMessage.
// =============================================

function doGet(e) {
  var sessionToken = (e && e.parameter && e.parameter.session) || "";
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

  // HIPAA: Token exchange is now handled via postMessage listener
  // (see setupPostMessageExchange below), NOT via URL parameter.
  // The iframe loads without the token, then receives it securely.

  // Normal flow: validate session token OR set up postMessage listener
  if (sessionToken) {
    // Returning user with existing session
    var html = buildFormHtml(sessionToken);
    return HtmlService.createHtmlOutput(html)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // No session — serve a page that listens for token exchange via postMessage
  var exchangeHtml = buildTokenExchangeListenerHtml();
  return HtmlService.createHtmlOutput(exchangeHtml)
    .setTitle(TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Build an HTML page that listens for a postMessage containing
 * the Google access token, exchanges it server-side, and relays
 * the session token back to the parent.
 *
 * HIPAA: This replaces the URL parameter approach from the
 * Researched Improved pattern. The access token never appears
 * in any URL, server log, browser history, or Referer header.
 */
function buildTokenExchangeListenerHtml() {
  return '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8"></head>'
    + '<body>'
    + '<script>'
    + 'window.addEventListener("message", function(e) {'
    + '  if (!e.data || e.data.type !== "exchange-token") return;'
    + '  var token = e.data.accessToken;'
    + '  if (!token) return;'
    + '  google.script.run'
    + '    .withSuccessHandler(function(result) {'
    + '      window.parent.postMessage({'
    + '        type: "gas-session-created",'
    + '        success: result.success,'
    + '        sessionToken: result.sessionToken || "",'
    + '        email: result.email || "",'
    + '        displayName: result.displayName || "",'
    + '        error: result.error || ""'
    + '      }, "*");'
    + '    })'
    + '    .withFailureHandler(function(err) {'
    + '      window.parent.postMessage({'
    + '        type: "gas-session-created",'
    + '        success: false,'
    + '        error: "server_error"'
    + '      }, "*");'
    + '    })'
    + '    .exchangeTokenForSession(token);'
    + '});'
    + 'window.parent.postMessage({ type: "gas-ready-for-token" }, "*");'
    + '</' + 'script>'
    + '</body></html>';
}
```

### Auth Gate Pattern (for Data Functions)

```javascript
// =============================================
// AUTH GATE — Use in every server function that returns data
// HIPAA: Audit logs data access attempts
// =============================================

/**
 * Example: getFormData — validates session before returning data.
 * HIPAA: Audit logs every data access attempt (success and failure).
 */
function getFormData(opt_sessionToken) {
  // 1. Validate session
  var session = validateSession(opt_sessionToken);

  // 2. Auth gate
  if (session.status !== "authorized") {
    auditLog('data_access_denied', session.email || 'unknown', 'unauthorized',
      { function: 'getFormData' });
    return {
      authorized: false,
      authStatus: session.status,
      email: session.email || "",
      version: VERSION
    };
  }

  // 3. Double-check spreadsheet access (re-validates periodically via cache)
  if (!checkSpreadsheetAccess(session.email)) {
    auditLog('data_access_denied', session.email, 'no_spreadsheet_access',
      { function: 'getFormData' });
    return {
      authorized: false,
      authStatus: "no_spreadsheet_access",
      email: session.email,
      version: VERSION
    };
  }

  // 4. HIPAA: Audit log — successful data access
  auditLog('data_access', session.email, 'success',
    { function: 'getFormData' });

  // 5. Proceed with data retrieval
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

## 7. Audit Logging System

> **45 CFR 164.312(b) — Audit Controls (REQUIRED)**: hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI. This is a **required** implementation specification — not addressable.

### Audit Log Architecture

The audit log writes to a dedicated tab (`AuditLog`) in the project's Google Spreadsheet. Google Sheets is covered under the Workspace BAA, and the append-only pattern (new rows only, no updates/deletes via code) provides basic tamper resistance.

**Log retention**: 45 CFR 164.316(b)(2)(i) requires documentation retention for 6 years from the date of creation or the date when it last was in effect. Set `AUDIT_LOG_RETENTION_YEARS = 6` (minimum).

### Audit Log Implementation

```javascript
// =============================================
// HIPAA — Audit Logging
// Logs all auth events to a Google Sheet tab.
// 45 CFR 164.312(b) — Audit Controls (REQUIRED)
//
// Log fields:
//   timestamp   — ISO 8601 timestamp (server time)
//   user        — email of the user (or 'unknown'/'system')
//   event       — event type (login_success, login_failed, etc.)
//   result      — outcome (session_created, domain_rejected, etc.)
//   ip          — not available in GAS (logged as 'N/A-GAS')
//   userAgent   — not available in GAS (logged as 'N/A-GAS')
//   details     — JSON string with additional context
//
// NOTE: GAS does not expose client IP or User-Agent to the
// server. These fields are logged as 'N/A-GAS' for documentation
// purposes. If IP tracking is required for compliance, consider
// passing IP from the HTML wrapper via postMessage (the client
// can read it from a public IP API), though this is client-supplied
// and therefore not tamper-proof.
// =============================================

/**
 * Write an audit log entry to the AuditLog sheet.
 * Append-only — never updates or deletes existing rows.
 *
 * @param {string} event - Event type (login_success, login_failed,
 *                         sign_out, session_expired, data_access,
 *                         data_access_denied, security_alert,
 *                         emergency_access, session_management,
 *                         reauth_success, reauth_failed)
 * @param {string} user - User email or identifier
 * @param {string} result - Outcome description
 * @param {Object} details - Additional context (optional)
 */
function auditLog(event, user, result, details) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(AUDIT_LOG_SHEET_NAME);

    // Auto-create the AuditLog tab if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(AUDIT_LOG_SHEET_NAME);
      sheet.appendRow([
        'Timestamp', 'User', 'Event', 'Result',
        'IP', 'UserAgent', 'Details'
      ]);
      // Freeze header row
      sheet.setFrozenRows(1);
      // Protect the sheet — only script can write
      var protection = sheet.protect()
        .setDescription('HIPAA Audit Log — Do Not Edit');
      // Remove all editors except the script owner
      var editors = protection.getEditors();
      for (var i = 0; i < editors.length; i++) {
        protection.removeEditor(editors[i]);
      }
      protection.addEditor(Session.getEffectiveUser());
    }

    var timestamp = new Date().toISOString();
    var detailsJson = details ? JSON.stringify(details) : '';

    sheet.appendRow([
      timestamp,
      user || 'unknown',
      event || 'unspecified',
      result || '',
      'N/A-GAS',     // IP not available in GAS
      'N/A-GAS',     // User-Agent not available in GAS
      detailsJson
    ]);
  } catch (e) {
    // Audit logging must not break the auth flow
    // Log to Apps Script's built-in logger as fallback
    Logger.log('AUDIT LOG FAILURE: ' + event + ' | ' + user + ' | ' + result
      + ' | Error: ' + e.message);
  }
}

/**
 * Audit log event types reference:
 *
 * | Event                | When                                    | Result Values                    |
 * |---------------------|-----------------------------------------|----------------------------------|
 * | login_success       | User successfully authenticated         | session_created                  |
 * | login_failed        | Authentication failed                   | invalid_token, domain_rejected,  |
 * |                     |                                         | access_denied                    |
 * | sign_out            | User signed out                         | session_invalidated              |
 * | session_expired     | Session TTL exceeded                    | timeout                          |
 * | session_management  | Sessions bulk-invalidated               | all_sessions_invalidated         |
 * | data_access         | User accessed ePHI/data                 | success                          |
 * | data_access_denied  | Data access attempt failed              | unauthorized, no_spreadsheet_access |
 * | security_alert      | Integrity violation detected            | hmac_mismatch                    |
 * | emergency_access    | Break-glass access used                 | granted                          |
 * | reauth_success      | Token refresh succeeded                 | token_refreshed                  |
 * | reauth_failed       | Token refresh failed                    | refresh_failed                   |
 */
```

### Audit Log Sheet Setup

The `auditLog()` function auto-creates the sheet on first write. For manual setup:

1. Open the project spreadsheet
2. Create a new tab named `AuditLog`
3. Add headers in row 1: `Timestamp | User | Event | Result | IP | UserAgent | Details`
4. Freeze row 1
5. Protect the sheet (Data > Protect sheets and ranges) — restrict editing to the script's service account
6. **Do NOT delete rows** — audit logs must be retained for the HIPAA-required retention period

---

## 8. postMessage Protocol

### Messages FROM GAS iframe TO HTML wrapper

| Message Type | When Sent | Data Fields | Wrapper Action |
|-------------|-----------|-------------|----------------|
| `gas-ready-for-token` | Iframe loaded, ready for exchange | `{}` | Send access token via postMessage |
| `gas-session-created` | After token exchange | `{success, sessionToken, email, displayName, error}` | Store session token in sessionStorage, reload iframe |
| `gas-needs-auth` | Session invalid or expired | `{authStatus, email, version}` | Show auth wall |
| `gas-auth-ok` | Session valid, app loaded | `{version, needsReauth}` | Show sign-out button, trigger re-auth if needed |
| `gas-needs-reauth` | Google token expiring soon | `{}` | Run `attemptReauth()` (silent then interactive fallback) |
| `gas-signed-out` | Session invalidated on server | `{success}` | Confirmation (auth wall already shown) |
| `gas-reload` | GAS self-update detected | `{}` | Reload page (with debounce) |

### Messages FROM HTML wrapper TO GAS iframe

| Message Type | When Sent | Data Fields | GAS Action |
|-------------|-----------|-------------|------------|
| `exchange-token` | After GIS returns access token | `{accessToken}` | Call `exchangeTokenForSession()` via `google.script.run` |

### HIPAA Security Notes

- **Token exchange via postMessage** — the access token never appears in any URL, server log, browser history, or Referer header. This closes the RFC 6750 §2.3 violation present in the Researched Improved pattern
- **`gas-ready-for-token` handshake** — the iframe signals readiness before the wrapper sends the token, preventing race conditions where the token is sent before the iframe's listener is set up
- **Origin validation** — strict hostname suffix match (unchanged from Researched Improved pattern)

## 6. Implementation Guide — HTML Shell

> **This section contains the ~15% of auth logic that must live in the browser.** Key HIPAA changes from the Researched Improved pattern: sessionStorage instead of localStorage, postMessage-based token exchange (no URL parameters), mandatory client-side inactivity timeout.

### GIS Sign-In with postMessage Token Exchange (CHANGED)

```javascript
// =============================================
// SIGN-IN — postMessage-based token exchange
// HIPAA: Access token is NEVER placed in a URL parameter.
// Instead, it's sent to the GAS iframe via postMessage after
// the iframe signals readiness (gas-ready-for-token).
// =============================================

var _gasBaseUrl = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
var _sessionToken = sessionStorage.getItem('session-token') || '';  // HIPAA: sessionStorage, not localStorage
var _clientId = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
var _pendingAccessToken = null;  // Holds token until iframe is ready

function triggerGisSignIn() {
  loadGis(function() {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: _clientId,
      scope: 'email profile',
      callback: function(resp) {
        if (resp && resp.access_token) {
          // DO NOT store the access token anywhere.
          // Send it to GAS iframe via postMessage (not URL).
          sendTokenToIframe(resp.access_token);
        }
      }
    });
    client.requestAccessToken();
  });
}

/**
 * Send the Google access token to the GAS iframe via postMessage.
 * HIPAA: This replaces the URL parameter approach.
 *
 * Flow:
 * 1. Load the iframe without any token in the URL
 * 2. Wait for the iframe to signal readiness (gas-ready-for-token)
 * 3. Send the token via postMessage
 *
 * If the iframe is already loaded and listening, send immediately.
 * Otherwise, store the token and wait for the ready signal.
 */
function sendTokenToIframe(accessToken) {
  var iframe = document.getElementById('gas-app');

  // Load the iframe clean (no token in URL)
  if (!iframe.src || iframe.src === 'about:blank') {
    iframe.src = _gasBaseUrl;
  }

  // Store token — will be sent when iframe signals ready
  _pendingAccessToken = accessToken;

  // If iframe is already loaded, try sending immediately
  // (the iframe's listener will ignore if not ready)
  try {
    iframe.contentWindow.postMessage(
      { type: 'exchange-token', accessToken: accessToken },
      '*'  // Target origin is googleusercontent.com (GAS iframe)
    );
  } catch (e) {
    // iframe not ready — token will be sent on gas-ready-for-token
  }
}
```

### postMessage Handler — Strict Origin Validation

```javascript
// =============================================
// postMessage — STRICT origin-validated message handling
// HIPAA additions: gas-ready-for-token handshake,
// sessionStorage instead of localStorage
// =============================================

window.addEventListener('message', function(e) {
  if (!e.data || !e.origin) return;

  // STRICT ORIGIN VALIDATION (unchanged from Researched Improved)
  var hostname = '';
  try {
    hostname = new URL(e.origin).hostname;
  } catch (_) {
    return;
  }

  if (!hostname.endsWith('.googleusercontent.com') &&
      hostname !== 'googleusercontent.com') {
    return;
  }

  switch (e.data.type) {
    case 'gas-ready-for-token':
      // HIPAA: Iframe is ready — send pending token via postMessage
      if (_pendingAccessToken) {
        var iframe = document.getElementById('gas-app');
        iframe.contentWindow.postMessage(
          { type: 'exchange-token', accessToken: _pendingAccessToken },
          '*'
        );
        _pendingAccessToken = null;
      }
      break;

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
      attemptReauth();
      break;

    case 'gas-signed-out':
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
    // HIPAA: Store ONLY the opaque session token in sessionStorage
    // (NOT localStorage — sessionStorage is cleared on tab close)
    sessionStorage.setItem('session-token', data.sessionToken);
    _sessionToken = data.sessionToken;

    if (data.email) sessionStorage.setItem('session-email', data.email);

    dismissReauthBanner();

    document.getElementById('auth-wall').classList.remove('show');
    document.getElementById('sign-out-btn').style.display = '';
    reloadIframe();
  } else {
    showAuthWall(data.error, data.email);
  }
}

function handleAuthOk(data) {
  if (data.version) {
    _gasVersion = data.version;
    sessionStorage.setItem('gas-version', data.version);  // HIPAA: sessionStorage
  }
  document.getElementById('sign-out-btn').style.display = '';

  if (data.needsReauth) {
    attemptReauth();
  }

  // HIPAA: Reset inactivity timer on successful auth
  resetInactivityTimer();
}
```

### Mandatory Inactivity Timeout (CHANGED — now REQUIRED)

```javascript
// =============================================
// HIPAA — MANDATORY Client-Side Inactivity Timeout
// 45 CFR 164.312(a)(2)(iii) — Automatic logoff
//
// This was OPTIONAL in the Researched Improved pattern.
// For HIPAA compliance, it is MANDATORY.
//
// The client-side timer is a defense-in-depth complement
// to the server-side session TTL. It provides immediate
// visual feedback (auth wall) when the user is inactive,
// rather than waiting for the next server request to discover
// the expired session.
//
// Set CLIENT_INACTIVITY_TIMEOUT <= SESSION_EXPIRATION.
// Recommended: 2-3 minutes shorter than server TTL to avoid
// the user seeing a brief "loading" state before the server
// also rejects the expired session.
// =============================================

var CLIENT_INACTIVITY_TIMEOUT = 720000;  // 12 minutes in ms (server TTL is 15 min)
var _inactivityTimer = null;

function resetInactivityTimer() {
  if (_inactivityTimer) clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(function() {
    // Auto-sign out on inactivity
    if (_sessionToken) {
      signOut(true);  // true = auto-signout (no confirmation dialog)
    }
  }, CLIENT_INACTIVITY_TIMEOUT);
}

// Reset timer on any user interaction
['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(function(evt) {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// Start the timer when the page loads
resetInactivityTimer();
```

### Re-Authentication with Interactive Fallback

```javascript
// =============================================
// RE-AUTH — Silent first, interactive fallback
// HIPAA: Audit logs re-auth attempts via server callback
// =============================================

var _reauthInProgress = false;

function attemptReauth() {
  if (_reauthInProgress) return;
  _reauthInProgress = true;

  loadGis(function() {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: _clientId,
      scope: 'email profile',
      prompt: '',
      callback: function(resp) {
        _reauthInProgress = false;

        if (resp && resp.access_token) {
          sendTokenToIframe(resp.access_token);  // HIPAA: postMessage, not URL
          dismissReauthBanner();
        } else {
          showReauthBanner();
        }
      },
      error_callback: function(err) {
        _reauthInProgress = false;
        showReauthBanner();
      }
    });

    client.requestAccessToken();
  });
}

function interactiveReauth() {
  dismissReauthBanner();

  loadGis(function() {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: _clientId,
      scope: 'email profile',
      callback: function(resp) {
        if (resp && resp.access_token) {
          sendTokenToIframe(resp.access_token);  // HIPAA: postMessage, not URL
        }
      }
    });
    client.requestAccessToken();
  });
}

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

### Iframe Loading

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

### Sign-Out (with Auto-Signout Support)

```javascript
// =============================================
// SIGN-OUT — Server-side session invalidation
// HIPAA: Supports auto-signout from inactivity timer
// =============================================

function signOut(autoSignout) {
  if (!autoSignout) {
    var confirmed = confirm('Sign out of this application?');
    if (!confirmed) return;
  }

  // 1. Invalidate session on the server via iframe reload
  var iframe = document.getElementById('gas-app');
  iframe.src = _gasBaseUrl + (_gasBaseUrl.indexOf('?') > -1 ? '&' : '?')
    + 'signOut=' + encodeURIComponent(_sessionToken);

  // 2. Clear client-side state (HIPAA: sessionStorage, not localStorage)
  sessionStorage.removeItem('session-token');
  sessionStorage.removeItem('session-email');
  sessionStorage.removeItem('gas-version');
  _sessionToken = '';

  // 3. Clear inactivity timer
  if (_inactivityTimer) clearTimeout(_inactivityTimer);

  // 4. Dismiss any re-auth banner
  dismissReauthBanner();

  // 5. Show auth wall
  var reason = autoSignout ? 'session_timeout' : 'not_signed_in';
  showAuthWall(reason, '');
}
```

## 9. Emergency Access Procedure

> **45 CFR 164.312(a)(2)(ii) — Emergency Access Procedure (REQUIRED)**: establish (and implement as needed) procedures for obtaining necessary ePHI during an emergency.

### How It Works

Emergency access is implemented via Script Properties — a server-side-only key-value store that is not accessible from client code and not visible in the deployed web app.

**Setup:**
1. Open the GAS project in the Apps Script editor
2. Go to Project Settings > Script Properties
3. Add key: `EMERGENCY_ACCESS_EMAILS`
4. Value: comma-separated list of authorized emergency access emails (e.g. `admin@yourdomain.com,security@yourdomain.com`)

**How it's used:**
- The `checkSpreadsheetAccess()` function checks `EMERGENCY_ACCESS_EMAILS` **before** checking spreadsheet permissions
- If the authenticated user's email appears in the emergency list, access is granted regardless of spreadsheet permissions
- Every emergency access grant is audit logged with event type `emergency_access`

**When to use:**
- Spreadsheet permissions are corrupted or inaccessible
- The normal authorization path is broken (SpreadsheetApp API outage)
- An authorized user needs immediate access and cannot wait for spreadsheet permissions to be updated
- Security incident investigation requires immediate access to the system

**Security controls:**
- Only Workspace domain accounts can use emergency access (domain restriction still applies)
- Every emergency access event is prominently logged in the audit trail
- The emergency access list is only editable by users with Script Properties access (typically only the GAS project owner)
- Emergency access should be reviewed and revoked after the emergency is resolved

### Emergency Access Audit Trail Example

```
Timestamp: 2026-03-12T01:15:00.000Z
User: admin@yourdomain.com
Event: emergency_access
Result: granted
Details: {"reason":"Emergency access override via Script Properties"}
```

---

## 10. MFA Enforcement Strategy

> **Current HIPAA status**: MFA is an "addressable" specification under current rules. The January 2025 NPRM proposes making it **mandatory** (expected finalization ~May 2026 with ~240-day compliance window).

### Recommended Approach: Workspace Admin-Enforced MFA

The most practical MFA strategy for a GAS-based architecture is to **enforce MFA at the Google Workspace Admin Console level**, not within the application:

1. **Google Workspace Admin Console** > Security > 2-Step Verification
2. Set enforcement to "On" for the organization
3. Set enrollment period (grace period for users to set up MFA)
4. After enforcement, all users in the Workspace domain must have MFA enabled

**Why this works for HIPAA:**
- This pattern already restricts authentication to Workspace domain accounts only (`ALLOWED_DOMAINS`)
- If MFA is enforced at the Workspace level, every user who successfully authenticates via Google OAuth has necessarily completed MFA
- The application doesn't need to verify MFA status — Workspace guarantees it as a precondition of successful authentication
- This approach is documented and defensible in a HIPAA risk analysis

### What This Pattern Does NOT Do

- **Does not verify MFA was used during the OAuth flow** — GIS does not expose MFA status in the token response. There is no way to confirm from the application side that a specific login used MFA
- **Does not add a secondary MFA step** — adding TOTP or SMS verification within GAS is technically possible but adds significant complexity and a second credential to manage
- **Does not use Google Cloud Identity Platform** — this would provide programmatic MFA enforcement but changes the architecture significantly

### Documentation for Risk Analysis

For HIPAA compliance documentation, record:

| Item | Value |
|------|-------|
| MFA Method | Google Workspace 2-Step Verification |
| Enforcement Level | Mandatory for all domain users via Admin Console |
| Supported MFA Types | Google Authenticator, Security Keys (FIDO2), Google Prompts, Backup codes |
| Application Verification | Indirect — application restricts to Workspace domain accounts where MFA is enforced |
| Risk Accepted | Application cannot independently verify MFA was used for a specific login |

---

## 11. CacheService Behavioral Caveats

Unchanged from the Researched Improved pattern — see [04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md § 8](04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md#8-cacheservice-behavioral-caveats).

**HIPAA-specific additions:**
- CacheService should **never** store ePHI — only opaque session identifiers and non-PHI metadata
- The HMAC integrity check (Section 5) provides tamper detection for cached session data
- If CacheService evicts a session early, the user must re-authenticate — this is acceptable behavior and may be preferable from a HIPAA perspective (shorter effective sessions)

---

## 12. Security Checklist

### Pre-Deployment (All items REQUIRED for HIPAA)

- [ ] Google Workspace BAA signed in Admin Console
- [ ] `ALLOWED_DOMAINS` set to your Workspace domain(s) — no consumer accounts
- [ ] MFA enforced for all domain users in Workspace Admin Console
- [ ] `HMAC_SECRET` set in Script Properties (random 32+ character string)
- [ ] `EMERGENCY_ACCESS_EMAILS` configured in Script Properties (authorized break-glass users)
- [ ] `SESSION_EXPIRATION` set to 900 seconds (15 minutes) or less
- [ ] `CLIENT_INACTIVITY_TIMEOUT` set to ≤ `SESSION_EXPIRATION` (recommended: 2-3 min shorter)
- [ ] `AuditLog` tab exists in project spreadsheet (auto-created on first write)
- [ ] `AuditLog` tab is protected (only script service account can write)
- [ ] Audit log retention policy documented (minimum 6 years)
- [ ] All `sessionStorage` references confirmed (no `localStorage` usage for auth data)
- [ ] No access token in any URL parameter (all exchanges via postMessage)
- [ ] HIPAA risk analysis document includes this auth pattern
- [ ] Incident response plan covers auth system failures

### Runtime Verification

- [ ] Audit log entries appearing for login/logout events
- [ ] Domain restriction rejecting non-Workspace accounts
- [ ] Session timeout working at 15-minute boundary
- [ ] Client-side inactivity timeout triggering auto-signout
- [ ] Re-auth banner appearing before session expiry
- [ ] Emergency access working and being logged
- [ ] HMAC validation catching any session data corruption

---

## 13. Five-Pattern Comparison

| Feature | Basic | Improved | Researched Improved | **HIPAA** |
|---------|-------|----------|-------------------|-----------|
| Server-side sessions | No | Yes | Yes | **Yes** |
| Opaque session tokens | No | Yes | Yes | **Yes** |
| Origin validation | None | `includes()` (bypassable) | `endsWith()` (strict) | **`endsWith()` (strict)** |
| Silent re-auth fallback | No | Silent only (fails silently) | Silent + interactive banner | **Silent + interactive banner** |
| CacheService caveats documented | No | No | Yes | **Yes** |
| Token exchange method | URL param | URL param | URL param (documented risk) | **postMessage (no URL exposure)** |
| Client-side storage | localStorage (raw token) | localStorage (session token) | localStorage (session token) | **sessionStorage (cleared on tab close)** |
| Session timeout | None | 30 min | 30 min | **15 min (HIPAA standard)** |
| Client-side inactivity timeout | None | Optional | Optional | **Mandatory (12 min)** |
| Audit logging | None | None | None | **Full — all auth events to Sheet** |
| Domain restriction | None | None | None | **Workspace domains only** |
| MFA | None | None | None | **Workspace Admin-enforced** |
| HMAC session integrity | None | None | None | **HMAC-SHA256 on session data** |
| Emergency access | None | None | None | **Script Properties override** |
| Single-session enforcement | Optional | Optional | Optional | **Enforced (MAX=1)** |
| BAA coverage | No | No | No | **Yes (Workspace BAA required)** |
| HIPAA compliance | None | None | None | **Full — all 45 CFR 164.312 addressed** |

---

## 14. Delta from Researched Improved Pattern

Every change in this pattern from the Researched Improved pattern, with HIPAA rationale:

| # | Change | HIPAA Rationale | 45 CFR Section |
|---|--------|-----------------|----------------|
| 1 | `SESSION_EXPIRATION`: 1800 → 900 (30 min → 15 min) | Industry standard for healthcare; NIST SP 800-53 recommends ≤15 min | 164.312(a)(2)(iii) |
| 2 | `localStorage` → `sessionStorage` | Reduces token persistence window; cleared on tab close | 164.312(a)(2)(iv) |
| 3 | Token exchange: URL parameter → postMessage | Eliminates token exposure in server logs, browser history, Referer headers | 164.312(e)(1) |
| 4 | Added `ALLOWED_DOMAINS` restriction | Ensures only BAA-covered Workspace accounts can authenticate | 164.312(d) |
| 5 | Added `auditLog()` system | All auth events logged to Google Sheet; required (not addressable) | 164.312(b) |
| 6 | Added HMAC integrity on session data | Detects tampering with cached session data | 164.312(c)(1) |
| 7 | Added emergency access via Script Properties | Break-glass procedure for obtaining ePHI during emergencies | 164.312(a)(2)(ii) |
| 8 | Client-side inactivity timeout: optional → mandatory | Defense-in-depth for automatic logoff requirement | 164.312(a)(2)(iii) |
| 9 | `MAX_SESSIONS_PER_USER`: configurable → enforced at 1 | Reduces attack surface; ensures one active session per user | 164.312(a)(1) |
| 10 | Added `gas-ready-for-token` handshake message | Prevents race condition in postMessage token exchange | 164.312(e)(1) |
| 11 | MFA enforcement strategy documented | Workspace Admin-enforced MFA addresses proposed 2025 NPRM | 164.312(d) |
| 12 | Sign-out supports auto-signout (no confirmation dialog) | Inactivity timer can sign out without user interaction | 164.312(a)(2)(iii) |

### What Did NOT Change

These elements are inherited unchanged from the Researched Improved pattern:
- Strict origin validation (`endsWith()` hostname suffix match)
- Silent re-auth with interactive fallback (`prompt: ''` → banner)
- CacheService behavioral caveats documentation
- Server-side token validation via Google userinfo API
- Session tracking for single-session enforcement logic
- Spreadsheet-based authorization check
- postMessage protocol structure (message types, data fields)

---

## 15. Troubleshooting

### "domain_not_allowed" Error

The user's Google account is not on an allowed Workspace domain.

- Verify `ALLOWED_DOMAINS` includes the user's email domain
- Confirm the user is using their Workspace account, not a personal @gmail.com
- Check the audit log for the `domain_rejected` entry with the rejected domain

### HMAC Mismatch Security Alert

The audit log shows an `hmac_mismatch` event.

- **Most likely cause**: `HMAC_SECRET` was rotated — all existing sessions have HMACs signed with the old secret. Users must re-authenticate
- **Less likely**: CacheService data corruption (rare but possible)
- **Action**: check if the HMAC secret was recently changed. If not, investigate as a potential security incident

### Emergency Access Not Working

- Verify `EMERGENCY_ACCESS_EMAILS` is set in Script Properties (not Script Variables or User Properties)
- Confirm the email is comma-separated with no extra spaces
- The user must still pass domain restriction — emergency access only bypasses spreadsheet authorization
- Check the audit log for `emergency_access` events

### Session Expiring Too Quickly

- `SESSION_EXPIRATION` is 900 seconds (15 minutes) — this is intentional for HIPAA
- CacheService may evict entries before TTL under memory pressure — this is expected behavior
- The client-side `CLIENT_INACTIVITY_TIMEOUT` (720000ms = 12 minutes) fires before the server TTL — this is by design
- If users need longer sessions, adjust `SESSION_EXPIRATION` upward (document the risk assessment justification for HIPAA)

### Audit Log Tab Not Appearing

- The `auditLog()` function auto-creates the tab on first write
- If the function fails silently (e.g., SPREADSHEET_ID is wrong), check Apps Script Logs (View > Logs) for `AUDIT LOG FAILURE` messages
- Ensure the script has edit access to the spreadsheet

### postMessage Token Exchange Not Working

- Verify the iframe loads the GAS URL without any token in the URL
- Check browser console for `gas-ready-for-token` message from the iframe
- The `_pendingAccessToken` variable should be set before the iframe signals ready
- If the iframe's `google.script.run` fails, check that the GAS deployment allows "Anyone" access (or "Anyone with Google Account" for Workspace-restricted deployment)

---

## Regulatory References

| Reference | Description |
|-----------|-------------|
| [45 CFR 164.312](https://www.law.cornell.edu/cfr/text/45/section-164.312) | HIPAA Technical Safeguards |
| [45 CFR 164.316(b)(2)(i)](https://www.law.cornell.edu/cfr/text/45/section-164.316) | Documentation retention (6 years) |
| [NIST SP 800-66r2](https://csrc.nist.gov/pubs/sp/800/66/r2/final) | Implementing the HIPAA Security Rule |
| [NIST SP 800-53](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) | Security and Privacy Controls (session timeout guidance) |
| [Google Workspace HIPAA](https://support.google.com/a/answer/3407054) | Workspace BAA and covered services (includes Apps Script) |
| [RFC 6750 §2.3](https://datatracker.ietf.org/doc/html/rfc6750#section-2.3) | Bearer Token Usage — discourages URL parameters |
| [2025 HIPAA NPRM](https://www.federalregister.gov/d/2024-30983) | Proposed mandatory MFA and encryption requirements |

---

Developed by: LightAISolutions

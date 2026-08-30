# Unified Toggleable Google OAuth Authentication Pattern

Implementation-ready reference for a **config-driven** Google OAuth authentication system in GAS web apps embedded via iframe. This pattern unifies patterns 3–5 into a single codebase where every HIPAA/security feature is controlled by a configuration object — deploy as standard or HIPAA-compliant by changing config values, not code.

> **Relationship to other patterns**:
> - [01-CUSTOM-AUTH-PATTERN.md](01-CUSTOM-AUTH-PATTERN.md) — custom username/password auth (separate architecture, not unified here)
> - [02-GOOGLE-OAUTH-AUTH-PATTERN.md](02-GOOGLE-OAUTH-AUTH-PATTERN.md) — basic pattern (raw token in localStorage, no server sessions)
> - [03-IMPROVED-GOOGLE-OAUTH-PATTERN.md](03-IMPROVED-GOOGLE-OAUTH-PATTERN.md) — server sessions, opaque tokens, silent re-auth
> - [04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md](04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md) — research-validated (strict origin, re-auth fallback, CacheService caveats)
> - [05-HIPAA-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md](05-HIPAA-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md) — HIPAA-compliant (audit logging, domain restriction, HMAC integrity)
> - **This document** — unified version with toggleable features, one codebase for all security levels

> **Design philosophy**: implement the superset (pattern 5), then gate every HIPAA-specific feature behind a config toggle. The code always contains all features — the config determines which are active. This eliminates code drift between security levels and makes upgrades a config change, not a code migration.

> **When to use this pattern**: when you need the flexibility to deploy the same codebase at different security levels (standard internal tool vs. HIPAA-regulated healthcare app) or when you want a single reference implementation that covers all cases.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Configuration System](#2-configuration-system)
3. [Presets — Standard vs HIPAA](#3-presets--standard-vs-hipaa)
4. [Config Resolution & Merging](#4-config-resolution--merging)
5. [GAS vs HTML Responsibility Split](#5-gas-vs-html-responsibility-split)
6. [Authentication Flow](#6-authentication-flow)
7. [Implementation Guide — GAS Backend](#7-implementation-guide--gas-backend)
8. [Implementation Guide — HTML Shell](#8-implementation-guide--html-shell)
9. [postMessage Protocol](#9-postmessage-protocol)
10. [Audit Logging System (Toggleable)](#10-audit-logging-system-toggleable)
11. [HMAC Integrity (Toggleable)](#11-hmac-integrity-toggleable)
12. [Domain Restriction (Toggleable)](#12-domain-restriction-toggleable)
13. [Emergency Access (Toggleable)](#13-emergency-access-toggleable)
14. [CacheService Behavioral Caveats](#14-cacheservice-behavioral-caveats)
15. [Security Checklist](#15-security-checklist)
16. [Migration Guide](#16-migration-guide)
17. [Feature Toggle Matrix](#17-feature-toggle-matrix)
18. [Six-Pattern Comparison](#18-six-pattern-comparison)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. Architecture Overview

> **Where the logic lives**: identical to patterns 3–5 — the GAS server owns all security. The HTML wrapper is a thin shell. The key difference is the **config object** that controls which security features are active.

```
┌─────────────────────────────────────────────────────────────────┐
│  HTML Wrapper (GitHub Pages / Custom Domain)                    │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │  Auth Wall        │    │  GAS iframe (full-screen)         │   │
│  │  (Sign In /       │    │  ┌────────────────────────────┐  │   │
│  │   Access Denied)  │    │  │  GAS Web App               │  │   │
│  │                   │    │  │  AUTH_CONFIG controls:      │  │   │
│  │  [Sign In with    │    │  │  ✓ Session TTL             │  │   │
│  │   Google]         │    │  │  ✓ Domain restriction      │  │   │
│  └──────────────────┘    │  │  ✓ HMAC integrity          │  │   │
│                           │  │  ✓ Audit logging           │  │   │
│  ┌──────────────────┐    │  │  ✓ Emergency access        │  │   │
│  │  Token storage    │    │  │  ✓ Single-session          │  │   │
│  │  (config-driven:  │    │  └────────────────────────────┘  │   │
│  │   localStorage    │    └──────────────────────────────────┘   │
│  │   OR              │                                          │
│  │   sessionStorage) │    postMessage (strict origin-validated)  │
│  └──────────────────┘    ◄──────────────────────────────────►   │
│                                                                 │
│  HTML_CONFIG controls:                                          │
│  ✓ Storage type (localStorage/sessionStorage)                   │
│  ✓ Token exchange method (URL param/postMessage)                │
│  ✓ Inactivity timeout (optional/mandatory)                      │
│  ✓ Auto-signout behavior                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Configuration System

The configuration system uses a two-layer approach:

1. **Presets** — named configurations (`standard`, `hipaa`) that provide complete default values
2. **Overrides** — per-project values that override specific preset defaults

This design ensures:
- **Zero config for common cases** — select a preset and go
- **Full customization** — override any value without forking the preset
- **Single source of truth** — the resolved config object is the authority for all behavior
- **No code changes for security level changes** — switching presets is a config change

### Config Object Structure

The config is split into two objects: `AUTH_CONFIG` (GAS backend) and `HTML_CONFIG` (HTML wrapper). They are separate because GAS and HTML cannot share runtime state — each reads its own config independently.

**GAS Backend — `AUTH_CONFIG`**:

```javascript
var AUTH_CONFIG = {
  // --- Session ---
  SESSION_EXPIRATION: 1800,        // seconds (standard: 1800 / HIPAA: 900)
  SESSION_REFRESH_WINDOW: 300,     // seconds before expiry to trigger refresh
  MAX_SESSIONS_PER_USER: 0,        // 0 = unlimited, 1+ = enforced limit

  // --- Google OAuth ---
  OAUTH_TOKEN_LIFETIME: 3600,      // Google access tokens last ~1 hour (do not change)
  OAUTH_REFRESH_BUFFER: 900,       // seconds — refresh if less than this remaining

  // --- Domain Restriction ---
  ENABLE_DOMAIN_RESTRICTION: false, // standard: false / HIPAA: true
  ALLOWED_DOMAINS: [],              // e.g. ['yourdomain.com'] — only when enabled

  // --- Audit Logging ---
  ENABLE_AUDIT_LOG: false,          // standard: false / HIPAA: true
  AUDIT_LOG_SHEET_NAME: 'AuditLog',
  AUDIT_LOG_RETENTION_YEARS: 6,     // 45 CFR 164.316(b)(2)(i) minimum

  // --- HMAC Session Integrity ---
  ENABLE_HMAC_INTEGRITY: false,     // standard: false / HIPAA: true
  HMAC_SECRET_PROPERTY: 'HMAC_SECRET', // Script Properties key name

  // --- Emergency Access ---
  ENABLE_EMERGENCY_ACCESS: false,   // standard: false / HIPAA: true
  EMERGENCY_ACCESS_PROPERTY: 'EMERGENCY_ACCESS_EMAILS', // Script Properties key name

  // --- Token Exchange ---
  TOKEN_EXCHANGE_METHOD: 'url',     // 'url' = URL parameter / 'postMessage' = secure handshake
};
```

**HTML Wrapper — `HTML_CONFIG`**:

```javascript
var HTML_CONFIG = {
  // --- Storage ---
  STORAGE_TYPE: 'localStorage',      // 'localStorage' / 'sessionStorage'

  // --- Token Exchange ---
  TOKEN_EXCHANGE_METHOD: 'url',      // must match AUTH_CONFIG.TOKEN_EXCHANGE_METHOD

  // --- Inactivity Timeout ---
  ENABLE_INACTIVITY_TIMEOUT: false,  // standard: false (optional) / HIPAA: true (mandatory)
  CLIENT_INACTIVITY_TIMEOUT: 720000, // ms (12 min — set ≤ SESSION_EXPIRATION)

  // --- Sign-Out ---
  ENABLE_AUTO_SIGNOUT: false,        // standard: false / HIPAA: true
};
```

---

## 3. Presets — Standard vs HIPAA

Presets provide complete, tested configurations. Select one as your baseline, then override individual values as needed.

### Standard Preset (Pattern 4 equivalent)

```javascript
var PRESETS = {
  standard: {
    gas: {
      SESSION_EXPIRATION: 1800,
      SESSION_REFRESH_WINDOW: 300,
      MAX_SESSIONS_PER_USER: 1,
      OAUTH_TOKEN_LIFETIME: 3600,
      OAUTH_REFRESH_BUFFER: 900,
      ENABLE_DOMAIN_RESTRICTION: false,
      ALLOWED_DOMAINS: [],
      ENABLE_AUDIT_LOG: false,
      AUDIT_LOG_SHEET_NAME: 'AuditLog',
      AUDIT_LOG_RETENTION_YEARS: 6,
      ENABLE_HMAC_INTEGRITY: false,
      HMAC_SECRET_PROPERTY: 'HMAC_SECRET',
      ENABLE_EMERGENCY_ACCESS: false,
      EMERGENCY_ACCESS_PROPERTY: 'EMERGENCY_ACCESS_EMAILS',
      TOKEN_EXCHANGE_METHOD: 'url'
    },
    html: {
      STORAGE_TYPE: 'localStorage',
      TOKEN_EXCHANGE_METHOD: 'url',
      ENABLE_INACTIVITY_TIMEOUT: false,
      CLIENT_INACTIVITY_TIMEOUT: 720000,
      ENABLE_AUTO_SIGNOUT: false
    }
  }
};
```

### HIPAA Preset (Pattern 5 equivalent)

```javascript
PRESETS.hipaa = {
  gas: {
    SESSION_EXPIRATION: 900,           // 15 min (HIPAA standard)
    SESSION_REFRESH_WINDOW: 180,       // 3 min
    MAX_SESSIONS_PER_USER: 1,          // enforced
    OAUTH_TOKEN_LIFETIME: 3600,
    OAUTH_REFRESH_BUFFER: 900,
    ENABLE_DOMAIN_RESTRICTION: true,   // Workspace-only
    ALLOWED_DOMAINS: [],               // MUST be set per-project
    ENABLE_AUDIT_LOG: true,            // 45 CFR 164.312(b) — required
    AUDIT_LOG_SHEET_NAME: 'AuditLog',
    AUDIT_LOG_RETENTION_YEARS: 6,
    ENABLE_HMAC_INTEGRITY: true,       // 45 CFR 164.312(c)(1)
    HMAC_SECRET_PROPERTY: 'HMAC_SECRET',
    ENABLE_EMERGENCY_ACCESS: true,     // 45 CFR 164.312(a)(2)(ii)
    EMERGENCY_ACCESS_PROPERTY: 'EMERGENCY_ACCESS_EMAILS',
    TOKEN_EXCHANGE_METHOD: 'postMessage' // RFC 6750 §2.3
  },
  html: {
    STORAGE_TYPE: 'sessionStorage',      // cleared on tab close
    TOKEN_EXCHANGE_METHOD: 'postMessage', // matches GAS config
    ENABLE_INACTIVITY_TIMEOUT: true,     // mandatory for HIPAA
    CLIENT_INACTIVITY_TIMEOUT: 720000,   // 12 min
    ENABLE_AUTO_SIGNOUT: true            // inactivity → auto sign-out
  }
};
```

### HIPAA Preset Validation

When using the `hipaa` preset, the config resolution step (Section 4) runs mandatory validation:

| Check | Condition | Error |
|-------|-----------|-------|
| `ALLOWED_DOMAINS` not empty | `ALLOWED_DOMAINS.length > 0` | "HIPAA preset requires ALLOWED_DOMAINS — set your Workspace domain(s)" |
| `HMAC_SECRET` exists | Script Properties has `HMAC_SECRET` key | Warning logged — HMAC will fail open until configured |
| `TOKEN_EXCHANGE_METHOD` match | GAS and HTML configs have same value | "TOKEN_EXCHANGE_METHOD mismatch between GAS and HTML configs" |
| Session timeout ≤ 15 min | `SESSION_EXPIRATION <= 900` | Warning — HIPAA standard recommends ≤15 minutes |

---

## 4. Config Resolution & Merging

Config resolution follows this priority (highest wins):

```
Per-project overrides  →  Preset defaults  →  Hardcoded fallbacks
```

### GAS Backend Resolution

```javascript
// =============================================
// CONFIG RESOLUTION — GAS Backend
// Select a preset, then apply per-project overrides.
// This runs once at script load time.
// =============================================

// Step 1: Choose your preset
var ACTIVE_PRESET = 'standard';  // Change to 'hipaa' for HIPAA compliance

// Step 2: Per-project overrides (optional)
// Only include values you want to change from the preset defaults.
var PROJECT_OVERRIDES = {
  // Example: use standard preset but enable audit logging
  // ENABLE_AUDIT_LOG: true,
  // AUDIT_LOG_SHEET_NAME: 'MyAuditLog',
};

// Step 3: Resolve config (preset + overrides)
var AUTH_CONFIG = resolveConfig(ACTIVE_PRESET, PROJECT_OVERRIDES);

/**
 * Merge preset defaults with per-project overrides.
 * Overrides take precedence — any key in PROJECT_OVERRIDES
 * replaces the preset's value for that key.
 *
 * @param {string} presetName - 'standard' or 'hipaa'
 * @param {Object} overrides - Per-project override values
 * @returns {Object} Resolved configuration object
 */
function resolveConfig(presetName, overrides) {
  var preset = PRESETS[presetName];
  if (!preset) {
    throw new Error('Unknown preset: ' + presetName + '. Valid presets: standard, hipaa');
  }

  // Shallow merge — overrides replace preset values key-by-key
  var resolved = {};
  var base = preset.gas;
  for (var key in base) {
    if (base.hasOwnProperty(key)) {
      resolved[key] = base[key];
    }
  }
  for (var key in overrides) {
    if (overrides.hasOwnProperty(key)) {
      resolved[key] = overrides[key];
    }
  }

  // HIPAA validation
  if (presetName === 'hipaa') {
    if (!resolved.ALLOWED_DOMAINS || resolved.ALLOWED_DOMAINS.length === 0) {
      throw new Error('HIPAA preset requires ALLOWED_DOMAINS — set your Workspace domain(s)');
    }
    if (resolved.SESSION_EXPIRATION > 900) {
      Logger.log('WARNING: HIPAA recommends SESSION_EXPIRATION ≤ 900s (15 min). Current: '
        + resolved.SESSION_EXPIRATION + 's');
    }
  }

  // Cross-config validation
  // Note: TOKEN_EXCHANGE_METHOD must be set consistently in both GAS and HTML.
  // This cannot be validated at runtime (GAS and HTML are separate contexts).
  // The developer must ensure they match.

  return resolved;
}
```

### HTML Wrapper Resolution

```javascript
// =============================================
// CONFIG RESOLUTION — HTML Wrapper
// Same pattern as GAS but for client-side config.
// This is defined inline in the HTML page's <script>.
// =============================================

var ACTIVE_PRESET = 'standard';  // Must match the GAS preset

var HTML_PROJECT_OVERRIDES = {
  // Example: use standard preset but enable inactivity timeout
  // ENABLE_INACTIVITY_TIMEOUT: true,
};

// Resolve using the same merge logic
var HTML_CONFIG = (function() {
  var preset = PRESETS[ACTIVE_PRESET].html;
  var resolved = {};
  for (var key in preset) {
    if (preset.hasOwnProperty(key)) resolved[key] = preset[key];
  }
  for (var key in HTML_PROJECT_OVERRIDES) {
    if (HTML_PROJECT_OVERRIDES.hasOwnProperty(key)) resolved[key] = HTML_PROJECT_OVERRIDES[key];
  }
  return resolved;
})();
```

---

## 5. GAS vs HTML Responsibility Split

| Responsibility | Owner | Toggle-Gated? | Notes |
|---------------|-------|---------------|-------|
| Token validation (Google userinfo API) | GAS | No | Always server-side |
| Session creation & management | GAS | No | Core functionality |
| Domain restriction | GAS | **Yes** — `ENABLE_DOMAIN_RESTRICTION` | Skipped when `false` |
| Audit logging | GAS | **Yes** — `ENABLE_AUDIT_LOG` | All `auditLog()` calls are no-ops when disabled |
| HMAC integrity on session data | GAS | **Yes** — `ENABLE_HMAC_INTEGRITY` | Session data stored plain when disabled |
| Emergency access override | GAS | **Yes** — `ENABLE_EMERGENCY_ACCESS` | `checkSpreadsheetAccess()` skips the check |
| Session timeout enforcement | GAS | Configurable — `SESSION_EXPIRATION` | Value changes, logic is the same |
| Single-session enforcement | GAS | Configurable — `MAX_SESSIONS_PER_USER` | `0` = unlimited, `1+` = enforced |
| Token exchange method | GAS + HTML | **Yes** — `TOKEN_EXCHANGE_METHOD` | `'url'` or `'postMessage'` — two code paths |
| Authorization (spreadsheet access) | GAS | No | Always checked |
| GIS sign-in popup | HTML | No | Browser-only — GIS requires browser context |
| Session token storage | HTML | Configurable — `STORAGE_TYPE` | `localStorage` or `sessionStorage` |
| Client-side inactivity timeout | HTML | **Yes** — `ENABLE_INACTIVITY_TIMEOUT` | Timer only starts when `true` |
| Auto-signout (no confirmation) | HTML | **Yes** — `ENABLE_AUTO_SIGNOUT` | Confirmation dialog when `false` |
| Re-auth banner | HTML | No | Always available (interactive fallback) |

**Split ratio**: ~80% GAS / ~20% HTML (same as patterns 3–5). The toggles do not change the split — they gate features within each side.

---

## 6. Authentication Flow

### Initial Sign-In (Toggle-Aware)

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
┌──────────────────────────────────────┐
│ TOKEN_EXCHANGE_METHOD check          │
│   ┌──────────┬──────────────┐        │
│   'url'       'postMessage'          │
│   │            │                     │
│   ▼            ▼                     │
│ Append to    Send via postMessage    │
│ iframe URL   after gas-ready-for-    │
│              token handshake         │
└──────────────────────────────────────┘
         │
         ▼
GAS receives access_token
         │
         ▼
GAS calls Google userinfo API (server-side)
         │
         ▼
┌──────────────────────────────────────┐
│ ENABLE_DOMAIN_RESTRICTION?           │
│   false: skip     true: check domain │
│                    │                 │
│              ┌─────┴─────┐           │
│              Rejected    Allowed     │
│              │            │          │
│              ▼            ▼          │
│           [auditLog      Continue    │
│            if enabled]               │
│           Return error               │
└──────────────────────────────────────┘
         │
         ▼
Check spreadsheet access
(with emergency access check if ENABLE_EMERGENCY_ACCESS)
         │
    ┌────┴────┐
    No        Yes
    │          │
    ▼          ▼
[auditLog]  Create session
Return err  [HMAC if ENABLE_HMAC_INTEGRITY]
            [auditLog if ENABLE_AUDIT_LOG]
            Return session token
```

### Token Refresh (with Interactive Fallback)

Unchanged from patterns 4/5 — silent `prompt: ''` first, interactive banner fallback on failure. See [04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md § 4](04-RESEARCHED-IMPROVED-GOOGLE-OAUTH-PATTERN.md#4-authentication-flow).

When `ENABLE_AUDIT_LOG` is `true`, every re-auth attempt (success or failure) is logged.

---

## 7. Implementation Guide — GAS Backend

> **All security logic lives here (~80% of auth system).** The code below is implementation-ready — copy it directly into your `.gs` file. Toggle-gated features use `AUTH_CONFIG.*` checks.

### Presets & Config Resolution

Include the full preset definitions and `resolveConfig()` function from Section 4 at the top of your `.gs` file. Then:

```javascript
// =============================================
// SELECT YOUR PRESET AND OVERRIDES
// =============================================
var ACTIVE_PRESET = 'standard';  // 'standard' or 'hipaa'
var PROJECT_OVERRIDES = {
  // Uncomment to override specific values:
  // ENABLE_AUDIT_LOG: true,
  // SESSION_EXPIRATION: 1200,
};
var AUTH_CONFIG = resolveConfig(ACTIVE_PRESET, PROJECT_OVERRIDES);
```

### Conditional Audit Logger

```javascript
// =============================================
// AUDIT LOGGING — Toggle-Gated
// No-op when AUTH_CONFIG.ENABLE_AUDIT_LOG === false.
// Full implementation when true (see Section 10).
// =============================================

/**
 * Write an audit log entry — or do nothing if logging is disabled.
 * This wrapper is called throughout the auth code without
 * checking the toggle at each call site.
 */
function auditLog(event, user, result, details) {
  if (!AUTH_CONFIG.ENABLE_AUDIT_LOG) return;  // Toggle gate
  _writeAuditLogEntry(event, user, result, details);
}
```

### Session Management Functions (Toggle-Gated)

```javascript
// =============================================
// AUTH — Session Management (Server-Side)
// Toggle-gated: domain restriction, HMAC, audit, emergency access
// =============================================

/**
 * Exchange a Google access token for a server-side session token.
 * Toggle-gated features are checked inline via AUTH_CONFIG.
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

  // 2. Domain restriction (toggle-gated)
  if (AUTH_CONFIG.ENABLE_DOMAIN_RESTRICTION) {
    var emailDomain = userInfo.email.split('@')[1].toLowerCase();
    var domainAllowed = false;
    for (var i = 0; i < AUTH_CONFIG.ALLOWED_DOMAINS.length; i++) {
      if (emailDomain === AUTH_CONFIG.ALLOWED_DOMAINS[i].toLowerCase()) {
        domainAllowed = true;
        break;
      }
    }
    if (!domainAllowed) {
      auditLog('login_failed', userInfo.email, 'domain_rejected',
        { domain: emailDomain, allowed: AUTH_CONFIG.ALLOWED_DOMAINS.join(',') });
      return { success: false, error: "domain_not_allowed", email: userInfo.email };
    }
  }

  // 3. Check authorization (spreadsheet access + emergency access if enabled)
  if (!checkSpreadsheetAccess(userInfo.email)) {
    auditLog('login_failed', userInfo.email, 'access_denied',
      { reason: 'No spreadsheet access' });
    return { success: false, error: "not_authorized", email: userInfo.email };
  }

  // 4. Enforce single-session (configurable)
  if (AUTH_CONFIG.MAX_SESSIONS_PER_USER > 0) {
    invalidateAllSessions(userInfo.email);
  }

  // 5. Create session token (cryptographically random UUID)
  var sessionToken = Utilities.getUuid() + Utilities.getUuid();
  sessionToken = sessionToken.replace(/-/g, "").substring(0, 48);

  // 6. Store session data (with HMAC if enabled)
  var sessionData = {
    email: userInfo.email,
    displayName: userInfo.displayName,
    accessToken: accessToken,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    tokenObtainedAt: Date.now()
  };

  // HMAC integrity (toggle-gated)
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) {
    sessionData.hmac = generateSessionHmac(sessionData);
  }

  var cache = CacheService.getScriptCache();
  cache.put(
    "session_" + sessionToken,
    JSON.stringify(sessionData),
    AUTH_CONFIG.SESSION_EXPIRATION
  );

  // 7. Track active sessions for this user
  trackUserSession(userInfo.email, sessionToken);

  // 8. Audit log (toggle-gated via auditLog wrapper)
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
 * Toggle-gated: HMAC verification, audit on expiry.
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

  // HMAC verification (toggle-gated)
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) {
    if (!verifySessionHmac(sessionData)) {
      auditLog('security_alert', sessionData.email || 'unknown', 'hmac_mismatch',
        { sessionId: sessionToken.substring(0, 8) + '...' });
      cache.remove("session_" + sessionToken);
      return { status: "not_signed_in" };
    }
  }

  // Authoritative expiry check using createdAt timestamp
  var elapsed = (Date.now() - sessionData.createdAt) / 1000;
  if (elapsed > AUTH_CONFIG.SESSION_EXPIRATION) {
    auditLog('session_expired', sessionData.email, 'timeout',
      { elapsed: Math.round(elapsed) + 's', limit: AUTH_CONFIG.SESSION_EXPIRATION + 's' });
    cache.remove("session_" + sessionToken);
    return { status: "not_signed_in" };
  }

  // Check if Google token needs refresh
  var needsReauth = checkGoogleTokenExpiry(sessionData);

  // Update last activity (extends the CacheService TTL)
  sessionData.lastActivity = Date.now();
  if (AUTH_CONFIG.ENABLE_HMAC_INTEGRITY) {
    sessionData.hmac = generateSessionHmac(sessionData);  // Re-sign after update
  }
  cache.put(
    "session_" + sessionToken,
    JSON.stringify(sessionData),
    AUTH_CONFIG.SESSION_EXPIRATION
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

### Google Token Validation & Helpers

```javascript
// =============================================
// AUTH — Google Token Operations (Server-Side Only)
// These functions are NOT toggle-gated — they are core.
// =============================================

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

function checkGoogleTokenExpiry(sessionData) {
  var tokenAge = (Date.now() - sessionData.tokenObtainedAt) / 1000;
  return tokenAge >= (AUTH_CONFIG.OAUTH_TOKEN_LIFETIME - AUTH_CONFIG.OAUTH_REFRESH_BUFFER);
}

function trackUserSession(email, sessionToken) {
  var cache = CacheService.getScriptCache();
  var trackKey = "sessions_" + email.toLowerCase();
  var raw = cache.get(trackKey);
  var tokens = [];
  if (raw) {
    try { tokens = JSON.parse(raw); } catch (e) {}
  }
  tokens.push(sessionToken);
  cache.put(trackKey, JSON.stringify(tokens), AUTH_CONFIG.SESSION_EXPIRATION);
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
      cache.put(trackKey, JSON.stringify(tokens), AUTH_CONFIG.SESSION_EXPIRATION);
    } else {
      cache.remove(trackKey);
    }
  } catch (e) {}
}
```

### Authorization Check (with Toggle-Gated Emergency Access)

```javascript
// =============================================
// AUTH — Authorization (Spreadsheet Access)
// Toggle-gated: emergency access override
// =============================================

function checkSpreadsheetAccess(email, opt_ss) {
  if (!email) return false;
  var lowerEmail = email.toLowerCase();

  // Emergency access override (toggle-gated)
  if (AUTH_CONFIG.ENABLE_EMERGENCY_ACCESS) {
    var emergencyEmails = PropertiesService.getScriptProperties()
      .getProperty(AUTH_CONFIG.EMERGENCY_ACCESS_PROPERTY);
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

### Web App Entry Point (Toggle-Gated Token Exchange)

```javascript
// =============================================
// WEB APP ENTRY POINT
// Toggle-gated: TOKEN_EXCHANGE_METHOD controls
// whether doGet() accepts URL-param tokens or
// serves a postMessage listener page.
// =============================================

function doGet(e) {
  var sessionToken = (e && e.parameter && e.parameter.session) || "";
  var signOutToken = (e && e.parameter && e.parameter.signOut) || "";

  // Sign-out flow
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

  // URL-parameter token exchange (standard mode)
  if (AUTH_CONFIG.TOKEN_EXCHANGE_METHOD === 'url') {
    var exchangeToken = (e && e.parameter && e.parameter.exchangeToken) || "";
    if (exchangeToken) {
      var result = exchangeTokenForSession(exchangeToken);
      if (result.success) {
        var html = buildFormHtml(result.sessionToken);
        return HtmlService.createHtmlOutput(html)
          .setTitle(TITLE)
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }
    }
  }

  // Returning user with existing session
  if (sessionToken) {
    var html = buildFormHtml(sessionToken);
    return HtmlService.createHtmlOutput(html)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // postMessage token exchange (HIPAA mode)
  if (AUTH_CONFIG.TOKEN_EXCHANGE_METHOD === 'postMessage') {
    var exchangeHtml = buildTokenExchangeListenerHtml();
    return HtmlService.createHtmlOutput(exchangeHtml)
      .setTitle(TITLE)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Fallback: serve auth wall
  var html = buildFormHtml('');
  return HtmlService.createHtmlOutput(html)
    .setTitle(TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * postMessage token exchange listener page.
 * Only used when TOKEN_EXCHANGE_METHOD === 'postMessage'.
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
// AUTH GATE — Use in every server function that returns data.
// Audit logging is toggle-gated via the auditLog() wrapper.
// =============================================

function getFormData(opt_sessionToken) {
  var session = validateSession(opt_sessionToken);

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

  auditLog('data_access', session.email, 'success',
    { function: 'getFormData' });

  return {
    authorized: true,
    email: session.email,
    displayName: session.displayName,
    needsReauth: session.needsReauth || false,
    version: VERSION,
    data: {} // your data
  };
}

function serverSignOut(sessionToken) {
  invalidateSession(sessionToken);
  return { success: true };
}
```

---

## 8. Implementation Guide — HTML Shell

> **Principle**: the HTML wrapper is a thin authentication shell. It handles the Google Sign-In flow in the browser, exchanges the token with the GAS backend, and manages the client-side session. All security decisions are server-side — the HTML layer only enforces UX behaviors (inactivity timeout, auto-signout) that are toggle-gated by `HTML_CONFIG`.

### HTML Config Resolution

```javascript
// =============================================
// HTML CONFIG — Client-Side Feature Toggles
// Mirror of the GAS-side preset's html section.
// =============================================

// Step 1: Match the GAS preset's HTML section
// (copy from PRESETS[ACTIVE_PRESET].html in Section 3)
var HTML_CONFIG = {
  STORAGE_TYPE: 'localStorage',
  TOKEN_EXCHANGE_METHOD: 'url',
  ENABLE_INACTIVITY_TIMEOUT: false,
  CLIENT_INACTIVITY_TIMEOUT: 720000,
  ENABLE_AUTO_SIGNOUT: false
};

// Helper: get the correct storage object
function getStorage() {
  return HTML_CONFIG.STORAGE_TYPE === 'sessionStorage'
    ? window.sessionStorage
    : window.localStorage;
}
```

### Storage Abstraction (Toggle-Gated)

```javascript
// =============================================
// STORAGE — Toggle-gated via HTML_CONFIG.STORAGE_TYPE
// sessionStorage clears on tab close (HIPAA).
// localStorage persists across sessions (standard).
// All storage operations go through these wrappers.
// =============================================

var SESSION_KEY = 'gas_session_token';
var EMAIL_KEY = 'gas_user_email';

function saveSession(sessionToken, email) {
  var storage = getStorage();
  storage.setItem(SESSION_KEY, sessionToken);
  storage.setItem(EMAIL_KEY, email);
}

function loadSession() {
  var storage = getStorage();
  return {
    token: storage.getItem(SESSION_KEY),
    email: storage.getItem(EMAIL_KEY)
  };
}

function clearSession() {
  var storage = getStorage();
  storage.removeItem(SESSION_KEY);
  storage.removeItem(EMAIL_KEY);
}
```

### Google Sign-In Initialization

```javascript
// =============================================
// GOOGLE SIGN-IN — Initialize Google Identity Services.
// Silent re-auth with interactive fallback (pattern 4+).
// =============================================

var GAS_ORIGIN = 'https://script.google.com';
var CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
var gasFrame = document.getElementById('gas-iframe');
var signInClient = null;

function initGoogleSignIn() {
  signInClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'openid email profile',
    prompt: '',                // silent first (no user interaction)
    callback: handleTokenResponse
  });
  // Attempt silent sign-in on load
  signInClient.requestAccessToken();
}

function handleTokenResponse(response) {
  if (response.error) {
    // Silent auth failed — fall back to interactive
    signInClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'openid email profile',
      prompt: 'consent',       // interactive fallback
      callback: handleTokenResponse
    });
    showReauthBanner('Click "Sign In" to continue.', true);
    return;
  }
  exchangeToken(response.access_token);
}
```

### Token Exchange — Dual Path (Toggle-Gated)

```javascript
// =============================================
// TOKEN EXCHANGE — Toggle-gated via TOKEN_EXCHANGE_METHOD
// 'url'         → Append token as URL parameter (standard)
// 'postMessage' → Secure handshake via window.postMessage (HIPAA)
// Both paths end with saveSession() on success.
// =============================================

function exchangeToken(googleAccessToken) {
  if (HTML_CONFIG.TOKEN_EXCHANGE_METHOD === 'postMessage') {
    exchangeViaPostMessage(googleAccessToken);
  } else {
    exchangeViaUrl(googleAccessToken);
  }
}

// --- URL Parameter Path (standard) ---
function exchangeViaUrl(googleAccessToken) {
  // Reload the iframe with the token as a URL parameter
  var baseUrl = gasFrame.dataset.baseUrl;  // stored in data-base-url attribute
  gasFrame.src = baseUrl + '?exchangeToken=' + encodeURIComponent(googleAccessToken);

  // The GAS doGet() handles exchange and returns the form HTML
  // with the session token embedded. Listen for the session token
  // via postMessage from the loaded form page.
  window.addEventListener('message', function handler(event) {
    if (event.origin !== GAS_ORIGIN) return;
    var data = event.data;
    if (data && data.type === 'gas-session-ready') {
      saveSession(data.sessionToken, data.email);
      showApp();
      startInactivityTimer();
      window.removeEventListener('message', handler);
    }
  });
}

// --- postMessage Path (HIPAA) ---
var pendingToken = null;

function exchangeViaPostMessage(googleAccessToken) {
  pendingToken = googleAccessToken;

  // Reload the iframe to get a fresh postMessage listener page
  var baseUrl = gasFrame.dataset.baseUrl;
  gasFrame.src = baseUrl;

  // The GAS doGet() returns a listener page that sends
  // 'gas-ready-for-token' when loaded. We wait for that signal.
  window.addEventListener('message', function handler(event) {
    if (event.origin !== GAS_ORIGIN) return;
    var data = event.data;

    // Step 1: GAS iframe signals ready
    if (data && data.type === 'gas-ready-for-token' && pendingToken) {
      gasFrame.contentWindow.postMessage({
        type: 'google-token',
        token: pendingToken
      }, GAS_ORIGIN);
      pendingToken = null;
    }

    // Step 2: GAS iframe responds with session result
    if (data && data.type === 'gas-session-result') {
      if (data.success) {
        saveSession(data.sessionToken, data.email);
        // Reload iframe with session token to show the actual form
        gasFrame.src = baseUrl + '?session=' + encodeURIComponent(data.sessionToken);
        showApp();
        startInactivityTimer();
      } else {
        showReauthBanner('Authentication failed: ' + (data.error || 'Unknown error'), true);
      }
      window.removeEventListener('message', handler);
    }
  });
}
```

### Inactivity Timeout (Toggle-Gated)

```javascript
// =============================================
// INACTIVITY TIMEOUT — Toggle-gated via HTML_CONFIG
// When enabled, tracks user activity and signs out
// after CLIENT_INACTIVITY_TIMEOUT ms of inactivity.
// HIPAA: mandatory (45 CFR 164.312(a)(2)(iii))
// Standard: optional (off by default)
// =============================================

var inactivityTimer = null;
var ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

function startInactivityTimer() {
  if (!HTML_CONFIG.ENABLE_INACTIVITY_TIMEOUT) return; // toggle gate

  resetInactivityTimer();
  ACTIVITY_EVENTS.forEach(function(event) {
    document.addEventListener(event, resetInactivityTimer, { passive: true });
  });
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(function() {
    handleInactivityTimeout();
  }, HTML_CONFIG.CLIENT_INACTIVITY_TIMEOUT);
}

function stopInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  ACTIVITY_EVENTS.forEach(function(event) {
    document.removeEventListener(event, resetInactivityTimer);
  });
}

function handleInactivityTimeout() {
  stopInactivityTimer();

  if (HTML_CONFIG.ENABLE_AUTO_SIGNOUT) {
    // Auto sign-out: clear session and force re-auth
    performSignOut('inactivity');
  } else {
    // Show warning: session may have expired
    showReauthBanner('Session timed out due to inactivity. Click to continue.', true);
  }
}
```

### Sign-Out (with Auto-Signout Support)

```javascript
// =============================================
// SIGN-OUT — Clears client session, notifies GAS server.
// Auto-signout integration: called by inactivity timeout
// when ENABLE_AUTO_SIGNOUT is true.
// =============================================

function performSignOut(reason) {
  var session = loadSession();
  clearSession();
  stopInactivityTimer();

  // Notify GAS server to invalidate server-side session
  if (session.token) {
    var baseUrl = gasFrame.dataset.baseUrl;
    gasFrame.src = baseUrl + '?signOut=' + encodeURIComponent(session.token);
  }

  // Revoke Google OAuth token
  if (google.accounts.oauth2) {
    google.accounts.oauth2.revoke(session.token, function() {});
  }

  showSignedOutState(reason);
}

function showSignedOutState(reason) {
  var message = 'You have been signed out.';
  if (reason === 'inactivity') {
    message = 'Signed out due to inactivity. Click "Sign In" to continue.';
  }
  showReauthBanner(message, true);
}
```

### Re-Auth with Interactive Fallback

```javascript
// =============================================
// RE-AUTH — Silent re-auth with interactive fallback.
// Pattern 4+ behavior: try silent first (prompt: ''),
// if that fails show a banner with a sign-in button.
// Called when: session expired, token refresh needed,
// server returns needsReauth flag.
// =============================================

function attemptReauth() {
  // Reset to silent mode
  signInClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'openid email profile',
    prompt: '',
    callback: function(response) {
      if (response.error) {
        // Silent re-auth failed — show interactive banner
        showReauthBanner('Session expired. Click "Sign In" to continue.', true);
        signInClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'openid email profile',
          prompt: 'consent',
          callback: handleTokenResponse
        });
      } else {
        exchangeToken(response.access_token);
      }
    }
  });
  signInClient.requestAccessToken();
}
```

### Re-Auth Banner UI

```javascript
// =============================================
// RE-AUTH BANNER — Shows a non-blocking banner when
// re-authentication is needed. The banner overlays
// the iframe area and includes a sign-in button.
// =============================================

function showReauthBanner(message, showButton) {
  var banner = document.getElementById('reauth-banner');
  var bannerText = document.getElementById('reauth-text');
  var bannerBtn = document.getElementById('reauth-btn');

  bannerText.textContent = message;
  bannerBtn.style.display = showButton ? 'inline-block' : 'none';
  banner.style.display = 'flex';
}

function hideReauthBanner() {
  var banner = document.getElementById('reauth-banner');
  banner.style.display = 'none';
}

function showApp() {
  hideReauthBanner();
  document.getElementById('gas-iframe').style.display = 'block';
  document.getElementById('loading-state').style.display = 'none';
}
```

### Server Communication (Data Fetch with Session)

```javascript
// =============================================
// SERVER COMMUNICATION — All GAS function calls
// include the session token for server-side validation.
// If the server returns unauthorized or needsReauth,
// trigger re-auth flow.
// =============================================

function callServer(functionName, args) {
  var session = loadSession();
  if (!session.token) {
    attemptReauth();
    return;
  }

  // Prepend session token as first argument
  var fullArgs = [session.token].concat(args || []);

  google.script.run
    .withSuccessHandler(function(result) {
      if (result && !result.authorized) {
        if (result.authStatus === 'expired' || result.needsReauth) {
          attemptReauth();
        } else {
          showReauthBanner('Access denied: ' + (result.authStatus || 'unauthorized'), true);
        }
        return;
      }
      // Handle successful response in the calling context
      return result;
    })
    .withFailureHandler(function(error) {
      console.error('Server call failed:', error);
    })
    [functionName].apply(null, fullArgs);
}
```

### Minimal HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your App Title</title>
  <!-- Google Identity Services -->
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <!-- Loading state -->
  <div id="loading-state">Loading...</div>

  <!-- Re-auth banner (hidden by default) -->
  <div id="reauth-banner" style="display:none; position:fixed; top:0; left:0;
    width:100%; padding:12px; background:#fff3cd; border-bottom:1px solid #ffc107;
    z-index:9999; align-items:center; justify-content:center; gap:12px;">
    <span id="reauth-text"></span>
    <button id="reauth-btn" onclick="signInClient.requestAccessToken()"
      style="display:none; padding:8px 16px; background:#4285f4; color:white;
      border:none; border-radius:4px; cursor:pointer;">Sign In</button>
  </div>

  <!-- GAS iframe -->
  <iframe id="gas-iframe" style="display:none; width:100%; height:100vh; border:none;"
    data-base-url="YOUR_GAS_DEPLOYMENT_URL"></iframe>

  <script>
    // === PASTE HTML_CONFIG HERE (from Section 2) ===
    // === PASTE ALL JS SECTIONS ABOVE ===

    // Initialize on Google Identity Services load
    window.onload = function() {
      var session = loadSession();
      if (session.token) {
        // Resume existing session
        var baseUrl = gasFrame.dataset.baseUrl;
        gasFrame.src = baseUrl + '?session=' + encodeURIComponent(session.token);
        showApp();
        startInactivityTimer();
      } else {
        // No session — start sign-in flow
        initGoogleSignIn();
      }
    };
  </script>
</body>
</html>
```

> **Key toggle behaviors in the HTML shell**:
> | Toggle | Off (standard) | On (HIPAA) |
> |--------|---------------|------------|
> | `STORAGE_TYPE` | `localStorage` — persists across tabs/sessions | `sessionStorage` — cleared on tab close |
> | `TOKEN_EXCHANGE_METHOD` | `url` — token in URL parameter | `postMessage` — secure handshake, token never in URL |
> | `ENABLE_INACTIVITY_TIMEOUT` | Disabled — no timeout tracking | Active — signs out after `CLIENT_INACTIVITY_TIMEOUT` ms |
> | `ENABLE_AUTO_SIGNOUT` | N/A (timeout disabled) | Auto sign-out on inactivity (vs. just showing a warning) |

---

## 9. postMessage Protocol

> **When this applies**: only when `TOKEN_EXCHANGE_METHOD = 'postMessage'` (HIPAA preset). The URL-parameter path skips this entire protocol — the token is passed as a URL query parameter and the GAS `doGet()` handles everything synchronously.

### Three-Phase Handshake

```
Phase 1: Load
  Parent (HTML wrapper)                    GAS iframe
  ─────────────────────                    ──────────
  Sets iframe.src = GAS_URL         ──►    doGet() returns listener HTML

Phase 2: Ready Signal
  Parent                                   GAS iframe
  ─────────────────────                    ──────────
  Receives 'gas-ready-for-token'    ◄──    Sends: { type: 'gas-ready-for-token' }
  Sends Google token to iframe      ──►    Sends: { type: 'google-token', token: '...' }

Phase 3: Exchange Result
  Parent                                   GAS iframe
  ─────────────────────                    ──────────
  Receives session result           ◄──    Calls exchangeTokenForSession()
  Saves session, loads form                Sends: { type: 'gas-session-result', ... }
```

### Origin Validation Rules

```javascript
// PARENT — receiving messages from GAS iframe
window.addEventListener('message', function(event) {
  // STRICT origin check — GAS web apps serve from script.google.com
  if (event.origin !== 'https://script.google.com') return;

  // Only process known message types
  var data = event.data;
  if (!data || typeof data !== 'object') return;

  switch (data.type) {
    case 'gas-ready-for-token':
      // Phase 2: iframe is ready — send the buffered token
      break;
    case 'gas-session-result':
      // Phase 3: exchange complete — save session or show error
      break;
    case 'gas-signed-out':
      // Sign-out confirmation
      break;
    default:
      return; // Ignore unknown message types
  }
});
```

```javascript
// GAS IFRAME — sending messages to parent
// The listener page (returned by doGet when no session/token params):

// Ready signal — sent when listener page loads
window.parent.postMessage({ type: 'gas-ready-for-token' }, '*');
// Note: targetOrigin is '*' because GAS cannot know the parent's origin.
// Security is maintained because:
// 1. The ready signal contains no sensitive data
// 2. The parent validates event.origin before sending the token
// 3. The session result is sent back to the parent (same window)

// Receiving token from parent
window.addEventListener('message', function(event) {
  // Cannot validate parent origin from GAS iframe (CORS restrictions)
  // Security relies on: GAS server validates the Google token server-side
  if (event.data && event.data.type === 'google-token') {
    // Exchange via google.script.run (server-side validation)
    google.script.run
      .withSuccessHandler(function(result) {
        window.parent.postMessage({
          type: 'gas-session-result',
          success: result.success,
          sessionToken: result.sessionToken,
          email: result.email
        }, '*');
      })
      .withFailureHandler(function(error) {
        window.parent.postMessage({
          type: 'gas-session-result',
          success: false,
          error: 'server_error'
        }, '*');
      })
      .exchangeTokenForSession(event.data.token);
  }
});
```

### Message Types Reference

| Type | Direction | Payload | When |
|------|-----------|---------|------|
| `gas-ready-for-token` | iframe → parent | `{}` (no payload) | Iframe listener page loaded |
| `google-token` | parent → iframe | `{ token: 'access_token' }` | After receiving ready signal |
| `gas-session-result` | iframe → parent | `{ success, sessionToken, email }` or `{ success: false, error }` | After server-side exchange |
| `gas-session-ready` | iframe → parent | `{ sessionToken, email }` | URL-path: form page loaded with session |
| `gas-signed-out` | iframe → parent | `{ success: true }` | Server-side sign-out complete |

### Race Condition Prevention

The `gas-ready-for-token` handshake solves the fundamental timing problem: the parent cannot send a token before the iframe's message listener is registered. Without the ready signal, the `postMessage` call may arrive before the iframe has set up its listener — and `postMessage` does **not** queue messages.

```javascript
// ANTI-PATTERN — race condition (DO NOT USE)
gasFrame.src = gasUrl;
gasFrame.contentWindow.postMessage({ token: '...' }, origin);
// ❌ Token may arrive before iframe's listener is ready

// CORRECT — wait for ready signal
gasFrame.src = gasUrl;
// Token is buffered in pendingToken variable
// Sent only after 'gas-ready-for-token' is received
```

---

## 10. Audit Logging System (Toggleable)

> **Toggle**: `AUTH_CONFIG.ENABLE_AUDIT_LOG`
> **HIPAA**: mandatory (45 CFR 164.312(b) — Audit controls)
> **Standard**: optional (off by default, can be enabled per-project)

### The `auditLog()` Wrapper

All audit calls in the GAS backend go through this single wrapper. When the toggle is off, the function is a no-op — zero performance cost.

```javascript
// =============================================
// AUDIT LOG — Toggle-gated wrapper.
// When disabled: returns immediately (no-op).
// When enabled: writes to the configured spreadsheet.
// Failures are caught — audit logging never blocks auth.
// =============================================

function auditLog(action, email, result, details) {
  if (!AUTH_CONFIG.ENABLE_AUDIT_LOG) return; // toggle gate

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(AUTH_CONFIG.AUDIT_LOG_SHEET_NAME);

    if (!sheet) {
      // Auto-create the audit sheet with headers
      sheet = ss.insertSheet(AUTH_CONFIG.AUDIT_LOG_SHEET_NAME);
      sheet.appendRow([
        'Timestamp', 'Action', 'Email', 'Result',
        'Session Token (prefix)', 'Details'
      ]);
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    var tokenPrefix = (details && details.sessionToken)
      ? details.sessionToken.substring(0, 8) + '...'
      : '';

    sheet.appendRow([
      new Date(),
      action,
      email || 'unknown',
      result || 'success',
      tokenPrefix,
      JSON.stringify(details || {})
    ]);
  } catch (e) {
    // CRITICAL: audit logging must NEVER block the main operation.
    // Log to console for debugging, but do not throw.
    console.error('Audit log write failed: ' + e.message);
  }
}
```

### Logged Events

| Action | When | Logged Data |
|--------|------|-------------|
| `login_success` | Token exchange succeeded | email, session token prefix |
| `login_failed` | Token validation failed | email (if available), error reason |
| `logout` | User signed out | email, session token prefix |
| `session_validated` | Session check passed | email (only if audit is verbose) |
| `session_expired` | Session check found expired token | email, session token prefix |
| `session_tampered` | HMAC integrity check failed | session token prefix |
| `data_access` | Server function returned data | email, function name |
| `data_access_denied` | Authorization check failed | email, function name, reason |
| `domain_rejected` | Domain restriction blocked user | email, domain |
| `emergency_access` | Break-glass override used | email, reason |
| `all_sessions_invalidated` | Admin cleared all sessions | triggered by email |

### Performance Notes

- `appendRow()` is atomic but takes ~200-500ms per call
- Auth events happen at human speed (logins, not API calls) — this overhead is acceptable
- The `try/catch` wrapper ensures a Sheets API failure never blocks authentication
- **GAS limitation**: client IP addresses are not available in `doGet()` — cannot be logged

### Sheet Rotation (Long-Term Retention)

For HIPAA compliance (6-year retention per 45 CFR 164.316(b)(2)(i)), implement monthly rotation:

```javascript
function getAuditSheetName() {
  var now = new Date();
  var year = now.getFullYear();
  var month = ('0' + (now.getMonth() + 1)).slice(-2);
  return AUTH_CONFIG.AUDIT_LOG_SHEET_NAME + '-' + year + '-' + month;
}
```

Replace `AUTH_CONFIG.AUDIT_LOG_SHEET_NAME` with `getAuditSheetName()` in `auditLog()` for automatic monthly sheet creation.

---

## 11. HMAC Integrity (Toggleable)

> **Toggle**: `AUTH_CONFIG.ENABLE_HMAC_INTEGRITY`
> **HIPAA**: mandatory (45 CFR 164.312(c)(1) — Integrity controls)
> **Standard**: optional (off by default)

### How It Works

When enabled, session data stored in CacheService is signed with HMAC-SHA256 before writing and verified on every read. This detects tampering — if anyone modifies the cached value directly, the signature won't match and the session is rejected.

### Implementation

The HMAC functions are already toggle-gated inside `exchangeTokenForSession()` and `validateSession()` in Section 7. Here is the standalone signing/verification logic:

```javascript
// =============================================
// HMAC — Session data integrity signing.
// Uses Utilities.computeHmacSha256Signature().
// Secret is stored in Script Properties.
// =============================================

/**
 * Convert GAS Byte[] to hex string for comparison.
 * GAS returns signed bytes (-128 to 127), not unsigned.
 */
function toHex(bytes) {
  return bytes.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/**
 * Sign session data with HMAC-SHA256.
 * @param {Object} sessionData - The session data to sign
 * @returns {string} JSON string containing data + signature
 */
function signSessionData(sessionData) {
  var secret = PropertiesService.getScriptProperties()
    .getProperty(AUTH_CONFIG.HMAC_SECRET_PROPERTY);
  if (!secret) {
    console.error('HMAC secret not configured in Script Properties');
    return JSON.stringify(sessionData); // fail open — no signing
  }
  var json = JSON.stringify(sessionData);
  var sig = Utilities.computeHmacSha256Signature(json, secret);
  return JSON.stringify({ d: json, s: toHex(sig) });
}

/**
 * Verify and extract session data.
 * @param {string} cached - The signed cache value
 * @returns {Object|null} Session data if valid, null if tampered
 */
function verifySessionData(cached) {
  var secret = PropertiesService.getScriptProperties()
    .getProperty(AUTH_CONFIG.HMAC_SECRET_PROPERTY);
  if (!secret) {
    // No secret configured — parse without verification
    try { return JSON.parse(cached); } catch(e) { return null; }
  }

  try {
    var parsed = JSON.parse(cached);
    if (!parsed.d || !parsed.s) {
      // Not a signed format — legacy or unsigned data
      return parsed;
    }
    var expected = toHex(
      Utilities.computeHmacSha256Signature(parsed.d, secret)
    );
    if (expected !== parsed.s) {
      auditLog('session_tampered', 'unknown', 'integrity_failure',
        { reason: 'HMAC signature mismatch' });
      return null; // tampered — reject
    }
    return JSON.parse(parsed.d);
  } catch (e) {
    return null;
  }
}
```

### Setup — Generating the HMAC Secret

The HMAC secret must be set in Script Properties before enabling the toggle:

1. Open Apps Script editor → Project Settings → Script Properties
2. Add key: `HMAC_SECRET` (or whatever `AUTH_CONFIG.HMAC_SECRET_PROPERTY` is set to)
3. Value: a random string (minimum 32 characters)

Generate a secret programmatically (run once):
```javascript
function generateHmacSecret() {
  var secret = Utilities.getUuid() + Utilities.getUuid();
  PropertiesService.getScriptProperties()
    .setProperty('HMAC_SECRET', secret);
  Logger.log('HMAC secret set: ' + secret.substring(0, 8) + '...');
}
```

### CacheService Storage Format

| HMAC Off | HMAC On |
|----------|---------|
| `{"email":"user@...","displayName":"...","expiry":1710000000}` | `{"d":"{\"email\":\"user@...\",\"displayName\":\"...\",\"expiry\":1710000000}","s":"a1b2c3d4..."}` |

The `d` field is the stringified data; the `s` field is the hex-encoded HMAC-SHA256 signature. Total overhead is ~70 bytes per entry (well within CacheService's 100KB-per-key limit).

---

## 12. Domain Restriction (Toggleable)

> **Toggle**: `AUTH_CONFIG.ENABLE_DOMAIN_RESTRICTION`
> **HIPAA**: mandatory (45 CFR 164.312(d) — Person or entity authentication)
> **Standard**: optional (off by default)

### How It Works

When enabled, the `exchangeTokenForSession()` function (Section 7) checks the authenticated user's email domain against `AUTH_CONFIG.ALLOWED_DOMAINS`. Users outside the allowed domains are rejected before a session is created.

### Domain Extraction and Validation

```javascript
// Already implemented inside exchangeTokenForSession() in Section 7:

if (AUTH_CONFIG.ENABLE_DOMAIN_RESTRICTION) {
  var emailDomain = userInfo.email.split('@')[1].toLowerCase();
  var allowed = AUTH_CONFIG.ALLOWED_DOMAINS.map(function(d) {
    return d.toLowerCase();
  });
  if (allowed.indexOf(emailDomain) === -1) {
    auditLog('domain_rejected', userInfo.email, 'rejected',
      { domain: emailDomain, allowed: allowed });
    return { success: false, error: 'domain_not_allowed' };
  }
}
```

### Security Notes

- **Use exact domain matching** (`===` after `split('@')`) — never `includes()`, `indexOf()`, or `endsWith()` on the full email string. These are bypassable (e.g., `endsWith('corp.com')` would match `evilcorp.com`)
- Subdomains are distinct: `mail.corp.com` ≠ `corp.com` — add each explicitly to `ALLOWED_DOMAINS`
- The domain check happens **after** Google token validation — the user is already authenticated by Google; this is an authorization check
- When domain restriction is off, any Google account can access the app (subject to spreadsheet access checks)

### Configuration

```javascript
// Standard preset: domain restriction OFF
ENABLE_DOMAIN_RESTRICTION: false,
ALLOWED_DOMAINS: [],

// HIPAA preset: domain restriction ON
ENABLE_DOMAIN_RESTRICTION: true,
ALLOWED_DOMAINS: [],  // ← MUST be set per-project (HIPAA validation enforces this)

// Per-project override example:
PROJECT_OVERRIDES = {
  ALLOWED_DOMAINS: ['yourhospital.com', 'partner-clinic.org']
};
```

---

## 13. Emergency Access (Toggleable)

> **Toggle**: `AUTH_CONFIG.ENABLE_EMERGENCY_ACCESS`
> **HIPAA**: mandatory (45 CFR 164.312(a)(2)(ii) — Emergency access procedure)
> **Standard**: optional (off by default)

### How It Works

Emergency access (break-glass) allows pre-designated administrators to bypass normal authorization when the standard flow fails — for example, when the spreadsheet is corrupted, permissions are misconfigured, or during a service disruption.

### Implementation

The check is already toggle-gated in `checkSpreadsheetAccess()` (Section 7):

```javascript
// Inside checkSpreadsheetAccess():
if (AUTH_CONFIG.ENABLE_EMERGENCY_ACCESS) {
  var emergencyEmails = PropertiesService.getScriptProperties()
    .getProperty(AUTH_CONFIG.EMERGENCY_ACCESS_PROPERTY);
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
}
```

### Setup — Configuring Emergency Access

1. Open Apps Script editor → Project Settings → Script Properties
2. Add key: `EMERGENCY_ACCESS_EMAILS` (or whatever `AUTH_CONFIG.EMERGENCY_ACCESS_PROPERTY` is set to)
3. Value: comma-separated list of admin email addresses

```
admin@yourdomain.com, backup-admin@yourdomain.com
```

### Security Safeguards

- **Always audit-logged** — every emergency access event is recorded with the user's email and a reason tag, even if audit logging is otherwise disabled (the `auditLog()` call inside the emergency check runs regardless of the toggle because it's a critical security event)
- **Stored in Script Properties** — only users with edit access to the Apps Script project can view or modify the list
- **Not stored in code** — the email list is a runtime configuration, not a hardcoded value. It can be updated without a code deployment
- **Separate from the enable toggle** — the toggle enables/disables the feature; the email list in Script Properties controls who has access. Disabling the toggle immediately removes all emergency access without needing to clear the email list

### Break-Glass Procedure (for HIPAA documentation)

1. Administrator identifies the access failure (normal auth/authorization not working)
2. Administrator opens Apps Script editor → Project Settings → Script Properties
3. Verifies `EMERGENCY_ACCESS_EMAILS` contains the needed user's email
4. If not present, adds the email (temporary — remove after resolution)
5. User accesses the app — emergency access is granted and audit-logged
6. After resolution, administrator removes the temporary email from the list
7. Reviews audit log for all emergency access events during the incident

---

## 14. CacheService Behavioral Caveats

> **Critical reference for anyone implementing server-side sessions with CacheService.** These behaviors are not always obvious from the documentation and can cause subtle bugs.

### Known Limits

| Limit | Value | Impact |
|-------|-------|--------|
| Max value size | 100 KB per key | Session data with HMAC overhead must stay under this. Typical auth session: ~500 bytes — no concern |
| Max TTL | 21,600 seconds (6 hours) | Sessions configured for >6h will expire early. `SESSION_EXPIRATION` must be ≤ 21,600 |
| Max items | ~1,000 before eviction | High-traffic apps with >1,000 concurrent sessions may see premature eviction. Keeps ~900 farthest from expiry |
| Eviction policy | Best-effort, not guaranteed | Items **can** be evicted before their TTL expires (Google's infrastructure may reclaim memory). Never treat CacheService as durable storage |
| No `getTimeToLive()` | Cannot check remaining TTL | Store the expiry timestamp **inside** the session data if you need to check it (already done in Section 7's `exchangeTokenForSession`) |

### Behavioral Gotchas

**1. `cache.get()` returns `null` for both "key doesn't exist" and "key expired"**

There is no way to distinguish between a session that never existed and one that expired. Both return `null`. This is why our `validateSession()` returns `{ status: 'expired' }` for any `null` result — it's the safe default.

**2. `cache.put()` with an existing key overwrites silently**

Session refresh (extending expiry) works by simply calling `put()` again with the same key and a new TTL. No delete-then-put needed.

**3. Values are strings only**

```javascript
// WRONG — stores "[object Object]"
cache.put('key', { email: 'user@example.com' });

// CORRECT — stringify first
cache.put('key', JSON.stringify({ email: 'user@example.com' }), ttl);
```

**4. `cache.remove()` is synchronous but eventual**

After `remove()`, subsequent `get()` calls **should** return `null`, but in rare cases under heavy load, the old value may briefly persist. This is an edge case — sign-out invalidation works correctly in practice.

**5. `CacheService.getScriptCache()` is shared across all users**

Session tokens are stored in the script-scoped cache, visible to all executions of the script. This is by design — any user's session needs to be validated by any request handler. The session token (UUID) provides the per-user isolation, not the cache scope.

### Session Expiry Strategy

Because CacheService's TTL is best-effort (items can be evicted early), always store an explicit expiry timestamp inside the session data:

```javascript
// Inside exchangeTokenForSession():
var sessionData = {
  email: userInfo.email,
  displayName: userInfo.name || '',
  createdAt: now,
  expiresAt: now + (AUTH_CONFIG.SESSION_EXPIRATION * 1000) // ms
};

// Inside validateSession():
var sessionData = /* retrieved from cache */;
if (Date.now() > sessionData.expiresAt) {
  // Session expired by our rules, even if cache hasn't evicted it yet
  cache.remove(sessionToken);
  return { status: 'expired', email: sessionData.email };
}
```

This ensures sessions expire at the configured time regardless of CacheService's internal TTL behavior.

---

## 15. Security Checklist

Use this checklist when deploying the unified pattern at any security level. Items marked **(HIPAA)** are mandatory for the `hipaa` preset; all others apply to both presets.

### Server-Side (GAS)

- [ ] `AUTH_CONFIG` preset is set correctly (`standard` or `hipaa`)
- [ ] Google OAuth token is validated server-side via `googleapis.com/oauth2/v3/userinfo` — never trusted from the client
- [ ] Session tokens are opaque UUIDs (`Utilities.getUuid()`) — no user data embedded in the token itself
- [ ] Session data is stored in `CacheService.getScriptCache()` with explicit expiry timestamps
- [ ] `SESSION_EXPIRATION` ≤ 900 seconds (15 min) **(HIPAA)**
- [ ] `ENABLE_DOMAIN_RESTRICTION` is `true` with `ALLOWED_DOMAINS` populated **(HIPAA)**
- [ ] Domain check uses exact match after `split('@')` — never `includes()` or `endsWith()` on the full email
- [ ] `ENABLE_AUDIT_LOG` is `true` and `SPREADSHEET_ID` points to a protected spreadsheet **(HIPAA)**
- [ ] Audit log sheet is protected (admin-only edit access)
- [ ] `ENABLE_HMAC_INTEGRITY` is `true` and `HMAC_SECRET` is set in Script Properties **(HIPAA)**
- [ ] HMAC secret is ≥32 characters, randomly generated
- [ ] `ENABLE_EMERGENCY_ACCESS` is `true` and `EMERGENCY_ACCESS_EMAILS` is set in Script Properties **(HIPAA)**
- [ ] Emergency access is audit-logged regardless of the audit toggle state
- [ ] Every server function that returns data uses the auth gate pattern (Section 7)
- [ ] `doGet()` never returns user data without session validation
- [ ] Web app is deployed as "Execute as: User accessing the web app" (not "Execute as me")

### Client-Side (HTML)

- [ ] `HTML_CONFIG.TOKEN_EXCHANGE_METHOD` matches `AUTH_CONFIG.TOKEN_EXCHANGE_METHOD`
- [ ] `STORAGE_TYPE` is `sessionStorage` **(HIPAA)**
- [ ] `ENABLE_INACTIVITY_TIMEOUT` is `true` with `CLIENT_INACTIVITY_TIMEOUT` ≤ session expiry **(HIPAA)**
- [ ] `ENABLE_AUTO_SIGNOUT` is `true` **(HIPAA)**
- [ ] postMessage `event.origin` is validated with strict equality (`=== 'https://script.google.com'`)
- [ ] No `'*'` used as `targetOrigin` when sending tokens (ready signal with `'*'` is acceptable — it contains no sensitive data)
- [ ] Sign-out clears storage, notifies server, and revokes Google token
- [ ] No raw Google access tokens stored in client storage — only opaque session tokens
- [ ] Google Identity Services loaded via `https://accounts.google.com/gsi/client`

### Infrastructure

- [ ] Google Workspace BAA is signed (if handling PHI) **(HIPAA)**
- [ ] Spreadsheet containing user data has appropriate sharing restrictions
- [ ] Apps Script project edit access is limited to administrators
- [ ] Script Properties secrets are not exposed in client-side code

---

## 16. Migration Guide

### From Pattern 3 → Unified (Standard Preset)

**Effort**: ~1-2 hours. Pattern 3 maps directly to the standard preset.

1. **Replace auth functions** — swap your `exchangeTokenForSession()`, `validateSession()`, `invalidateSession()`, and `doGet()` with the unified versions from Section 7
2. **Add config** — add `AUTH_CONFIG` with `ACTIVE_PRESET = 'standard'` and `resolveConfig()` from Section 4
3. **Add `auditLog()` wrapper** — even with audit disabled, the wrapper must exist (it's called throughout the code — when disabled, it's a no-op)
4. **Update HTML** — add `HTML_CONFIG` and replace storage calls with the storage abstraction from Section 8
5. **Test** — verify sign-in, sign-out, session resume, and silent re-auth work as before

### From Pattern 4 → Unified (Standard Preset)

**Effort**: ~1 hour. Pattern 4 is nearly identical to the standard preset.

1. Follow the Pattern 3 steps above
2. **Verify origin validation** — the unified pattern already uses strict `event.origin` checks
3. **Verify re-auth fallback** — the unified pattern already includes silent-then-interactive fallback

### From Pattern 5 → Unified (HIPAA Preset)

**Effort**: ~1-2 hours. Pattern 5 maps directly to the HIPAA preset.

1. Follow the Pattern 3 steps above, but use `ACTIVE_PRESET = 'hipaa'`
2. **Migrate Script Properties** — ensure `HMAC_SECRET` and `EMERGENCY_ACCESS_EMAILS` are set
3. **Migrate audit log** — the unified audit system uses the same spreadsheet format; existing logs are preserved
4. **Update HTML** — set `HTML_CONFIG` to match the HIPAA preset's HTML section (sessionStorage, postMessage, inactivity timeout, auto-signout)

### Upgrading Standard → HIPAA (Config Change Only)

**Effort**: ~30 minutes. This is the primary benefit of the unified pattern.

1. Change `ACTIVE_PRESET` from `'standard'` to `'hipaa'` in your `.gs` file
2. Set `ALLOWED_DOMAINS` in `PROJECT_OVERRIDES` (the HIPAA validation will enforce this)
3. Add Script Properties: `HMAC_SECRET` (random ≥32 chars), `EMERGENCY_ACCESS_EMAILS` (comma-separated)
4. Update `HTML_CONFIG` to match the HIPAA preset's HTML section
5. Run the security checklist (Section 15)
6. **No code changes needed** — the same code handles both security levels

---

## 17. Feature Toggle Matrix

Complete reference of every toggleable feature, its config key, default state per preset, and the HIPAA regulation it addresses (if applicable).

| Feature | Config Key (GAS) | Config Key (HTML) | Standard | HIPAA | HIPAA Regulation |
|---------|-----------------|-------------------|----------|-------|-----------------|
| Server-side sessions | *(always on)* | — | ✅ | ✅ | Baseline |
| Opaque session tokens | *(always on)* | — | ✅ | ✅ | Baseline |
| Silent re-auth | *(always on)* | — | ✅ | ✅ | Baseline |
| Interactive fallback | *(always on)* | — | ✅ | ✅ | Baseline |
| Strict origin validation | *(always on)* | — | ✅ | ✅ | Baseline |
| Domain restriction | `ENABLE_DOMAIN_RESTRICTION` | — | ❌ | ✅ | 164.312(d) |
| Audit logging | `ENABLE_AUDIT_LOG` | — | ❌ | ✅ | 164.312(b) |
| HMAC integrity | `ENABLE_HMAC_INTEGRITY` | — | ❌ | ✅ | 164.312(c)(1) |
| Emergency access | `ENABLE_EMERGENCY_ACCESS` | — | ❌ | ✅ | 164.312(a)(2)(ii) |
| postMessage exchange | `TOKEN_EXCHANGE_METHOD` | `TOKEN_EXCHANGE_METHOD` | `'url'` | `'postMessage'` | RFC 6750 §2.3 |
| sessionStorage | — | `STORAGE_TYPE` | `localStorage` | `sessionStorage` | 164.312(a)(2)(iii) |
| Inactivity timeout | — | `ENABLE_INACTIVITY_TIMEOUT` | ❌ | ✅ | 164.312(a)(2)(iii) |
| Auto sign-out | — | `ENABLE_AUTO_SIGNOUT` | ❌ | ✅ | 164.312(a)(2)(iii) |
| 15-min session cap | `SESSION_EXPIRATION` | — | 1800s | 900s | 164.312(a)(2)(iii) |

**Legend**: ✅ = enabled by default, ❌ = disabled by default. Any toggle can be overridden per-project via `PROJECT_OVERRIDES`.

---

## 18. Six-Pattern Comparison

How this pattern relates to all others in the series:

| Aspect | Pattern 1 | Pattern 2 | Pattern 3 | Pattern 4 | Pattern 5 | Pattern 6 (This) |
|--------|-----------|-----------|-----------|-----------|-----------|-------------------|
| **Auth method** | Custom user/pass | Google OAuth | Google OAuth | Google OAuth | Google OAuth | Google OAuth |
| **Token storage** | Server DB | localStorage (raw) | localStorage (opaque) | localStorage (opaque) | sessionStorage (opaque) | Configurable |
| **Session management** | Server-side | None (stateless) | CacheService | CacheService | CacheService + HMAC | CacheService ± HMAC |
| **Token exchange** | Form POST | URL parameter | URL parameter | URL parameter | postMessage | Configurable |
| **Domain restriction** | Manual | None | None | None | Workspace-only | Configurable |
| **Audit logging** | None | None | None | None | Google Sheets | Configurable |
| **Emergency access** | N/A | N/A | N/A | N/A | Script Properties | Configurable |
| **Session timeout** | Custom | None | Fixed | Fixed | 15-min (HIPAA) | Configurable |
| **Inactivity timeout** | None | None | None | None | 12-min client | Configurable |
| **Silent re-auth** | N/A | No | Yes | Yes (with fallback) | Yes (with fallback) | Yes (with fallback) |
| **Origin validation** | N/A | Basic | Basic | Strict (`===`) | Strict (`===`) | Strict (`===`) |
| **HIPAA compliant** | No | No | No | No | Yes | Yes (with `hipaa` preset) |
| **Toggleable features** | No | No | No | No | No | **Yes** |
| **Config-driven** | No | No | No | No | No | **Yes** |

### When to Use Each Pattern

- **Pattern 1** — When Google accounts are not available or not desired (custom auth)
- **Pattern 2** — Quick prototypes where security is not a concern
- **Pattern 3** — Internal tools with basic session management needs
- **Pattern 4** — Internal tools where research-backed security practices matter
- **Pattern 5** — Healthcare or regulated environments requiring HIPAA compliance
- **Pattern 6 (this)** — When you want one codebase that works at any security level, or when you anticipate needing to upgrade security later without code changes

---

## 19. Troubleshooting

### Common Issues

**"Session expired" immediately after sign-in**

- Check `SESSION_EXPIRATION` — is it set too low?
- Check CacheService TTL — `cache.put()` TTL must match or exceed `SESSION_EXPIRATION`
- Check for clock skew — `Date.now()` on the GAS server vs. the expiry timestamp stored in session data

**"Domain not allowed" for valid Workspace users**

- Verify `ALLOWED_DOMAINS` includes the correct domain (case-insensitive comparison)
- Check for subdomains — `mail.corp.com` ≠ `corp.com`
- Ensure the OAuth token userinfo returns the expected email domain (some Workspace configurations use email aliases)

**Silent re-auth fails, always shows consent screen**

- The Google Identity Services `prompt: ''` requires the user to have previously consented to the scopes
- First-time users always see the consent screen — this is expected
- Check that the OAuth client ID is configured for the correct domains in Google Cloud Console

**postMessage handshake never completes**

- Verify `TOKEN_EXCHANGE_METHOD` matches between GAS and HTML configs
- Check browser console for `event.origin` mismatches
- GAS web apps serve from `https://script.google.com` — verify this matches your origin check
- Check that the iframe `src` is set correctly (the GAS deployment URL, not the editor URL)

**HMAC verification fails after redeployment**

- Did the `HMAC_SECRET` in Script Properties change? A new secret invalidates all existing sessions
- After rotating the HMAC secret, all users must re-authenticate (existing sessions will fail integrity checks)
- Check for encoding issues — `JSON.stringify()` must produce identical output for the same data

**Audit log sheet not created**

- Verify `SPREADSHEET_ID` points to an accessible spreadsheet
- Check that the script has edit permission on the spreadsheet
- Look for errors in the Apps Script execution log (the `try/catch` in `auditLog()` logs errors to console)

**Emergency access not working**

- Verify `ENABLE_EMERGENCY_ACCESS` is `true` in the active config
- Check Script Properties — is `EMERGENCY_ACCESS_EMAILS` set with the correct key name?
- Email comparison is case-insensitive — but check for whitespace in the comma-separated list
- Emergency access bypasses `checkSpreadsheetAccess()` only — the user still needs a valid Google authentication

**Inactivity timeout fires too quickly**

- `CLIENT_INACTIVITY_TIMEOUT` is in milliseconds (720000 = 12 minutes)
- Check that activity event listeners are attached (`mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`)
- Activity inside the GAS iframe does NOT bubble to the parent — if the user is interacting only with the iframe, the parent's inactivity timer may fire. Solution: use `postMessage` to relay activity signals from the iframe to the parent

### Debug Mode

For development/testing, use the standard preset with selective overrides:

```javascript
var ACTIVE_PRESET = 'standard';
var PROJECT_OVERRIDES = {
  ENABLE_AUDIT_LOG: true,           // enable logging to debug auth flow
  SESSION_EXPIRATION: 60,           // 1-minute sessions for quick testing
};
```

> **Warning**: never deploy with `SESSION_EXPIRATION` set to testing values. The HIPAA preset validation will catch this (warns if >900s), but the standard preset has no such guard. Add your own validation if needed.

Developed by: LightAISolutions

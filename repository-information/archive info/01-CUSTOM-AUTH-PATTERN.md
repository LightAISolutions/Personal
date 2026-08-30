# Custom Authentication Pattern — GAS + Custom Domain HTML Wrapper

Reference implementation originally derived from `dchrcalendar.gs` + `dchrcalendar.html` (source files removed). Use this pattern when implementing custom username/password authentication for any Google Apps Script web app served via a custom domain. This is NOT Google OAuth/SSO — it is a fully custom auth system using credentials stored in a Google Sheet with server-side session tokens.

## Architecture Overview

Two files work together:

1. **HTML wrapper** (hosted on GitHub Pages / custom domain) — thin shell that embeds the GAS web app in a full-screen iframe, passes URL parameters through (especially `?token=xxx`), and listens for `postMessage` from the iframe for logout URL cleanup
2. **GAS script** (deployed as web app) — contains the entire authentication engine server-side: login page UI, credential validation, session management, and all protected functionality

### Why Two Files?

Google Apps Script iframe sandboxing prevents the GAS app from controlling the browser's visible URL. The HTML wrapper:
- Gives users a branded URL instead of `script.google.com/macros/s/...`
- Manages `?token=` in the browser URL bar (GAS inside an iframe can't `history.replaceState` on the parent)
- Provides a `postMessage` bridge so logout can strip the token from the visible URL
- Passes URL parameters from the parent page through to the iframe on load

---

## Authentication Flow

```
User visits custom domain URL
        │
        ▼
┌─────────────────────────┐
│  HTML Wrapper (iframe)   │  Loads GAS web app URL in iframe
│  Passes ?token=xxx       │  src = gasUrl + window.location.search
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  GAS doGet(e)            │  Checks if auth is required
│  Reads e.parameter.token │  (reads Users sheet, cached 5 min)
└─────────┬───────────────┘
          │
    ┌─────┴─────┐
    │           │
 No token    Has token
 or invalid   │
    │          ▼
    │   ┌──────────────────┐
    │   │ getSessionUsername│  Validates token format, checks
    │   │ (token)           │  CacheService, checks invalidation
    │   └────────┬─────────┘
    │       ┌────┴────┐
    │    Valid      Invalid
    │       │         │
    │       ▼         │
    │   Serve app     │
    │   (booking      │
    │    page)        │
    │                 │
    ▼                 ▼
┌─────────────────────────┐
│  Serve Login Page        │  Username + password form
│  (HTML inside GAS)       │  Animated UI with branding
└─────────┬───────────────┘
          │ User submits
          ▼
┌─────────────────────────┐
│  validateCredentials()   │  Server-side validation
│  - Check lockout         │
│  - Read Users sheet      │
│  - Case-insensitive user │
│  - Constant-time pw cmp  │
└─────────┬───────────────┘
          │ Success
          ▼
┌─────────────────────────┐
│  Generate session token  │  2x Utilities.getUuid(), 48 chars
│  Store in CacheService   │  Key: 'session_' + token
│  (15 min TTL)            │  Value: {username, createdAt}
│  Enforce single session  │  Invalidate prior active token
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Redirect to:            │  CUSTOM_DOMAIN_URL + '?token=' + token
│  customdomain.com?token= │  (or GAS URL if no custom domain)
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  HTML Wrapper reloads    │  Passes ?token=xxx through to iframe
│  iframe with token       │  GAS validates → serves app
└─────────────────────────┘
```

### Logout Flow

```
User clicks logout in GAS app
        │
        ▼
┌─────────────────────────┐
│  performLogout(token)    │  Removes session from CacheService
│  invalidateAllUserSess() │  Stores invalidation timestamp
│  logoutSession(token)    │  Clears active token tracking
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  GAS iframe sends        │  parent.postMessage(
│  postMessage to parent   │    {action: 'logout'}, '*')
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  HTML Wrapper receives   │  Validates origin is google.com
│  message, strips ?token  │  history.replaceState removes token
│  from URL bar            │  from visible URL
└─────────────────────────┘
```

---

## Implementation Components

### 1. HTML Wrapper (Custom Domain Page)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your App Title</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0e14; }
    iframe { width: 100%; height: 100%; border: none; display: block; }
    .loading {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #0a0e14; color: rgba(255,255,255,0.8);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      z-index: 10; transition: opacity 0.4s ease;
    }
    .loading.hidden { opacity: 0; pointer-events: none; }
    .spinner {
      width: 44px; height: 44px;
      border: 3px solid rgba(255,255,255,0.15); border-top-color: #3b82f6;
      border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { font-size: 15px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="loading" id="loadingOverlay">
    <div class="spinner"></div>
    <div class="loading-text">Loading…</div>
  </div>
  <iframe id="appFrame"></iframe>
  <script>
    // Base Google Apps Script URL — UPDATE WITH YOUR DEPLOYED SCRIPT URL
    var baseUrl = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

    // Pass through URL parameters (e.g., ?token=xxx) from parent to iframe
    var params = window.location.search;
    document.getElementById('appFrame').src = baseUrl + params;

    document.getElementById('appFrame').addEventListener('load', function() {
      document.getElementById('loadingOverlay').classList.add('hidden');
    });

    // Listen for messages from the iframe (logout URL cleanup)
    window.addEventListener('message', function(event) {
      var origin = event.origin || '';
      var isGoogle = origin.indexOf('google.com') !== -1 || origin.indexOf('googleusercontent.com') !== -1;
      if (!isGoogle) return;

      if (event.data && event.data.action === 'logout') {
        var url = new URL(window.location.href);
        if (url.searchParams.has('token')) {
          url.searchParams.delete('token');
          window.history.replaceState({}, '', url.toString());
        }
      }
    });
  </script>
</body>
</html>
```

### 2. GAS Authentication Functions (Server-Side)

#### Constants

```javascript
const CUSTOM_DOMAIN_URL = 'https://yourdomain.com/yourpage';  // or '' if no custom domain
const SESSION_EXPIRATION = 900;   // 15 minutes (seconds) — HIPAA compliant
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900;     // 15 minutes (seconds)
const CACHE_AUTH_DURATION = 300;  // 5 minutes — how long to cache "is auth required?" check
```

#### Core Functions to Implement

| Function | Purpose |
|----------|---------|
| `isAuthenticationRequired()` | Checks if Users sheet has credentials (cached 5 min). If no Users sheet or empty → no auth needed |
| `validateCredentials(username, password)` | Checks lockout → reads Users sheet → case-insensitive username match → constant-time password compare → generates token → returns `{success, token, redirectUrl}` |
| `generateSessionToken()` | Two `Utilities.getUuid()` calls, concatenated and truncated to 48 chars |
| `storeSessionToken(token, username)` | Stores `{username, createdAt}` in `CacheService` with key `'session_' + token`, TTL = SESSION_EXPIRATION |
| `getSessionUsername(token)` | Validates token format → reads from CacheService → checks invalidation timestamp → returns username or null |
| `verifySessionForAudit(token, allowUnauthenticated)` | Wrapper: if auth not required and allowUnauthenticated, returns 'Unlogged User'. Otherwise validates token |
| `logoutSession(token)` | Removes session from cache, clears active token tracking |
| `performLogout(token)` | Logs audit event → invalidates all user sessions → calls logoutSession → returns login page HTML |
| `invalidateAllUserSessions(username)` | Stores timestamp in cache — any session created before this time is invalid |
| `isSessionInvalidated(username)` | Reads invalidation timestamp from cache |
| `constantTimeCompare(a, b)` | XOR-based comparison that always checks all characters (prevents timing attacks) |
| `isAccountLocked(username)` | Checks cache for lockout key |
| `recordFailedAttempt(username)` | Increments attempt counter; locks account at MAX_LOGIN_ATTEMPTS |
| `clearFailedAttempts(username)` | Removes attempt counter from cache |
| `sanitizeUsernameForCache(username)` | Lowercases, strips non-alphanumeric, limits to 50 chars — prevents cache key injection |
| `getUserActiveToken(username)` / `setUserActiveToken(username, token)` / `clearUserActiveToken(username)` | Single-session enforcement — tracks which token is active for each user |

#### doGet Entry Point Pattern

```javascript
function doGet(e) {
  const token = sanitizeParam(e.parameter.token);

  // Check if authentication is required
  const authRequired = isAuthenticationRequired();

  // If auth required and no valid session, show login
  if (authRequired) {
    if (!token) return serveLoginPage();
    const username = getSessionUsername(token);
    if (!username) return serveLoginPage();
    // Valid session — serve the app
    return serveAppPage(token, username);
  }

  // No auth required — serve the app directly
  return serveAppPage(token, 'Unlogged User');
}
```

#### Login Redirect Pattern

After successful `validateCredentials()`, the GAS app returns the redirect URL. The client-side JavaScript in the login page performs the redirect:

```javascript
// Inside the GAS-served login page HTML:
google.script.run
  .withSuccessHandler(function(result) {
    if (result.success) {
      // Redirect to custom domain with token
      // Uses multiple methods for reliability
      try { top.location.href = result.redirectUrl; } catch(e) {}
      try { window.open(result.redirectUrl, '_top'); } catch(e) {}
      window.location.href = result.redirectUrl;
    }
  })
  .validateCredentials(username, password);
```

The redirect goes to `CUSTOM_DOMAIN_URL + '?token=' + token`, which reloads the HTML wrapper, which passes the token through to the iframe, where `doGet()` validates it and serves the app.

### 3. Client-Side Session Management

```javascript
// Inactivity timeout (inside GAS-served app HTML)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;  // 15 minutes
const WARNING_BEFORE_LOGOUT = 2 * 60 * 1000; // 2 minutes before
const SESSION_CHECK_INTERVAL = 30 * 1000;    // Poll server every 30s

// Reset timer on user activity
['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function(evt) {
  document.addEventListener(evt, resetInactivityTimer);
});

// Periodic server-side session check
setInterval(function() {
  google.script.run
    .withSuccessHandler(function(valid) {
      if (!valid) showLogoutModal('Session expired');
    })
    .checkSessionValid(currentToken);
}, SESSION_CHECK_INTERVAL);
```

### 4. postMessage for Logout (GAS → Parent)

```javascript
// Inside GAS-served HTML, after server-side logout completes:
try {
  if (window.parent !== window) {
    window.parent.postMessage({ action: 'logout' }, '*');
  }
} catch(e) {}
```

---

## Security Features Checklist

When implementing this pattern, include all of these:

- [ ] **Constant-time password comparison** — XOR-based, always checks all characters
- [ ] **Account lockout** — N failed attempts → M minute lockout via CacheService
- [ ] **Session tokens** — `Utilities.getUuid()` (cryptographically strong), 48+ chars
- [ ] **Session expiration** — 15 min TTL in CacheService (HIPAA requirement)
- [ ] **Single session enforcement** — one active token per user, prior sessions invalidated
- [ ] **Session invalidation on password change** — stores timestamp, sessions created before it are rejected
- [ ] **Client-side inactivity timeout** — auto-logout after 15 min idle with 2 min warning
- [ ] **Client-side session polling** — check server every 30s to detect server-side expiration
- [ ] **Input sanitization** — strip `<script>` tags, `javascript:` URIs, limit lengths
- [ ] **Token format validation** — alphanumeric, 32-64 chars, validated on every use
- [ ] **Cache key sanitization** — usernames sanitized before use as cache keys
- [ ] **Audit logging** — log all auth events (login, logout, failed attempts, lockouts, password changes)
- [ ] **URL parameter passthrough** — HTML wrapper forwards `?token=xxx` to iframe
- [ ] **postMessage origin validation** — only accept messages from `google.com` / `googleusercontent.com`
- [ ] **Logout URL cleanup** — strip token from browser URL bar on logout

## Recommended Improvement: Password Hashing

The original implementation stores passwords in **plaintext** in the Users sheet. Improve this by hashing with SHA-256:

```javascript
// When storing/changing a password:
function hashPassword(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest.map(function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

// On login — hash the submitted password and compare hashes:
// constantTimeCompare(storedHash, hashPassword(submittedPassword))
```

This way, anyone with Sheet access sees hashes instead of raw passwords. The rest of the auth flow is unchanged.

## Key Constants Reference

| Constant | Value | Purpose |
|----------|-------|---------|
| `SESSION_EXPIRATION` | 900 (15 min) | Session token TTL in CacheService |
| `MAX_LOGIN_ATTEMPTS` | 5 | Failed logins before lockout |
| `LOCKOUT_DURATION` | 900 (15 min) | Account lockout duration |
| `CACHE_AUTH_DURATION` | 300 (5 min) | Cache for "is auth required?" check |
| `INACTIVITY_TIMEOUT` | 15 min | Client-side idle auto-logout |
| `WARNING_BEFORE_LOGOUT` | 2 min | Warning before auto-logout |
| `SESSION_CHECK_INTERVAL` | 30s | Client polls server for session validity |

## Source Files

> **Note:** The original source files have been removed from the repo. This document preserves the implementation pattern for reference.
>
> - ~~**HTML wrapper**: `live-site-pages/dchrcalendar.html`~~ (removed)
> - ~~**GAS script**: `googleAppsScripts/dchrcalendar.gs`~~ (removed)

Developed by: LightAISolutions
